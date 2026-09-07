const fs = require('fs');
const path = require('path');
const store = require('./store');
const configService = require('./meta-config');
const agentsService = require('./ai-agents-service');
const ComplianceService = require('../compliance-service');

const CAMPAIGNS_FILE = 'meta_campaigns.json';
const MESSAGES_FILE = 'meta_messages.json';
const CONTACTS_FILE = 'meta_contacts.json';

const compliance = new ComplianceService({ dataDir: path.join(__dirname, '..', '..') });

const TIER_LIMITS = {
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: 250000,
};
const tierLimit = (tier) => TIER_LIMITS[tier] || TIER_LIMITS.TIER_1K;

// ---- hashing helpers for meaningful WhatsApp jids ----
const phoneToWaId = (phone) => String(phone || '').replace(/\D/g, '');

// ---- store helpers ----
const readJson = (ws, name, fallback) => store.readJson(ws, name, fallback);
const writeJson = (ws, name, data) => store.writeJson(ws, name, data);

const listCampaigns = (workspaceId) => {
  const data = readJson(workspaceId, CAMPAIGNS_FILE, { campaigns: [] });
  return (data.campaigns || []).slice().sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
};

const getCampaign = (workspaceId, campaignId) => {
  const data = readJson(workspaceId, CAMPAIGNS_FILE, { campaigns: [] });
  return (data.campaigns || []).find(c => c.id === campaignId) || null;
};

const saveCampaigns = (workspaceId, campaigns) => writeJson(workspaceId, CAMPAIGNS_FILE, { campaigns });

const updateCampaign = (workspaceId, campaignId, patch) => {
  const data = readJson(workspaceId, CAMPAIGNS_FILE, { campaigns: [] });
  const idx = (data.campaigns || []).findIndex(c => c.id === campaignId);
  if (idx === -1) return null;
  const campaign = { ...data.campaigns[idx], ...patch, updatedAt: store.now() };
  data.campaigns[idx] = campaign;
  saveCampaigns(workspaceId, data.campaigns);
  return campaign;
};

const listMessages = (workspaceId, { campaignId, status, limit = 200 } = {}) => {
  const data = readJson(workspaceId, MESSAGES_FILE, { messages: [] });
  let list = (data.messages || []);
  if (campaignId) list = list.filter(m => m.campaignId === campaignId);
  if (status) list = list.filter(m => m.status === status);
  return list.slice(-limit).reverse();
};

const saveMessages = (workspaceId, messages) => {
  const bounded = (messages || []).slice(-5000);
  writeJson(workspaceId, MESSAGES_FILE, { messages: bounded });
  return bounded;
};

const pushMessage = (workspaceId, message) => {
  const data = readJson(workspaceId, MESSAGES_FILE, { messages: [] });
  data.messages = data.messages || [];
  data.messages.push(message);
  return saveMessages(workspaceId, data.messages).length - 1;
};

const updateMessage = (workspaceId, id, patch) => {
  const data = readJson(workspaceId, MESSAGES_FILE, { messages: [] });
  const idx = (data.messages || []).findIndex(m => m.id === id);
  if (idx === -1) return null;
  const updated = { ...data.messages[idx], ...patch, updatedAt: store.now() };
  data.messages[idx] = updated;
  saveMessages(workspaceId, data.messages);
  return updated;
};

const findMessageByWamid = (workspaceId, wamid) => {
  const data = readJson(workspaceId, MESSAGES_FILE, { messages: [] });
  return (data.messages || []).find(m => m.wamid === wamid) || null;
};

// ---- contacts (Meta inbox) ----
const listMetaContacts = (workspaceId) => {
  const data = readJson(workspaceId, CONTACTS_FILE, { contacts: [] });
  return (data.contacts || []).slice().sort((a, b) => new Date(b.lastMessageAt || 0) - new Date(a.lastMessageAt || 0));
};

const getMetaContact = (workspaceId, waId) => {
  const data = readJson(workspaceId, CONTACTS_FILE, { contacts: [] });
  return (data.contacts || []).find(c => c.waId === waId) || null;
};

