const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const catalog = require('./catalog');
const secureStore = require('./secure-store');
const usageStore = require('./usage-store');
const adapters = require('./adapters');
const router = require('./router');

const SETTINGS_FILE = path.join(__dirname, '..', '..', 'ai_routing.json');

const loadSettings = () => {
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      const saved = JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf8'));
      return { ...router.DEFAULT_SETTINGS, ...saved };
    }
  } catch (err) {
    console.error('[AI_MANAGER] Failed to load routing settings:', err.message);
  }
  return { ...router.DEFAULT_SETTINGS };
};

const saveSettings = (settings) => {
  const merged = { ...router.DEFAULT_SETTINGS, ...settings };
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(merged, null, 2), 'utf8');
  } catch (err) {
    console.error('[AI_MANAGER] Failed to save routing settings:', err.message);
  }
  return merged;
};

const decode = (provider) => provider.apiKey && provider.apiKey.startsWith('enc:')
  ? secureStore.decryptString(provider.apiKey)
  : secureStore.decodeLegacy(provider.apiKey);

const enrichment = (provider) => {
  const spec = catalog.getProvider(provider.provider);
  return {
    ...provider,
    catalog: spec || null,
    models: spec ? catalog.getModels(provider.provider) : [],
  };
};

const getAll = () => secureStore.loadProviders().map(enrichment);

const getEnabled = () => secureStore.loadEnabled().map(enrichment);

const findById = (id) => getAll().find(p => p.id === id) || null;

const listForClient = () => {
  const providers = getAll();
  const usageMap = new Map((usageStore.summary().providers || []).map(u => [u.providerId, u]));
  return providers.map(p => {
    const redacted = secureStore.redact(p);
    const u = usageMap.get(p.id);
    return { ...redacted, keyPreview: secureStore.keyPreview(p), usage: u || null, health: usageStore.health(p.id) };
  });
};

const createProviderCfg = ({ provider, apiKey, name, displayName, model, priority, enabled, enabledCapabilities, baseUrl, azureResource, azureDeployment, apiVersion }) => {
  if (!catalog.isValidProvider(provider)) throw new Error(`Unsupported provider type: ${provider}`);
  if (!apiKey) throw new Error('API key is required');
  const spec = catalog.getProvider(provider);
  const now = new Date().toISOString();
  return {
    id: crypto.randomUUID(),
    name: name || displayName || spec.name,
    provider,
    apiKey: secureStore.encryptKey(apiKey),
    model: model || spec.defaultModel || '',
    priority: typeof priority === 'number' ? priority : 0,
    enabled: enabled !== false,
    baseUrl: baseUrl || spec.baseUrl || '',
    azureResource: azureResource || '',
    azureDeployment: azureDeployment || '',
    apiVersion: apiVersion || '2024-10-21',
    capabilities: enabledCapabilities || [],
    status: 'configured',
    createdAt: now,
    updatedAt: now,
  };
};

const add = (input) => {
  const providers = secureStore.loadProviders();
  const cfg = createProviderCfg(input);
  providers.push(cfg);
  providers.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  secureStore.saveProviders(providers);
  return cfg;
};

const update = (id, patch) => {
  const providers = secureStore.loadProviders();
  const index = providers.findIndex(p => p.id === id);
  if (index === -1) return null;
  const current = providers[index];
  const safe = { ...patch };
  delete safe.id;
  if (safe.apiKey) {
    safe.apiKey = secureStore.encryptKey(safe.apiKey);
  }
  if (safe.priority !== undefined) {
    const occupied = providers.some((p, i) => i !== index && p.priority === safe.priority);
    if (occupied) safe.priority = safe.priority + 0.5;
  }
  providers[index] = { ...current, ...safe, updatedAt: new Date().toISOString() };
  providers.sort((a, b) => (a.priority || 0) - (b.priority || 0));
  secureStore.saveProviders(providers);
  return providers[index];
};

const remove = (id) => {
  const providers = secureStore.loadProviders();
  const filtered = providers.filter(p => p.id !== id);
  if (filtered.length === providers.length) return false;
  secureStore.saveProviders(filtered);
  usageStore.resetUsage(id);
  router.clearCooldown(id);
  const settings = loadSettings();
  if (settings.preferredProviderId === id) {
    saveSettings({ ...settings, preferredProviderId: '' });
  }
  return true;
};

