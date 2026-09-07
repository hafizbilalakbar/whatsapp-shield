const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PROVIDERS_FILE = path.join(__dirname, '..', '..', 'ai_providers.json');
const KEY_DIR = path.join(__dirname, '..', '..', '.ai-keys');
const MASTER_KEY_FILE = path.join(KEY_DIR, 'master.key');

let cachedMasterKey = null;

const getMasterKey = () => {
  if (cachedMasterKey) return cachedMasterKey;
  const envKey = process.env.AI_PROVIDER_ENCRYPTION_KEY;
  if (envKey && envKey.length >= 32) {
    cachedMasterKey = Buffer.from(envKey.slice(0, 64).padEnd(64, '0'), 'hex');
    return cachedMasterKey;
  }
  try {
    if (fs.existsSync(MASTER_KEY_FILE)) {
      cachedMasterKey = Buffer.from(fs.readFileSync(MASTER_KEY_FILE, 'utf8').trim(), 'hex');
      return cachedMasterKey;
    }
    const generated = crypto.randomBytes(32).toString('hex');
    fs.mkdirSync(KEY_DIR, { recursive: true });
    fs.writeFileSync(MASTER_KEY_FILE, generated, { encoding: 'utf8', mode: 0o600 });
    cachedMasterKey = Buffer.from(generated, 'hex');
    return cachedMasterKey;
  } catch (err) {
    console.error('[AI_KEYS] Failed to load/generate master key:', err.message);
    return null;
  }
};

const encryptString = (plain) => {
  const key = getMasterKey();
  if (!key) return plain;
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const data = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `enc:v1:${iv.toString('base64')}:${tag.toString('base64')}:${data.toString('base64')}`;
};

const decryptString = (payload) => {
  if (!payload) return '';
  if (typeof payload !== 'string') return '';
  if (!payload.startsWith('enc:')) return payload;
  const parts = payload.split(':');
  if (parts.length < 5 || parts[0] !== 'enc') return '';
  const key = getMasterKey();
  if (!key) return '';
  try {
    const iv = Buffer.from(parts[2], 'base64');
    const tag = Buffer.from(parts[3], 'base64');
    const data = Buffer.from(parts.slice(4).join(':'), 'base64');
    const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (err) {
    console.error('[AI_KEYS] Failed to decrypt api key:', err.message);
    return '';
  }
};

const encodeLegacy = (plain) => Buffer.from(String(plain), 'utf8').toString('base64');
const decodeLegacy = (encoded) => {
  try { return Buffer.from(encoded, 'base64').toString('utf8'); } catch { return encoded; }
};

const loadProvidersRaw = () => {
  try {
    if (fs.existsSync(PROVIDERS_FILE)) {
      const data = JSON.parse(fs.readFileSync(PROVIDERS_FILE, 'utf8'));
      return Array.isArray(data) ? data : [];
    }
  } catch (err) {
    console.error('[AI_KEYS] Error loading providers file:', err.message);
  }
  return [];
};

const isEncrypted = (key) => typeof key === 'string' && key.startsWith('enc:');

const migrateRecord = (provider) => {
  if (!provider) return provider;
  const key = provider.apiKey;
  if (key && !isEncrypted(key) && /^[A-Za-z0-9+/=]+$/.test(key) && key.length > 6) {
    let plain = key;
    try {
      const decoded = Buffer.from(key, 'base64').toString('utf8');
      if (decoded && decoded.length > 0 && !decoded.includes('\uFFFD')) plain = decoded;
    } catch { /* keep */ }
    provider.apiKey = encryptString(plain);
  }
  return provider;
};

const saveProviders = (providers) => {
  try {
    fs.mkdirSync(path.dirname(PROVIDERS_FILE), { recursive: true });
    fs.writeFileSync(PROVIDERS_FILE, JSON.stringify(providers, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error('[AI_KEYS] Failed to save providers:', err.message);
    return false;
  }
};

const loadProviders = () => {
  return loadProvidersRaw().map(migrateRecord);
};

const loadEnabled = () => {
  return loadProviders().filter(p => p.enabled !== false && p.apiKey);
};

const redact = (provider) => {
  if (!provider) return provider;
  const { apiKey, ...rest } = provider;
  return { ...rest, apiKey: apiKey ? '••••••••••' : '', hasKey: Boolean(apiKey) };
};

const keyPreview = (provider) => {
  const plain = decryptString(provider.apiKey);
  if (!plain) return '';
  const last = plain.slice(-4);
  return `••••••••••••${last.replace(/^/, '')}`;
};

const encryptKey = (plain) => encryptString(plain);

module.exports = {
  PROVIDERS_FILE,
  getMasterKey,
  encryptString,
  decryptString,
  encryptKey,
  loadProviders,
  loadEnabled,
  loadProvidersRaw,
  saveProviders,
  redact,
  keyPreview,
  isEncrypted,
  encodeLegacy,
  decodeLegacy,
  migrateRecord,
};