const upsertMetaContact = (workspaceId, fields) => {
  const data = readJson(workspaceId, CONTACTS_FILE, { contacts: [] });
  const contacts = data.contacts || [];
  const waId = phoneToWaId(fields.waId || fields.phone);
  const existing = contacts.find(c => c.waId === waId);
  const now = store.now();
  const record = existing
    ? { ...existing, ...fields, waId, lastMessageAt: now, updatedAt: now }
    : { id: store.uuid(), waId, phone: `+${waId}`, name: fields.name || `+${waId}`, agentId: null, tags: [], journey: 'new_lead', notes: '', notesList: [], unread: 1, crm: null, createdAt: now, updatedAt: now, lastMessageAt: now, ...fields };
  record.unread = fields.unread !== undefined ? fields.unread : (existing ? record.unread : 1);
  if (existing) {
    const idx = contacts.findIndex(c => c.waId === waId);
    contacts[idx] = record;
  } else {
    contacts.unshift(record);
  }
  writeJson(workspaceId, CONTACTS_FILE, { contacts });
  return record;
};

// ---- campaign creation ----
function createCampaign(workspaceId, input) {
  const now = store.now();
  const campaign = {
    id: store.uuid(),
    name: (input.name || '').trim() || 'Untitled campaign',
    templateName: input.templateName || '',
    templateId: input.templateId || '',
    language: input.language || 'en',
    scheduledAt: input.scheduledAt || now,
    status: 'draft',
    contacts: (input.contacts || []).map(c => ({
      phone: phoneToWaId(c.phone),
      name: c.name || `+${phoneToWaId(c.phone)}`,
      variables: c.variables || {},
    })).filter(c => c.phone && c.phone.length >= 8),
    messages: [],
    settings: {
      messagesPerMinute: Math.min(Math.max(Number(input.settings?.messagesPerMinute) || 10, 1), 60),
      maxMessages: Number(input.settings?.maxMessages) || (input.contacts || []).length || 0,
    },
    progress: { sent: 0, delivered: 0, read: 0, failed: 0, total: 0 },
    createdAt: now,
    updatedAt: now,
    startedAt: null,
    completedAt: null,
  };
  const data = readJson(workspaceId, CAMPAIGNS_FILE, { campaigns: [] });
  data.campaigns = data.campaigns || [];
  data.campaigns.unshift(campaign);
  saveCampaigns(workspaceId, data.campaigns);
  return { success: true, campaign };
}

function updateCampaignDraft(workspaceId, campaignId, input) {
  const campaign = getCampaign(workspaceId, campaignId);
  if (!campaign) return { success: false, error: 'Campaign not found' };
  if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
    return { success: false, error: 'Only draft/scheduled campaigns can be edited' };
  }
  let contacts = campaign.contacts;
  if (input.contacts && Array.isArray(input.contacts)) {
    contacts = input.contacts.map(c => ({
      phone: phoneToWaId(c.phone),
      name: c.name || `+${phoneToWaId(c.phone)}`,
      variables: c.variables || {},
    })).filter(c => c.phone && c.phone.length >= 8);
  }
  return { success: true, campaign: updateCampaign(workspaceId, campaignId, {
    name: input.name ?? campaign.name,
    templateName: input.templateName ?? campaign.templateName,
    templateId: input.templateId ?? campaign.templateId,
    language: input.language ?? campaign.language,
    scheduledAt: input.scheduledAt ?? campaign.scheduledAt,
    contacts,
    settings: input.settings ? { ...campaign.settings, ...input.settings } : campaign.settings,
  }) };
}

