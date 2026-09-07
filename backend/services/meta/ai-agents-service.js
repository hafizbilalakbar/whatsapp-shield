const store = require('./store');
const gateway = require('./ai-gateway');

const AGENTS_FILE = 'ai_agents.json';

const AGENT_TYPES = [
  { id: 'sales', label: 'Sales Agent', icon: '💼', defaultInstructions: 'Qualify leads, answer product questions, handle objections, and move prospects toward a purchase that fits their needs.' },
  { id: 'marketing', label: 'Marketing Agent', icon: '📣', defaultInstructions: 'Engage audiences, share relevant offers and updates, and nurture interest without being pushy or spammy.' },
  { id: 'customer_support', label: 'Customer Support Agent', icon: '🎧', defaultInstructions: 'Resolve customer questions and issues quickly, empathetically and accurately, escalating to a human when needed.' },
  { id: 'lead_qualification', label: 'Lead Qualification Agent', icon: '🎯', defaultInstructions: 'Ask smart questions to understand the customer needs, budget and timeline, then flag ready buyers for the sales team.' },
  { id: 'real_estate', label: 'Real Estate Agent', icon: '🏠', defaultInstructions: 'Discuss properties, scheduling viewings, pricing transparency and buyer/seller requirements in a professional way.' },
  { id: 'ecommerce', label: 'Ecommerce Agent', icon: '🛒', defaultInstructions: 'Guide customers through products, orders, shipping, returns and payment questions, and recover abandoned carts.' },
  { id: 'custom', label: 'Custom Agent', icon: '🤖', defaultInstructions: 'A professional, helpful assistant representing the business.' },
];

const emptyAgents = () => ({ agents: [] });

const loadAll = (workspaceId) => store.readJson(workspaceId, AGENTS_FILE, emptyAgents());
const saveAll = (workspaceId, data) => store.writeJson(workspaceId, AGENTS_FILE, data);

const listAgents = (workspaceId) => {
  const all = loadAll(workspaceId);
  return (all.agents || []).slice().sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
};

const getAgent = (workspaceId, id) => {
  const all = loadAll(workspaceId);
  return (all.agents || []).find(a => a.id === id) || null;
};

const buildAgent = (input, existing) => {
  const now = store.now();
  const typeMeta = AGENT_TYPES.find(t => t.id === input.type) || AGENT_TYPES[AGENT_TYPES.length - 1];
  return {
    ...(existing || {}),
    id: existing?.id || store.uuid(),
    name: (input.name || '').trim() || typeMeta.label,
    type: input.type || 'custom',
    icon: input.icon || typeMeta.icon,
    providerId: input.providerId || existing?.providerId || '',
    model: input.model || existing?.model || '',
    instructions: input.instructions || existing?.instructions || typeMeta.defaultInstructions,
    tone: input.tone || existing?.tone || 'Professional & friendly',
    businessKnowledge: input.businessKnowledge || existing?.businessKnowledge || '',
    automation: {
      enabled: input.automation?.enabled !== undefined ? input.automation.enabled : (existing?.automation?.enabled ?? true),
      responseDelayMin: input.automation?.responseDelayMin ?? existing?.automation?.responseDelayMin ?? 1,
      responseDelayMax: input.automation?.responseDelayMax ?? existing?.automation?.responseDelayMax ?? 3,
      matchKeywords: input.automation?.matchKeywords || existing?.automation?.matchKeywords || [],
      greeting: input.automation?.greeting ?? existing?.automation?.greeting ?? true,
      workingHoursOnly: input.automation?.workingHoursOnly ?? existing?.automation?.workingHoursOnly ?? false,
      workingHoursStart: input.automation?.workingHoursStart || existing?.automation?.workingHoursStart || '09:00',
      workingHoursEnd: input.automation?.workingHoursEnd || existing?.automation?.workingHoursEnd || '18:00',
      answerStopper: input.automation?.answerStopper || existing?.automation?.answerStopper || '',
    },
    humanHandoff: {
      enabled: input.humanHandoff?.enabled ?? existing?.humanHandoff?.enabled ?? true,
      keywords: input.humanHandoff?.keywords || existing?.humanHandoff?.keywords || [],
      whenConfused: input.humanHandoff?.whenConfused ?? existing?.humanHandoff?.whenConfused ?? false,
      notify: input.humanHandoff?.notify ?? existing?.humanHandoff?.notify ?? true,
    },
    crmContext: {
      tags: input.crmContext?.tags || existing?.crmContext?.tags || [],
      leadStages: input.crmContext?.leadStages || existing?.crmContext?.leadStages || [],
      autoTag: input.crmContext?.autoTag ?? existing?.crmContext?.autoTag ?? false,
    },
    enabled: input.enabled !== undefined ? Boolean(input.enabled) : (existing?.enabled ?? true),
    preferred: input.preferred !== undefined ? Boolean(input.preferred) : (existing?.preferred ?? false),
    stats: existing?.stats || { conversations: 0, messagesHandled: 0, handoffs: 0 },
    createdAt: existing?.createdAt || now,
    updatedAt: now,
  };
};

