import React, { useState, useEffect, createContext, useContext, useMemo, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Settings, Loader2, BarChart3, Building2, Cpu, Menu, X as XIcon, Bell, Lock, Palette, Activity, Kanban, FileText, MessageCircle } from 'lucide-react';
import { useWebSocket } from '../context/WebSocketProvider';

import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { cn } from '../components/ui/cn';
import { ChatSidebar } from './components/ChatSidebar';
import { ChatArea } from './components/ChatArea';
import { ContactPanel } from './components/ContactPanel';
import { SafetySettings } from './components/SafetySettings';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AiProviderSettings } from './components/AiProviderSettings';
import { BusinessProfileSettings } from './components/BusinessProfileSettings';
import AccountHealthDashboard from './components/AccountHealthDashboard';
import ConversationIntelligence from './components/ConversationIntelligence';
import TemplateManager from './components/TemplateManager';
import CrmPipeline from './components/CrmPipeline';
import { ProfileOverlay } from './components/ProfileOverlay';
import { ProfilePhotoViewer } from './components/ProfilePhotoViewer';
import MessageTemplates from './components/meta/MessageTemplates';
import MetaConnection from './components/meta/MetaConnection';
import AiAgents from './components/meta/AiAgents';
import MetaCampaigns from './components/meta/MetaCampaigns';
import MetaDashboard from './components/meta/MetaDashboard';
import { SHIELD_HOME } from '../utils/paths';


const defaultSafetySettings = {
  antiBan: {
    enabled: true,
    messageDelay: { min: 2, max: 5 },
    typingSimulation: true,
    typingDuration: { min: 1, max: 3 },
    messageHumanization: true,
    randomEmojis: false,
    duplicateMessageFilter: true,
  },
  rateLimiting: {
    enabled: true,
    maxPerMinute: 5,
    maxPerHour: 30,
    maxPerDay: 200,
    cooldownAfterBurst: { messages: 10, pauseMinutes: 5 },
  },
  sessionSafety: {
    businessHoursOnly: false,
    businessHours: { start: '09:00', end: '18:00' },
    randomOnlineStatus: true,
    cooldownBetweenChats: { min: 30, max: 120 },
    maxConcurrentChats: 5,
  },
  messageSafety: {
    lengthVariation: true,
    emojiRandomization: true,
    greetingVariation: true,
    smartReplyDelay: true,
    avoidRepetition: true,
    contentFiltering: true,
  },
  monitoring: {
    alertsEnabled: true,
    banRiskThreshold: 70,
    autoPauseOnRisk: true,
    dailyReportEmail: false,
    logAllMessages: true,
  },
};

const MessageAgentContext = createContext();

export const useMessageAgent = () => {
  const context = useContext(MessageAgentContext);
  if (!context) {
    throw new Error('useMessageAgent must be used within MessageAgentProvider');
  }
  return context;
};