// Move a campaign into the queue (scheduled) or fire immediately (running).
function startCampaign(workspaceId, campaignId, { now = false } = {}) {
  const campaign = getCampaign(workspaceId, campaignId);
  if (!campaign) return { success: false, error: 'Campaign not found' };
  if (!campaign.templateName) return { success: false, error: 'Select an approved template first' };
  if (!campaign.contacts.length) return { success: false, error: 'Add at least one contact' };
  if (campaign.status === 'running') return { success: true, campaign };

  // Validate against local approved templates when possible.
  const validated = validateTemplateForCampaign(workspaceId, campaign.templateName);
  if (!validated.ok) return { success: false, error: validated.error };
  const status = now ? 'running' : 'scheduled';
  let camp = getCampaign(workspaceId, campaignId);

  // Queue messages for all contacts synchronously at start.
  if (camp.messages.length === 0) {
    for (const contact of camp.contacts) {
      const msgId = pushMessage(workspaceId, {
        id: store.uuid(),
        campaignId,
        campaignName: camp.name,
        to: contact.phone,
        name: contact.name,
        variables: contact.variables || {},
        templateName: camp.templateName,
        language: camp.language,
        direction: 'outbound',
        status: 'queued',
        mode: 'campaign',
        createdAt: store.now(),
        updatedAt: store.now(),
      });
      camp.messages.push(msgId);
    }
    updateCampaign(workspaceId, campaignId, { messages: camp.messages, progress: { ...camp.progress, total: camp.contacts.length } });
    camp = getCampaign(workspaceId, campaignId);
  }

  const patch = {
    status,
    startedAt: now ? store.now() : camp.startedAt,
    updatedAt: store.now(),
  };
  updateCampaign(workspaceId, campaignId, patch);
  ensureWorker();
  return { success: true, campaign: getCampaign(workspaceId, campaignId) };
}

const validateTemplateForCampaign = (workspaceId, templateName) => {
  const svc = require('./meta-template-service');
  const all = svc.listTemplates(workspaceId, {});
  const t = all.find(t => t.name === templateName);
  if (t && t.status !== 'APPROVED') return { ok: false, error: `Template "${templateName}" is not approved (status: ${t.status}). Only approved templates can be sent.` };
  return { ok: true };
};

function pauseCampaign(workspaceId, campaignId) {
  const campaign = getCampaign(workspaceId, campaignId);
  if (!campaign) return { success: false, error: 'Campaign not found' };
  if (campaign.status !== 'running' && campaign.status !== 'scheduled') return { success: false, error: 'Campaign is not active' };
  return { success: true, campaign: updateCampaign(workspaceId, campaignId, { status: 'paused', updatedAt: store.now() }) };
}

function resumeCampaign(workspaceId, campaignId) {
  const campaign = getCampaign(workspaceId, campaignId);
  if (!campaign) return { success: false, error: 'Campaign not found' };
  if (campaign.status === 'draft') return startCampaign(workspaceId, campaignId, { now: false });
  if (campaign.status !== 'paused') return { success: false, error: 'Campaign is not paused' };
  const camp = updateCampaign(workspaceId, campaignId, { status: 'scheduled', scheduledAt: store.now(), updatedAt: store.now() });
  ensureWorker();
  return { success: true, campaign: camp };
}

function cancelCampaign(workspaceId, campaignId) {
  const campaign = getCampaign(workspaceId, campaignId);
  if (!campaign) return { success: false, error: 'Campaign not found' };
  const queued = listMessages(workspaceId, { campaignId })
    .filter(m => m.status === 'queued');
  for (const m of queued) if (m.id) updateMessage(workspaceId, m.id, { status: 'cancelled' });
  return { success: true, campaign: updateCampaign(workspaceId, campaignId, { status: 'cancelled', updatedAt: store.now() }) };
}

// ---- sending ----
async function sendSingleTemplate({ workspaceId, to, templateName, language = 'en', variables = {}, contactId }) {
  return queueAndSend(workspaceId, {
    to: phoneToWaId(to),
    name: `+${phoneToWaId(to)}`,
    variables,
    templateName,
    language,
  }, { single: true, contactId });
}

async function queueAndSend(workspaceId, target, { single = false, campaignId = null, contactId = null } = {}) {
  const { config } = configService.buildClient(workspaceId);
  if (config.status !== 'connected') return { success: false, error: 'Meta connection required', code: 'META_NOT_CONNECTED' };

  const validate = validateTemplateForCampaign(workspaceId, target.templateName);
  if (!validate.ok) return { success: false, error: validate.error };

  const message = {
    id: store.uuid(),
    campaignId,
    campaignName: campaignId ? (getCampaign(workspaceId, campaignId)?.name || '') : 'Single message',
    to: target.to,
    name: target.name,
    variables: target.variables || {},
    templateName: target.templateName,
    language: target.language || 'en',
    direction: 'outbound',
    status: 'queued',
    mode: single ? 'single' : 'import',
    contactId: contactId || null,
    createdAt: store.now(),
    updatedAt: store.now(),
  };

  if (single) {
    pushMessage(workspaceId, message);
    return sendMessageRecord(workspaceId, message);
  }

  return message;
}

