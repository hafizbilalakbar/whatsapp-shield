const fs = require('fs');
const path = require('path');

const USAGE_FILE = path.join(__dirname, '..', '..', 'ai_usage.json');

const emptyEntry = () => ({
  total: 0,
  success: 0,
  failed: 0,
  rateLimited: 0,
  authErrors: 0,
  today: 0,
  week: 0,
  month: 0,
  totalLatencyMs: 0,
  totalInputTokens: 0,
  totalOutputTokens: 0,
  lastRequestAt: null,
  lastSuccessAt: null,
  lastFailureAt: null,
  lastError: '',
  lastErrorCategory: '',
  lastLatencyMs: 0,
  lastModel: '',
  day: '',
  weekOf: '',
  monthOf: '',
});

const rolloverKey = (date) => {
  const d = new Date(date);
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const weekStart = new Date(d.getFullYear(), d.getMonth(), d.getDate() - d.getDay());
  const weekOf = weekStart.toISOString().slice(0, 10);
  const monthOf = d.toISOString().slice(0, 7);
  const day = d.toISOString().slice(0, 10);
  return { day, weekOf, monthOf };
};

const loadUsage = () => {
  try {
    if (fs.existsSync(USAGE_FILE)) {
      const data = JSON.parse(fs.readFileSync(USAGE_FILE, 'utf8'));
      if (data && typeof data === 'object' && data.providers) return data;
    }
  } catch (err) {
    console.error('[AI_USAGE] Failed to load usage file:', err.message);
  }
  return { providers: {} };
};

let usageCache = null;
const getUsageStore = () => {
  if (!usageCache) usageCache = loadUsage();
  return usageCache;
};

const persist = () => {
  try {
    fs.writeFileSync(USAGE_FILE, JSON.stringify(usageCache, null, 2), 'utf8');
  } catch (err) {
    console.error('[AI_USAGE] Failed to save usage:', err.message);
  }
};

const ensureEntry = (providerId) => {
  const store = getUsageStore();
  if (!store.providers[providerId]) store.providers[providerId] = emptyEntry();
  return store.providers[providerId];
};

const rollover = (entry, now = new Date()) => {
  const { day, weekOf, monthOf } = rolloverKey(now);
  if (entry.day !== day) entry.today = 0;
  if (entry.weekOf !== weekOf) entry.week = 0;
  if (entry.monthOf !== monthOf) entry.month = 0;
  entry.day = day;
  entry.weekOf = weekOf;
  entry.monthOf = monthOf;
};

const recordSuccess = (providerId, { latencyMs = 0, inputTokens = 0, outputTokens = 0, model = '', requestId = '' } = {}) => {
  const entry = ensureEntry(providerId);
  rollover(entry);
  entry.total += 1;
  entry.success += 1;
  entry.today += 1;
  entry.week += 1;
  entry.month += 1;
  entry.totalLatencyMs += latencyMs;
  entry.totalInputTokens += inputTokens || 0;
  entry.totalOutputTokens += outputTokens || 0;
  entry.lastRequestAt = new Date().toISOString();
  entry.lastSuccessAt = entry.lastRequestAt;
  entry.lastLatencyMs = latencyMs;
  entry.lastModel = model || entry.lastModel;
  entry.lastError = '';
  entry.lastErrorCategory = '';
  entry.lastRequestId = requestId || entry.lastRequestId;
  persist();
  return entry;
};

const recordFailure = (providerId, { category = 'PROVIDER', message = '', model = '', requestId = '' } = {}) => {
  const entry = ensureEntry(providerId);
  rollover(entry);
  entry.total += 1;
  entry.failed += 1;
  if (category === 'RATE_LIMIT') entry.rateLimited += 1;
  if (category === 'AUTH') entry.authErrors += 1;
  entry.lastRequestAt = new Date().toISOString();
  entry.lastFailureAt = entry.lastRequestAt;
  entry.lastError = message;
  entry.lastErrorCategory = category;
  entry.lastModel = model || entry.lastModel;
  entry.lastRequestId = requestId || entry.lastRequestId;
  persist();
  return entry;
};

const successRate = (entry) => {
  if (!entry || !entry.total) return null;
  return Math.round((entry.success / entry.total) * 1000) / 10;
};

const averageLatency = (entry) => {
  if (!entry || !entry.total) return 0;
  return Math.round(entry.totalLatencyMs / entry.total);
};

const health = (providerId) => {
  const entry = ensureEntry(providerId);
  const rate = successRate(entry);
  const recentFailures = (lastFailureAt, lastSuccessAt) => {
    if (!lastFailureAt) return 0;
    if (lastSuccessAt && new Date(lastSuccessAt) > new Date(lastFailureAt)) return 0;
    return 1;
  };
  if (entry.authErrors > 0 && entry.authErrors >= entry.total) return 'error';
  if (recentFailures(entry.lastFailureAt, entry.lastSuccessAt)) return 'warning';
  if (rate !== null && rate < 60) return 'error';
  return 'healthy';
};

const summary = () => {
  const store = getUsageStore();
  const rows = Object.entries(store.providers).map(([id, e]) => ({
    providerId: id,
    ...e,
    successRate: successRate(e),
    averageLatencyMs: averageLatency(e),
    health: health(id),
  }));
  const totals = { total: 0, success: 0, failed: 0, today: 0, week: 0, month: 0 };
  rows.forEach(r => {
    totals.total += r.total;
    totals.success += r.success;
    totals.failed += r.failed;
    totals.today += r.today;
    totals.week += r.week;
    totals.month += r.month;
  });
  return { providers: rows, totals };
};

module.exports = {
  USAGE_FILE,
  recordSuccess,
  recordFailure,
  successRate,
  averageLatency,
  health,
  summary,
  loadUsage,
  resetUsage: (providerId) => {
    const store = getUsageStore();
    if (providerId) { delete store.providers[providerId]; persist(); return true; }
    usageCache = { providers: {} };
    persist();
    return true;
  },
};