import React from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Shield, Bot } from 'lucide-react';
import { cn } from './cn';
import { SHIELD_HOME, AGENT_HOME, SHIELD_PATHS, AGENT_PATHS } from '../../utils/paths';

// Active state is derived strictly from the current route — there is NO
// default product and nothing is highlighted on unrelated pages (Dashboard,
// Settings, Profile, landing, etc.).
const activeProduct = (path) => (SHIELD_PATHS.includes(path)
    ? 'shield'
    : AGENT_PATHS.includes(path)
      ? 'agent'
      : null);

const inactiveClasses =
  "text-text-secondary hover:text-text-primary transition-colors duration-200 cursor-pointer";

export const ProductSwitcher = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const path = location.pathname;

  const product = activeProduct(path);
  const isShield = product === 'shield';
  const isAgent = product === 'agent';

  const switchTo = (next) => {
    if (next === 'shield') navigate(SHIELD_HOME);
    else navigate(AGENT_HOME);
  };

  return (
    <div className="relative flex items-center bg-surface/60 border border-border/70 rounded-lg p-0.5 shadow-sm">
      {(isShield || isAgent) && (
        <div
          className={cn(
            "absolute top-0.5 bottom-0.5 w-[82px] sm:w-[90px] rounded-md transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] z-0",
            isShield
              ? "left-0.5 bg-primary/10 border border-primary/20"
              : "left-[calc(50%+0.5px)] bg-[#25D366]/10 border border-[#25D366]/20"
          )}
        />
      )}
      <button
        onClick={() => switchTo('shield')}
        aria-pressed={isShield}
        aria-current={isShield ? 'page' : undefined}
        className={cn(
          "relative z-10 flex items-center justify-center gap-1.5 w-[82px] sm:w-[90px] py-1.5 rounded-md text-[11px] sm:text-xs font-semibold",
          isShield ? "text-primary cursor-default" : inactiveClasses
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
          "relative z-10 flex items-center justify-center gap-1.5 w-[82px] sm:w-[90px] py-1.5 rounded-md text-[11px] sm:text-xs font-semibold",
          isAgent ? "text-[#25D366] cursor-default" : inactiveClasses
        )}
      >
        <Bot size={13} className={cn(isAgent && "text-[#25D366]")} />
        <span>Agent</span>
      </button>
    </div>
  );
};