async function sendMessageRecord(workspaceId, message) {
  const { config, client } = configService.buildClient(workspaceId);
  const contactId = message.contactId || message.to;
  const canSend = compliance.canSendMessage(contactId, message.to, { optedOut: false });
  if (!canSend.allowed) {
    if (message.id) updateMessage(workspaceId, message.id, { status: 'blocked', error: canSend.reason });
    return { success: false, error: canSend.reason, code: canSend.code, message: { ...message, status: 'blocked', error: canSend.reason } };
  }

  if (message.id) updateMessage(workspaceId, message.id, { status: 'sending' });

  try {
    const result = await client.sendTemplateMessage({
      to: message.to,
      name: message.templateName,
      language: message.language || 'en',
      components: buildTemplateComponents(message.variables || {}),
    });
    const wamid = result?.messages?.[0]?.id || '';
    const sent = { ...message, status: 'sent', wamid, sentAt: store.now(), updatedAt: store.now(), error: null };
    if (message.id) updateMessage(workspaceId, message.id, sent); else pushMessage(workspaceId, sent);
    return { success: true, message: sent, wamid };
  } catch (err) {
    const failed = { ...message, status: 'failed', error: err.message, updatedAt: store.now() };
    if (message.id) updateMessage(workspaceId, message.id, failed); else pushMessage(workspaceId, failed);
    return { success: false, error: err.message, code: err.status || 'SEND_FAILED', message: failed };
  }
}

const buildTemplateComponents = (variables) => {
  const entries = Object.entries(variables || {});
  if (!entries.length) return [];
  const sorted = entries.sort(([a], [b]) => Number(a) - Number(b));
  return [{ type: 'body', parameters: sorted.map(([, v]) => ({ type: 'text', text: String(v) })) }];
};

// Send a plain text message through the OFFICIAL Meta API (only works inside a
// 24h customer-service window). Records it in the local timeline like every other message.
async function sendOfficialText({ workspaceId, to, text, contactId }) {
  return sendViaMeta(workspaceId, {
    to: phoneToWaId(to),
    text,
    contactId,
  }, async (client) => client.sendTextMessage({ to: phoneToWaId(to), text }));
}

// Send an image/document/audio/video through the OFFICIAL Meta API.
// `base64` is a data: URI or raw base64 — uploaded with Resumable-style upload,
// no public link needed.
async function sendOfficialMedia({ workspaceId, to, type, base64, mime, filename, caption, contactId }) {
  return sendViaMeta(workspaceId, {
    to: phoneToWaId(to),
    text: caption || '',
    contactId,
  }, async (client) => {
    const bytes = base64ToBuffer(base64);
    if (!bytes) throw new Error('Could not read the file data');
    const ogType = (mime || 'image/jpeg').split('/')[0];
    const mediaType = ogType === 'image' || ogType === 'video' || ogType === 'audio' ? ogType : 'document';
    const upload = await client.uploadMedia({
      type: mime || 'image/jpeg',
      data: bytes,
      filename: filename || `file.${(mime || 'bin').split('/')[1] || 'bin'}`,
    });
    const mediaId = upload?.id;
    if (!mediaId) throw new Error('Meta did not return a media id for the upload');
    return client.sendMediaMessage({ to, type: mediaType, mediaId, filename, caption });
  });
}

const base64ToBuffer = (data) => {
  let b64 = String(data || '');
  const comma = b64.indexOf(',');
  if (comma !== -1) b64 = b64.slice(comma + 1);
  if (!b64) return null;
  try { return Buffer.from(b64, 'base64'); } catch { return null; }
};

