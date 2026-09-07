import React, { useMemo, useState } from 'react';
import { cn } from '../../../components/ui/cn';
import { templateToComponents } from './MetaConstants';

const applyPreviewValues = (text, values) => {
  if (!text) return '';
  return String(text).replace(/\{\{(\d+)\}\}/g, (m, n) => {
    const vl = values && values[n] && String(values[n]).trim();
    return vl ? vl : m;
  });
};

// Cap every preview line so long values clamp like a real WhatsApp bubble.
const clamp = (s, maxLines = 6) => {
  const parts = String(s).split('\n');
  const out = parts.slice(0, maxLines);
  if (parts.length > maxLines) out[out.length - 1] = `${out[out.length - 1]}…`;
  return out.join('\n');
};

/**
 * Renders an approved-template-style preview inside a WhatsApp phone frame.
 * Every component (header media/text, body, footer, quick replies) is shown
 * exactly like a customer would see it, including variable preview values.
 */
const WhatsAppTemplatePreview = ({ template, values, className }) => {
  const components = templateToComponents(template);
  const header = components.find(c => c.type === 'HEADER');
  const body = components.find(c => c.type === 'BODY')?.text || '';
  const footer = components.find(c => c.type === 'FOOTER')?.text;
  const buttons = components.filter(c => c.type === 'BUTTONS')?.flatMap(c => c.buttons || []) || [];

  const headerLabel = useMemo(() => {
    if (!header) return null;
    if (header.format === 'IMAGE') return '🖼 Image';
    if (header.format === 'VIDEO') return '🎬 Video';
    if (header.format === 'DOCUMENT') return '📄 Document';
    if (header.format === 'LOCATION') return '📍 Location';
    if (header.format && header.format !== 'TEXT') return header.format;
    return null;
  }, [header]);

  const bodyPreview = clamp(applyPreviewValues(body, values));

  return (
    <div className={cn('relative mx-auto w-full max-w-[300px] rounded-[38px] border border-[#1F2C33] bg-[#0B141A] p-3 shadow-2xl', className)}>
      {/* Phone notch */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-5 bg-[#0B141A] rounded-b-2xl border border-t-0 border-[#1F2C33]" />
      <div className="mx-auto mt-2 w-fit max-w-full rounded-t-[22px] bg-[#111B21] overflow-hidden">
        {/* Venue bar */}
        <div className="flex items-center justify-between px-3 py-2 bg-[#202C33]">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="flex -space-x-1">
              <div className="w-5 h-5 rounded-full bg-[#3B4A54] border border-[#202C33]" />
              <div className="w-5 h-5 rounded-full bg-[#3B4A54] border border-[#202C33]" />
            </div>
            <div className="min-w-0">
              <div className="text-[10px] text-[#E9EDEF] truncate max-w-[150px]">Business Name</div>
              <div className="text-[8px] text-[#8696A0]">Meta Verified Business</div>
            </div>
          </div>
          <span className="text-[#F7F7F5] px-1.5 py-0.5 rounded-full bg-[#00A884] text-[8px] font-semibold leading-none flex items-center gap-0.5">✓</span>
        </div>
        {/* Chat body */}
        <div className="px-2 py-3">
          <div className={cn(
            'bg-[#005C4B] rounded-lg rounded-tl-none px-2.5 py-2 text-[#E9EDEF] text-[12px] leading-snug whitespace-pre-wrap break-words max-w-[240px] ml-auto shadow',
          )}>
            {headerLabel ? (
              <div className="mb-1.5">
                <div className="rounded-md bg-[#0B141A]/40 border border-[#2A3A44] aspect-[4/3] flex items-center justify-center text-[22px]">
                  {headerLabel}
                </div>
              </div>
            ) : null}
            {header && (header.format === 'TEXT' || !header.format) && !!header.text ? (
              <div className={cn('font-medium', body ? 'mb-1.5' : '')}>{clamp(applyPreviewValues(header.text, values), 2)}</div>
            ) : null}
            {bodyPreview ? <div>{bodyPreview}</div> : null}
            {!headerLabel && !bodyPreview && !header?.text ? (
              <div className="text-[#8696A0] italic">{body || 'Message body'}</div>
            ) : null}
            {footer ? <div className="mt-1.5 pt-1.5 border-t border-[#075E54] text-[10px] text-[#8696A0]">{clamp(footer, 2)}</div> : null}
            {buttons.length > 0 ? (
              <>
                <div className="h-px bg-[#2A3A44] my-1.5" />
                <button className="w-full text-center text-[#53BDEB] text-[12px] py-0.5 font-medium">
                  {buttons.find(b => b.type === 'QUICK_REPLY')?.text || `Reply button`}
                </button>
                {buttons.filter(b => b.type === 'URL' || b.type === 'PHONE_NUMBER').slice(0, 2).map((b, i) => (
                  <div key={i} className="flex flex-col mt-0.5">
                    <div className="h-px bg-[#2A3A44] my-1.5" />
                    <button className="w-full text-center text-[#53BDEB] text-[12px] py-0.5 font-medium">
                      {b.text || (b.type === 'URL' ? 'Visit website' : 'Call business')}
                    </button>
                  </div>
                ))}
              </>
            ) : null}
            <div className="flex items-center justify-end gap-1 mt-1">
              <span className="text-[9px] text-[#8696A0]">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
              <span className="text-[10px] text-[#53BDEB]">✓✓</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WhatsAppTemplatePreview;