const DEFAULT_TIMEOUT_MS = 45000;
const MAX_MESSAGES = 24;

const classifyHttpError = (status, body = '', isAbort = false) => {
  if (isAbort) return { category: 'TIMEOUT', retriable: true, userMessage: 'The provider did not respond in time.' };
  if (status === 401 || status === 403) return { category: 'AUTH', retriable: false, userMessage: 'Your API key could not be authenticated. Please update your credentials.' };
  if (status === 429) return { category: 'RATE_LIMIT', retriable: true, userMessage: 'The provider is rate-limiting requests. Retrying a backup provider.' };
  if (status >= 500) return { category: 'PROVIDER', retriable: true, userMessage: 'The provider is temporarily unavailable.' };
  if (status === 400 || status === 404 || status === 422 || status === 402) {
    const text = String(body || '').slice(0, 400);
    if (/invalid api key|authentication/i.test(text)) return { category: 'AUTH', retriable: false, userMessage: 'Your API key could not be authenticated. Please update your credentials.' };
    if (/insufficient.*quota|account has insufficient|billing|credits/i.test(text)) return { category: 'QUOTA', retriable: false, userMessage: 'Your account has insufficient credits or quota.' };
    if (/model.*(not found|unavailable|does not exist)|not supported|invalid model/i.test(text)) return { category: 'MODEL', retriable: false, userMessage: 'The selected model is unavailable for your account.' };
    return { category: 'INVALID', retriable: false, userMessage: 'The provider rejected the request. Check the model and request content.' };
  }
  return { category: 'PROVIDER', retriable: true, userMessage: 'The provider could not complete the request.' };
};

const classifyNetworkError = (message = '') => {
  if (/timed out|timeout|abort/i.test(message)) return { category: 'TIMEOUT', retriable: true, userMessage: 'The provider did not respond in time.' };
  if (/enotfound|econnreset|econnrefused|eai_again|fetch failed|network/i.test(message)) return { category: 'NETWORK', retriable: true, userMessage: 'Could not reach the provider. Check the base URL and your connection.' };
  return { category: 'PROVIDER', retriable: true, userMessage: 'The provider request failed unexpectedly.' };
};

const fetchJson = async (url, options, timeoutMs = DEFAULT_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    const text = await res.text();
    let body = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!res.ok) {
      const err = new Error(`HTTP ${res.status}`);
      err.status = res.status;
      err.body = body;
      throw err;
    }
    return { body, raw: text };
  } catch (err) {
    if (err.name === 'AbortError' || err.code === 'ABORT_ERR' || /abort/i.test(String(err.message || ''))) {
      const e = new Error('Request timed out');
      e.timeout = true;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
};

const prepareMessages = ({ system, user, history }) => {
  const messages = [];
  if (system) messages.push({ role: 'system', content: String(system) });
  if (Array.isArray(history)) {
    messages.push(...history.slice(-MAX_MESSAGES).map(m => ({
      role: m.role === 'assistant' ? 'assistant' : m.role === 'system' ? 'system' : 'user',
      content: typeof m.content === 'string' ? m.content : String(m.content || ''),
    })));
  }
  if (user !== undefined && user !== null && String(user).trim() !== '') messages.push({ role: 'user', content: String(user) });
  if (messages.length === 0) messages.push({ role: 'user', content: 'Hello' });
  return messages;
};

const openaiRequest = (provider, opts, extraHeaders = {}, extraBody = {}) => {
  const messages = prepareMessages(opts);
  const body = {
    model: opts.model || provider.model,
    messages,
    temperature: opts.temperature ?? 0.7,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
    ...extraBody,
  };
  return {
    url: provider.baseUrl,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
        ...extraHeaders,
      },
      body: JSON.stringify(body),
    },
  };
};

