import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Palette,
  Shield,
  BarChart3,
  HeartPulse,
  Kanban,
  FileText,
  Cpu,
  Building2,
  ShieldCheck,
  Monitor,
  Sun,
  Moon,
  Check,
  User,
  LayoutDashboard,
  History,
  MessageCircle,
  ChevronRight,
  Settings as SettingsIcon,
  Sparkles,
  Activity,
} from 'lucide-react';
import { useTheme } from '../context/ThemeProvider';
import { useWebSocket } from '../context/WebSocketProvider';
import { MessageAgentProvider, useMessageAgent } from './MessageAgentPage';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';
import { cn } from '../components/ui/cn';
import { SHIELD_HOME } from '../utils/paths';
import { SafetySettings } from './components/SafetySettings';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { AiProviderSettings } from './components/AiProviderSettings';
import { BusinessProfileSettings } from './components/BusinessProfileSettings';
import AccountHealthDashboard from './components/AccountHealthDashboard';
import TemplateManager from './components/TemplateManager';
import CrmPipeline from './components/CrmPipeline';
import MetaConnection from './components/meta/MetaConnection';
import MessageTemplates from './components/meta/MessageTemplates';
import MetaCampaigns from './components/meta/MetaCampaigns';
import AiAgents from './components/meta/AiAgents';
import MetaDashboard from './components/meta/MetaDashboard';

const THEME_OPTIONS = [
  { id: 'system', label: 'System', description: 'Follows your device', icon: Monitor },
  { id: 'light', label: 'Light', description: 'Bright & airy', icon: Sun },
  { id: 'dark', label: 'Dark', description: 'Easy on the eyes', icon: Moon },
];

const shieldWorkspace = [
  { to: '/profile', label: 'Profile', description: 'Identity, session & validation stats', icon: User },
  { to: SHIELD_HOME, label: 'Dashboard', description: 'Validation workflow & campaign setup', icon: LayoutDashboard },
  { to: '/history', label: 'History', description: 'Past campaigns, exports & data management', icon: History },
];

const CATEGORIES = [
  { id: 'appearance', label: 'Appearance', description: 'Theme & interface look', icon: Palette },
  { id: 'shield', label: 'WhatsApp Shield', description: 'Validation workspace', icon: Shield },
  { id: 'analytics', label: 'Analytics Dashboard', description: 'Performance insights', icon: BarChart3 },
  { id: 'health', label: 'Account Health', description: 'Safety monitoring', icon: HeartPulse },
  { id: 'crm', label: 'CRM Pipeline', description: 'Stages & deals', icon: Kanban },
  { id: 'templates', label: 'Template Manager', description: 'Message templates', icon: FileText },
  { id: 'ai', label: 'AI Provider Settings', description: 'Providers, keys & priority', icon: Cpu },
  { id: 'business', label: 'Business Profile', description: 'Identity & privacy', icon: Building2 },
  { id: 'safety', label: 'Safety & Anti-Ban', description: 'Account protection', icon: ShieldCheck },
  { id: 'meta', label: 'Meta WhatsApp', description: 'Official Cloud API connection', icon: Building2 },
  { id: 'metaTemplates', label: 'Meta Templates', description: 'AI generate, review & approve', icon: FileText },
  { id: 'metaCampaigns', label: 'Meta Campaigns', description: 'Bulk approved sends', icon: Kanban },
  { id: 'metaAgents', label: 'Meta AI Agents', description: 'Auto-reply agents', icon: Cpu },
  { id: 'metaDashboard', label: 'Meta Dashboard', description: 'Live overview & analytics', icon: LayoutDashboard },
];

