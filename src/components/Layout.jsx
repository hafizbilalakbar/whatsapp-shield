import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X, Shield, LogOut, BookOpen, Info, Hash, History, WifiOff, ArrowUp, Github, Twitter, Linkedin, Send, MessageCircle, MessageSquare, ChevronRight, Zap, Sparkles, Settings } from 'lucide-react';
import { useTheme } from '../context/ThemeProvider';
import { useWebSocket } from '../context/WebSocketProvider';
import { useUserAvatar } from '../hooks/useUserAvatar';
import WhatsAppShieldLogo from './ui/WhatsAppShieldLogo';
import { ProductSwitcher } from './ui/ProductSwitcher';
import { ProfileDropdown } from './ui/ProfileDropdown';
import { Spinner } from './ui/Spinner';
import { ToastContainer } from './ui/ToastNotification';
import { cn } from './ui/cn';
import { SHIELD_HOME, AGENT_HOME } from '../utils/paths';

const appNavItems = [
  { to: SHIELD_HOME, label: 'Shield', icon: Shield },
  { to: '/number-formats', label: 'Numbers', icon: Hash },
  { to: '/history', label: 'History', icon: History },
];

const publicPages = [
  { to: '/', label: 'Home' },
  { to: '/number-formats', label: 'Numbers' },
  { to: '/user-guide', label: 'Guide' },
  { to: '/faq', label: 'FAQ' },
  { to: '/about', label: 'About' },
];

const quickLinks = [
  { to: '/user-guide', label: 'Guide', icon: BookOpen },
  { to: '/about', label: 'About', icon: Info },
];

const MobileNavItem = ({ to, label, icon: Icon, path, onClose, variant }) => {
  const isActive = Array.isArray(to) ? to.some(t => path === t) : path === to;
  const linkTo = Array.isArray(to) ? to[0] : to;

  return (
    <Link
      to={linkTo}
      onClick={onClose}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        "mobile-nav-item group flex items-center gap-3 text-sm font-medium py-2.5 pl-3 pr-4 rounded-xl transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        isActive
          ? variant === 'agent' ? 'active text-[#25D366]' : 'active text-primary'
          : 'text-text-primary hover:bg-surface/80 hover:text-text-primary'
      )}
    >
      {Icon && (
        <span
          className={cn(
            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-all duration-200",
            isActive
              ? variant === 'agent'
                ? 'bg-[#25D366]/10 text-[#25D366] shadow-[0_0_12px_rgba(37,211,102,0.25)]'
                : 'bg-primary/10 text-primary shadow-[0_0_12px_rgba(0,184,110,0.2)]'
              : 'bg-background/60 text-text-secondary group-hover:bg-surface group-hover:text-primary'
          )}
        >
          <Icon size={15} />
        </span>
      )}
      <span className="truncate">{label}</span>
      <ChevronRight
        size={13}
        className={cn(
          "ml-auto shrink-0 transition-all duration-200",
          isActive ? "text-primary opacity-100 translate-x-0" : "text-text-muted opacity-40 -translate-x-1 group-hover:translate-x-0 group-hover:opacity-100"
        )}
      />
    </Link>
  );
};

const MobileDrawerAvatar = ({ sessionUser }) => {
  const { src, showImage, imgState, onLoad, onError } = useUserAvatar(sessionUser);
  const initials = sessionUser?.name ? sessionUser.name.split(' ').filter(Boolean).map(p => p[0]).join('').slice(0, 2).toUpperCase() : '?';

  return (
    <div className="relative w-8 h-8 rounded-full overflow-hidden border border-primary/20 bg-primary/15 flex items-center justify-center shrink-0">
      {showImage ? (
        <>
          {imgState !== 'ok' && (
            <span className="absolute inset-0 flex items-center justify-center text-primary font-bold text-xs">{initials}</span>
          )}
          <img
            src={src}
            alt="Avatar"
            loading="lazy"
            decoding="async"
            onLoad={onLoad}
            onError={onError}
            className={cn(
              "w-full h-full object-cover transition-opacity duration-200",
              imgState === 'ok' ? "opacity-100" : "opacity-0"
            )}
          />
        </>
      ) : (
        <span className="text-primary font-bold text-xs">{initials}</span>
      )}
    </div>
  );
};

