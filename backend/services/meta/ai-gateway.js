const manager = require('../ai/manager');

const PROVIDER_SPECS = require('../ai/catalog').PROVIDER_SPECS;

const loadProviders = () => {
  try {
    return manager.getEnabled();
  } catch (err) {
    console.error('[AI_GATEWAY] Error loading AI providers:', err.message);
    return [];
  }
};

const complete = async (opts = {}) => {
  try {
    return await manager.complete(opts);
  } catch (err) {
    return { ok: false, error: err.message || 'AI request failed', provider: null };
  }
};

const completeJson = async (opts = {}) => {
  try {
    return await manager.completeJson(opts);
  } catch (err) {
    return { ok: false, error: err.message || 'AI request failed', data: null, provider: null };
  }
};

module.exports = {
  complete,
  completeJson,
  extractJson: manager.extractJson,
  loadProviders,
  PROVIDER_SPECS,
};