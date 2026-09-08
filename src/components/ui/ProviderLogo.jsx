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
import qwen from '../../assets/logos/qwen.svg';
import moonshot from '../../assets/logos/moonshot.svg';
import zai from '../../assets/logos/zai.svg';
import minimax from '../../assets/logos/minimax.svg';
import cerebras from '../../assets/logos/cerebras.svg';
import sambanova from '../../assets/logos/sambanova.svg';
import fireworks from '../../assets/logos/fireworks.svg';
import novita from '../../assets/logos/novita.svg';
import huggingface from '../../assets/logos/huggingface.svg';
import nvidia from '../../assets/logos/nvidia.svg';
import siliconflow from '../../assets/logos/siliconflow.svg';
import modelscope from '../../assets/logos/modelscope.svg';
import yi from '../../assets/logos/yi.svg';
import internlm from '../../assets/logos/internlm.svg';
import baichuan from '../../assets/logos/baichuan.svg';
import stepfun from '../../assets/logos/stepfun.svg';
import sensnova from '../../assets/logos/sensnova.svg';
import xverse from '../../assets/logos/xverse.svg';
import amazon from '../../assets/logos/amazon.svg';
import microsoft from '../../assets/logos/microsoft.svg';
import ai21 from '../../assets/logos/ai21.svg';
import writer from '../../assets/logos/writer.svg';
import replicate from '../../assets/logos/replicate.svg';
import longcat from '../../assets/logos/longcat.svg';

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
  qwen,
  moonshot,
  zai,
  minimax,
  cerebras,
  sambanova,
  fireworks,
  novita,
  huggingface,
  nvidia,
  siliconflow,
  modelscope,
  yi,
  internlm,
  baichuan,
  stepfun,
  sensnova,
  xverse,
  amazon,
  microsoft,
  ai21,
  writer,
  replicate,
  longcat,
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
  qwen: '#615ced',
  moonshot: '#1a1a2e',
  zai: '#3859ff',
  minimax: '#26329a',
  cerebras: '#08c19c',
  sambanova: '#4c1d95',
  fireworks: '#fb7825',
  novita: '#22c1c3',
  huggingface: '#ffd21e',
  nvidia: '#76b900',
  siliconflow: '#4f46e5',
  modelscope: '#ff6b35',
  yi: '#000000',
  internlm: '#0ea5e9',
  baichuan: '#1e40af',
  stepfun: '#6366f1',
  sensnova: '#00a651',
  xverse: '#dc2626',
  amazon: '#ff9900',
  microsoft: '#00a4ef',
  ai21: '#0d9488',
  writer: '#000000',
  replicate: '#18181b',
  longcat: '#ff6b00',
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
