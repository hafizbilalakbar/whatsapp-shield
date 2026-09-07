import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../../components/ui/cn';

/**
 * Shared dialog/embed wrapper for Meta panels.
 * Mirrors the `{ isOpen, onClose, embedded }` pattern used by every settings
 * panel in the Message Agent, including the global close-all-modals event.
 */
const MetaPanel = ({ isOpen, onClose, embedded = false, title, subtitle, icon, children, widthClass = 'max-w-4xl' }) => {
  const open = embedded || isOpen;

  useEffect(() => {
    if (!open || embedded) return;
    const handler = () => onClose();
    window.addEventListener('close-all-modals', handler);
    return () => window.removeEventListener('close-all-modals', handler);
  }, [open, embedded, onClose]);

  if (!open) return null;

  return (
    <div className={embedded ? 'h-full' : 'fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm p-2'}>
      <div className={cn(
        'bg-surface border border-border rounded-2xl overflow-hidden flex flex-col shadow-2xl',
        embedded ? 'w-full h-full' : `w-full ${widthClass} max-h-[92vh]`,
      )}>
        <div className="p-3 border-b border-border bg-surface/80 backdrop-blur-md shrink-0">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              {icon}
              <div className="min-w-0">
                <div className="text-sm font-semibold text-text-primary">{title}</div>
                {subtitle ? <div className="text-[11px] text-text-muted truncate">{subtitle}</div> : null}
              </div>
            </div>
            {!embedded && (
              <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors shrink-0">
                <X size={16} className="text-text-muted" />
              </button>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto min-h-0">{children}</div>
      </div>
    </div>
  );
};

export default MetaPanel;