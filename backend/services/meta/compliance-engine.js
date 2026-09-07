const store = require('./store');

const POLICY_FILE = 'meta_policy.json';

// ---------------------------------------------------------------------------
// Default Meta template policy layer.
//
// This file is intentionally separated from the generation/AI code so that when
// Meta changes its official template rules, only this policy object (or the one
// persisted per workspace) needs to be updated — no AI/engine rewrites.
// ---------------------------------------------------------------------------
const DEFAULT_POLICY = {
  version: 1,
  lastUpdated: '2026-01-01T00:00:00.000Z',
  graphVersion: 'v23.0',
  purposeCategories: {
    marketing: { metaCategory: 'MARKETING', label: 'Marketing', recommendation: 'Prefer AMP/marketing best practices; include opt-out language and a clear sender identity.' },
    sales: { metaCategory: 'MARKETING', label: 'Sales', recommendation: 'Keep offers specific and non-misleading; include opt-out text and avoid urgency spam.' },
    promotion: { metaCategory: 'MARKETING', label: 'Promotion / Offer', recommendation: 'State the offer clearly, include expiry only when genuine, and add opt-out language.' },
    lead_follow_up: { metaCategory: 'UTILITY', label: 'Lead Follow-up', recommendation: 'Stay service-oriented and specific; avoid promotional hype language.' },
    customer_support: { metaCategory: 'UTILITY', label: 'Customer Support', recommendation: 'Address the request factually, reference the customer conversation, keep it service-focused.' },
    appointment: { metaCategory: 'UTILITY', label: 'Appointment', recommendation: 'Clear date/time variables, a way to confirm or reschedule, and no promotional content.' },
    order_update: { metaCategory: 'UTILITY', label: 'Order Update', recommendation: 'Order-specific facts (number, status, tracking) only; no marketing copy.' },
    reminder: { metaCategory: 'UTILITY', label: 'Reminder', recommendation: 'One clear reminder; harmless to repeat; avoid selling language.' },
    authentication: { metaCategory: 'AUTHENTICATION', label: 'Authentication / OTP', recommendation: 'One-time passcode only; single-purpose; no marketing content.' },
    other: { metaCategory: 'UTILITY', label: 'Other / General', recommendation: 'Select the closest real Meta category before submitting.' },
  },
  componentRules: {
    name: { maxLength: 512, pattern: '^[a-z0-9_]+$', hint: 'Lowercase letters, numbers and underscores, no spaces.' },
    header: {
      allowedTypes: ['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'],
      textMaxLength: 60,
      textMinLength: 1,
      exampleMaxLength: 60,
      hint: 'Headers up to 60 characters. Media headers require the media to be hosted on a public URL during submission.',
    },
    body: {
      maxLength: 1024,
      minLength: 1,
      maxVariables: 30,
      exampleMaxLength: 1024,
      hint: 'Body up to 1024 characters. Use sequential variables {{1}}, {{2}}, ...',
    },
    footer: { maxLength: 60, hint: 'Footer up to 60 characters. Great place for sender identity.' },
    buttons: {
      max: 10,
      rules: {
        QUICK_REPLY: { textMaxLength: 25, max: 3 },
        URL: { textMaxLength: 25, max: 2 },
        PHONE_NUMBER: { textMaxLength: 25, max: 2 },
      },
      hint: 'Quick-reply buttons (max 3), URL buttons (max 2 with https URLs), phone buttons (max 2).',
    },
    language: { supportedFormat: /^[a-z]{2}(_[A-Z]{2})?$/ },
  },
  variableRules: {
    format: /^\{\{\s*[1-9]\d{0,1}\s*\}\}$/,
    mustStartAtOne: true,
    sequential: true,
    hint: 'Variables must be {{1}}, {{2}}, ... starting at 1, sequential, no gaps.',
  },
  restrictedTopics: [
    {
      topic: 'financial_services',
      terms: ['loans', 'credit', 'mortgage', 'investment', 'crypto', 'bitcoin', 'trading', 'trading signals', 'guaranteed returns', 'double your money'],
      guidance: 'Financial claims can require additional Meta review or configuration. Avoid guarantees, returns promises, and unlicensed advice.',
    },
    {
      topic: 'healthcare',
      terms: ['cure', 'heal', 'cure cancer', 'weight loss guaranteed', 'medical miracle', 'prescription', 'clinically proven'],
      guidance: 'Healthcare claims must be accurate and non-deceptive. Avoid miracle cures and guarantees.',
    },
    {
      topic: 'betting_gambling',
      terms: ['bet', 'betting', 'gambling', 'casino', 'slot machine', 'win real money', 'jackpot'],
      guidance: 'Gambling content is restricted in many regions and may require special review.',
    },
    {
      topic: 'alcohol_tobacco',
      terms: ['cheap cigarettes', 'buy alcohol', 'smoke deals'],
      guidance: 'Age-restricted content categories require compliance review and are unavailable in some regions.',
    },
    {
      topic: 'adult',
      terms: ['adult content', 'nsfw', 'escort', 'xxx'],
      guidance: 'Adult content is not permitted.',
    },
  ],
  contentChecks: [
    {
      id: 'promotional_in_utility',
      severity: 'block',
      test: (t) => (t.category === 'UTILITY' || t.category === 'AUTHENTICATION') && hasPromotionalLanguage(t),
      title: 'Promotional content in a service template',
      detail: 'UTILITY and AUTHENTICATION templates must be strictly service-related. Promotional words trigger rejection.',
      fix: 'Remove offers, discounts, urgency and selling language. Keep only the factual service information.',
    },
    {
      id: 'missing_optout_marketing',
      severity: 'warning',
      test: (t) => t.category === 'MARKETING' && !hasOptOutLanguage(t),
      title: 'Missing opt-out / unsubscribe language',
      detail: 'Marketing templates should give recipients a clear way to opt out.',
      fix: 'Append a short opt-out line such as "Reply STOP to opt out" in the body or footer.',
    },
    {
      id: 'missing_sender_identity',
      severity: 'warning',
      test: (t) => ![t.headerText, t.body, t.footerText].some(seg => /(^|\s)(our|us|we|team|company|shop|store|business)/i.test(String(seg || ''))),
      title: 'Unclear sender identity',
      detail: 'Recipients should instantly know who is sending the message.',
      fix: 'Mention your business or team name in the body, header or footer.',
    },
    {
      id: 'urgent_pressure',
      severity: 'warning',
      test: (t) => /(hurry|act now|last chance|only today|don'?t miss|limited time|offer ends)/i.test(String(t.body || '')),
      title: 'High-pressure urgency language',
      detail: 'Excessive urgency can read as spam. Favour calm, factual calls to action.',
      fix: 'Replace urgency phrases with a neutral, factual version.',
    },
    {
      id: 'spam_signals',
      severity: 'warning',
      test: (t) => /(\b(?:free|win|prize|guaranteed|congratulations)[\s!]*\b){2,}/i.test(String(t.body || '')) || /(!!+|([A-Za-z0-9])\2{3,})/.test(String(t.body || '')),
      title: 'Spam-like wording or repeated symbols',
      detail: 'Repeated excitement markers (multiple exclamation marks, all-caps, doubled words) reduce approval odds.',
      fix: 'Normalize punctuation and tone down attention-grabbing words.',
    },
    {
      id: 'misleading_claim',
      severity: 'block',
      test: (t) => /(guarantee[d]? (?:sales|profit|results|returns)|#1|\bthe best\b|never lose|100% (?:safe|effective|guaranteed))/i.test(String(t.body || '')),
      title: 'Potentially misleading claim',
      detail: 'Absolute or unverifiable claims are a common rejection reason.',
      fix: 'Rephrase to be factual and specific, avoiding superlatives and guarantees.',
    },
    {
      id: 'uppercase_body',
      severity: 'warning',
      test: (t) => { const b = String(t.body || '').replace(/\{\{\s*\d{1,2}\s*\}\}/g, ''); return /[A-Z]{4,}/.test(b); },
      title: 'Excessive uppercase text',
      detail: 'Large blocks of uppercase text read as shouting/spam.',
      fix: 'Use sentence case for most of the body.',
    },
    {
      id: 'emojis',
      severity: 'warning',
      test: (t) => /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(String(t.body || '')),
      title: 'Emojis in template body',
      detail: 'Emojis are not officially supported in template text and may break rendering.',
      fix: 'Remove emojis from the body.',
    },
  ],
  ambiguityChecks: [
    {
      id: 'vague_customer',
      severity: 'warning',
      test: (t) => /(\bcustomer(s|'?s)?\b|\bclient(s|'?s)?\b|\byou\b){2,}/i.test(String(t.body || '')),
      title: 'Generic/vague recipient wording',
      detail: 'Templates that keep saying "customer" or "you" without context can feel templated/spammy.',
      fix: 'Personalize with variables or reference the specific conversation context.',
    },
    {
      id: 'question_body',
      severity: 'warning',
      test: (t) => /\?\s*$/.test(String(t.body || '').trim()) && /(want|need|like|interest|available|interested)/i.test(String(t.body || '')),
      title: 'Open-ended sales question',
      detail: 'A template that only asks "Do you want..." with no value can look like spam.',
      fix: 'Give clear value and a simple next step instead of a generic ask.',
    },
  ],
  recommendations: {
    headerExample: 'Use the header for the most important fact (e.g. order number, appointment).',
    bodyExample: 'Start with the customer need, add 1-2 sentences of clear value, end with one next step.',
    buttonExample: 'Add one clear call-to-action button rather than many options.',
  },
  generalRule: 'Templates are rejected when they misrepresent the sender, make impossible claims, lack permission context, or use marketing in service templates. Read receipts, quality rating and messaging limits also come from Meta, not from this tool.',
};

const loadPolicy = (workspaceId) => {
  const saved = store.readJson(workspaceId, POLICY_FILE, null);
  if (!saved) {
    store.writeJson(workspaceId, POLICY_FILE, DEFAULT_POLICY);
    return DEFAULT_POLICY;
  }
  return { ...DEFAULT_POLICY, ...saved };
};

const savePolicy = (workspaceId, policy) => {
  const merged = { ...DEFAULT_POLICY, ...policy, version: (policy.version || DEFAULT_POLICY.version) };
  store.writeJson(workspaceId, POLICY_FILE, merged);
  return merged;
};

// --- helpers ---
const hasPromotionalLanguage = (t) => /(discount|offer|deal|promo|sale|% off|buy now|order now|lowest price|best price|free shipping|act now|limited time)/i.test(
  [t.headerText, t.body, t.footerText].filter(Boolean).join(' ')
);

const hasOptOutLanguage = (t) => /(opt[- ]?out|unsubscribe|stop|remove me|don'?t (text|contact|message) (me|us)|no longer (send|message))/i.test(
  [t.headerText, t.body, t.footerText].filter(Boolean).join(' ')
);

const stripVariables = (text) => {
  if (!text) return '';
  return String(text).replace(/\{\{\s*\d{1,2}\s*\}\}/g, '');
};

const extractVariables = (text) => {
  const vars = [];
  const re = /\{\{\s*(\d{1,2})\s*\}\}/g;
  let m;
  while ((m = re.exec(text))) vars.push(Number(m[1]));
  return vars;
};

const slugifyName = (input) => {
  return String(input || 'wt_template_').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 80) || 'wt_template';
};

// Main compliance check. `template` is a normalized template object, see
// normalizeTemplate() in ai-template-engine.js.
const checkTemplate = (template, { policy = DEFAULT_POLICY, purpose } = {}) => {
  const issues = [];
  const name = template.name || '';
  const body = String(template.body || '');
  const headerText = String(template.headerText || '');
  const footerText = String(template.footerText || '');
  const headerType = template.headerType || 'none';
  const buttons = Array.isArray(template.buttons) ? template.buttons : [];

  // Name rules
  if (!name) issues.push(issue('block', 'name_required', 'Template name is required', '', `Use lowercase letters, numbers and underscores (e.g. "${slugifyName('welcome message')}").`));
  else if (name.length > 512) issues.push(issue('block', 'name_too_long', 'Template name exceeds 512 characters', 'Shorten the name.', `Current length: ${name.length}.`));
  else if (!/^[a-z0-9_]+$/.test(name)) issues.push(issue('block', 'name_format', 'Template name format is invalid', 'Use only lowercase letters, numbers and underscores.', `e.g. "${slugifyName(name)}" instead of "${name}".`));

  // Category validity
  const validCategories = ['MARKETING', 'UTILITY', 'AUTHENTICATION'];
  if (template.category && !validCategories.includes(template.category)) {
    issues.push(issue('block', 'category_invalid', 'Invalid Meta template category', `Use one of: ${validCategories.join(', ')}.`, `Received "${template.category}".`));
  }

  // Header
  if (headerType === 'TEXT') {
    if (!headerText) issues.push(issue('block', 'header_text_required', 'Text header has no content', 'Add header text.', 'Header text is required when header type is TEXT.'));
    else if (headerText.length > 60) issues.push(issue('block', 'header_too_long', 'Header exceeds 60 characters', 'Shorten the header.', `Current length: ${headerText.length}.`));
  } else if (headerType && ['IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerType)) {
    // Media headers need a real https asset — Meta validates it during review.
    if (!/^https:\/\//.test(template.headerMediaLink || '')) {
      issues.push(issue('block', 'media_header_link_required', 'Media header needs a public https file', 'Add a direct https:// URL for the image/video/document/location.', 'Media headers are reviewed with the asset; a reachable https link is required at submission time.'));
    }
  } else if (template.headerType && template.headerType !== 'none' && !['TEXT', 'IMAGE', 'VIDEO', 'DOCUMENT', 'LOCATION'].includes(headerType)) {
    issues.push(issue('block', 'header_type_invalid', 'Unsupported header type', 'Use TEXT, IMAGE, VIDEO, DOCUMENT or LOCATION.', `Received "${headerType}".`));
  }

  // Body
  if (!body) issues.push(issue('block', 'body_required', 'Body is required', 'Add a body message.', 'Every template needs a body.'));
  else if (body.length > 1024) issues.push(issue('block', 'body_too_long', 'Body exceeds 1024 characters', 'Shorten the body.', `Current length: ${body.length}.`));

  // Variables
  const vars = extractVariables(body);
  const seen = new Set();
  let varIssue = null;
  for (const v of vars) {
    if (seen.has(v)) { varIssue = { id: 'duplicate_var', title: `Variable {{${v}}} appears more than once`, detail: `Duplicate variable {{${v}}} in body. Each variable should normally be unique.`, fix: 'Keep one instance per variable or reuse the same one deliberately.' }; issues.push({ severity: 'warning', ...varIssue }); }
    seen.add(v);
  }
  if (vars.length > 0) {
    const max = Math.max(...vars);
    if (max > 30) issues.push(issue('block', 'too_many_vars', 'Too many variables', 'Reduce variables to 30 or fewer.', `Highest variable: {{${max}}}.`));
    if (vars[0] !== 1) issues.push(issue('block', 'var_start', 'Variables must start at {{1}}', 'Renumber variables starting at 1.', 'Meta expects variables in order starting from {{1}}.'));
    const expected = Array.from({ length: max }, (_, i) => i + 1);
    const missing = expected.filter(n => !seen.has(n));
    if (missing.length) issues.push(issue('warning', 'var_gap', 'Variables are not sequential', 'Renumber variables to be sequential.', `Missing: ${missing.map(n => '{{' + n + '}}').join(', ')}.`));

    // Meta REQUIRES an example value for every parameter in the template.
    const examples = template.exampleValues || {};
    const missingExamples = expected.filter(n => {
      const ex = examples[n];
      return (!ex && !examples[String(n)]) || String(ex).trim() === '';
    });
    if (missingExamples.length) {
      issues.push(issue('block', 'example_values_required', 'Missing example values for variables', 'Provide a sample value for every variable in the template.', `Meta rejects templates without an example value per parameter. Add examples for: ${missingExamples.map(n => '{{' + n + '}}').join(', ')}.`));
    }
  }

  // Footer
  if (footerText && footerText.length > 60) issues.push(issue('block', 'footer_too_long', 'Footer exceeds 60 characters', 'Shorten the footer.', `Current length: ${footerText.length}.`));

  // Buttons
  const counts = { QUICK_REPLY: 0, URL: 0, PHONE_NUMBER: 0 };
  for (const b of buttons) {
    const type = b.type;
    if (!['QUICK_REPLY', 'URL', 'PHONE_NUMBER'].includes(type)) {
      issues.push(issue('block', 'button_type_invalid', `Unsupported button type "${type}"`, 'Use QUICK_REPLY, URL or PHONE_NUMBER.', JSON.stringify(b)));
      continue;
    }
    counts[type] = (counts[type] || 0) + 1;
    if (b.text && String(b.text).length > 25) issues.push(issue('block', 'button_text_long', 'Button text exceeds 25 characters', 'Shorten the button label.', `"${b.text}" is ${String(b.text).length} characters.`));
    if (type === 'URL' && b.url && !/^https:\/\/.+/.test(b.url)) issues.push(issue('block', 'url_not_https', 'URL button must be an https:// link', 'Use a full https URL.', `Received "${b.url}".`));
  }
  if (counts.QUICK_REPLY > 3) issues.push(issue('block', 'too_many_quick_reply', 'More than 3 quick-reply buttons', 'Reduce quick-reply buttons to 3.', ''));
  if (counts.URL > 2) issues.push(issue('block', 'too_many_url', 'More than 2 URL buttons', 'Reduce URL buttons to 2.', ''));
  if (counts.PHONE_NUMBER > 2) issues.push(issue('block', 'too_many_phone', 'More than 2 phone buttons', 'Reduce phone buttons to 2.', ''));
  if (buttons.length > 10) issues.push(issue('block', 'too_many_buttons', 'More than 10 total buttons', 'Reduce the total number of buttons.', ''));

  // Content checks
  for (const check of policy.contentChecks || []) {
    try {
      if (check.test(template)) issues.push(issue(check.severity, check.id, check.title, check.fix, check.detail));
    } catch (_) { /* ignore malformed custom rule */ }
  }

  // Restricted topics
  for (const rt of policy.restrictedTopics || []) {
    const hit = rt.terms.some(term => `${headerText} ${body} ${footerText}`.toLowerCase().includes(term.toLowerCase()));
    if (hit) issues.push(issue('warning', `restricted_${rt.topic}`, `Potentially restricted topic: ${rt.topic.replace(/_/g, ' ')}`, rt.guidance, ''));
  }

  // Purpose-aware guidance
  if (purpose && policy.purposeCategories[purpose]) {
    const meta = policy.purposeCategories[purpose];
    if (template.category && meta.metaCategory !== template.category && template.category !== 'UTILITY') {
      issues.push(issue('warning', 'category_mismatch', 'Category may not match the message purpose', `The purpose "${purpose}" suggests category ${meta.metaCategory}.`, `Current category: ${template.category}.`));
    }
  }

  // Ambiguity checks
  for (const check of policy.ambiguityChecks || []) {
    try { if (check.test(template)) issues.push(issue(check.severity, check.id, check.title, check.fix, check.detail)); } catch (_) {}
  }

  return gradeIssues(issues);
};

const issue = (severity, id, title, fix, detail) => ({ severity, id, title, fix, detail });

const gradeIssues = (issues) => {
  const hasBlock = issues.some(i => i.severity === 'block');
  const hasWarning = issues.some(i => i.severity === 'warning');
  const level = hasBlock ? 'NEEDS_REVISION' : hasWarning ? 'WARNING' : 'COMPLIANT';
  return { level, issues, pass: !hasBlock, warnings: hasWarning, timestamp: store.now() };
};

const severityOrder = { block: 0, warning: 1 };
const sortIssues = (issues) => issues.slice().sort((a, b) => (severityOrder[a.severity] ?? 1) - (severityOrder[b.severity] ?? 1));

module.exports = {
  DEFAULT_POLICY,
  loadPolicy,
  savePolicy,
  checkTemplate,
  slugifyName,
  extractVariables,
  stripVariables,
  hasPromotionalLanguage,
  hasOptOutLanguage,
  sortIssues,
  POLICY_FILE,
};