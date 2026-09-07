import React from 'react';
import { cn } from './cn';

import openai from '../../assets/logos/openai.svg';
import anthropic from '../../assets/logos/anthropic.svg';
import gemini from '../../assets/logos/gemini.svg';
import groq from '../../assets/logos/groq.svg';
import mistral from '../../assets/logos/mistral.svg';
import deepseek from '../../assets/logos/deepseek.svg';
import openrouter from '../../assets/logos/openrouter.svg';
import together from '../../assets/logos/together.svg';
import cohere from '../../assets/logos/cohere.svg';
import perplexity from '../../assets/logos/perplexity.svg';
import xai from '../../assets/logos/xai.svg';
import azure from '../../assets/logos/azure.svg';
import openaiCompatible from '../../assets/logos/openai-compatible.svg';

const LOGOS = {
  openai,
  anthropic,
  gemini,
  groq,
  mistral,
  deepseek,
  openrouter,
  together,
  cohere,
  perplexity,
  xai,
  azure,
  'openai-compatible': openaiCompatible,
};

export const providerColors = {
  openai: '#10a37f',
  anthropic: '#191919',
  gemini: '#4285f4',
  groq: '#f55036',
  mistral: '#ff7000',
  deepseek: '#4d6bfe',
  openrouter: '#464383',
  together: '#4f46e5',
  cohere: '#2fac7c',
  perplexity: '#20808e',
  xai: '#0a0a0a',
  azure: '#0078d4',
  'openai-compatible': '#64748b',
};

export const ProviderLogo = React.memo(({ provider, size = 36, mark, className }) => {
  const src = LOGOS[provider] || LOGOS['openai-compatible'];
  return (
    <span
      className={cn(
        'inline-flex items-center justify-center rounded-xl bg-white ring-1 ring-black/5 shadow-sm shadow-black/5 shrink-0 select-none',
        className
      )}
      style={{ width: size, height: size }}
    >
      <img
        src={src}
        alt=""
        aria-hidden="true"
        style={{ width: mark || Math.round(size * 0.56), height: mark || Math.round(size * 0.56) }}
        className="object-contain"
        draggable={false}
      />
    </span>
  );
});
ProviderLogo.displayName = 'ProviderLogo';

export { LOGOS as providerLogos };