// Shared official-send gate: connection check, compliance gate, record + status patch.
async function sendViaMeta(workspaceId, target, sendFn) {
  const { config, client } = configService.buildClient(workspaceId);
  if (config.status !== 'connected') return { success: false, error: 'Meta connection required', code: 'META_NOT_CONNECTED' };
  if (!client.phoneNumberId) return { success: false, error: 'Phone Number ID is not configured', code: 'META_NOT_CONNECTED' };

  const contactId = target.contactId || target.to;
  const canSend = compliance.canSendMessage(contactId, target.to, { optedOut: false });
  if (!canSend.allowed) {
    return { success: false, error: canSend.reason, code: canSend.code };
  }

  const message = {
    id: store.uuid(),
    campaignId: null,
    campaignName: 'Official API',
    to: target.to,
    name: target.name || `+${target.to}`,
    variables: {},
    templateName: null,
    language: '',
    direction: 'outbound',
    status: 'sending',
    text: target.text || '',
    mode: 'official',
    contactId: contactId,
    createdAt: store.now(),
    updatedAt: store.now(),
  };
  try {
    const result = await sendFn(client);
    const wamid = result?.messages?.[0]?.id || '';
    const record = { ...message, status: 'sent', wamid, sentAt: store.now(), updatedAt: store.now(), error: null };
    pushMessage(workspaceId, record);
    return { success: true, message: record, wamid };
  } catch (err) {
    const record = { ...message, status: 'failed', error: err.message, updatedAt: store.now() };
    pushMessage(workspaceId, record);
    return { success: false, error: err.message, code: err.status || 'SEND_FAILED', message: record };
  }
}

// ---- webhook inbound handling ----
async function handleWebhook(workspaceId, payload, broadcast = null) {
  const results = { inbound: [], statuses: [], errors: [] };
  const { config, client } = configService.buildClient(workspaceId);

  const entries = payload?.entry || [];
  for (const entry of entries) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      // Prefer the workspace that owns the phone number id this webhook matches.
      const messages = value.messages || [];
      const statuses = value.statuses || [];

      for (const evt of statuses) {
        const wamid = evt.id;
        const record = wamid ? findMessageByWamid(workspaceId, wamid) : null;
        if (record) {
          const patch = { updatedAt: store.now() };
          if (evt.status === 'delivered') { patch.status = 'delivered'; patch.deliveredAt = store.now(); }
          if (evt.status === 'read') { patch.status = 'read'; patch.readAt = store.now(); }
          if (evt.status === 'failed') { patch.status = 'failed'; patch.error = evt.errors?.map(e => e.message).join('; ') || 'Failed'; }
          if (patch.status) updateMessage(workspaceId, record.id, patch);
          updateCampaignProgress(workspaceId, record.campaignId);
          results.statuses.push({ wamid, status: patch.status });
          if (broadcast) {
            broadcast({ type: 'MESSAGE_AGENT_UPDATE', action: 'meta_message_status', wamid, status: patch.status, campaignId: record.campaignId, meta: true });
          }
        } else {
          results.statuses.push({ wamid, status: evt.status, unmatched: true });
        }
      }

      for (const msg of messages) {
        const waId = msg.from;
        if (!waId) continue;
        const text = messageTextOf(msg);
        const contact = upsertMetaContact(workspaceId, {
          waId,
          name: waId,
          unread: 1,
        });
        const inboundRecord = {
          id: store.uuid(),
          campaignId: null,
          campaignName: 'Inbox',
          to: waId,
          name: contact.name,
          variables: {},
          templateName: null,
          language: '',
          direction: 'inbound',
          status: 'received',
          text: text || '',
          mode: 'meta',
          createdAt: store.now(),
          updatedAt: store.now(),
        };
        pushMessage(workspaceId, inboundRecord);
        results.inbound.push({ waId, text, messageId: msg.id });
        if (broadcast) {
          broadcast({ type: 'MESSAGE_AGENT_UPDATE', action: 'meta_incoming', meta: true, waId, text, contact: summarizeContact(contact) });
        }

        // AI agent auto-reply
        if (text) {
          try {
            const history = recentInboundHistory(workspaceId, waId, 8);
            const reply = await agentsService.handleIncoming({
              workspaceId,
              contact,
              message: text,
              history,
              businessProfile: {},
              compliance: compliance.canSendMessage(contact.id, waId, {}),
            });
            if (reply.handled && reply.reply && config.status === 'connected') {
              const delay = (reply.agent?.automation?.responseDelayMin ?? 1) * 1000;
              await new Promise(r => setTimeout(r, delay));
              const sentResult = await client.sendTextMessage({ to: waId, text: reply.reply });
              const outRecord = {
                id: store.uuid(),
                campaignId: null,
                campaignName: 'AI Agent',
                to: waId,
                name: contact.name,
                variables: {},
                templateName: null,
                language: '',
                direction: 'outbound',
                status: 'sent',
                wamid: sentResult?.messages?.[0]?.id || '',
                text: reply.reply,
                mode: 'ai_agent',
                agentId: reply.agent?.id,
                provider: reply.provider,
                createdAt: store.now(),
                updatedAt: store.now(),
              };
              pushMessage(workspaceId, outRecord);
              refreshContactLast(workspaceId, waId, reply.reply, 'ai');
              if (broadcast) {
                broadcast({ type: 'MESSAGE_AGENT_UPDATE', action: 'meta_ai_reply', meta: true, waId, text: reply.reply, agent: reply.agent?.name, needsHuman: !!reply.needsHuman });
              }
            } else if (reply.needsHuman) {
              refreshContactLast(workspaceId, waId, '', 'human');
              if (broadcast) {
                broadcast({ type: 'MESSAGE_AGENT_UPDATE', action: 'meta_human_handoff', meta: true, waId, agent: reply.agent?.name });
              }
            }
          } catch (err) {
            results.errors.push({ waId, error: err.message });
            console.error('[META_WEBHOOK] Agent reply failed:', err.message);
          }
        }
      }
    }
  }
  return { success: true, results };
}

