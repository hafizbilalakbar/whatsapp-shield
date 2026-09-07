const store = require('./store');
const MetaClient = require('./meta-api');

const CONFIG_FILE = 'meta_config.json';

const MASKED_FIELDS = ['accessToken', 'appSecret', 'verifyToken'];

const mask = (config) => {
  if (!config) return null;
  const copy = { ...config };
  for (const field of MASKED_FIELDS) {
    if (copy[field]) copy[field] = store.maskSecret(copy[field]);
  }
  return copy;
};

const emptyConfig = () => ({
  status: 'disconnected',
  accessToken: '',
  wabaId: '',
  phoneNumberId: '',
  verifyToken: '',
  appSecret: '',
  graphVersion: 'v23.0',
  businessName: '',
  displayPhoneNumber: '',
  messagingLimitTier: '',
  qualityRating: '',
  error: null,
  connectedAt: null,
  lastSyncAt: null,
  createdAt: null,
  updatedAt: null,
});

const loadConfig = (workspaceId) => {
  const saved = store.readJson(workspaceId, CONFIG_FILE, null);
  return { ...emptyConfig(), ...(saved || {}) };
};

const saveConfig = (workspaceId, config) => {
  const copy = { ...config, updatedAt: store.now() };
  return store.writeJson(workspaceId, CONFIG_FILE, copy);
};

const buildClient = (workspaceId) => {
  const config = loadConfig(workspaceId);
  return {
    config,
    client: new MetaClient({
      accessToken: config.accessToken,
      wabaId: config.wabaId,
      phoneNumberId: config.phoneNumberId,
      graphVersion: config.graphVersion,
    }),
  };
};

// Attempts to reach Meta with the supplied credentials and enrich the status
// with the business + phone + template information from Meta itself.
async function connect(workspaceId, inputs = {}) {
  const current = loadConfig(workspaceId);
  const next = {
    ...current,
    graphVersion: inputs.graphVersion || current.graphVersion || 'v23.0',
    updatedAt: store.now(),
  };
  for (const field of ['accessToken', 'wabaId', 'phoneNumberId', 'verifyToken', 'appSecret']) {
    // Only overwrite a credential when a new (non-masked) value is supplied.
    if (inputs[field] && !/^\*{2,}/.test(String(inputs[field]))) {
      next[field] = String(inputs[field]).trim();
    }
  }
  if (!next.accessToken || !next.wabaId) {
    return { success: false, error: 'Access token and WhatsApp Business Account ID are required' };
  }

  const client = new MetaClient({
    accessToken: next.accessToken,
    wabaId: next.wabaId,
    phoneNumberId: next.phoneNumberId,
    graphVersion: next.graphVersion,
  });

  let wabaInfo = null;
  let phoneInfo = null;
  let templateSummary = null;
  let error = null;

  try {
    wabaInfo = await client.getWabaInfo();
  } catch (err) {
    error = `Business account check failed: ${err.message}`;
  }

  if (!error && next.phoneNumberId) {
    try {
      phoneInfo = await client.getPhoneNumberInfo();
    } catch (err) {
      error = `Phone number check failed: ${err.message}`;
    }
  }

  if (!error) {
    try {
      const templates = await client.getMessageTemplates({ limit: 200 });
      const counts = {};
      for (const t of templates) counts[t.status] = (counts[t.status] || 0) + 1;
      templateSummary = {
        total: templates.length,
        counts,
        latest: templates.slice(0, 5).map(t => ({
          name: t.name, status: t.status, category: t.category, language: t.language, rejectedReason: t.rejected_reason,
        })),
      };
    } catch (err) {
      templateSummary = { total: 0, counts: {}, latest: [], error: err.message };
    }
  }

  if (error) {
    next.status = 'error';
    next.error = error;
    saveConfig(workspaceId, next);
    return {
      success: false,
      error,
      status: 'error',
      config: mask(next),
      business: wabaInfo,
      phone: phoneInfo,
      templates: templateSummary,
    };
  }

  next.status = 'connected';
  next.error = null;
  next.businessName = wabaInfo?.name || next.businessName || '';
  next.displayPhoneNumber = phoneInfo?.display_phone_number || next.displayPhoneNumber || '';
  next.messagingLimitTier = phoneInfo?.messaging_limit_tier || next.messagingLimitTier || '';
  next.qualityRating = phoneInfo?.quality_rating || next.qualityRating || '';
  next.connectedAt = next.connectedAt || store.now();
  next.lastSyncAt = store.now();
  saveConfig(workspaceId, next);

  return {
    success: true,
    status: 'connected',
    config: mask(next),
    business: wabaInfo,
    phone: phoneInfo,
    templates: templateSummary,
  };
}

// Lightweight status without network calls (fast path for the UI).
async function getStatus(workspaceId) {
  const config = loadConfig(workspaceId);
  if (config.status === 'connected' && config.accessToken) {
    return {
      status: 'connected',
      connectedAt: config.connectedAt,
      lastSyncAt: config.lastSyncAt,
      businessName: config.businessName,
      displayPhoneNumber: config.displayPhoneNumber,
      messagingLimitTier: config.messagingLimitTier,
      qualityRating: config.qualityRating,
    };
  }
  return { status: config.status || 'disconnected', error: config.error };
}

// Live refresh — hits Meta for authoritative business/template/limit status.
async function sync(workspaceId) {
  const { config, client } = buildClient(workspaceId);
  if (!config.accessToken || !config.wabaId) {
    return { success: false, status: 'disconnected', error: 'Not configured' };
  }
  return connect(workspaceId, {
    accessToken: config.accessToken,
    wabaId: config.wabaId,
    phoneNumberId: config.phoneNumberId,
    graphVersion: config.graphVersion,
  });
}

function disconnect(workspaceId) {
  const config = loadConfig(workspaceId);
  config.status = 'disconnected';
  config.error = null;
  config.updatedAt = store.now();
  saveConfig(workspaceId, config);
  return { success: true, status: 'disconnected' };
}

module.exports = {
  loadConfig,
  saveConfig,
  mask,
  buildClient,
  connect,
  getStatus,
  sync,
  disconnect,
  CONFIG_FILE,
};