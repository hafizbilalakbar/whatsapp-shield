import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  LayoutDashboard, Building2, MessagesSquare, Send, AlertTriangle,
  Inbox, Star, RefreshCw, Loader2, FileText, Bot, Megaphone, CheckCircle2,
} from 'lucide-react';
import { cn } from '../../../components/ui/cn';
import { Badge } from '../../../components/ui/Badge';
import MetaPanel from './MetaPanel';
import { metaApi } from './metaApi';
import { TEMPLATE_STATUS, TEMPLATE_STATUS_VARIANT, META_STATUS_LABELS } from './MetaConstants';

const Card = ({ label, value, icon, sub }) => (
  <div className="rounded-2xl border border-border bg-surface p-3.5">
    <div className="flex items-center justify-between">
      <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">{label}</span>
      {icon}
    </div>
    <div className="mt-1.5 text-2xl font-semibold text-text-primary">{value}</div>
    {sub ? <div className="mt-0.5 text-[10px] text-text-muted">{sub}</div> : null}
  </div>
);

const MetaDashboard = ({ isOpen, onClose, embedded = false }) => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await metaApi.dashboard();
      setData(res);
      setError('');
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);

  useEffect(() => { if (embedded || isOpen) load(); }, [embedded, isOpen, load]);

  const refresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const m = data?.messageCounts || {};
  const mc = data?.meta || {};
  const tpl = data?.templatesCount || {};
  const camp = data?.campaigns || {};
  const agents = data?.agents || [];
  const inbox = data?.inbox || {};
  const connected = mc.status === 'connected';

  const days = useMemo(() => Object.entries(data?.byDay || {}).sort((a, b) => a[0] < b[0] ? -1 : 1).slice(-14), [data]);

  const maxDay = useMemo(() => Math.max(1, ...days.map(([, v]) => (v.sent || 0) + (v.received || 0) + (v.replied || 0))), [days]);

  return (
    <MetaPanel
      isOpen={isOpen} onClose={onClose} embedded={embedded}
      title="Meta Dashboard"
      subtitle="Live view of the official WhatsApp Business connector — templates, campaigns, agents and messages."
      icon={<LayoutDashboard size={16} className="text-primary" />}
      widthClass="max-w-5xl"
    >
      <div className="p-4 space-y-3">
        {error && <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}</div>}

        {loading && !data ? (
          <div className="flex items-center justify-center py-16 text-xs text-text-muted"><Loader2 size={14} className="animate-spin mr-2" /> Loading dashboard…</div>
        ) : (
          <>
            {/* Status strip */}
            <div className="rounded-2xl border border-border bg-surface p-3 flex items-center gap-3 flex-wrap">
              <div className={cn('w-2.5 h-2.5 rounded-full', connected ? 'bg-[#00A884]' : mc.status === 'error' ? 'bg-error' : 'bg-[#8696A0]')} />
              <div className="text-xs font-semibold text-text-primary">
                {connected ? 'Connected to Meta' : META_STATUS_LABELS[mc.status] || 'Not connected'}
              </div>
              {connected && (
                <>
                  <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-text-muted">
                    <Building2 size={12} /> {mc.business_name || mc.business?.name || '—'}
                  </div>
                  <Badge variant="outline" className="text-[9px]">{mc.messaging_limit_tier || 'TIER_1K'}</Badge>
                </>
              )}
              {mc.error && <div className="text-[11px] text-error w-full sm:w-auto">{mc.error}</div>}
              <button onClick={refresh} disabled={refreshing} className="ml-auto h-7 px-2.5 rounded-lg border border-border text-[11px] text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors disabled:opacity-50">
                {refreshing ? <Loader2 size={13} className="animate-spin" /> : <RefreshCw size={13} />} Refresh
              </button>
            </div>

            {/* Key metrics */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              <Card label="Templates" value={data?.templatesTotal ?? 0} icon={<FileText size={14} className="text-primary" />} />
              <Card label="Sent" value={m.outbound ?? 0} icon={<Send size={14} className="text-primary" />} sub={`${(m.delivered || 0) + (m.read || 0)} delivered/read`} />
              <Card label="Inbound" value={m.inbound ?? 0} icon={<Inbox size={14} className="text-primary" />} sub={`${inbox.total || 0} contacts in inbox`} />
              <Card label="AI replies" value={m.aiMessages ?? 0} icon={<Bot size={14} className="text-primary" />} sub={`${agents.length} agent${agents.length === 1 ? '' : 's'}`} />
              <Card label="Failed/blocked" value={(m.failed ?? 0) + (m.blocked ?? 0)} icon={<AlertTriangle size={14} className="text-error" />} />
              <Card label="Queued" value={m.queued ?? 0} icon={<MessagesSquare size={14} className="text-warning" />} />
            </div>

            <div className="grid md:grid-cols-3 gap-3">
              {/* Templates by status */}
              <div className="rounded-2xl border border-border bg-surface p-3.5">
                <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5"><FileText size={13} /> Templates</div>
                <div className="mt-2 space-y-1.5">
                  {Object.entries(tpl).filter(([, v]) => v > 0).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-2 text-[11px]">
                      <Badge variant={TEMPLATE_STATUS_VARIANT[k] || 'outline'} className="text-[9px] w-24 justify-center">{TEMPLATE_STATUS[k] || k}</Badge>
                      <div className="flex-1 h-1.5 rounded-full bg-[#1F2C33] overflow-hidden">
                        <div className="h-full bg-primary/70" style={{ width: `${Math.round(v / Math.max(1, (data?.templatesTotal || 1)) * 100)}%` }} />
                      </div>
                      <span className="text-text-muted w-6 text-right">{v}</span>
                    </div>
                  ))}
                  {Object.keys(tpl).length === 0 && <div className="text-[11px] text-text-muted">No templates yet.</div>}
                </div>
              </div>

              {/* Campaigns */}
              <div className="rounded-2xl border border-border bg-surface p-3.5">
                <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5"><Megaphone size={13} /> Campaigns</div>
                <div className="mt-2 space-y-1.5 text-[11px]">
                  {(['draft', 'scheduled', 'running', 'paused', 'completed', 'cancelled']).map(k => (
                    <div key={k} className="flex items-center justify-between">
                      <span className="text-text-secondary capitalize">{k}</span>
                      <span className="text-text-muted">{camp[k] || 0}</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Inbox / leads */}
              <div className="rounded-2xl border border-border bg-surface p-3.5">
                <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5"><Star size={13} /> Inbox</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-center">
                  <div><div className="text-lg font-semibold text-text-primary">{inbox.total || 0}</div><div className="text-[9px] uppercase tracking-wider text-text-muted">contacts</div></div>
                  <div><div className="text-lg font-semibold text-[#00A884]">{inbox.leads || 0}</div><div className="text-[9px] uppercase tracking-wider text-text-muted">leads</div></div>
                  <div><div className="text-lg font-semibold text-warning">{inbox.unread || 0}</div><div className="text-[9px] uppercase tracking-wider text-text-muted">unread</div></div>
                </div>
              </div>
            </div>

            {/* Agents */}
            {agents.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-3.5">
                <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5"><Bot size={13} /> AI agents</div>
                <div className="mt-2 grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
                  {agents.map(a => (
                    <div key={a.id} className="rounded-xl bg-surface border border-border p-2.5 flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-[11px] font-medium text-text-primary truncate">{a.name}</div>
                        <div className="text-[9px] text-text-muted">{a.stats?.messagesHandled || 0} replied · {a.stats?.handoffs || 0} handoffs</div>
                      </div>
                      <Badge variant={a.enabled ? 'success' : 'outline'} className="text-[9px]">{a.enabled ? 'on' : 'off'}</Badge>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Daily activity */}
            {days.length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-3.5">
                <div className="text-[11px] font-semibold text-text-primary">14-day activity</div>
                <div className="mt-3 flex items-end gap-1 h-24">
                  {days.map(([day, v]) => {
                    const total = (v.sent || 0) + (v.received || 0) + (v.replied || 0);
                    return (
                      <div key={day} className="flex-1 flex flex-col items-center gap-1 min-w-0">
                        <div className="w-full flex items-end justify-center h-20">
                          <div className="w-2 rounded-t bg-primary/70" style={{ height: `${Math.round(total / maxDay * 100)}%` }} title={`${day}: ${total}`} />
                        </div>
                        <span className="text-[8px] text-text-muted truncate w-full text-center">{day.slice(5)}</span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* History */}
            {(data?.history || []).length > 0 && (
              <div className="rounded-2xl border border-border bg-surface p-3.5">
                <div className="text-[11px] font-semibold text-text-primary flex items-center gap-1.5"><CheckCircle2 size={13} /> Recent template activity</div>
                <div className="mt-2 space-y-1">
                  {data.history.slice(0, 8).map((h, i) => (
                    <div key={i} className="flex items-center gap-2 text-[11px]">
                      <span className="font-mono text-text-secondary truncate">{h.name}</span>
                      <Badge variant={TEMPLATE_STATUS_VARIANT[h.status] || 'outline'} className="text-[9px] ml-auto">{TEMPLATE_STATUS[h.status] || h.status}</Badge>
                      <span className="text-text-muted whitespace-nowrap">{String(h.at || '').slice(0, 16).replace('T', ' ')}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </MetaPanel>
  );
};

export default MetaDashboard;