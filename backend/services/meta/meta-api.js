const GRAPH_BASE = 'https://graph.facebook.com';
const GRAPH_TIMEOUT_MS = 30000;

// Official WhatsApp Cloud API client. Uses only Meta's public Graph API — no
// unofficial automation. Templates, business info, messaging status and limits
// all come from Meta as the single source of truth.
class MetaClient {
  constructor({ accessToken, wabaId, phoneNumberId, graphVersion = 'v23.0' } = {}) {
    this.accessToken = accessToken || '';
    this.wabaId = wabaId || '';
    this.phoneNumberId = phoneNumberId || '';
    this.graphVersion = graphVersion || 'v23.0';
  }

  get base() {
    return `${GRAPH_BASE}/${this.graphVersion}`;
  }

  assertCredentials() {
    if (!this.accessToken) throw new Error('WhatsApp Business access token is not configured');
    if (!this.wabaId) throw new Error('WhatsApp Business Account ID (WABA ID) is not configured');
  }

  async _fetch(path, { method = 'GET', body, params = {} } = {}) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), GRAPH_TIMEOUT_MS);
    try {
      const url = new URL(`${this.base}/${path}`);
      url.searchParams.set('access_token', this.accessToken);
      Object.entries(params).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
      });
      const headers = { 'Content-Type': 'application/json' };
      const res = await fetch(url.toString(), {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: controller.signal,
      });
      const text = await res.text();
      let data = null;
      try { data = text ? JSON.parse(text) : null; } catch { data = text; }
      if (!res.ok) {
        const msg = this._errorMessage(data, res.status);
        const error = new Error(msg);
        error.status = res.status;
        error.details = data;
        throw error;
      }
      return { status: res.status, data };
    } finally {
      clearTimeout(timer);
    }
  }

  _errorMessage(data, status) {
    if (data && data.error) {
      const e = data.error;
      if (e.error_user_msg) return e.error_user_msg;
      if (e.message) return `${e.message}${e.type ? ` (${e.type})` : ''}`;
    }
    return `Meta API error (HTTP ${status})`;
  }

  // --- Business / WhatsApp Business Account info ---
  async getWabaInfo() {
    this.assertCredentials();
    const { data } = await this._fetch(this.wabaId, {
      params: { fields: 'name,id,is_premium,account_review_status,timezone_id,business_verification_status' },
    });
    return data;
  }

  async getPhoneNumberInfo() {
    this.assertCredentials();
    if (!this.phoneNumberId) throw new Error('Phone Number ID is not configured');
    const { data } = await this._fetch(this.phoneNumberId, {
      params: {
        fields: 'verified_name,display_phone_number,quality_rating,code_verification_status,platform_type,messaging_limit_tier,throughput,whatsapp_business_account{id,name},status',
      },
    });
    return data;
  }

  async getMessageTemplates({ status, name, fields } = {}) {
    this.assertCredentials();
    const fieldList = fields ||
      'name,status,category,language,components,rejected_reason,message_send_ttl_seconds,previous_category,quality_score';
    const { data } = await this._fetch(`${this.wabaId}/message_templates`, {
      params: { fields: fieldList, limit: 100, status },
    });
    return (data && data.data) || [];
  }

  async getTemplateByName(name) {
    this.assertCredentials();
    const templates = await this.getMessageTemplates({ name });
    return templates.find(t => t.name === name) || null;
  }

  async createTemplate(payload) {
    this.assertCredentials();
    const { data } = await this._fetch(`${this.wabaId}/message_templates`, { method: 'POST', body: payload });
    return data; // { hsm_id, id }
  }

  async deleteTemplate(name) {
    this.assertCredentials();
    const { data } = await this._fetch(`${this.wabaId}/message_templates`, {
      method: 'DELETE',
      params: { name },
    });
    return data;
  }

  // --- Messaging ---
  async sendMessage({ to, type = 'template', payload }) {
    this.assertCredentials();
    if (!this.phoneNumberId) throw new Error('Phone Number ID is not configured');
    const body = { messaging_product: 'whatsapp', recipient_type: 'individual', to, type, ...payload };
    const { data } = await this._fetch(`${this.phoneNumberId}/messages`, { method: 'POST', body });
    return data; // { messages: [{ id: wamid }] }
  }

  async sendTemplateMessage({ to, name, language = 'en', components = [], media } = {}) {
    const payload = {
      template: { name, language: { code: language }, ...(components.length ? { components } : {}) },
    };
    return this.sendMessage({ to, type: 'template', payload });
  }

  async sendTextMessage({ to, text, preview_url = false }) {
    return this.sendMessage({ to, type: 'text', payload: { text: { body: text, preview_url } } });
  }

  // Upload raw bytes (Buffer/Uint8Array) to Meta and return a media id usable in
  // a message payload — the fully official way to send files without a public URL.
  async uploadMedia({ type = 'image/jpeg', data, filename = 'file' }) {
    this.assertCredentials();
    if (!this.phoneNumberId) throw new Error('Phone Number ID is not configured');
    const form = new FormData();
    form.append('messaging_product', 'whatsapp');
    const blob = new Blob([data], { type });
    form.append('file', blob, filename);
    const res = await fetch(`${this.base}/${this.phoneNumberId}/media?access_token=${encodeURIComponent(this.accessToken)}`, {
      method: 'POST',
      body: form,
    });
    const text = await res.text();
    let json = null;
    try { json = text ? JSON.parse(text) : null; } catch { json = text; }
    if (!res.ok) {
      const err = new Error(this._errorMessage(json, res.status));
      err.status = res.status;
      err.details = json;
      throw err;
    }
    return json;
  }

  // Send an image/document/audio/video. Use either a public `link` or an existing
  // `mediaId` (from uploadMedia). Type must be image|video|audio|document.
  async sendMediaMessage({ to, type = 'image', mediaId, link, filename, caption }) {
    if (!['image', 'video', 'audio', 'document'].includes(type)) throw new Error(`Unsupported media type: ${type}`);
    const media = { ...(mediaId ? { id: mediaId } : {}), ...(link ? { link } : {}) };
    if (type === 'document' && filename) media.filename = filename;
    if (caption) media.caption = caption;
    return this.sendMessage({ to, type, payload: { [type]: media } });
  }

  // --- Webhook subscription management ---
  async subscribeApp() {
    this.assertCredentials();
    const { data } = await this._fetch(`${this.wabaId}/subscribed_apps`, { method: 'POST' });
    return data;
  }

  async registerPhone() {
    this.assertCredentials();
    if (!this.phoneNumberId) throw new Error('Phone Number ID is not configured');
    const { data } = await this._fetch(`${this.phoneNumberId}/register`, {
      method: 'POST',
      body: { messaging_product: 'whatsapp', pin: '000000' },
    });
    return data;
  }

  async getMigrationCodes() {}
}

module.exports = MetaClient;