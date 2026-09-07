import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  X, Cpu, Plus, Trash2, Check, AlertCircle, Loader2, Key, ArrowUp, ArrowDown,
  Power, PowerOff, Eye, EyeOff, Search, Settings, BarChart3, RefreshCw,
  Zap, Shield, Clock, Activity, ChevronDown, ChevronRight, AlertTriangle,
  CheckCircle2, XCircle, RotateCcw, Globe
} from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Switch } from '../../components/ui/Switch';
import { useMessageAgent } from '../MessageAgentPage';

const STATUS_COLORS = {
  connected: 'bg-success',
  connection_failed: 'bg-error',
  configuring: 'bg-warning',
  disconnected: 'bg-text-muted'
};

const STATUS_LABELS = {
  connected: 'Connected',
  connection_failed: 'Failed',
  configuring: 'Testing...',
  disconnected: 'Disconnected'
};

const PROVIDER_ICONS = {
  openai: '🟢', anthropic: '🟠', gemini: '🔵', groq: '⚡',
  mistral: '🟣', deepseek: '🔷', openrouter: '🌐', together: '🤝',
  cohere: '🔷', perplexity: '🔴', xai: '⚫', azure: '☁️',
  'openai-compatible': '🔧'
};

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

const ProviderStatusDot = ({ status, size = 'sm' }) => (
  <div className={cn(
    "rounded-full",
    size === 'sm' ? 'w-2 h-2' : 'w-2.5 h-2.5',
    STATUS_COLORS[status] || 'bg-text-muted',
    status === 'connected' && 'animate-pulse'
  )} />
);

const SearchBar = ({ value, onChange, placeholder }) => (
  <div className="relative">
    <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
    <Input
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="pl-8 h-7 text-[11px]"
    />
  </div>
);

