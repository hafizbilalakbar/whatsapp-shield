import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FileText, Sparkles, RefreshCw, Plus, Send, ShieldCheck, AlertTriangle,
  Info, History, Loader2, Wand2, ChevronRight, Pencil,
  X, Save, ArrowLeft,
} from 'lucide-react';
import { cn } from '../../../components/ui/cn';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import MetaPanel from './MetaPanel';
import { metaApi } from './metaApi';
import WhatsAppTemplatePreview from './WhatsAppTemplatePreview';
import {
  TEMPLATE_STATUS, TEMPLATE_STATUS_VARIANT, TEMPLATE_CATEGORIES,
  templateToComponents, templateBodyText, toNormalized, templateVariables,
} from './MetaConstants';

const emptyTemplate = () => ({
  name: '',
  category: 'MARKETING',
  language: 'en',
  headerType: 'TEXT',
  headerText: '',
  body: '',
  footerText: '',
  buttons: [],
  status: 'DRAFT',
});

const statusFilter = (t, tab) => {
  if (tab === 'ALL') return true;
  if (tab === 'APPROVED') return t.status === 'APPROVED';
  if (tab === 'PENDING') return ['PENDING', 'IN_APPEAL'].includes(t.status);
  if (tab === 'DRAFT') return t.status === 'DRAFT' || !t.status;
  return t.status === tab;
};

const ComplianceReport = ({ report, compact = false }) => {
  if (!report) return null;
  const issues = (Array.isArray(report.issues) ? report.issues : []).filter(Boolean);
  const blocks = issues.filter(i => i.severity === 'block');
  const level = report.level || (blocks.length ? 'NEEDS_REVISION' : issues.length ? 'WARNING' : 'COMPLIANT');

  if (issues.length === 0 && !compact) {
    return (
      <div className="rounded-xl border border-success/30 bg-success/5 p-3 flex items-start gap-2">
        <ShieldCheck size={16} className="text-success shrink-0 mt-0.5" />
        <div>
          <div className="text-xs font-semibold text-success">Meta policy compliant</div>
          <div className="text-[11px] text-text-muted">Local policy review passed. Meta still performs its own review on submission — this is guidance, not a guarantee of approval.</div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('rounded-xl border p-3 space-y-1.5', level === 'NEEDS_REVISION' ? 'border-error/40 bg-error/5' : 'border-warning/40 bg-warning/5')}>
      <div className="flex items-center gap-2">
        {level === 'NEEDS_REVISION'
          ? <AlertTriangle size={15} className="text-error shrink-0" />
          : <Info size={15} className="text-warning shrink-0" />}
        <span className={cn('text-xs font-semibold', level === 'NEEDS_REVISION' ? 'text-error' : 'text-warning')}>
          {level === 'NEEDS_REVISION' ? 'Needs revision before submission' : 'Potential policy warning'}
        </span>
      </div>
      {issues.map((issue, i) => (
        <div key={i} className="ml-6 text-[11px] text-text-secondary flex items-start gap-1.5">
          <span className={cn('mt-0.5 w-1.5 h-1.5 rounded-full shrink-0', issue.severity === 'block' ? 'bg-error' : 'bg-warning')} />
          <div className="min-w-0">
            {issue.message}
            {issue.suggestions?.length ? (
              <span className="text-text-muted"> — try: {issue.suggestions.join(' ')}</span>
            ) : null}
          </div>
        </div>
      ))}
    </div>
  );
};

