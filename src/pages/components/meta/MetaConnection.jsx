import React, { useCallback, useEffect, useState } from 'react';
import {
  Building2, Link2, Unplug, RefreshCw, CheckCircle2, Loader2, Copy, Check,
  AlertTriangle, Globe, ShieldCheck, Eye, KeyRound, Phone, ExternalLink,
  HelpCircle, ChevronRight, ListChecks,
} from 'lucide-react';
import { cn } from '../../../components/ui/cn';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import MetaPanel from './MetaPanel';
import { metaApi } from './metaApi';
import { META_STATUS_LABELS, formatCount, tierCap } from './MetaConstants';

const mask = (s) => (s ? `••••${s.slice(-6)}` : '—');
const VERIFY_HINT = process.env.NODE_ENV === 'development'
  ? 'Leave blank to accept any token while you are setting up (development only). Set a token before going live.'
  : 'Set a verify token — Meta will echo it back on webhook verification.';

const MetaConnection = ({ isOpen, onClose, embedded = false }) => {
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [mode, setMode] = useState('view'); // view | setup
  const [setupStep, setSetupStep] = useState(0); // wizard progress 0..4
  const [form, setForm] = useState({ accessToken: '', wabaId: '', phoneNumberId: '', appSecret: '', verifyToken: '' });
  const [showSecrets, setShowSecrets] = useState(false);
  const [copied, setCopied] = useState('');
  const [confirmDisconnect, setConfirmDisconnect] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await metaApi.status();
      setStatus(res.connection);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  // Sync wizard fields with any already-configured values.
  const loadSettings = useCallback(async () => {
    try {
      const res = await metaApi.settings();
      const c = res.config || {};
      setForm(f => ({
        accessToken: c.accessToken && c.accessToken !== '****' ? '' : (f.accessToken || ''),
        wabaId: c.wabaId || f.wabaId || '',
        phoneNumberId: c.phoneNumberId || f.phoneNumberId || '',
        appSecret: c.status === 'connected' ? '' : (f.appSecret || ''),
        verifyToken: c.verifyToken ? '' : (f.verifyToken || ''),
      }));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { if (embedded || isOpen) { load(); if (mode === 'setup') loadSettings(); } }, [embedded, isOpen, load, loadSettings, mode]);

  const handleConnect = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await metaApi.connect({
        accessToken: form.accessToken.trim(),
        wabaId: form.wabaId.trim(),
        phoneNumberId: form.phoneNumberId.trim(),
        appSecret: form.appSecret.trim(),
        verifyToken: form.verifyToken.trim(),
      });
      if (res.success && !res.error) {
        setNotice('Connected to the WhatsApp Business Cloud API✓');
        setMode('view');
        setStatus(res.status);
        await load();
      } else {
        setError(res.error || 'Connection failed');
        if (res.status) setStatus(res.status);
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const handleSync = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await metaApi.sync();
      if (res.success) { setNotice('Synced with Meta. Templates refreshed.'); setStatus(res.live || null); await load(); }
      else setError(res.error || 'Sync failed');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const handleDisconnect = async () => {
    setBusy(true); setError('');
    try { await metaApi.disconnect(); setMode('setup'); setStatus(null); setNotice('Disconnected. Local data stays in your workspace.'); }
    catch (e) { setError(e.message); }
    setBusy(false);
  };

  const copy = async (text, key) => {
    try { await navigator.clipboard.writeText(text); setCopied(key); setTimeout(() => setCopied(''), 1500); } catch { /* noop */ }
  };

  const webhookUrl = `${window.location.origin}/api/meta/webhook`;
  const statusUI = status || {};
  const tier = statusUI.messaging_limit_tier || 'TIER_1K';
  const cap = tierCap(tier);
  const usedToday = statusUI.used_today || 0;
  const phone = statusUI.display_phone_number || statusUI.phone || '';

  if (loading && !status) {
    return (
      <MetaPanel isOpen={isOpen} onClose={onClose} embedded={embedded} title="Meta Connection" icon={<Building2 size={16} className="text-primary" />} widthClass="max-w-3xl">
        <div className="flex items-center justify-center py-16 text-xs text-text-muted"><Loader2 size={14} className="animate-spin mr-2" /> Loading connection…</div>
      </MetaPanel>
    );
  }

  return (
    <MetaPanel
      isOpen={isOpen} onClose={onClose} embedded={embedded}
      title="Meta Connection"
      subtitle="WhatsApp Business Cloud API — official Meta sending for templates, campaigns and AI agents."
      icon={<Building2 size={16} className="text-primary" />}
      widthClass="max-w-3xl"
    >
      <div className="p-4 space-y-3">
        {error && <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}</div>}
        {notice && <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-[11px] text-success flex items-start gap-2"><CheckCircle2 size={14} className="shrink-0 mt-0.5" /> {notice}</div>}

        {mode === 'view' && statusUI.status === 'connected' && (
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            <div className="p-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#00A884]/15 flex items-center justify-center">
                    <Building2 size={18} className="text-[#00A884]" />
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-text-primary">{statusUI.business_name || statusUI.business?.name || 'WhatsApp Business'}</div>
                    <div className="text-[11px] text-text-muted flex items-center gap-1">
                      <Phone size={11} /> {phone || 'Phone not set'}
                    </div>
                  </div>
                </div>
                <Badge variant="success" className="flex items-center gap-1"><span className="w-1.5 h-1.5 rounded-full bg-[#00A884]" /> LIVE</Badge>
              </div>

              <div className="mt-4 grid grid-cols-2 lg:grid-cols-4 gap-2">
                <InfoTile label="Messaging tier" value={tier.replace('TIER_', 'Tier ')} />
                <InfoTile label="Today's sends" value={`${formatCount(usedToday)} / ${cap === Infinity ? '∞' : formatCount(cap)}`} />
                <InfoTile label="Quality rating" value={statusUI.quality_rating || '—'} />
                <InfoTile label="WABA ID" value={String(statusUI.wabaId || statusUI.waba_id || '—').slice(0, 12)} mono />
              </div>

              <div className="mt-4 grid sm:grid-cols-2 gap-2">
                <div className="rounded-lg bg-surface border border-border p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium flex items-center gap-1"><Globe size={10} /> Webhook URL</div>
                  <div className="mt-1 flex items-center gap-1.5">
                    <code className="flex-1 text-[10px] text-text-secondary break-all">{webhookUrl}</code>
                    <button onClick={() => copy(webhookUrl, 'hook')} className="text-text-muted hover:text-primary transition-colors shrink-0">
                      {copied === 'hook' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                    </button>
                  </div>
                </div>
                <div className="rounded-lg bg-surface border border-border p-2.5">
                  <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium flex items-center gap-1"><KeyRound size={10} /> Verify token</div>
                  <div className="mt-1 flex items-center justify-between gap-1.5">
                    <code className="text-[10px] text-text-secondary">{statusUI.verifyToken ? mask(statusUI.verifyToken) : 'Not set'}</code>
                    {statusUI.verifyToken && (
                      <button onClick={() => copy(statusUI.verifyToken, 'vt')} className="text-text-muted hover:text-primary transition-colors shrink-0">
                        {copied === 'vt' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                <Button variant="outline" size="sm" onClick={handleSync} disabled={busy}>
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync now
                </Button>
                <Button variant="outline" size="sm" onClick={() => setConfirmDisconnect(true)}>
                  <Unplug size={13} /> Disconnect
                </Button>
              </div>
            </div>
          </div>
        )}

        {mode === 'view' && (!statusUI.status || statusUI.status === 'error' || statusUI.status !== 'connected') && (
          <div className="space-y-3">
            {/* Hero / CTAs */}
            <div className="rounded-2xl border border-border bg-gradient-to-br from-[#00A884]/10 via-surface to-surface p-6">
              <div className="flex items-start gap-4 flex-wrap">
                <div className="w-14 h-14 rounded-2xl bg-[#00A884]/15 border border-[#00A884]/20 flex items-center justify-center shrink-0">
                  <Link2 size={24} className="text-[#00A884]" />
                </div>
                <div className="flex-1 min-w-[220px]">
                  <div className="text-base font-semibold text-text-primary">
                    {statusUI.status === 'error' ? 'Connection error' : 'Connect your official WhatsApp API'}
                  </div>
                  <div className="text-[11px] text-text-muted mt-1 leading-relaxed">
                    Templates, campaign sending, automated replies and the dashboard all run on the <span className="text-text-secondary">official Meta WhatsApp Cloud API</span> — the same one WhatsApp uses. No unofficial tools. Follow the 3 easy steps below (under 2 minutes).
                  </div>
                  {statusUI.error && (
                    <div className="mt-2 rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error">{statusUI.error}</div>
                  )}
                </div>
              </div>
            </div>

            {/* Step-by-step onboarding */}
            {[ 
              { n: 1, title: 'Create a Meta app', desc: 'Go to developers.facebook.com → My Apps → Create App → pick "Other" → type "Business". Choose WhatsApp in the products list.', action: (
                <a href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 h-7 px-2.5 rounded-lg bg-surface border border-border text-[11px] text-text-secondary hover:text-primary transition-colors"><ExternalLink size={11} /> Open Meta for Developers</a>
              ) },
              { n: 2, title: 'Add WhatsApp to the app', desc: 'In your app, click Add Product → WhatsApp. Then under "API Setup" you get everything this tool needs.', action: null },
            ].map(step => (
              <div key={step.n} className="flex gap-3 rounded-2xl border border-border bg-surface p-4">
                <div className="w-8 h-8 rounded-full bg-primary/15 border border-primary/30 text-primary text-[13px] font-bold flex items-center justify-center shrink-0">{step.n}</div>
                <div className="flex-1 min-w-0">
                  <div className="text-xs font-semibold text-text-primary">{step.title}</div>
                  <div className="text-[11px] text-text-muted mt-0.5 leading-relaxed">{step.desc}</div>
                  {step.action}
                </div>
              </div>
            ))}

            {/* Step 3: copy credentials CTA */}
            <div className="rounded-2xl border border-border bg-surface p-5 text-center space-y-3">
              <div className="w-11 h-11 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <ListChecks size={20} className="text-primary" />
              </div>
              <div>
                <div className="text-sm font-semibold text-text-primary">You now have what you need</div>
                <div className="text-[11px] text-text-muted max-w-lg mx-auto mt-1">
                  Grab these three from your app's <b>API Setup</b> page — a Permanent Access Token, the WhatsApp Business Account (WABA) ID, and the Phone Number ID. Paste them in the form below and we'll verify them instantly.
                </div>
              </div>
              <Button variant="default" size="sm" onClick={() => { setMode('setup'); loadSettings(); }}>
                <Link2 size={14} /> Enter my credentials
              </Button>
            </div>
          </div>
        )}

        {mode === 'setup' && (
          <div className="rounded-2xl border border-border bg-surface overflow-hidden">
            {/* Wizard progress */}
            <div className="px-4 pt-3.5">
              <div className="flex items-center gap-1.5">
                {['Token', 'WABA ID', 'Phone ID', 'Verify token'].map((label, i) => (
                  <div key={label} className="flex-1">
                    <div className="flex items-center gap-1.5">
                      <div className={cn('w-2 h-2 rounded-full transition-colors', i < setupStep ? 'bg-[#00A884]' : i === setupStep ? 'bg-primary animate-pulse' : 'bg-[#1F2C33]')} />
                      <span className={cn('text-[9px] uppercase tracking-wider font-semibold hidden sm:block', i === setupStep ? 'text-text-primary' : 'text-text-muted')}>{label}</span>
                    </div>
                    <div className="mt-1 h-1 rounded-full bg-[#1F2C33] overflow-hidden"><div className={cn('h-full bg-primary transition-all duration-300', i < setupStep ? 'w-full' : i === setupStep ? 'w-1/2' : 'w-0')} /></div>
                  </div>
                ))}
              </div>
            </div>
            <div className="p-4 pt-3">
              <div className="flex items-center gap-2">
                <ShieldCheck size={16} className="text-primary" />
                <div className="text-sm font-semibold text-text-primary">Enter your WhatsApp Business credentials</div>
              </div>
              <div className="text-[11px] text-text-muted mt-1">
                Found on <span className="text-text-secondary">developers.facebook.com → your app → WhatsApp → API Setup</span>. These stay on this server, stored obfuscated per workspace.
              </div>
            </div>
            <div className="px-4 pb-4 space-y-2.5">
              <label className="block" onFocus={() => setSetupStep(0)}>
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Permanent Access Token</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={form.accessToken}
                    onChange={e => setForm(f => ({ ...f, accessToken: e.target.value }))}
                    onFocus={() => setSetupStep(0)}
                    placeholder={statusUI.accessToken ? `${mask(statusUI.accessToken)} (keep to reuse)` : 'EAAG…'}
                    className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                  />
                  <button onClick={() => setShowSecrets(s => !s)} className="text-text-muted hover:text-text-primary"><Eye size={15} /></button>
                </div>
              </label>
              <label className="block" >
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">WABA ID</span>
                <input
                  value={form.wabaId}
                  onChange={e => setForm(f => ({ ...f, wabaId: e.target.value }))}
                  onFocus={() => setSetupStep(1)}
                  placeholder="Business Account ID, e.g. 104574124845174"
                  className="mt-1 w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Phone Number ID</span>
                <input
                  value={form.phoneNumberId}
                  onChange={e => setForm(f => ({ ...f, phoneNumberId: e.target.value }))}
                  onFocus={() => setSetupStep(2)}
                  placeholder="e.g. 143387273830930"
                  className="mt-1 w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">App Secret <span className="normal-case">(used to validate webhooks)</span></span>
                <input
                  type={showSecrets ? 'text' : 'password'}
                  value={form.appSecret}
                  onChange={e => setForm(f => ({ ...f, appSecret: e.target.value }))}
                  placeholder={statusUI.appSecret ? `${mask(statusUI.appSecret)} (keep to reuse)` : 'App secret'}
                  className="mt-1 w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                />
              </label>
              <label className="block">
                <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Webhook Verify Token</span>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type={showSecrets ? 'text' : 'password'}
                    value={form.verifyToken}
                    onChange={e => setForm(f => ({ ...f, verifyToken: e.target.value }))}
                    onFocus={() => setSetupStep(3)}
                    placeholder={statusUI.verifyToken ? `${mask(statusUI.verifyToken)} (keep to reuse)` : 'Pick a secret string'}
                    className="flex-1 bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary font-mono"
                  />
                  <button onClick={() => setShowSecrets(s => !s)} className="text-text-muted hover:text-text-primary"><Eye size={15} /></button>
                </div>
                <div className="mt-1 text-[10px] text-text-muted">{VERIFY_HINT}</div>
              </label>

              <div className="rounded-lg bg-surface border border-border p-2.5">
                <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium flex items-center gap-1"><Globe size={10} /> Your webhook callback URL</div>
                <div className="mt-1 flex items-center gap-1.5">
                  <code className="flex-1 text-[10px] text-text-secondary break-all">{webhookUrl}</code>
                  <button onClick={() => copy(webhookUrl, 'hook')} className="text-text-muted hover:text-primary transition-colors shrink-0">
                    {copied === 'hook' ? <Check size={13} className="text-success" /> : <Copy size={13} />}
                  </button>
                </div>
                <div className="mt-1 text-[10px] text-text-muted">Put this in Meta's webhook settings with the verify token above, and subscribe to <code className="text-text-secondary">messages</code>.</div>
              </div>

              <div className="flex items-center gap-2 pt-1">
                <Button variant="default" size="sm" onClick={handleConnect} disabled={busy}>
                  {busy ? <Loader2 size={13} className="animate-spin" /> : <Link2 size={13} />} Connect & verify
                </Button>
                {statusUI.status === 'connected' ? (
                  <Button variant="outline" size="sm" onClick={() => setMode('view')}>Cancel</Button>
                ) : null}
              </div>
            </div>
          </div>
        )}

        {confirmDisconnect && (
          <div className="rounded-2xl border border-error/30 bg-error/5 p-4 space-y-3">
            <div className="text-xs font-semibold text-error">Disconnect the connector?</div>
            <div className="text-[11px] text-text-secondary">Your local templates, campaigns and drafts stay in this workspace. You just won't be able to send or receive via Meta until you reconnect.</div>
            <div className="flex gap-2">
              <Button variant="destructive" size="sm" onClick={handleDisconnect} disabled={busy}>
                {busy ? <Loader2 size={13} className="animate-spin" /> : <Unplug size={13} />} Disconnect
              </Button>
              <Button variant="outline" size="sm" onClick={() => setConfirmDisconnect(false)}>Cancel</Button>
            </div>
          </div>
        )}
      </div>
    </MetaPanel>
  );
};

const InfoTile = ({ label, value, mono = false }) => (
  <div className="rounded-xl bg-surface border border-border p-2.5">
    <div className="text-[10px] uppercase tracking-wider text-text-muted font-medium">{label}</div>
    <div className={cn('mt-1 text-sm font-semibold text-text-primary', mono && 'font-mono text-xs')}>{value}</div>
  </div>
);

export default MetaConnection;