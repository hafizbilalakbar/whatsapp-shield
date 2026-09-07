import React, { useCallback, useEffect, useState } from 'react';
import {
  Bot, Plus, Pencil, Trash2, ToggleLeft, ToggleRight, Loader2, AlertTriangle,
  CheckCircle2, Star, MessagesSquare, HeartHandshake, ArrowLeft,
} from 'lucide-react';
import { cn } from '../../../components/ui/cn';
import { Badge } from '../../../components/ui/Badge';
import { Button } from '../../../components/ui/Button';
import MetaPanel from './MetaPanel';
import { metaApi } from './metaApi';
import { AGENT_TYPES } from './MetaConstants';

const splitList = (s) => String(s || '').split(',').map(x => x.trim().toLowerCase()).filter(Boolean);

const AgentForm = ({ agent, types, onCancel, onSaved }) => {
  const [f, setF] = useState(() => {
    const a = agent || {};
    const am = a.automation || {};
    const hh = a.humanHandoff || {};
    const crm = a.crmContext || {};
    return {
      name: a.name || '',
      type: a.type || types[0]?.id || 'custom',
      icon: a.icon || '',
      instructions: a.instructions || '',
      tone: a.tone || '',
      businessKnowledge: a.businessKnowledge || '',
      matchKeywords: (am.matchKeywords || []).join(', '),
      greeting: am.greeting ?? true,
      workingHoursOnly: am.workingHoursOnly ?? false,
      workingHoursStart: am.workingHoursStart || '09:00',
      workingHoursEnd: am.workingHoursEnd || '18:00',
      answerStopper: am.answerStopper || '',
      handoffKeywords: (hh.keywords || []).join(', '),
      handoffEnabled: hh.enabled ?? true,
      enabled: a.enabled ?? true,
      preferred: a.preferred ?? false,
      tags: (crm.tags || []).join(', '),
    };
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const typeMeta = types.find(t => t.id === f.type);

  const payload = () => ({
    name: f.name,
    type: f.type,
    icon: f.icon,
    instructions: f.instructions,
    tone: f.tone,
    businessKnowledge: f.businessKnowledge,
    automation: {
      enabled: f.enabled,
      greeting: f.greeting,
      workingHoursOnly: f.workingHoursOnly,
      workingHoursStart: f.workingHoursStart,
      workingHoursEnd: f.workingHoursEnd,
      matchKeywords: splitList(f.matchKeywords),
      answerStopper: f.answerStopper,
    },
    humanHandoff: { enabled: f.handoffEnabled, keywords: splitList(f.handoffKeywords) },
    crmContext: { tags: splitList(f.tags) },
    enabled: f.enabled,
    preferred: f.preferred,
  });

  const save = async () => {
    setBusy(true); setError(''); setNotice('');
    try {
      const res = agent?.id ? await metaApi.updateAgent(agent.id, payload()) : await metaApi.createAgent(payload());
      if (res.success) { setNotice('Saved.'); if (onSaved) onSaved(); }
      else setError(res.error || 'Save failed');
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  const input = 'mt-1 w-full bg-surface border border-border rounded-lg px-2.5 py-2 text-xs text-text-primary focus:outline-none focus:border-primary';

  return (
    <div className="p-4 max-w-2xl mx-auto space-y-3">
      <button onClick={onCancel} className="text-xs text-text-muted hover:text-text-primary flex items-center gap-1 transition-colors">
        <ArrowLeft size={14} /> Back to agents
      </button>

      {error && <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error flex items-start gap-2"><AlertTriangle size={14} className="shrink-0 mt-0.5" /> {error}</div>}
      {notice && <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-[11px] text-success flex items-start gap-2"><CheckCircle2 size={14} className="shrink-0 mt-0.5" /> {notice}</div>}

      <div className="grid sm:grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Agent name</span>
          <input className={input} value={f.name} onChange={e => setF(s => ({ ...s, name: e.target.value }))} placeholder="e.g. Sarah — Sales" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Type</span>
          <select className={input} value={f.type} onChange={e => setF(s => ({ ...s, type: e.target.value }))}>
            {types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
      </div>
      {typeMeta && <div className="text-[11px] text-text-muted">{typeMeta.defaultInstructions}</div>}

      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Avatar emoji</span>
        <input className={input} value={f.icon} onChange={e => setF(s => ({ ...s, icon: e.target.value }))} maxLength={4} placeholder="🤖" />
      </label>

      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Instructions / system prompt</span>
        <textarea rows={4} className={cn(input, 'resize-y')} value={f.instructions} onChange={e => setF(s => ({ ...s, instructions: e.target.value }))}
          placeholder="How this agent talks, what it can do, what it must avoid." />
      </label>

      <div className="grid sm:grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Tone</span>
          <input className={input} value={f.tone} onChange={e => setF(s => ({ ...s, tone: e.target.value }))} placeholder="Professional & friendly" />
        </label>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Business knowledge</span>
          <input className={input} value={f.businessKnowledge} onChange={e => setF(s => ({ ...s, businessKnowledge: e.target.value }))} placeholder="Products, policies, hours…" />
        </label>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3 space-y-2.5">
        <div className="text-[11px] font-semibold text-text-primary">Trigger & reply</div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Trigger keywords (comma separated)</span>
          <input className={input} value={f.matchKeywords} onChange={e => setF(s => ({ ...s, matchKeywords: e.target.value }))} placeholder="sale, price, order, hello (blank = replies to everything picked)" />
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-secondary">Greet new chats before replying</span>
          <button onClick={() => setF(s => ({ ...s, greeting: !s.greeting }))} className={cn(f.greeting ? 'text-[#00A884]' : 'text-text-muted hover:text-text-primary transition-colors')}>
            {f.greeting ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-secondary">Only reply during working hours</span>
          <button onClick={() => setF(s => ({ ...s, workingHoursOnly: !s.workingHoursOnly }))} className={cn(f.workingHoursOnly ? 'text-[#00A884]' : 'text-text-muted hover:text-text-primary transition-colors')}>
            {f.workingHoursOnly ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
        </div>
        {f.workingHoursOnly && (
          <div className="flex items-center gap-2">
            <input type="time" className={input} value={f.workingHoursStart} onChange={e => setF(s => ({ ...s, workingHoursStart: e.target.value }))} />
            <span className="text-xs text-text-muted">→</span>
            <input type="time" className={input} value={f.workingHoursEnd} onChange={e => setF(s => ({ ...s, workingHoursEnd: e.target.value }))} />
          </div>
        )}
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Answer stopper (skip AI when user says…)</span>
          <input className={input} value={f.answerStopper} onChange={e => setF(s => ({ ...s, answerStopper: e.target.value }))} placeholder="anything a human must handle alone" />
        </label>
      </div>

      <div className="rounded-xl border border-border bg-surface p-3 space-y-2.5">
        <div className="text-[11px] font-semibold text-text-primary">Human handoff</div>
        <label className="block">
          <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">Handoff keywords</span>
          <input className={input} value={f.handoffKeywords} onChange={e => setF(s => ({ ...s, handoffKeywords: e.target.value }))} placeholder="human, agent, refund, cancel, complaint" />
        </label>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[11px] text-text-secondary">Allow handoff</span>
          <button onClick={() => setF(s => ({ ...s, handoffEnabled: !s.handoffEnabled }))} className={cn(f.handoffEnabled ? 'text-[#00A884]' : 'text-text-muted hover:text-text-primary transition-colors')}>
            {f.handoffEnabled ? <ToggleRight size={22} /> : <ToggleLeft size={22} />}
          </button>
        </div>
      </div>

      <label className="block">
        <span className="text-[10px] uppercase tracking-wider text-text-muted font-medium">CRM tags (comma separated)</span>
        <input className={input} value={f.tags} onChange={e => setF(s => ({ ...s, tags: e.target.value }))} placeholder="lead, vip, real-estate" />
      </label>

      <div className="flex items-center gap-2 pt-1">
        <Button variant="default" size="sm" onClick={save} disabled={busy}>
          {busy ? <Loader2 size={13} className="animate-spin" /> : <CheckCircle2 size={13} />} Save agent
        </Button>
        <Button variant="outline" size="sm" onClick={onCancel}>Cancel</Button>
      </div>
    </div>
  );
};

const AiAgents = ({ isOpen, onClose, embedded = false }) => {
  const [agents, setAgents] = useState([]);
  const [types, setTypes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(null);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await metaApi.agents();
      setAgents(res.agents || []);
      const t = await metaApi.agentTypes();
      setTypes(t.types || []);
    } catch (e) { setError(e.message); }
    setLoading(false);
  }, []);
  useEffect(() => { if (embedded || isOpen) load(); }, [embedded, isOpen, load]);

  const toggleEnabled = async (a, value) => {
    setBusyId(a.id);
    try {
      const res = await metaApi.updateAgent(a.id, { enabled: value });
      if (res.success) setAgents(list => list.map(x => x.id === a.id ? res.agent : x));
    } catch (e) { setError(e.message); }
    setBusyId(null);
  };

  const remove = async (id) => {
    setBusyId(id);
    try { await metaApi.deleteAgent(id); setAgents(list => list.filter(x => x.id !== id)); setError(''); }
    catch (e) { setError(e.message); }
    setBusyId(null);
  };

  return (
    <MetaPanel
      isOpen={isOpen} onClose={onClose} embedded={embedded}
      title="AI Agents"
      subtitle="Reply automatically to incoming Meta messages inside the 24-hour customer window. Hand off to humans when needed."
      icon={<Bot size={16} className="text-primary" />}
      widthClass="max-w-4xl"
    >
      {!editing ? (
        <div className="h-full flex flex-col">
          <div className="flex items-center gap-2 px-3 py-2 border-b border-border shrink-0">
            <div className="text-[11px] text-text-muted">{agents.length} agent{agents.length === 1 ? '' : 's'}</div>
            <div className="flex-1" />
            <Button variant="outline" size="sm" onClick={() => setEditing(null)} className="hidden">
              <Plus size={13} /> New
            </Button>
            <button onClick={() => setEditing({})} className="h-7 px-3 rounded-lg bg-[#00A884]/15 text-[#00A884] text-[11px] font-semibold flex items-center gap-1.5 transition-colors hover:bg-[#00A884]/25">
              <Plus size={13} /> New agent
            </button>
          </div>

          {error && <div className="mx-3 mt-2 rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error">{error}</div>}

          <div className="flex-1 overflow-y-auto p-3">
            {loading ? (
              <div className="text-center py-10 text-xs text-text-muted"><Loader2 size={14} className="animate-spin inline mr-1.5" /> Loading…</div>
            ) : agents.length === 0 ? (
              <div className="text-center py-12 space-y-3">
                <Bot size={28} className="mx-auto text-text-muted" />
                <div className="text-xs text-text-muted">No AI agents yet. Create one to auto-answer incoming Meta messages.</div>
                {types.length === 0 && error && <div className="text-[11px] text-error">{error}</div>}
              </div>
            ) : (
              <div className="grid gap-2">
                {agents.map(a => (
                  <div key={a.id} className="bg-surface border border-border rounded-xl p-3 flex items-start gap-3">
                    <div className="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-lg shrink-0">{a.icon || AGENT_TYPES.find(t => t.id === a.type)?.icon}</div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-text-primary">{a.name}</span>
                        <Badge variant="outline" className="text-[9px]">{types.find(t => t.id === a.type)?.label || a.type}</Badge>
                        {a.preferred && <Badge variant="success" className="text-[9px] flex items-center gap-1"><Star size={9} /> preferred</Badge>}
                        <button onClick={() => toggleEnabled(a, !a.enabled)} disabled={busyId === a.id}
                          className={cn('ml-auto', a.enabled ? 'text-[#00A884]' : 'text-text-muted hover:text-text-primary transition-colors')} title={a.enabled ? 'Enabled' : 'Disabled'}>
                          {busyId === a.id ? <Loader2 size={18} className="animate-spin" /> : a.enabled ? <ToggleRight size={18} /> : <ToggleLeft size={18} />}
                        </button>
                      </div>
                      <div className="mt-1 text-[11px] text-text-muted line-clamp-2">{a.instructions}</div>
                      <div className="mt-2 flex items-center gap-3 text-[10px] text-text-muted">
                        <span className="flex items-center gap-1"><MessagesSquare size={10} /> {a.stats?.messagesHandled || 0} replied</span>
                        <span className="flex items-center gap-1"><HeartHandshake size={10} /> {a.stats?.handoffs || 0} handoffs</span>
                        <span className="ml-auto flex items-center gap-1.5">
                          <button onClick={() => setEditing(a)} className="p-1 rounded hover:bg-surface text-text-muted hover:text-text-primary transition-colors" title="Edit"><Pencil size={13} /></button>
                          <button onClick={() => remove(a.id)} className="p-1 rounded hover:bg-surface text-text-muted hover:text-error transition-colors" title="Delete"><Trash2 size={13} /></button>
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        <AgentForm
          agent={editing?.id ? agents.find(a => a.id === editing.id) : null}
          types={types}
          onCancel={() => setEditing(null)}
          onSaved={() => { setEditing(null); load(); }}
        />
      )}
    </MetaPanel>
  );
};

export default AiAgents;