export const MessageAgentProvider = ({ children, ws }) => {
  const [conversations, setConversations] = useState([]);
  const [activeConversationId, setActiveConversationId] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [conversationMode, setConversationMode] = useState('all');
  const [aiProviders, setAiProviders] = useState([]);
  const [businessProfile, setBusinessProfile] = useState({});
  const [isLoading, setIsLoading] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [analytics, setAnalytics] = useState(null);
  const [sendGateArmed, setSendGateArmed] = useState(false);
  const loadConversationsRef = useRef(null);
  const refreshTimerRef = useRef(null);
  const [safetySettings, setSafetySettings] = useState(() => {
    try {
      const saved = localStorage.getItem('whatsapp_shield_safety_settings');
      return saved ? JSON.parse(saved) : defaultSafetySettings;
    } catch {
      return defaultSafetySettings;
    }
  });

  // Derive activeConversation from conversations array + activeConversationId
  // This ensures it's ALWAYS in sync with the latest data
  const activeConversation = useMemo(() => {
    if (!activeConversationId) return null;
    return conversations.find(c => c.id === activeConversationId) || null;
  }, [conversations, activeConversationId]);

  const setActiveConversation = useCallback((convOrFn) => {
    if (convOrFn === null) {
      setActiveConversationId(null);
    } else if (convOrFn?.id) {
      setActiveConversationId(convOrFn.id);
    }
  }, []);

  const phoneMatch = useCallback((a, b) => {
    const da = String(a || '').replace(/\D/g, '');
    const db = String(b || '').replace(/\D/g, '');
    return !!da && da === db;
  }, []);

  // Load conversations from API — single-flight so rapid callers (selection
  // changes, WS bursts) collapse into one request instead of N overlapping
  // fetches that race each other and churn the UI.
  const loadConversations = useCallback(async () => {
    const existing = loadConversationsRef.current;
    if (existing) {
      existing.pending = true;
      return existing.promise;
    }
    setIsLoading(true);
    setLoadError(null);
    const promise = fetch('/api/message-agent/conversations')
      .then(res => res.json())
      .then(data => {
        if (!data.success) throw new Error(data.error || 'Failed to load conversations');
        setConversations(data.conversations || []);
        // First successful load ticks this flag so consumers can tell the
        // genuine initial fetch (show skeleton) apart from later background
        // refreshes (never show skeleton, even while a refresh is in flight).
        setHasLoadedOnce(true);
      })
      .catch(err => {
        console.error('Error loading conversations:', err);
        setLoadError(err.message || 'Could not load conversations');
      })
      .finally(() => {
        const current = loadConversationsRef.current;
        if (current && current.pending) {
          current.pending = false;
          loadConversations();
        } else {
          loadConversationsRef.current = null;
          setIsLoading(false);
        }
      });
    loadConversationsRef.current = { pending: false, promise };
    return promise;
  }, []);

  // Background refresh coalesced to a trailing window so a burst of WS events
  // (typing, status ticks, batching) does not trigger one fetch each.
  const scheduleRefresh = useCallback((delay = 800) => {
    if (refreshTimerRef.current) clearTimeout(refreshTimerRef.current);
    refreshTimerRef.current = setTimeout(() => { loadConversations(); }, delay);
  }, [loadConversations]);

  // Apply WS Message Agent updates as small targeted local merges instead of a
  // full conversation reload on every event. A full reload still happens as a
  // fallback for unknown actions and periodically as a gentle reconciliation.
  useEffect(() => {
    const handleUpdate = (event) => {
      const data = event.detail;
      if (!data) return;

      switch (data.action) {
        case 'new_message': {
          const msg = data.message;
          if (!msg) break;
          setConversations(prev => prev.map(conv => {
            const idMatch = data.contactId && conv.id === data.contactId;
            const phoneMatchHit = data.phone && phoneMatch(conv.contact?.phone, data.phone);
            if (!idMatch && !phoneMatchHit) return conv;
            const messages = conv.messages || [];
            if (messages.some(m => m.id === msg.id)) return conv;
            const appended = [...messages, msg];
            return {
              ...conv,
              messages: appended,
              lastMessage: { text: msg.text, timestamp: msg.timestamp, from: msg.from, status: msg.status }
            };
          }));
          break;
        }
        case 'message_status': {
          setConversations(prev => prev.map(conv => {
            const idMatch = data.contactId && conv.id === data.contactId;
            const phoneMatchHit = data.phone && phoneMatch(conv.contact?.phone, data.phone);
            if (!idMatch && !phoneMatchHit) return conv;
            const updatedMessages = (conv.messages || []).map(m =>
              m.id === data.messageId ? { ...m, status: data.status } : m
            );
            const same = updatedMessages.every((m, i) => m === (conv.messages || [])[i] || m.status === (conv.messages || [])[i].status);
            return same ? conv : { ...conv, messages: updatedMessages };
          }));
          break;
        }
        case 'contact_updated': {
          const c = data.contact || data.conversation;
          if (!c) break;
          setConversations(prev => prev.map(conv => {
            const idMatch = conv.id === c.id;
            const phoneMatchHit = c.phone && phoneMatch(conv.contact?.phone, c.phone);
            if (!idMatch && !phoneMatchHit) return conv;
            const { messages, ...meta } = c;
            return { ...conv, ...meta, messages: conv.messages || messages || [] };
          }));
          break;
        }
        case 'contact_deleted': {
          setConversations(prev => prev.filter(conv => conv.id !== data.contactId));
          setActiveConversationId(prev => prev === data.contactId ? null : prev);
          break;
        }
        case 'message_deleted': {
          setConversations(prev => prev.map(conv => {
            const phoneMatchHit = data.phone && phoneMatch(conv.contact?.phone, data.phone);
            if (!phoneMatchHit) return conv;
            const current = conv.messages || [];
            let updated;
            if (data.deleteForEveryone) {
              updated = current.filter(m => m.id !== data.messageId);
              if (updated.length === current.length) return conv;
            } else {
              updated = current.map(m => m.id === data.messageId
                ? { ...m, text: 'You deleted this message', deleted: true, from: 'system' }
                : m);
              if (updated.every((m, i) => m === current[i])) return conv;
            }
            return {
              ...conv,
              messages: updated,
              lastMessage: updated.length ? updated[updated.length - 1] : conv.lastMessage
            };
          }));
          break;
        }
        case 'contact_blocked': {
          setConversations(prev => prev.map(conv => conv.id === data.contactId
            ? { ...conv, contact: { ...conv.contact, blocked: true } }
            : conv));
          break;
        }
        case 'contact_unblocked': {
          setConversations(prev => prev.map(conv => conv.id === data.contactId
            ? { ...conv, contact: { ...conv.contact, blocked: false } }
            : conv));
          break;
        }
        case 'contact_opted_out': {
          setConversations(prev => prev.map(conv => conv.id === data.contactId
            ? { ...conv, contact: { ...conv.contact, optedOut: true } }
            : conv));
          break;
        }
        case 'contacts_imported':
        case 'shield_contacts_deleted':
          // The backend persisted new contacts (or removed a batch). We cannot
          // construct authoritative conversation envelopes locally, so coalesce
          // a single background reload. This is one fetch per import/delete
          // action — not polling.
          scheduleRefresh(data.count ? Math.min(50 + data.count, 400) : 250);
          break;
        default:
          scheduleRefresh();
      }
    };

    window.addEventListener('messageAgent-update', handleUpdate);
    return () => window.removeEventListener('messageAgent-update', handleUpdate);
  }, [phoneMatch, scheduleRefresh]);

  // Send gate: reflects the server's read-only switch so the composer can show
  // an explicit "Enable messaging" action instead of silently failing sends.
  useEffect(() => {
    const handle = (e) => setSendGateArmed(!!e.detail?.armed);
    window.addEventListener('send-gate-update', handle);
    return () => window.removeEventListener('send-gate-update', handle);
  }, []);

  const armSendGate = useCallback(() => {
    ws?.sendMessage?.({ type: 'ARM_SENDING', confirm: true });
  }, [ws]);

  const disarmSendGate = useCallback(() => {
    ws?.sendMessage?.({ type: 'DISARM_SENDING' });
  }, [ws]);

  // Load analytics
  const loadAnalytics = useCallback(async () => {
    try {
      const res = await fetch('/api/message-agent/analytics');
      const data = await res.json();
      if (data.success) {
        setAnalytics(data.analytics);
      }
    } catch (err) {
      console.error('Error loading analytics:', err);
    }
  }, []);

  // Load AI providers
  const loadAiProviders = useCallback(async () => {
    try {
      const res = await fetch('/api/message-agent/ai-providers');
      const data = await res.json();
      if (data.success) {
        setAiProviders(data.providers || []);
      }
    } catch (err) {
      console.error('Error loading AI providers:', err);
    }
  }, []);

  // Load business profile
  const loadBusinessProfile = useCallback(async () => {
    try {
      const res = await fetch('/api/message-agent/business-profile');
      const data = await res.json();
      if (data.success) {
        setBusinessProfile(data.profile || {});
      }
    } catch (err) {
      console.error('Error loading business profile:', err);
    }
  }, []);

  // Create or get conversation
  const createConversation = useCallback(async (phone, mode = 'manual', contactInfo = {}) => {
    try {
      const res = await fetch('/api/message-agent/conversation', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, mode, contactInfo })
      });
      const data = await res.json();
      if (data.success) {
        await loadConversations();
        return data.conversation;
      }
      return null;
    } catch (err) {
      console.error('Error creating conversation:', err);
      return null;
    }
  }, [loadConversations]);

  // Send message via API
  const sendMessage = useCallback(async (contactId, phone, message, from = 'user', mode = 'manual') => {
    try {
      const res = await fetch('/api/message-agent/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contactId, phone, message, from, mode,
          // Explicit per-send confirmation required by the server send gate.
          confirmed: true
        })
      });
      const data = await res.json();
      if (res.status === 403 && data.message) {
        data.message.status = 'blocked';
        data.message.complianceBlocked = true;
        return data.message;
      }
      if (data.message) {
        if (data.waError) {
          data.message.status = 'failed';
          data.message.waError = data.waError;
        }
        return data.message;
      }
      return null;
    } catch (err) {
      console.error('Error sending message:', err);
      return null;
    }
  }, []);

  // Update conversation
  const updateConversation = useCallback(async (id, updates) => {
    try {
      const res = await fetch(`/api/message-agent/conversation/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      const data = await res.json();
      if (data.success) {
        setConversations(prev => prev.map(c => c.id === id ? { ...c, ...updates } : c));
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error updating conversation:', err);
      return false;
    }
  }, []);

  // Delete conversation
  const deleteConversation = useCallback(async (id) => {
    try {
      const res = await fetch(`/api/message-agent/conversation/${id}`, {
        method: 'DELETE'
      });
      const data = await res.json();
      if (data.success) {
        setConversations(prev => prev.filter(c => c.id !== id));
        if (activeConversationId === id) {
          setActiveConversationId(null);
        }
        return true;
      }
      return false;
    } catch (err) {
      console.error('Error deleting conversation:', err);
      return false;
    }
  }, [activeConversationId]);

  // Delete message
  const deleteMessage = useCallback(async (messageId, phone, deleteForEveryone = false) => {
    try {
      const res = await fetch('/api/message-agent/message/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messageId, phone, deleteForEveryone })
      });
      const data = await res.json();
      return data.success;
    } catch (err) {
      console.error('Error deleting message:', err);
      return false;
    }
  }, []);

  // Compliance check
  const checkCompliance = useCallback(async (contactId) => {
    if (!contactId) return { allowed: true };
    try {
      const res = await fetch(`/api/message-agent/compliance/check/${contactId}`);
      const data = await res.json();
      return data;
    } catch {
      return { allowed: true };
    }
  }, []);

  // Block/unblock contact
  const blockContact = useCallback(async (contactId, reason) => {
    try {
      const res = await fetch('/api/message-agent/compliance/block', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId, reason })
      });
      const data = await res.json();
      if (data.success) await loadConversations();
      return data.success;
    } catch { return false; }
  }, [loadConversations]);

  const unblockContact = useCallback(async (contactId) => {
    try {
      const res = await fetch('/api/message-agent/compliance/unblock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contactId })
      });
      const data = await res.json();
      if (data.success) await loadConversations();
      return data.success;
    } catch { return false; }
  }, [loadConversations]);

  // --- Saved contacts ---
  // Contacts live server-side per WA session; "saved" is an idempotent flag on
  // the session's own contact record. Both helpers optimistically patch the UI
  // for a snappy feel, then reconcile with the server's authoritative state.
  // An in-flight set guarantees a rapid double-click can never fire duplicate
  // requests or duplicate saves.
  const savedContactOpsRef = useRef(new Set());

  const patchSavedFlag = useCallback((phone, saved) => {
    setConversations(prev => prev.map(c => {
      if (!phoneMatch(c.contact?.phone, phone)) return c;
      const next = { ...c, saved: !!saved };
      if (saved) {
        next.savedAt = c.savedAt || new Date().toISOString();
      } else {
        next.savedAt = null;
      }
      return next;
    }));
  }, [phoneMatch, setConversations]);

  const saveContact = useCallback(async (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const key = `save_${digits}`;
    if (savedContactOpsRef.current.has(key)) return true; // already in flight
    savedContactOpsRef.current.add(key);
    patchSavedFlag(digits, true);
    try {
      const res = await fetch('/api/message-agent/contacts/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        patchSavedFlag(digits, true);
        return data;
      }
      patchSavedFlag(digits, false); // revert optimistic patch on failure
      return null;
    } catch (err) {
      console.error('Error saving contact:', err);
      patchSavedFlag(digits, false);
      return null;
    } finally {
      savedContactOpsRef.current.delete(key);
    }
  }, [patchSavedFlag]);

  const unsaveContact = useCallback(async (phone) => {
    const digits = String(phone || '').replace(/\D/g, '');
    if (!digits) return null;
    const key = `unsave_${digits}`;
    if (savedContactOpsRef.current.has(key)) return true; // already in flight
    savedContactOpsRef.current.add(key);
    patchSavedFlag(digits, false);
    try {
      const res = await fetch('/api/message-agent/contacts/unsave', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone })
      });
      const data = await res.json();
      if (data.success) {
        patchSavedFlag(digits, false);
        return data;
      }
      patchSavedFlag(digits, true); // revert optimistic patch on failure
      return null;
    } catch (err) {
      console.error('Error unsaving contact:', err);
      patchSavedFlag(digits, true);
      return null;
    } finally {
      savedContactOpsRef.current.delete(key);
    }
  }, [patchSavedFlag]);

  // Generate AI response — enriched with CRM state, journey, notes and objective.
  const generateAiResponse = useCallback(async (message, conversationHistory, conversation = null) => {
    try {
      const contact = conversation?.contact || null;
      const res = await fetch('/api/message-agent/ai-generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message,
          conversationHistory,
          contact,
          businessProfile,
          crm: conversation?.crm || null,
          journey: conversation?.journey || null,
          notes: conversation?.notes || '',
          notesList: conversation?.notesList || [],
          aiObjective: conversation?.aiObjective || 'lead_qualification',
        })
      });
      const data = await res.json();
      if (data.success) {
        return data;
      }
      return null;
    } catch (err) {
      console.error('Error generating AI response:', err);
      return null;
    }
  }, [businessProfile]);

  const filteredConversations = useMemo(() => {
    let filtered = conversations;
    
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      filtered = filtered.filter(conv => 
        conv?.contact?.name?.toLowerCase().includes(q) ||
        conv?.contact?.phone?.includes(searchQuery) ||
        conv?.tags?.some(t => t.toLowerCase().includes(q))
      );
    }
    
    if (conversationMode !== 'all') {
      if (conversationMode === 'pinned') {
        filtered = filtered.filter(conv => conv.pinned);
      } else if (conversationMode === 'starred') {
        filtered = filtered.filter(conv => conv.starred);
      } else if (conversationMode === 'archived') {
        filtered = filtered.filter(conv => conv.archived);
      } else if (conversationMode === 'saved') {
        filtered = filtered.filter(conv => conv.saved);
      } else {
        filtered = filtered.filter(conv => conv.mode === conversationMode && !conv.archived);
      }
    } else {
      filtered = filtered.filter(conv => !conv.archived);
    }
    
    return filtered.sort((a, b) => {
      if (a.pinned && !b.pinned) return -1;
      if (!a.pinned && b.pinned) return 1;
      const tsA = a?.lastMessage?.timestamp ? new Date(a.lastMessage.timestamp).getTime() : 0;
      const tsB = b?.lastMessage?.timestamp ? new Date(b.lastMessage.timestamp).getTime() : 0;
      return tsB - tsA;
    });
  }, [conversations, searchQuery, conversationMode]);

  // Single stable context value. Every consumer of useMessageAgent() re-renders
  // when this object identity changes, so it must NOT be rebuilt on every
  // provider render (typing, WS bursts, etc.). It only changes when one of its
  // memoized members actually changes. All members below are wrapped in
  // useCallback/useMemo with stable deps.
  const value = useMemo(() => ({
    conversations,
    setConversations,
    activeConversation,
    activeConversationId,
    setActiveConversation,
    searchQuery,
    setSearchQuery,
    conversationMode,
    setConversationMode,
    aiProviders,
    setAiProviders,
    businessProfile,
    setBusinessProfile,
    isLoading,
    setIsLoading,
    hasLoadedOnce,
    loadError,
    filteredConversations,
    safetySettings,
    setSafetySettings,
    analytics,
    loadConversations,
    loadAnalytics,
    loadAiProviders,
    loadBusinessProfile,
    createConversation,
    sendMessage,
    updateConversation,
    deleteConversation,
    deleteMessage,
    generateAiResponse,
    checkCompliance,
    blockContact,
    unblockContact,
    saveContact,
    unsaveContact,
    sendGateArmed,
    armSendGate,
    disarmSendGate,
    scheduleRefresh,
  }), [
    conversations, setConversations, activeConversation, activeConversationId,
    setActiveConversation, searchQuery, setSearchQuery, conversationMode,
    setConversationMode, aiProviders, setAiProviders, businessProfile,
    setBusinessProfile, isLoading, setIsLoading, hasLoadedOnce, loadError,
    filteredConversations, safetySettings, setSafetySettings, analytics,
    loadConversations, loadAnalytics, loadAiProviders, loadBusinessProfile,
    createConversation, sendMessage, updateConversation, deleteConversation,
    deleteMessage, generateAiResponse, checkCompliance, blockContact,
    unblockContact, saveContact, unsaveContact, sendGateArmed, armSendGate,
    disarmSendGate, scheduleRefresh,
  ]);

  return (
    <MessageAgentContext.Provider value={value}>
      {children}
    </MessageAgentContext.Provider>
  );
};

const ConnectionRequiredScreen = ({ onOpenShield }) => {
  return (
    <div className="flex-1 flex items-center justify-center p-8">
      <div className="text-center max-w-sm">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto mb-6">
          <Shield size={36} className="text-primary" />
        </div>
        <h2 className="text-xl font-display font-bold text-text-primary mb-2">
          WhatsApp Connection Required
        </h2>
        <p className="text-text-secondary text-sm mb-6 leading-relaxed">
          Message Agent requires an active WhatsApp Shield connection before you can send or receive messages.
        </p>
        <Button onClick={onOpenShield} size="default" className="gap-2">
          <Shield size={16} />
          Open WhatsApp Shield
        </Button>
        <p className="text-text-muted text-xs mt-4">
          Connect your WhatsApp session from the Shield dashboard, then return here.
        </p>
      </div>
    </div>
  );
};

const MessageAgentPage = () => {
  const ws = useWebSocket();
  const isAuthenticated = ws?.isAuthenticated;
  const status = ws?.status;
  const sessionUser = ws?.sessionUser;
  const logout = ws?.logout;
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="message-agent-root flex-1 min-h-0 bg-[#0B141A] flex flex-col overflow-hidden">
      <MessageAgentProvider ws={ws}>
        <MessageAgentPageInner
          isAuthenticated={isAuthenticated}
          status={status}
          sessionUser={sessionUser}
          logout={logout}
          navigate={navigate}
          location={location}
        />
      </MessageAgentProvider>
    </div>
  );
};


const MessageAgentPageInner = ({ isAuthenticated, status, sessionUser, logout, navigate, location }) => {

  const { 
    activeConversation, setActiveConversation, safetySettings, loadConversations,
    loadAnalytics, loadAiProviders, loadBusinessProfile, createConversation, conversations,
    setConversations
  } = useMessageAgent();
  const conversationsRef = useRef(conversations);
  conversationsRef.current = conversations;
  const [showSafetySettings, setShowSafetySettings] = useState(false);
  const [showAnalytics, setShowAnalytics] = useState(false);
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [showBusinessProfile, setShowBusinessProfile] = useState(false);
  const [showHealthDashboard, setShowHealthDashboard] = useState(false);
  const [showIntelligence, setShowIntelligence] = useState(false);
  const [showTemplates, setShowTemplates] = useState(false);
  const [showCrmPipeline, setShowCrmPipeline] = useState(false);
  const [showProfileOverlay, setShowProfileOverlay] = useState(false);
  const [showPhotoViewer, setShowPhotoViewer] = useState(false);
  const [showContactPanel, setShowContactPanel] = useState(() => {
    try { return localStorage.getItem('msgAgent_contactPanel') !== 'false'; } catch { return true; }
  });
  const [showMetaTemplates, setShowMetaTemplates] = useState(false);
  const [showMetaConnection, setShowMetaConnection] = useState(false);
  const [showMetaAgents, setShowMetaAgents] = useState(false);
  const [showMetaCampaigns, setShowMetaCampaigns] = useState(false);
  const [showMetaDashboard, setShowMetaDashboard] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(() => {
    try { return localStorage.getItem('msgAgent_sidebarOpen') !== 'false'; } catch { return true; }
  });
  const handleBackToShield = () => navigate(SHIELD_HOME);

  useEffect(() => {
    localStorage.setItem('msgAgent_contactPanel', showContactPanel);
  }, [showContactPanel]);

  useEffect(() => {
    localStorage.setItem('msgAgent_sidebarOpen', sidebarOpen);
  }, [sidebarOpen]);

  // Auto-close sidebar on small screens when conversation opens
  useEffect(() => {
    if (window.innerWidth < 768 && activeConversation) {
      setSidebarOpen(false);
    }
  }, [activeConversation]);

  // Keep the open conversation in sync with the latest server state.
  // Prevents stale data and avoids the chat closing when conversations refresh.
  useEffect(() => {
    if (!activeConversation) return;
    const fresh = conversations.find(c => c.id === activeConversation.id);
    if (fresh) {
      setActiveConversation(fresh);
    }
  }, [conversations]);

  // Load data on mount
  useEffect(() => {
    if (isAuthenticated) {
      loadConversations();
      loadAnalytics();
      loadAiProviders();
      loadBusinessProfile();
    }
  }, [isAuthenticated, loadConversations, loadAnalytics, loadAiProviders, loadBusinessProfile]);

  // Drop local conversations immediately when the session ends so a previous
  // user's chats can never linger for the next session on this page.
  useEffect(() => {
    if (!isAuthenticated) {
      setConversations([]);
      setActiveConversation(null);
    }
  }, [isAuthenticated, setConversations, setActiveConversation]);

  // Prevent re-processing location state on re-renders/remounts
  const processedStateRef = useRef(null);

  // Handle contact transfer from WhatsApp Shield
  useEffect(() => {
    const state = location?.state;
    if (!state || !isAuthenticated || processedStateRef.current === state) return;
    processedStateRef.current = state;

    if (state.selectedContact) {
      const contact = state.selectedContact;
      createConversation(contact.phone, 'manual', {
        name: contact.name,
        phone: contact.phone,
        country: contact.country,
        avatar: contact.avatar,
        about: contact.about,
        exists: contact.exists,
        source: 'whatsapp_shield'
      }).then(conv => {
        if (conv) {
          setTimeout(() => {
            loadConversations().then(() => {
              const freshConv = conversationsRef.current.find(c => 
                c.contact?.phone?.replace(/\D/g, '') === contact.phone?.replace(/\D/g, '')
              );
              if (freshConv) setActiveConversation(freshConv);
            });
          }, 300);
        }
      });
    }

    if (state.batchContacts) {
      state.batchContacts.forEach(contact => {
        createConversation(contact.phone, 'manual', {
          name: contact.name,
          phone: contact.phone,
          country: contact.country,
          avatar: contact.avatar,
          about: contact.about,
          exists: contact.exists,
          source: 'whatsapp_shield'
        });
      });
      setTimeout(() => loadConversations(), 500);
    }

    window.history.replaceState(null, '');
  }, [location?.state, isAuthenticated, createConversation, loadConversations, setActiveConversation]);

  // Handle openMessageAgent custom event from Step5Reports
  useEffect(() => {
    const handleOpenMessageAgent = (event) => {
      const { phone, contact } = event.detail || {};
      if (phone && isAuthenticated) {
        createConversation(phone, 'manual', {
          name: contact?.name || `+${phone.replace(/\D/g, '')}`,
          phone,
          country: contact?.country || 'Unknown',
          avatar: contact?.avatar || null,
          about: contact?.about || '',
          exists: contact?.exists || false,
          source: 'whatsapp_shield'
        }).then(() => {
          setTimeout(() => {
            loadConversations().then(() => {
              const freshConv = conversationsRef.current.find(c => 
                c.contact?.phone?.replace(/\D/g, '') === phone.replace(/\D/g, '')
              );
              if (freshConv) setActiveConversation(freshConv);
            });
          }, 300);
        });
      }
    };

    window.addEventListener('openMessageAgent', handleOpenMessageAgent);
    return () => window.removeEventListener('openMessageAgent', handleOpenMessageAgent);
  }, [isAuthenticated, createConversation, loadConversations, setActiveConversation]);

  // Real-time Message Agent updates are handled directly by the provider (targeted
  // local merges + reconciled background refresh), so no extra reload is needed here.

  // Profile menu event listeners
  useEffect(() => {
    const openSafety = () => setShowSafetySettings(true);
    const openAi = () => setShowAiSettings(true);
    const openBiz = () => setShowBusinessProfile(true);
    const openHealth = () => setShowHealthDashboard(true);
    const openTemplates = () => setShowTemplates(true);
    const openCrm = () => setShowCrmPipeline(true);
    const openMetaTemplates = () => setShowMetaTemplates(true);
    const openMetaConnection = () => setShowMetaConnection(true);
    const openMetaAgents = () => setShowMetaAgents(true);
    const openMetaCampaigns = () => setShowMetaCampaigns(true);
    const openMetaDashboard = () => setShowMetaDashboard(true);
    window.addEventListener('open-safety-settings', openSafety);
    window.addEventListener('open-ai-settings', openAi);
    window.addEventListener('open-business-profile', openBiz);
    window.addEventListener('open-health-dashboard', openHealth);
    window.addEventListener('open-templates', openTemplates);
    window.addEventListener('open-crm-pipeline', openCrm);
    window.addEventListener('open-meta-templates', openMetaTemplates);
    window.addEventListener('open-meta-connection', openMetaConnection);
    window.addEventListener('open-meta-agents', openMetaAgents);
    window.addEventListener('open-meta-campaigns', openMetaCampaigns);
    window.addEventListener('open-meta-dashboard', openMetaDashboard);
    return () => {
      window.removeEventListener('open-safety-settings', openSafety);
      window.removeEventListener('open-ai-settings', openAi);
      window.removeEventListener('open-business-profile', openBiz);
      window.removeEventListener('open-health-dashboard', openHealth);
      window.removeEventListener('open-templates', openTemplates);
      window.removeEventListener('open-crm-pipeline', openCrm);
      window.removeEventListener('open-meta-templates', openMetaTemplates);
      window.removeEventListener('open-meta-connection', openMetaConnection);
      window.removeEventListener('open-meta-agents', openMetaAgents);
      window.removeEventListener('open-meta-campaigns', openMetaCampaigns);
      window.removeEventListener('open-meta-dashboard', openMetaDashboard);
    };
  }, []);

  // Consume a deep-link settings intent (set from the Settings page) and open
  // the matching modal once this page has mounted.
  useEffect(() => {
    if (!isAuthenticated) return;
    let intent = null;
    try { intent = sessionStorage.getItem('msgAgent_settings_intent'); } catch { /* ignore */ }
    if (!intent) return;
    try { sessionStorage.removeItem('msgAgent_settings_intent'); } catch { /* ignore */ }

    const openers = {
      safety: () => setShowSafetySettings(true),
      ai: () => setShowAiSettings(true),
      business: () => setShowBusinessProfile(true),
      health: () => setShowHealthDashboard(true),
      templates: () => setShowTemplates(true),
      crm: () => setShowCrmPipeline(true),
    };
    const open = openers[intent];
    if (open) {
      const t = setTimeout(open, 350);
      return () => clearTimeout(t);
    }
  }, [isAuthenticated]);

  return (
    <>
      <SafetySettings isOpen={showSafetySettings} onClose={() => setShowSafetySettings(false)} />
      <AnalyticsDashboard isOpen={showAnalytics} onClose={() => setShowAnalytics(false)} />
      <AiProviderSettings isOpen={showAiSettings} onClose={() => setShowAiSettings(false)} />
      <BusinessProfileSettings isOpen={showBusinessProfile} onClose={() => setShowBusinessProfile(false)} />
      <AccountHealthDashboard isOpen={showHealthDashboard} onClose={() => setShowHealthDashboard(false)} />
      <ConversationIntelligence isOpen={showIntelligence} onClose={() => setShowIntelligence(false)} conversationId={activeConversation?.id} />
      <TemplateManager isOpen={showTemplates} onClose={() => setShowTemplates(false)} />
      <CrmPipeline isOpen={showCrmPipeline} onClose={() => setShowCrmPipeline(false)} onSelectContact={(id) => { const conv = conversations.find(c => c.id === id); if (conv) setActiveConversation(conv); setShowCrmPipeline(false); }} />
      <MessageTemplates isOpen={showMetaTemplates} onClose={() => setShowMetaTemplates(false)} />
      <MetaConnection isOpen={showMetaConnection} onClose={() => setShowMetaConnection(false)} />
      <AiAgents isOpen={showMetaAgents} onClose={() => setShowMetaAgents(false)} />
      <MetaCampaigns isOpen={showMetaCampaigns} onClose={() => setShowMetaCampaigns(false)} />
      <MetaDashboard isOpen={showMetaDashboard} onClose={() => setShowMetaDashboard(false)} />
      <ProfileOverlay
        conversation={activeConversation}
        isOpen={showProfileOverlay}
        onClose={() => setShowProfileOverlay(false)}
      />
      <ProfilePhotoViewer
        contact={activeConversation?.contact}
        isOpen={showPhotoViewer}
        onClose={() => setShowPhotoViewer(false)}
      />
      
      {/* Secondary Toolbar — product-specific tools (not a primary header) */}
      <div className="h-9 border-b border-[rgba(255,255,255,0.06)] bg-[#111B21]/80 backdrop-blur-md flex items-center justify-between px-2.5 sm:px-3 shrink-0 gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {conversations.length > 0 && (
            <Badge variant="outline" className="text-[10px] whitespace-nowrap">{conversations.length} chats</Badge>
          )}
        </div>
        
        <div className="flex items-center gap-0.5 sm:gap-1">
          <Badge variant={isAuthenticated ? "success" : "outline"} className="hidden xl:flex items-center gap-1 text-[10px] px-1.5 py-0.5">
            <div className={cn("w-1.5 h-1.5 rounded-full", isAuthenticated ? "bg-[#00A884]" : "bg-[#8696A0]")} />
            {isAuthenticated ? 'Connected' : 'Disconnected'}
          </Badge>
          
          <div className="mx-0.5 h-4 w-px bg-[rgba(255,255,255,0.08)] hidden sm:block" />

          {/* Official Meta tools */}
          <button
            onClick={() => setShowMetaConnection(true)}
            className="h-6 sm:h-7 px-2 rounded-lg flex items-center gap-1.5 text-[#00A884] hover:bg-[#00A884]/10 transition-colors"
            title="Meta WhatsApp Business — connect official API"
          >
            <Building2 size={11} className="sm:size-[12]" />
            <span className="text-[10px] font-medium hidden sm:inline">Meta</span>
          </button>
          <button
            onClick={() => setShowMetaTemplates(true)}
            className="h-6 sm:h-7 px-2 rounded-lg flex items-center gap-1.5 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            title="Message Templates — AI generate, review, submit to Meta"
          >
            <FileText size={11} className="sm:size-[12]" />
            <span className="text-[10px] font-medium hidden md:inline">Templates</span>
          </button>
          <button
            onClick={() => setShowMetaCampaigns(true)}
            className="h-6 sm:h-7 px-2 rounded-lg flex items-center gap-1.5 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            title="Campaigns — schedule approved template sends"
          >
            <Kanban size={11} className="sm:size-[12]" />
            <span className="text-[10px] font-medium hidden lg:inline">Campaigns</span>
          </button>
          <button
            onClick={() => setShowMetaAgents(true)}
            className="h-6 sm:h-7 px-2 rounded-lg flex items-center gap-1.5 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            title="AI Agents — auto-reply to incoming Meta messages"
          >
            <Cpu size={11} className="sm:size-[12]" />
            <span className="text-[10px] font-medium hidden lg:inline">AI Agents</span>
          </button>
          <button
            onClick={() => setShowMetaDashboard(true)}
            className="h-6 sm:h-7 px-2 rounded-lg flex items-center gap-1.5 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[rgba(255,255,255,0.04)] transition-colors"
            title="Meta Dashboard — messages, templates, agents, activity"
          >
            <BarChart3 size={11} className="sm:size-[12]" />
            <span className="text-[10px] font-medium hidden lg:inline">Dashboard</span>
          </button>

          {isAuthenticated && safetySettings?.antiBan?.enabled && (
            <Badge variant="success" className="hidden xl:flex items-center gap-1 text-[10px] px-1.5 py-0.5">
              <Shield size={9} />
              Anti-Ban
            </Badge>
          )}
          
          <button
            onClick={() => navigate('/settings')}
            className="h-6 sm:h-7 px-2 rounded-lg flex items-center gap-1.5 text-[#8696A0] hover:text-[#E9EDEF] hover:bg-[rgba(255,255,255,0.04)] transition-colors border border-transparent hover:border-[rgba(255,255,255,0.06)]"
            title="Open Settings"
          >
            <Settings size={11} className="sm:size-[12]" />
            <span className="text-[10px] font-medium hidden sm:inline">Settings</span>
          </button>
        </div>
      </div>

      {/* Main Content */}
      {isAuthenticated ? (
        <div className="flex-1 min-h-0 flex overflow-hidden relative">
          {/* Sidebar overlay on mobile */}
          {sidebarOpen && !activeConversation && (
            <div className="fixed inset-0 bg-black/20 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
          )}

          {/* Sidebar */}
          <div className={cn(
            "flex-shrink-0 min-h-0 h-full flex flex-col overflow-hidden transition-all duration-200 z-40",
            sidebarOpen && !activeConversation ? "w-full md:w-[300px] xl:w-[320px]" : "hidden md:flex md:w-[300px] xl:w-[320px]"
          )}>
            <ChatSidebar />
          </div>

          {/* Mobile sidebar toggle when conversation is active */}
          {activeConversation && (
            <button
              onClick={() => setSidebarOpen(!sidebarOpen)}
              className={cn(
                "absolute top-2 left-2 z-30 md:hidden h-8 w-8 rounded-full bg-[#111B21] border border-[rgba(255,255,255,0.08)] flex items-center justify-center shadow-md transition-transform",
                sidebarOpen && "opacity-0 pointer-events-none"
              )}
            >
              <Menu size={16} className="text-[#E9EDEF]" />
            </button>
          )}

          {/* Mobile sidebar overlay when toggled from chat */}
          {sidebarOpen && activeConversation && (
            <>
              <div className="fixed inset-0 bg-black/40 z-30 md:hidden" onClick={() => setSidebarOpen(false)} />
              <div className="fixed left-0 top-0 bottom-0 w-80 max-w-[85vw] z-40 md:hidden shadow-2xl bg-[#111B21]">
                <div className="flex items-center justify-between p-2.5 border-b border-[rgba(255,255,255,0.06)]">
                  <span className="text-sm font-semibold text-[#E9EDEF]">Chats</span>
                  <button onClick={() => setSidebarOpen(false)} className="p-1 rounded-lg hover:bg-background">
                    <XIcon size={14} className="text-text-secondary" />
                  </button>
                </div>
                <ChatSidebar />
              </div>
            </>
          )}

          {/* Chat Area / Empty State */}
          <div className="flex-1 min-w-0 min-h-0 flex flex-col relative overflow-hidden bg-[#0B141A]">
            <AnimatePresence>
              {activeConversation ? (
                <motion.div
                  key={activeConversation.id}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="absolute inset-0 flex flex-col"
                >
                  <ChatArea 
                    onBackToList={() => { setActiveConversation(null); setSidebarOpen(true); }}
                    onToggleContactPanel={() => setShowContactPanel(!showContactPanel)}
                    onOpenProfile={() => setShowProfileOverlay(true)}
                    onPhotoClick={() => setShowPhotoViewer(true)}
                  />
                </motion.div>
              ) : (
                <motion.div
                  key="empty-state"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute inset-0 flex items-center justify-center p-4 sm:p-8"
                >
                  <div className="text-center max-w-sm">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-full bg-[rgba(0,168,132,0.1)] border border-[rgba(0,168,132,0.2)] flex items-center justify-center mx-auto mb-3 sm:mb-4">
                      <MessageCircle size={18} className="sm:size-[22] text-[#00A884]" />
                    </div>
                    <h2 className="text-base sm:text-lg font-display font-bold text-[#E9EDEF] mb-1.5 sm:mb-2">Welcome to Message Agent</h2>
                    <p className="text-[11px] sm:text-sm text-[#8696A0] mb-3 sm:mb-4">
                      Select a conversation from the sidebar or start a new one to begin communicating with your contacts.
                    </p>
                    <div className="text-[10px] sm:text-xs text-[#8696A0] space-y-0.5">
                      <p>Connected as: {sessionUser?.name || sessionUser?.number || 'Unknown'}</p>
                      <p className="hidden sm:block">All conversations are end-to-end encrypted</p>
                      <p className="hidden sm:block">AI mode available for automated responses</p>
                      <p className="flex items-center justify-center gap-1 text-[#00A884]">
                        <Shield size={10} className="sm:size-[12]" />
                        Anti-ban protection active
                      </p>
                    </div>
                    <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4">
                      <Button variant="outline" size="sm" onClick={() => setShowAnalytics(true)}>
                        <BarChart3 size={12} className="mr-1" />
                        Analytics
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => setShowAiSettings(true)}>
                        <Cpu size={12} className="mr-1" />
                        AI Settings
                      </Button>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Contact Panel — inline on desktop for stable 3-column layout */}
          <div className={cn(
            "w-72 lg:w-80 xl:w-[360px] border-l border-[rgba(255,255,255,0.08)] shrink-0",
            "hidden lg:flex flex-col h-full min-h-0"
          )}>
            <ContactPanel onPhotoClick={() => setShowPhotoViewer(true)} />
          </div>

          {/* Contact Panel — mobile drawer */}
          {activeConversation && showContactPanel && (
            <div className="fixed inset-y-0 right-0 w-80 max-w-[85vw] z-50 lg:hidden shadow-2xl bg-[#111B21]" onClick={() => setShowContactPanel(false)}>
              <div onClick={(e) => e.stopPropagation()}>
                <ContactPanel onClose={() => setShowContactPanel(false)} onPhotoClick={() => setShowPhotoViewer(true)} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <ConnectionRequiredScreen onOpenShield={handleBackToShield} />
      )}
    </>
  );
};

export default MessageAgentPage;