const parseOpenAI = (body, provider, model) => {
  const choice = body && body.choices && body.choices[0];
  const text = choice && choice.message && typeof choice.message.content === 'string'
    ? choice.message.content
    : (choice && choice.message && choice.message.content) || '';
  const usage = body && body.usage;
  return {
    text: String(text).trim(),
    finishReason: choice && choice.finish_reason,
    usage: {
      inputTokens: usage && usage.prompt_tokens,
      outputTokens: usage && usage.completion_tokens,
    },
    requestId: body && body.id,
    model: body && body.model ? body.model : model,
  };
};

const anthropicRequest = (provider, opts) => {
  const messages = prepareMessages(opts);
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const userMessages = messages.filter(m => m.role !== 'system');
  const spec = opts.catalog || {};
  const noTemp = spec && spec.noTemp;
  const body = {
    model: opts.model || provider.model,
    max_tokens: opts.maxTokens || 2000,
    ...(noTemp ? {} : { temperature: opts.temperature ?? 0.7 }),
    messages: userMessages.map(m => ({ role: m.role, content: m.content })),
  };
  if (system) body.system = system;
  return {
    url: 'https://api.anthropic.com/v1/messages',
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': opts.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    },
  };
};

const parseAnthropic = (body, model) => {
  const parts = (body && body.content) || [];
  const text = parts.filter(p => p && p.type === 'text').map(p => p.text).join('');
  const usage = body && body.usage;
  return {
    text: String(text).trim(),
    finishReason: body && body.stop_reason,
    usage: {
      inputTokens: usage && usage.input_tokens,
      outputTokens: usage && usage.output_tokens,
    },
    requestId: body && body.id,
    model: body && body.model ? body.model : model,
  };
};

const geminiRequest = (provider, opts) => {
  const messages = prepareMessages(opts);
  const system = messages.filter(m => m.role === 'system').map(m => m.content).join('\n');
  const history = messages.filter(m => m.role !== 'system');
  const contents = history.map(m => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [{ text: m.content }] }));
  const body = {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents,
    generationConfig: {
      temperature: opts.temperature ?? 0.7,
      ...(opts.maxTokens ? { maxOutputTokens: opts.maxTokens } : {}),
    },
  };
  const base = provider.baseUrl || 'https://generativelanguage.googleapis.com/v1beta';
  return {
    url: `${base}/models/${opts.model || provider.model}:generateContent?key=${encodeURIComponent(opts.apiKey)}`,
    options: {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    },
  };
};

const parseGemini = (body, model) => {
  const candidates = (body && body.candidates) || [];
  const parts = candidates[0] && candidates[0].content && candidates[0].content.parts;
  const text = (parts || []).map(p => p.text || '').join('');
  const usage = body && body.usageMetadata;
  return {
    text: String(text).trim(),
    finishReason: candidates[0] && candidates[0].finishReason,
    usage: {
      inputTokens: usage && usage.promptTokenCount,
      outputTokens: usage && usage.candidatesTokenCount,
    },
    requestId: null,
    model: body && body.modelVersion ? body.modelVersion : model,
  };
};

const cohereRequest = (provider, opts) => {
  const messages = prepareMessages(opts);
  const body = {
    model: opts.model || provider.model,
    messages,
    ...(opts.json ? {} : {}),
    temperature: opts.temperature ?? 0.7,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
  };
  return {
    url: 'https://api.cohere.com/v2/chat',
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${opts.apiKey}`,
      },
      body: JSON.stringify(body),
    },
  };
};

const parseCohere = (body, model) => {
  const blocks = (body && body.message && body.message.content) || [];
  const text = blocks.map(b => (typeof b === 'string' ? b : b && b.text)).filter(Boolean).join('');
  const usage = body && body.usage;
  return {
    text: String(text).trim(),
    finishReason: body && (body.finishReason || (body.message && body.message.finish_reason)),
    usage: {
      inputTokens: usage && (usage.input_tokens || usage.tokens && usage.tokens.input_tokens),
      outputTokens: usage && (usage.output_tokens || usage.tokens && usage.tokens.output_tokens),
    },
    requestId: body && body.id,
    model: body && (body.model || body._meta && body._meta.model) ? (body.model || body._meta.model) : model,
  };
};

const azureRequest = (provider, opts) => {
  const messages = prepareMessages(opts);
  const resource = provider.azureResource || 'your-resource';
  const deployment = opts.model || provider.model || 'gpt-4o-mini';
  const apiVersion = provider.apiVersion || '2024-10-21';
  const url = `https://${resource}.openai.azure.com/openai/deployments/${encodeURIComponent(deployment)}/chat/completions?api-version=${apiVersion}`;
  const body = {
    messages,
    temperature: opts.temperature ?? 0.7,
    ...(opts.maxTokens ? { max_tokens: opts.maxTokens } : {}),
    ...(opts.json ? { response_format: { type: 'json_object' } } : {}),
  };
  return {
    url,
    options: {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': opts.apiKey,
      },
      body: JSON.stringify(body),
    },
  };
};