const messageTextOf = (msg) => {
  if (msg.type === 'text') return msg.text?.body || '';
  if (msg.type === 'button') return msg.button?.text || '';
  if (msg.type === 'interactive') {
    const ib = msg.interactive?.button_reply?.title || msg.interactive?.list_reply?.title || '';
    return ib;
  }
  if (msg.type === 'image') return msg.image?.caption || `📷 Image received`;
  if (msg.type === 'video') return msg.video?.caption || `🎬 Video received`;
  if (msg.type === 'document') return msg.document?.caption || `📄 Document received`;
  if (msg.type === 'audio') return `🎤 Voice note received`;
  if (msg.type === 'location') return `📍 Location shared`;
  if (msg.type === 'contacts') return `👤 Contact card shared`;
  if (msg.type === 'sticker') return `😀 Sticker sent`;
  return `📩 New message (${msg.type || 'unknown'})`;
};

const recentInboundHistory = (workspaceId, waId, limit) => {
  const data = readJson(workspaceId, MESSAGES_FILE, { messages: [] });
  return (data.messages || [])
    .filter(m => m.direction === 'inbound' && m.to === waId)
    .slice(-limit)
    .map(m => ({ role: 'user', content: m.text || '' }));
};

const refreshContactLast = (workspaceId, waId, text, mode) => {
  const data = readJson(workspaceId, CONTACTS_FILE, { contacts: [] });
  const contacts = data.contacts || [];
  const idx = contacts.findIndex(c => c.waId === waId);
  if (idx !== -1) {
    contacts[idx].lastMessage = text ? String(text).slice(0, 120) : contacts[idx].lastMessage;
    contacts[idx].lastMode = mode;
    contacts[idx].lastMessageAt = store.now();
    if (mode === 'ai' && text) contacts[idx].unread = 0;
    writeJson(workspaceId, CONTACTS_FILE, { contacts });
  }
};

const summarizeContact = (c) => ({ id: c.id, waId: c.waId, name: c.name, tags: c.tags, journey: c.journey });

const updateCampaignProgress = (workspaceId, campaignId) => {
  if (!campaignId) return;
  const messages = listMessages(workspaceId, { campaignId, limit: 10000 });
  const progress = {
    sent: messages.filter(m => m.status === 'sent' || m.status === 'delivered' || m.status === 'read').length,
    delivered: messages.filter(m => m.status === 'delivered' || m.status === 'read').length,
    read: messages.filter(m => m.status === 'read').length,
    failed: messages.filter(m => m.status === 'failed').length,
    blocked: messages.filter(m => m.status === 'blocked' || m.status === 'cancelled').length,
    total: messages.length,
  };
  updateCampaign(workspaceId, campaignId, { progress });
  const campaign = getCampaign(workspaceId, campaignId);
  if (campaign && campaign.status === 'running' && progress.failed + progress.sent + progress.blocked >= progress.total && progress.total > 0) {
    updateCampaign(workspaceId, campaignId, { status: 'completed', completedAt: store.now() });
  }
};