const TemplateEditor = ({ template, saved, onSaved, onClose }) => {
  const [n, setN] = useState(() => template ? toNormalized(template) || emptyTemplate() : emptyTemplate());
  const [compliance, setCompliance] = useState(null);
  const [previewValues, setPreviewValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [previewMode, setPreviewMode] = useState(false);
  const [savedId, setSavedId] = useState(template?.id || saved?.id || '');

  const previewStub = useMemo(() => ({ ...n, components: templateToComponents(n) }), [n]);

  const runCompliance = useCallback(async () => {
    try {
      const res = await metaApi.compliance({ template: n });
      setCompliance(res);
      return res;
    } catch (e) { setError(e.message); return null; }
  }, [n]);

  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9_]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 30);

  const payload = (withId) => {
    const p = {
      name: n.name || slug(n.category),
      category: n.category,
      language: n.language,
      headerType: n.headerType,
      headerText: n.headerType === 'TEXT' ? n.headerText : '',
      body: n.body,
      footerText: n.footerText,
      buttons: (n.buttons || []).filter(b => b.text || b.url || b.phoneNumber),
      exampleValues: { ...(n.exampleValues || {}), ...previewValues },
    };
    return withId ? p : { ...p, components: templateToComponents(p) };
  };

  const handleSave = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = savedId
        ? await metaApi.updateTemplate(savedId, payload())
        : await metaApi.saveTemplate(payload());
      if (res.success) {
        if (res.template) { setSavedId(res.template.id || savedId); setN(prev => ({ ...prev, id: res.template.id || prev.id })); }
        setNotice('Draft saved locally.');
        if (onSaved) onSaved(savedId || res.template);
      } else {
        setError(res.error || 'Save failed');
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const handleSubmit = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = await runCompliance();
      if (!res) { setBusy(false); return; }
      const blocks = (res.issues || []).filter(i => i.severity === 'block');
      if (blocks.length) {
        setError(`Fix ${blocks.length} blocking policy issue${blocks.length > 1 ? 's' : ''} before submitting to Meta.`);
        setBusy(false);
        return;
      }
      if (!n.name) { setError('Template name is required.'); setBusy(false); return; }
      if (!n.body) { setError('A message body is required.'); setBusy(false); return; }

      let submitId = savedId;
      if (!submitId) {
        const res2 = await metaApi.saveTemplate(payload());
        if (res2?.success && res2?.template?.id) {
          submitId = res2.template.id;
          setSavedId(submitId);
          setN(prev => ({ ...prev, id: submitId }));
        } else {
          setError((res2 && res2.error) || 'Could not save the draft before submitting.');
          setBusy(false);
          return;
        }
      }

      const submission = await metaApi.submitTemplate(submitId);
      if (submission.success) {
        setNotice('Submitted to Meta for review. It can take from minutes to a few days depending on the category.');
        if (submission.template) {
          setN(prev => ({ ...prev, id: submission.template.id, status: submission.template.status, metaId: submission.template.metaId, metaError: submission.template.metaError }));
          setSavedId(submission.template.id);
        }
        if (onSaved) onSaved(savedId);
      } else {
        setError(submission.error || 'Meta rejected the submission.');
        if (submission.compliance) setCompliance(submission.compliance);
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const setBtn = (i, patch) => {
    setN(prev => ({
      ...prev,
      buttons: (prev.buttons || []).map((b, j) => (j === i ? { ...b, ...patch } : b)),
    }));
  };

  const input = 'mt-1 w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary';
  const label = 'text-[10px] uppercase tracking-wider text-text-muted font-medium';

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
        <button onClick={() => { setPreviewMode(false); onClose(); }} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors">
          <ArrowLeft size={14} /> Back</button>
        <div className="flex-1" />
        <button
          onClick={() => { setPreviewMode(p => !p); runCompliance(); }}
          className={cn('h-7 px-2.5 rounded-lg border text-[11px] font-medium transition-colors flex items-center gap-1.5',
            previewMode ? 'border-primary/40 text-primary bg-primary/10' : 'border-border text-text-secondary hover:text-text-primary')}
          title="WhatsApp preview + policy report"
        >
          {previewMode ? <ShieldCheck size={13} /> : <Wand2 size={13} />} {previewMode ? 'Editor' : 'Preview & Policy'}
        </button>
        {!previewMode && (
          <button onClick={handleSave} disabled={busy} className="h-7 px-2.5 rounded-lg border border-border text-[11px] font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />} Save draft
          </button>
        )}
        {!previewMode && (
          <button onClick={handleSubmit} disabled={busy} className="h-7 px-3 rounded-lg bg-[#00A884] text-white text-[11px] font-semibold flex items-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-50">
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Submit to Meta
          </button>
        )}
      </div>

      {error && (
        <div className="mx-3 mt-2 rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error shrink-0">{error}</div>
      )}
      {notice && (
        <div className="mx-3 mt-2 rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-[11px] text-success shrink-0">{notice}</div>
      )}

      <div className="flex-1 overflow-y-auto">
        {previewMode ? (
          <div className="p-4 grid md:grid-cols-2 gap-6 max-w-3xl mx-auto">
            <div>
              <ComplianceReport report={compliance} />
              {n.id || savedId ? (
                <div className="mt-2 rounded-lg bg-surface border border-border px-3 py-2 text-[11px] text-text-muted">
                  A new submission creates a NEW template on Meta and restarts review. Keep the approved one until the new one is confirmed.
                </div>
              ) : null}
              <button onClick={runCompliance} className="mt-2 h-7 px-2.5 rounded-lg border border-border text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors">
                <RefreshCw size={12} /> Re-check policy
              </button>
            </div>
            <div>
              <div className="mb-2 text-[11px] font-medium text-text-muted uppercase tracking-wider text-center">Customer preview</div>
              <WhatsAppTemplatePreview template={previewStub} values={previewValues} />
              {templateVariables(n).length > 0 && (
                <div className="mt-3 space-y-2">
                  <div className="text-[11px] text-text-muted">{'Preview values for variables ({{1}}, {{2}}…)'}</div>
                  {templateVariables(n).map(num => (
                    <div key={num} className="flex items-center gap-2">
                      <span className="text-[10px] bg-surface px-1.5 py-0.5 rounded border border-border font-mono">{`{{${num}}}`}</span>
                      <input
                        value={previewValues[num] || ''}
                        onChange={e => setPreviewValues(v => ({ ...v, [num]: e.target.value }))}
                        placeholder="Sample value"
                        className="flex-1 bg-surface border border-border rounded-lg px-2 py-1 text-[11px] text-text-primary focus:outline-none focus:border-primary"
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="p-4 space-y-3 max-w-3xl mx-auto">
            <div className="grid sm:grid-cols-3 gap-2">
              <label className="block">
                <span className={label}>Template name</span>
                <input className={cn(input, 'font-mono')} value={n.name}
                  onChange={e => setN(prev => ({ ...prev, name: slug(e.target.value) || e.target.value }))}
                  placeholder="e.g. order_shipped" />
              </label>
              <label className="block">
                <span className={label}>Category</span>
                <select className={input} value={n.category} onChange={e => setN(prev => ({ ...prev, category: e.target.value }))}>
                  {TEMPLATE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
                </select>
              </label>
              <label className="block">
                <span className={label}>Language</span>
                <input className={input} value={n.language}
                  onChange={e => setN(prev => ({ ...prev, language: e.target.value }))}
                  placeholder="en" />
              </label>
            </div>

            {TEMPLATE_CATEGORIES.find(c => c.value === n.category) && (
              <div className="text-[11px] text-text-muted">{TEMPLATE_CATEGORIES.find(c => c.value === n.category).tone}</div>
            )}

            <div>
              <span className={label}>Header (optional)</span>
              <div className="mt-1 flex items-center gap-2 flex-wrap">
                <select className={cn(input, 'sm:w-40')} value={n.headerType || 'TEXT'}
                  onChange={e => setN(prev => ({ ...prev, headerType: e.target.value }))}>
                  <option value="TEXT">Text (max 60 chars)</option>
                  <option value="none">None</option>
                  <option value="IMAGE">Image</option>
                  <option value="VIDEO">Video</option>
                  <option value="DOCUMENT">Document</option>
                  <option value="LOCATION">Location</option>
                </select>
                {n.headerType === 'TEXT' && (
                  <input className={cn(input, 'flex-1 min-w-[160px]')} maxLength={60} value={n.headerText || ''}
                    onChange={e => setN(prev => ({ ...prev, headerText: e.target.value }))}
                    placeholder="e.g. Your order is on the way" />
                )}
              </div>
              {n.headerType && n.headerType !== 'TEXT' && n.headerType !== 'none' && (
                <div className="mt-1 text-[11px] text-text-muted">
                  {n.headerType} media previews after Meta approval (media must be hosted at a public https URL on submission).
                </div>
              )}
            </div>

            <div>
              <span className={label}>Body (required)</span>
              <textarea rows={4} maxLength={1024} className={cn(input, 'resize-y font-mono')} value={n.body || ''}
                onChange={e => setN(prev => ({ ...prev, body: e.target.value }))}
                placeholder="Hi {{1}}, your order #{{2}} has shipped and arrives {{3}}…" />
              <div className="text-[10px] text-text-muted">{'Variables use sequential numbers {{1}}, {{2}}, {{3}}… Fill sample values on the preview tab.'}</div>
            </div>

            <div>
              <span className={label}>Footer (optional, max 60 chars)</span>
              <input className={input} maxLength={60} value={n.footerText || ''}
                onChange={e => setN(prev => ({ ...prev, footerText: e.target.value }))}
                placeholder="e.g. Reply STOP to opt out" />
            </div>

            <div>
              <span className={label}>Buttons (optional)</span>
              <div className="mt-1 space-y-1.5">
                {(n.buttons || []).map((b, i) => (
                  <div key={i} className="flex items-center gap-2 flex-wrap">
                    <select
                      className="bg-surface border border-border rounded-lg px-2 py-1.5 text-[11px] text-text-primary focus:outline-none focus:border-primary"
                      value={b.type || 'QUICK_REPLY'}
                      onChange={e => setBtn(i, { type: e.target.value, url: e.target.value === 'URL' ? '' : undefined, phoneNumber: e.target.value === 'PHONE_NUMBER' ? '' : undefined })}
                    >
                      <option value="QUICK_REPLY">Quick reply</option>
                      <option value="URL">URL</option>
                      <option value="PHONE_NUMBER">Phone number</option>
                    </select>
                    <input className={cn(input, 'flex-1 min-w-[140px]')} maxLength={25} value={b.text || ''}
                      onChange={e => setBtn(i, { text: e.target.value })} placeholder="Button label (max 25 chars)" />
                    {b.type === 'URL' && (
                      <input className={cn(input, 'flex-1 min-w-[160px]')} value={b.url || ''}
                        onChange={e => setBtn(i, { url: e.target.value })} placeholder="https://…" />
                    )}
                    {b.type === 'PHONE_NUMBER' && (
                      <input className={cn(input, 'flex-1 min-w-[140px]')} value={b.phoneNumber || b.phone_number || ''}
                        onChange={e => setBtn(i, { phoneNumber: e.target.value })} placeholder="+15551234567" />
                    )}
                    <button onClick={() => setN(prev => ({ ...prev, buttons: (prev.buttons || []).filter((_, j) => j !== i) }))}
                      className="p-1.5 text-text-muted hover:text-error transition-colors" title="Remove button">
                      <X size={14} />
                    </button>
                  </div>
                ))}
                {(n.buttons || []).length < 10 && (
                  <button
                    onClick={() => setN(prev => ({ ...prev, buttons: [...(prev.buttons || []), { type: 'QUICK_REPLY', text: '' }] }))}
                    className="h-7 px-2.5 rounded-lg border border-dashed border-border text-[11px] text-text-muted hover:text-text-primary hover:border-primary transition-colors flex items-center gap-1.5"
                  >
                    <Plus size={12} /> Add button
                  </button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

const TemplateRow = ({ t, onEdit }) => {
  const body = templateBodyText(t);
  const vars = templateVariables(t).length;
  return (
    <button
      onClick={() => onEdit(t)}
      className="w-full text-left bg-surface border border-border rounded-xl p-3 hover:border-primary/40 transition-colors group"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-semibold text-text-primary">{t.name}</span>
            <Badge variant={TEMPLATE_STATUS_VARIANT[t.status] || 'outline'} className="text-[9px]">{TEMPLATE_STATUS[t.status] || t.status}</Badge>
          </div>
          <div className="mt-1 text-[11px] text-text-muted line-clamp-2 whitespace-pre-wrap break-words">{body || 'No body'}</div>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {t.compliance && (
            <span title={t.compliance.level}>
              {t.compliance.level === 'COMPLIANT' ? <ShieldCheck size={14} className="text-success" /> : <AlertTriangle size={14} className="text-warning" />}
            </span>
          )}
          <ChevronRight size={14} className="text-text-muted transition-transform group-hover:translate-x-0.5" />
        </div>
      </div>
      <div className="mt-1.5 flex items-center gap-2 text-[10px] text-text-muted">
        <span className="uppercase">{t.category}</span>
        {vars > 0 && <span>{vars} variable{vars > 1 ? 's' : ''}</span>}
        <span className="ml-auto">{String(t.updatedAt || t.createdAt || '').slice(0, 10)}</span>
      </div>
    </button>
  );
};

const MessageTemplates = ({ isOpen, onClose, embedded = false }) => {
  const [tab, setTab] = useState('ALL');
  const [templates, setTemplates] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [showHistory, setShowHistory] = useState(false);
  const [genOpen, setGenOpen] = useState(false);
  const [genPrompt, setGenPrompt] = useState('');
  const [genPurpose, setGenPurpose] = useState('MARKETING');
  const [genBusy, setGenBusy] = useState(false);
  const [genError, setGenError] = useState('');
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await metaApi.templates();
      setTemplates(res.templates || []);
      const h = await metaApi.templateHistory();
      setHistory(h.history || []);
      setError('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { if (embedded || isOpen) load(); }, [embedded, isOpen, load]);

  const filtered = useMemo(() => templates.filter(t => statusFilter(t, tab)), [templates, tab]);
  const byStatus = useMemo(() => {
    const m = {};
    templates.forEach(t => { m[t.status] = (m[t.status] || 0) + 1; });
    return m;
  }, [templates]);

  const handleSync = async () => {
    setSyncing(true); setError('');
    try { const res = await metaApi.syncTemplates(); if (res.success) { await load(); } else setError(res.error || 'Sync failed'); }
    catch (e) { setError(e.message); }
    setSyncing(false);
  };

  const handleGen = async () => {
    setGenBusy(true); setGenError('');
    try {
      const res = await metaApi.generateTemplate({ prompt: genPrompt, purpose: genPurpose, businessProfile: {} });
      if (res.success) {
        if (res.saved) await load();
        setEditing(res.template || (res.saved?.template));
        if (res.compliance) setShowHistory(false);
        setGenOpen(false);
        setGenPrompt('');
      } else {
        setGenError(res.error || 'Generation failed — check your AI provider settings.');
      }
    } catch (e) { setGenError(e.message); }
    setGenBusy(false);
  };

  return (
    <MetaPanel
      isOpen={isOpen} onClose={onClose} embedded={embedded}
      title="Message Templates"
      subtitle="Official Meta WhatsApp Business templates — AI generated, policy-checked, submitted to Meta for approval."
      icon={<FileText size={16} className="text-primary" />}
      widthClass="max-w-6xl"
    >
      {!editing ? (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            <div className="flex items-center gap-1 overflow-x-auto">
              {['ALL', 'APPROVED', 'PENDING', 'DRAFT', 'REJECTED'].map(k => (
                <button
                  key={k}
                  onClick={() => setTab(k)}
                  className={cn('px-2.5 py-1 rounded-lg text-[11px] font-medium whitespace-nowrap transition-colors',
                    tab === k ? 'bg-[#00A884]/15 text-[#00A884]' : 'text-text-muted hover:text-text-primary')}
                >
                  {k === 'ALL' ? 'All' : TEMPLATE_STATUS[k] || k}
                  {byStatus[k] ? <span className="ml-1 text-[9px] bg-surface/80 px-1 py-0.5 rounded border border-border">{byStatus[k]}</span> : null}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <button onClick={() => setShowHistory(!showHistory)} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors">
              <History size={13} /> {showHistory ? 'Templates' : 'History'}
            </button>
            <button onClick={handleSync} disabled={syncing} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors disabled:opacity-50">
              {syncing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Sync from Meta
            </button>
            <button onClick={() => setEditing(emptyTemplate())} className="h-7 px-2.5 rounded-lg border border-border text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors">
              <Pencil size={13} /> New
            </button>
            <button onClick={() => setGenOpen(true)} className="h-7 px-3 rounded-lg bg-[#00A884]/15 text-[#00A884] text-[11px] font-semibold flex items-center gap-1.5 transition-colors hover:bg-[#00A884]/25">
              <Wand2 size={13} /> Generate with AI
            </button>
          </div>

          {error && <div className="mx-3 mt-2 rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error shrink-0">{error}</div>}

          <div className="flex-1 overflow-y-auto p-3">
            {!showHistory ? (
              loading ? (
                <div className="text-center py-10 text-xs text-text-muted">Loading templates…</div>
              ) : filtered.length === 0 ? (
                <div className="text-center py-12 space-y-3">
                  <div className="text-xs text-text-muted">{templates.length === 0 ? 'No templates yet. Generate one with AI, or create a draft.' : 'No templates in this view.'}</div>
                  <Button variant="outline" size="sm" onClick={() => setGenOpen(true)}><Wand2 size={14} /> Generate with AI</Button>
                </div>
              ) : (
                <div className="grid gap-2">
                  {filtered.map(t => <TemplateRow key={t.id} t={t} onEdit={(tpl) => setEditing(tpl)} />)}
                </div>
              )
            ) : (
              <div className="space-y-1.5 max-w-3xl mx-auto">
                {history.length === 0 ? (
                  <div className="text-center py-10 text-xs text-text-muted">No submission history yet.</div>
                ) : history.map((h, i) => (
                  <div key={i} className="bg-surface border border-border rounded-xl p-3">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-semibold text-text-primary">{h.name}</span>
                      <Badge variant={TEMPLATE_STATUS_VARIANT[h.status] || 'outline'} className="text-[9px]">{TEMPLATE_STATUS[h.status] || h.status}</Badge>
                      <span className="text-[10px] text-text-muted ml-auto">{String(h.at || '').slice(0, 16)}</span>
                    </div>
                    <div className="mt-0.5 text-[10px] text-text-muted">
                      {h.action === 'create' ? 'Submitted new template' : h.action === 'update' ? 'Submitted an update' : h.action} {h.message ? `— ${h.message}` : ''}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <TemplateEditor
          template={editing}
          saved={editing}
          onSaved={(idOrObj) => { if (idOrObj) { load(); } }}
          onClose={() => { setEditing(null); load(); }}
        />
      )}

      {genOpen && (
        <div className="fixed inset-0 z-[70] bg-background/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-lg bg-surface border border-border rounded-2xl p-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-primary" />
                <span className="text-sm font-semibold text-text-primary">Generate with AI</span>
              </div>
              <button onClick={() => setGenOpen(false)} className="p-1.5 rounded-lg hover:bg-surface transition-colors"><X size={14} className="text-text-muted" /></button>
            </div>
            <div className="mt-3 space-y-2">
              <div className="text-[11px] text-text-muted">{'The AI writes a Meta-policy-aware template, checks it against the policy engine, and pre-fills variables as {{1}}, {{2}}…'}</div>
              <select
                value={genPurpose}
                onChange={e => setGenPurpose(e.target.value)}
                className="w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary"
              >
                {TEMPLATE_CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label} — {c.tone}</option>)}
              </select>
              <textarea
                value={genPrompt}
                onChange={e => setGenPrompt(e.target.value)}
                rows={4}
                placeholder="e.g. Order shipped confirmation with customer name, order number and tracking link. Friendly tone, include an opt-out hint in the footer."
                className="w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary resize-y"
              />
              {genError && <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error">{genError}</div>}
              <Button variant="default" size="sm" className="w-full" onClick={handleGen} disabled={genBusy || !genPrompt.trim()}>
                {genBusy ? <Loader2 size={14} className="animate-spin" /> : <Sparkles size={14} />} Generate template
              </Button>
            </div>
          </div>
        </div>
      )}
    </MetaPanel>
  );
};

export default MessageTemplates;