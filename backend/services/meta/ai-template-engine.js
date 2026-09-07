const store = require('./store');
const gateway = require('./ai-gateway');
const engine = require('./compliance-engine');

// Normalize a loose template object into the canonical shape the engine uses.
const normalizeTemplate = (t) => {
  const source = t || {};
  const headerType = source.headerType || (source.headerMediaType && source.headerMediaType !== 'none' ? source.headerMediaType : source.headerText ? 'TEXT' : 'none');
  const buttons = Array.isArray(source.buttons) ? source.buttons.map(b => ({
    type: b.type || 'QUICK_REPLY',
    text: b.text || '',
    url: b.url || '',
    phoneNumber: b.phoneNumber || '',
    couponCode: b.couponCode || '',
  })) : [];
  const variables = extractExampleVariables(source.body);
  return {
    id: source.id || null,
    name: source.name || '',
    category: source.category || 'UTILITY',
    language: source.language || 'en',
    purpose: source.purpose || 'other',
    headerType,
    headerText: source.headerText || '',
    headerMediaLink: source.headerMediaLink || '',
    body: source.body || '',
    footerText: source.footerText || '',
    buttons,
    exampleValues: source.exampleValues || variables || {},
    prompt: source.prompt || '',
    summary: source.summary || '',
    trusted: source.trusted !== false,
  };
};

// Pull an example map ({{1}}: "John") out of a body full of filled placeholders.
const extractExampleVariables = (body, exampleText) => {
  const map = {};
  const re = /\{\{\s*(\d{1,2})\s*\}\}/g;
  let m;
  while ((m = re.exec(String(body || '')))) {
    const num = Number(m[1]);
    if (map[num] === undefined) map[num] = `Example ${num}`;
  }
  // If the model returned pre-filled example values in a parallel array, fold them in.
  if (exampleText && typeof exampleText === 'object') {
    for (const [k, v] of Object.entries(exampleText)) {
      const num = Number(k);
      if (num && v) map[num] = String(v);
    }
  }
  return map;
};

const SYSTEM_INTRO = `You are a WhatsApp Business message template generator for the official Meta WhatsApp Business Platform.
You create templates that Meta will actually review. You understand the official Meta template requirements:
- Categories: MARKETING, UTILITY, AUTHENTICATION only.
- Name: lowercase letters, numbers and underscores (^[a-z0-9_]+$).
- Body max 1024 characters; header max 60 (TEXT), footer max 60; button labels max 25.
- Variables are sequential {{1}}, {{2}}, ... starting at 1, each normally unique, max 30.
- Headers can be TEXT, IMAGE, VIDEO, DOCUMENT or LOCATION. Media headers reference a public https URL.
- Buttons: up to 3 QUICK_REPLY, up to 2 URL (https only), up to 2 PHONE_NUMBER; max 10 total.
- Marketing templates need opt-out / unsubscribe language. Utility/Authentication templates must NOT contain promotional or marketing content.
- No emojis. No misleading or absolute claims, no fake urgency, no spam-like punctuation, no unverifiable guarantees.
- Templates must be factual, professional and specific to the recipient's need.`;

const BODY_INSTRUCTIONS = `Return ONLY a valid JSON object with this exact shape:
{
  "name": "lowercase_with_underscores",
  "category": "MARKETING|UTILITY|AUTHENTICATION",
  "language": "en" (ISO language code, e.g. "en", "es", "en_GB"),
  "headerType": "none|TEXT|IMAGE|VIDEO|DOCUMENT|LOCATION",
  "headerText": "short header text (<=60 chars) or empty",
  "headerMediaLink": "public https media URL for media headers, else empty",
  "body": "the message body with {{1}}, {{2}} variables where personalization helps",
  "footerText": "short footer (<=60 chars) or empty",
  "buttons": [
    { "type": "QUICK_REPLY", "text": "Yes" },
    { "type": "URL", "text": "Learn More", "url": "https://example.com" },
    { "type": "PHONE_NUMBER", "text": "Call us", "phoneNumber": "+12025550136" }
  ],
  "exampleValues": { "1": "John", "2": "Acme Ltd" },
  "summary": "one sentence explaining the business purpose"
}
Rules:
- Only hyperlinks https:// are allowed in URL buttons.
- For a header, prefer TEXT unless the business clearly benefits from media.
- The FIRST plain-text value of a body variable is placed in exampleValues as a realistic example.
- Never invent fake guarantees, prices, deadlines or statistics not in the user's prompt.
- Keep the language natural and human, not salesy.
- If the user's prompt contains risky or non-compliant wording, silently produce the compliant version preserving the business objective.
- AUTHENTICATION templates: body is ONLY the passcode/OTP message, no marketing.
- UTILITY templates: strictly service-related.`;

