import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { 
  ChevronLeft, Send, Bot, Smile, Paperclip, 
  Reply, Forward, Trash2, Star, Copy, CheckCheck, Clock, 
  AlertCircle, ArrowDown, X, Image, FileText, Camera, Mic, MicOff,
  Search, MessageSquare, Sparkles, Lightbulb, Loader2, ShieldBan,
  Bold, Italic, Strikethrough, Code, Trash, Play, CheckCircle2,
  UserPlus, UserCheck, BookmarkCheck, LayoutTemplate, Building2
} from 'lucide-react';
import { cn } from '../../components/ui/cn';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { useMessageAgent } from '../MessageAgentPage';
import { useWebSocket } from '../../context/WebSocketProvider';
import { ContactAvatar } from './ContactAvatar';
import { showToast } from '../../components/ui/ToastNotification';
import { metaApi } from './meta/metaApi';
import { templateVariables } from './meta/MetaConstants';
import WhatsAppTemplatePreview from './meta/WhatsAppTemplatePreview';

// Per-chat draft cache so switching conversations preserves the composer text.
const draftCache = new Map();

const FORMAT_CHARS = [
  { marker: '**', label: 'Bold', icon: Bold },
  { marker: '_', label: 'Italic', icon: Italic },
  { marker: '~', label: 'Strikethrough', icon: Strikethrough },
  { marker: '`', label: 'Monospace', icon: Code },
];

// Render WhatsApp-style markdown markers (bold/italic/strike/mono) locally.
const renderWhatsAppText = (text) => {
  if (typeof text !== 'string' || !text) return null;
  const regex = /(\*\*\*[^*]+\*\*\*|\*\*[^*]+\*\*|_[^_]+_|~[^~]+~|`[^`]+`)/g;
  const parts = text.split(regex);
  return parts.map((part, i) => {
    if (!part) return null;
    if (/^\*\*\*[^*]+\*\*\*$/.test(part)) return <strong key={i}><em>{part.slice(3, -3)}</em></strong>;
    if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (/^_[^_]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
    if (/^~[^~]+~$/.test(part)) return <strike key={i}>{part.slice(1, -1)}</strike>;
    if (/^`[^`]+`$/.test(part)) return <code key={i} className="px-1 py-0.5 rounded bg-[rgba(0,0,0,0.25)] text-[12px]">{part.slice(1, -1)}</code>;
    return <span key={i}>{part}</span>;
  });
};

const MessageBubbleBase = ({ message, isLast, onAction }) => {
  const [showActions, setShowActions] = useState(false);
  const isMe = message.from === 'me';
  const isAI = message.from === 'ai';
  const isSystem = message.from === 'system';
  const isDeleted = message.deleted;

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <div className="px-3 py-1 rounded-lg msg-system text-[12px] shadow-sm">
          {typeof message.text === 'string' ? message.text : ''}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn("flex group", isMe ? "justify-end" : "justify-start")}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className={cn("relative max-w-[85%] sm:max-w-[75%] lg:max-w-[60%]")}>
        {showActions && !isDeleted && (
          <div className={cn(
            "absolute top-0 z-10 flex items-center gap-0.5 p-1 rounded-lg msg-action-menu",
            isMe ? "right-full mr-2" : "left-full ml-2"
          )}>
            <button onClick={() => onAction('reply', message)} className="msg-action-btn" title="Reply">
              <Reply size={11} />
            </button>
            <button onClick={() => onAction('forward', message)} className="msg-action-btn" title="Forward">
              <Forward size={11} />
            </button>
            <button onClick={() => onAction('copy', message)} className="msg-action-btn" title="Copy">
              <Copy size={11} />
            </button>
            <button
              onClick={() => onAction('star', message)}
              className={cn("msg-action-btn", message.starred && "text-[#F5BB45]")}
              title="Star"
            >
              <Star size={11} className={message.starred ? "fill-current" : ""} />
            </button>
            {isMe && (
              <button onClick={() => onAction('delete', message)} className="msg-action-btn hover:!text-error" title="Delete">
                <Trash2 size={11} />
              </button>
            )}
          </div>
        )}

        <div
          className={cn(
            "msg-bubble-new shadow-sm",
            isMe
              ? "sent"
              : isAI
              ? "ai-msg"
              : isDeleted
              ? "msg-bubble-deleted"
              : "received"
          )}
        >
          {isAI && !isDeleted && (
            <div className="flex items-center justify-between gap-1.5 mb-1">
              <div className="flex items-center gap-1.5">
                <div className="w-4 h-4 rounded-full bg-success/20 flex items-center justify-center">
                  <Bot size={9} className="text-success" />
                </div>
                <span className="text-[10px] font-medium text-success">AI Assistant</span>
              </div>
              {(message.provider || message.model) && (
                <span className="text-[9px] font-medium text-text-muted uppercase tracking-wide">
                  {message.provider}{message.model ? ` • ${message.model}` : ''}
                </span>
              )}
            </div>
          )}
          
          {isDeleted ? (
            <p className="text-xs italic">You deleted this message</p>
          ) : message.complianceBlocked ? (
            <p className="text-xs italic text-error">Blocked — {typeof message.waError === 'string' ? message.waError : 'Contact cannot be messaged'}</p>
          ) : (
            <>
              {message.replyTo && (
                <div className={cn(
                  "text-[11px] p-1.5 rounded-lg mb-1.5 border-l-2",
                  isMe ? "bg-[#00A884]/15 border-[#00A884]" : "bg-[rgba(255,255,255,0.04)] border-[#00A884]"
                )}>
                  <p className="font-medium text-[9px] opacity-70 mb-0.5">{message.replyTo.from === 'me' ? 'You' : 'Them'}</p>
                  <p className="truncate opacity-80">{typeof message.replyTo.text === 'string' ? message.replyTo.text : ''}</p>
                </div>
              )}
              
              {message.attachment && (
                <div className={cn(
                  "flex items-center gap-2 p-1.5 rounded-lg mb-1.5",
                  isMe ? "bg-[#00A884]/15" : "bg-[rgba(255,255,255,0.04)]"
                )}>
                  <Paperclip size={13} className="opacity-70" />
                  <div className="min-w-0">
                    <p className="text-xs font-medium truncate">{message.attachment.name}</p>
                    <p className="text-[10px] opacity-60">{message.attachment.size ? `${(message.attachment.size / 1024).toFixed(1)} KB` : 'File'}</p>
                  </div>
                </div>
              )}
              {message.voiceNote && (
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="flex items-center gap-0.5">
                    <span className="w-1 h-3 bg-current rounded-full" />
                    <span className="w-1 h-4 bg-current rounded-full" />
                    <span className="w-1 h-2.5 bg-current rounded-full" />
                    <span className="w-1 h-3 bg-current rounded-full" />
                  </span>
                  <span className="text-xs">Voice message</span>
                </div>
              )}
              
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap break-words">
                {renderWhatsAppText(typeof message.text === 'string' ? message.text : '')}
              </p>
            </>
          )}
          
          <div className="flex items-center justify-end gap-1.5 mt-0.5 opacity-60">
            <span className="text-[10px]">
              {message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
            </span>
            {isMe && !isDeleted && (
              <span className="flex items-center">
                {message.status === 'sending' && <Clock size={11} className="animate-spin" />}
                {message.status === 'sent' && <CheckCheck size={11} />}
                {message.status === 'delivered' && <CheckCheck size={11} className="text-info" />}
                {message.status === 'read' && <CheckCheck size={11} className="text-info" />}
                {message.status === 'failed' && <AlertCircle size={11} className="text-error" />}
                {message.status === 'blocked' && <AlertCircle size={11} className="text-error" />}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const MessageBubble = React.memo(MessageBubbleBase);

const TypingIndicator = ({ isAI }) => (
  <div className="flex justify-start">
    <div className={cn(
      "rounded-2xl rounded-bl-md px-4 py-3",
      isAI ? "msg-bubble-ai" : "msg-bubble-received"
    )}>
      <div className="flex items-center gap-2">
        {isAI && <Bot size={12} className="text-success" />}
        <div className="flex items-center gap-1">
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isAI ? "bg-success" : "bg-text-muted")} />
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isAI ? "bg-success" : "bg-text-muted")} style={{ animationDelay: '0.2s' }} />
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isAI ? "bg-success" : "bg-text-muted")} style={{ animationDelay: '0.4s' }} />
        </div>
        <span className={cn("text-xs", isAI ? "text-success" : "text-text-muted")}>
          {isAI ? 'AI is thinking...' : 'Typing...'}
        </span>
      </div>
    </div>
  </div>
);

