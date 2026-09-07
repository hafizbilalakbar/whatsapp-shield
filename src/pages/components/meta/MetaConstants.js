export const META_STATUS_LABELS = {
  disconnect: 'Disconnected',
  connecting: 'Connecting',
  connected: 'Connected',
  error: 'Error',
};

export const TEMPLATE_STATUS = {
  DRAFT: 'Draft',
  PENDING: 'Pending approval',
  IN_APPEAL: 'In appeal',
  APPROVED: 'Approved',
  PAUSED: 'Paused',
  DISABLED: 'Disabled',
  REJECTED: 'Rejected',
};

export const TEMPLATE_STATUS_VARIANT = {
  DRAFT: 'secondary',
  PENDING: 'warning',
  IN_APPEAL: 'warning',
  APPROVED: 'success',
  PAUSED: 'outline',
  DISABLED: 'outline',
  REJECTED: 'destructive',
};

export const TEMPLATE_CATEGORIES = [
  { value: 'MARKETING', label: 'Marketing', tone: 'Promotional — special deals, offers, product updates.' },
  { value: 'UTILITY', label: 'Utility', tone: 'Transactional — orders, shipping, accounts, alerts.' },
  { value: 'AUTHENTICATION', label: 'Authentication', tone: 'OTP / login codes — must include security text.' },
];

export const TEMPLATE_SAMPLE_COUNTRIES = [
  { code: 'US', name: 'United States' },
  { code: 'GB', name: 'United Kingdom' },
  { code: 'IN', name: 'India' },
  { code: 'PK', name: 'Pakistan' },
  { code: 'BR', name: 'Brazil' },
  { code: 'MX', name: 'Mexico' },
  { code: 'ID', name: 'Indonesia' },
  { code: 'NG', name: 'Nigeria' },
  { code: 'SA', name: 'Saudi Arabia' },
  { code: 'AE', name: 'UAE' },
];

export const AGENT_TYPES = [
  { value: 'sales', label: 'Sales Agent', description: 'Qualifies leads, pushes the top approved marketing template, books calls.' },
  { value: 'support', label: 'Support Agent', description: 'Resolves FAQs, routes complex issues to a human.' },
  { value: 'custom', label: 'Custom Agent', description: 'Your own instructions & tone.' },
];

export const CAMPAIGN_STATUS_LABELS = {
  draft: 'Draft',
  scheduled: 'Scheduled',
  running: 'Running',
  paused: 'Paused',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const MESSAGE_TIERS = [
  { tier: 'TIER_250', cap: 250 },
  { tier: 'TIER_1K', cap: 1000 },
  { tier: 'TIER_10K', cap: 10000 },
  { tier: 'TIER_100K', cap: 100000 },
  { tier: 'TIER_UNLIMITED', cap: Infinity },
];

export const tierCap = (tier) => {
  const t = MESSAGE_TIERS.find(t => t.tier === tier);
  return t ? t.cap : 1000;
};

export const templateVariables = (template) => {
  const vars = [];
  const body = templateBodyText(template);
  const matches = body.match(/\{\{(\d+)\}\}/g) || [];
  matches.forEach(m => {
    const n = parseInt(m.replace(/\D/g, ''), 10);
    if (n >= 1 && !vars.includes(n)) vars.push(n);
  });
  return vars.sort((a, b) => a - b);
};

// Return the body text regardless of whether the template uses the
// editor/Graph `components` shape or the engine's normalized shape.
export const templateBodyText = (template) => {
  if (!template) return '';
  if (Array.isArray(template.components) && template.components.length) {
    return template.components.find(c => c.type === 'BODY')?.text || '';
  }
  return template.body || '';
};

// Convert a template (either shape) into the Graph-API `components` shape the
// preview + editors understand.
export const templateToComponents = (template) => {
  if (!template) return [];
  if (Array.isArray(template.components) && template.components.length) return template.components;
  const comps = [];
  const ht = template.headerType;
  if (ht && ht !== 'none' && ht !== undefined) {
    comps.push(ht === 'TEXT'
      ? { type: 'HEADER', format: 'TEXT', text: template.headerText || '' }
      : { type: 'HEADER', format: ht });
  }
  comps.push({ type: 'BODY', text: template.body || '' });
  if (template.footerText) comps.push({ type: 'FOOTER', text: template.footerText });
  if (Array.isArray(template.buttons) && template.buttons.length) {
    comps.push({
      type: 'BUTTONS',
      buttons: template.buttons.map(b => ({
        type: b.type || 'QUICK_REPLY',
        text: b.text || '',
        url: b.url || '',
        phone_number: b.phoneNumber || b.phone_number || '',
      })),
    });
  }
  return comps;
};

// Convert the normalized engine shape used by the AI generator + stored drafts.
export const toNormalized = (template) => {
  if (!template) return null;
  if (!Array.isArray(template.components)) return template;
  const header = template.components.find(c => c.type === 'HEADER');
  const body = template.components.find(c => c.type === 'BODY');
  const footer = template.components.find(c => c.type === 'FOOTER');
  const buttonsComp = template.components.find(c => c.type === 'BUTTONS');
  return {
    ...template,
    headerType: header ? (header.format && header.format !== 'TEXT' ? header.format : header.text ? 'TEXT' : 'none') : 'none',
    headerText: header?.text || '',
    body: body?.text || '',
    footerText: footer?.text || '',
    buttons: (buttonsComp?.buttons || []).map(b => ({ type: b.type, text: b.text || '', url: b.url || '', phoneNumber: b.phone_number || b.phoneNumber || '' })),
    components: template.components,
  };
};

export const formatCount = (n) => n >= 1000000 ? `${(n / 1000000).toFixed(1)}M` : n >= 1000 ? `${(n / 1000).toFixed(1)}k` : `${n}`;