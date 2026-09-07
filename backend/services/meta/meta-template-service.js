const store = require('./store');
const configService = require('./meta-config');
const engine = require('./ai-template-engine');

const TEMPLATES_FILE = 'meta_templates.json';
const HISTORY_FILE = 'meta_template_history.json';

const emptyList = () => ({ templates: [], history: [] });

const loadAll = (workspaceId) => store.readJson(workspaceId, TEMPLATES_FILE, emptyList());

const saveAll = (workspaceId, data) => store.writeJson(workspaceId, TEMPLATES_FILE, data);

const listTemplates = (workspaceId, { status, search } = {}) => {
  const all = loadAll(workspaceId);
  let list = all.templates || [];
  if (status) list = list.filter(t => t.status === status);
  if (search) {
    const q = String(search).toLowerCase();
    list = list.filter(t => (t.name || '').toLowerCase().includes(q) || (t.prompt || '').toLowerCase().includes(q) || (t.body || '').toLowerCase().includes(q));
  }
  return list.slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
};

const getTemplate = (workspaceId, id) => {
  const all = loadAll(workspaceId);
  return (all.templates || []).find(t => t.id === id) || null;
};

const summarize = (t) => ({
  id: t.id,
  name: t.name,
  category: t.category,
  language: t.language,
  status: t.status,
  purpose: t.purpose,
  body: t.body,
  headerText: t.headerText,
  footerText: t.footerText,
  buttons: t.buttons,
  exampleValues: t.exampleValues,
  metaId: t.metaId,
  rejectionReason: t.rejectionReason,
  submittedAt: t.submittedAt,
  updatedAt: t.updatedAt,
  source: t.source,
  lastCompliance: t.lastCompliance,
  summary: t.summary,
});

const saveDraft = (workspaceId, input) => {
  const data = loadAll(workspaceId);
  const templates = data.templates || [];
  const now = store.now();
  const normalized = engine.normalizeTemplate(input);
  const existing = input.id ? templates.find(t => t.id === input.id) : null;

  const record = existing ? { ...existing, ...normalized, id: existing.id, updatedAt: now } : {
    ...normalized,
    id: store.uuid(),
    status: 'DRAFT',
    source: input.source || 'manual',
    createdAt: now,
    updatedAt: now,
  };

  if (existing) {
    const idx = templates.findIndex(t => t.id === existing.id);
    templates[idx] = record;
  } else {
    templates.unshift(record);
  }
  data.templates = templates;
  saveAll(workspaceId, data);
  pushHistory(workspaceId, { action: existing ? 'draft_updated' : 'draft_created', templateId: record.id, name: record.name, timestamp: now });
  return { success: true, template: summarize(record) };
};

const deleteTemplate = (workspaceId, id) => {
  const data = loadAll(workspaceId);
  const templates = data.templates || [];
  const idx = templates.findIndex(t => t.id === id);
  if (idx === -1) return { success: false, error: 'Template not found' };
  const removed = templates.splice(idx, 1)[0];
  data.templates = templates;
  saveAll(workspaceId, data);
  pushHistory(workspaceId, { action: 'deleted', templateId: id, name: removed.name, timestamp: store.now() });
  return { success: true, template: summarize(removed) };
};

// Submit a local template to Meta for real approval.
async function submit(workspaceId, id) {
  const t = getTemplate(workspaceId, id);
  if (!t) return { success: false, error: 'Template not found' };

  const { config, client } = configService.buildClient(workspaceId);
  if (config.status !== 'connected' || !config.accessToken || !config.wabaId) {
    return { success: false, error: 'Meta connection required before submitting templates', code: 'META_NOT_CONNECTED' };
  }
  if (t.status === 'APPROVED') return { success: false, error: 'This template is already approved' };

  const normalized = engine.normalizeTemplate(t);
  const compliance = engine.runCompliance({ workspaceId, template: normalized, purpose: t.purpose }).compliance;
  if (!compliance.pass) {
    return {
      success: false,
      error: 'Local compliance check failed. Fix the issues below before submitting to Meta.',
      code: 'COMPLIANCE_FAILED',
      compliance,
    };
  }

  const payload = engine.buildSubmissionPayload(normalized);
  let result;
  try {
    result = await client.createTemplate(payload);
  } catch (err) {
    pushHistory(workspaceId, { action: 'submit_failed', templateId: id, name: t.name, error: err.message, timestamp: store.now() });
    return { success: false, error: `Meta rejected the submission: ${err.message}`, code: 'META_SUBMIT_FAILED', meta: err.details };
  }

  const now = store.now();
  const data = loadAll(workspaceId);
  const idx = (data.templates || []).findIndex(tm => tm.id === id);
  if (idx !== -1) {
    data.templates[idx] = {
      ...data.templates[idx],
      status: 'PENDING',
      metaId: result?.id || result?.hsm_id || data.templates[idx].metaId,
      submittedAt: now,
      updatedAt: now,
      rejectionReason: null,
    };
    saveAll(workspaceId, data);
  }
  pushHistory(workspaceId, { action: 'submitted', templateId: id, name: t.name, meta: result, timestamp: now });
  return { success: true, status: 'PENDING', meta: result, template: summarize(getTemplate(workspaceId, id)) };
}

