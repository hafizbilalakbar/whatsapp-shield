import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Megaphone, Plus, Play, Pause, XCircle, Loader2, AlertTriangle, CalendarClock,
  PlayCircle, Send, ArrowLeft, MessagesSquare,
} from 'lucide-react';
import { cn } from '../../../components/ui/cn';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import MetaPanel from './MetaPanel';
import { metaApi } from './metaApi';
import { CAMPAIGN_STATUS_LABELS, templateVariables } from './MetaConstants';

const PROGRESS = { completed: 100, running: 40, scheduled: 5, draft: 0, paused: 25, cancelled: 0 };
const STATUS_COLOR = {
  draft: 'bg-[#8696A0]', scheduled: 'bg-warning', running: 'bg-[#00A884]', paused: 'bg-[#F5BB45]', completed: 'bg-success', cancelled: 'bg-error',
};

const CampaignForm = ({ templates, onCancel, onSaved }) => {
  const [f, setF] = useState({
    name: '', templateName: '', language: 'en', scheduledAt: '', contactsText: '', now: true,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const approved = templates.filter(t => t.status === 'APPROVED');
  const selected = approved.find(t => t.name === f.templateName);
  const vars = selected ? templateVariables(selected) : [];

  const parseContacts = () => {
    const rows = f.contactsText.split('\n').map(l => l.trim()).filter(Boolean);
    return rows.map(line => {
      const parts = line.split('\t').length > 1 ? line.split('\t') : line.split(',').length > 1 ? line.split(',') : [line];
      const phoneRaw = (parts[0] || '').trim().replace(/[^\d+]/g, '');
      const phone = phoneRaw.startsWith('+') ? phoneRaw.replace(/\D/g, '') : phoneRaw;
      const name = ((parts[1] || '').trim()) || undefined;
      const variables = {};
      parts.slice(2).forEach((val, i) => {
        if (i < vars.length) variables[vars[i]] = val.trim();
      });
      return { phone, name, variables };
    }).filter(c => (c.phone || '').length >= 8);
  };

  const save = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      if (!f.name.trim()) { setError('Campaign name is required.'); setBusy(false); return; }
      if (!f.templateName) { setError('Pick an approved template.'); setBusy(false); return; }
      if (!f.contactsText.trim()) { setError('Add at least one recipient.'); setBusy(false); return; }
      const contacts = parseContacts();
      if (!contacts.length) { setError('No valid phone numbers found (min 8 digits).'); setBusy(false); return; }
      if (contacts.length > 5000) { setError('Max 5,000 recipients per campaign.'); setBusy(false); return; }

      const res = await metaApi.createCampaign({
        name: f.name.trim(),
        templateName: f.templateName,
        language: f.language,
        scheduledAt: f.now ? null : new Date(f.scheduledAt).toISOString(),
        contacts,
      });
      if (res.success) {
        if (!f.now) {
          await metaApi.startCampaign(res.campaign.id, false);
          setNotice(`Campaign queued for ${new Date(f.scheduledAt).toLocaleString()}.`);
        }
        if (onSaved) onSaved();
      } else {
        setError(res.error || 'Create failed');
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const input = 'mt-1 w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary';
  const label = 'text-[10px] uppercase tracking-wider text-text-muted font-medium';

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      <button onClick={onCancel} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors">
        <ArrowLeft size={14} /> Back to campaigns
      </button>
      {error && <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}</div>}
      {notice && <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-[11px] text-success">{notice}</div>}

      <label className="block">
        <span className={label}>Campaign name</span>
        <input className={input} value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} placeholder="e.g. January sale blast" />
      </label>

      <label className="block">
        <span className={label}>Approved template</span>
        <select className={input} value={f.templateName} onChange={e => setF(s => ({ ...s, templateName: e.target.value }))}>
          <option value="">Select…</option>
          {approved.map(t => <option key={t.id} value={t.name}>{t.name} — {t.category}</option>)}
        </select>
        {approved.length === 0 && <div className="mt-1 text-[10px] text-warning">No approved templates yet. Create & submit one in Message Templates first.</div>}
      </label>

      <label className="block">
        <span className={label}>Language</span>
        <input className={cn(input, 'sm:max-w-[180px]')} value={f.language} onChange={e => setF(s => ({ ...s, language: e.target.value }))} placeholder="en" />
      </label>

      <div>
        <span className={label}>Recipients — one per line</span>
        <div className="mt-1 text-[10px] text-text-muted">
          Format: <code className="text-text-secondary">phone, name, var1, var2…</code> (comma or tab). Phone can be with or without +.
          {vars.length ? <> Template variables: {vars.map(v => `{{${v}}}`).join(', ')} — items after the phone fill them in order.</> : null}
        </div>
        <textarea
          rows={6}
          className={cn(input, 'mt-1 resize-y font-mono')}
          value={f.contactsText}
          onChange={e => setF(s => ({ ...s, contactsText: e.target.value }))}
          placeholder={'14155551234, John, John, SALE25\n15559998877\n12025554433, Acme Co, 500, track'}
        />
      </div>

      <div className="flex items-center gap-3 rounded-xl border border-border bg-surface p-3">
        <button onClick={() => setF(s => ({ ...s, now: !s.now }))} className={cn('h-6 w-11 rounded-full relative transition-colors', f.now ? 'bg-[#00A884]' : 'bg-[#3B4A54]')}>
          <span className={cn('absolute top-0.5 w-5 h-5 bg-white rounded-full transition-all', f.now ? 'left-[22px]' : 'left-0.5')} />
        </button>
        <div>
          <div className="text-[11px] font-medium text-text-primary">{f.now ? 'Start sending now' : 'Schedule for later'}</div>
          {!f.now && (
            <input type="datetime-local" className={cn(input, 'mt-1')} value={f.scheduledAt} onChange={e => setF(s => ({ ...s, scheduledAt: e.target.value }))} />
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="default" size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Create {f.now ? '& start' : 'campaign'}
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

const CampaignDetail = ({ campaign, onBack, onRefresh }) => {
  const [msgs, setMsgs] = useState([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [action, setAction] = useState('');

  useEffect(() => {
    let alive = true;
    const loadMsgs = async () => {
      try {
        const res = await metaApi.campaignDetail(campaign.id);
        if (alive) { setMsgs(res.messages || []); setError(''); }
      } catch (e) { if (alive) setError(e.message); }
    };
    loadMsgs();
    const iv = setInterval(loadMsgs, 8000);
    return () => { alive = false; clearInterval(iv); };
  }, [campaign.id]);

  const byStatus = useMemo(() => {
    const m = {};
    msgs.forEach(x => { m[x.status] = (m[x.status] || 0) + 1; });
    return m;
  }, [msgs]);

  const run = async (fn, id, label, ...args) => {
    setBusy(true); setAction(label); setError('');
    try {
      const res = await fn(id, ...args);
      if (!res?.success) setError(res?.error || `${label} failed`);
      if (onRefresh) await onRefresh();
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const done = (byStatus.sent || 0) + (byStatus.delivered || 0) + (byStatus.read || 0) + (byStatus.failed || 0) + (byStatus.blocked || 0);
  const total = msgs.length || campaign.messages?.length || (byStatus.queued || 0) + done;

  return (
    <div className="p-4 max-w-3xl mx-auto space-y-3">
      <button onClick={onBack} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors">
        <ArrowLeft size={14} /> Back to campaigns
      </button>

      <div className="rounded-xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-text-primary">{campaign.name}</span>
          <Badge variant="outline" className="text-[9px]">{CAMPAIGN_STATUS_LABELS[campaign.status] || campaign.status}</Badge>
          <span className="text-[10px] text-text-muted font-mono ml-auto">{campaign.templateName}</span>
        </div>
        <div className="mt-2 h-1.5 rounded-full bg-[#1F2C33] overflow-hidden">
          <div className={cn('h-full transition-all', STATUS_COLOR[campaign.status] || 'bg-[#00A884]')} style={{ width: `${total ? Math.round((done / total) * 100) : 0}%` }} />
        </div>
        <div className="mt-2 grid grid-cols-4 gap-2 text-center">
          <Kpi k="Queued" v={byStatus.queued || 0} />
          <Kpi k="Sent" v={(byStatus.sent || 0) + (byStatus.delivered || 0) + (byStatus.read || 0)} />
          <Kpi k="Failed" v={(byStatus.failed || 0)} />
          <Kpi k="Total" v={total} />
        </div>
        <div className="mt-2 flex items-center gap-2 flex-wrap">
          {campaign.status === 'draft' && <Button variant="default" size="sm" onClick={() => run(metaApi.startCampaign, campaign.id, 'Starting', true)} disabled={busy}><Play size={13} /> Start</Button>}
          {campaign.status === 'scheduled' && <Button variant="outline" size="sm" onClick={() => run(metaApi.startCampaign, campaign.id, 'Starting', true)} disabled={busy}><PlayCircle size={13} /> Send now</Button>}
          {campaign.status === 'running' && <Button variant="outline" size="sm" onClick={() => run(metaApi.pauseCampaign, campaign.id, 'Pausing')} disabled={busy}><Pause size={13} /> Pause</Button>}
          {campaign.status === 'paused' && <Button variant="outline" size="sm" onClick={() => run(metaApi.resumeCampaign, campaign.id, 'Resuming')} disabled={busy}><Play size={13} /> Resume</Button>}
          {!['completed', 'cancelled', 'draft'].includes(campaign.status) && (
            <Button variant="destructive" size="sm" onClick={() => run(metaApi.cancelCampaign, campaign.id, 'Cancelling')} disabled={busy}><XCircle size={13} /> Cancel</Button>
          )}
          {busy && <Loader2 size={14} className="animate-spin text-text-muted" />}
        </div>
      </div>

      {error && <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error">{error}</div>}

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        <div className="px-3 py-2 border-b border-border text-[11px] font-medium text-text-primary flex items-center gap-1.5"><MessagesSquare size={12} /> Recipients</div>
        <div className="max-h-72 overflow-y-auto divide-y divide-border/50">
          {msgs.length === 0 && <div className="px-3 py-6 text-center text-[11px] text-text-muted">No message records yet.</div>}
          {msgs.map(m => (
            <div key={m.id} className="px-3 py-2 flex items-center gap-2 text-[11px]">
              <span className="font-mono text-text-secondary w-28 truncate">{m.to}</span>
              <span className="text-text-muted truncate">{m.contactName || `+${m.to}`}</span>
              <span className="ml-auto">
                {m.status === 'sent' && <Badge variant="outline" className="text-[9px]">sent</Badge>}
                {m.status === 'delivered' && <Badge variant="success" className="text-[9px]">delivered</Badge>}
                {m.status === 'read' && <Badge variant="success" className="text-[9px]">read</Badge>}
                {m.status === 'queued' && <Badge variant="warning" className="text-[9px]">queued</Badge>}
                {(m.status === 'failed' || m.status === 'blocked') && <Badge variant="destructive" className="text-[9px]" title={m.error}>failed</Badge>}
                {!['sent', 'delivered', 'read', 'queued', 'failed', 'blocked'].includes(m.status) && <span className="text-text-muted">{m.status}</span>}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const Kpi = ({ k, v }) => (
  <div>
    <div className="text-base font-semibold text-text-primary">{v}</div>
    <div className="text-[9px] uppercase tracking-wider text-text-muted mt-0.5">{k}</div>
  </div>
);

const MetaCampaigns = ({ isOpen, onClose, embedded = false }) => {
  const [campaigns, setCampaigns] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [detail, setDetail] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await metaApi.campaigns();
      setCampaigns(res.campaigns || []);
      const t = await metaApi.templates();
      setTemplates(t.templates || []);
      setError('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { if (embedded || isOpen) load(); }, [embedded, isOpen, load]);

  const run = async (fn, id, label) => {
    setBusyId(id);
    try {
      const res = await fn(id);
      if (!res?.success) setError(res?.error || `${label} failed`);
      else setError('');
      await load();
    } catch (e) { setError(e.message); }
    setBusyId(null);
  };

  const list = detail ? campaigns.filter(c => c.id === detail) : campaigns;

  return (
    <MetaPanel
      isOpen={isOpen} onClose={onClose} embedded={embedded}
      title="Campaigns"
      subtitle="Schedule and run template blasts through the official Meta API. Pause, resume or cancel anytime."
      icon={<Megaphone size={16} className="text-primary" />}
      widthClass="max-w-4xl"
    >
      {!detail ? (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            <div className="text-[11px] text-text-muted">{campaigns.length} campaign{campaigns.length === 1 ? '' : 's'}</div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={load} disabled={loading} className="hidden sm:flex">
              {loading ? <Loader2 size={13} className="animate-spin" /> : null} Refresh
            </Button>
            <button onClick={() => setCreating(true)} className="h-7 px-3 rounded-lg bg-[#00A884]/15 text-[#00A884] text-[11px] font-semibold flex items-center gap-1.5 transition-colors hover:bg-[#00A884]/25">
              <Plus size={13} /> New campaign
            </button>
          </div>

          {error && <div className="mx-3 mt-2 rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error">{error}</div>}

          <div className="flex-1 overflow-y-auto p-3">
            {loading && campaigns.length === 0 ? (
              <div className="text-center py-10 text-xs text-text-muted"><Loader2 size={14} className="animate-spin inline mr-1.5" /> Loading…</div>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Megaphone size={26} className="mx-auto text-text-muted" />
                <div className="text-xs text-text-muted">No campaigns yet.</div>
              </div>
            ) : (
              <div className="grid gap-2">
                {list.map(c => {
                  const sent = (c.progress?.sent || 0) + (c.progress?.delivered || 0) + (c.progress?.read || 0);
                  const failed = c.progress?.failed || 0;
                  const total = c.progress?.total || c.contacts?.length || 0;
                  const pct = total ? Math.round(Math.max(sent + failed, ((c.messages || []).filter(m => m.status !== 'queued').length)) / (total || 1) * 100) : 0;
                  return (
                    <button key={c.id} onClick={() => setDetail(c.id)} className="w-full text-left bg-surface border border-border rounded-xl p-3 hover:border-primary/40 transition-colors group/row">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-text-primary">{c.name}</span>
                        <Badge variant="outline" className="text-[9px]">{CAMPAIGN_STATUS_LABELS[c.status] || c.status}</Badge>
                        <span className="text-[10px] text-text-muted font-mono ml-auto">{c.templateName}</span>
                      </div>
                      <div className="mt-2 h-1.5 rounded-full bg-[#1F2C33] overflow-hidden">
                        <div className={cn('h-full transition-all', STATUS_COLOR[c.status] || 'bg-[#00A884]')} style={{ width: `${Math.min(pct, 100)}%` }} />
                      </div>
                      <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted">
                        <span className="flex items-center gap-1"><Send size={10} /> {sent}/{total || 0}</span>
                        {failed > 0 && <span className="text-error flex items-center gap-1"><AlertTriangle size={10} /> {failed}</span>}
                        {c.scheduledAt && <span className="flex items-center gap-1"><CalendarClock size={10} /> {String(c.scheduledAt).slice(0, 16).replace('T', ' ')}</span>}
                        <span className="ml-auto flex items-center gap-1">
                          {c.status === 'draft' && <Play size={10} className="text-[#00A884]" />}
                          {c.status === 'running' && <Pause size={10} className="text-warning" />}
                          <ChevronRightIcon />
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      ) : (
        <CampaignDetail campaign={list[0]} onBack={() => setDetail(null)} onRefresh={load} />
      )}

      {creating && (
        <div className="absolute inset-0 z-30 bg-background/70 backdrop-blur-sm overflow-y-auto">
          <div className="min-h-full flex items-center justify-center p-4">
            <CampaignForm templates={templates} onCancel={() => setCreating(false)} onSaved={() => { setCreating(false); load(); }} />
          </div>
        </div>
      )}
    </MetaPanel>
  );
};

const ChevronRightIcon = () => <span className="text-text-muted">›</span>;

export default MetaCampaigns;