const ForwardDialog = ({ isOpen, onClose, onForward, conversations }) => {
  const [search, setSearch] = useState('');
  
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  
  const filtered = conversations.filter(c => 
    c.contact?.name?.toLowerCase().includes(search.toLowerCase()) ||
    c.contact?.phone?.includes(search)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-sm dialog-panel rounded-2xl shadow-2xl overflow-hidden">
        <div className="p-3 dialog-header">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-semibold text-sm text-text-primary">Forward to...</h3>
            <button onClick={onClose} className="p-1 rounded-lg hover:bg-background">
              <X size={16} className="text-text-muted" />
            </button>
          </div>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
            <Input placeholder="Search contacts..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-8 h-8 text-xs" />
          </div>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {filtered.map(conv => (
            <button
              key={conv.id}
              onClick={() => { onForward(conv); onClose(); }}
              className="w-full flex items-center gap-3 px-4 py-2.5 hover:bg-background transition-colors text-left"
            >
              <ContactAvatar contact={conv.contact} size="sm" />
              <div className="min-w-0">
                <p className="text-sm font-medium text-text-primary truncate">{conv.contact.name}</p>
                <p className="mp-phone-muted truncate">{conv.contact.phone}</p>
              </div>
            </button>
          ))}
          {filtered.length === 0 && (
            <p className="text-center text-text-muted text-sm py-8">No contacts found</p>
          )}
        </div>
      </div>
    </div>
  );
};

