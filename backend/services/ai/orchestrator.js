'use strict';

// AI Orchestrator — central decision layer.
//
// Flow:  Understand intent -> Read conversation context -> Select the best
// specialized agent -> Generate/recommend the action (reply + CRM update) ->
// Optionally flag a human handoff with an AI-generated summary.
//
// Every AI call routes through aiManager.complete, so the exact provider/model
// configured in AI Provider Settings is used everywhere automatically.

const fs = require('fs');
const path = require('path');
const manager = require('./manager');

const AGENT_CATALOG = [
  {
    id: 'qualification',
    name: 'Qualification',
    emoji: '🎯',
    role: 'Lead Qualification Specialist',
    focus: 'Ask smart questions to understand needs, budget, timeline and authority; then classify the lead as hot, warm or cold.',
    action: 'lead_qualification',
  },
  {
    id: 'sales',
    name: 'Sales',
    emoji: '💼',
    role: 'Sales Agent',
    focus: 'Pitch the product or service, handle objections honestly and move prospects toward a purchase that fits their needs.',
    action: 'sales_pitch',
  },
  {
    id: 'support',
    name: 'Support',
    emoji: '🛟',
    role: 'Customer Support Agent',
    focus: 'Resolve questions and issues quickly, empathetically and accurately; escalate to a human when uncertain.',
    action: 'support_ticket',
  },
  {
    id: 'booking',
    name: 'Booking',
    emoji: '📅',
    role: 'Booking Agent',
    focus: 'Schedule meetings, demos, viewings or consultations and confirm the time, channel and participants.',
    action: 'book_appointment',
  },
  {
    id: 'follow_up',
    name: 'Follow-up',
    emoji: '🔁',
    role: 'Follow-up Agent',
    focus: 'Re-engage dormant leads with a friendly, value-adding nudge — never spammy or pushy.',
    action: 'schedule_follow_up',
  },
  {
    id: 'closing',
    name: 'Closing',
    emoji: '🤝',
    role: 'Closing Agent',
    focus: 'Move a warm lead to a decision: confirm terms, answer final objections and close without pressure.',
    action: 'move_to_close',
  },
  {
    id: 'knowledge',
    name: 'Knowledge',
    emoji: '📚',
    role: 'Knowledge Agent',
    focus: 'Answer questions about the business, products, pricing and policies using the provided business context only.',
    action: 'answer_query',
  },
  {
    id: 'onboarding',
    name: 'Onboarding',
    emoji: '🚀',
    role: 'Onboarding Agent',
    focus: 'Help new customers get started: explain the first steps, settings, and where to get help.',
    action: 'guide_onboarding',
  },
  {
    id: 'nurture',
    name: 'Nurture',
    emoji: '🌱',
    role: 'Nurture Agent',
    focus: 'Keep a non-urgent relationship warm with useful, periodic value — respect opt-outs and do not spam.',
    action: 'nurture_lead',
  },
];

const AGENT_MAP = Object.fromEntries(AGENT_CATALOG.map(a => [a.id, a]));