const Layout = ({ children }) => {
  const { resolvedTheme } = useTheme();
  const { isConnected, isAuthenticated, sessionUser, isChecking, isOffline, dotState, logout, isLoggingOut } = useWebSocket();
  const [isScrolled, setIsScrolled] = useState(false);
  const [showScrollTop, setShowScrollTop] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [mobileLeaving, setMobileLeaving] = useState(false);
  const location = useLocation();
  const path = location.pathname;
  const menuRef = useRef(null);
  const closeTimerRef = useRef(null);
  const prevAuthRef = useRef(isAuthenticated);

  // Track auth transitions for logging
  useEffect(() => {
    if (isAuthenticated !== prevAuthRef.current) {
      prevAuthRef.current = isAuthenticated;
    }
  }, [isAuthenticated]);

  // Close the drawer immediately on route change (no exit animation needed —
  // the new page transition already handles the visual handoff).
  useEffect(() => {
    if (mobileOpen) {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
      setMobileOpen(false);
      setMobileLeaving(false);
    }
  }, [path]);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 20);
      setShowScrollTop(window.scrollY > 300);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileOpen || mobileLeaving) return;
    const handler = (e) => {
      if (e.key === 'Escape') closeMobile();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [mobileOpen, mobileLeaving]);

  // Lock body scroll while the drawer is open so background content never
  // scrolls behind it.
  useEffect(() => {
    if (!mobileOpen) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prevOverflow;
    };
  }, [mobileOpen]);

  const closeMobile = useCallback(() => {
    if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    setMobileLeaving(true);
    closeTimerRef.current = setTimeout(() => {
      setMobileOpen(false);
      setMobileLeaving(false);
      closeTimerRef.current = null;
    }, 200);
  }, []);

  // Clear any pending close timer on unmount to avoid state updates on a
  // detached component.
  useEffect(() => {
    return () => {
      if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
    };
  }, []);

  const toggleMobile = useCallback(() => {
    if (mobileOpen) closeMobile();
    else setMobileOpen(true);
  }, [mobileOpen, closeMobile]);

  const isMessageAgent = path === AGENT_HOME;

  const renderMobileItems = (items, startDelay = 0) => (
    <div className="flex flex-col gap-0.5">
      {items.map((item, i) => (
        <div
          key={item.to || item.label}
          className="mobile-item-enter"
          style={{ animationDelay: `${startDelay + i * 30}ms` }}
        >
          <MobileNavItem {...item} path={path} onClose={closeMobile} />
        </div>
      ))}
    </div>
  );

  // Auth state is the single source of truth for header rendering.
  // Layout re-renders instantly when context value changes.

  return (
    <div className={cn("flex flex-col relative", isMessageAgent ? "message-agent-viewport overflow-hidden" : "min-h-screen")}>
      <ToastContainer isAuthenticated={isAuthenticated} />

      {isOffline && (
        <div className="fixed top-0 left-0 right-0 z-[100] bg-warning/90 text-white text-sm py-2 px-4 flex items-center justify-center gap-2 shadow-lg" role="alert">
          <WifiOff size={14} aria-hidden="true" />
          <span>Connection lost — your session is paused.</span>
        </div>
      )}

      {showScrollTop && !isMessageAgent && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          className="fixed bottom-6 right-6 z-[70] w-10 h-10 sm:w-12 sm:h-12 rounded-full bg-primary text-white shadow-lg flex items-center justify-center hover:scale-110 hover:bg-primary/90 transition-all duration-300"
          aria-label="Scroll to top"
        >
          <ArrowUp size={18} className="sm:size-[20]" />
        </button>
      )}

      <header
        className={cn(
          "fixed top-0 left-0 right-0 z-50 transition-all duration-500 ease-out",
          isMessageAgent && "h-11 !py-0 !border-b !border-border/50 bg-surface/60 backdrop-blur-xl shadow-sm shadow-black/5",
          isScrolled
            ? "bg-surface/60 backdrop-blur-xl border-b border-border/50 shadow-lg shadow-black/5 dark:shadow-black/20 py-2"
            : "bg-transparent border-transparent py-3",
          isOffline ? "mt-10" : ""
        )}
        role="banner"
      >
        <div className={cn(
          "flex items-center justify-between gap-2",
          isMessageAgent ? "max-w-full h-full px-3 sm:px-4 lg:px-5" : "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8"
        )}>

          {/* --- Left: Logo + Brand + Product Switcher --- */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              to={isAuthenticated ? (isMessageAgent ? AGENT_HOME : SHIELD_HOME) : '/'}
              className="flex items-center gap-2 group shrink-0"
              aria-label={isMessageAgent ? 'Message Agent home' : 'WhatsApp Shield home'}
            >
              {isMessageAgent ? (
                <MessageSquare size={20} className="text-[#25D366] group-hover:scale-105 transition-transform duration-300 sm:size-[22]" />
              ) : (
                <WhatsAppShieldLogo size={20} className="text-primary group-hover:scale-105 transition-transform duration-300 sm:size-[22]" />
              )}
              <span className={cn(
                "hidden sm:inline font-display font-bold text-sm tracking-tight",
                isMessageAgent ? "text-[#25D366]" : "text-text-primary"
              )}>
                {isMessageAgent ? 'Message Agent' : 'WhatsApp Shield'}
              </span>
            </Link>

            {isAuthenticated && (
              <>
                <div className="w-px h-5 bg-border/40 mx-0.5 sm:mx-1" aria-hidden="true" />
                <ProductSwitcher />
              </>
            )}
          </div>

          {/* --- Center: Desktop Nav --- */}
          <nav className="hidden lg:flex items-center gap-1 relative" role="navigation" aria-label="Main navigation">
            {isAuthenticated ? (
              /* Authenticated nav — only app items, no public pages mixed in */
              <div className="flex items-center gap-1 animate-in fade-in duration-200">
                {appNavItems.map(item => (
                  <Link
                    key={item.to}
                    to={item.to}
                    className={cn(
                      "nav-link text-sm font-medium transition-colors duration-200 px-3 py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      path === item.to
                        ? "text-primary active bg-primary/[0.04]"
                        : "text-text-secondary hover:text-primary hover:bg-surface/40"
                    )}
                    aria-current={path === item.to ? 'page' : undefined}
                  >
                    {item.label}
                  </Link>
                ))}
              </div>
            ) : (
              /* Public nav — only visible when not authenticated */
              <div className="flex items-center gap-1 animate-in fade-in duration-200">
                {publicPages.map(p => (
                  <Link
                    key={p.to}
                    to={p.to}
                    className={cn(
                      "nav-link text-sm font-medium transition-colors duration-200 px-3 py-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                      path === p.to
                        ? "text-primary active bg-primary/[0.04]"
                        : "text-text-secondary hover:text-primary hover:bg-surface/40"
                    )}
                    aria-current={path === p.to ? 'page' : undefined}
                  >
                    {p.label}
                  </Link>
                ))}
              </div>
            )}
          </nav>

          {/* --- Right: Actions --- */}
          <div className="flex items-center gap-1 sm:gap-1.5">
            {isAuthenticated && (
              /* Authenticated actions — instant render with context sync */
              <div className="flex items-center gap-1 sm:gap-1.5 animate-in fade-in duration-200">
                <div className="hidden lg:flex items-center gap-0.5 mr-0.5">
                  {quickLinks.map(link => (
                    <Link
                      key={link.to}
                      to={link.to}
                      className={cn(
                        "p-2 rounded-lg transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                        path === link.to
                          ? "text-primary bg-primary/[0.06]"
                          : "text-text-secondary hover:text-primary hover:bg-surface/50"
                      )}
                      aria-label={link.label}
                    >
                      <link.icon size={15} />
                    </Link>
                  ))}
                  <div className="w-px h-4 bg-border/30 mx-1" aria-hidden="true" />
                </div>

                <div
                  className="hidden md:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-surface/50 border border-border/50 text-[10px] font-medium shadow-sm"
                  aria-label={`Connection status: ${isChecking ? 'scanning' : isConnected ? 'connected' : 'offline'}`}
                >
                  {isChecking ? (
                    <span className="flex items-center gap-1.5 text-success">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75" />
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
                      </span>
                      Scanning
                    </span>
                  ) : isConnected ? (
                    <span className="flex items-center gap-1.5 text-text-secondary">
                      <span className="inline-flex rounded-full h-2 w-2 bg-success" />
                      Connected
                    </span>
                  ) : (
                    <span className="flex items-center gap-1.5 text-error">
                      <span className="inline-flex rounded-full h-2 w-2 bg-error animate-pulse" />
                      Offline
                    </span>
                  )}
                </div>

                <ProfileDropdown sessionUser={sessionUser} dotState={dotState} logout={logout} isLoggingOut={isLoggingOut} />
              </div>
            )}

            {/* Mobile/tablet menu button — lives inside the header flow so it
                can never overlap the profile avatar */}
            <button
              className="lg:hidden flex items-center justify-center p-2 rounded-lg text-text-primary hover:text-primary hover:bg-surface/60 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onClick={toggleMobile}
              aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
              aria-expanded={mobileOpen}
              aria-controls="mobile-nav-menu"
            >
              {mobileOpen ? <X size={18} className="sm:size-[20]" /> : <Menu size={18} className="sm:size-[20]" />}
            </button>

          </div>
        </div>
      </header>

      {/* --- Mobile Menu (premium glass drawer) --- */}
      {(mobileOpen || mobileLeaving) && (
        <div
          id="mobile-nav-menu"
          className="fixed inset-0 z-[55] lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          {/* Backdrop */}
          <div
            className={cn(
              "absolute inset-0 bg-background/70 backdrop-blur-md",
              mobileLeaving ? "mobile-overlay-exit" : "mobile-overlay-enter"
            )}
            onClick={closeMobile}
          />

          {/* Panel */}
          <div
            ref={menuRef}
            className={cn(
              "mobile-panel-shell absolute right-0 top-0 bottom-0 w-[min(100%,20.5rem)] sm:w-80 flex flex-col overflow-hidden border-l border-border/70 shadow-2xl",
              mobileLeaving ? "mobile-menu-exit" : "mobile-menu-enter"
            )}
          >
            {/* Emerald top accent */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#25D366] via-[#34D399] to-secondary z-10" aria-hidden="true" />

            {/* Drawer header: brand + close */}
            <div className="shrink-0 relative px-4 pt-6 pb-4 border-b border-border/50 bg-background/40">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2.5 min-w-0">
                  <WhatsAppShieldLogo size={22} className="text-primary shrink-0" />
                  <div className="min-w-0">
                    <p className="text-sm font-display font-bold text-text-primary leading-tight truncate">WhatsApp Shield</p>
                    <p className="text-[10px] text-text-muted font-medium truncate">Enterprise Communication Suite</p>
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={closeMobile}
                    className="p-2 rounded-lg text-text-secondary hover:text-text-primary hover:bg-surface/70 transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    aria-label="Close menu"
                  >
                    <X size={18} />
                  </button>
                </div>
              </div>

              {isAuthenticated && sessionUser && (
                <div className="mt-4 flex items-center gap-2.5 rounded-xl bg-surface/60 border border-border/50 px-3 py-2">
                  <MobileDrawerAvatar sessionUser={sessionUser} />
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-text-primary truncate">{sessionUser.name || 'WhatsApp Session'}</p>
                    <p className="text-[10px] text-text-muted font-mono truncate">{sessionUser.number}</p>
                  </div>
                  <span className="ml-auto flex items-center gap-1 text-[10px] font-medium text-success shrink-0">
                    <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Active
                  </span>
                </div>
              )}
            </div>

            {/* Drawer body — scrollable so every link stays reachable */}
            <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-3 py-4 custom-scrollbar">
              <nav className="flex flex-col gap-0.5" role="navigation" aria-label={isAuthenticated ? 'Application menu' : 'Main menu'}>
                <div className="text-[10px] text-text-muted uppercase tracking-widest px-3 pb-2 font-semibold flex items-center gap-1.5">
                  <Zap size={10} className="text-primary" /> {isAuthenticated ? 'Products' : 'Pages'}
                </div>

                {isAuthenticated && (
                  <div className="flex flex-col gap-0.5">
                    {renderMobileItems([
                      { to: [SHIELD_HOME, '/number-formats', '/history'], label: 'WhatsApp Shield', icon: Shield },
                      { to: '/message-agent', label: 'Message Agent', icon: MessageCircle, variant: 'agent' },
                    ], 30)}
                  </div>
                )}
                {!isAuthenticated && (
                  <div className="flex flex-col gap-0.5">
                    {renderMobileItems(publicPages, 50)}
                  </div>
                )}

                <div className="relative my-4" aria-hidden="true">
                  <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border/50" /></div>
                  <div className="relative flex justify-center">
                    <span className="bg-surface px-3 text-[9px] text-text-muted uppercase tracking-wider font-semibold flex items-center gap-1">
                      <Sparkles size={9} className="text-primary" /> {isAuthenticated ? 'Platform & Resources' : 'Legal'}
                    </span>
                  </div>
                </div>

                {isAuthenticated ? (
                  <>
                    {renderMobileItems(appNavItems, 90)}
                    {renderMobileItems([
                      { to: '/settings', label: 'Settings', icon: Settings },
                      { to: '/user-guide', label: 'User Guide', icon: BookOpen },
                      { to: '/about', label: 'About', icon: Info },
                      { to: '/faq', label: 'FAQ', icon: Info },
                      { to: '/privacy-policy', label: 'Privacy Policy' },
                      { to: '/terms', label: 'Terms of Service' },
                    ], 150)}
                  </>
                ) : (
                  <>
                    {renderMobileItems([
                      { to: '/privacy-policy', label: 'Privacy Policy' },
                      { to: '/terms', label: 'Terms of Service' },
                      { to: '/contact', label: 'Contact' },
                    ], 120)}
                  </>
                )}
              </nav>
            </div>

            {/* Drawer footer — disconnect / quick status */}
            <div className="shrink-0 px-4 py-4 border-t border-border/50 bg-background/40">
              {isAuthenticated ? (
                <div className="mobile-item-enter" style={{ animationDelay: '220ms' }}>
                  <button
                    onClick={() => { if (!isLoggingOut) { logout(); closeMobile(); } }}
                    disabled={isLoggingOut}
                    className="flex items-center justify-center gap-2 w-full px-4 py-2.5 bg-surface/70 border border-error/25 text-error text-sm font-medium rounded-xl hover:bg-error/10 hover:border-error/40 transition-all duration-200 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-error"
                  >
                    {isLoggingOut ? <Spinner size={14} /> : <LogOut size={14} />}
                    {isLoggingOut ? 'Disconnecting...' : 'Disconnect Session'}
                  </button>
                </div>
              ) : (
                <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted">
                  <span className="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                  <span>Secure &amp; local-first</span>
                  <span className="text-border">•</span>
                  <span>v1.5.0</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* --- Main Content --- */}
      <main className={cn(
        "flex-grow flex flex-col z-10 relative",
        isMessageAgent ? "h-full min-h-0 pt-11 overflow-hidden" : "pt-14 pb-6 sm:pb-8",
        isOffline ? "mt-10" : ""
      )} role="main">
        {isOffline && (
          <div className="fixed inset-0 z-30 pointer-events-none" aria-hidden="true">
            <div className="absolute inset-0 bg-background/60 backdrop-blur-[1px]" />
            <div className="absolute inset-0 overflow-hidden">
              <div className="shimmer-overlay w-full h-full" />
            </div>
          </div>
        )}
        <div className={cn(
          "relative z-10 flex-grow flex flex-col transition-opacity duration-300",
          isMessageAgent ? "min-h-0 overflow-hidden" : "",
          isOffline ? "opacity-60" : "opacity-100"
        )}>
          {children}
        </div>
      </main>

      {/* --- Footer (hidden on Message Agent for max vertical space) --- */}
      <footer className={cn("footer-whatsapp pt-5 pb-4 md:pt-10 md:pb-6 z-10 relative overflow-hidden", resolvedTheme === 'light' && 'light', isMessageAgent && "hidden")}>
        <div className="absolute inset-0">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent" />
          {resolvedTheme === 'dark' ? (
            <div className="absolute inset-0 mesh-gradient-dark opacity-50" />
          ) : (
            <div className="absolute inset-0 mesh-gradient-light opacity-40" />
          )}
          <div className="absolute inset-0 bg-grid-pattern opacity-[0.02]" />
        </div>
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-[#25D366] via-[#34D399] to-[#00B86E]" />
        <div className="max-w-7xl mx-auto px-4 md:px-6 lg:px-8 xl:px-8 relative z-10">

          {/* Main grid: Brand Block + 4 Nav Columns — 1-col → 2-col → 3-col → 12-col */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-12 gap-4 md:gap-8 lg:gap-6 mb-6 md:mb-10">

            {/* Brand Block — logo, description, social icons stacked at top-left */}
            <div className="sm:col-span-2 md:col-span-3 lg:col-span-4 flex flex-col gap-3 md:gap-5">
              <Link to="/" className="flex items-center gap-2 sm:gap-3 group">
                <WhatsAppShieldLogo size={20} className="text-[#25D366] group-hover:scale-105 transition-all sm:size-[24] md:size-[28]" />
                <span className="font-display font-bold text-sm sm:text-base md:text-lg tracking-tight text-text-primary group-hover:text-[#25D366] transition-colors whitespace-nowrap">WhatsApp Shield</span>
              </Link>
              <p className="text-xs sm:text-sm text-text-secondary leading-relaxed max-w-full sm:max-w-[260px]">
                Enterprise-grade WhatsApp number verification and audience management platform. Keep your communications safe and effective.
              </p>
              <div className="flex items-center gap-2 md:gap-3">
                {[Github, Twitter, Linkedin, Send].map((Icon, i) => (
                  <a key={i} href="#" className="footer-social-btn-hover w-7 h-7 md:w-9 md:h-9 flex items-center justify-center rounded-lg" aria-label="Social">
                    <Icon size={12} className="text-text-secondary md:size-[16]" />
                  </a>
                ))}
              </div>
            </div>

            {/* Platform */}
            <div className="lg:col-span-2">
              <h4 className="font-display font-semibold text-text-primary text-xs mb-2 md:mb-3 uppercase tracking-wider">Platform</h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                <li><Link to={SHIELD_HOME} className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Shield</Link></li>
                <li><Link to="/number-formats" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Numbers</Link></li>
                <li><Link to="/history" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">History</Link></li>
                <li><Link to="/user-guide" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Guide</Link></li>
                <li><Link to="/changelog" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Changelog</Link></li>
              </ul>
            </div>

            {/* Resources */}
            <div className="lg:col-span-2">
              <h4 className="font-display font-semibold text-text-primary text-xs mb-2 md:mb-3 uppercase tracking-wider">Resources</h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                <li><Link to={SHIELD_HOME} className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">WhatsApp Shield</Link></li>
                <li><Link to="/message-agent" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Message Agent</Link></li>
                <li><Link to="/faq" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">FAQ</Link></li>
                <li><Link to="/about" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">About Us</Link></li>
              </ul>
            </div>

            {/* Company */}
            <div className="lg:col-span-2">
              <h4 className="font-display font-semibold text-text-primary text-xs mb-2 md:mb-3 uppercase tracking-wider">Company</h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                <li><Link to="/about" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">About</Link></li>
                <li><Link to="/contact" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Contact</Link></li>
                <li><Link to="/changelog" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Updates</Link></li>
              </ul>
            </div>

            {/* Legal */}
            <div className="lg:col-span-2 md:col-span-3">
              <h4 className="font-display font-semibold text-text-primary text-xs mb-2 md:mb-3 uppercase tracking-wider">Legal</h4>
              <ul className="flex flex-col gap-2 md:gap-3">
                <li><Link to="/privacy-policy" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Privacy</Link></li>
                <li><Link to="/terms" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Terms</Link></li>
                <li><Link to="/data-processing" className="text-xs md:text-sm font-medium text-text-secondary hover:text-primary transition-colors">Data Processing</Link></li>
              </ul>
            </div>

          </div>

          {/* Bottom section: divider + two-column status/version | copyright */}
          <div className="pt-4 md:pt-6 border-t border-border/50">
            <div className="flex flex-col sm:flex-row justify-between items-center gap-2 md:gap-4">
              <div className="flex items-center gap-2 md:gap-4">
                <div className="flex items-center gap-1.5 md:gap-2">
                  <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-[#25D366] animate-pulse" />
                  <span className="text-xs text-text-muted font-medium">All systems operational</span>
                </div>
                <div className="flex items-center gap-1.5 px-2 md:px-3 py-0.5 md:py-1 rounded-full bg-surface border border-[#25D366]/20 text-xs font-medium">
                  <Shield size={8} className="text-[#25D366] md:size-[10]" />
                  <span>v1.5.0</span>
                </div>
              </div>
              <p className="text-xs text-text-muted font-medium">&copy; {new Date().getFullYear()} WhatsApp Shield. All rights reserved.</p>
            </div>
          </div>

        </div>
      </footer>
    </div>
  );
};

export default Layout;