// Ask Meta for the authoritative status of every local template.
async function syncFromMeta(workspaceId) {
  const { config, client } = configService.buildClient(workspaceId);
  if (config.status !== 'connected') {
    return { success: false, error: 'Meta connection required', code: 'META_NOT_CONNECTED', updates: [] };
  }

  let remote = [];
  try {
    remote = await client.getMessageTemplates({ limit: 200 });
  } catch (err) {
    return { success: false, error: err.message, updates: [] };
  }

  const data = loadAll(workspaceId);
  const templates = data.templates || [];
  const updates = [];
  const remoteByName = {};
  for (const r of remote) remoteByName[r.name] = r;

  let changed = false;
  const now = store.now();
  for (let i = 0; i < templates.length; i++) {
    const t = templates[i];
    const r = remoteByName[t.name];
    if (!r) continue;
    const metaStatus = mapMetaStatus(r.status);
    let updated = false;
    if (t.status !== metaStatus) t.status = metaStatus, updated = true;
    if (t.rejectionReason !== (r.rejected_reason || null)) t.rejectionReason = r.rejected_reason || null, updated = true;
    if (updated) {
      t.updatedAt = now;
      changed = true;
      updates.push({ id: t.id, name: t.name, status: metaStatus, rejectionReason: t.rejectionReason });
      pushHistory(workspaceId, { action: 'status_changed', templateId: t.id, name: t.name, status: metaStatus, rejectionReason: t.rejectionReason, timestamp: now });
    }
  }

  // Import Meta templates we don't know about yet (approved from the dashboard).
  for (const r of remote) {
    if (templates.some(t => t.name === r.name)) continue;
    const imported = engine.normalizeTemplate({
      name: r.name,
      category: r.category,
      language: r.language,
      body: componentText(r.components, 'BODY'),
      headerText: componentText(r.components, 'HEADER'),
      footerText: componentText(r.components, 'FOOTER'),
      buttons: componentButtons(r.components),
      metaId: r.id,
      status: mapMetaStatus(r.status),
      rejectionReason: r.rejected_reason || null,
      source: 'meta',
      updatedAt: now,
      createdAt: now,
    });
    imported.id = store.uuid();
    imported.status = mapMetaStatus(r.status);
    templates.push(imported);
    changed = true;
    updates.push({ id: imported.id, name: imported.name, status: imported.status, imported: true });
  }

  if (changed) {
    data.templates = templates;
    saveAll(workspaceId, data);
  }
  return { success: true, updates, remoteCount: remote.length };
}

const mapMetaStatus = (status) => {
  const map = {
    APPROVED: 'APPROVED',
    REJECTED: 'REJECTED',
    PENDING: 'PENDING',
    IN_APPEAL: 'PENDING',
    PAUSED: 'PAUSED',
    DISABLED: 'DISABLED',
    DELETED: 'DELETED',
    INACTIVE: 'INACTIVE',
  };
  return map[status] || String(status || 'UNKNOWN').toUpperCase();
};

const componentText = (components, type) => {
  const comp = (components || []).find(c => c.type === type && c.format === 'TEXT');
  return comp?.text || '';
};

const componentButtons = (components) => {
  const comp = (components || []).find(c => c.type === 'BUTTONS');
  return (comp?.buttons || []).map(b => ({ type: b.type, text: b.text, url: b.url || '', phoneNumber: b.phone_number || '', couponCode: b.coupon_code || '' }));
};

const getHistory = (workspaceId) => {
  return store.readJson(workspaceId, HISTORY_FILE, []).slice().reverse();
};

const pushHistory = (workspaceId, entry) => {
  const list = store.readJson(workspaceId, HISTORY_FILE, []);
  list.push(entry);
  store.writeJson(workspaceId, HISTORY_FILE, list.slice(-500));
};

module.exports = {
  listTemplates,
  getTemplate,
  summarize,
  saveDraft,
  deleteTemplate,
  submit,
  syncFromMeta,
  getHistory,
  pushHistory,
  TEMPLATES_FILE,
};