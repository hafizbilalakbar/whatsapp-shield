const path = require('path');
const fs = require('fs');
const crypto = require('crypto');

const WORKSPACES_DIR = path.join(__dirname, '..', '..', 'workspaces');

const uuid = () => crypto.randomUUID();

const maskSecret = (value) => {
  if (!value) return '';
  if (value.length <= 8) return '••••••••';
  return `${value.slice(0, 4)}••••••••`;
};

const isValidWorkspaceId = (id) => {
  return typeof id === 'string' && /^[a-zA-Z0-9_-]{1,96}$/.test(id);
};

const workspaceDir = (workspaceId) => {
  const safe = isValidWorkspaceId(workspaceId) ? workspaceId : 'default';
  const dir = path.join(WORKSPACES_DIR, safe);
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (err) {
    console.error('[META] Failed to create workspace dir:', err.message);
  }
  return dir;
};

const fileFor = (workspaceId, name) => path.join(workspaceDir(workspaceId), name);

const readJson = (workspaceId, name, fallback = null) => {
  const file = fileFor(workspaceId, name);
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (err) {
    console.error(`[META] Error loading ${name}:`, err.message);
  }
  return fallback;
};

const writeJson = (workspaceId, name, data) => {
  const file = fileFor(workspaceId, name);
  try {
    fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    return true;
  } catch (err) {
    console.error(`[META] Error saving ${name}:`, err.message);
    return false;
  }
};

const now = () => new Date().toISOString();

const signString = (value, secret) => {
  if (!value) return '';
  const h = typeof secret === 'string' && secret ? secret : 'whatsapp-message-agent';
  return crypto.createHmac('sha256', h).update(value).digest('hex');
};

const verifySignature = (payload, signature, secret) => {
  if (!signature || !payload) return false;
  const expected = signString(payload, secret);
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(String(signature).replace('sha256=', ''));
    if (a.length !== b.length) return false;
    return crypto.timingSafeEqual(a, b);
  } catch (err) {
    return false;
  }
};

module.exports = {
  uuid,
  maskSecret,
  isValidWorkspaceId,
  workspaceDir,
  fileFor,
  readJson,
  writeJson,
  now,
  signString,
  verifySignature,
  WORKSPACES_DIR,
};