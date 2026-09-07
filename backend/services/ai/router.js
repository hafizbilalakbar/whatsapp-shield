const cooldowns = new Map();

const DEFAULT_SETTINGS = {
  strategy: 'priority',
  preferredProviderId: '',
  preferredModel: '',
  fallbackEnabled: true,
  retryCount: 1,
  retryBaseMs: 800,
  cooldownMs: 20000,
  maxCooldownMs: 120000,
};

const setCooldown = (providerId, ms) => {
  if (!providerId) return;
  const now = Date.now();
  const current = cooldowns.get(providerId) || 0;
  cooldowns.set(providerId, Math.max(current, now + ms));
};

const clearCooldown = (providerId) => {
  if (providerId) cooldowns.delete(providerId);
};

const cooldownUntil = (providerId) => cooldowns.get(providerId) || 0;

const scoreProvider = (provider, usageEntry, now = Date.now()) => {
  let score = 100;
  const u = usageEntry || {};
  const total = u.total || 0;
  if (total > 0) {
    const rate = (u.success || 0) / total;
    score += (rate - 0.8) * 50;
  }
  if (u.lastFailureAt && (!u.lastSuccessAt || new Date(u.lastFailureAt) > new Date(u.lastSuccessAt))) {
    const age = Math.abs(now - new Date(u.lastFailureAt).getTime());
    if (age < 60000) score -= 60;
    else if (age < 300000) score -= 30;
  }
  if (u.lastErrorCategory === 'RATE_LIMIT') score -= 40;
  if (u.lastErrorCategory === 'AUTH') score -= 80;
  const latency = u.total && u.totalLatencyMs ? u.totalLatencyMs / u.total : 0;
  if (latency > 15000) score -= 30;
  else if (latency > 8000) score -= 15;
  if (provider.enabled === false) score -= 1000;
  return score;
};

const availableProviders = (providers, now = Date.now()) => {
  return providers.filter(p => {
    if (p.enabled === false) return false;
    const until = cooldownUntil(p.id);
    if (until > now) return false;
    return true;
  });
};

const orderFor = (providers, settings, usageMap, now = Date.now()) => {
  const strategy = (settings && settings.strategy) || 'priority';
  const enabled = providers.filter(p => p.enabled !== false);

  if (strategy === 'preferred') {
    const preferred = enabled.find(p => p.id === settings.preferredProviderId);
    if (preferred) return [{ provider: preferred, model: settings.preferredModel || preferred.model }];
    return enabled.length ? [{ provider: enabled[0], model: enabled[0].model }] : [];
  }

  if (strategy === 'auto') {
    const scored = enabled.slice().sort((a, b) => scoreProvider(b, usageMap.get(b.id), now) - scoreProvider(a, usageMap.get(a.id), now));
    return scored.map(p => ({ provider: p, model: p.model }));
  }

  return enabled.slice().sort((a, b) => (a.priority || 0) - (b.priority || 0)).map(p => ({ provider: p, model: p.model }));
};

const buildAttempts = (providers, settings, usageMap) => {
  const now = Date.now();
  const ready = availableProviders(providers, now);
  const order = orderFor(ready.length ? ready : providers, settings, usageMap, now);
  if (!order.length) return { attempts: [], locked: providers.filter(p => p.enabled !== false).filter(p => cooldownUntil(p.id) > Date.now()) };
  const attempts = [];
  const retries = Math.max(0, (settings && settings.retryCount) || 1);
  for (const step of order) {
    for (let r = 0; r <= retries; r += 1) {
      attempts.push({ provider: step.provider, model: step.model, attempt: r, baseDelayMs: retries > 0 ? Math.pow(2, r) * ((settings && settings.retryBaseMs) || 800) : 0 });
    }
  }
  return { attempts, locked: [] };
};

const backoffDelay = (attempt) => attempt.baseDelayMs;

module.exports = {
  DEFAULT_SETTINGS,
  setCooldown,
  clearCooldown,
  cooldownUntil,
  scoreProvider,
  orderFor,
  buildAttempts,
  backoffDelay,
};