const DeleteConfirmDialog = ({ isOpen, onClose, onDeleteForMe, onDeleteForEveryone }) => {
  useEffect(() => {
    if (!isOpen) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [isOpen, onClose]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-[280px] dialog-panel rounded-2xl shadow-2xl overflow-hidden p-4">
        <h3 className="font-semibold text-sm text-text-primary mb-1.5">Delete message?</h3>
        <p className="text-xs text-text-secondary mb-3">This message will be deleted for you.</p>
        <div className="flex flex-col gap-1.5">
          <button onClick={onDeleteForMe} className="w-full px-4 py-2 rounded-xl bg-error text-white text-xs font-medium hover:bg-error/90 transition-colors">
            Delete for me
          </button>
          <button onClick={onDeleteForEveryone} className="w-full px-4 py-2 rounded-xl bg-error/90 text-white text-xs font-medium hover:bg-error transition-colors">
            Delete for everyone
          </button>
          <button onClick={onClose} className="w-full px-4 py-2 rounded-xl bg-background text-text-secondary text-xs font-medium hover:bg-surface transition-colors">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

const formatDuration = (secs) => {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
};

// Compact "Save contact" popover for the chat-header person icon. Shows ONLY the
// contact identity + save/remove actions — never the full Profile panel, CRM,
// notes, stats or insights. Save/remove go through the session contact API and
// reflect instantly via provider state (no page reload, no duplicate requests).
const SaveContactPopover = ({ contact, saved, busy, confirmingRemove, onSave, onRemove, onCancelRemove, onPhotoClick }) => {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onCancelRemove(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancelRemove]);

  return (
    <div className="save-contact-popover" onClick={(e) => e.stopPropagation()}>
      <div className="flex items-center gap-3 px-4 pt-4 pb-3">
        <ContactAvatar contact={contact} size="md" onPhotoClick={onPhotoClick} />
        <div className="flex-1 min-w-0">
          <p className="mp-profile-name truncate">{contact?.name || 'Unknown'}</p>
          <p className="mp-phone-muted truncate">+{String(contact?.phone || '').replace(/^\+/, '')}</p>
        </div>
      </div>
      <div className="px-4 pb-3">
        {saved ? (
          <div className="flex items-center justify-between gap-2 rounded-lg px-2.5 py-2 mb-2" style={{ backgroundColor: 'color-mix(in srgb, var(--success) 8%, transparent)' }}>
            <span className="text-[11px] font-medium flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
              <BookmarkCheck size={12} />
              Saved
            </span>
            <span className="text-[10px]" style={{ color: 'var(--ma-muted-text)' }}>Stored with session contacts</span>
          </div>
        ) : (
          <p className="text-[11px] leading-relaxed mb-2" style={{ color: 'var(--ma-muted-text)' }}>
            Add this contact to your saved list so it stays one tap away.
          </p>
        )}

        {!saved ? (
          <Button
            size="sm"
            className="w-full h-8 gap-1.5"
            disabled={busy}
            onClick={async () => {
              const res = await onSave();
              if (res && res.success) {
                showToast(`${contact?.name || 'Contact'} saved`, 'success');
              } else if (res === null) {
                showToast('Could not save contact. Please try again.', 'error');
              }
            }}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <UserPlus size={13} />}
            {busy ? 'Saving…' : 'Save contact'}
          </Button>
        ) : (
          <div className="flex flex-col gap-1.5">
            {!confirmingRemove ? (
              <button
                onClick={onRemove}
                className="h-8 w-full rounded-lg text-[12px] font-medium transition-colors"
                style={{ color: 'var(--error)', backgroundColor: 'transparent' }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = 'color-mix(in srgb, var(--error) 10%, transparent)'; }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = 'transparent'; }}
              >
                Remove from saved
              </button>
            ) : (
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px]" style={{ color: 'var(--ma-muted-text)' }}>
                  Remove <b style={{ color: 'var(--ma-list-title)' }}>{contact?.name || 'this contact'}</b> from saved?
                </span>
                <button
                  onClick={async () => {
                    const res = await onRemove();
                    if (res && res.success) {
                      showToast(`${contact?.name || 'Contact'} removed from saved`, 'success');
                    } else if (res === null) {
                      showToast('Could not remove contact. Please try again.', 'error');
                    }
                  }}
                  className="h-7 px-2.5 rounded-lg bg-error text-white text-[11px] font-medium hover:bg-error/90 transition-colors shrink-0"
                >
                  {busy ? 'Removing…' : 'Yes, remove'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

// Send an approved Meta template to the open chat.
const TemplateSendDialog = ({ isOpen, onClose, phone, contactName, onSent }) => {
  const [templates, setTemplates] = useState([]);
  const [selectedName, setSelectedName] = useState('');
  const [values, setValues] = useState({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    let alive = true;
    setLoading(true);
    setError('');
    metaApi.templates('?status=APPROVED')
      .then(res => { if (alive) { setTemplates(res.templates || []); if (!res.templates?.length) setError('No approved templates yet. Approve one in Message Templates first.'); } })
      .catch(e => { if (alive) setError(e.message); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, [isOpen]);

  const selected = templates.find(t => t.name === selectedName);
  const vars = selected ? templateVariables(selected) : [];

  const handleSend = async () => {
    if (!selectedName) { setError('Pick a template.'); return; }
    if (!phone) { setError('This contact has no phone number.'); return; }
    setBusy(true); setError('');
    try {
      const variables = {};
      vars.forEach(n => {
        const v = (values[n] || '').trim();
        if (v) variables[n] = v;
      });
      const res = await metaApi.sendTemplate({
        to: phone.replace(/\D/g, ''),
        templateName: selectedName,
        language: selected?.language || 'en',
        variables,
      });
      if (res.success) {
        onSent(res.message);
        onClose();
      } else {
        setError(res.error || 'Send failed');
      }
    } catch (e) { setError(e.message); }
    setBusy(false);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-3" onClick={onClose}>
      <div className="w-full max-w-lg bg-[#111B21] border border-[#1F2C33] rounded-2xl overflow-hidden shadow-2xl flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
        <div className="px-3 py-2.5 border-b border-[#1F2C33] flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <LayoutTemplate size={15} className="text-[#00A884]" />
            <div>
              <div className="text-xs font-semibold text-[#E9EDEF]">Send template message</div>
              <div className="text-[10px] text-[#8696A0]">to {contactName || (phone ? `+${phone}` : '…')} via the approved Meta template</div>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-[#202C33] transition-colors"><X size={15} className="text-[#8696A0]" /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {error && <div className="rounded-lg bg-error/10 border border-error/30 px-3 py-2 text-[11px] text-error">{error}</div>}

          <label className="block">
            <span className="text-[10px] uppercase tracking-wider text-[#8696A0] font-medium">Approved template</span>
            <select
              value={selectedName}
              onChange={e => { setSelectedName(e.target.value); setValues({}); }}
              className="mt-1 w-full bg-[#0B141A] border border-[#1F2C33] rounded-lg px-2.5 py-2 text-xs text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
            >
              <option value="">Select…</option>
              {templates.map(t => <option key={t.id} value={t.name}>{t.name} — {t.category}</option>)}
            </select>
          </label>

          {selected && (
            <>
              <div>
                <WhatsAppTemplatePreview template={selected} values={values} />
              </div>
              {vars.length > 0 && (
                <div className="space-y-2">
                  <div className="text-[10px] text-[#8696A0]">Fill preview values (optional — swap for real content)</div>
                  {vars.map(n => (
                    <div key={n} className="flex items-center gap-2">
                      <span className="text-[10px] bg-[#202C33] px-1.5 py-0.5 rounded border border-[#1F2C33] font-mono text-[#8696A0]">{`{{${n}}}`}</span>
                      <input
                        value={values[n] || ''}
                        onChange={e => setValues(v => ({ ...v, [n]: e.target.value }))}
                        placeholder={`Sample value ${n}`}
                        className="flex-1 bg-[#0B141A] border border-[#1F2C33] rounded-lg px-2.5 py-1.5 text-xs text-[#E9EDEF] focus:outline-none focus:border-[#00A884]"
                      />
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        <div className="px-3 py-2.5 border-t border-[#1F2C33] flex items-center justify-end gap-2 shrink-0">
          <button onClick={onClose} className="h-8 px-3 rounded-lg text-[11px] text-[#8696A0] hover:text-[#E9EDEF] transition-colors">Cancel</button>
          <button
            onClick={handleSend}
            disabled={busy || !selectedName}
            className="h-8 px-4 rounded-lg bg-[#00A884] text-white text-[11px] font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 flex items-center gap-1.5"
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />} Send template
          </button>
        </div>
      </div>
    </div>
  );
};

const ChatArea = ({ onBackToList, onToggleContactPanel, onOpenProfile, onPhotoClick }) => {
  const {
    activeConversation, setConversations, setActiveConversation, conversations,
    sendMessage: apiSendMessage, generateAiResponse, updateConversation, deleteMessage: apiDeleteMessage,
    unblockContact: apiUnblockContact, sendGateArmed, armSendGate,
    saveContact, unsaveContact
  } = useMessageAgent();
  const { isAuthenticated } = useWebSocket();
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const isSendingRef = useRef(false);
  const lastSendAtRef = useRef(0);
  const [isAITyping, setIsAITyping] = useState(false);
  const [showScrollDown, setShowScrollDown] = useState(false);
  const [replyTo, setReplyTo] = useState(null);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showAttachMenu, setShowAttachMenu] = useState(false);
  const [showFormatBar, setShowFormatBar] = useState(false);
  const [forwardMessage, setForwardMessage] = useState(null);
  const [searchInChat, setSearchInChat] = useState('');
  const [showSearch, setShowSearch] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [showTemplateSend, setShowTemplateSend] = useState(false);
  const [metaConnected, setMetaConnected] = useState(false);
  const [officialSend, setOfficialSend] = useState(false);
  const savePopoverRef = useRef(null);

  // Check whether the official Meta connector is live so we can offer the
  // "send via Meta" path (official Cloud API) in the composer.
  useEffect(() => {
    let alive = true;
    metaApi.status()
      .then(res => { if (alive) setMetaConnected(res?.connection?.status === 'connected'); })
      .catch(() => { if (alive) setMetaConnected(false); });
    return () => { alive = false; };
  }, []);

  const handleSaveContact = useCallback(async () => {
    setSaveBusy(true);
    try {
      const res = await saveContact(activeConversation?.contact?.phone);
      if (res && res.success) setConfirmingRemove(false);
      return res;
    } finally {
      setSaveBusy(false);
    }
  }, [saveContact, activeConversation]);

  const handleUnsaveContact = useCallback(async () => {
    if (!confirmingRemove) {
      setConfirmingRemove(true);
      return { success: true, pendingConfirm: true }; // first tap = confirm, second = execute
    }
    setSaveBusy(true);
    try {
      const res = await unsaveContact(activeConversation?.contact?.phone);
      if (res && res.success) {
        setConfirmingRemove(false);
        setSaveOpen(false);
      }
      return res;
    } finally {
      setSaveBusy(false);
    }
  }, [unsaveContact, confirmingRemove, activeConversation]);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [aiSuggestions, setAiSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const loadingSuggestionsRef = useRef(false);
  const [complianceStatus, setComplianceStatus] = useState({ allowed: true, isBlocked: false, isSuppressed: false });
  const [pendingAttachment, setPendingAttachment] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [recordingPreview, setRecordingPreview] = useState(null);
  const messagesEndRef = useRef(null);
  const messagesContainerRef = useRef(null);
  const textareaRef = useRef(null);
  const emojiRef = useRef(null);
  const attachRef = useRef(null);
  const wasNearBottomRef = useRef(true);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const recordingTimeRef = useRef(0);
  const cancelRecordingRef = useRef(false);
  const lastConvIdRef = useRef(null);

  const messages = activeConversation?.messages || [];
  const contactExists = activeConversation?.contact?.exists !== false;

  const composerBlocked =
    complianceStatus.allowed === false ||
    activeConversation?.contact?.blocked === true;

  // Composer draft persistence across conversation switches (module-level cache).
  useEffect(() => {
    const id = activeConversation?.id;
    if (!id) return;
    setNewMessage(draftCache.get(id) || '');
  }, [activeConversation?.id]);

  useEffect(() => () => {
    if (lastConvIdRef.current) draftCache.set(lastConvIdRef.current, '');
    try {
      if (recordingPreview?.url) URL.revokeObjectURL(recordingPreview.url);
    } catch { /* ignore */ }
  }, []);

  const filteredMessages = useMemo(() => {
    if (!searchInChat.trim()) return messages;
    const q = searchInChat.toLowerCase();
    return messages.filter(m => m.text?.toLowerCase().includes(q));
  }, [messages, searchInChat]);

  const scrollToBottom = useCallback((behavior = 'smooth') => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  }, []);

  useEffect(() => {
    if (wasNearBottomRef.current) {
      scrollToBottom('auto');
    }
  }, [messages.length, scrollToBottom]);

  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    const handleScroll = () => {
      const { scrollTop, scrollHeight, clientHeight } = container;
      const nearBottom = scrollHeight - scrollTop - clientHeight < 100;
      wasNearBottomRef.current = nearBottom;
      setShowScrollDown(!nearBottom);
    };
    container.addEventListener('scroll', handleScroll, { passive: true });
    return () => container.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 144) + 'px';
    }
  }, [newMessage]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (emojiRef.current && !emojiRef.current.contains(e.target)) {
        setShowEmojiPicker(false);
      }
      if (attachRef.current && !attachRef.current.contains(e.target)) {
        setShowAttachMenu(false);
      }
      if (savePopoverRef.current && !savePopoverRef.current.contains(e.target)) {
        setSaveOpen(false);
        setConfirmingRemove(false);
      }
    };
    if (showEmojiPicker || showAttachMenu || saveOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showEmojiPicker, showAttachMenu, saveOpen]);

  useEffect(() => {
    if (!saveOpen) return;
    const onKey = (e) => {
      if (e.key === 'Escape') {
        setSaveOpen(false);
        setConfirmingRemove(false);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [saveOpen]);

  useEffect(() => {
    setReplyTo(null);
    setShowEmojiPicker(false);
    setShowAttachMenu(false);
    setShowFormatBar(false);
    setSearchInChat('');
    setShowSearch(false);
    setSaveOpen(false);
    setConfirmingRemove(false);
    setDeleteTarget(null);
    setAiSuggestions([]);
    setPendingAttachment(null);
    setRecordingPreview(null);

    if (activeConversation?.id) {
      setComplianceStatus({ allowed: true, isBlocked: false, isSuppressed: false, checking: true });
      fetch(`/api/message-agent/compliance/check/${activeConversation.id}`)
        .then(r => r.json())
        .then(data => {
          setComplianceStatus({
            allowed: data.allowed !== false,
            isBlocked: data.isBlocked === true,
            isSuppressed: data.isSuppressed === true,
            reason: data.reason || null,
            checking: false
          });
        })
        .catch(() => setComplianceStatus({ allowed: true, isBlocked: false, isSuppressed: false, checking: false }));
    } else {
      setComplianceStatus({ allowed: true, isBlocked: false, isSuppressed: false, checking: false });
    }
  }, [activeConversation?.id]);

  const fetchAiSuggestions = useCallback(async () => {
    if (!activeConversation || loadingSuggestionsRef.current) return;
    loadingSuggestionsRef.current = true;
    setLoadingSuggestions(true);
    try {
      const res = await fetch('/api/message-agent/templates/recommend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationState: {
            stage: activeConversation.journey || 'contacted',
            lastMessage: messages[messages.length - 1]?.text || '',
            messageCount: messages.length,
            sentiment: messages[messages.length - 1]?.from === 'them' ? 'positive' : 'neutral',
            isReturningCustomer: messages.length > 5
          }
        })
      });
      const data = await res.json();
      if (data.success && data.recommended) {
        const raw = Array.isArray(data.recommended) ? data.recommended : [data.recommended];
        const suggestions = raw
          .map((s) => {
            const body = s?.template?.body || s?.content || s?.text || '';
            return body ? { text: body } : null;
          })
          .filter(Boolean);
        setAiSuggestions(suggestions.slice(0, 3));
      }
    } catch (err) {
      // silently fail
    }
    loadingSuggestionsRef.current = false;
    setLoadingSuggestions(false);
  }, [activeConversation, messages]);

  useEffect(() => {
    if (activeConversation && messages.length > 0) {
      const timer = setTimeout(fetchAiSuggestions, 1500);
      return () => clearTimeout(timer);
    }
  }, [activeConversation?.id, messages.length, fetchAiSuggestions]);

  useEffect(() => {
    const handleStatusUpdate = (event) => {
      const data = event.detail;
      if (data?.action === 'message_status' && activeConversation) {
        const contactPhone = activeConversation.contact?.phone?.replace(/\D/g, '');
        if (data.phone === contactPhone) {
          setConversations(prev => prev.map(conv => {
            if (conv.id === activeConversation.id) {
              const updatedMessages = (conv.messages || []).map(m => 
                m.id === data.messageId ? { ...m, status: data.status } : m
              );
              return { ...conv, messages: updatedMessages };
            }
            return conv;
          }));
        }
      }
    };
    window.addEventListener('messageAgent-update', handleStatusUpdate);
    return () => window.removeEventListener('messageAgent-update', handleStatusUpdate);
  }, [activeConversation?.id, activeConversation?.contact?.phone, setConversations]);

  const appendMessageToConversation = useCallback((convId, message) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== convId) return conv;
      const messagesPrev = conv.messages || [];
      if (messagesPrev.some(m => m.id === message.id)) return conv;
      const updated = [...messagesPrev, message];
      return { ...conv, messages: updated, lastMessage: { text: message.text, timestamp: message.timestamp, from: message.from, status: message.status } };
    }));
  }, [setConversations]);

  const replaceMessageInConversation = useCallback((convId, tempId, savedMessage) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== convId) return conv;
      const updatedMessages = (conv.messages || []).map(m => 
        m.id === tempId ? { ...m, ...savedMessage, id: savedMessage.id || m.id, from: 'me', status: savedMessage.status === 'failed' ? 'failed' : 'sent' } : m
      );
      return { ...conv, messages: updatedMessages, lastMessage: updatedMessages[updatedMessages.length - 1] || conv.lastMessage };
    }));
  }, [setConversations]);

  const markMessagesFailed = useCallback((convId, tempId) => {
    setConversations(prev => prev.map(conv => {
      if (conv.id !== convId) return conv;
      const updatedMessages = (conv.messages || []).map(m => 
        m.id === tempId ? { ...m, status: 'failed' } : m
      );
      return { ...conv, messages: updatedMessages };
    }));
  }, [setConversations]);

  const generateAndSendAI = useCallback(async (conv, history) => {
    setIsAITyping(true);
    try {
      const aiResponseData = await generateAiResponse(null, history, conv);
      if (aiResponseData?.response) {
        const aiMessage = {
          id: `ai_${Date.now()}`,
          text: aiResponseData.response,
          from: 'ai',
          timestamp: new Date().toISOString(),
          status: 'delivered',
          provider: aiResponseData.provider,
          model: aiResponseData.model,
          confidence: aiResponseData.confidence,
        };
        appendMessageToConversation(conv.id, aiMessage);
        try {
          await apiSendMessage(conv.id, conv.contact?.phone, aiResponseData.response, 'ai', 'ai');
        } catch (err) {
          console.error('Error persisting AI response:', err);
        }
      }
    } catch (err) {
      console.error('Error generating AI response:', err);
    } finally {
      setIsAITyping(false);
    }
  }, [appendMessageToConversation, apiSendMessage, generateAiResponse]);

  // Send a message/file through the OFFICIAL Meta Cloud API (never gets your
  // number banned — it uses the WABA's approved phone number). Falls back to the
  // regular Baileys path if Meta is not connected.
  const sendViaOfficial = useCallback(async (conv, text, attachment) => {
    const phone = (conv?.contact?.phone || '').replace(/\D/g, '');
    if (!phone) throw new Error('This contact has no phone number.');
    let res;
    if (attachment?.file) {
      const buffer = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(reader.error || new Error('File read failed'));
        reader.readAsDataURL(attachment.file);
      });
      res = await metaApi.sendOfficialMedia({
        to: phone,
        base64: buffer,
        mime: attachment.file.type || 'application/octet-stream',
        filename: attachment.file.name,
        caption: text || '',
        contactId: conv.contact?.id,
      });
    } else {
      res = await metaApi.sendOfficialText({ to: phone, text, contactId: conv.contact?.id });
    }
    if (!res?.success) {
      const err = new Error(res?.error || 'Meta send failed');
      err.code = res?.code;
      throw err;
    }
    const record = res.message || {};
    return {
      id: record.id || `meta_${Date.now()}`,
      text: record.text || text,
      from: 'me',
      timestamp: record.createdAt || new Date().toISOString(),
      status: record.status === 'sent' ? 'sent' : 'sending',
      meta: true,
      wamid: record.wamid || '',
      attachment: attachment ? { name: attachment.file.name, size: attachment.file.size, type: attachment.file.type } : null,
    };
  }, []);

  const handleSendMessage = useCallback(async () => {
    if (!newMessage.trim() && !pendingAttachment) return;
    if (!activeConversation || composerBlocked || !sendGateArmed) return;
    if (isSendingRef.current) return;
    // Debounce accidental double-sends (double Enter / button).
    if (Date.now() - lastSendAtRef.current < 500) return;
    isSendingRef.current = true;
    lastSendAtRef.current = Date.now();
    setIsSending(true);

    try {
      const messageText = newMessage.trim();
      const conv = activeConversation;
      const attachment = pendingAttachment;
      setNewMessage('');
      setReplyTo(null);
      setPendingAttachment(null);

      const tempId = `temp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      const timestamp = new Date().toISOString();
      const tempMessage = {
        id: tempId,
        text: messageText,
        from: 'me',
        timestamp,
        status: 'sending',
        replyTo: replyTo ? { text: replyTo.text, from: replyTo.from } : null,
        attachment: attachment ? { name: attachment.file.name, size: attachment.file.size, type: attachment.file.type } : null,
        voiceNote: null,
      };

      appendMessageToConversation(conv.id, tempMessage);

      let savedMessage;
      if (officialSend && metaConnected) {
        // Official Meta Cloud API — safe, no ban risk, uses the WABA number.
        try {
          savedMessage = await sendViaOfficial(conv, messageText, attachment);
        } catch (err) {
          console.error('Meta send failed, falling back to Baileys:', err);
          if (err.code === 'META_NOT_CONNECTED') setMetaConnected(false);
          savedMessage = await apiSendMessage(conv.id, conv.contact?.phone, messageText, 'user', conv.mode);
        }
      } else {
        savedMessage = await apiSendMessage(
          conv.id,
          conv.contact?.phone,
          messageText,
          'user',
          conv.mode
        );
      }

      if (savedMessage) {
        replaceMessageInConversation(conv.id, tempId, savedMessage);

        if (conv.mode === 'ai') {
          const history = [...(conv.messages || []).slice(-10), tempMessage];
          // Fire-and-forget: AI runs in its own async flow so the composer stays
          // responsive while it works. Fallback is the manual composer.
          generateAndSendAI(conv, history);
        }
      } else {
        markMessagesFailed(conv.id, tempId);
      }
    } catch (err) {
      console.error('Error sending message:', err);
    } finally {
      isSendingRef.current = false;
      setIsSending(false);
    }
  }, [newMessage, pendingAttachment, activeConversation, composerBlocked, sendGateArmed, replyTo, appendMessageToConversation, apiSendMessage, replaceMessageInConversation, markMessagesFailed, generateAndSendAI, officialSend, metaConnected, sendViaOfficial]);

  const handleRetryMessage = async (message) => {
    if (!activeConversation || isSendingRef.current) return;
    isSendingRef.current = true;
    try {
      setConversations(prev => prev.map(conv => {
        if (conv.id === activeConversation.id) {
          const updatedMessages = (conv.messages || []).map(m => 
            m.id === message.id ? { ...m, status: 'sending' } : m
          );
          return { ...conv, messages: updatedMessages };
        }
        return conv;
      }));

      const savedMessage = await apiSendMessage(
        activeConversation.id,
        activeConversation.contact?.phone,
        message.text,
        'user',
        activeConversation.mode
      );

      if (savedMessage) {
        setConversations(prev => prev.map(conv => {
          if (conv.id === activeConversation.id) {
            const updatedMessages = (conv.messages || []).map(m => 
              m.id === message.id ? { ...savedMessage, from: 'me', status: 'sent' } : m
            );
            return { ...conv, messages: updatedMessages, lastMessage: savedMessage };
          }
          return conv;
        }));
      } else {
        setConversations(prev => prev.map(conv => {
          if (conv.id === activeConversation.id) {
            const updatedMessages = (conv.messages || []).map(m => 
              m.id === message.id ? { ...m, status: 'failed' } : m
            );
            return { ...conv, messages: updatedMessages };
          }
          return conv;
        }));
      }
    } catch (err) {
      console.error('Error retrying message:', err);
    } finally {
      isSendingRef.current = false;
    }
  };

  const handleMessageAction = useCallback(async (action, message) => {
    switch (action) {
      case 'reply':
        setReplyTo(message);
        textareaRef.current?.focus();
        break;
      case 'copy':
        try {
          await navigator.clipboard.writeText(message.text);
        } catch {
          const textarea = document.createElement('textarea');
          textarea.value = message.text;
          document.body.appendChild(textarea);
          textarea.select();
          document.execCommand('copy');
          document.body.removeChild(textarea);
        }
        break;
      case 'star':
        setConversations(prev => prev.map(conv => {
          if (conv.id === activeConversation.id) {
            const updatedMessages = (conv.messages || []).map(m => 
              m.id === message.id ? { ...m, starred: !m.starred } : m
            );
            return { ...conv, messages: updatedMessages };
          }
          return conv;
        }));
        break;
      case 'delete':
        setDeleteTarget(message);
        break;
      case 'forward':
        setForwardMessage(message);
        break;
      case 'retry':
        handleRetryMessage(message);
        break;
    }
  }, [setConversations, activeConversation?.id]);

  const handleDeleteForMe = async () => {
    if (!deleteTarget || !activeConversation) return;
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeConversation.id) {
        const updatedMessages = (conv.messages || []).filter(m => m.id !== deleteTarget.id);
        return { 
          ...conv, 
          messages: updatedMessages,
          lastMessage: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : conv.lastMessage
        };
      }
      return conv;
    }));
    setDeleteTarget(null);
  };

  const handleDeleteForEveryone = async () => {
    if (!deleteTarget || !activeConversation) return;
    const phone = activeConversation.contact?.phone;
    try {
      await apiDeleteMessage(deleteTarget.id, phone, true);
    } catch {
      // silently fail
    }
    setConversations(prev => prev.map(conv => {
      if (conv.id === activeConversation.id) {
        const updatedMessages = (conv.messages || []).filter(m => m.id !== deleteTarget.id);
        return { 
          ...conv, 
          messages: updatedMessages,
          lastMessage: updatedMessages.length > 0 ? updatedMessages[updatedMessages.length - 1] : conv.lastMessage
        };
      }
      return conv;
    }));
    setDeleteTarget(null);
  };

  const handleForwardToContact = async (targetConv) => {
    if (!forwardMessage || !targetConv) return;
    const tempId = `fwd_${Date.now()}`;
    const fwdMessage = {
      id: tempId,
      text: `\u21AA Forwarded: ${forwardMessage.text}`,
      from: 'me',
      timestamp: new Date().toISOString(),
      status: 'sending',
    };
    setConversations(prev => prev.map(conv => {
      if (conv.id === targetConv.id) {
        const updatedMessages = [...(conv.messages || []), fwdMessage];
        return { ...conv, messages: updatedMessages, lastMessage: fwdMessage };
      }
      return conv;
    }));
    const savedMessage = await apiSendMessage(targetConv.id, targetConv.contact?.phone, `\u21AA Forwarded: ${forwardMessage.text}`, 'user', targetConv.mode);
    if (savedMessage) {
      setConversations(prev => prev.map(conv => {
        if (conv.id === targetConv.id) {
          const updatedMessages = (conv.messages || []).map(m => 
            m.id === tempId ? { ...savedMessage, from: 'me', status: 'sent' } : m
          );
          return { ...conv, messages: updatedMessages, lastMessage: savedMessage };
        }
        return conv;
      }));
    }
    setForwardMessage(null);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // ---- Attachment handling ----
  const handleFileAttach = (accept) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = (e) => {
      const file = e.target.files[0];
      if (!file) return;
      if (file.size > 16 * 1024 * 1024) {
        window.dispatchEvent(new CustomEvent('ws-toast', { detail: { message: 'File too large. Maximum size is 16 MB.', type: 'error' } }));
        return;
      }
      const previewUrl = file.type && file.type.startsWith('image/') && typeof URL !== 'undefined'
        ? URL.createObjectURL(file)
        : null;
      setPendingAttachment({ file, previewUrl });
    };
    input.click();
    setShowAttachMenu(false);
  };

  const removeAttachment = () => {
    if (pendingAttachment?.previewUrl) {
      try { URL.revokeObjectURL(pendingAttachment.previewUrl); } catch { /* ignore */ }
    }
    setPendingAttachment(null);
  };

  // ---- Voice recording (MediaRecorder) ----
  const stopTracks = (stream) => {
    try { stream?.getTracks?.().forEach(t => t.stop()); } catch { /* ignore */ }
  };

  const cleanupRecording = () => {
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
  };

  const startRecording = async () => {
    if (isRecording || recordingPreview) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mimeType = MediaRecorder.isTypeSupported('audio/webm')
        ? 'audio/webm'
        : MediaRecorder.isTypeSupported('audio/mp4') ? 'audio/mp4' : '';
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      recordedChunksRef.current = [];
      cancelRecordingRef.current = false;
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
      };
      recorder.onstop = () => {
        stopTracks(stream);
        cleanupRecording();
        if (cancelRecordingRef.current) return;
        if (recordedChunksRef.current.length === 0) return;
        const blob = new Blob(recordedChunksRef.current, { type: mimeType || 'audio/webm' });
        const url = typeof URL !== 'undefined' ? URL.createObjectURL(blob) : null;
        setRecordingPreview({ url, blob, duration: recordingTimeRef.current || Math.max(1, Math.round(blob.size / 16000)) });
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      recordingTimeRef.current = 0;
      setRecordingTime(0);
      setIsRecording(true);
      recordingTimerRef.current = setInterval(() => {
        recordingTimeRef.current += 1;
        setRecordingTime(recordingTimeRef.current);
      }, 1000);
    } catch (err) {
      window.dispatchEvent(new CustomEvent('ws-toast', { detail: { message: 'Microphone access was denied or unavailable.', type: 'error' } }));
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  };

  const cancelRecording = () => {
    cancelRecordingRef.current = true;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
    setRecordingTime(0);
  };

  const discardVoicePreview = () => {
    if (recordingPreview?.url) {
      try { URL.revokeObjectURL(recordingPreview.url); } catch { /* ignore */ }
    }
    setRecordingPreview(null);
  };

  const sendVoiceNote = async () => {
    if (!recordingPreview || !activeConversation || composerBlocked || !sendGateArmed) return;
    const text = `\u{1F3A4} Voice message (${formatDuration(recordingPreview.duration)})`;
    const tempId = `voice_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const tempMessage = {
      id: tempId,
      text,
      from: 'me',
      timestamp: new Date().toISOString(),
      status: 'sending',
      voiceNote: { duration: recordingPreview.duration },
    };
    appendMessageToConversation(activeConversation.id, tempMessage);
    discardVoicePreview();

    const savedMessage = await apiSendMessage(activeConversation.id, activeConversation.contact?.phone, text, 'user', activeConversation.mode);
    if (savedMessage) {
      replaceMessageInConversation(activeConversation.id, tempId, savedMessage);
    } else {
      markMessagesFailed(activeConversation.id, tempId);
    }
  };

  // ---- Formatting ----
  const wrapFormat = (marker) => {
    const ta = textareaRef.current;
    const cur = newMessage;
    const start = ta ? ta.selectionStart : cur.length;
    const end = ta ? ta.selectionEnd : cur.length;
    const selection = cur.slice(start, end) || 'text';
    const next = cur.slice(0, start) + marker + selection + marker + cur.slice(end);
    setNewMessage(next);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + marker.length, start + marker.length + selection.length);
    });
  };

  // ---- Smart suggestions — insert into draft, never auto-send ----
  const insertSuggestion = (text) => {
    const ta = textareaRef.current;
    const cur = newMessage;
    if (!cur) {
      setNewMessage(text);
    } else {
      const start = ta ? ta.selectionStart : cur.length;
      const end = ta ? ta.selectionEnd : cur.length;
      const prefix = start > 0 && !/\s$/.test(cur.slice(0, start)) ? ' ' : '';
      const next = cur.slice(0, start) + prefix + text + cur.slice(end);
      setNewMessage(next);
      requestAnimationFrame(() => {
        ta?.focus();
        const pos = start + prefix.length + text.length;
        ta?.setSelectionRange(pos, pos);
      });
    }
  };

  const insertEmoji = (emoji) => {
    const ta = textareaRef.current;
    const cur = newMessage;
    const start = ta ? ta.selectionStart : cur.length;
    const end = ta ? ta.selectionEnd : cur.length;
    const next = cur.slice(0, start) + emoji + cur.slice(end);
    setNewMessage(next);
    requestAnimationFrame(() => {
      ta?.focus();
      ta?.setSelectionRange(start + emoji.length, start + emoji.length);
    });
  };

  if (!activeConversation) {
    return null;
  }

  const EMOJI_CATEGORIES = [
    { label: 'Smileys', emojis: ['\u{1F600}','\u{1F602}','\u{1F60A}','\u{1F60D}','\u{1F970}','\u{1F60E}','\u{1F929}','\u{1F607}','\u{1F917}','\u{1F914}','\u{1F634}','\u{1F973}','\u{1F60F}','\u{1F62D}','\u{1F644}','\u{1F624}','\u{1F91E}','\u{1F4AA}','\u{1F44D}','\u{1F44E}'] },
    { label: 'Hearts', emojis: ['\u2764\uFE0F','\u{1F9E1}','\u{1F49B}','\u{1F49A}','\u{1F499}','\u{1F49C}','\u{1F5A4}','\u{1F90D}','\u{1F495}','\u{1F496}','\u{1F497}','\u{1F49D}','\u{1F498}','\u{1F49E}','\u{1F493}','\u{1F494}'] },
    { label: 'Objects', emojis: ['\u{1F389}','\u{1F38A}','\u{1F382}','\u{1F381}','\u{1F3C6}','\u2B50','\u2728','\u{1F525}','\u{1F4AF}','\u{1F64C}','\u{1F44F}','\u{1F91D}','\u{1F64F}','\u{1F4AC}','\u{1F4F1}','\u{1F4BB}'] },
    { label: 'Hands', emojis: ['\u{1F44B}','\u270B','\u{1F90A}','\u{1F590}\uFE0F','\u{1F44C}','\u270C\uFE0F','\u{1F91E}','\u{1FA70}','\u{1F91F}','\u{1F918}','\u{1F919}','\u{1F448}','\u{1F449}','\u{1F446}','\u{1F447}','\u261D\uFE0F'] },
  ];

  const ATTACH_OPTIONS = [
    { icon: Image, label: 'Photo', accept: 'image/*' },
    { icon: Camera, label: 'Camera', accept: 'image/*', capture: 'environment' },
    { icon: FileText, label: 'Document', accept: '.pdf,.doc,.docx,.txt,.csv,.xls,.xlsx,.ppt,.pptx' },
  ];

  return (
    <div className="msg-chat-panel flex-1 min-w-0 min-h-0 flex flex-col overflow-hidden">
      {/* Chat Header */}
      <div className="msg-chat-header">
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onBackToList}
            className="md:hidden msg-icon-btn w-8 h-8 text-text-muted hover:text-primary transition-colors"
          >
            <ChevronLeft size={18} />
          </button>
          
          <button
            onClick={onPhotoClick}
            className="block shrink-0 cursor-pointer rounded-full"
            title="View profile photo"
            aria-label="View profile photo"
          >
            <ContactAvatar contact={activeConversation.contact} status={activeConversation.status} size="md" />
          </button>
          
          <div className="flex-1 min-w-0 flex flex-col gap-1">
            <button onClick={onOpenProfile} className="text-left min-w-0" title="View contact profile">
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-[14px] truncate text-[#E9EDEF] leading-none">{activeConversation.contact.name}</h3>
                {activeConversation.mode === 'ai' && (
                  <span className="px-1.5 py-px text-[10px] font-semibold bg-[#00A884]/10 text-[#00A884] border border-[#00A884]/30 rounded shrink-0">
                    AI
                  </span>
                )}
              </div>
              <div className="flex items-center gap-1.5">
                <div className={cn("w-1.5 h-1.5 rounded-full shrink-0", 
                  activeConversation.status === 'online' ? 'bg-[#00A884]' :
                  activeConversation.status === 'ai_typing' ? 'bg-[#00A884] animate-pulse' :
                  activeConversation.status === 'typing' ? 'bg-[#F5BB45]' : 'bg-[#8696A0]'
                )} />
                <span className="truncate text-[12px] text-[#8696A0]">
                  {isAITyping ? 'AI is responding...' :
                   activeConversation.status === 'online' ? 'Online' :
                   activeConversation.status === 'ai_typing' ? 'AI thinking...' :
                   activeConversation.status === 'typing' ? 'Typing...' :
                   'Tap here for contact info'}
                </span>
              </div>
              <p className="mp-phone-muted truncate">+{String(activeConversation.contact.phone || '').replace(/^\+/, '')}</p>
            </button>
          </div>
        </div>
        
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={async () => {
              const newStarred = !activeConversation.starred;
              await updateConversation(activeConversation.id, { starred: newStarred });
            }}
            className={cn("msg-icon-btn", activeConversation.starred && "text-[#F5BB45] bg-[#F5BB45]/10")}
            title={activeConversation.starred ? 'Unstar' : 'Star conversation'}
          >
            <Star size={20} className={activeConversation.starred ? "fill-current" : ""} />
          </button>
          <button
            onClick={() => setShowSearch(!showSearch)}
            className={cn("msg-icon-btn", showSearch && "text-[#00A884] bg-[#00A884]/10")}
            title="Search in chat"
          >
            <Search size={20} />
          </button>
          <button
            onClick={async () => {
              try {
                const newMode = activeConversation.mode === 'ai' ? 'manual' : 'ai';
                await updateConversation(activeConversation.id, { mode: newMode });
              } catch (err) {
                console.error('Error toggling mode:', err);
              }
            }}
            className={cn("msg-icon-btn", activeConversation.mode === 'ai' && "text-[#00A884] bg-[#00A884]/10")}
            title={activeConversation.mode === 'ai' ? 'AI Mode Active — click to disable' : 'Enable AI Mode'}
          >
            <Bot size={20} />
          </button>
          <button
            onClick={() => { setShowTemplateSend(true); setSaveOpen(false); }}
            className="msg-icon-btn text-[#8696A0] hover:text-[#00A884]"
            title="Send an approved Meta template"
            aria-label="Send template"
          >
            <LayoutTemplate size={20} />
          </button>
          <div className="relative" ref={savePopoverRef}>
            <button
              onClick={() => {
                setSaveOpen(prev => !prev);
                setConfirmingRemove(false);
              }}
              className={cn(
                "msg-icon-btn",
                (activeConversation.saved || saveOpen) && "text-[#00A884] bg-[#00A884]/10"
              )}
              title={activeConversation.saved ? 'Saved contact — click to manage' : 'Save contact'}
              aria-label={activeConversation.saved ? 'Manage saved contact' : 'Save contact'}
              aria-expanded={saveOpen}
            >
              {activeConversation.saved ? <UserCheck size={20} /> : <UserPlus size={20} />}
            </button>
            {saveOpen && (
              <SaveContactPopover
                contact={activeConversation.contact}
                saved={activeConversation.saved}
                busy={saveBusy}
                confirmingRemove={confirmingRemove}
                onSave={handleSaveContact}
                onRemove={handleUnsaveContact}
                onCancelRemove={() => setConfirmingRemove(false)}
                onPhotoClick={onPhotoClick}
              />
            )}
          </div>
        </div>
      </div>

      {/* Search bar */}
      {showSearch && (
        <div className="px-3 py-2 chat-search-bar flex items-center gap-2 shrink-0">
          <Search size={14} className="text-text-muted shrink-0" />
          <Input
            placeholder="Search in conversation..."
            value={searchInChat}
            onChange={(e) => setSearchInChat(e.target.value)}
            className="h-8 text-xs flex-1"
            autoFocus
          />
          {searchInChat && (
            <span className="text-[11px] text-text-muted shrink-0">
              {filteredMessages.filter(m => m.text?.toLowerCase().includes(searchInChat.toLowerCase())).length} found
            </span>
          )}
          <button onClick={() => { setSearchInChat(''); setShowSearch(false); }} className="text-text-muted hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Compliance Warning Banner */}
      {complianceStatus.checking && (
        <div className="px-3 sm:px-4 py-2 flex items-center gap-2 bg-warning/10 border-b border-warning/20 shrink-0">
          <Loader2 size={14} className="animate-spin text-warning" />
          <span className="text-xs text-warning">Checking compliance...</span>
        </div>
      )}
      {!complianceStatus.allowed && !complianceStatus.checking && (
        <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2.5 bg-error/10 border-b border-error/20 shrink-0">
          <ShieldBan size={16} className="text-error shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-error">
              {complianceStatus.isBlocked ? 'Contact Blocked' : 'Opted Out'}
            </p>
            <p className="text-[11px] text-error/80 truncate">
              {complianceStatus.reason || (complianceStatus.isBlocked ? 'This contact has been blocked.' : 'This contact has opted out from receiving messages.')}
            </p>
          </div>
          {complianceStatus.isBlocked && (
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-xs text-error hover:bg-error/10"
              onClick={async () => {
                try {
                  await apiUnblockContact(activeConversation.id);
                  setComplianceStatus({ allowed: true, isBlocked: false, isSuppressed: false, checking: false });
                } catch (err) {
                  console.error('Error unblocking contact:', err);
                }
              }}
            >
              Unblock
            </Button>
          )}
        </div>
      )}

      {!contactExists && (
        <div className="px-3 sm:px-4 py-2.5 flex items-center gap-2.5 bg-warning/10 border-b border-warning/20 shrink-0">
          <AlertCircle size={16} className="text-warning shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-warning">Not Verified on WhatsApp</p>
            <p className="text-[11px] text-warning/80 truncate">
              This number was not detected as an active WhatsApp account. Messages may fail to be delivered.
            </p>
          </div>
        </div>
      )}

      {/* Read-only send gate banner */}
      {!sendGateArmed && isAuthenticated && (
        <div className="px-3 sm:px-4 py-2 flex items-center gap-2.5 bg-[#00A884]/10 border-b border-[#00A884]/25 shrink-0">
          <ShieldBan size={16} className="text-[#00A884] shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-[#00A884]">Messaging is in read-only mode</p>
            <p className="text-[11px] text-[#8696A0] truncate">Enable messaging to start sending replies to customers.</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            className="h-7 px-2.5 text-xs border-[#00A884]/40 text-[#00A884] hover:bg-[#00A884]/10"
            onClick={armSendGate}
          >
            Enable Messaging
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <div 
        ref={messagesContainerRef}
        className="msg-message-area"
      >
        <div className="flex justify-center">
          <div className="px-3 py-1 rounded-lg msg-system text-[12px] font-medium shadow-sm">
            {messages.length > 0 ? new Date(messages[0].timestamp).toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' }) : 'Today'}
          </div>
        </div>

        <div className="flex flex-col gap-2">
        {(searchInChat ? filteredMessages : messages).map((msg, idx) => (
          <MessageBubble
            key={msg.id}
            message={msg}
            isLast={idx === (searchInChat ? filteredMessages : messages).length - 1}
            onAction={handleMessageAction}
          />
        ))}
        </div>
        
        {(searchInChat ? filteredMessages : messages).filter(m => m.status === 'failed').map(msg => (
          <div key={`retry_${msg.id}`} className="flex justify-center">
            <button
              onClick={() => handleRetryMessage(msg)}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-error/10 text-error text-xs hover:bg-error/20 transition-colors"
            >
              <AlertCircle size={12} />
              Failed to send. Tap to retry.
            </button>
          </div>
        ))}
        
        {isAITyping && <TypingIndicator isAI />}
        
        <div ref={messagesEndRef} />

        {showScrollDown && (
          <button
            onClick={() => scrollToBottom()}
            className="sticky bottom-2 left-1/2 -translate-x-1/2 p-2 rounded-full bg-surface border border-border shadow-lg text-text-muted hover:text-primary transition-colors z-10"
          >
            <ArrowDown size={16} />
          </button>
        )}
      </div>

      {/* Reply Preview */}
      {replyTo && (
        <div className="px-3 py-1.5 border-t border-border chat-input-area flex items-center gap-3 shrink-0">
          <div className="flex-1 min-w-0 border-l-4 border-primary pl-3">
            <p className="text-xs font-medium text-primary">{replyTo.from === 'me' ? 'You' : replyTo.from === 'ai' ? 'AI' : 'Them'}</p>
            <p className="text-xs text-text-muted truncate">{replyTo.text}</p>
          </div>
          <button onClick={() => setReplyTo(null)} className="text-text-muted hover:text-text-primary">
            <X size={14} />
          </button>
        </div>
      )}

      {/* AI Smart Reply Suggestions — click inserts into the input, never sends */}
      {(aiSuggestions.length > 0 || loadingSuggestions) && (
        <div className="px-3 py-1.5 border-t border-border bg-surface/50 shrink-0">
          <div className="flex items-center gap-2 mb-1.5">
            <Sparkles size={12} className="text-primary" />
            <span className="text-[10px] font-medium text-text-muted uppercase tracking-wider">Smart Suggestions</span>
            {loadingSuggestions && <Loader2 size={10} className="animate-spin text-primary" />}
          </div>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {aiSuggestions.map((s, i) => (
              <button
                key={i}
                onClick={() => insertSuggestion(s.text || '')}
                className="shrink-0 px-3 py-1.5 rounded-lg bg-primary/5 border border-primary/20 text-xs text-text-primary hover:bg-primary/10 transition-colors text-left max-w-[220px] truncate"
                title="Click to insert into your message"
              >
                {s.text}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Pending attachment preview */}
      {pendingAttachment && (
        <div className="px-3 py-2 border-t border-border chat-input-area flex items-center gap-3 shrink-0">
          {pendingAttachment.previewUrl ? (
            <img src={pendingAttachment.previewUrl} alt="preview" className="w-10 h-10 rounded-lg object-cover shrink-0" />
          ) : (
            <div className="w-10 h-10 rounded-lg bg-[#00A884]/10 flex items-center justify-center shrink-0">
              <Paperclip size={16} className="text-[#00A884]" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-text-primary truncate">{pendingAttachment.file.name}</p>
            <p className="text-[10px] text-text-muted">{(pendingAttachment.file.size / 1024).toFixed(1)} KB · will be shared as a secure text link</p>
          </div>
          <button onClick={removeAttachment} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors" title="Remove attachment">
            <Trash size={14} />
          </button>
        </div>
      )}

      {/* Voice recording UI */}
      {isRecording && (
        <div className="px-3 py-2.5 border-t border-border chat-input-area flex items-center gap-3 shrink-0 animate-pulse">
          <span className="w-2.5 h-2.5 rounded-full bg-error" />
          <span className="text-xs font-medium text-error tabular-nums">{formatDuration(recordingTime)}</span>
          <span className="flex-1 text-xs text-text-muted">Recording... tap to stop</span>
          <button onClick={stopRecording} className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00A884] text-white text-xs font-medium hover:bg-[#06CF9C] transition-colors">
            <Mic size={13} />
            Stop & Preview
          </button>
          <button onClick={cancelRecording} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10" title="Cancel recording">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Voice preview */}
      {recordingPreview && !isRecording && (
        <div className="px-3 py-2.5 border-t border-border chat-input-area flex items-center gap-3 shrink-0">
          <audio src={recordingPreview.url} controls className="h-9 max-w-[220px]" />
          <span className="text-xs text-text-muted tabular-nums">{formatDuration(recordingPreview.duration)}</span>
          <span className="flex-1" />
          <button
            onClick={sendVoiceNote}
            disabled={composerBlocked || !sendGateArmed}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-[#00A884] text-white text-xs font-medium hover:bg-[#06CF9C] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send size={12} />
            Send
          </button>
          <button onClick={discardVoicePreview} className="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10" title="Discard voice message">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Input Area */}
      <div className="msg-composer">
        {/* Emoji Picker */}
        {showEmojiPicker && (
          <div ref={emojiRef} className="absolute bottom-full left-0 right-0 mb-2 dialog-panel rounded-xl shadow-2xl p-3 z-20 max-h-64 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-semibold text-text-muted uppercase tracking-wider">Emoji</span>
              <button onClick={() => setShowEmojiPicker(false)} className="text-text-muted hover:text-text-primary">
                <X size={14} />
              </button>
            </div>
            {EMOJI_CATEGORIES.map((cat) => (
              <div key={cat.label} className="mb-3">
                <p className="text-[10px] text-text-muted font-medium mb-1.5">{cat.label}</p>
                <div className="flex flex-wrap gap-1">
                  {cat.emojis.map((emoji) => (
                    <button
                      key={emoji}
                      onClick={() => insertEmoji(emoji)}
                      className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-background transition-colors text-lg"
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Attach Menu */}
        {showAttachMenu && (
          <div ref={attachRef} className="absolute bottom-full left-0 mb-2 dialog-panel rounded-xl shadow-2xl py-2 z-20 w-48">
            {ATTACH_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.label}
                  onClick={() => handleFileAttach(opt.accept)}
                  className="w-full flex items-center gap-3 px-4 py-2.5 text-sm text-text-primary hover:bg-background transition-colors"
                >
                  <Icon size={16} className="text-primary" />
                  {opt.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Official Meta toggle (only when connected) */}
        {metaConnected && (
          <div className="relative" onMouseDown={e => e.stopPropagation()}>
            <button
              onClick={() => setOfficialSend(s => !s)}
              className={cn(
                "msg-icon-btn h-8 px-2 rounded-lg flex items-center gap-1 text-[10px] font-medium transition-colors",
                officialSend
                  ? "bg-[#00A884]/15 text-[#00A884] border border-[#00A884]/30"
                  : "text-[#8696A0] hover:text-[#E9EDEF] border border-transparent hover:border-[rgba(255,255,255,0.1)]"
              )}
              title={officialSend ? 'Sending via official Meta API (safe, no ban risk). Click to switch to Baileys.' : 'Send via official Meta API (safe, no ban risk). Click to enable.'}
              aria-label="Toggle official Meta sending"
            >
              <Building2 size={13} />
              <span className="hidden sm:inline">{officialSend ? 'Meta' : 'Meta'}</span>
              <span className={cn("w-1.5 h-1.5 rounded-full", officialSend ? "bg-[#00A884]" : "bg-[#3B4A54]")} />
            </button>
          </div>
        )}

        {/* Emoji button */}
        <div className="relative" onMouseDown={e => e.stopPropagation()}>
          <button
            className="msg-icon-btn"
            disabled={composerBlocked}
            onClick={() => { setShowEmojiPicker(!showEmojiPicker); setShowAttachMenu(false); }}
            title="Emoji"
            aria-label="Open emoji picker"
          >
            <Smile size={20} />
          </button>
        </div>

        {/* Attach button */}
        <div className="relative" onMouseDown={e => e.stopPropagation()}>
          <button
            className="msg-icon-btn"
            disabled={composerBlocked}
            onClick={() => { setShowAttachMenu(!showAttachMenu); setShowEmojiPicker(false); }}
            title="Attach file"
            aria-label="Attach a file"
          >
            <Paperclip size={20} />
          </button>
        </div>

        <div className="flex-1 min-w-0 flex flex-col">
          {/* Formatting toolbar */}
          <div className={cn("flex items-center gap-0.5 pb-1 transition-all", showFormatBar || newMessage ? "opacity-100" : "opacity-0 pointer-events-none")}>
            {FORMAT_CHARS.map((f) => {
              const Icon = f.icon;
              return (
                <button
                  key={f.label}
                  onClick={() => wrapFormat(f.marker)}
                  className="w-6 h-6 rounded hover:bg-[var(--ma-hover)] text-[var(--ma-muted-text)] hover:text-[var(--ma-accent)] flex items-center justify-center transition-colors"
                  title={`${f.label} (${f.marker}text${f.marker})`}
                  aria-label={f.label}
                >
                  <Icon size={13} />
                </button>
              );
            })}
          </div>

          <textarea
            ref={textareaRef}
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={composerBlocked ? 'Cannot send messages to this contact' : 'Type a message'}
            disabled={composerBlocked}
            className="msg-composer-input disabled:opacity-50"
            rows={1}
          />
        </div>

        <button
          onClick={() => {
            if (isRecording) { stopRecording(); return; }
            if (recordingPreview) { sendVoiceNote(); return; }
            if (newMessage.trim() || pendingAttachment) {
              if (sendGateArmed) handleSendMessage();
              return;
            }
            startRecording();
          }}
          disabled={composerBlocked || isUploading}
          className="msg-send-btn"
          title={isRecording ? 'Stop recording' : recordingPreview ? 'Send voice message' : isSending ? 'Sending...' : (newMessage.trim() || pendingAttachment) ? 'Send message' : 'Record voice message'}
          aria-label={isRecording ? 'Stop recording' : recordingPreview ? 'Send voice message' : (newMessage.trim() || pendingAttachment) ? 'Send message' : 'Record voice message'}
        >
          {isRecording ? <CheckCircle2 size={20} /> :
           isSending || isUploading ? <Loader2 size={20} className="animate-spin" /> :
           (newMessage.trim() || pendingAttachment) ? <Send size={20} /> : <Mic size={20} />}
        </button>
      </div>

      {activeConversation.mode === 'ai' && (
        <div className="flex items-center justify-center py-1.5 bg-[#111B21] border-t border-[rgba(255,255,255,0.06)] shrink-0">
          <span className="text-[10px] font-medium bg-[#00A884]/10 text-[#00A884] border border-[#00A884]/20 rounded px-2 py-0.5 flex items-center gap-1">
            <Bot size={9} className={isAITyping ? "animate-pulse" : ""} />
            AI Mode active — AI responds automatically to incoming customer messages
          </span>
        </div>
      )}

      {/* Forward Dialog */}
      <ForwardDialog
        isOpen={!!forwardMessage}
        onClose={() => setForwardMessage(null)}
        onForward={handleForwardToContact}
        conversations={conversations}
      />

      {/* Delete Confirm Dialog */}
      <DeleteConfirmDialog
        isOpen={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleteForMe={handleDeleteForMe}
        onDeleteForEveryone={handleDeleteForEveryone}
      />

      {/* Send Template Dialog */}
      <TemplateSendDialog
        isOpen={showTemplateSend}
        onClose={() => setShowTemplateSend(false)}
        phone={activeConversation?.contact?.phone}
        contactName={activeConversation?.contact?.name}
        onSent={(m) => {
          try {
            setConversations(prev => prev.map(conv => conv.id === activeConversation.id ? {
              ...conv,
              messages: [...(conv.messages || []), m],
              lastMessage: { text: m.templateName ? `Template: ${m.templateName}` : 'Template sent', timestamp: m.sentAt || new Date().toISOString(), from: 'me', status: 'sent' },
            } : conv));
          } catch { /* noop */ }
        }}
      />
    </div>
  );
};

export { ChatArea };