import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Plus, Check, CheckCircle2, XCircle, Eye, EyeOff, Search, RefreshCw,
  ArrowUp, ArrowDown, ChevronDown, ChevronLeft, ChevronRight, Shield, Lock,
  Activity, BarChart3, Cpu, Zap, PlugZap, Trash2, PencilLine, Gauge, GitBranch,
  Key, Settings, Link2, AlertCircle
} from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { ProviderLogo } from '../../components/ui/ProviderLogo';
import { useMessageAgent } from '../MessageAgentPage';

/* ------------------------------ helpers ------------------------------ */

const formatNumber = (n) => {
  if (n == null) return '—';
  if (n >= 1000000) return (n / 1000000).toFixed(1) + 'M';
  if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
  return String(n);
};

const formatMs = (ms) => {
  if (ms == null || ms === 0) return '—';
  if (ms < 1000) return Math.round(ms) + 'ms';
  return (ms / 1000).toFixed(1) + 's';
};

const STATUS_META = {
  connected:         { label: 'Connected',  cls: 'text-success', bg: 'bg-success/10',       dot: 'bg-success' },
  connection_failed: { label: 'Failed',     cls: 'text-error',   bg: 'bg-error/10',         dot: 'bg-error' },
  configuring:       { label: 'Validating', cls: 'text-warning', bg: 'bg-warning/10',       dot: 'bg-warning animate-pulse' },
  configured:        { label: 'Configured', cls: 'text-secondary', bg: 'bg-secondary/10',   dot: 'bg-secondary' },
  disabled:          { label: 'Disabled',   cls: 'text-text-muted', bg: 'bg-surface',       dot: 'bg-text-muted' },
};

const ProviderStatusBadge = ({ status }) => {
  const meta = STATUS_META[status] || STATUS_META.configured;
  return (
    <span className={cn('inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[10px] font-semibold', meta.bg, meta.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  );
};

const TIER_META = {
  frontier:  { label: 'Frontier',  cls: 'bg-primary/10 text-primary' },
  premium:   { label: 'Premium',   cls: 'bg-secondary/10 text-secondary' },
  balanced:  { label: 'Balanced',  cls: 'bg-warning/10 text-warning' },
  fast:      { label: 'Fast',      cls: 'bg-success/10 text-success' },
};

const TierBadge = ({ tier }) => {
  const meta = TIER_META[tier];
  if (!meta) return null;
  return (
    <span className={cn('shrink-0 inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide', meta.cls)}>
      {meta.label}
    </span>
  );
};

const HEALTH_META = {
  healthy: { label: 'Healthy', cls: 'text-success' },
  warning: { label: 'Degraded', cls: 'text-warning' },
  error:   { label: 'Unhealthy', cls: 'text-error' },
};

const HealthBadge = ({ health }) => {
  const meta = HEALTH_META[health];
  if (!meta) return null;
  return (
    <span className={cn('inline-flex items-center gap-1 text-[10px] font-semibold', meta.cls)}>
      <span className={cn('w-1.5 h-1.5 rounded-full', health === 'healthy' ? 'bg-success' : health === 'warning' ? 'bg-warning' : 'bg-error')} />
      {meta.label}
    </span>
  );
};

const Field = ({ label, required, hint, children }) => (
  <div>
    <div className="flex items-center justify-between mb-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
        {label}{required && <span className="text-error ml-0.5">*</span>}
      </label>
      {hint && <span className="text-[10px] text-text-muted">{hint}</span>}
    </div>
    {children}
  </div>
);

const SecretInput = ({ value, onChange, placeholder, invalid }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        value={value}
        onChange={onChange}
        type={show ? 'text' : 'password'}
        placeholder={placeholder}
        autoComplete="new-password"
        spellCheck={false}
        className={cn(
          'pr-9 font-mono text-xs',
          invalid && 'border-error/60 focus-visible:ring-error/40'
        )}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-md text-text-muted hover:text-text-primary transition-colors"
        tabIndex={-1}
        aria-label={show ? 'Hide API key' : 'Show API key'}
      >
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
};

/* ------------------------- searchable dropdowns ------------------------- */

const DropdownShell = ({ open, setOpen, buttonContent, children, className, buttonClassName }) => (
  <div className="relative">
    <button
      type="button"
      onClick={() => setOpen(o => !o)}
      className={cn(
        'flex w-full items-center justify-between gap-2 h-9 rounded-md border border-border bg-transparent px-3 py-1 text-sm shadow-sm transition-colors hover:border-primary/40 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary',
        buttonClassName
      )}
    >
      {buttonContent}
    </button>
    {open && (
      <>
        <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
        <div className={cn('absolute z-50 mt-1.5 w-full min-w-[220px] overflow-hidden rounded-xl border border-border bg-surface shadow-xl shadow-black/10', className)}>
          {children}
        </div>
      </>
    )}
  </div>
);

const ModelSelect = ({ models, value, onChange, placeholder = 'Select a model…' }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const items = useMemo(
    () => (models || []).map(m => (typeof m === 'string' ? { id: m, label: m, tier: null } : { id: m.id, label: m.label || m.name || m.id, tier: m.tier || null })),
    [models]
  );
  const selected = items.find(m => m.id === value);
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(m => m.label.toLowerCase().includes(q) || m.id.toLowerCase().includes(q));
  }, [items, query]);

  return (
    <DropdownShell
      open={open}
      setOpen={setOpen}
      buttonContent={
        <>
          <span className={cn('truncate font-mono text-xs', selected ? 'text-text-primary' : 'text-text-muted')}>
            {selected ? selected.label : placeholder}
          </span>
          <ChevronDown size={13} className={cn('shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
        </>
      }
    >
      <div className="relative p-1.5 border-b border-border/60">
        <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search models…"
          className="pl-7 h-7 text-xs font-mono"
        />
      </div>
      <div className="max-h-52 overflow-y-auto p-1.5">
        {list.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] text-text-muted">No models match your search</p>
        )}
        {list.map(m => (
          <button
            key={m.id}
            type="button"
            onClick={() => { onChange(m.id); setOpen(false); setQuery(''); }}
            className={cn(
              'w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors',
              m.id === value ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface'
            )}
          >
            <span className="truncate font-mono">{m.label}</span>
            {m.tier && <TierBadge tier={m.tier} />}
          </button>
        ))}
      </div>
    </DropdownShell>
  );
};

