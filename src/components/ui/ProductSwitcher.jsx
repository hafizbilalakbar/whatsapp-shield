import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Bot } from 'lucide-react';
import { cn } from './cn';

// Dashboard is the shared home/control center for both tools — the switcher
// highlights neither product there.
const SHIELD_ROUTES = ['/history', '/number-formats', '/settings', '/profile'];
const AGENT_ROUTES = ['/message-agent'];

export const ProductSwitcher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  // Strict route-derived active state with NO default — pages not related to
  // either tool leave Shield AND Agent inactive.
  const activeProduct = SHIELD_ROUTES.includes(path)
    ? 'shield'
    : AGENT_ROUTES.includes(path)
      ? 'agent'
      : null;
  const isShield = activeProduct === 'shield';
  const isAgent = activeProduct === 'agent';

  const switchTo = (product) => {
    if (product === 'shield') navigate('/dashboard');
    else navigate('/message-agent');
  };

  return (
    <div className="relative flex items-center bg-surface/60 border border-border/70 rounded-lg p-0.5 shadow-sm">
      <div
        className={cn(
          "absolute top-0.5 bottom-0.5 w-[82px] sm:w-[90px] rounded-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0",
          isShield
            ? "left-0.5 bg-primary/10 border border-primary/20"
            : isAgent
            ? "left-[calc(50%+0.5px)] bg-[#25D366]/10 border border-[#25D366]/20"
            : "translate-x-0 border-transparent bg-transparent"
        )}
      />
      <button
        onClick={() => switchTo('shield')}
        aria-pressed={isShield}
        aria-current={isShield ? 'page' : undefined}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 w-[82px] sm:w-[90px] py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all duration-200",
          isShield
            ? "text-primary cursor-default"
            : isAgent
            ? "text-text-muted hover:text-text-secondary cursor-pointer"
            : "text-text-secondary hover:bg-surface hover:text-text-secondary cursor-pointer"
        )}
      >
        <Shield size={13} className={cn(isShield && "text-primary")} />
        <span>Shield</span>
      </button>
      <button
        onClick={() => switchTo('agent')}
        aria-pressed={isAgent}
        aria-current={isAgent ? 'page' : undefined}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 w-[82px] sm:w-[90px] py-1.5 rounded-md text-[11px] sm:text-xs font-semibold transition-all duration-200",
          isAgent
            ? "text-[#25D366] cursor-default"
            : isShield
            ? "text-text-muted hover:text-text-secondary cursor-pointer"
            : "text-text-secondary hover:bg-surface hover:text-text-secondary cursor-pointer"
        )}
      >
        <Bot size={13} className={cn(isAgent && "text-[#25D366]")} />
        <span>Agent</span>
      </button>
    </div>
  );
};