function AppearancePanel() {
  const { theme, resolvedTheme, setTheme } = useTheme();
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="h-[3px] bg-gradient-to-r from-[#25D366] via-[#34D399] to-primary" aria-hidden="true" />
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Monitor size={16} className="text-primary" /> Appearance
        </CardTitle>
        <CardDescription>
          Choose how WhatsApp Shield looks. Changes apply instantly across both products.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex-1">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {THEME_OPTIONS.map(opt => {
            const active = theme === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                onClick={() => setTheme(opt.id)}
                aria-pressed={active}
                className={cn(
                  "group relative flex flex-col items-start gap-3 p-4 rounded-xl border text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                  active
                    ? "border-primary/40 bg-primary/[0.06] shadow-[0_0_0_1px_rgba(0,184,110,0.25)]"
                    : "border-border bg-background/40 hover:border-primary/30 hover:bg-surface"
                )}
              >
                {active && (
                  <motion.span
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="absolute top-3 right-3 w-5 h-5 rounded-full bg-primary text-white flex items-center justify-center"
                  >
                    <Check size={12} strokeWidth={3} />
                  </motion.span>
                )}
                <span className={cn(
                  "w-9 h-9 rounded-lg border flex items-center justify-center transition-colors duration-200",
                  active
                    ? "bg-primary/15 border-primary/30 text-primary"
                    : "bg-surface border-border/70 text-text-secondary group-hover:text-primary group-hover:border-primary/30"
                )}>
                  <Icon size={18} />
                </span>
                <span>
                  <span className={cn("block text-sm font-semibold", active ? "text-primary" : "text-text-primary")}>{opt.label}</span>
                  <span className="block text-xs text-text-muted mt-0.5">{opt.description}</span>
                </span>
              </button>
            );
          })}
        </div>

        <div className="mt-4 flex items-center gap-2 text-xs text-text-muted rounded-lg bg-background border border-border/60 px-3 py-2.5">
          <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse shrink-0" />
          Currently applying the <span className="font-medium text-text-secondary">{resolvedTheme === 'dark' ? 'Dark' : 'Light'}</span> theme
          {theme === 'system' && <span className="font-medium text-text-secondary">(from your device)</span>}
          .
        </div>
      </CardContent>
    </Card>
  );
}