const DATA_DIR = path.join(__dirname, '..', '..');
const loadBusinessProfile = () => {
  try {
    const file = path.join(DATA_DIR, 'business_profile.json');
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch (_) {}
  return {};
};

const normalizeHistory = (history = []) => {
  if (!Array.isArray(history)) return [];
  return history
    .slice(-12)
    .map(m => {
      if (!m) return null;
      const text = m.content || m.text || m.message || '';
      if (!text) return null;
      const role = m.role === 'user' || m.incoming === true || m.fromMe === false ? 'customer' : 'assistant';
      return { role, content: String(text).slice(0, 500) };
    })
    .filter(Boolean);
};

const buildContext = ({ message, history, contact }) => {
  const name = (contact && (contact.name || contact.displayName)) || 'Lead';
  const phone = (contact && contact.phone) || '';
  const stage = (contact && contact.journey) || 'new_lead';
  const country = (contact && contact.country) || '';
  const business = loadBusinessProfile();
  return {
    customer: { name, phone, stage, country },
    message: String(message || '').slice(0, 1500),
    transcript: normalizeHistory(history),
    business: {
      name: business.businessName || business.name || '',
      description: business.description || business.businessDescription || '',
      industry: business.industry || '',
      products: business.products || business.services || '',
      location: business.location || '',
    },
  };
};

const classifyIntent = async (ctx, opts) => {
  const prompt = [
    `You are the intent router of a WhatsApp AI Orchestrator. Analyze the contact's latest message and the provided transcript.`,
    ``,
    `Choose exactly ONE agent from this list and answer with valid JSON only.`,
    ...AGENT_CATALOG.map(a => `- "${a.id}": ${a.focus}`),
    ``,
    `Respond with JSON: {"intent":"<short label>","agent":"<agent id>","needsHuman":true|false,"priority":"low|medium|high","confidence":0..1,"reason":"<one-line reason>"}`,
    `Keep the reason under 20 words. If the message is unclear, pick the closest agent and set needsHuman only when there is genuine risk (money, abuse, safety, legal, or an angry customer).`,
  ].join('\n');

  const out = await manager.completeJson({
    messages: [{ role: 'system', content: prompt }, { role: 'user', content: JSON.stringify(ctx) }],
    temperature: 0.2,
    providerId: opts.providerId,
    model: opts.model,
  });

  if (out && out.ok && out.data) {
    const d = out.data;
    const agent = AGENT_MAP[d.agent] ? d.agent : 'knowledge';
    return {
      intent: d.intent || 'general',
      agent,
      needsHuman: d.needsHuman === true,
      priority: ['low', 'medium', 'high'].includes(d.priority) ? d.priority : 'medium',
      confidence: Number.isFinite(d.confidence) ? Math.max(0, Math.min(1, d.confidence)) : 0.5,
      reason: d.reason || '',
    };
  }
  return { intent: 'general', agent: 'knowledge', needsHuman: false, priority: 'medium', confidence: 0.4, reason: '' };
};

const buildAgentSystem = (ctx, dec) => {
  const agent = AGENT_MAP[dec.agent] || AGENT_MAP.knowledge;
  const lines = [
    `You are the ${agent.role} of "${ctx.business.name || 'this business'}" on WhatsApp. You work inside an AI Orchestrator.`,
    ``,
    `Your focus: ${agent.focus}`,
    ``,
    `Customer: ${ctx.customer.name}${ctx.customer.country ? ` (${ctx.customer.country})` : ''} | Pipeline stage: ${ctx.customer.stage}`,
    ctx.business.description ? `Business: ${ctx.business.description}` : null,
    ctx.business.products ? `What we offer: ${ctx.business.products}` : null,
    ctx.business.location ? `Location: ${ctx.business.location}` : null,
    ``,
    `Compliance rules (non-negotiable):`,
    `- Never claim to be Meta, WhatsApp or any official platform. You represent the business only.`,
    `- Never create, quote or "approve" official templates. Only reference templates the business marked approved.`,
    `- Respect privacy and do not ask for sensitive data beyond what is needed to serve the customer.`,
    `- Be honest about capabilities; hand over to a human when you are unsure.`,
    ``,
    `Reply to the customer's latest message naturally, in their language, concise and professional.`,
    `End with a JSON action block:`,
    `{"action":{"reply":"<exact final reply text, customer-facing>","suggestedStage":"<pipeline stage e.g new_lead|qualified|contacted|proposal|negotiation|won|lost|follow_up>","tags":["<optional tag>"],"priority":"low|medium|high","sendFollowUp":true|false,"followUpHint":"<one-sentence next step>","needsHuman":true|false,"humanNote":"<why a human should step in, or empty>"}}`,
    `Return ONLY valid JSON that contains both properties "reply" (string) and "action" (object).`,
  ].filter(Boolean);
  return lines.join('\n');
};

const safelyParse = (jsonStr) => {
  try {
    return typeof jsonStr === 'object' ? jsonStr : JSON.parse(jsonStr);
  } catch (_) {
    const m = String(jsonStr).match(/\{[\s\S]*\}/);
    if (m) {
      try { return JSON.parse(m[0]); } catch (_) {}
    }
    return null;
  }
};

const runOrchestrator = async ({ message, history, contact, providerId, model } = {}) => {
  const ctx = buildContext({ message, history, contact });

  if (!ctx.message.trim()) {
    return { success: true, reply: '', handoff: false, error: 'No message provided' };
  }

  const decision = await classifyIntent(ctx, { providerId, model });

  const agent = AGENT_MAP[decision.agent] || AGENT_MAP.knowledge;

  try {
    const out = await manager.completeJson({
      messages: [
        { role: 'system', content: buildAgentSystem(ctx, decision) },
        ...ctx.transcript,
        { role: 'user', content: ctx.message },
      ],
      temperature: 0.5,
      providerId,
      model,
    });

    if (!out || !out.ok || !out.data) {
      return {
        success: true,
        reply: 'I could not reach my AI brain right now. A teammate will reply as soon as possible.',
        handoff: true,
        agent: decision.agent,
        agentName: agent.name,
        intent: decision.intent,
        priority: decision.priority,
        suggestedStage: 'follow_up',
        fallback: true,
        error: (out && out.error) || 'AI provider error',
      };
    }

    const parsed = safelyParse(out.data);
    const reply = (parsed && parsed.reply) || (typeof parsed === 'string' ? parsed : null) || out.data.reply;
    const action = (parsed && parsed.action) || {};

    return {
      success: true,
      reply: String(reply).trim(),
      handoff: decision.needsHuman === true || action.needsHuman === true,
      agent: decision.agent,
      agentName: agent.name,
      agentEmoji: agent.emoji,
      intent: decision.intent,
      priority: action.priority || decision.priority || 'medium',
      suggestedStage: action.suggestedStage || null,
      tags: Array.isArray(action.tags) ? action.tags.slice(0, 3) : [],
      sendFollowUp: action.sendFollowUp === true,
      followUpHint: action.followUpHint || '',
      humanNote: action.humanNote || decision.reason || '',
      confidence: decision.confidence,
      model: out.model || model,
      provider: out.provider || providerId,
    };
  } catch (err) {
    console.error('[ORCHESTRATOR]', err.message);
    return {
      success: true,
      reply: 'I am having trouble right now. A teammate will reply as soon as possible.',
      handoff: true,
      agent: decision.agent,
      agentName: agent.name,
      intent: decision.intent,
      priority: decision.priority,
      suggestedStage: 'follow_up',
      error: err.message,
    };
  }
};

const generateSummary = async ({ conversation = {}, contact = {}, providerId, model } = {}) => {
  const history = normalizeHistory(
    (conversation.messages || conversation.history || []).filter(m => (m.content || m.text || m.message))
  );
  const business = loadBusinessProfile();
  const ctx = {
    customer: { name: (contact && (contact.name || contact.displayName)) || 'Lead', phone: (contact && contact.phone) || '', stage: (contact && contact.journey) || 'new_lead' },
    transcript: history,
    businessName: business.businessName || business.name || 'this business',
  };

  try {
    const out = await manager.completeJson({
      messages: [
        {
          role: 'system',
          content: [
            `You summarize WhatsApp conversations for a human to take over.`,
            `Return valid JSON: {"summary":"<2-4 sentence neutral summary>","nextBestStep":"<one sentence>","stage":"<recommended pipeline stage>","intent":"<short label>","action":"<short label>","priority":"low|medium|high","contact":{"name":"...","phone":"...","stage":"..."}}`,
          ].join('\n'),
        },
        { role: 'user', content: JSON.stringify(ctx) },
      ],
      temperature: 0.3,
      providerId,
      model,
    });

    if (out && out.ok && out.data) {
      const d = out.data;
      return {
        summary: d.summary || 'No summary available.',
        nextBestStep: d.nextBestStep || '',
        stage: d.stage || (contact && contact.journey) || 'new_lead',
        intent: d.intent || '',
        action: d.action || '',
        priority: ['low', 'medium', 'high'].includes(d.priority) ? d.priority : 'medium',
        contact: d.contact || { name: ctx.customer.name, phone: ctx.customer.phone, stage: ctx.customer.stage },
      };
    }
    return { summary: 'No summary available.', nextBestStep: '', stage: ctx.customer.stage, priority: 'medium', error: (out && out.error) || 'AI unavailable' };
  } catch (err) {
    return { summary: 'No summary available.', nextBestStep: '', stage: ctx.customer.stage, priority: 'medium', error: err.message };
  }
};

module.exports = { runOrchestrator, generateSummary, AGENT_CATALOG };
