const json = async (res) => {
  let data = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const err = new Error(data?.error || data?.message || `Request failed (${res.status})`);
    err.status = res.status;
    err.code = data?.code;
    err.data = data;
    throw err;
  }
  return data;
};

export const metaApi = {
  base: (path) => `/api/meta${path}`,

  async get(path) {
    const res = await fetch(this.base(path));
    return json(res);
  },
  async post(path, body) {
    const res = await fetch(this.base(path), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return json(res);
  },
  async put(path, body) {
    const res = await fetch(this.base(path), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return json(res);
  },
  async del(path) {
    const res = await fetch(this.base(path), { method: 'DELETE' });
    return json(res);
  },

  status: () => metaApi.get('/status'),
  settings: () => metaApi.get('/settings'),
  connect: (cfg) => metaApi.post('/connect', cfg),
  sync: () => metaApi.post('/sync'),
  disconnect: () => metaApi.post('/disconnect'),

  templates: (query = '') => metaApi.get(`/templates${query}`),
  saveTemplate: (tpl) => metaApi.post('/templates', tpl),
  updateTemplate: (id, patch) => metaApi.put(`/templates/${id}`, patch),
  deleteTemplate: (id) => metaApi.del(`/templates/${id}`),
  generateTemplate: (body) => metaApi.post('/templates/generate', body),
  compliance: (body) => metaApi.post('/templates/compliance', body),
  submitTemplate: (id) => metaApi.post(`/templates/${id}/submit`),
  syncTemplates: () => metaApi.post('/templates/sync'),
  templateHistory: () => metaApi.get('/templates/history'),
  policy: () => metaApi.get('/templates/policy'),
  updatePolicy: (p) => metaApi.put('/templates/policy', p),

  agents: () => metaApi.get('/agents'),
  agentTypes: () => metaApi.get('/agents/types'),
  createAgent: (a) => metaApi.post('/agents', a),
  updateAgent: (id, patch) => metaApi.put(`/agents/${id}`, patch),
  deleteAgent: (id) => metaApi.del(`/agents/${id}`),

  campaigns: () => metaApi.get('/campaigns'),
  campaignDetail: (id) => metaApi.get(`/campaigns/${id}`),
  createCampaign: (c) => metaApi.post('/campaigns', c),
  updateCampaign: (id, patch) => metaApi.put(`/campaigns/${id}`, patch),
  startCampaign: (id, now = false) => metaApi.post(`/campaigns/${id}/start`, { now }),
  pauseCampaign: (id) => metaApi.post(`/campaigns/${id}/pause`),
  resumeCampaign: (id) => metaApi.post(`/campaigns/${id}/resume`),
  cancelCampaign: (id) => metaApi.post(`/campaigns/${id}/cancel`),

  messages: (query = '') => metaApi.get(`/messages${query}`),
  sendTemplate: (body) => metaApi.post('/send-template', body),
  sendOfficialText: (body) => metaApi.post('/messages/text', body),
  sendOfficialMedia: (body) => metaApi.post('/messages/media', body),

  inbox: () => metaApi.get('/inbox'),
  dashboard: () => metaApi.get('/dashboard'),
};