const ProviderSelect = ({ providers, value, onChange }) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const list = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = providers || [];
    if (!q) return arr;
    return arr.filter(p => (p.name || p.provider || '').toLowerCase().includes(q));
  }, [providers, query]);
  const selected = list.find(p => p.id === value) || (providers || []).find(p => p.id === value) || null;

  return (
    <DropdownShell
      open={open}
      setOpen={setOpen}
      buttonContent={
        <>
          {selected ? (
            <span className="flex items-center gap-2 min-w-0">
              <ProviderLogo provider={selected.provider} size={18} />
              <span className="truncate text-xs font-medium text-text-primary">{selected.name || selected.provider}</span>
            </span>
          ) : (
            <span className="text-xs text-text-muted">Select provider…</span>
          )}
          <ChevronDown size={13} className={cn('shrink-0 text-text-muted transition-transform', open && 'rotate-180')} />
        </>
      }
    >
      <div className="relative p-1.5 border-b border-border/60">
        <Search size={12} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-text-muted" />
        <Input value={query} onChange={e => setQuery(e.target.value)} placeholder="Search providers…" className="pl-7 h-7 text-xs" />
      </div>
      <div className="max-h-52 overflow-y-auto p-1.5">
        {list.length === 0 && (
          <p className="px-2 py-4 text-center text-[11px] text-text-muted">No providers available</p>
        )}
        {list.map(p => (
          <button
            key={p.id}
            type="button"
            onClick={() => { onChange(p.id); setOpen(false); setQuery(''); }}
            className={cn(
              'w-full flex items-center gap-2.5 px-2.5 py-1.5 rounded-lg text-left text-xs transition-colors',
              p.id === value ? 'bg-primary/10 text-primary' : 'text-text-secondary hover:bg-surface'
            )}
          >
            <ProviderLogo provider={p.provider} size={18} />
            <span className="truncate font-medium flex-1">{p.name || p.provider}</span>
            <span className={cn('w-1.5 h-1.5 rounded-full shrink-0', p.enabled ? 'bg-success' : 'bg-text-muted')} />
          </button>
        ))}
      </div>
    </DropdownShell>
  );
};

/* ------------------------------ step indicator ------------------------------ */

const StepDot = ({ index, label, state }) => (
  <div className="flex items-center gap-1.5">
    <span className={cn(
      'w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold border transition-all',
      state === 'done' ? 'bg-primary border-primary text-white'
      : state === 'active' ? 'bg-primary/10 border-primary text-primary'
      : 'border-border text-text-muted'
    )}>
      {state === 'done' ? <Check size={10} /> : index}
    </span>
    <span className={cn(
      'text-[11px] font-medium',
      state === 'active' ? 'text-text-primary' : state === 'done' ? 'text-primary' : 'text-text-muted'
    )}>
      {label}
    </span>
  </div>
);

const StepsIndicator = ({ step }) => (
  <div className="flex items-center gap-1.5">
    <StepDot index="1" label="Provider" state={step === 'choose' ? 'active' : 'done'} />
    <span className="h-px w-6 bg-border" />
    <StepDot index="2" label="Configure" state={step === 'configure' ? 'active' : 'todo'} />
  </div>
);

/* ------------------------------ add provider step flow ------------------------------ */