const builders = {
  openai: (provider, opts) => openaiRequest(provider, opts, provider.provider === 'openrouter'
    ? { 'HTTP-Referer': 'https://whatsapp-shield.app', 'X-Title': 'WhatsApp Shield' } : {}),
  'openai-compatible': (provider, opts) => openaiRequest(provider, opts),
  groq: (provider, opts) => openaiRequest(provider, opts),
  mistral: (provider, opts) => openaiRequest(provider, opts),
  deepseek: (provider, opts) => openaiRequest(provider, opts),
  openrouter: (provider, opts) => openaiRequest(provider, opts, { 'HTTP-Referer': 'https://whatsapp-shield.app', 'X-Title': 'WhatsApp Shield' }),
  together: (provider, opts) => openaiRequest(provider, opts),
  perplexity: (provider, opts) => openaiRequest(provider, opts),
  xai: (provider, opts) => openaiRequest(provider, opts),
  anthropic: anthropicRequest,
  gemini: geminiRequest,
  cohere: cohereRequest,
  azure: azureRequest,
};

const parsers = {
  openai: parseOpenAI,
  'openai-compatible': parseOpenAI,
  groq: parseOpenAI,
  mistral: parseOpenAI,
  deepseek: parseOpenAI,
  openrouter: parseOpenAI,
  together: parseOpenAI,
  perplexity: parseOpenAI,
  xai: parseOpenAI,
  anthropic: parseAnthropic,
  gemini: parseGemini,
  cohere: parseCohere,
  azure: parseOpenAI,
};

const callProvider = async (provider, opts = {}) => {
  const type = provider.provider || 'openai-compatible';
  const build = builders[type];
  if (!build) throw new Error(`Unsupported provider type: ${type}`);
  const spec = opts.catalog || {};
  const { url, options } = build(provider, { ...opts, catalog: spec });
  const started = Date.now();
  let res;
  try {
    res = await fetchJson(url, options, opts.timeoutMs || DEFAULT_TIMEOUT_MS);
  } catch (err) {
    const classification = err.status
      ? classifyHttpError(err.status, typeof err.body === 'string' ? err.body : JSON.stringify(err.body || ''), false)
      : classifyNetworkError(String(err.message || ''));
    const error = new Error(classification.userMessage);
    error.category = classification.category;
    error.retriable = classification.retriable;
    error.status = err.status;
    error.upstreamMessage = typeof err.body === 'string' ? err.body : (err.body && JSON.stringify(err.body)) || null;
    throw error;
  }
  const latency = Date.now() - started;
  const parse = parsers[type];
  const parsed = parse(res.body, opts.model || provider.model);
  if (!parsed.text) {
    const error = new Error('The provider returned an empty response.');
    error.category = 'INVALID';
    error.retriable = false;
    error.status = res.body && res.status;
    throw error;
  }
  return {
    ...parsed,
    latency,
    provider: provider.name || provider.provider,
    providerId: provider.id,
    providerType: type,
    model: parsed.model || opts.model || provider.model,
    catalog: spec,
  };
};

module.exports = {
  callProvider,
  classifyHttpError,
  classifyNetworkError,
  prepareMessages,
  DEFAULT_TIMEOUT_MS,
};