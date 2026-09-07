import React, { useState, useEffect, useRef } from 'react';
import { Phone, MapPin, Clock, Edit, Star, Archive, MessageSquare, TrendingUp, Briefcase, FileText, Tag, X, Plus, Check, Save, Brain, Loader2, Target, ShieldBan, Bot, Trash2, Radio, BookmarkCheck, LayoutTemplate, Send, ShieldCheck, CheckCircle2 } from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Badge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '../../components/ui/Card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { Input } from '../../components/ui/Input';
import { useMessageAgent } from '../MessageAgentPage';
import { ContactAvatar } from './ContactAvatar';
import { metaApi } from './meta/metaApi';
import { templateVariables } from './meta/MetaConstants';
import WhatsAppTemplatePreview from './meta/WhatsAppTemplatePreview';

const JOURNEY_STAGES = [
  { key: 'new_lead', label: 'New Lead', color: 'bg-blue-500/10 text-blue-400 border-blue-500/30' },
  { key: 'contacted', label: 'Contacted', color: 'bg-purple-500/10 text-purple-400 border-purple-500/30' },
  { key: 'interested', label: 'Interested', color: 'bg-success/10 text-success border-success/30' },
  { key: 'negotiation', label: 'In Negotiation', color: 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30' },
  { key: 'converted', label: 'Converted', color: 'bg-success/20 text-success border-success/30' },
  { key: 'closed', label: 'Closed', color: 'bg-text-muted/10 text-text-muted border-border' },
];

const NOTE_CATEGORIES = ['General', 'Follow-up', 'Meeting', 'Objection', 'Order'];

const OBJECTIVES = [
  { key: 'lead_qualification', label: 'Qualify Lead' },
  { key: 'product_inquiry', label: 'Product Inquiry' },
  { key: 'follow_up', label: 'Follow Up' },
  { key: 'appointment', label: 'Book Appointment' },
  { key: 'conversion', label: 'Convert to Sale' },
  { key: 'general', label: 'General Chat' },
];

const makeNoteId = () => `n_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const formatNoteDate = (ts) => {
  if (!ts) return '';
  try {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) + ' · ' +
      new Date(ts).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  } catch {
    return '';
  }
};

const ContactPanelBody = ({ onPhotoClick }) => {
  const { activeConversation, updateConversation, checkCompliance, blockContact, unblockContact } = useMessageAgent();
  const [activeTab, setActiveTab] = useState('profile');
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [editedNotes, setEditedNotes] = useState('');
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [editedTags, setEditedTags] = useState([]);
  const [isEditingCrm, setIsEditingCrm] = useState(false);
  const [crmData, setCrmData] = useState({});
  const [notesList, setNotesList] = useState([]);
  const [isAddingNote, setIsAddingNote] = useState(false);
  const [newNoteText, setNewNoteText] = useState('');
  const [newNoteCategory, setNewNoteCategory] = useState('General');
  const [editingNoteId, setEditingNoteId] = useState(null);
  const [editingNoteText, setEditingNoteText] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  const [complianceInfo, setComplianceInfo] = useState({ allowed: true, isBlocked: false, isSuppressed: false, checking: false });
  const [aiInsights, setAiInsights] = useState(null);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const insightsForIdRef = useRef(null);

  const [approvedTemplates, setApprovedTemplates] = useState([]);
  const [loadingTemplates, setLoadingTemplates] = useState(false);
  const [templateVars, setTemplateVars] = useState({});
  const [templateValues, setTemplateValues] = useState({});
  const [sendingTemplate, setSendingTemplate] = useState(false);
  const [templateError, setTemplateError] = useState('');
  const [templateSent, setTemplateSent] = useState('');

  useEffect(() => {
    if (activeTab !== 'templates' || !activeConversation?.contact?.phone) return;
    let alive = true;
    setLoadingTemplates(true); setTemplateError(''); setTemplateSent('');
    metaApi.templates('?status=APPROVED')
      .then(res => { if (alive) setApprovedTemplates(res.templates || []); })
      .catch(e => { if (alive) setTemplateError(e.message); })
      .finally(() => { if (alive) setLoadingTemplates(false); });
    return () => { alive = false; };
  }, [activeTab, activeConversation?.id]);

  useEffect(() => {
    if (activeConversation) {
      setEditedNotes(activeConversation.notes || '');
      setEditedTags(activeConversation.tags || []);
      setCrmData(activeConversation.crm || {});
      setNotesList(Array.isArray(activeConversation.notesList) ? activeConversation.notesList : []);
    }
  }, [activeConversation?.id, activeConversation?.notes, activeConversation?.tags, activeConversation?.crm, activeConversation?.notesList]);

  useEffect(() => {
    if (!activeConversation || activeTab !== 'profile') return;
    // Fetch once per (conversation) unless the profile tab is being (re)opened
    // after a different tab was shown — never on every keystroke/re-render.
    if (insightsForIdRef.current === activeConversation.id && !loadingInsights) return;
    fetchAiInsights();
  }, [activeConversation?.id, activeTab]);

  useEffect(() => {
    if (!activeConversation?.id) return;
    setComplianceInfo(prev => ({ ...prev, checking: true }));
    checkCompliance(activeConversation.id).then(data => {
      setComplianceInfo({
        allowed: data.allowed !== false,
        isBlocked: data.isBlocked === true,
        isSuppressed: data.isSuppressed === true,
        reason: data.reason || null,
        checking: false
      });
    }).catch(() => setComplianceInfo(prev => ({ ...prev, allowed: true, checking: false })));
  }, [activeConversation?.id, checkCompliance]);

  const fetchAiInsights = async () => {
    if (!activeConversation || loadingInsights) return;
    insightsForIdRef.current = activeConversation.id;
    setLoadingInsights(true);
    try {
      const [scoreRes, actionRes] = await Promise.all([
        fetch('/api/message-agent/intelligence/lead-score', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationHistory: (activeConversation.messages || []).slice(-20),
            contact: activeConversation.contact
          })
        }),
        fetch('/api/message-agent/intelligence/next-action', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            conversationState: {
              stage: activeConversation.journey || 'contacted',
              messageCount: (activeConversation.messages || []).length,
              lastMessage: activeConversation.messages?.slice(-1)[0]?.text || '',
              sentiment: 'neutral'
            }
          })
        })
      ]);
      const scoreData = await scoreRes.json();
      const actionData = await actionRes.json();
      setAiInsights({
        score: scoreData.success ? scoreData.score : null,
        nextAction: actionData.success ? actionData.action : null
      });
    } catch (err) {
    }
    setLoadingInsights(false);
  };

  if (!activeConversation) {
    return (
      <div className="w-full h-full border-l border-[var(--ma-line)] bg-[var(--ma-bg-panel)] flex items-center justify-center">
        <p className="text-[#8696A0] text-sm">Select a conversation</p>
      </div>
    );
  }

  const handleSaveNotes = async () => {
    await updateConversation(activeConversation.id, { notes: editedNotes });
    setIsEditingNotes(false);
  };

  const handleAddTag = async () => {
    if (!newTag.trim()) return;
    const tags = [...editedTags, newTag.trim()];
    setEditedTags(tags);
    setNewTag('');
    await updateConversation(activeConversation.id, { tags });
  };

  const handleRemoveTag = async (tagToRemove) => {
    const tags = editedTags.filter(t => t !== tagToRemove);
    setEditedTags(tags);
    await updateConversation(activeConversation.id, { tags });
  };

  const handleJourneyChange = async (journey) => {
    await updateConversation(activeConversation.id, { journey });
  };

  const handleSaveCrm = async () => {
    await updateConversation(activeConversation.id, { crm: crmData });
    setIsEditingCrm(false);
  };

  const handleToggleStar = async () => {
    await updateConversation(activeConversation.id, { starred: !activeConversation.starred });
  };

  const handleToggleArchive = async () => {
    await updateConversation(activeConversation.id, { archived: !activeConversation.archived });
  };

  const persistNotes = async (next) => {
    setSavingNote(true);
    try {
      await updateConversation(activeConversation.id, { notesList: next });
      setNotesList(next);
    } catch (err) {
    } finally {
      setSavingNote(false);
    }
  };

  const handleAddNote = async () => {
    const text = newNoteText.trim();
    if (!text) return;
    const note = { id: makeNoteId(), text, category: newNoteCategory, createdAt: new Date().toISOString() };
    await persistNotes([note, ...notesList]);
    setNewNoteText('');
    setNewNoteCategory('General');
    setIsAddingNote(false);
  };

  const handleUpdateNote = async (id) => {
    const text = editingNoteText.trim();
    if (!text) return;
    const next = notesList.map(n => n.id === id ? { ...n, text, updatedAt: new Date().toISOString() } : n);
    await persistNotes(next);
    setEditingNoteId(null);
    setEditingNoteText('');
  };

  const handleDeleteNote = async (id) => {
    const next = notesList.filter(n => n.id !== id);
    setEditingNoteId(null);
    await persistNotes(next);
  };

  const formatDate = (dateString) => {
    if (!dateString) return '---';
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const messages = activeConversation.messages || [];
  const sentMessages = messages.filter(m => m.from === 'me' || m.from === 'ai');
  const receivedMessages = messages.filter(m => m.from === 'them');
  const aiMessages = messages.filter(m => m.from === 'ai');

  return (
    <>
      {/* Contact Header — centered */}
      <div className="msg-detail-section border-b border-[rgba(255,255,255,0.06)] text-center shrink-0">
        <div className="flex items-center justify-end gap-1 mb-2">
          <button 
            onClick={handleToggleStar}
            className={cn("msg-icon-btn w-8 h-8", 
              activeConversation.starred ? "text-[#F5BB45] bg-[#F5BB45]/10" : "text-[#8696A0]"
            )}
            title={activeConversation.starred ? "Unstar" : "Star"}
          >
            <Star size={16} className={activeConversation.starred ? "fill-current" : ""} />
          </button>
          <button 
            onClick={handleToggleArchive}
            className={cn("msg-icon-btn w-8 h-8", 
              activeConversation.archived ? "text-[#F5BB45] bg-[#F5BB45]/10" : "text-[#8696A0]"
            )}
            title={activeConversation.archived ? "Unarchive" : "Archive"}
          >
            <Archive size={16} />
          </button>
        </div>
        <div className="flex justify-center">
          <ContactAvatar
            contact={activeConversation.contact}
            size="lg"
            onPhotoClick={onPhotoClick}
          />
        </div>
        <div className="mt-3">
          <div className="flex items-center justify-center gap-1.5">
            <h2 className="mp-profile-name truncate">{activeConversation.contact.name}</h2>
            {activeConversation.saved && (
              <span className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium shrink-0" style={{ color: 'var(--success)', backgroundColor: 'color-mix(in srgb, var(--success) 10%, transparent)' }}>
                <BookmarkCheck size={10} />
                Saved
              </span>
            )}
          </div>
          <p className="mp-phone-muted mt-1 truncate">+{String(activeConversation.contact.phone || '').replace(/^\+/, '')}</p>
          <div className="flex items-center justify-center gap-1 mt-1.5">
            <MapPin size={12} className="text-[#8696A0] shrink-0" />
            <span className="text-[11px] text-[#8696A0] truncate">{activeConversation.contact.country}</span>
          </div>
        </div>
      </div>

      {/* WhatsApp / AI Mode toggle */}
      <div className="px-4 py-4 border-b border-[rgba(255,255,255,0.06)] shrink-0">
        <div className="flex gap-2">
          <button
            onClick={() => updateConversation(activeConversation.id, { mode: 'manual' })}
            className={cn(
              "h-9 flex-1 px-3 text-[12px] font-medium rounded-md cursor-pointer transition-all flex items-center justify-center gap-1",
              activeConversation.mode !== 'ai' ? "bg-[#00A884] text-white" : "bg-transparent text-[#8696A0] border border-[rgba(255,255,255,0.08)]"
            )}
          >
            <Phone size={12} />
            Manual
          </button>
          <button
            onClick={() => updateConversation(activeConversation.id, { mode: 'ai' })}
            className={cn(
              "h-9 flex-1 px-3 text-[12px] font-medium rounded-md cursor-pointer transition-all flex items-center justify-center gap-1",
              activeConversation.mode === 'ai' ? "bg-[#00A884] text-white" : "bg-transparent text-[#8696A0] border border-[rgba(255,255,255,0.08)]"
            )}
          >
            <Bot size={12} />
            AI Auto-Reply
          </button>
        </div>
        {activeConversation.mode === 'ai' && (
          <div className="flex items-center gap-1.5 mt-2">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#00A884] opacity-60" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[#00A884]" />
            </span>
            <span className="text-[11px] text-[#00A884]">
              AI is enabled for this contact — incoming messages are answered automatically.
            </span>
          </div>
        )}
      </div>

      {/* Profile Button */}
      <div className="px-4 pt-4 shrink-0">
        <button
          onClick={() => setActiveTab('profile')}
          className="w-full h-10 bg-[#00A884] text-white font-semibold text-[13px] rounded-lg cursor-pointer hover:bg-[#06CF9C] transition-colors"
        >
          Profile
        </button>
      </div>

      {/* Additional Action Tabs: CRM / Notes / Stats / Templates */}
      <div className="flex gap-2 px-4 py-4 shrink-0">
        {[
          { key: 'crm', label: 'CRM' },
          { key: 'notes', label: 'Notes' },
          { key: 'stats', label: 'Stats' },
          { key: 'templates', label: 'Templates' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => { setActiveTab(tab.key); setTemplateVars({}); setTemplateValues({}); setTemplateError(''); }}
            className={cn(
              "flex-1 h-9 px-3 text-[12px] font-medium rounded-md cursor-pointer transition-all border",
              activeTab === tab.key
                ? "bg-[#00A884] text-white border-[#00A884]"
                : "bg-transparent border border-[rgba(255,255,255,0.1)] text-[#8696A0] hover:bg-[#202C33]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="msg-agent-scroll flex-1 overflow-y-auto overflow-x-hidden min-h-0 custom-scrollbar"
        style={{
          flex: '1 1 0',
          minHeight: 0,
          width: '100%',
          overflowY: 'auto',
          overflowX: 'hidden',
          scrollBehavior: 'smooth',
          overscrollBehavior: 'contain',
          scrollbarWidth: 'thin',
          scrollbarColor: '#374151 transparent',
        }}
      >
        <div className="flex flex-col min-h-full">
        {activeTab === 'profile' && (
          <>
            {/* Customer Journey */}
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <TrendingUp size={12} className="text-[#00A884]" />
                Customer Journey
              </div>
              <div className="grid grid-cols-2 gap-2">
                {JOURNEY_STAGES.map(stage => (
                  <button
                    key={stage.key}
                    onClick={() => handleJourneyChange(stage.key)}
                    className={cn(
                      "px-3 py-2 text-[11px] font-medium rounded-md border transition-all text-left",
                      activeConversation.journey === stage.key 
                        ? stage.color + " ring-1 ring-[#00A884]/30" 
                        : "bg-[#202C33] border-[rgba(255,255,255,0.08)] text-[#8696A0] hover:bg-[#2A3942]"
                    )}
                  >
                    {stage.label}
                  </button>
                ))}
              </div>
            </div>

            {/* AI Insights */}
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <Brain size={12} className="text-[#00A884]" />
                AI Insights
              </div>
              {loadingInsights ? (
                <div className="flex items-center gap-2 py-2">
                  <Loader2 size={12} className="animate-spin text-[#00A884]" />
                  <span className="text-[11px] text-[#8696A0]">Analyzing...</span>
                </div>
              ) : aiInsights ? (
                <div className="space-y-2">
                  {aiInsights.score && (
                    <div className="msg-detail-item">
                      <span className="text-[11px] text-[#8696A0]">Lead Quality</span>
                      <span className="text-[11px] font-medium text-[#E9EDEF]">{aiInsights.score.overall || 0}</span>
                    </div>
                  )}
                  {aiInsights.nextAction && (
                    <div className="p-2 rounded-md bg-[#00A884]/10 border border-[#00A884]/25">
                      <div className="flex items-center gap-1 mb-0.5">
                        <Target size={9} className="text-[#00A884]" />
                        <span className="text-[10px] font-medium text-[#00A884]">Recommended Action</span>
                      </div>
                      <p className="text-[11px] text-[#8696A0]">{aiInsights.nextAction.reason || aiInsights.nextAction.action || 'Follow up'}</p>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-[#8696A0] text-center py-2">No insights available</p>
              )}
            </div>

            {/* About */}
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <FileText size={12} className="text-[#00A884]" />
                About
              </div>
              <p className="text-[11px] text-[#8696A0] leading-relaxed">
                {activeConversation.contact.about || 'No about information available.'}
              </p>
            </div>

            {/* Compliance */}
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <ShieldBan size={12} className={complianceInfo.allowed ? 'text-[#8696A0]' : 'text-[#F15C6D]'} />
                Compliance
              </div>
              {complianceInfo.checking ? (
                <div className="flex items-center gap-1.5 py-1.5">
                  <Loader2 size={10} className="animate-spin text-[#8696A0]" />
                  <span className="text-[11px] text-[#8696A0]">Checking...</span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="msg-detail-item">
                    <span className="text-[11px] text-[#8696A0]">Status</span>
                    <span className={cn("px-1.5 py-px text-[10px] font-medium rounded-full border",
                      complianceInfo.allowed ? "bg-[#00A884]/10 text-[#00A884] border-[#00A884]/30" :
                      complianceInfo.isBlocked ? "bg-[#F15C6D]/10 text-[#F15C6D] border-[#F15C6D]/30" :
                      "bg-[#F5BB45]/10 text-[#F5BB45] border-[#F5BB45]/30"
                    )}>
                      {complianceInfo.isBlocked ? 'Blocked' : complianceInfo.isSuppressed ? 'Opted Out' : 'Active'}
                    </span>
                  </div>
                  <div className="msg-detail-item">
                    <span className="text-[11px] text-[#8696A0]">Block</span>
                    {complianceInfo.allowed ? (
                      <button
                        onClick={async () => {
                          await blockContact(activeConversation.id, 'Manual block from contact panel');
                          setComplianceInfo({ allowed: false, isBlocked: true, isSuppressed: false, reason: 'Manual block', checking: false });
                        }}
                        className="px-1.5 py-px text-[10px] font-medium rounded-full bg-[#F15C6D]/10 text-[#F15C6D] border border-[#F15C6D]/30 hover:bg-[#F15C6D]/20 cursor-pointer"
                      >
                        Block
                      </button>
                    ) : (
                      <button
                        onClick={async () => {
                          await unblockContact(activeConversation.id);
                          setComplianceInfo({ allowed: true, isBlocked: false, isSuppressed: false, checking: false });
                        }}
                        className="px-1.5 py-px text-[10px] font-medium rounded-full bg-[#00A884]/10 text-[#00A884] border border-[#00A884]/30 hover:bg-[#00A884]/20 cursor-pointer"
                      >
                        Unblock
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Tags */}
            <div className="msg-detail-section">
              <div className="msg-detail-header flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Tag size={12} className="text-[#00A884]" />
                  Tags
                </div>
                <button 
                  onClick={() => setIsEditingTags(!isEditingTags)}
                  className="text-[11px] text-[#00A884] hover:text-[#06CF9C] font-medium"
                >
                  {isEditingTags ? 'Done' : 'Edit'}
                </button>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {editedTags.map((tag, index) => (
                  <span key={index} className="px-1.5 py-0.5 text-[10px] bg-[#202C33] text-[#8696A0] rounded border border-[rgba(255,255,255,0.08)] flex items-center gap-0.5">
                    {tag}
                    {isEditingTags && (
                      <button onClick={() => handleRemoveTag(tag)} className="ml-0.5 hover:text-error">
                        <X size={8} />
                      </button>
                    )}
                  </span>
                ))}
                {editedTags.length === 0 && (
                  <span className="text-[11px] text-[#8696A0]">No tags</span>
                )}
              </div>
              {isEditingTags && (
                <div className="flex gap-1.5 mt-2">
                  <Input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    placeholder="Add tag..."
                    className="h-7 text-[11px] flex-1"
                    onKeyDown={(e) => e.key === 'Enter' && handleAddTag()}
                  />
                  <Button size="icon" className="h-7 w-7 shrink-0" onClick={handleAddTag}>
                    <Plus size={12} />
                  </Button>
                </div>
              )}
            </div>

            {/* Details */}
            <div className="msg-detail-section border-b-0">
              <div className="msg-detail-header">
                <Clock size={12} className="text-[#8696A0]" />
                Details
              </div>
              <div className="space-y-1.5">
                <div className="msg-detail-item">
                  <span className="text-[11px] text-[#8696A0]">WhatsApp Status</span>
                  <span className={cn("px-1.5 py-px text-[10px] font-medium rounded-full border",
                    activeConversation.contact.exists ? "bg-[#00A884]/10 text-[#00A884] border-[#00A884]/30" : "bg-[#F5BB45]/10 text-[#F5BB45] border-[#F5BB45]/30"
                  )}>
                    {activeConversation.contact.exists ? 'Registered' : 'Not Registered'}
                  </span>
                </div>
                <div className="msg-detail-item">
                  <span className="text-[11px] text-[#8696A0]">Added</span>
                  <span className="text-[11px] text-[#8696A0]">{formatDate(activeConversation.createdAt)}</span>
                </div>
              </div>
            </div>
          </>
        )}

        {activeTab === 'crm' && (
          <>
            <div className="msg-detail-section">
              <div className="msg-detail-header">
                <Briefcase size={12} className="text-[#00A884]" />
                Business Information
              </div>
              {isEditingCrm ? (
                <div className="space-y-2">
                    <div>
                      <label className="text-[10px] text-[#8696A0] uppercase tracking-wider mb-0.5 block">Company</label>
                    <Input value={crmData.company || ''} onChange={(e) => setCrmData(prev => ({ ...prev, company: e.target.value }))} placeholder="Company name" className="h-7 text-[11px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8696A0] uppercase tracking-wider mb-0.5 block">Position</label>
                    <Input value={crmData.position || ''} onChange={(e) => setCrmData(prev => ({ ...prev, position: e.target.value }))} placeholder="Job title" className="h-7 text-[11px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8696A0] uppercase tracking-wider mb-0.5 block">Website</label>
                    <Input value={crmData.website || ''} onChange={(e) => setCrmData(prev => ({ ...prev, website: e.target.value }))} placeholder="https://example.com" className="h-7 text-[11px]" />
                  </div>
                  <div>
                    <label className="text-[10px] text-[#8696A0] uppercase tracking-wider mb-0.5 block">Email</label>
                    <Input value={crmData.email || ''} onChange={(e) => setCrmData(prev => ({ ...prev, email: e.target.value }))} placeholder="email@example.com" className="h-7 text-[11px]" />
                  </div>
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSaveCrm} className="h-8">
                      <Save size={10} className="mr-1" />
                      Save
                    </Button>
                    <Button size="sm" variant="outline" className="h-8" onClick={() => setIsEditingCrm(false)}>Cancel</Button>
                  </div>
                </div>
              ) : (
                <div className="space-y-2">
                  {crmData.company && (
                    <div className="msg-detail-item justify-start gap-2">
                      <span className="text-[11px] text-[#8696A0]">Company</span>
                      <span className="text-[11px] font-medium text-[#E9EDEF]">{crmData.company}</span>
                    </div>
                  )}
                  {crmData.position && (
                    <div className="msg-detail-item justify-start gap-2">
                      <span className="text-[11px] text-[#8696A0]">Position</span>
                      <span className="text-[11px] font-medium text-[#E9EDEF]">{crmData.position}</span>
                    </div>
                  )}
                  {!crmData.company && !crmData.position && !crmData.website && !crmData.email && (
                    <p className="text-[11px] text-[#8696A0] text-center py-3">No CRM data yet.</p>
                  )}
                  <Button size="sm" variant="outline" className="h-8 w-full" onClick={() => setIsEditingCrm(true)}>
                    <Edit size={10} className="mr-1" />
                    Edit CRM Data
                  </Button>
                </div>
              )}
            </div>

            {/* Conversation Flow */}
            <div className="msg-detail-section border-b-0">
              <div className="msg-detail-header">
                <MessageSquare size={12} className="text-[#00A884]" />
                Conversation Flow
              </div>
              <div className="space-y-2">
                {JOURNEY_STAGES.map((stage, idx) => {
                  const isActive = activeConversation.journey === stage.key;
                  const isPast = JOURNEY_STAGES.findIndex(s => s.key === activeConversation.journey) > idx;
                  return (
                    <div key={stage.key} className="flex items-center gap-2">
                      <div className={cn(
                        "w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium shrink-0",
                        isActive ? "bg-[#00A884] text-white" : isPast ? "bg-[#00A884]/20 text-[#00A884]" : "bg-[#202C33] border border-[rgba(255,255,255,0.08)] text-[#8696A0]"
                      )}>
                        {isPast ? <Check size={10} /> : idx + 1}
                      </div>
                      <div className="flex-1">
                        <p className={cn("text-[11px] font-medium", isActive ? "text-[#E9EDEF]" : "text-[#8696A0]")}>{stage.label}</p>
                      </div>
                      {isActive && <span className="px-1.5 py-px text-[9px] font-medium bg-[#00A884]/10 text-[#00A884] border border-[#00A884]/30 rounded">Current</span>}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* AI Objective */}
            <div className="msg-detail-section border-b-0">
              <div className="msg-detail-header">
                <Target size={12} className="text-[#00A884]" />
                AI Objective
              </div>
              <p className="text-[10px] text-[#8696A0] mb-2 leading-relaxed">
                The goal the AI assistant pursues while replying to this lead.
              </p>
              <div className="grid grid-cols-2 gap-2">
                {OBJECTIVES.map(obj => (
                  <button
                    key={obj.key}
                    onClick={() => updateConversation(activeConversation.id, { aiObjective: obj.key })}
                    className={cn(
                      "px-2.5 py-2 text-[11px] font-medium rounded-md border transition-all text-left",
                      (activeConversation.aiObjective || 'lead_qualification') === obj.key
                        ? "bg-[#00A884]/10 text-[#00A884] border-[#00A884]/40 ring-1 ring-[#00A884]/30"
                        : "bg-[#202C33] border-[rgba(255,255,255,0.08)] text-[#8696A0] hover:bg-[#2A3942]"
                    )}
                  >
                    {obj.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {activeTab === 'notes' && (
          <div className="msg-detail-section border-b-0">
            <div className="msg-detail-header flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <MessageSquare size={12} className="text-[#00A884]" />
                Internal Notes
                <span className="px-1.5 py-px text-[9px] font-medium bg-[#202C33] text-[#8696A0] border border-[rgba(255,255,255,0.08)] rounded">
                  {notesList.length}
                </span>
              </div>
              <button
                onClick={() => { setIsAddingNote(true); setEditingNoteId(null); }}
                className="text-[11px] text-[#00A884] hover:text-[#06CF9C] font-medium flex items-center gap-0.5"
              >
                <Plus size={10} />
                Add Note
              </button>
            </div>

            {savingNote && (
              <div className="flex items-center gap-1.5 py-1.5">
                <Loader2 size={10} className="animate-spin text-[#00A884]" />
                <span className="text-[11px] text-[#8696A0]">Saving...</span>
              </div>
            )}

            {isAddingNote && (
              <div className="mt-2 p-2 rounded-lg border border-[#00A884]/25 bg-[#00A884]/5">
                <textarea
                  value={newNoteText}
                  onChange={(e) => setNewNoteText(e.target.value)}
                  className="w-full min-h-[64px] p-2 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#111B21] resize-none focus:outline-none focus:ring-2 focus:ring-[#00A884]/30 text-[12px] text-[#E9EDEF]"
                  placeholder="Write a note about this contact..."
                  autoFocus
                />
                <div className="flex items-center gap-1.5 mt-1.5">
                  <select
                    value={newNoteCategory}
                    onChange={(e) => setNewNoteCategory(e.target.value)}
                    className="h-7 flex-1 px-1.5 text-[11px] bg-[#202C33] text-[#8696A0] border border-[rgba(255,255,255,0.08)] rounded-md focus:outline-none"
                  >
                    {NOTE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                  <Button size="sm" className="h-7 px-2 text-[11px]" onClick={handleAddNote} disabled={!newNoteText.trim()}>
                    <Check size={10} className="mr-1" />
                    Save
                  </Button>
                  <Button size="sm" variant="outline" className="h-7 px-2 text-[11px]" onClick={() => { setIsAddingNote(false); setNewNoteText(''); }}>
                    Cancel
                  </Button>
                </div>
              </div>
            )}

            <div className="space-y-2 mt-2">
              {notesList.map((note) => (
                <div key={note.id} className="p-2 rounded-lg bg-[#202C33] border border-[rgba(255,255,255,0.06)]">
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="px-1.5 py-px text-[9px] font-medium bg-[#00A884]/10 text-[#00A884] border border-[#00A884]/30 rounded shrink-0">
                        {note.category || 'General'}
                      </span>
                      <span className="text-[9px] text-[#8696A0] truncate">
                        {formatNoteDate(note.createdAt)}
                      </span>
                    </div>
                    <div className="flex items-center gap-0.5 shrink-0">
                      {editingNoteId === note.id ? (
                        <button onClick={() => { handleUpdateNote(note.id); }} className="text-[10px] text-[#00A884] hover:text-[#06CF9C]" title="Save">
                          <Check size={10} />
                        </button>
                      ) : (
                        <button onClick={() => { setEditingNoteId(note.id); setEditingNoteText(note.text); setIsAddingNote(false); }} className="text-[10px] text-[#8696A0] hover:text-[#E9EDEF]" title="Edit note">
                          <Edit size={10} />
                        </button>
                      )}
                      <button onClick={() => handleDeleteNote(note.id)} className="text-[10px] text-[#8696A0] hover:text-error" title="Delete note">
                        <Trash2 size={10} />
                      </button>
                    </div>
                  </div>
                  {editingNoteId === note.id ? (
                    <textarea
                      value={editingNoteText}
                      onChange={(e) => setEditingNoteText(e.target.value)}
                      className="w-full min-h-[48px] p-1.5 rounded-md border border-[rgba(255,255,255,0.08)] bg-[#111B21] resize-none focus:outline-none focus:ring-2 focus:ring-[#00A884]/30 text-[12px] text-[#E9EDEF]"
                      autoFocus
                    />
                  ) : (
                    <p className="text-[12px] text-[#E9EDEF] leading-relaxed whitespace-pre-wrap break-words">{note.text}</p>
                  )}
                </div>
              ))}
              {notesList.length === 0 && !isAddingNote && (
                <p className="text-[12px] text-[#8696A0] text-center py-6">
                  No notes yet. Add internal notes, objections or follow-up reminders for this customer.
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="msg-detail-section border-b-0">
            <div className="msg-detail-header">
              <LayoutTemplate size={12} className="text-[#00A884]" />
              Approved Templates
            </div>
            {templateError && (
              <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error mb-2">{templateError}</div>
            )}
            {templateSent && (
              <div className="rounded-lg bg-success/10 border border-success/30 px-3 py-2 text-[11px] text-success mb-2 flex items-center gap-1.5"><CheckCircle2 size={12} /> {templateSent}</div>
            )}
            {loadingTemplates ? (
              <div className="flex items-center justify-center py-8 text-[11px] text-[#8696A0]"><Loader2 size={13} className="animate-spin mr-2" /> Loading approved templates…</div>
            ) : approvedTemplates.length === 0 ? (
              <div className="py-6 text-center">
                <div className="w-10 h-10 mx-auto rounded-full bg-[#202C33] flex items-center justify-center">
                  <ShieldCheck size={16} className="text-[#8696A0]" />
                </div>
                <p className="mt-2 text-[11px] text-[#8696A0]">No approved templates yet.</p>
                <p className="text-[10px] text-[#8696A0]/70 mt-0.5">Approve one in Meta → Templates, then send it here in one click.</p>
              </div>
            ) : (
              <div className="space-y-2">
                <div className="text-[10px] text-[#8696A0]">Send a Meta-approved template to {activeConversation.contact.name || `+${activeConversation.contact.phone || ''}`}.</div>
                <select
                  value={templateVars.name || ''}
                  onChange={(e) => { const t = approvedTemplates.find(x => x.name === e.target.value); setTemplateVars(t || {}); setTemplateValues({}); setTemplateError(''); }}
                  className="w-full bg-[#0B141A] border border-[#1F2C33] rounded-lg px-2.5 py-2 text-[11px] text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
                >
                  <option value="">Select an approved template…</option>
                  {approvedTemplates.map(t => (
                    <option key={t.name} value={t.name}>{t.name} — {t.category}</option>
                  ))}
                </select>

                {templateVars.name && (
                  <>
                    <div className="rounded-xl bg-[#0B141A] border border-[#1F2C33] p-2">
                      <div className="text-[10px] text-[#8696A0] font-medium mb-1.5">WhatsApp-style preview</div>
                      <WhatsAppTemplatePreview template={templateVars} values={templateValues} />
                    </div>

                    {templateVariables(templateVars).length > 0 && (
                      <div className="space-y-1.5">
                        <div className="text-[10px] text-[#8696A0]">Template variables</div>
                        {templateVariables(templateVars).map(n => (
                          <div key={n} className="flex items-center gap-1.5">
                            <span className="text-[10px] bg-[#202C33] px-1.5 py-0.5 rounded border border-[#1F2C33] font-mono text-[#8696A0]">{`{{${n}}}`}</span>
                            <input
                              value={templateValues[n] || ''}
                              onChange={e => setTemplateValues(v => ({ ...v, [n]: e.target.value }))}
                              placeholder={`Value for ${n}`}
                              className="flex-1 bg-[#0B141A] border border-[#1F2C33] rounded-lg px-2 py-1.5 text-[11px] text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
                            />
                          </div>
                        ))}
                      </div>
                    )}

                    <Button
                      size="sm"
                      className="w-full h-9"
                      disabled={sendingTemplate || !activeConversation?.contact?.phone}
                      onClick={async () => {
                        setSendingTemplate(true); setTemplateError(''); setTemplateSent('');
                        try {
                          const phone = (activeConversation.contact.phone || '').replace(/\D/g, '');
                          if (!phone) { setTemplateError('This contact has no phone number.'); setSendingTemplate(false); return; }
                          const variables = {};
                          templateVariables(templateVars).forEach(n => { if (templateValues[n]?.trim()) variables[n] = templateValues[n].trim(); });
                          const res = await metaApi.sendTemplate({ to: phone, templateName: templateVars.name, language: templateVars.language || 'en', variables });
                          if (res.success) {
                            setTemplateSent(`✓ Template sent to ${activeConversation.contact.name || phone}.`);
                            setTemplateValues({});
                          } else {
                            setTemplateError(res.error || 'Send failed');
                          }
                        } catch (e) { setTemplateError(e.message); }
                        setSendingTemplate(false);
                      }}
                    >
                      {sendingTemplate ? <Loader2 size={12} className="animate-spin mr-1" /> : <Send size={12} className="mr-1" />} Send via Meta
                    </Button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {activeTab === 'stats' && (
          <div className="msg-detail-section border-b-0">
            <div className="msg-detail-header">
              <TrendingUp size={12} className="text-[#00A884]" />
              Engagement Metrics
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="p-2 rounded-md bg-[#202C33] border border-[rgba(255,255,255,0.06)] text-center">
                <p className="text-lg font-bold text-[#E9EDEF]">{messages.length}</p>
                <p className="text-[10px] text-[#8696A0]">Total Messages</p>
              </div>
              <div className="p-2 rounded-md bg-[#202C33] border border-[rgba(255,255,255,0.06)] text-center">
                <p className="text-lg font-bold text-[#00A884]">{sentMessages.length}</p>
                <p className="text-[10px] text-[#8696A0]">Sent</p>
              </div>
              <div className="p-2 rounded-md bg-[#202C33] border border-[rgba(255,255,255,0.06)] text-center">
                <p className="text-lg font-bold text-success">{receivedMessages.length}</p>
                <p className="text-[10px] text-[#8696A0]">Received</p>
              </div>
              <div className="p-2 rounded-md bg-[#202C33] border border-[rgba(255,255,255,0.06)] text-center">
                <p className="text-lg font-bold text-info">{aiMessages.length}</p>
                <p className="text-[10px] text-[#8696A0]">AI Responses</p>
              </div>
            </div>
            <div className="space-y-1.5 pt-3 mt-3 border-t border-[rgba(255,255,255,0.06)]">
              <div className="msg-detail-item">
                <span className="text-[11px] text-[#8696A0]">Response Rate</span>
                <span className="text-[11px] font-medium text-[#00A884]">
                  {sentMessages.length > 0 ? Math.round((receivedMessages.length / sentMessages.length) * 100) : 0}%
                </span>
              </div>
              <div className="msg-detail-item">
                <span className="text-[11px] text-[#8696A0]">AI vs Manual</span>
                <span className="text-[11px] font-medium text-[#E9EDEF]">
                  {aiMessages.length} / {sentMessages.length - aiMessages.length}
                </span>
              </div>
              <div className="msg-detail-item">
                <span className="text-[11px] text-[#8696A0]">Conversation Started</span>
                <span className="text-[11px] text-[#8696A0]">{formatDate(activeConversation.createdAt)}</span>
              </div>
            </div>
          </div>
        )}
        </div>
      </div>
    </>
  );
};

const ContactPanel = ({ onClose, onPhotoClick }) => {
  return (
    <div className="msg-detail-panel w-full shrink-0">
      <div className="flex items-center justify-end px-4 pt-3 shrink-0">
        {onClose && (
          <button
            onClick={onClose}
            className="msg-icon-btn w-8 h-8"
            title="Close"
          >
            <X size={16} />
          </button>
        )}
      </div>
      <ContactPanelBody onPhotoClick={onPhotoClick} />
    </div>
  );
};

export { ContactPanel, ContactPanelBody };
