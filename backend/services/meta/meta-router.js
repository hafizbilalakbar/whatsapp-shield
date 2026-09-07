const express = require('express');
const fs = require('fs');
const path = require('path');
const store = require('./store');
const configService = require('./meta-config');
const templateService = require('./meta-template-service');
const agentsService = require('./ai-agents-service');
const messaging = require('./messaging-service');
const aiEngine = require('./ai-template-engine');
const complianceEngine = require('./compliance-engine');

const createMetaRouter = ({ sessionOwnerPhone = null, broadcastAll = null } = {}) => {
  const router = express.Router();

  // --- workspace resolution -------------------------------------------------
  const getWorkspaceId = (req) => {
    const header = req.headers['x-workspace'];
    if (store.isValidWorkspaceId(header)) return header;
    const owner = typeof sessionOwnerPhone === 'function' ? sessionOwnerPhone() : '';
    if (owner) return `session_${owner}`;
    return 'default';
  };

  const ws = (req) => getWorkspaceId(req);

  const ok = (res, data) => res.json({ success: true, workspace: getWorkspaceId(res.req), ...data });
  const fail = (res, err, status = 500) => res.status(status).json({ success: false, error: err.message || String(err), ...(err.code ? { code: err.code } : {}), ...(err.compliance ? { compliance: err.compliance } : {}) });

  router.get('/', (req, res) => ok(res, { app: 'meta', workspace: getWorkspaceId(req) }));

  // --- Connection / WhatsApp Business -------------------------------------
  router.get('/status', async (req, res) => {
    try {
      const workspaceId = ws(req);
      const status = await configService.getStatus(workspaceId);
      const templates = templateService.listTemplates(workspaceId, {});
      const campaigns = messaging.listCampaigns(workspaceId);
      const counts = countBy(templates, 'status');
      ok(res, {
        connection: status,
        templates: { total: templates.length, counts },
        campaigns: { total: campaigns.length, active: campaigns.filter(c => c.status === 'running' || c.status === 'scheduled').length },
        agents: agentsService.listAgents(workspaceId).map(a => ({ id: a.id, name: a.name, enabled: a.enabled })),
      });
    } catch (err) { fail(res, err); }
  });

  router.post('/connect', async (req, res) => {
    try {
      const result = await configService.connect(ws(req), req.body || {});
      res.json({ success: result.success, error: result.error || null, status: result.status, config: result.config, business: result.business, phone: result.phone, templates: result.templates, workspace: getWorkspaceId(res.req) });
    } catch (err) { fail(res, err); }
  });

  router.post('/sync', async (req, res) => {
    try {
      const workspaceId = ws(req);
      const live = await configService.sync(workspaceId);
      const synced = await templateService.syncFromMeta(workspaceId);
      ok(res, { live, templateSync: synced });
    } catch (err) { fail(res, err); }
  });

  router.post('/disconnect', (req, res) => {
    try { ok(res, configService.disconnect(ws(req))); } catch (err) { fail(res, err); }
  });

  router.get('/business', async (req, res) => {
    try {
      const { client, config } = configService.buildClient(ws(req));
      if (!config.accessToken) return fail(res, new Error('Not connected'), 400);
      const waba = await client.getWabaInfo();
      let phone = null;
      let templates = null;
      let optErrors = [];
      if (config.phoneNumberId) {
        try { phone = await client.getPhoneNumberInfo(); } catch (e) { optErrors.push(e.message); }
      }
      try { templates = await client.getMessageTemplates({ limit: 100 }); } catch (e) { optErrors.push(e.message); }
      ok(res, { waba, phone, templates, errors: optErrors });
    } catch (err) { fail(res, err); }
  });

  router.get('/settings', (req, res) => {
    try {
      const workspaceId = ws(req);
      const config = configService.loadConfig(workspaceId);
      const policy = complianceEngine.loadPolicy(workspaceId);
      ok(res, { config: configService.mask(config), policySummary: { version: policy.version, lastUpdated: policy.lastUpdated, rules: policy.componentRules }, workspace: workspaceId });
    } catch (err) { fail(res, err); }
  });

  // --- Templates ------------------------------------------------------------
  router.get('/templates', (req, res) => {
    try {
      const { status, search } = req.query;
      const templates = templateService.listTemplates(ws(req), { status, search });
      ok(res, { templates: templates.map(templateService.summarize) });
    } catch (err) { fail(res, err); }
  });

  router.get('/templates/history', (req, res) => {
    try { ok(res, { history: templateService.getHistory(ws(req)) }); } catch (err) { fail(res, err); }
  });

  router.post('/templates', (req, res) => {
    try { ok(res, templateService.saveDraft(ws(req), req.body || {})); } catch (err) { fail(res, err); }
  });

  router.put('/templates/:id', (req, res) => {
    try { ok(res, templateService.saveDraft(ws(req), { ...(req.body || {}), id: req.params.id })); } catch (err) { fail(res, err); }
  });

  router.delete('/templates/:id', (req, res) => {
    try {
      const result = templateService.deleteTemplate(ws(req), req.params.id);
      res.json({ success: result.success, error: result.error || null });
    } catch (err) { fail(res, err); }
  });

  router.post('/templates/generate', async (req, res) => {
    try {
      const workspaceId = ws(req);
      const business = await loadBusinessProfile();
      const result = await aiEngine.generateTemplate({
        workspaceId,
        purpose: req.body?.purpose || 'other',
        prompt: req.body?.prompt || '',
        businessProfile: req.body?.businessProfile || business,
      });
      res.json({ success: result.success, error: result.error || null, ...result, workspace: workspaceId });
    } catch (err) { fail(res, err); }
  });

  router.post('/templates/compliance', (req, res) => {
    try {
      const result = aiEngine.runCompliance({ workspaceId: ws(req), template: req.body?.template || {}, purpose: req.body?.purpose });
      ok(res, result);
    } catch (err) { fail(res, err); }
  });

  router.post('/templates/:id/submit', async (req, res) => {
    try {
      const result = await templateService.submit(ws(req), req.params.id);
      res.json(result);
    } catch (err) { fail(res, err); }
  });

  router.post('/templates/sync', async (req, res) => {
    try { ok(res, await templateService.syncFromMeta(ws(req))); } catch (err) { fail(res, err); }
  });

  router.get('/templates/policy', (req, res) => {
    try { ok(res, { policy: complianceEngine.loadPolicy(ws(req)) }); } catch (err) { fail(res, err); }
  });

  router.put('/templates/policy', (req, res) => {
    try {
      const saved = complianceEngine.savePolicy(ws(req), req.body || {});
      ok(res, { policy: saved });
    } catch (err) { fail(res, err); }
  });

  // --- AI Agents -------------------------------------------------------------
  router.get('/agents', (req, res) => {
    try { ok(res, { agents: agentsService.listAgents(ws(req)) }); } catch (err) { fail(res, err); }
  });

  router.get('/agents/types', (req, res) => {
    try { ok(res, { types: agentsService.AGENT_TYPES }); } catch (err) { fail(res, err); }
  });

  router.post('/agents', (req, res) => {
    try { ok(res, agentsService.createAgent(ws(req), req.body || {})); } catch (err) { fail(res, err); }
  });

  router.put('/agents/:id', (req, res) => {
    try {
      const result = agentsService.updateAgent(ws(req), req.params.id, req.body || {});
      res.json({ success: result.success, error: result.error || null, agent: result.agent });
    } catch (err) { fail(res, err); }
  });

  router.delete('/agents/:id', (req, res) => {
    try {
      const result = agentsService.removeAgent(ws(req), req.params.id);
      res.json({ success: result.success, error: result.error || null });
    } catch (err) { fail(res, err); }
  });

  // --- Campaigns ---------------------------------------------------------------
  router.get('/campaigns', (req, res) => {
    try { ok(res, { campaigns: messaging.listCampaigns(ws(req)) }); } catch (err) { fail(res, err); }
  });

  router.get('/campaigns/:id', (req, res) => {
    try {
      const workspaceId = ws(req);
      const campaign = messaging.getCampaign(workspaceId, req.params.id);
      if (!campaign) return res.status(404).json({ success: false, error: 'Campaign not found' });
      ok(res, { campaign, messages: messaging.listMessages(workspaceId, { campaignId: req.params.id, limit: 1000 }) });
    } catch (err) { fail(res, err); }
  });

  router.post('/campaigns', (req, res) => {
    try { ok(res, messaging.createCampaign(ws(req), req.body || {})); } catch (err) { fail(res, err); }
  });

  router.put('/campaigns/:id', (req, res) => {
    try {
      const result = messaging.updateCampaignDraft(ws(req), req.params.id, req.body || {});
      res.json({ success: result.success, error: result.error || null, campaign: result.campaign });
    } catch (err) { fail(res, err); }
  });

  router.post('/campaigns/:id/start', async (req, res) => {
    try {
      const result = messaging.startCampaign(ws(req), req.params.id, { now: req.body?.now === true });
      res.json({ success: result.success, error: result.error || null, campaign: result.campaign });
    } catch (err) { fail(res, err); }
  });

  router.post('/campaigns/:id/pause', (req, res) => {
    try {
      const result = messaging.pauseCampaign(ws(req), req.params.id);
      res.json({ success: result.success, error: result.error || null, campaign: result.campaign });
    } catch (err) { fail(res, err); }
  });

  router.post('/campaigns/:id/resume', (req, res) => {
    try {
      const result = messaging.resumeCampaign(ws(req), req.params.id);
      res.json({ success: result.success, error: result.error || null, campaign: result.campaign });
    } catch (err) { fail(res, err); }
  });

  router.post('/campaigns/:id/cancel', (req, res) => {
    try {
      const result = messaging.cancelCampaign(ws(req), req.params.id);
      res.json({ success: result.success, error: result.error || null, campaign: result.campaign });
    } catch (err) { fail(res, err); }
  });

  // --- Messages / sending ------------------------------------------------------
  router.get('/messages', (req, res) => {
    try {
      const { campaignId, status } = req.query;
      ok(res, { messages: messaging.listMessages(ws(req), { campaignId, status, limit: 500 }) });
    } catch (err) { fail(res, err); }
  });

  router.post('/send-template', async (req, res) => {
    try {
      const { to, templateName, language, variables, contactId } = req.body || {};
      if (!to || !templateName) return fail(res, new Error('Recipient and template required'), 400);
      const result = await messaging.sendSingleTemplate({ workspaceId: ws(req), to, templateName, language: language || 'en', variables: variables || {}, contactId });
      res.json(result);
    } catch (err) { fail(res, err); }
  });

  // Official-Meta plain text (inside the 24h window) and file/media sends.
  // Files go up through Meta's Resumable Upload API — no public links required.
  router.post('/messages/text', async (req, res) => {
    try {
      const { to, text, contactId } = req.body || {};
      if (!to || !text) return fail(res, new Error('Recipient and text required'), 400);
      res.json(await messaging.sendOfficialText({ workspaceId: ws(req), to, text, contactId }));
    } catch (err) { fail(res, err); }
  });

  router.post('/messages/media', async (req, res) => {
    try {
      const { to, type, base64, mime, filename, caption, contactId } = req.body || {};
      if (!to || !base64) return fail(res, new Error('Recipient and file are required'), 400);
      res.json(await messaging.sendOfficialMedia({ workspaceId: ws(req), to, type, base64, mime, filename, caption, contactId }));
    } catch (err) { fail(res, err); }
  });

  // --- Meta inbox (contacts who wrote to the business) -------------------------
  router.get('/inbox', (req, res) => {
    try { ok(res, { contacts: messaging.listMetaContacts(ws(req)) }); } catch (err) { fail(res, err); }
  });

  // --- Dashboard & history -------------------------------------------------------
  router.get('/dashboard', async (req, res) => {
    try {
      const workspaceId = ws(req);
      const status = await configService.getStatus(workspaceId);
      const templates = templateService.listTemplates(workspaceId, {});
      const messages = messaging.listMessages(workspaceId, { limit: 10000 });
      const campaigns = messaging.listCampaigns(workspaceId);
      const agents = agentsService.listAgents(workspaceId);
      const inbox = messaging.listMetaContacts(workspaceId);
      const history = templateService.getHistory(workspaceId);

      const messageCounts = countBy(messages, 'status');
      const templateCounts = countBy(templates, 'status');
      const outbound = messages.filter(m => m.direction === 'outbound');
      const inbound = messages.filter(m => m.direction === 'inbound');
      const aiMessages = messages.filter(m => m.mode === 'ai_agent');
      const byDay = {};
      for (const m of messages) {
        const day = String(m.createdAt || '').slice(0, 10);
        byDay[day] = byDay[day] || { sent: 0, received: 0, replied: 0, failed: 0 };
        if (m.direction === 'outbound') { if (m.status === 'sent' || m.status === 'delivered' || m.status === 'read') byDay[day].sent += 1; if (m.status === 'failed') byDay[day].failed += 1; }
        if (m.direction === 'inbound') byDay[day].received += 1;
        if (m.mode === 'ai_agent') byDay[day].replied += 1;
      }

      ok(res, {
        meta: status,
        templatesCount: templateCounts,
        messageCounts: {
          queued: messageCounts.queued || 0,
          sent: messageCounts.sent || 0,
          delivered: messageCounts.delivered || 0,
          read: messageCounts.read || 0,
          failed: messageCounts.failed || 0,
          blocked: messageCounts.blocked || 0,
          inbound: inbound.length,
          outbound: outbound.length,
          aiMessages: aiMessages.length,
        },
        campaigns: {
          total: campaigns.length,
          draft: campaigns.filter(c => c.status === 'draft').length,
          scheduled: campaigns.filter(c => c.status === 'scheduled').length,
          running: campaigns.filter(c => c.status === 'running').length,
          paused: campaigns.filter(c => c.status === 'paused').length,
          completed: campaigns.filter(c => c.status === 'completed').length,
          cancelled: campaigns.filter(c => c.status === 'cancelled').length,
        },
        agents: agents.map(a => ({ id: a.id, name: a.name, type: a.type, enabled: a.enabled, stats: a.stats })),
        inbox: { total: inbox.length, unread: inbox.filter(c => (c.unread || 0) > 0).length, leads: inbox.filter(c => c.journey === 'new_lead' || c.journey === 'interested').length },
        templatesTotal: templates.length,
        leads: inbox.filter(c => c.journey === 'new_lead' || c.journey === 'interested').length,
        conversions: messages.length ? 0 : 0,
        byDay,
        history: history.slice(0, 50),
      });
    } catch (err) { fail(res, err); }
  });

  // --- Policy ---------------------------------------------------------------------
  // (Advanced settings) — see /templates/policy.

  // --- Webhook verification & events (Meta -> server) -------------------------------
  const findWorkspaceForPayload = (query, value) => {
    const dirs = listWorkspaces();
    const phoneNumberId = value?.metadata?.phone_number_id || query?.phone_number_id || '';
    if (phoneNumberId) {
      const byPhone = dirs.find(wsId => configService.loadConfig(wsId).phoneNumberId === String(phoneNumberId));
      if (byPhone) return byPhone;
    }
    if (query?.workspace && store.isValidWorkspaceId(query.workspace)) return query.workspace;
    const connected = dirs.filter(wsId => configService.loadConfig(wsId).status === 'connected');
    if (connected.length) return connected[0];
    const owned = dirs.find(wsId => wsId.startsWith('session_'));
    return owned || 'default';
  };

  router.get('/webhook', (req, res) => {
    const mode = req.query['hub.mode'];
    const verifyToken = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    const workspaceId = findWorkspaceForPayload(req.query, {});
    const config = configService.loadConfig(workspaceId);
    const expected = config.verifyToken;
    if (mode === 'subscribe' && verifyToken && expected && verifyToken === expected) {
      return res.status(200).send(String(challenge));
    }
    if (mode === 'subscribe' && verifyToken && !expected) {
      // No verify token configured yet — accept during setup (development).
      return res.status(200).send(String(challenge));
    }
    return res.status(403).send('Verification failed');
  });

  router.post('/webhook', async (req, res) => {
    res.status(200).json({ status: 'received' }); // Acknowledge fast, process after.
    try {
      const payload = req.body || {};
      const workspaceId = findWorkspaceForPayload(req.query, payload?.entry?.[0]?.changes?.[0]?.value || {});
      const broadcast = (message) => {
        try { if (broadcastAll) broadcastAll(message); } catch (_) {}
      };
      await messaging.handleWebhook(workspaceId, payload, broadcast);
    } catch (err) {
      console.error('[META_WEBHOOK] handler error:', err.message);
    }
  });

  // --- every workspace --------------------------------------------------------------
  const listWorkspaces = () => {
    let dirs = [];
    try {
      dirs = fs.readdirSync(store.WORKSPACES_DIR).filter(d => fs.statSync(path.join(store.WORKSPACES_DIR, d)).isDirectory());
    } catch (_) { dirs = []; }
    return dirs;
  };

  return router;
};

const countBy = (list, key) => {
  const counts = {};
  for (const item of list || []) {
    const k = item[key] || 'unknown';
    counts[k] = (counts[k] || 0) + 1;
  }
  return counts;
};

// Reuse the existing business profile file so the AI template engine sees the
// same business context as the rest of the Message Agent.
const loadBusinessProfile = () => {
  try {
    const file = path.join(__dirname, '..', '..', 'business_profile.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {}
  return {};
};

module.exports = { createMetaRouter };