// ---- worker ----
let workerTimer = null;
let workerBusy = false;

const WORKSPACES_DIR = store.WORKSPACES_DIR;

const ensureWorker = () => {
  const { configService } = require('./meta-config');
  void configService;
  if (workerTimer) return;
  workerTimer = setInterval(tick, 6000);
  workerTimer.unref?.();
  console.log('[META] Campaign worker started');
};

const tick = async () => {
  if (workerBusy) return;
  workerBusy = true;
  try {
    let dirs = [];
    try { dirs = fs.readdirSync(WORKSPACES_DIR).filter(d => fs.statSync(path.join(WORKSPACES_DIR, d)).isDirectory()); } catch { dirs = []; }
    for (const ws of dirs) {
      try {
        await processWorkspace(ws);
      } catch (err) {
        console.error(`[META] Worker error in workspace ${ws}:`, err.message);
      }
    }
  } finally {
    workerBusy = false;
  }
};

async function processWorkspace(workspaceId) {
  const { config, client } = configService.buildClient(workspaceId);
  if (config.status !== 'connected' || !config.accessToken) return;

  const tier = config.messagingLimitTier;
  const dayLimit = tierLimit(tier);
  const usedToday = usedToday(workspaceId);

  const campaigns = listCampaigns(workspaceId);
  for (const campaign of campaigns) {
    if (campaign.status === 'scheduled' && campaign.scheduledAt && new Date(campaign.scheduledAt) <= new Date()) {
      updateCampaign(workspaceId, campaign.id, { status: 'running', startedAt: store.now() });
    }
    if (campaign.status !== 'running') continue;

    const queued = listMessages(workspaceId, { campaignId: campaign.id, status: 'queued', limit: 10000 });
    if (!queued.length) {
      updateCampaign(workspaceId, campaign.id, { status: 'completed', completedAt: store.now() });
      continue;
    }

    const budgetRemaining = Math.max(0, dayLimit - usedToday);
    const perTick = Math.max(1, Math.ceil((campaign.settings?.messagesPerMinute || 10) / 10));
    const toSend = queued.slice(0, Math.min(perTick, budgetRemaining, queued.length));

    for (const message of toSend) {
      if (usedToday >= dayLimit) {
        updateCampaign(workspaceId, campaign.id, { status: 'paused', error: 'Daily messaging limit reached. Resume tomorrow.' });
        return;
      }
      const result = await sendMessageRecord(workspaceId, message);
      usedToday += (result.success ? 1 : 0);
      if (result.code === 'META_NOT_CONNECTED') {
        updateCampaign(workspaceId, campaign.id, { status: 'paused', error: 'Messaging unavailable' });
        return;
      }
    }
    updateCampaignProgress(workspaceId, campaign.id);
  }
}

const usedToday = (workspaceId) => {
  const data = readJson(workspaceId, MESSAGES_FILE, { messages: [] });
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return (data.messages || []).filter(m =>
    m.direction === 'outbound' && m.status !== 'failed' && m.status !== 'queued' && m.status !== 'cancelled' &&
    new Date(m.sentAt || m.updatedAt || 0).getTime() >= since
  ).length;
};

module.exports = {
  listCampaigns,
  getCampaign,
  createCampaign,
  updateCampaignDraft,
  startCampaign,
  pauseCampaign,
  resumeCampaign,
  cancelCampaign,
  listMessages,
  sendSingleTemplate,
  sendOfficialText,
  sendOfficialMedia,
  handleWebhook,
  listMetaContacts,
  getMetaContact,
  upsertMetaContact,
  updateCampaignProgress,
  usedToday,
  tierLimit,
  ensureWorker,
  phoneToWaId,
  CAMPAIGNS_FILE,
  MESSAGES_FILE,
  CONTACTS_FILE,
};