const createAgent = (workspaceId, input) => {
  const data = loadAll(workspaceId);
  const agents = data.agents || [];
  const agent = buildAgent(input, null);
  if (agent.preferred) agents.forEach(a => { a.preferred = false; });
  agents.unshift(agent);
  data.agents = agents;
  saveAll(workspaceId, data);
  return { success: true, agent };
};

const updateAgent = (workspaceId, id, input) => {
  const data = loadAll(workspaceId);
  const agents = data.agents || [];
  const idx = agents.findIndex(a => a.id === id);
  if (idx === -1) return { success: false, error: 'Agent not found' };
  if (input.preferred) agents.forEach(a => { a.preferred = false; });
  agents[idx] = buildAgent(input, agents[idx]);
  data.agents = agents;
  saveAll(workspaceId, data);
  return { success: true, agent: agents[idx] };
};

const removeAgent = (workspaceId, id) => {
  const data = loadAll(workspaceId);
  const filtered = (data.agents || []).filter(a => a.id !== id);
  if (filtered.length === (data.agents || []).length) return { success: false, error: 'Agent not found' };
  data.agents = filtered;
  saveAll(workspaceId, data);
  return { success: true };
};

// Highest scoring enabled agent for a message. Falls back to preferred/first.
const pickAgent = (workspaceId, { contact = {}, message = '' } = {}) => {
  const agents = listAgents(workspaceId).filter(a => a.enabled);
  if (!agents.length) return null;

  const explicitId = contact.agentId;
  if (explicitId) {
    const explicit = agents.find(a => a.id === explicitId);
    if (explicit) return explicit;
  }

  const text = String(message || '').toLowerCase();
  let best = null;
  let bestScore = 0;
  for (const agent of agents) {
    let score = 0;
    for (const kw of agent.automation?.matchKeywords || []) {
      if (kw && text.includes(String(kw).toLowerCase())) score += 1;
    }
    for (const kw of agent.crmContext?.tags || []) {
      if (contag(contact, kw)) score += 1;
    }
    if (score > bestScore) { best = agent; bestScore = score; }
  }
  return best || agents.find(a => a.preferred) || agents[0];
};

const contag = (contact, kw) => {
  const tagText = (contact.tags || []).join(' ').toLowerCase();
  return tagText.includes(String(kw || '').toLowerCase());
};

const inWorkingHours = (agent) => {
  const auto = agent.automation || {};
  if (!auto.workingHoursOnly) return true;
  const now = new Date();
  const minutes = now.getHours() * 60 + now.getMinutes();
  const [sh, sm] = String(auto.workingHoursStart || '09:00').split(':').map(Number);
  const [eh, em] = String(auto.workingHoursEnd || '18:00').split(':').map(Number);
  const start = (sh || 9) * 60 + (sm || 0);
  const end = (eh || 18) * 60 + (em || 0);
  return minutes >= start && minutes <= end;
};