function ShieldPanel() {
  const navigate = useNavigate();
  const { isAuthenticated } = useWebSocket();
  return (
    <Card className="overflow-hidden h-full flex flex-col">
      <div className="h-[3px] bg-gradient-to-r from-[#25D366] via-[#34D399] to-primary" aria-hidden="true" />
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <Shield size={16} className="text-primary" /> WhatsApp Shield
          <Badge variant="outline" className="ml-1 text-[10px]">Bulk Validation</Badge>
        </CardTitle>
        <CardDescription>Manage your number validation workspace.</CardDescription>
      </CardHeader>
      <CardContent className="pt-2 flex-1 flex flex-col gap-3">
        <div className={cn(
          "flex items-center gap-2.5 rounded-xl border px-3.5 py-2.5 text-xs",
          isAuthenticated ? "border-success/25 bg-success/5 text-success" : "border-warning/25 bg-warning/5 text-warning"
        )}>
          <span className={cn("w-2 h-2 rounded-full shrink-0", isAuthenticated ? "bg-success animate-pulse" : "bg-warning")} />
          <span className="font-medium">
            {isAuthenticated ? 'WhatsApp session connected' : 'No active WhatsApp session'}
          </span>
          {!isAuthenticated && <span className="text-text-muted hidden sm:inline">Connect in Dashboard to validate numbers.</span>}
        </div>
        <div className="flex flex-col divide-y divide-border/60">
          {shieldWorkspace.map(item => (
            <button
              key={item.to}
              onClick={() => navigate(item.to)}
              className="group flex items-center gap-3 px-2 py-3.5 -mx-2 rounded-lg text-left transition-colors duration-150 hover:bg-background/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
            >
              <span className="w-9 h-9 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
                <item.icon size={16} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium text-text-primary">{item.label}</span>
                <span className="block text-xs text-text-muted truncate">{item.description}</span>
              </span>
              <ChevronRight size={14} className="shrink-0 text-text-muted opacity-40 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100 transition-all duration-150" />
            </button>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsControlCenter() {
  const [activeCategory, setActiveCategory] = useState('appearance');
  const { safetySettings } = useMessageAgent();

  const protectionActive = !!safetySettings?.antiBan?.enabled && !!safetySettings?.rateLimiting?.enabled;
  const active = CATEGORIES.find(c => c.id === activeCategory);

  const renderPanel = () => {
    switch (activeCategory) {
      case 'appearance':
        return <AppearancePanel />;
      case 'shield':
        return <ShieldPanel />;
      case 'analytics':
        return <AnalyticsDashboard isOpen embedded />;
      case 'health':
        return <AccountHealthDashboard isOpen embedded />;
      case 'crm':
        return <CrmPipeline isOpen embedded />;
      case 'templates':
        return <TemplateManager isOpen embedded />;
      case 'ai':
        return <AiProviderSettings isOpen embedded />;
      case 'business':
        return <BusinessProfileSettings isOpen embedded />;
      case 'safety':
        return <SafetySettings isOpen embedded />;
      case 'meta':
        return <MetaConnection isOpen embedded />;
      case 'metaTemplates':
        return <MessageTemplates isOpen embedded />;
      case 'metaCampaigns':
        return <MetaCampaigns isOpen embedded />;
      case 'metaAgents':
        return <AiAgents isOpen embedded />;
      case 'metaDashboard':
        return <MetaDashboard isOpen embedded />;
      default:
        return <AppearancePanel />;
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full py-6 sm:py-8 relative">
      {/* Page header */}
      <div className="flex items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-primary/15 to-[#25D366]/10 border border-primary/20 flex items-center justify-center shrink-0">
            <SettingsIcon size={20} className="text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-display font-bold text-text-primary truncate">Settings</h1>
            <p className="text-sm text-text-secondary mt-0.5 hidden sm:block">
              Control center for WhatsApp Shield &amp; WhatsApp Message Agent
            </p>
          </div>
        </div>
        <Badge variant={protectionActive ? 'success' : 'warning'} className="shrink-0 hidden sm:flex items-center gap-1.5 px-3 py-1.5">
          <span className={cn("w-1.5 h-1.5 rounded-full", protectionActive ? 'bg-success animate-pulse' : 'bg-warning')} />
          {protectionActive ? 'Protection Active' : 'Protection Paused'}
        </Badge>
      </div>

      {/* Mobile category pills */}
      <div className="lg:hidden -mx-4 px-4 overflow-x-auto no-scrollbar mb-5">
        <div className="flex gap-1.5 min-w-max">
          {CATEGORIES.map(cat => {
            const isActive = activeCategory === cat.id;
            const Icon = cat.icon;
            return (
              <button
                key={cat.id}
                onClick={() => setActiveCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 rounded-full px-3.5 py-2 text-xs font-medium border transition-all duration-150 whitespace-nowrap",
                  isActive
                    ? "bg-primary text-white border-primary shadow-[0_2px_10px_rgba(0,184,110,0.35)]"
                    : "bg-surface border-border/70 text-text-secondary hover:border-primary/40 hover:text-text-primary"
                )}
              >
                <Icon size={13} />
                {cat.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[250px_minmax(0,1fr)] gap-6">
        {/* Desktop rail */}
        <aside className="hidden lg:block">
          <nav className="sticky top-20 bg-surface/80 backdrop-blur-xl border border-border rounded-2xl p-2.5 flex flex-col gap-0.5 shadow-sm shadow-black/5">
            <div className="px-3 pb-2 pt-1.5 text-[10px] text-text-muted uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Activity size={10} className="text-primary" /> Navigation
            </div>
            {CATEGORIES.map(cat => {
              const isActive = activeCategory === cat.id;
              const Icon = cat.icon;
              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  aria-current={isActive ? 'page' : undefined}
                  className={cn(
                    "group relative w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium transition-all duration-150 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                    isActive
                      ? "bg-primary/10 text-primary"
                      : "text-text-secondary hover:bg-surface hover:text-text-primary"
                  )}
                >
                  <span className={cn(
                    "absolute left-0 top-1/2 -translate-y-1/2 w-1 rounded-r-full bg-gradient-to-b from-primary to-[#25D366] transition-all duration-200",
                    isActive ? "h-5 opacity-100" : "h-0 opacity-0"
                  )} />
                  <Icon size={15} className={cn("shrink-0 transition-colors", isActive ? "text-primary" : "text-text-muted group-hover:text-primary/70")} />
                  <span className="truncate">{cat.label}</span>
                </button>
              );
            })}

            <div className="mt-3 pt-3 border-t border-border/60 px-3 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-success/10 border border-success/20 flex items-center justify-center shrink-0">
                <Sparkles size={14} className="text-success" />
              </div>
              <div className="min-w-0">
                <p className="text-[11px] font-semibold text-text-primary leading-tight">Enterprise Control Center</p>
                <p className={cn("text-[10px] leading-tight", protectionActive ? "text-success" : "text-warning")}>
                  {protectionActive ? 'All protection systems live' : 'Protection paused'}
                </p>
              </div>
            </div>
          </nav>
        </aside>

        {/* Workspace */}
        <section className="min-w-0 h-[calc(100dvh_-_240px)] min-h-[30rem] lg:h-[calc(100dvh_-_190px)] lg:min-h-[32rem]">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeCategory}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.18, ease: 'easeOut' }}
              className="h-full"
            >
              {renderPanel()}
            </motion.div>
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <MessageAgentProvider>
      <SettingsControlCenter />
    </MessageAgentProvider>
  );
}