const reorder = (orderedIds) => {
  if (!Array.isArray(orderedIds)) return null;
  const providers = secureStore.loadProviders();
  const byId = new Map(providers.map(p => [p.id, p]));
  if (orderedIds.some(id => !byId.has(id))) return null;
  const ordered = [];
  orderedIds.forEach((id, i) => {
    const p = byId.get(id);
    p.priority = i;
    ordered.push(p);
  });
  const rest = providers.filter(p => !orderedIds.includes(p.id))
    .sort((a, b) => (a.priority || 0) - (b.priority || 0));
  rest.forEach((p, i) => { p.priority = ordered.length + i; ordered.push(p); });
  secureStore.saveProviders(ordered);
  return ordered.map(enrichment);
};

const validateKey = async ({ apiKey, provider, model, baseUrl = '', azureResource = '', azureDeployment = '', apiVersion = '2024-10-21' }) => {
  if (!catalog.isValidProvider(provider)) throw new Error(`Unsupported provider type: ${provider}`);
  const spec = catalog.getProvider(provider);
  const stub = {
    id: provider,
    provider,
    name: spec.name,
    apiKey: secureStore.encryptKey(apiKey),
    model: model || spec.defaultModel || '',
    baseUrl: baseUrl || spec.baseUrl || '',
    azureResource: azureResource || '',
    azureDeployment: azureDeployment || '',
    apiVersion: apiVersion || '2024-10-21',
  };
  const result = await adapters.callProvider(stub, {
    apiKey,
    model: stub.model,
    catalog: spec,
    user: 'Reply with the single word: OK',
    maxTokens: 8,
    temperature: 0,
    timeoutMs: 25000,
  });
  if (result.text.toUpperCase().includes('OK')) return { success: true, result };
  return { success: true, result };
};

const testProvider = async (providerId) => {
  const provider = findById(providerId);
  if (!provider) throw new Error('Provider not found');
  const apiKey = decode(provider);
  if (!apiKey) throw new Error('Provider has no API key');
  const started = Date.now();
  const ok = await validateKey({
    apiKey,
    provider: provider.provider,
    model: provider.model,
    baseUrl: provider.baseUrl,
    azureResource: provider.azureResource,
    azureDeployment: provider.azureDeployment,
    apiVersion: provider.apiVersion,
  });
  const latency = Date.now() - started;
  usageStore.recordSuccess(provider.id, { latencyMs: latency, model: provider.model });
  return { success: true, latencyMs: latency, model: ok.result && ok.result.model, provider: provider.name };
};

const recordFailure = (provider, error, model, requestId) => {
  usageStore.recordFailure(provider.id, {
    category: error.category || 'PROVIDER',
    message: error.upstreamMessage || error.message,
    model,
    requestId,
  });
};