const shouldHandoff = (agent, message, reply) => {
  const handoff = agent.humanHandoff || {};
  if (!handoff.enabled) return false;
  const text = `${message || ''} ${reply || ''}`.toLowerCase();
  const hit = (handoff.keywords || []).some(kw => kw && text.includes(String(kw).toLowerCase()));
  if (hit) return true;
  if (handoff.whenConfused && /(?:\?\s*){2,}|sorry,? i (?:don'?t |cannot |am not sure)|i don'?t understand/i.test(reply || '')) return true;
  return false;
};

const buildSystemPrompt = (agent, { contact = {}, businessProfile = {}, history = [] } = {}) => {
  const bp = businessProfile || {};
  const journeyLabels = {
    new_lead: 'New Lead', contacted: 'Contacted', interested: 'Interested', negotiation: 'In Negotiation', converted: 'Converted', closed: 'Closed',
  };
  const lines = [
    `You are the "${agent.name}" WhatsApp AI agent for ${bp.companyName || 'this business'}.`,
    agent.instructions ? `Your role:\n${agent.instructions}` : '',
    agent.tone ? `Tone: ${agent.tone}` : '',
    agent.businessKnowledge ? `Business knowledge:\n${agent.businessKnowledge}` : '',
    bp.description ? `About the business: ${bp.description}` : '',
    `Customer: ${contact.name || 'a customer'} (${contact.country || 'location unknown'})`,
    contact.about ? `Customer profile: ${contact.about}` : '',
    `Pipeline stage: ${journeyLabels[contact.journey] || 'Not set'}`,
    contact.tags && contact.tags.length ? `Contact tags: ${contact.tags.join(', ')}` : '',
    contact.notes ? `Internal notes (context only, never quote):\n${contact.notes}` : '',
    'Guidelines:',
    '- Respond naturally, professionally and concisely, like a real person on WhatsApp.',
    '- Use the customer\'s language when they write in another language.',
    '- Never reveal internal notes or that you are an automated system unless asked.',
    '- If the customer wants a salesperson/agent or asks something you must not answer, hand off politely and mention a human will contact them.',
    '- Never include the word "unsubscribe"/"opt out" in the reply body itself.',
  ];
  return lines.filter(Boolean).join('\n\n');
};

// Main entry for incoming Meta messages: route, generate and safety-check a reply.
async function handleIncoming({ workspaceId, contact, message, history = [], businessProfile = {}, compliance }) {
  const agent = pickAgent(workspaceId, { contact, message });
  if (!agent) return { success: true, handled: false, reason: 'no_agent', reply: null };
  if (!agent.automation?.enabled) return { success: true, handled: false, reason: 'ai_off', reply: null };
  if (!inWorkingHours(agent)) return { success: true, handled: false, reason: 'outside_working_hours', reply: null };
  if (compliance && !compliance.allowed) return { success: true, handled: false, reason: 'compliance_blocked', reply: null };

  // Human handoff keywords in the customer message short-circuit straight to a human.
  if (shouldHandoff(agent, message, '')) {
    bumpStats(workspaceId, agent.id, 'handoffs');
    return { success: true, handled: false, reason: 'handoff', agent, needsHuman: true, reply: null };
  }

  const system = buildSystemPrompt(agent, { contact, businessProfile, history });
  const providers = gateway.loadProviders();
  const filtered = agent.providerId ? providers.filter(p => p.id === agent.providerId) : [];
  const genProviders = filtered.length ? filtered : providers;
  const result = await gateway.complete({
    providers: genProviders,
    model: agent.model || undefined,
    system,
    user: message,
    temperature: 0.65,
    maxTokens: 900,
  });

  if (!result.ok) {
    bumpStats(workspaceId, agent.id, 'errors');
    return { success: true, handled: false, reason: 'ai_error', error: result.error, agent, reply: null };
  }

  const reply = result.text;
  if (shouldHandoff(agent, message, reply)) {
    bumpStats(workspaceId, agent.id, 'handoffs');
    return { success: true, handled: true, reason: 'handoff_after_reply', needsHuman: true, agent, reply, provider: result.provider };
  }

  bumpStats(workspaceId, agent.id, 'messages');
  return { success: true, handled: true, reason: 'replied', agent, reply, provider: result.provider, model: result.model };
}

const bumpStats = (workspaceId, agentId, kind) => {
  const data = loadAll(workspaceId);
  const agent = (data.agents || []).find(a => a.id === agentId);
  if (!agent) return;
  if (kind === 'conversations') agent.stats.conversations += 1;
  if (kind === 'handoffs') agent.stats.handoffs += 1;
  if (kind === 'errors') agent.stats.messagesHandled = (agent.stats.messagesHandled || 0);
  if (kind === 'messages') agent.stats.messagesHandled = (agent.stats.messagesHandled || 0) + 1;
  agent.updatedAt = store.now();
  saveAll(workspaceId, data);
};

module.exports = {
  listAgents,
  getAgent,
  createAgent,
  updateAgent,
  removeAgent,
  pickAgent,
  handleIncoming,
  shouldHandoff,
  inWorkingHours,
  AGENT_TYPES,
  AGENTS_FILE,
};