const ProviderOverviewCard = ({ provider, usage, onToggle, onDelete, onSelect, onTest, isFirst, isLast, onPriorityChange }) => {
  const [testing, setTesting] = useState(false);
  const providerUsage = usage?.providers?.[provider.id] || {};

  const handleTest = async () => {
    setTesting(true);
    await onTest(provider.id);
    setTesting(false);
  };

  const successRate = providerUsage.total > 0
    ? Math.round((providerUsage.success / providerUsage.total) * 100)
    : null;

  return (
    <div
      className={cn(
        "p-3 rounded-xl border transition-all cursor-pointer group",
        provider.enabled
          ? "bg-background border-success/20 hover:border-success/40"
          : "bg-background border-border opacity-70 hover:opacity-90"
      )}
      onClick={() => onSelect(provider)}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2.5">
          <div className="text-base">{PROVIDER_ICONS[provider.provider] || '🤖'}</div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5">
              <h3 className="text-xs font-semibold text-text-primary truncate">{provider.name || provider.provider}</h3>
              <ProviderStatusDot status={provider.status} />
            </div>
            <p className="text-[10px] text-text-muted truncate">
              {provider.model || provider.provider}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5" onClick={(e) => e.stopPropagation()}>
          <Switch
            checked={provider.enabled}
            onCheckedChange={() => onToggle(provider.id)}
          />
        </div>
      </div>

      <div className="grid grid-cols-4 gap-1.5 mt-2" onClick={(e) => e.stopPropagation()}>
        <div className="text-center p-1 rounded-lg bg-surface/50">
          <p className="text-[10px] text-text-muted">Requests</p>
          <p className="text-[11px] font-semibold text-text-primary">{formatNumber(providerUsage.total)}</p>
        </div>
        <div className="text-center p-1 rounded-lg bg-surface/50">
          <p className="text-[10px] text-text-muted">Success</p>
          <p className={cn("text-[11px] font-semibold", successRate != null && successRate >= 90 ? 'text-success' : successRate != null && successRate < 70 ? 'text-error' : 'text-text-primary')}>
            {successRate != null ? successRate + '%' : '—'}
          </p>
        </div>
        <div className="text-center p-1 rounded-lg bg-surface/50">
          <p className="text-[10px] text-text-muted">Latency</p>
          <p className="text-[11px] font-semibold text-text-primary">{formatMs(providerUsage.averageLatency)}</p>
        </div>
        <div className="text-center p-1 rounded-lg bg-surface/50">
          <p className="text-[10px] text-text-muted">Last</p>
          <p className="text-[11px] font-semibold text-text-primary">
            {providerUsage.lastRequest ? new Date(providerUsage.lastRequest).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mt-2 pt-2 border-t border-border/50" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-1">
          <span className="text-[10px] text-text-muted">Priority:</span>
          <span className="text-[11px] font-medium text-text-primary">#{provider.priority ?? 0}</span>
          <button
            onClick={(e) => { e.stopPropagation(); onPriorityChange(provider.id, 'up'); }}
            disabled={isFirst}
            className="p-0.5 rounded hover:bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowUp size={10} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onPriorityChange(provider.id, 'down'); }}
            disabled={isLast}
            className="p-0.5 rounded hover:bg-surface text-text-muted hover:text-text-primary disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ArrowDown size={10} />
          </button>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={(e) => { e.stopPropagation(); handleTest(); }}
            disabled={testing}
            className="p-1 rounded hover:bg-primary/10 text-text-muted hover:text-primary disabled:opacity-50"
            title="Test connection"
          >
            {testing ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(provider.id); }}
            className="p-1 rounded hover:bg-error/10 text-text-muted hover:text-error"
            title="Delete provider"
          >
            <Trash2 size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};

const AddProviderModal = ({ isOpen, onClose, onAdd, catalog, existingCount, maxProviders }) => {
  const [selectedProvider, setSelectedProvider] = useState(null);
  const [apiKey, setApiKey] = useState('');
  const [name, setName] = useState('');
  const [model, setModel] = useState('');
  const [models, setModels] = useState([]);
  const [loadingModels, setLoadingModels] = useState(false);
  const [isAdding, setIsAdding] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [connectionStatus, setConnectionStatus] = useState(null);
  const [baseUrl, setBaseUrl] = useState('');
  const [azureResource, setAzureResource] = useState('');
  const [azureDeployment, setAzureDeployment] = useState('');

  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (!selectedProvider) { setModels([]); setModel(''); return; }
    setLoadingModels(true);
    fetch(`/api/message-agent/ai-providers/catalog`)
      .then(r => r.json())
      .then(data => {
        const entry = data.catalog?.[selectedProvider];
        setModels(entry?.models || []);
        if (entry?.models?.length > 0) setModel(entry.models[0].id || entry.models[0]);
      })
      .catch(() => setModels([]))
      .finally(() => setLoadingModels(false));
  }, [selectedProvider]);

  const filteredCatalog = useMemo(() => {
    if (!catalog) return [];
    const entries = Object.entries(catalog);
    if (!searchQuery.trim()) return entries;
    const q = searchQuery.toLowerCase();
    return entries.filter(([id, p]) =>
      id.includes(q) || (p.name || '').toLowerCase().includes(q) || (p.description || '').toLowerCase().includes(q)
    );
  }, [catalog, searchQuery]);

  const handleAdd = async () => {
    if (!selectedProvider || !apiKey.trim()) return;
    setIsAdding(true);
    setConnectionStatus(null);
    try {
      const res = await fetch('/api/message-agent/ai-providers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          provider: selectedProvider,
          apiKey: apiKey.trim(),
          name: name.trim() || catalog[selectedProvider]?.name || selectedProvider,
          model,
          priority: existingCount,
          baseUrl: baseUrl.trim() || undefined,
          azureResource: azureResource.trim() || undefined,
          azureDeployment: azureDeployment.trim() || undefined,
        })
      });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus(data.validation);
        if (data.validation?.status === 'connected') {
          await onAdd(data);
          resetAndClose();
        }
      }
    } catch (err) {
      setConnectionStatus({ status: 'connection_failed', error: err.message });
    }
    setIsAdding(false);
  };

  const resetAndClose = () => {
    setSelectedProvider(null);
    setApiKey('');
    setName('');
    setModel('');
    setModels([]);
    setConnectionStatus(null);
    setSearchQuery('');
    onClose();
  };

  if (!isOpen) return null;
  const slotsRemaining = (maxProviders || 13) - existingCount;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-lg bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden max-h-[85vh] flex flex-col">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-xl bg-primary/10 flex items-center justify-center">
                <Plus size={14} className="text-primary" />
              </div>
              <div>
                <h2 className="text-base font-display font-bold">Add AI Provider</h2>
                <p className="text-[11px] text-text-secondary">{slotsRemaining} of {maxProviders || 13} slots remaining</p>
              </div>
            </div>
            <button onClick={resetAndClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
              <X size={14} className="text-text-muted" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {!selectedProvider ? (
            <>
              <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search providers..." />
              <div className="grid grid-cols-2 gap-1.5">
                {filteredCatalog.map(([id, p]) => (
                  <button
                    key={id}
                    onClick={() => setSelectedProvider(id)}
                    className="p-2.5 rounded-xl border border-border bg-background hover:border-primary/40 hover:bg-primary/5 text-left transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-base">{PROVIDER_ICONS[id] || '🤖'}</span>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-text-primary truncate">{p.name || id}</p>
                        <p className="text-[10px] text-text-muted">{p.models?.length || 0} models</p>
                      </div>
                    </div>
                    {p.description && (
                      <p className="text-[10px] text-text-secondary mt-1 line-clamp-2">{p.description}</p>
                    )}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <div className="space-y-2.5">
              <button
                onClick={() => { setSelectedProvider(null); setConnectionStatus(null); }}
                className="flex items-center gap-1.5 text-[11px] text-text-muted hover:text-text-primary"
              >
                <ChevronDown size={12} className="rotate-90" /> Back to providers
              </button>

              <div className="flex items-center gap-2 p-2 rounded-xl bg-primary/5 border border-primary/20">
                <span className="text-lg">{PROVIDER_ICONS[selectedProvider] || '🤖'}</span>
                <div>
                  <p className="text-xs font-semibold">{catalog[selectedProvider]?.name || selectedProvider}</p>
                  <p className="text-[10px] text-text-secondary">{catalog[selectedProvider]?.description || ''}</p>
                </div>
              </div>

              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Display Name</label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={catalog[selectedProvider]?.name || selectedProvider}
                />
              </div>

              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Model</label>
                {loadingModels ? (
                  <div className="flex items-center gap-1.5 p-2 text-[11px] text-text-muted">
                    <Loader2 size={11} className="animate-spin" /> Loading models...
                  </div>
                ) : (
                  <select
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
                    className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs text-text-primary"
                  >
                    {models.map((m) => {
                      const id = typeof m === 'string' ? m : m.id;
                      const label = typeof m === 'string' ? m : (m.name || m.id);
                      return <option key={id} value={id}>{label}</option>;
                    })}
                  </select>
                )}
              </div>

              <div>
                <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">API Key *</label>
                <div className="relative">
                  <Key size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-muted" />
                  <Input
                    value={apiKey}
                    onChange={(e) => setApiKey(e.target.value)}
                    placeholder={catalog[selectedProvider]?.keyPlaceholder || 'Enter API key'}
                    className="pl-8 font-mono"
                    type="password"
                  />
                </div>
                <p className="text-[10px] text-text-muted mt-1 flex items-center gap-1">
                  <Shield size={9} /> AES-256-GCM encrypted at rest — never exposed to frontend
                </p>
              </div>

              {selectedProvider === 'openai-compatible' && (
                <div>
                  <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Base URL</label>
                  <Input
                    value={baseUrl}
                    onChange={(e) => setBaseUrl(e.target.value)}
                    placeholder="https://your-endpoint.example.com/v1"
                    className="font-mono"
                  />
                  <p className="text-[10px] text-text-muted mt-1">Full endpoint URL compatible with the OpenAI chat-completions API</p>
                </div>
              )}

              {selectedProvider === 'azure' && (
                <>
                  <div>
                    <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Azure Resource Name</label>
                    <Input
                      value={azureResource}
                      onChange={(e) => setAzureResource(e.target.value)}
                      placeholder="your-resource"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Deployment Name</label>
                    <Input
                      value={azureDeployment}
                      onChange={(e) => setAzureDeployment(e.target.value)}
                      placeholder="gpt-5.4-mini"
                    />
                  </div>
                </>
              )}

              {connectionStatus && (
                <div className={cn(
                  "p-2 rounded-xl border text-[11px]",
                  connectionStatus.status === 'connected' ? "bg-success/5 border-success/20 text-success" :
                  "bg-error/5 border-error/20 text-error"
                )}>
                  <div className="flex items-center gap-1.5">
                    {connectionStatus.status === 'connected' ? <CheckCircle2 size={12} /> : <XCircle size={12} />}
                    <span className="font-medium">
                      {connectionStatus.status === 'connected' ? 'Connection verified' : 'Connection failed'}
                    </span>
                  </div>
                  {connectionStatus.error && (
                    <p className="mt-1 text-[10px] opacity-80">{connectionStatus.error}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border flex items-center justify-end gap-2">
          <Button variant="outline" size="sm" onClick={resetAndClose}>Cancel</Button>
          {selectedProvider && (
            <Button
              size="sm"
              onClick={handleAdd}
              disabled={!apiKey.trim() || isAdding}
              className="bg-primary hover:bg-primary/90 text-white"
            >
              {isAdding ? <Loader2 size={12} className="animate-spin mr-1" /> : <Plus size={12} className="mr-1" />}
              {connectionStatus?.status === 'connected' ? 'Added' : 'Add & Test'}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

const ProviderDetailPopup = ({ provider, usage, onClose, onUpdate, onTest }) => {
  const [editName, setEditName] = useState(provider.name || '');
  const [editModel, setEditModel] = useState(provider.model || '');
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const providerUsage = usage?.providers?.[provider.id] || {};

  const handleSave = async () => {
    setSaving(true);
    await onUpdate(provider.id, { name: editName, model: editModel });
    setSaving(false);
    onClose();
  };

  const handleTest = async () => {
    setTesting(true);
    await onTest(provider.id);
    setTesting(false);
  };

  const successRate = providerUsage.total > 0
    ? Math.round((providerUsage.success / providerUsage.total) * 100)
    : null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-background/80 backdrop-blur-sm">
      <div className="w-full max-w-sm bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-3 border-b border-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-lg">{PROVIDER_ICONS[provider.provider] || '🤖'}</span>
              <div>
                <h2 className="text-base font-display font-bold">{provider.name || provider.provider}</h2>
                <div className="flex items-center gap-1.5">
                  <ProviderStatusDot status={provider.status} />
                  <span className="text-[11px] text-text-secondary">{STATUS_LABELS[provider.status] || 'Unknown'}</span>
                </div>
              </div>
            </div>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
              <X size={14} className="text-text-muted" />
            </button>
          </div>
        </div>

        <div className="p-3 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-xl bg-background border border-border text-center">
              <p className="text-[10px] text-text-muted">Total Requests</p>
              <p className="text-sm font-bold text-text-primary">{formatNumber(providerUsage.total)}</p>
            </div>
            <div className="p-2 rounded-xl bg-background border border-border text-center">
              <p className="text-[10px] text-text-muted">Success Rate</p>
              <p className={cn("text-sm font-bold", successRate != null && successRate >= 90 ? 'text-success' : successRate != null ? 'text-error' : 'text-text-primary')}>
                {successRate != null ? successRate + '%' : '—'}
              </p>
            </div>
            <div className="p-2 rounded-xl bg-background border border-border text-center">
              <p className="text-[10px] text-text-muted">Avg Latency</p>
              <p className="text-sm font-bold text-text-primary">{formatMs(providerUsage.averageLatency)}</p>
            </div>
            <div className="p-2 rounded-xl bg-background border border-border text-center">
              <p className="text-[10px] text-text-muted">Health</p>
              <p className={cn("text-sm font-bold", providerUsage.health === 'healthy' ? 'text-success' : providerUsage.health === 'degraded' ? 'text-warning' : 'text-text-primary')}>
                {providerUsage.health || '—'}
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <div>
              <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Display Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div>
              <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Model</label>
              <Input value={editModel} onChange={(e) => setEditModel(e.target.value)} />
            </div>
          </div>

          {providerUsage.lastError && (
            <div className="p-2 rounded-xl bg-error/5 border border-error/20 text-[10px] text-error">
              <p className="font-medium mb-0.5">Last Error</p>
              <p className="opacity-80">{providerUsage.lastError}</p>
            </div>
          )}
        </div>

        <div className="p-3 border-t border-border flex items-center justify-between">
          <Button variant="outline" size="sm" onClick={handleTest} disabled={testing}>
            {testing ? <Loader2 size={11} className="animate-spin mr-1" /> : <RefreshCw size={11} className="mr-1" />}
            Test
          </Button>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>Cancel</Button>
            <Button size="sm" onClick={handleSave} disabled={saving} className="bg-primary text-white">
              {saving ? <Loader2 size={11} className="animate-spin mr-1" /> : <Check size={11} className="mr-1" />}
              Save
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

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
    { id: 'priority', label: 'Priority', desc: 'Use providers in priority order, failover on error', icon: <ArrowDown size={13} /> },
    { id: 'preferred', label: 'Preferred', desc: 'Use a single provider, failover only if enabled', icon: <Zap size={13} /> },
    { id: 'auto', label: 'Auto', desc: 'Automatically route based on health & latency', icon: <Activity size={13} /> },
  ];

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <Settings size={14} className="text-text-muted" />
          Routing Strategy
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          {strategies.map((s) => (
            <button
              key={s.id}
              onClick={() => setStrategy(s.id)}
              className={cn(
                "p-2 rounded-xl border text-left transition-all",
                strategy === s.id
                  ? "border-primary bg-primary/5 ring-1 ring-primary/30"
                  : "border-border bg-background hover:border-primary/30"
              )}
            >
              <div className="flex items-center gap-1.5 mb-1">
                <span className={cn("text-text-muted", strategy === s.id && "text-primary")}>{s.icon}</span>
                <span className="text-xs font-semibold">{s.label}</span>
              </div>
              <p className="text-[10px] text-text-muted leading-tight">{s.desc}</p>
            </button>
          ))}
        </div>

        {strategy === 'preferred' && (
          <div>
            <label className="text-[10px] font-medium text-text-muted uppercase tracking-wider mb-1 block">Preferred Provider</label>
            <select
              value={preferredProviderId}
              onChange={(e) => setPreferredProviderId(e.target.value)}
              className="w-full h-8 px-2 rounded-lg border border-border bg-background text-xs"
            >
              <option value="">Select provider...</option>
              {providers.filter(p => p.enabled).map(p => (
                <option key={p.id} value={p.id}>{p.name || p.provider}</option>
              ))}
            </select>
          </div>
        )}

        <div className="flex items-center justify-between p-2 rounded-xl bg-background border border-border">
          <div>
            <p className="text-xs font-medium">Enable Fallback</p>
            <p className="text-[10px] text-text-muted">Try next provider on failure</p>
          </div>
          <Switch checked={fallbackEnabled} onCheckedChange={setFallbackEnabled} />
        </div>

        <Button size="sm" onClick={handleSave} disabled={saving} className="w-full bg-primary text-white">
          {saving ? <Loader2 size={11} className="animate-spin mr-1" /> : <Check size={11} className="mr-1" />}
          Save Routing Settings
        </Button>
      </CardContent>
    </Card>
  );
};

const UsageStatsPanel = ({ usage }) => {
  const summary = usage?.summary || {};
  const providers = usage?.providers || {};
  const providerList = Object.entries(providers);

  return (
    <Card className="border-border">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm flex items-center gap-2">
          <BarChart3 size={14} className="text-text-muted" />
          Usage Statistics
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2.5">
        <div className="grid grid-cols-3 gap-1.5">
          <div className="p-2 rounded-xl bg-background border border-border text-center">
            <p className="text-[10px] text-text-muted">Total</p>
            <p className="text-sm font-bold text-text-primary">{formatNumber(summary.totalRequests)}</p>
          </div>
          <div className="p-2 rounded-xl bg-background border border-border text-center">
            <p className="text-[10px] text-text-muted">Success</p>
            <p className="text-sm font-bold text-success">{summary.successRate != null ? Math.round(summary.successRate) + '%' : '—'}</p>
          </div>
          <div className="p-2 rounded-xl bg-background border border-border text-center">
            <p className="text-[10px] text-text-muted">Avg Latency</p>
            <p className="text-sm font-bold text-text-primary">{formatMs(summary.averageLatency)}</p>
          </div>
        </div>

        {providerList.length > 0 && (
          <div className="space-y-1">
            <p className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Per Provider</p>
            {providerList.map(([id, stats]) => {
              const rate = stats.total > 0 ? Math.round((stats.success / stats.total) * 100) : 0;
              return (
                <div key={id} className="flex items-center justify-between p-1.5 rounded-lg bg-background/50 text-[11px]">
                  <span className="text-text-primary font-medium truncate">{id}</span>
                  <div className="flex items-center gap-2 text-text-muted">
                    <span>{formatNumber(stats.total)} reqs</span>
                    <span className={cn(rate >= 90 ? 'text-success' : rate < 70 ? 'text-error' : '')}>{rate}%</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

const AiProviderSettings = ({ isOpen, onClose, embedded = false }) => {
  const open = embedded || isOpen;
  const { aiProviders, loadAiProviders } = useMessageAgent();
  const [providers, setProviders] = useState([]);
  const [catalog, setCatalog] = useState({});
  const [usage, setUsage] = useState({});
  const [routingSettings, setRoutingSettings] = useState({});
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState(null);
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
        body: JSON.stringify({ enabled: !provider.enabled })
      });
      fetchAll();
    } catch (err) {
      console.error('Error toggling provider:', err);
    }
  };

  const handleDeleteProvider = async (id) => {
    if (!confirm('Delete this AI provider? This cannot be undone.')) return;
    try {
      await fetch(`/api/message-agent/ai-providers/${id}`, { method: 'DELETE' });
      fetchAll();
    } catch (err) {
      console.error('Error deleting provider:', err);
    }
  };

  const handleTestProvider = async (id) => {
    try {
      await fetch(`/api/message-agent/ai-providers/${id}/test`, { method: 'POST' });
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
      fetchAll();
    } catch (err) {
      console.error('Error updating provider:', err);
    }
  };

  const handlePriorityChange = async (id, direction) => {
    const sorted = [...providers].sort((a, b) => (a.priority || 0) - (b.priority || 0));
    const idx = sorted.findIndex(p => p.id === id);
    if (direction === 'up' && idx > 0) {
      const temp = sorted[idx].priority;
      sorted[idx].priority = sorted[idx - 1].priority;
      sorted[idx - 1].priority = temp;
    } else if (direction === 'down' && idx < sorted.length - 1) {
      const temp = sorted[idx].priority;
      sorted[idx].priority = sorted[idx + 1].priority;
      sorted[idx + 1].priority = temp;
    } else return;
    for (const p of sorted) {
      await fetch(`/api/message-agent/ai-providers/${p.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ priority: p.priority })
      });
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

  const handleAddComplete = async () => {
    setShowAddModal(false);
    fetchAll();
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

  if (!open) return null;
  const activeCount = providers.filter(p => p.enabled).length;

  return (
    <>
      <div className={embedded ? "h-full" : "fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm"}>
        <div className={embedded
          ? "w-full h-full bg-surface border border-border rounded-2xl overflow-hidden flex flex-col"
          : "w-full max-w-3xl max-h-[90vh] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col"
        }>
          {/* Header */}
          <div className="p-3 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-xl bg-success/10 flex items-center justify-center">
                  <Cpu size={14} className="text-success" />
                </div>
                <div>
                  <h2 className="text-lg font-display font-bold text-text-primary">AI Provider Settings</h2>
                  <p className="text-xs text-text-secondary">
                    {activeCount} of {providers.length} active • {providers.length}/{maxProviders} slots used
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={fetchAll} disabled={loading}>
                  <RefreshCw size={12} className={cn(loading && "animate-spin")} />
                </Button>
                {!embedded && (
                  <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors">
                    <X size={16} className="text-text-muted" />
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {/* Status bar */}
            <div className="flex items-center gap-2 p-2.5 rounded-xl bg-background border border-border">
              <div className="flex items-center gap-1.5">
                <div className={cn("w-2 h-2 rounded-full", activeCount > 0 ? 'bg-success animate-pulse' : 'bg-error')} />
                <span className="text-[11px] font-medium">
                  {activeCount > 0 ? `${activeCount} provider${activeCount !== 1 ? 's' : ''} ready` : 'No active providers'}
                </span>
              </div>
              <span className="text-[11px] text-text-muted">•</span>
              <span className="text-[11px] text-text-muted">
                Strategy: {routingSettings.strategy || 'priority'}
              </span>
            </div>

            {/* Search + Add button */}
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <SearchBar value={searchQuery} onChange={setSearchQuery} placeholder="Search providers..." />
              </div>
              <Button
                size="sm"
                onClick={() => setShowAddModal(true)}
                disabled={providers.length >= maxProviders}
                className="bg-primary text-white shrink-0"
              >
                <Plus size={12} className="mr-1" /> Add Provider
              </Button>
            </div>

            {/* Provider cards */}
            <div className="space-y-2">
              {sortedProviders.map((provider, idx) => (
                <ProviderOverviewCard
                  key={provider.id}
                  provider={provider}
                  usage={usage}
                  onToggle={handleToggleProvider}
                  onDelete={handleDeleteProvider}
                  onSelect={setSelectedProvider}
                  onTest={handleTestProvider}
                  onPriorityChange={handlePriorityChange}
                  isFirst={idx === 0}
                  isLast={idx === sortedProviders.length - 1}
                />
              ))}

              {sortedProviders.length === 0 && providers.length > 0 && searchQuery && (
                <div className="p-4 rounded-xl bg-background border border-border text-center">
                  <p className="text-xs text-text-muted">No providers match "{searchQuery}"</p>
                </div>
              )}

              {providers.length === 0 && (
                <div className="p-6 rounded-xl bg-background border border-dashed border-border text-center">
                  <Cpu size={24} className="text-text-muted mx-auto mb-2" />
                  <p className="text-xs font-medium text-text-primary mb-1">No AI providers configured</p>
                  <p className="text-[11px] text-text-muted mb-3">Add a provider to enable AI features like smart replies, template recommendations, and more.</p>
                  <Button size="sm" onClick={() => setShowAddModal(true)} className="bg-primary text-white">
                    <Plus size={12} className="mr-1" /> Add Your First Provider
                  </Button>
                </div>
              )}
            </div>

            {/* Routing + Usage in two columns */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3">
              <RoutingSection settings={routingSettings} onSave={handleSaveRouting} providers={providers} />
              <UsageStatsPanel usage={usage} />
            </div>

            {/* How it works */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20">
              <h4 className="text-xs font-semibold text-primary mb-1.5">How AI Routing Works</h4>
              <ul className="text-[11px] text-text-secondary space-y-1">
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">1.</span>
                  Messages are routed based on your selected strategy (priority, preferred, or auto)
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">2.</span>
                  If the primary provider fails, the system automatically tries the next available provider
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">3.</span>
                  API keys are encrypted with AES-256-GCM and never exposed to the frontend
                </li>
                <li className="flex items-start gap-1.5">
                  <span className="text-primary mt-0.5">4.</span>
                  Usage, latency, and health metrics are tracked per-provider in real time
                </li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <AddProviderModal
        isOpen={showAddModal}
        onClose={() => setShowAddModal(false)}
        onAdd={handleAddComplete}
        catalog={catalog}
        existingCount={providers.length}
        maxProviders={maxProviders}
      />

      {selectedProvider && (
        <ProviderDetailPopup
          provider={selectedProvider}
          usage={usage}
          onClose={() => setSelectedProvider(null)}
          onUpdate={handleUpdateProvider}
          onTest={handleTestProvider}
        />
      )}
    </>
  );
};

export { AiProviderSettings };