const AddProviderModal = ({ isOpen, onClose, onAdded, catalog, existingIds, existingCount, maxProviders }) => {
  const [step, setStep] = useState('choose');
  const [providerId, setProviderId] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [model, setModel] = useState('');
  const [apiKey, setApiKey] = useState('');
  const [baseUrl, setBaseUrl] = useState('');
  const [azureResource, setAzureResource] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('');
  const [result, setResult] = useState(null);
  const [testing, setTesting] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [saved, setSaved] = useState(false);
  const [savedId, setSavedId] = useState('');

  const reset = () => {
    setStep('choose');
    setProviderId('');
    setSearchQuery('');
    setDisplayName('');
    setModel('');
    setApiKey('');
    setBaseUrl('');
    setAzureResource('');
    setAzureDeployment('');
    setResult(null);
    setTesting(false);
    setConnecting(false);
    setSaved(false);
    setSavedId('');
  };

  useEffect(() => {
    if (!isOpen) return;
    reset();
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen]);

  useEffect(() => {
    if (!providerId) return;
    const spec = catalog[providerId];
    setModel(spec?.models?.length ? spec.models[0].id || spec.models[0] : '');
    setDisplayName('');
    setApiKey('');
    setBaseUrl('');
    setAzureResource('');
    setAzureDeployment('');
    setResult(null);
    setSaved(false);
    setSavedId('');
  }, [providerId, catalog]);

  const spec = catalog[providerId];
  const slotsRemaining = (maxProviders || 13) - existingCount;

  const clearResult = () => setResult(null);

  const filteredCatalog = useMemo(() => {
    if (!catalog) return [];
    const entries = Object.entries(catalog);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter(([id, p]) =>
      id.toLowerCase().includes(q) ||
      (p.name || '').toLowerCase().includes(q) ||
      (p.description || '').toLowerCase().includes(q)
    );
  }, [catalog, searchQuery]);

  const needsBaseUrl = providerId === 'openai-compatible';
  const needsAzure = providerId === 'azure';
  const canSubmit = Boolean(
    providerId &&
    apiKey.trim() &&
    (!needsBaseUrl || baseUrl.trim()) &&
    (!needsAzure || (azureResource.trim() && azureDeployment.trim()))
  );

  const buildPayload = (extra = {}) => ({
    provider: providerId,
    apiKey: apiKey.trim(),
    name: displayName.trim() || spec?.name || providerId,
    model: needsAzure ? azureDeployment.trim() : model,
    priority: existingCount,
    baseUrl: baseUrl.trim() || undefined,
    azureResource: azureResource.trim() || undefined,
    azureDeployment: azureDeployment.trim() || undefined,
    ...extra,
  });

  const handleTest = async () => {
    setTesting(true);
    setResult(null);
    try {
      let res, data;
      if (savedId) {
        // Provider already saved — test the stored encrypted key on its record.
        res = await fetch(`/api/message-agent/ai-providers/${savedId}/test`, { method: 'POST' });
        data = await res.json().catch(() => null);
        if (res.ok && data?.success) {
          setResult({ type: 'success', message: 'Connection verified' });
        } else {
          setResult({ type: 'error', message: data?.error || 'Connection could not be verified' });
        }
      } else {
        res = await fetch('/api/message-agent/ai-providers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(buildPayload({ testOnly: true })),
        });
        data = await res.json();
        const v = data.validation;
        if (data.success && v && v.status === 'connected') {
          setResult({ type: 'success', message: v.model ? `Connection verified — ${v.model}` : 'Connection verified' });
        } else {
          setResult({ type: 'error', message: v?.error || data.error || 'Connection could not be verified' });
        }
      }
    } catch (err) {
      setResult({ type: 'error', message: err.message || 'Connection could not be verified' });
    }
    setTesting(false);
  };

  const handleConnect = async () => {
    if (savedId) return; // prevent duplicate provider records
    setConnecting(true);
    setResult(null);
    try {
      const res = await fetch('/api/message-agent/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(buildPayload()),
      });
      const data = await res.json();
      if (data.success) {
        const v = data.validation;
        setSaved(true);
        setSavedId(data.provider?.id || '');
        if (v?.status === 'connected') {
          setResult({ type: 'success', message: v?.model ? `Provider connected — ${v.model}` : 'Provider connected' });
          onAdded();
          setTimeout(() => { reset(); onClose(); }, 600);
        } else {
          setResult({
            type: 'error',
            message: `${v?.error || 'Connection failed'}. The provider was saved — retest below or manage it in Connected Providers.`,
          });
          onAdded();
        }
      } else {
        setResult({ type: 'error', message: data.error || 'Failed to add provider' });
      }
    } catch (err) {
      setResult({ type: 'error', message: err.message || 'Failed to add provider' });
    }
    setConnecting(false);
  };

  const closeAndReset = () => {
    reset();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-fade-up">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                {step === 'choose' ? <Plus size={15} className="text-primary" /> : <PlugZap size={15} className="text-primary" />}
              </div>
              <div className="min-w-0">
                <h2 className="text-sm sm:text-base font-display font-bold text-text-primary truncate">
                  {step === 'choose' ? 'Add AI Provider' : `Configure ${spec?.name || 'Provider'}`}
                </h2>
                <p className="text-[11px] text-text-secondary truncate">
                  {slotsRemaining} of {maxProviders || 13} provider slots remaining
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <StepsIndicator step={step} />
              <button onClick={closeAndReset} className="p-1.5 rounded-lg hover:bg-surface transition-colors" aria-label="Close">
                <X size={15} className="text-text-muted" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4">
          {step === 'choose' ? (
            <div key="choose" className="space-y-3 animate-fade-up">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search AI providers…"
                  className="pl-9 h-9 text-[13px]"
                  autoFocus
                />
              </div>

              {slotsRemaining <= 0 && (
                <div className="p-3 rounded-xl bg-warning/5 border border-warning/20 text-[11px] text-warning">
                  All provider slots are in use. Remove a provider to add another.
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {filteredCatalog.map(([id, p]) => {
                  const added = existingIds.has(id);
                  return (
                    <button
                      key={id}
                      type="button"
                      disabled={added || slotsRemaining <= 0}
                      onClick={() => { setProviderId(id); setStep('configure'); }}
                      className={cn(
                        'group text-left p-3 rounded-xl border transition-all duration-150',
                        added || slotsRemaining <= 0
                          ? 'opacity-50 cursor-not-allowed border-border bg-background'
                          : 'border-border bg-background hover:border-primary/40 hover:bg-primary/5 hover:shadow-sm'
                      )}
                    >
                      <div className="flex items-center gap-2.5">
                        <ProviderLogo provider={id} size={36} className="group-hover:scale-105 transition-transform" />
                        <div className="min-w-0 flex-1">
                          <p className="flex items-center gap-1.5 text-xs font-semibold text-text-primary truncate">
                            {p.name || id}
                            {added && <Badge variant="success" className="px-1.5 py-0 text-[9px]">Added</Badge>}
                          </p>
                          <p className="text-[10px] text-text-muted">
                            {p.models?.length ? `${p.models.length} models` : 'Custom endpoint'}
                            {p.pricing ? ` · ${p.pricing}` : ''}
                          </p>
                        </div>
                        <ChevronRight size={13} className="shrink-0 text-text-muted opacity-40 -translate-x-0.5 group-hover:translate-x-0 group-hover:opacity-100 transition-all" />
                      </div>
                      {p.description && (
                        <p className="mt-2 text-[10px] leading-relaxed text-text-secondary line-clamp-2">{p.description}</p>
                      )}
                    </button>
                  );
                })}

                {filteredCatalog.length === 0 && (
                  <div className="col-span-full p-6 text-center">
                    <p className="text-xs text-text-muted">No providers match "{searchQuery}"</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div key="configure" className="space-y-4 animate-fade-up">
              <button
                type="button"
                onClick={() => { setStep('choose'); setProviderId(''); }}
                className="flex items-center gap-1 text-[11px] font-medium text-text-muted hover:text-text-primary transition-colors"
              >
                <ChevronLeft size={12} /> Choose provider
              </button>

              {/* Brand panel */}
              <div className="flex items-start gap-3 p-3 rounded-2xl bg-gradient-to-br from-primary/8 via-primary/2 to-transparent border border-primary/15">
                <ProviderLogo provider={providerId} size={44} />
                <div className="min-w-0">
                  <p className="text-sm font-bold text-text-primary">{spec?.name}</p>
                  <p className="text-[11px] leading-relaxed text-text-secondary">{spec?.description}</p>
                  <div className="flex flex-wrap items-center gap-1.5 mt-2">
                    {spec?.keyHint && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface border border-border font-mono text-[10px] text-text-secondary">
                        <Key size={9} className="text-text-muted" /> {spec.keyHint}
                      </span>
                    )}
                    {needsBaseUrl && (
                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-surface border border-border font-mono text-[10px] text-text-secondary">
                        <Link2 size={9} className="text-text-muted" /> custom base URL
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div className="space-y-3.5">
                <Field label="Display name" hint="Optional">
                  <Input
                    value={displayName}
                    onChange={e => { clearResult(); setDisplayName(e.target.value); }}
                    placeholder={spec?.name || providerId}
                    className="h-9 text-[13px]"
                  />
                </Field>

                <Field label="Model">
                  {!needsAzure && (spec?.models?.length ? (
                    <ModelSelect models={spec.models} value={model} onChange={id => { clearResult(); setModel(id); }} />
                  ) : (
                    <Input
                      value={model}
                      onChange={e => { clearResult(); setModel(e.target.value); }}
                      placeholder="Custom model ID (e.g. my-model-7b)"
                      className="h-9 text-xs font-mono"
                    />
                  ))}
                </Field>

                {needsBaseUrl && (
                  <Field label="Base URL" required>
                    <Input
                      value={baseUrl}
                      onChange={e => { clearResult(); setBaseUrl(e.target.value); }}
                      placeholder="https://your-endpoint.example.com/v1/chat/completions"
                      className="h-9 text-xs font-mono"
                    />
                    <p className="text-[10px] text-text-muted mt-1">Full endpoint compatible with the OpenAI chat-completions API</p>
                  </Field>
                )}

                {needsAzure && (
                  <>
                    <Field label="Azure resource name" required>
                      <Input
                        value={azureResource}
                        onChange={e => { clearResult(); setAzureResource(e.target.value); }}
                        placeholder="your-resource"
                        className="h-9 text-xs font-mono"
                      />
                    </Field>
                    <Field label="Deployment name" required>
                      <Input
                        value={azureDeployment}
                        onChange={e => { clearResult(); setAzureDeployment(e.target.value); }}
                        placeholder="gpt-5.4-mini"
                        className="h-9 text-xs font-mono"
                      />
                    </Field>
                  </>
                )}

                <Field label="API key" required hint="Starts with a convention for this provider">
                  <SecretInput
                    value={apiKey}
                    onChange={e => { clearResult(); setApiKey(e.target.value); }}
                    placeholder={spec?.keyPlaceholder || 'Paste your API key'}
                    invalid={result?.type === 'error'}
                  />
                </Field>

                <div className="flex items-start gap-2 p-2.5 rounded-xl bg-background border border-border">
                  <Lock size={12} className="mt-0.5 text-success shrink-0" />
                  <p className="text-[11px] leading-relaxed text-text-secondary">
                    Your API key is encrypted before storage and is never exposed to the frontend.
                  </p>
                </div>

                {result && (
                  <div className={cn(
                    'flex items-start gap-2 p-2.5 rounded-xl border text-[11px]',
                    result.type === 'success' ? 'bg-success/5 border-success/20 text-success' : 'bg-error/5 border-error/20 text-error'
                  )}>
                    {result.type === 'success'
                      ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" />
                      : <XCircle size={13} className="mt-0.5 shrink-0" />}
                    <div>
                      <p className="font-semibold">{result.type === 'success' ? 'Connection verified' : 'Connection failed'}</p>
                      <p className="mt-0.5 opacity-80 leading-relaxed">{result.message}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border shrink-0">
          {step === 'choose' ? (
            <div className="flex items-center justify-end gap-2">
              <Button variant="outline" size="sm" onClick={closeAndReset}>Cancel</Button>
            </div>
          ) : (
            <div className="flex flex-col-reverse sm:flex-row items-stretch sm:items-center gap-2">
              <Button variant="outline" size="sm" onClick={closeAndReset}>Cancel</Button>
              {saved ? (
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    loading={testing}
                    disabled={!savedId}
                    className="flex-1 sm:flex-none"
                  >
                    <PlugZap size={12} className="mr-1 text-secondary" /> Retest Connection
                  </Button>
                  <Button size="sm" onClick={closeAndReset} className="flex-1 sm:flex-none bg-primary text-white">
                    <Check size={12} className="mr-1" /> Done
                  </Button>
                </div>
              ) : (
                <div className="flex gap-2 flex-1 sm:flex-none">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleTest}
                    loading={testing}
                    disabled={!canSubmit || connecting || result?.type === 'success'}
                    className="flex-1 sm:flex-none"
                  >
                    <PlugZap size={12} className="mr-1 text-secondary" /> Test Connection
                  </Button>
                  <Button
                    size="sm"
                    onClick={handleConnect}
                    loading={connecting}
                    disabled={!canSubmit || testing || result?.type === 'success'}
                    className="flex-1 sm:flex-none bg-primary text-white"
                  >
                    {result?.type === 'success'
                      ? <><Check size={12} className="mr-1" /> Connected</>
                      : <><Zap size={12} className="mr-1" /> Connect Provider</>}
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ provider management modal ------------------------------ */

const ProviderDetailModal = ({ provider, providers, catalog, onClose, onUpdate, onTest, onDelete, onToggle, onMove }) => {
  const [displayName, setDisplayName] = useState(provider.name || '');
  const [model, setModel] = useState(provider.model || '');
  const [baseUrl, setBaseUrl] = useState(provider.baseUrl || '');
  const [azureResource, setAzureResource] = useState(provider.azureResource || '');
  const [azureDeployment, setAzureDeployment] = useState(provider.azureDeployment || '');
  const [showKeyInput, setShowKeyInput] = useState(false);
  const [keyDraft, setKeyDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testMsg, setTestMsg] = useState(null);
  const [savedMsg, setSavedMsg] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);

  const spec = provider.catalog || catalog[provider.provider] || null;
  const models = (provider.models && provider.models.length ? provider.models : spec?.models) || [];
  const usageRow = provider.usage;
  const rate = usageRow && usageRow.total > 0 ? usageRow.successRate : null;
  const stats = [
    { label: 'Requests', value: formatNumber(usageRow?.total), cls: 'text-text-primary' },
    { label: 'Success', value: rate != null ? `${rate}%` : '—', cls: rate != null && rate >= 90 ? 'text-success' : rate != null && rate < 70 ? 'text-error' : 'text-text-primary' },
    { label: 'Avg latency', value: formatMs(usageRow?.averageLatencyMs), cls: 'text-text-primary' },
    { label: 'Health', value: HEALTH_META[provider.health]?.label || '—', cls: provider.health === 'healthy' ? 'text-success' : provider.health === 'warning' ? 'text-warning' : provider.health === 'error' ? 'text-error' : 'text-text-primary' },
  ];

  const needsBaseUrl = provider.provider === 'openai-compatible';
  const needsAzure = provider.provider === 'azure';
  const sorted = [...providers].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  const rank = Math.max(0, sorted.findIndex(p => p.id === provider.id)) + 1;
  const isFirst = rank <= 1;
  const isLast = rank >= sorted.length;

  const handleSave = async (closeAfter = true) => {
    const updates = { name: displayName };
    if (needsAzure) {
      if (azureDeployment.trim() !== provider.azureDeployment) updates.azureDeployment = azureDeployment.trim();
      if (azureDeployment.trim() !== provider.model) updates.model = azureDeployment.trim();
    } else if (model !== provider.model) {
      updates.model = model;
    }
    if (needsBaseUrl && baseUrl !== provider.baseUrl) updates.baseUrl = baseUrl;
    if (needsAzure && azureResource !== provider.azureResource) updates.azureResource = azureResource;
    if (showKeyInput && keyDraft.trim()) updates.apiKey = keyDraft.trim();
    setSaving(true);
    await onUpdate(provider.id, updates);
    setSaving(false);
    if (showKeyInput && keyDraft.trim()) {
      setKeyDraft('');
      setShowKeyInput(false);
    }
    setSavedMsg(true);
    setTimeout(() => setSavedMsg(false), 1800);
    if (closeAfter) onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    setTestMsg(null);
    try {
      const res = await fetch(`/api/message-agent/ai-providers/${provider.id}/test`, { method: 'POST' });
      const data = await res.json().catch(() => null);
      if (res.ok && data?.success) {
        setTestMsg({ type: 'success', message: 'Connection verified' });
        onTest(provider.id);
      } else {
        setTestMsg({ type: 'error', message: data?.error || 'Connection failed' });
        onTest(provider.id);
      }
    } catch (err) {
      setTestMsg({ type: 'error', message: err.message || 'Connection failed' });
    }
    setTesting(false);
  };

  const handleRemove = () => {
    onDelete(provider.id);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[80] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4">
      <div className="w-full sm:max-w-xl bg-surface border border-border rounded-t-2xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92vh] flex flex-col animate-fade-up">
        {/* Header */}
        <div className="p-3 sm:p-4 border-b border-border shrink-0">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <ProviderLogo provider={provider.provider} size={40} />
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm sm:text-base font-display font-bold text-text-primary truncate">{provider.name || provider.provider}</h2>
                  <ProviderStatusBadge status={provider.status} />
                </div>
                <p className="text-[11px] font-mono text-text-muted truncate">{provider.provider} · #{rank}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 shrink-0">
              <Switch
                checked={provider.enabled !== false}
                onCheckedChange={() => onToggle(provider.id)}
                className="scale-90"
                aria-label="Toggle provider"
              />
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors" aria-label="Close">
                <X size={15} className="text-text-muted" />
              </button>
            </div>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-4">
          {/* Stats grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {stats.map(s => (
              <div key={s.label} className="p-2.5 rounded-xl bg-background border border-border">
                <p className="text-[10px] text-text-muted">{s.label}</p>
                <p className={cn('mt-0.5 text-sm font-bold truncate', s.cls)}>{s.value}</p>
              </div>
            ))}
          </div>

          {provider.connectionError && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-error/5 border border-error/20 text-[11px] text-error">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Last connection error</p>
                <p className="mt-0.5 opacity-80 break-words">{provider.connectionError}</p>
              </div>
            </div>
          )}

          {usageRow?.lastError && (
            <div className="flex items-start gap-2 p-2.5 rounded-xl bg-error/5 border border-error/20 text-[11px] text-error">
              <AlertCircle size={13} className="mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold">Last request error</p>
                <p className="mt-0.5 opacity-80 break-words">{usageRow.lastError}</p>
              </div>
            </div>
          )}

          <div className="space-y-3.5">
            <Field label="Display name">
              <Input value={displayName} onChange={e => setDisplayName(e.target.value)} className="h-9 text-[13px]" />
            </Field>

            <Field label="Model">
              {!needsAzure && (models.length ? (
                <ModelSelect models={models} value={model} onChange={setModel} />
              ) : (
                <Input value={model} onChange={e => setModel(e.target.value)} className="h-9 text-xs font-mono" />
              ))}
            </Field>

            {needsBaseUrl && (
              <Field label="Base URL">
                <Input value={baseUrl} onChange={e => setBaseUrl(e.target.value)} className="h-9 text-xs font-mono" />
              </Field>
            )}
            {needsAzure && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Resource">
                  <Input value={azureResource} onChange={e => setAzureResource(e.target.value)} className="h-9 text-xs font-mono" />
                </Field>
                <Field label="Deployment">
                  <Input value={azureDeployment} onChange={e => setAzureDeployment(e.target.value)} className="h-9 text-xs font-mono" />
                </Field>
              </div>
            )}

            <Field label="API key" hint="AES-256-GCM encrypted — never exposed">
              {!showKeyInput ? (
                <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background border border-border">
                  <span className="truncate font-mono text-[11px] text-text-secondary">
                    {provider.keyPreview || '••••••••••'}
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setShowKeyInput(true)}
                    className="shrink-0 h-7 px-2 text-[11px]"
                  >
                    <PencilLine size={11} className="mr-1" /> Replace
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <SecretInput
                    value={keyDraft}
                    onChange={e => setKeyDraft(e.target.value)}
                    placeholder="Paste new API key"
                  />
                </div>
              )}
            </Field>

            <div className="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-2">
                <span className="text-[11px] text-text-muted">Priority</span>
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => onMove(provider.id, 'up')}
                    disabled={isFirst}
                    className="p-1 rounded-md hover:bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowUp size={11} />
                  </button>
                  <span className="min-w-[42px] text-center font-mono text-xs font-semibold text-text-primary bg-surface border border-border rounded-md px-2 py-0.5">#{rank}</span>
                  <button
                    type="button"
                    onClick={() => onMove(provider.id, 'down')}
                    disabled={isLast}
                    className="p-1 rounded-md hover:bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ArrowDown size={11} />
                  </button>
                </div>
              </div>
              <HealthBadge health={provider.health} />
            </div>
          </div>

          {testMsg && (
            <div className={cn(
              'flex items-start gap-2 p-2.5 rounded-xl border text-[11px]',
              testMsg.type === 'success' ? 'bg-success/5 border-success/20 text-success' : 'bg-error/5 border-error/20 text-error'
            )}>
              {testMsg.type === 'success' ? <CheckCircle2 size={13} className="mt-0.5 shrink-0" /> : <XCircle size={13} className="mt-0.5 shrink-0" />}
              <div>
                <p className="font-semibold">{testMsg.type === 'success' ? 'Connection verified' : 'Connection failed'}</p>
                <p className="mt-0.5 opacity-80 break-words">{testMsg.message}</p>
              </div>
            </div>
          )}

          {savedMsg && (
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-success/5 border border-success/20 text-[11px] text-success">
              <CheckCircle2 size={13} className="shrink-0" />
              <span className="font-semibold">Settings saved</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-3 sm:p-4 border-t border-border shrink-0 flex flex-wrap items-center gap-2">
          {confirmingRemove ? (
            <div className="w-full flex flex-col sm:flex-row sm:items-center gap-2 rounded-xl bg-error/5 border border-error/20 p-2.5">
              <div className="flex-1 min-w-0 text-left">
                <p className="text-xs font-semibold text-error">Remove {provider.name || provider.provider}?</p>
                <p className="text-[10px] text-text-secondary mt-0.5">
                  This permanently deletes the provider and its encrypted API credentials. Other providers are not affected.
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => setConfirmingRemove(false)}>Cancel</Button>
                <Button variant="destructive" size="sm" onClick={handleRemove}>
                  <Trash2 size={12} className="mr-1" /> Delete
                </Button>
              </div>
            </div>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setConfirmingRemove(true)}
              className="text-error border-error/30 hover:bg-error/10 hover:text-error mr-auto"
            >
              <Trash2 size={12} className="mr-1" /> Remove
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleTest}
            loading={testing}
            disabled={saving}
          >
            {!testing && <RefreshCw size={12} className="mr-1" />}
            Test Connection
          </Button>
          <Button size="sm" onClick={() => handleSave(true)} loading={saving} className="bg-primary text-white">
            {!saving && <Check size={12} className="mr-1" />}
            Save Changes
          </Button>
        </div>
      </div>
    </div>
  );
};

/* ------------------------------ routing & usage sections ------------------------------ */

const RoutingSection = ({ settings, onSave, providers = [] }) => {
  const [strategy, setStrategy] = useState(settings?.strategy || 'priority');
  const [fallbackEnabled, setFallbackEnabled] = useState(settings?.fallbackEnabled !== false);
  const [preferredProviderId, setPreferredProviderId] = useState(settings?.preferredProviderId || '');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setStrategy(settings?.strategy || 'priority');
    setFallbackEnabled(settings?.fallbackEnabled !== false);
    setPreferredProviderId(settings?.preferredProviderId || '');
  }, [settings]);

  const handleSave = async () => {
    setSaving(true);
    await onSave({ strategy, fallbackEnabled, preferredProviderId });
    setSaving(false);
  };

  const strategies = [
    { id: 'priority', label: 'Priority', desc: 'Use providers in priority order, fail over on error', icon: <GitBranch size={13} /> },
    { id: 'preferred', label: 'Preferred', desc: 'Route to one provider, fall back if enabled', icon: <Zap size={13} /> },
    { id: 'auto', label: 'Auto', desc: 'Route by live health & latency scores', icon: <Activity size={13} /> },
  ];

  const enabledProviders = providers.filter(p => p.enabled);

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-4 pt-3.5 pb-1 flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
          <Settings size={13} className="text-text-muted" /> Routing Strategy
        </h3>
        <Badge variant="outline" className="text-[9px] font-mono">{strategy}</Badge>
      </div>
      <div className="p-4 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {strategies.map(s => (
            <button
              key={s.id}
              type="button"
              onClick={() => setStrategy(s.id)}
              className={cn(
                'p-2.5 rounded-xl border text-left transition-all',
                strategy === s.id
                  ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                  : 'border-border bg-background hover:border-primary/30'
              )}
            >
              <div className={cn('flex items-center gap-1.5 mb-1', strategy === s.id ? 'text-primary' : 'text-text-muted')}>
                {s.icon}
                <span className="text-xs font-semibold text-text-primary">{s.label}</span>
              </div>
              <p className="text-[10px] leading-tight text-text-muted">{s.desc}</p>
            </button>
          ))}
        </div>

        {strategy === 'preferred' && (
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-text-muted mb-1.5">Preferred provider</p>
            <ProviderSelect
              providers={enabledProviders}
              value={preferredProviderId}
              onChange={setPreferredProviderId}
            />
            {enabledProviders.length === 0 && (
              <p className="text-[10px] text-text-muted mt-1.5">Enable at least one provider to pick a preferred route.</p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between gap-3 p-2.5 rounded-xl bg-background border border-border">
          <div>
            <p className="text-xs font-medium text-text-primary">Enable fallback</p>
            <p className="text-[10px] text-text-muted">Try the next available provider on failure</p>
          </div>
          <Switch checked={fallbackEnabled} onCheckedChange={setFallbackEnabled} />
        </div>

        <Button size="sm" onClick={handleSave} loading={saving} className="w-full bg-primary text-white">
          {!saving && <Check size={12} className="mr-1" />}
          Save Routing Settings
        </Button>
      </div>
    </div>
  );
};

const UsagePanel = ({ usage, providers }) => {
  const totals = usage?.totals || {};
  const rows = Array.isArray(usage?.providers) ? usage.providers : [];
  const totalReqs = totals.total || 0;
  const totalRate = totalReqs > 0 ? Math.round(((totals.success || 0) / totalReqs) * 100) : null;
  const avgLatency = useMemo(() => {
    const valid = rows.filter(r => (r.total || 0) > 0 && (r.averageLatencyMs || 0) > 0);
    if (!valid.length) return null;
    const w = valid.reduce((a, r) => a + r.averageLatencyMs * r.total, 0);
    const t = valid.reduce((a, r) => a + r.total, 0);
    return w / t;
  }, [rows]);

  const summary = [
    { label: 'Requests', value: formatNumber(totalReqs), cls: 'text-text-primary' },
    { label: 'Success rate', value: totalRate != null ? `${totalRate}%` : '—', cls: totalRate != null && totalRate >= 90 ? 'text-success' : totalRate != null && totalRate < 70 ? 'text-error' : 'text-text-primary' },
    { label: 'Avg latency', value: formatMs(avgLatency), cls: 'text-text-primary' },
  ];

  return (
    <div className="rounded-2xl border border-border bg-surface overflow-hidden">
      <div className="px-4 pt-3.5 pb-1 flex items-center gap-1.5">
        <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
          <BarChart3 size={13} className="text-text-muted" /> Usage Statistics
        </h3>
      </div>
      <div className="p-4 space-y-3.5">
        <div className="grid grid-cols-3 gap-2">
          {summary.map(s => (
            <div key={s.label} className="p-2.5 rounded-xl bg-background border border-border">
              <p className="text-[10px] text-text-muted">{s.label}</p>
              <p className={cn('mt-0.5 text-sm font-bold', s.cls)}>{s.value}</p>
            </div>
          ))}
        </div>

        {rows.length > 0 && (
          <div className="space-y-2.5">
            {rows.map(r => {
              const p = providers.find(x => x.id === r.providerId);
              const rate = r.successRate ?? 0;
              return (
                <div key={r.providerId} className="flex items-center gap-2.5">
                  {p ? <ProviderLogo provider={p.provider} size={24} /> : <span className="w-6 shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-medium text-text-primary truncate">{p?.name || r.providerId}</span>
                      <span className="text-[10px] text-text-muted shrink-0">
                        {formatNumber(r.total)} {r.total === 1 ? 'req' : 'reqs'} · {rate != null ? `${rate}%` : '—'}
                      </span>
                    </div>
                    <div className="mt-1 h-1.5 rounded-full bg-border overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', rate != null && rate < 70 ? 'bg-error' : 'bg-success')}
                        style={{ width: `${Math.max(2, Math.min(100, rate ?? 0))}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

const HowItWorksStrip = () => (
  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/15">
      <div className="w-7 h-7 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
        <Lock size={13} className="text-primary" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-text-primary">Keys stay encrypted</p>
        <p className="text-[10px] leading-relaxed text-text-secondary mt-0.5">
          API keys are AES-256-GCM encrypted at rest and never exposed to the frontend.
        </p>
      </div>
    </div>
    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-secondary/5 border border-secondary/15">
      <div className="w-7 h-7 rounded-lg bg-secondary/10 border border-secondary/20 flex items-center justify-center shrink-0">
        <GitBranch size={13} className="text-secondary" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-text-primary">Smart routing</p>
        <p className="text-[10px] leading-relaxed text-text-secondary mt-0.5">
          Requests route by priority, preferred provider, or live scores with automatic failover.
        </p>
      </div>
    </div>
    <div className="flex items-start gap-2.5 p-3 rounded-2xl bg-warning/5 border border-warning/15">
      <div className="w-7 h-7 rounded-lg bg-warning/10 border border-warning/20 flex items-center justify-center shrink-0">
        <Gauge size={13} className="text-warning" />
      </div>
      <div>
        <p className="text-[11px] font-semibold text-text-primary">Real-time signals</p>
        <p className="text-[10px] leading-relaxed text-text-secondary mt-0.5">
          Requests, success rate, latency and health are tracked per provider as traffic flows.
        </p>
      </div>
    </div>
  </div>
);

/* ------------------------------ main page ------------------------------ */

const AiProviderSettings = ({ isOpen, onClose, embedded = false }) => {
  const open = embedded || isOpen;
  const { aiProviders, loadAiProviders } = useMessageAgent();
  const [providers, setProviders] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [usage, setUsage] = useState({});
  const [routingSettings, setRoutingSettings] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [maxProviders, setMaxProviders] = useState(13);
  const [loading, setLoading] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [provRes, catRes, usageRes, routingRes] = await Promise.allSettled([
        fetch('/api/message-agent/ai-providers').then(r => r.json()),
        fetch('/api/message-agent/ai-providers/catalog').then(r => r.json()),
        fetch('/api/message-agent/ai-providers/usage').then(r => r.json()),
        fetch('/api/message-agent/ai-routing').then(r => r.json()),
      ]);
      if (provRes.status === 'fulfilled' && provRes.value.success) {
        setProviders(provRes.value.providers || []);
        setMaxProviders(provRes.value.maxProviders || 13);
      }
      if (catRes.status === 'fulfilled' && catRes.value.success) {
        setCatalog(catRes.value.catalog || {});
      }
      if (usageRes.status === 'fulfilled') {
        setUsage(usageRes.value || {});
      }
      if (routingRes.status === 'fulfilled' && routingRes.value.success) {
        setRoutingSettings(routingRes.value.settings || {});
      }
    } catch (err) {
      console.error('Error loading AI provider data:', err);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    if (open) fetchAll();
  }, [open, fetchAll]);

  useEffect(() => {
    setProviders(aiProviders || []);
  }, [aiProviders]);

  useEffect(() => {
    if (!open || embedded) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [open, embedded, onClose]);

  const handleToggleProvider = async (id) => {
    const provider = providers.find(p => p.id === id);
    if (!provider) return;
    try {
      await fetch(`/api/message-agent/ai-providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: provider.enabled === false })
      });
      loadAiProviders?.();
      fetchAll();
    } catch (err) {
      console.error('Error toggling provider:', err);
    }
  };

  const handleDeleteProvider = async (id) => {
    try {
      await fetch(`/api/message-agent/ai-providers/${id}`, { method: 'DELETE' });
      loadAiProviders?.();
      fetchAll();
    } catch (err) {
      console.error('Error deleting provider:', err);
    }
  };

  const handleTestProvider = async (id) => {
    try {
      await fetch(`/api/message-agent/ai-providers/${id}/test`, { method: 'POST' });
      loadAiProviders?.();
      fetchAll();
    } catch (err) {
      console.error('Error testing provider:', err);
    }
  };

  const handleUpdateProvider = async (id, updates) => {
    try {
      await fetch(`/api/message-agent/ai-providers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      loadAiProviders?.();
      fetchAll();
    } catch (err) {
      console.error('Error updating provider:', err);
    }
  };

  const handlePriorityChange = async (id, direction) => {
    const sorted = [...providers].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const idx = sorted.findIndex(p => p.id === id);
    if (direction === 'up' && idx > 0) {
      [sorted[idx - 1], sorted[idx]] = [sorted[idx], sorted[idx - 1]];
    } else if (direction === 'down' && idx < sorted.length - 1) {
      [sorted[idx + 1], sorted[idx]] = [sorted[idx], sorted[idx + 1]];
    } else {
      return;
    }
    try {
      await fetch('/api/message-agent/ai-providers/reorder', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderedIds: sorted.map(p => p.id) })
      });
    } catch (err) {
      console.error('Error reordering providers:', err);
    }
    fetchAll();
  };

  const handleSaveRouting = async (newSettings) => {
    try {
      await fetch('/api/message-agent/ai-routing', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newSettings)
      });
      fetchAll();
    } catch (err) {
      console.error('Error saving routing:', err);
    }
  };

  const sortedProviders = useMemo(() => {
    const filtered = searchQuery.trim()
      ? providers.filter(p => {
          const q = searchQuery.toLowerCase();
          return (p.name || '').toLowerCase().includes(q) ||
                 (p.provider || '').toLowerCase().includes(q) ||
                 (p.model || '').toLowerCase().includes(q);
        })
      : providers;
    return [...filtered].sort((a, b) => (a.priority || 0) - (b.priority || 0));
  }, [providers, searchQuery]);

  const totals = usage?.totals || {};
  const usageRows = useMemo(() => {
    const rows = Array.isArray(usage?.providers) ? usage.providers : [];
    const map = {};
    rows.forEach(r => { map[r.providerId] = r; });
    return map;
  }, [usage]);

  const activeCount = providers.filter(p => p.enabled !== false).length;
  const totalReqs = totals.total || 0;
  const totalRate = totalReqs > 0 ? Math.round(((totals.success || 0) / totalReqs) * 100) : null;
  const avgLatency = useMemo(() => {
    const rows = Array.isArray(usage?.providers) ? usage.providers : [];
    const valid = rows.filter(r => (r.total || 0) > 0 && (r.averageLatencyMs || 0) > 0);
    if (!valid.length) return null;
    const w = valid.reduce((a, r) => a + r.averageLatencyMs * r.total, 0);
    const t = valid.reduce((a, r) => a + r.total, 0);
    return w / t;
  }, [usage]);

  const selectedProvider = selectedId ? providers.find(p => p.id === selectedId) || null : null;

  if (!open) return null;

  const metrics = [
    { label: 'Active providers', value: `${activeCount}/${providers.length}`, sub: `${providers.length}/${maxProviders} slots`, cls: 'text-text-primary' },
    { label: 'Requests', value: formatNumber(totalReqs), sub: 'all time', cls: 'text-text-primary' },
    { label: 'Success rate', value: totalRate != null ? `${totalRate}%` : '—', sub: totalRate != null && totalRate >= 90 ? 'healthy' : totalRate != null ? 'tune routing' : 'no traffic', cls: totalRate != null && totalRate >= 90 ? 'text-success' : totalRate != null && totalRate < 70 ? 'text-error' : 'text-text-primary' },
    { label: 'Avg latency', value: formatMs(avgLatency), sub: 'weighted', cls: 'text-text-primary' },
  ];

  return (
    <>
      <div className={embedded ? 'w-full h-full' : 'fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-background/80 backdrop-blur-sm p-0 sm:p-4'}>
        <div className={cn(
          'bg-surface flex flex-col overflow-hidden',
          embedded
            ? 'w-full h-full rounded-2xl border border-border animate-fade-up'
            : 'w-full sm:max-w-3xl max-h-[92vh] sm:rounded-2xl rounded-t-2xl border border-border shadow-2xl animate-fade-up'
        )}>
          {/* Header */}
          <div className="p-3 sm:p-4 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-secondary/10 border border-primary/20 flex items-center justify-center shrink-0">
                  <Cpu size={16} className="text-primary" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-sm sm:text-lg font-display font-bold text-text-primary truncate">AI Provider Settings</h2>
                  <p className="text-[11px] text-text-secondary truncate">
                    {activeCount} of {providers.length} active · strategy: {routingSettings.strategy || 'priority'}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={fetchAll}
                  disabled={loading}
                  className="h-8 w-8"
                  aria-label="Refresh"
                >
                  <RefreshCw size={13} className={cn(loading && 'animate-spin')} />
                </Button>
                {!embedded && (
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors" aria-label="Close">
                    <X size={16} className="text-text-muted" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-3 sm:p-4 space-y-3 lg:space-y-4">
            {/* Metrics strip */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              {metrics.map(m => (
                <div key={m.label} className="p-2.5 sm:p-3 rounded-2xl bg-gradient-to-b from-background to-transparent border border-border">
                  <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{m.label}</p>
                  <p className={cn('mt-1 text-base sm:text-lg font-display font-bold leading-none', m.cls)}>{m.value}</p>
                  <p className="mt-1 text-[10px] text-text-muted truncate">{m.sub}</p>
                </div>
              ))}
            </div>

            {/* Connected providers header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pt-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xs font-bold text-text-primary flex items-center gap-1.5">
                  <Shield size={13} className="text-primary" /> Connected Providers
                </h3>
                <Badge variant="outline" className="text-[9px] font-mono">{providers.length}/{maxProviders}</Badge>
              </div>
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <div className="relative flex-1 sm:w-52">
                  <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="Search providers…"
                    className="pl-7 h-8 text-xs"
                  />
                </div>
                <Button
                  size="sm"
                  onClick={() => setShowAddModal(true)}
                  disabled={providers.length >= maxProviders}
                  className="bg-primary text-white shrink-0 h-8"
                >
                  <Plus size={12} className="mr-1" /> Add Provider
                </Button>
              </div>
            </div>

            {/* Provider rows */}
            <div className="space-y-2">
              {sortedProviders.map((provider, idx) => {
                const u = provider.usage || usageRows[provider.id] || {};
                const rate = u.successRate != null ? u.successRate : u.total > 0 ? Math.round((u.success / u.total) * 100) : null;
                return (
                  <div
                    key={provider.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedId(provider.id)}
                    onKeyDown={e => { if (e.key === 'Enter') setSelectedId(provider.id); }}
                    className={cn(
                      'group w-full text-left p-3 rounded-2xl border transition-all cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary',
                      provider.enabled !== false
                        ? 'bg-background border-border hover:border-primary/40 hover:bg-surface'
                        : 'bg-background border-border/70 opacity-70 hover:opacity-100 hover:border-primary/30'
                    )}
                  >
                    <div className="flex items-center gap-3">
                      <ProviderLogo provider={provider.provider} size={40} className="group-hover:scale-105 transition-transform" />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          <p className="text-sm font-semibold text-text-primary truncate">{provider.name || provider.provider}</p>
                          <ProviderStatusBadge status={provider.status} />
                          {provider.health && provider.health !== 'healthy' && <HealthBadge health={provider.health} />}
                        </div>
                        <p className="mt-0.5 text-[11px] font-mono text-text-muted truncate">
                          {provider.model || 'no model'}
                          <span className="mx-1.5 text-border select-none">|</span>
                          <span className="font-sans">{provider.provider}</span>
                        </p>
                        <div className="mt-1.5 flex items-center gap-3 text-[10px] text-text-muted">
                          <span className="flex items-center gap-1"><Activity size={9} /> {formatNumber(u.total)} reqs</span>
                          <span className={cn('flex items-center gap-1', rate != null && rate >= 90 ? 'text-success' : rate != null && rate < 70 ? 'text-error' : '')}>
                            <Check size={9} /> {rate != null ? `${rate}%` : '—'}
                          </span>
                          <span className="flex items-center gap-1 hidden sm:flex"><Gauge size={9} /> {formatMs(u.averageLatencyMs)}</span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0" onClick={e => e.stopPropagation()}>
                        <div className="hidden sm:flex flex-col">
                          <button
                            type="button"
                            onClick={() => handlePriorityChange(provider.id, 'up')}
                            disabled={idx === 0}
                            className="p-0.5 rounded hover:bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move up priority"
                          >
                            <ArrowUp size={10} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handlePriorityChange(provider.id, 'down')}
                            disabled={idx === sortedProviders.length - 1}
                            className="p-0.5 rounded hover:bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
                            aria-label="Move down priority"
                          >
                            <ArrowDown size={10} />
                          </button>
                        </div>
                        <Switch
                          checked={provider.enabled !== false}
                          onCheckedChange={() => handleToggleProvider(provider.id)}
                          className="scale-90"
                          aria-label="Toggle provider"
                        />
                        <button
                          type="button"
                          onClick={() => setSelectedId(provider.id)}
                          className="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-[11px] font-medium text-text-secondary hover:text-text-primary hover:border-primary/40 transition-colors"
                        >
                          <Settings size={11} /> Manage
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {sortedProviders.length === 0 && providers.length > 0 && searchQuery && (
                <div className="p-5 rounded-2xl bg-background border border-border text-center">
                  <p className="text-xs text-text-muted">No providers match "{searchQuery}"</p>
                </div>
              )}

              {providers.length === 0 && (
                <div className="p-8 rounded-2xl bg-background border border-dashed border-border text-center">
                  <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-3">
                    <Zap size={20} className="text-primary" />
                  </div>
                  <p className="text-sm font-semibold text-text-primary mb-1">No AI providers connected</p>
                  <p className="text-xs text-text-muted mb-4 max-w-sm mx-auto">
                    Connect a provider to power smart replies, template recommendations and richer agent responses.
                  </p>
                  <Button size="sm" onClick={() => setShowAddModal(true)} className="bg-primary text-white">
                    <Plus size={12} className="mr-1" /> Add Your First Provider
                  </Button>
                </div>
              )}
            </div>

            {/* Routing + usage */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 pt-1">
              <RoutingSection settings={routingSettings} onSave={handleSaveRouting} providers={providers} />
              <UsagePanel usage={usage} providers={providers} />
            </div>

            <HowItWorksStrip />
          </div>
        </div>
      </div>

      <AddProviderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdded={() => { loadAiProviders?.(); fetchAll(); }}
        catalog={catalog}
        existingIds={new Set(providers.map(p => p.provider))}
        existingCount={providers.length}
        maxProviders={maxProviders}
      />

      {selectedProvider && (
        <ProviderDetailModal
          provider={selectedProvider}
          providers={providers}
          catalog={catalog}
          onClose={() => setSelectedId(null)}
          onUpdate={handleUpdateProvider}
          onTest={handleTestProvider}
          onDelete={handleDeleteProvider}
          onToggle={handleToggleProvider}
          onMove={handlePriorityChange}
        />
      )}
    </>
  );
};

export { AiProviderSettings };