// Build the example payload Meta needs for variables.
const buildExamplePayload = (template) => {
  const values = template.exampleValues || {};
  const bodyText = buildBodyText(template.body, template.exampleValues || {});
  return {
    body_text: [
      {
        text: bodyText,
        ...(Object.keys(values).length ? { variables: Object.keys(values).sort((a, b) => Number(a) - Number(b)).map(k => String(values[k])) } : {}),
      },
    ],
  };
};

// Replace {{1}}..{{n}} with example values for the preview + Meta example body.
const buildBodyText = (body, exampleValues) => {
  const result = String(body || '');
  const re = /\{\{\s*(\d{1,2})\s*\}\}/g;
  let match;
  const segments = [];
  let lastIndex = 0;
  let hasVars = false;
  while ((match = re.exec(result))) {
    hasVars = true;
    segments.push(result.slice(lastIndex, match.index));
    const num = Number(match[1]);
    segments.push(exampleValues[num] !== undefined ? String(exampleValues[num]) : `[${num}]`);
    lastIndex = match.index + match[0].length;
  }
  segments.push(result.slice(lastIndex));
  return hasVars ? segments.join('') : result;
};

// Convert a normalized template into the Graph API createTemplate payload.
const buildSubmissionPayload = (template) => {
  const t = normalizeTemplate(template);
  const components = [];
  if (t.headerType === 'TEXT') {
    components.push({ type: 'HEADER', format: 'TEXT', text: t.headerText || '' });
  } else if (t.headerType && t.headerType !== 'none') {
    // IMAGE / VIDEO / DOCUMENT / LOCATION headers reference a public URL.
    const comp = { type: 'HEADER', format: t.headerType };
    if (t.headerMediaLink && /^https:\/\//.test(t.headerMediaLink)) comp.link = t.headerMediaLink;
    components.push(comp);
  }

  const bodyComp = { type: 'BODY', text: t.body || '' };
  const example = buildExamplePayload(t);
  bodyComp.example = example;
  components.push(bodyComp);

  if (t.footerText) components.push({ type: 'FOOTER', text: t.footerText });

  if (t.buttons && t.buttons.length) {
    const buttons = t.buttons.map(b => {
      if (b.type === 'URL') return { type: 'URL', text: b.text || 'Learn More', url: b.url || 'https://example.com' };
      if (b.type === 'PHONE_NUMBER') return { type: 'PHONE_NUMBER', text: b.text || 'Call', phone_number: b.phoneNumber || '' };
      return { type: 'QUICK_REPLY', text: b.text || '' };
    });
    components.push({ type: 'BUTTONS', buttons });
  }

  return {
    name: t.name,
    language: t.language,
    category: t.category,
    parameter_format: 'positional',
    allow_category_change: true,
    components,
  };
};

// The main generation entry: prompt -> AI template -> compliance -> auto-improve.
const generateTemplate = async ({ workspaceId, purpose = 'other', prompt, businessProfile = {} }) => {
  const policy = engine.loadPolicy(workspaceId);
  const categoryMeta = policy.purposeCategories[purpose] || policy.purposeCategories.other;
  const business = businessProfile || {};
  const bpText = [
    business.companyName ? `Business name: ${business.companyName}` : '',
    business.description ? `Business description: ${business.description}` : '',
    business.webSite ? `Website: ${business.webSite}` : '',
  ].filter(Boolean).join('\n');

  const system = `${SYSTEM_INTRO}\n\n${BODY_INSTRUCTIONS}\n\nCurrent policy guidance:\n- Purpose: ${purpose} -> Meta category ${categoryMeta.metaCategory}.\n- ${categoryMeta.recommendation}`;

  const user = `Business context:\n${bpText || 'General business'}\n\nUser prompt: ${prompt}\n\nGenerate the WhatsApp template JSON now.`;

  const generated = await gateway.completeJson({ system, user, temperature: 0.4, maxTokens: 2200 });

  if (!generated.ok) {
    return { success: false, source: 'none', error: generated.error, template: null, compliance: null };
  }

  let draft = normalizeTemplate(generated.data);
  draft.purpose = purpose;
  draft.prompt = prompt;
  draft.businessProfile = bpText ? parseBusinessSnapshot(bpText) : null;

  // If the model omitted a category, apply the purpose mapping.
  if (!draft.category && categoryMeta) draft.category = categoryMeta.metaCategory;
  if (!draft.name && purpose) draft.name = engine.slugifyName(`${purpose}_template`);

  const originalCheck = engine.checkTemplate(draft, { policy, purpose });

  // Auto-improve only when block-level (or substantial warning) issues exist.
  const needsImprovement = originalCheck.level !== 'COMPLIANT' &&
    (originalCheck.issues.filter(i => i.severity === 'block').length > 0 ||
      originalCheck.issues.filter(i => i.severity === 'warning').length > 1);

  let improved = draft;
  let improvedCheck = originalCheck;
  if (needsImprovement) {
    const fixList = engine.sortIssues(originalCheck.issues).slice(0, 8).map(i => {
      return `- [${i.severity.toUpperCase()}] ${i.title}${i.fix ? ` | Fix: ${i.fix}` : ''}`;
    }).join('\n');

    const improveSystem = `${SYSTEM_INTRO}\n\nBODY_INSTRUCTIONS\n\nThe draft below failed Meta compliance review hints.\nPlease return the SAME JSON shape with the issues fixed while preserving the business objective and tone.\nDo not change the template's intent.`;
    const improveUser = `Business purpose: ${prompt}\n\nIssues found:\n${fixList}\n\nCurrent draft JSON:\n${JSON.stringify(draft, null, 2)}\n\nReturn the improved template JSON now.`;

    const improvedRes = await gateway.completeJson({ system: improveSystem, user: improveUser, temperature: 0.3, maxTokens: 2200 });
    if (improvedRes.ok && improvedRes.data) {
      const normalized = normalizeTemplate({ ...improvedRes.data, purpose, prompt });
      improvedCheck = engine.checkTemplate(normalized, { policy, purpose });
      if (engineMeasure(improvedCheck) <= engineMeasure(originalCheck) && improvedCheck.pass) {
        improved = normalized;
      }
    }
  }

  return {
    success: true,
    source: 'ai',
    template: improved,
    improved: improved !== draft,
    original: originalCheck.level !== improvedCheck.level ? draft : null,
    compliance: {
      original: originalCheck.issues.length ? originalCheck : null,
      final: improvedCheck,
      level: improvedCheck.level,
      pass: improvedCheck.pass,
      issues: improvedCheck.issues,
    },
    submission: buildSubmissionPayload(improved),
    examples: buildBodyText(improved.body, improved.exampleValues || {}),
  };
};

const engineMeasure = (check) => {
  const blocks = check.issues.filter(i => i.severity === 'block').length;
  const warns = check.issues.filter(i => i.severity === 'warning').length;
  return blocks * 100 + warns;
};

const parseBusinessSnapshot = (text) => ({ text });

// Run a compliance check on an existing template without AI involvement.
const runCompliance = ({ workspaceId, template, purpose }) => {
  const policy = engine.loadPolicy(workspaceId);
  const normalized = normalizeTemplate({ ...template, purpose: purpose || template.purpose });
  return {
    template: normalized,
    compliance: engine.checkTemplate(normalized, { policy, purpose: normalized.purpose }),
    submission: buildSubmissionPayload(normalized),
    examples: buildBodyText(normalized.body, normalized.exampleValues || {}),
  };
};

module.exports = {
  generateTemplate,
  runCompliance,
  normalizeTemplate,
  buildSubmissionPayload,
  buildBodyText,
  buildExamplePayload,
  extractExampleVariables,
};