const complete = async (opts = {}) => {
  const settings = loadSettings();
  let providers;
  if (Array.isArray(opts.providers) && opts.providers.length) {
    providers = opts.providers.map(enrichment);
  } else if (opts.providerId) {
    const single = findById(opts.providerId);
    providers = single ? [single] : [];
  } else {
    providers = getEnabled();
  }
  if (!providers.length) {
    return { ok: false, error: 'No AI providers configured. Add one in AI Provider settings.', provider: null, providerType: null, model: null };
  }
  const usageSummary = usageStore.summary().providers || [];
  const usageMap = new Map(usageSummary.map(u => [u.providerId, u]));
  const { attempts, locked } = router.buildAttempts(providers, settings, usageMap);
  const requestId = crypto.randomUUID();
  const errors = [];
  if (!attempts.length) {
    const error = new Error(locked.length ? 'AI providers are cooling down after recent failures.' : 'No AI providers are enabled.');
    error.category = 'COOLDOWN';
    return { ok: false, error: error.message, provider: null, providerType: null, model: null, requestId };
  }
  for (const attempt of attempts) {
    const { provider, model, attempt: retry } = attempt;
    if (retry > 0 && attempt.baseDelayMs) {
      await new Promise(r => setTimeout(r, attempt.baseDelayMs));
    }
    const apiKey = decode(provider);
    if (!apiKey) {
      const err = { category: 'AUTH', message: 'API key is missing' };
      errors.push(Object.assign(err, { provider: provider.name }));
      recordFailure(provider, err, model, requestId);
      continue;
    }
    const started = Date.now();
    try {
      const result = await adapters.callProvider(provider, { ...opts, apiKey, model: opts.model || model, requestId });
      const latency = Date.now() - started;
      usageStore.recordSuccess(provider.id, {
        latencyMs: latency,
        inputTokens: result.usage.inputTokens,
        outputTokens: result.usage.outputTokens,
        model: result.model,
        requestId,
      });
      router.clearCooldown(provider.id);
      return {
        ok: true,
        text: result.text,
        provider: provider.name,
        providerId: provider.id,
        providerType: result.providerType,
        model: result.model,
        finishReason: result.finishReason,
        usage: result.usage,
        requestId,
        latencyMs: latency,
      };
    } catch (err) {
      err.provider = provider.name;
      recordFailure(provider, err, model, requestId);
      errors.push(err);
      if (err.category === 'AUTH' || err.retriable === false) {
        router.setCooldown(provider.id, settings.cooldownMs);
      } else if (err.category) {
        router.setCooldown(provider.id, Math.min(settings.cooldownMs * (retry + 1), settings.maxCooldownMs));
      }
    }
  }
  const first = errors[0] || new Error('All AI providers failed');
  return {
    ok: false,
    error: errors.length > 1 ? 'All AI providers failed. ' + first.message : first.message,
    category: first.category || 'PROVIDER',
    provider: errors.map(e => e.provider).filter(Boolean).join(', ') || null,
    providerType: null,
    model: null,
    requestId,
  };
};

const extractJson = (text) => {
  if (!text) return null;
  const cleaned = String(text).trim();
  const tryParse = (s) => {
    try { return JSON.parse(s); } catch { return null; }
  };
  let parsed = tryParse(cleaned);
  if (parsed) return parsed;
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fenced) {
    parsed = tryParse(fenced[1].trim());
    if (parsed) return parsed;
  }
  const open = cleaned.indexOf('{');
  const close = cleaned.lastIndexOf('}');
  if (open !== -1 && close > open) {
    parsed = tryParse(cleaned.slice(open, close + 1));
    if (parsed) return parsed;
  }
  return null;
};

const completeJson = async (opts = {}) => {
  const result = await complete({ ...opts, json: true, temperature: opts.temperature ?? 0.4 });
  if (!result.ok) return { ...result, data: null };
  const parsed = extractJson(result.text);
  if (!parsed) return { ...result, ok: false, error: 'AI returned invalid JSON', data: null };
  return { ...result, data: parsed };
};

const listModels = async (provider, apiKey) => {
  const spec = catalog.getProvider(provider);
  const staticModels = catalog.getModels(provider);
  if (!apiKey) return staticModels;
  if (provider === 'anthropic') {
    try {
      const res = await fetch('https://api.anthropic.com/v1/models', {
        headers: { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' },
      });
      if (res.ok) {
        const body = await res.json();
        const live = (body.data || []).map(m => ({ id: m.id, label: m.id, tier: 'live' }));
        if (live.length) return live.slice(0, 40);
      }
    } catch { /* fall back to catalog */ }
    return staticModels;
  }
  if (provider === 'openai' || provider === 'groq' || provider === 'openrouter' || provider === 'together' || provider === 'mistral' || provider === 'deepseek' || provider === 'xai' || provider === 'perplexity') {
    const base = spec.baseUrl.replace(/\/chat\/completions(\?.*)?$/, '').replace(/\/messages$/, '');
    try {
      const res = await fetch(`${base}/models`, { headers: { Authorization: `Bearer ${apiKey}` } });
      if (res.ok) {
        const body = await res.json();
        const live = (body.data || []).map(m => ({ id: m.id, label: m.id, tier: 'live' })).slice(0, 60);
        if (live.length) return live;
      }
    } catch { /* fall back to catalog */ }
  }
  return staticModels;
};

module.exports = {
  loadSettings,
  saveSettings,
  getAll,
  getEnabled,
  findById,
  listForClient,
  add,
  update,
  remove,
  reorder,
  validateKey,
  testProvider,
  complete,
  completeJson,
  extractJson,
  listModels,
  decode,
  SETTINGS_FILE,
};