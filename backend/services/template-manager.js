const crypto = require('crypto');
const path = require('path');
const fs = require('fs');
const aiManager = require('./ai/manager');
const uuidv4 = () => crypto.randomUUID();

class TemplateManager {
  constructor({ loadTemplates, saveTemplates, aiProvidersPath } = {}) {
    this.loadTemplates = loadTemplates || this._defaultLoadTemplates.bind(this);
    this.saveTemplates = saveTemplates || this._defaultSaveTemplates.bind(this);
    this.aiProvidersPath = aiProvidersPath || path.join(__dirname, '..', 'ai_providers.json');
    this.templates = [];
    this.usageHistory = [];
    this.suppressionList = new Set();
    this.frequencyCaps = new Map();
    this._initialized = false;
  }

  async init() {
    if (this._initialized) return;
    const saved = await this.loadTemplates();
    this.templates = saved && saved.length > 0 ? saved : this._getDefaultTemplates();
    this._initialized = true;
    return this;
  }

  _defaultLoadTemplates() {
    return Promise.resolve(null);
  }

  _defaultSaveTemplates(templates) {
    return Promise.resolve(templates);
  }

  _getDefaultTemplates() {
    const ts = () => new Date().toISOString();
    return [
      // === LOW-TICKET / RETAINER SERVICES ===
      { id: uuidv4(), category: 'low_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Social Media Design Overhaul', body: 'Hello {{1}}, I came across your business page today. Our team at {{2}} actually designed 2 custom, high-converting social media posts specifically for your brand as a complimentary gift. Can I drop the view-link here?', description: 'Offer a free social media design sample to warm up the lead.', best_for: 'Social media service cold outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Yes, send them!', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not right now.', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'low_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Short Form Video Hook', body: 'Hi {{1}}, your recent video content has great value, but changing the first 3 seconds could double your retention. We wrote 3 high-retention opening hooks tailored for {{2}}. Would you like to try them out?', description: 'Offer free video hook suggestions to showcase editing expertise.', best_for: 'Video/editing service cold outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Send the hooks', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'No, thank you', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'low_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Lead Magnet Free Ebook', body: 'Hello {{1}}, we just published an exclusive industry report on how small businesses in {{2}} are cutting operational costs by 40% this year. I would love to share a free digital copy with you. May I send it over?', description: 'Provide a valuable free resource to start the conversation.', best_for: 'Lead generation and content marketing outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Yes, share report', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Unsubscribe', action_tag: 'BLACKLIST_OPTOUT' }] },

      // === MEDIUM-TICKET SERVICES ===
      { id: uuidv4(), category: 'medium_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Website Speed SEO Fix', body: 'Hello {{1}}, I was researching your website {{2}} and noticed a performance lag on mobile devices that could be hurting your Google ranking. We generated a quick 90-second speed audit report for you. Can I share it here?', description: 'Offer a free website audit to demonstrate SEO expertise.', best_for: 'Web development and SEO service outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'View Speed Audit', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Website is fine', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'medium_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Competitor Ad Infiltration', body: 'Hi {{1}}, we just completed a local market analysis and identified exactly where your direct competitors are capturing most of their online leads. We mapped a counter-strategy for {{2}}. Would you like a quick look?', description: 'Leverage competitive intelligence to create urgency.', best_for: 'Digital marketing and PPC service outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Show the strategy', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not interested', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'medium_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Google Business Profile Optimization', body: 'Hello {{1}}, your business {{2}} has great potential on Google Maps, but it is currently missing a few local search keywords. We can help you rank in the top 3 spots to drive daily calls. Can I send a free optimization mockup?', description: 'Offer free Google Business Profile audit and mockup.', best_for: 'Local SEO and Google Maps optimization outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Send the mockup', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Stop notifications', action_tag: 'BLACKLIST_OPTOUT' }] },

      // === HIGH-TICKET SERVICES ===
      { id: uuidv4(), category: 'high_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Personalized Video Audit', body: 'Hello {{1}}, our development team built a customized automation blueprint for your workflows at {{2}}. I recorded a brief 3-minute video showing how this can save you 10+ hours a week. Can I drop the video link?', description: 'Offer a personalized video audit as a high-value demonstration.', best_for: 'AI automation and CRM service outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Send video link', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Please unsubscribe', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'high_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Paid Ads Funnel ROI', body: 'Hi {{1}}, we build customer acquisition funnels that helped a brand very similar to {{2}} add $25k in new revenue last quarter. We are taking on two international case studies this month with a performance guarantee. Are you open for a brief chat?', description: 'Present proven ROI from similar clients to drive interest.', best_for: 'High-ticket advertising and funnel building outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'CTA', text: 'Book 10-Min Chat', url_param: '{{3}}', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Maybe later', action_tag: 'SOFT_REJECTION' }] },
      { id: uuidv4(), category: 'high_ticket', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Custom AI Chatbot Demo', body: 'Hello {{1}}, missing live chat leads on your website can cost thousands in sales. We built a live simulation AI chatbot specifically trained on {{2}} data to show you how it qualifies leads 24/7. Would you like to test the demo link?', description: 'Offer an interactive AI chatbot demo tailored to their business.', best_for: 'AI chatbot and automation service outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Test Live Demo', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'No, thanks', action_tag: 'BLACKLIST_OPTOUT' }] },

      // === SMART FOLLOW-UP & CLOSEOUTS ===
      { id: uuidv4(), category: 'smart_follow_up', trigger_state: 'Follow-Up - Nudge 1 (48 Hours)', name: 'Soft Value Drop', body: 'Hello {{1}}, I know you are focused on scaling {{2}} right now. I just wanted to share this quick case study showing how we solved the exact customer-dropoff issue we specialize in. Would this be useful to read?', description: 'Drop a relevant case study as a gentle nudge.', best_for: 'First follow-up after no response (48h window)', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Yes, send it', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not right now', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'smart_follow_up', trigger_state: 'Follow-Up - Nudge 2 (Breakup)', name: 'Permission to Close File', body: 'Hi {{1}}, since I have not heard back, I will assume optimizing your digital infrastructure at {{2}} is not a priority today. I am closing your file to keep your inbox clean. If things change, feel free to ping us. Wish you the best!', description: 'Breakup message to prompt a final decision from the lead.', best_for: 'Final follow-up before closing the lead (breakup sequence)', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Wait, let\'s talk!', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Thank you', action_tag: 'ARCHIVE_CONVERSATION' }] },
      { id: uuidv4(), category: 'smart_follow_up', trigger_state: 'Long-Term Nurturing (30 Days)', name: 'Re-engagement After 30 Days', body: 'Hello {{1}}, hope your quarter is going great at {{2}}. We just updated our core growth framework with new international market data for 2026. Would you be open to a quick update on what is currently working in your niche?', description: 'Re-engage dormant leads with fresh industry insights.', best_for: 'Long-term re-engagement for cold/unresponsive leads', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Sure, update me', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Remove my number', action_tag: 'BLACKLIST_OPTOUT' }] },

      // === ADDITIONAL PROFESSIONAL TEMPLATES ===
      { id: uuidv4(), category: 'utility', trigger_state: 'Customer Support', name: 'Thank You Message', body: 'Hi {{1}}, thank you for choosing {{2}}. We truly appreciate your business. If you have any questions or need support, simply reply to this message and our team will assist you promptly.', description: 'Professional thank-you message after purchase or signup.', best_for: 'Post-purchase customer appreciation', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'You\'re welcome!', action_tag: 'ARCHIVE_CONVERSATION' }] },
      { id: uuidv4(), category: 'utility', trigger_state: 'Payment Follow-Up', name: 'Payment Reminder', body: 'Hi {{1}}, this is a friendly reminder that your invoice of {{3}} for {{2}} services is due on {{4}}. To avoid any service interruption, please process the payment at your earliest convenience. Reply if you need payment details.', description: 'Polite payment reminder with clear call to action.', best_for: 'Payment collection and invoice follow-up', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Will pay today', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Need extension', action_tag: 'SOFT_REJECTION' }] },
      { id: uuidv4(), category: 'utility', trigger_state: 'Feedback Request', name: 'Feedback Request', body: 'Hi {{1}}, we recently worked together on {{2}} and would love your feedback. Your insights help us improve our services. Would you mind sharing your experience in a quick 2-minute survey?', description: 'Request feedback after service delivery.', best_for: 'Post-delivery feedback collection', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Sure, send survey', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not right now', action_tag: 'SOFT_REJECTION' }] },

      // === SALES ===
      { id: uuidv4(), category: 'sales', trigger_state: 'Post-Demo Follow-Up', name: 'Post-Demo Follow-Up', body: 'Hi {{1}}, thank you for your time during the {{2}} demo. Based on our conversation, I believe we can help you achieve {{3}}. Would you like to proceed with a trial or schedule a deeper discovery call?', description: 'Follow up after a successful product or service demo.', best_for: 'Post-demo conversion and next-step alignment', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Let\'s proceed', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Need more time', action_tag: 'SOFT_REJECTION' }] },
      { id: uuidv4(), category: 'sales', trigger_state: 'Objection Handling', name: 'Objection Handling', body: 'Hi {{1}}, I understand your concern about {{2}}. Many of our clients felt the same way initially. What they found was that {{3}} actually saved them time and resources within the first month. Would you be open to a brief chat to address your specific concerns?', description: 'Address common objections with social proof.', best_for: 'Overcoming objections and moving leads forward', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Let\'s discuss', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not convinced', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'sales', trigger_state: 'Closing', name: 'Closing Call to Action', body: 'Hi {{1}}, we are ready to get started on {{2}} as soon as you give the green light. Our team has prepared everything needed for a seamless kickoff. Shall we proceed with the onboarding this week?', description: 'Direct closing message to convert a warm lead.', best_for: 'Final closing and conversion', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Yes, start onboarding', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not yet', action_tag: 'SOFT_REJECTION' }] },

      // === MARKETING ===
      { id: uuidv4(), category: 'marketing', trigger_state: 'Re-engagement', name: 'Social Media Growth Proposal', body: 'Hi {{1}}, we analyzed your social media presence at {{2}} and identified 3 key growth opportunities. Our team can help you gain {{3}} new followers and increase engagement by {{4}} within 60 days. Interested in seeing the full strategy?', description: 'Data-driven social media growth outreach.', best_for: 'Social media marketing service outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Show strategy', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not interested', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'marketing', trigger_state: 'Re-engagement', name: 'Content Marketing Outreach', body: 'Hi {{1}}, your audience at {{2}} is actively searching for content about {{3}}. We can create a content series that positions your brand as the go-to authority in this space. Would you like to see a content roadmap tailored for your business?', description: 'Content marketing value proposition outreach.', best_for: 'Content writing and strategy service outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Send roadmap', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'No, thanks', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'marketing', trigger_state: 'Re-engagement', name: 'Landing Page Conversion Audit', body: 'Hi {{1}}, we reviewed your landing page at {{2}} and identified conversion blockers that may be costing you leads. Our team specializes in high-converting landing pages that turn visitors into customers. Can I share a free optimization report?', description: 'Landing page CRO audit outreach.', best_for: 'Web design and conversion optimization outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Send report', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not needed', action_tag: 'BLACKLIST_OPTOUT' }] },

      // === AI OUTREACH ===
      { id: uuidv4(), category: 'ai_outreach', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'AI Automation Opportunity', body: 'Hello {{1}}, we specialize in building custom AI automation solutions for companies like {{2}}. From chatbots that qualify leads 24/7 to automated workflow systems, we help you save time and increase revenue. Would you be open to a 10-minute discovery call?', description: 'AI automation service cold outreach.', best_for: 'AI and automation service cold outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Book discovery call', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Not right now', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'ai_outreach', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'CRM Implementation Proposal', body: 'Hi {{1}}, we noticed that {{2}} could benefit from a centralized CRM system to manage leads, track communications, and automate follow-ups. Our team can implement a customized CRM solution in under 2 weeks. Would you like to see a demo?', description: 'CRM implementation service outreach.', best_for: 'CRM and digital transformation service outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'View demo', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'No, thanks', action_tag: 'BLACKLIST_OPTOUT' }] },
      { id: uuidv4(), category: 'ai_outreach', trigger_state: 'Cold Outreach - Touchpoint 1', name: 'Digital Transformation Strategy', body: 'Hello {{1}}, we help businesses like {{2}} undergo digital transformation that reduces operational costs by {{3}} and improves customer satisfaction. Our end-to-end approach covers AI, automation, CRM, and analytics. Are you open to a strategic consultation?', description: 'Digital transformation consulting outreach.', best_for: 'Enterprise digital transformation outreach', isDefault: true, created_at: ts(), updated_at: ts(), buttons: [{ type: 'QUICK_REPLY', text: 'Book consultation', action_tag: 'HOT_LEAD_AI_ENGAGE' }, { type: 'QUICK_REPLY', text: 'Unsubscribe', action_tag: 'BLACKLIST_OPTOUT' }] },
    ];
  }

  async getTemplates(category) {
    if (!this._initialized) await this.init();
    if (category) {
      return this.templates.filter(t => t.category === category);
    }
    return [...this.templates];
  }

  async getTemplateCategories() {
    if (!this._initialized) await this.init();
    const categories = [...new Set(this.templates.map(t => t.category))];
    return categories.map(cat => ({
      id: cat,
      name: cat.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
      count: this.templates.filter(t => t.category === cat).length
    }));
  }

  async _callAIForRecommendation(context) {
    const {
      industry = '',
      service = '',
      campaignObjective = '',
      audience = '',
      tone = '',
      previousTemplates = []
    } = context;

    const systemPrompt = `You are a WhatsApp template recommendation engine. Given the context, suggest the best message template.

Return a JSON object with:
- name: template name (max 50 chars)
- category: one of: low_ticket, medium_ticket, high_ticket, smart_follow_up, utility, sales, marketing, ai_outreach
- trigger_state: one of: Cold Outreach - Touchpoint 1, Follow-Up - Nudge 1 (48 Hours), Follow-Up - Nudge 2 (Breakup), Long-Term Nurturing (30 Days), Customer Support, Payment Follow-Up, Feedback Request, Post-Demo Follow-Up, Objection Handling, Closing, Re-engagement
- body: the message template (use {{1}} for first_name, {{2}} for company, {{3}} for custom_var1, {{4}} for custom_var2; max 1024 chars; must NOT start or end with a variable; must include opt-out language)
- description: brief description of the template
- best_for: when this template is most effective
- buttons: array of button objects with type (QUICK_REPLY or CTA), text, action_tag (one of: HOT_LEAD_AI_ENGAGE, SOFT_REJECTION, BLACKLIST_OPTOUT, ARCHIVE_CONVERSATION)

Rules:
- Body must not start or end with {{N}} variable
- Must be under 1024 characters
- Must include at least one button with action_tag "BLACKLIST_OPTOUT"
- Make it conversational, professional, and specific to the context`;

    const userPrompt = `Industry: ${industry}
Service: ${service}
Campaign Objective: ${campaignObjective}
Target Audience: ${audience}
Desired Tone: ${tone}
Previous Templates Used: ${previousTemplates.join(', ') || 'None'}

Generate one recommended WhatsApp template as a JSON object.`;

    const result = await aiManager.completeJson({ system: systemPrompt, user: userPrompt, temperature: 0.5, maxTokens: 1200 });
    if (!result.ok || !result.data) return null;
    const parsed = result.data;
    if (parsed.name && parsed.body && parsed.category) return parsed;
    return null;
  }

  async recommendTemplate(conversationState) {
    if (!this._initialized) await this.init();
    const {
      industry,
      service,
      campaignObjective,
      audience,
      tone,
      stage,
      leadQuality,
      lastInteractionDays,
      contactId,
      previousTemplateIds = [],
      categoryPreference = null,
      optedOut = false,
      interactionCount = 0,
      responseRate = 0,
      useAI = true
    } = conversationState;

    if (optedOut) return null;

    // Try AI recommendation first
    if (useAI) {
      try {
        const aiTemplate = await this._callAIForRecommendation({
          industry,
          service,
          campaignObjective,
          audience,
          tone,
          previousTemplates: previousTemplateIds.map(id => {
            const t = this.templates.find(tmpl => tmpl.id === id);
            return t ? t.name : '';
          }).filter(Boolean)
        });

        if (aiTemplate) {
          return [{
            template: {
              ...aiTemplate,
              id: uuidv4(),
              isDefault: false,
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            },
            score: 95,
            reason: 'AI-generated recommendation based on your business context and campaign objectives',
            source: 'ai'
          }];
        }
      } catch (err) {
        console.error('AI recommendation failed, falling back to rule-based:', err.message);
      }
    }

    // Rule-based fallback
    let candidates = this.templates.map(template => {
      let score = 0;

      const stageScore = this._calculateStageScore(template.category, stage);
      score += stageScore;

      const qualityScore = this._calculateQualityScore(template.category, leadQuality);
      score += qualityScore;

      const timingScore = this._calculateTimingScore(template.category, lastInteractionDays);
      score += timingScore;

      const varietyPenalty = previousTemplateIds.includes(template.id) ? -20 : 0;
      score += varietyPenalty;

      if (categoryPreference && template.category === categoryPreference) {
        score += 10;
      }

      if (interactionCount > 5 && responseRate > 0.5) {
        if (['appointment', 'proposal'].includes(template.category)) {
          score += 15;
        }
      }

      if (lastInteractionDays > 14 && ['follow_up', 're_engagement'].includes(template.category)) {
        score += 10;
      }

      const usagePenalty = this._calculateUsagePenalty(template.id, contactId);
      score += usagePenalty;

      const frequencyPenalty = this._calculateFrequencyPenalty(template.id, contactId);
      score += frequencyPenalty;

      return { template, score };
    });

    candidates.sort((a, b) => b.score - a.score);

    const topCandidates = candidates.slice(0, 3);
    const totalScore = topCandidates.reduce((sum, c) => sum + Math.max(c.score, 1), 0);

    return topCandidates.map(c => ({
      template: c.template,
      score: Math.round((Math.max(c.score, 1) / totalScore) * 100),
      reason: this._getRecommendationReason(c.template, stage, leadQuality, lastInteractionDays),
      source: 'rule'
    }));
  }

  _calculateStageScore(category, stage) {
    const stageMap = {
      'cold': { introduction: 30, value_first: 20, follow_up: 10, appointment: 5, proposal: 0, reminder: 0, onboarding: 0, re_engagement: 5 },
      'interested': { introduction: 10, value_first: 20, follow_up: 15, appointment: 25, proposal: 10, reminder: 5, onboarding: 0, re_engagement: 0 },
      'engaged': { introduction: 0, value_first: 10, follow_up: 10, appointment: 20, proposal: 25, reminder: 15, onboarding: 0, re_engagement: 0 },
      'proposal_sent': { introduction: 0, value_first: 5, follow_up: 20, appointment: 15, proposal: 10, reminder: 25, onboarding: 0, re_engagement: 0 },
      'negotiating': { introduction: 0, value_first: 0, follow_up: 15, appointment: 10, proposal: 20, reminder: 25, onboarding: 0, re_engagement: 0 },
      'won': { introduction: 0, value_first: 0, follow_up: 0, appointment: 5, proposal: 0, reminder: 10, onboarding: 30, re_engagement: 0 },
      'dormant': { introduction: 5, value_first: 10, follow_up: 10, appointment: 5, proposal: 0, reminder: 0, onboarding: 0, re_engagement: 30 },
      'at_risk': { introduction: 0, value_first: 5, follow_up: 10, appointment: 5, proposal: 0, reminder: 10, onboarding: 15, re_engagement: 20 }
    };

    return (stageMap[stage] && stageMap[stage][category]) || 0;
  }

  _calculateQualityScore(category, quality) {
    const qualityMap = {
      'high': { introduction: 15, value_first: 10, follow_up: 10, appointment: 20, proposal: 25, reminder: 15, onboarding: 15, re_engagement: 5 },
      'medium': { introduction: 15, value_first: 15, follow_up: 15, appointment: 15, proposal: 15, reminder: 15, onboarding: 15, re_engagement: 10 },
      'low': { introduction: 20, value_first: 20, follow_up: 5, appointment: 5, proposal: 0, reminder: 5, onboarding: 5, re_engagement: 15 }
    };

    return (qualityMap[quality] && qualityMap[quality][category]) || 10;
  }

  _calculateTimingScore(category, lastInteractionDays) {
    if (lastInteractionDays === null || lastInteractionDays === undefined) return 10;

    if (category === 'introduction' && lastInteractionDays <= 1) return 20;
    if (category === 'follow_up' && lastInteractionDays >= 3 && lastInteractionDays <= 7) return 20;
    if (category === 're_engagement' && lastInteractionDays >= 14) return 20;
    if (category === 'reminder' && lastInteractionDays >= 1 && lastInteractionDays <= 3) return 20;

    return 5;
  }

  _calculateUsagePenalty(templateId, contactId) {
    const usages = this.usageHistory.filter(
      u => u.templateId === templateId && u.contactId === contactId
    );
    return Math.min(usages.length * -5, -20);
  }

  _calculateFrequencyPenalty(templateId, contactId) {
    const cap = this.frequencyCaps.get(`${contactId}:${templateId}`);
    if (!cap) return 0;
    const recentUsage = this.usageHistory.filter(
      u => u.templateId === templateId &&
        u.contactId === contactId &&
        Date.now() - u.timestamp < (cap.windowMs || 259200000)
    ).length;
    if (recentUsage >= (cap.maxUses || 3)) return -50;
    if (recentUsage >= (cap.maxUses || 3) - 1) return -20;
    return 0;
  }

  _getRecommendationReason(template, stage, quality, daysSinceLast) {
    const reasons = [];

    if (stage === 'won' && template.category === 'onboarding') {
      reasons.push('New customer - start onboarding');
    } else if (stage === 'dormant' && template.category === 're_engagement') {
      reasons.push('Inactive contact - attempt re-engagement');
    } else if (daysSinceLast > 7 && template.category === 'follow_up') {
      reasons.push(`${daysSinceLast} days since last interaction - follow up`);
    } else if (quality === 'high' && template.category === 'proposal') {
      reasons.push('High-quality lead - send proposal');
    } else if (template.category === 'introduction') {
      reasons.push('Best for initial outreach');
    }

    if (reasons.length === 0) {
      reasons.push(`Best fit for ${stage} stage with ${quality} quality lead`);
    }

    return reasons.join('. ');
  }

  async personalizeTemplate(templateId, contactData, businessProfile = {}) {
    if (!this._initialized) await this.init();
    const template = this.templates.find(t => t.id === templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    const {
      first_name = '',
      last_name = '',
      company_name = '',
      country = '',
      language = '',
      formality = 'neutral',
      title = '',
      gender = '',
      previous_purchases = [],
      industry = '',
      pain_points = [],
      custom_fields = {}
    } = contactData;

    const {
      business_name = '',
      your_name = '',
      your_title = '',
      your_company = '',
      contact_number = '',
      calendar_link = '',
      website = ''
    } = businessProfile;

    const greeting = this._getGreeting(first_name, title, gender, formality, country, language);
    const closing = this._getClosing(formality, country, language);

    let personalized = template.body;

    const replacements = {
      '{{first_name}}': first_name || 'there',
      '{{last_name}}': last_name,
      '{{company_name}}': company_name || 'your company',
      '{{country}}': country,
      '{{language}}': language,
      '{{industry}}': industry || 'your industry',
      '{{your_company}}': your_company || business_name,
      '{{your_name}}': your_name,
      '{{your_title}}': your_title,
      '{{contact_number}}': contact_number,
      '{{calendar_link}}': calendar_link,
      '{{website}}': website,
      '{{business_name}}': business_name
    };

    for (const [key, value] of Object.entries(custom_fields)) {
      replacements[`{{${key}}}`] = value;
    }

    for (const [placeholder, value] of Object.entries(replacements)) {
      const regex = new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g');
      personalized = personalized.replace(regex, value || '');
    }

    personalized = personalized.replace(/\{\{[a-z_]+\}\}/gi, (match) => {
      const fieldName = match.replace(/[{}]/g, '');
      return `[${fieldName}]`;
    });

    const lines = personalized.split('\n');
    if (lines.length > 0 && greeting) {
      lines[0] = greeting;
    }
    if (lines.length > 1 && closing) {
      lines[lines.length - 1] = closing;
    }
    personalized = lines.join('\n');

    personalized = this._adjustFormality(personalized, formality);

    return {
      template_id: template.id,
      category: template.category,
      name: template.name,
      subject: template.subject,
      body: personalized,
      placeholders_used: template.placeholders.map(p => p.name),
      formality_adjusted: formality !== 'neutral',
      greeting_adapted: !!greeting
    };
  }

  _getGreeting(firstName, title, gender, formality, country, language) {
    if (!firstName) return 'Hi there,';

    const formalTitles = {
      'de': { 'Herr': 'Herr', 'Frau': 'Frau' },
      'ja': { '様': '様', 'さん': 'さん' },
      'fr': { 'M.': 'Monsieur', 'Mme': 'Madame', 'Mlle': 'Mademoiselle' }
    };

    if (formality === 'formal' || formality === 'very_formal') {
      if (title && formalTitles[language] && formalTitles[language][title]) {
        return `${formalTitles[language][title]} ${lastName || firstName},`;
      }
      if (title) {
        return `Dear ${title} ${lastName || firstName},`;
      }
      return `Dear ${firstName},`;
    }

    if (formality === 'informal') {
      const casualGreetings = {
        'en': `Hey ${firstName}!`,
        'es': `Hola ${firstName}!`,
        'pt': `Oi ${firstName}!`,
        'de': `Hallo ${firstName}!`,
        'fr': `Salut ${firstName}!`,
        'it': `Ciao ${firstName}!`,
        'ja': `${firstName}さん、`,
        'ko': `${firstName}님,`,
        'zh': `${firstName}，`,
        'ar': `مرحبا ${firstName}!`,
        'hi': `${firstName},`
      };
      return casualGreetings[language] || `Hey ${firstName}!`;
    }

    const neutralGreetings = {
      'en': `Hi ${firstName},`,
      'es': `Hola ${firstName},`,
      'pt': `Olá ${firstName},`,
      'de': `Hallo ${firstName},`,
      'fr': `Bonjour ${firstName},`,
      'it': `Ciao ${firstName},`,
      'ja': `${firstName}さん、`,
      'ko': `${firstName}님,`,
      'zh': `${firstName}，`,
      'ar': `مرحبا ${firstName}،`,
      'hi': `नमस्ते ${firstName},`
    };

    return neutralGreetings[language] || `Hi ${firstName},`;
  }

  _getClosing(formality, country, language) {
    if (formality === 'formal' || formality === 'very_formal') {
      const formalClosings = {
        'en': 'Best regards,',
        'es': 'Atentamente,',
        'pt': 'Atenciosamente,',
        'de': 'Mit freundlichen Grüßen,',
        'fr': 'Cordialement,',
        'it': 'Cordiali saluti,',
        'ja': '敬具',
        'ko': '감사합니다.',
        'zh': '此致敬礼',
        'ar': 'مع خالص التحيات،',
        'hi': 'सादर,'
      };
      return formalClosings[language] || 'Best regards,';
    }

    const neutralClosings = {
      'en': 'Best,',
      'es': 'Saludos,',
      'pt': 'Abraço,',
      'de': 'Viele Grüße,',
      'fr': 'Cordialement,',
      'it': 'Saluti,',
      'ja': 'よろしくお願いします',
      'ko': '감사합니다',
      'zh': '谢谢',
      'ar': 'مع التحية،',
      'hi': 'धन्यवाद,'
    };
    return neutralClosings[language] || 'Best,';
  }

  _adjustFormality(text, formality) {
    if (formality === 'very_formal') {
      text = text.replace(/!/g, '.');
      text = text.replace(/Hey|Hi|Hello/g, 'Dear');
    }

    if (formality === 'informal') {
      text = text.replace(/Dear/g, 'Hey');
      text = text.replace(/Best regards,/g, 'Cheers,');
      text = text.replace(/Sincerely,/g, 'Talk soon,');
    }

    return text;
  }

  async saveCustomTemplate(template) {
    if (!this._initialized) await this.init();

    const validation = this.validateTemplate(template);
    if (!validation.valid) {
      throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
    }

    if (template.id) {
      const existingIndex = this.templates.findIndex(t => t.id === template.id);
      if (existingIndex >= 0) {
        this.templates[existingIndex] = { ...this.templates[existingIndex], ...template, updated_at: new Date().toISOString() };
      } else {
        this.templates.push({ ...template, created_at: new Date().toISOString(), updated_at: new Date().toISOString() });
      }
    } else {
      const newTemplate = {
        ...template,
        id: uuidv4(),
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      };
      this.templates.push(newTemplate);
      template = newTemplate;
    }

    await this.saveTemplates(this.templates);
    return template;
  }

  async deleteTemplate(id) {
    if (!this._initialized) await this.init();
    const index = this.templates.findIndex(t => t.id === id);
    if (index < 0) throw new Error(`Template not found: ${id}`);
    this.templates.splice(index, 1);
    await this.saveTemplates(this.templates);
    return true;
  }

  async duplicateTemplate(id) {
    if (!this._initialized) await this.init();
    const source = this.templates.find(t => t.id === id);
    if (!source) throw new Error(`Template not found: ${id}`);
    const duplicate = {
      ...source,
      id: uuidv4(),
      name: `${source.name} (Copy)`,
      isDefault: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    delete duplicate._id;
    this.templates.push(duplicate);
    await this.saveTemplates(this.templates);
    return duplicate;
  }

  async updateTemplate(id, updates) {
    if (!this._initialized) await this.init();
    const index = this.templates.findIndex(t => t.id === id);
    if (index < 0) throw new Error(`Template not found: ${id}`);
    const merged = { ...this.templates[index], ...updates, id, updated_at: new Date().toISOString() };
    if (updates.body !== undefined || updates.name !== undefined || updates.category !== undefined) {
      const validation = this.validateTemplate(merged);
      if (!validation.valid) {
        throw new Error(`Invalid template: ${validation.errors.join(', ')}`);
      }
    }
    this.templates[index] = merged;
    await this.saveTemplates(this.templates);
    return merged;
  }

  async processButtonClick(templateId, buttonActionTag, contactId, metadata = {}) {
    if (!this._initialized) await this.init();
    const template = this.templates.find(t => t.id === templateId);
    if (!template) throw new Error(`Template not found: ${templateId}`);

    const action = buttonActionTag || 'UNKNOWN';
    let pipelineUpdate = null;

    switch (action) {
      case 'BLACKLIST_OPTOUT':
        this.addToSuppressionList(contactId);
        pipelineUpdate = { state: 'Do Not Contact', suppressionList: true };
        break;
      case 'HOT_LEAD_AI_ENGAGE':
        pipelineUpdate = { state: 'Hot Lead - AI Engage', priority: 'high' };
        break;
      case 'SOFT_REJECTION':
        pipelineUpdate = { state: 'Soft Rejection - Nurture', priority: 'low' };
        break;
      case 'ARCHIVE_CONVERSATION':
        pipelineUpdate = { state: 'Archived', archived: true };
        break;
      default:
        pipelineUpdate = { state: `Action: ${action}` };
    }

    this.trackUsage(templateId, contactId, { action, pipelineUpdate, ...metadata });

    return {
      action,
      contactId,
      templateId,
      templateName: template.name,
      pipelineUpdate,
      timestamp: new Date().toISOString()
    };
  }

  async searchTemplates(query) {
    if (!this._initialized) await this.init();
    const q = query.toLowerCase();
    return this.templates.filter(t =>
      (t.name && t.name.toLowerCase().includes(q)) ||
      (t.category && t.category.toLowerCase().includes(q)) ||
      (t.body && t.body.toLowerCase().includes(q)) ||
      (t.subject && t.subject.toLowerCase().includes(q)) ||
      (t.description && t.description.toLowerCase().includes(q)) ||
      (t.best_for && t.best_for.toLowerCase().includes(q))
    );
  }

  async generateVariation(template) {
    const variations = [];

    const bodyVariation = this._shuffleSentenceOrder(template.body);
    variations.push({
      ...template,
      id: uuidv4(),
      name: `${template.name} (Variation A)`,
      body: bodyVariation,
      variation_type: 'sentence_reorder'
    });

    const toneVariation = this._adjustTone(template.body);
    variations.push({
      ...template,
      id: uuidv4(),
      name: `${template.name} (Variation B)`,
      body: toneVariation,
      variation_type: 'tone_adjustment'
    });

    const lengthVariation = this._adjustLength(template.body);
    variations.push({
      ...template,
      id: uuidv4(),
      name: `${template.name} (Variation C)`,
      body: lengthVariation,
      variation_type: 'length_adjustment'
    });

    const hookVariation = this._changeOpeningHook(template.body);
    variations.push({
      ...template,
      id: uuidv4(),
      name: `${template.name} (Variation D)`,
      body: hookVariation,
      variation_type: 'opening_hook'
    });

    return variations;
  }

  _shuffleSentenceOrder(body) {
    const sentences = body.split(/(?<=[.!?])\s+/);
    if (sentences.length <= 2) return body;

    const firstSentence = sentences[0];
    const rest = sentences.slice(1);

    for (let i = rest.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [rest[i], rest[j]] = [rest[j], rest[i]];
    }

    return [firstSentence, ...rest].join(' ');
  }

  _adjustTone(body) {
    const formalReplacements = [
      [/I'd love to/g, 'I would like to'],
      [/I'm/g, 'I am'],
      [/don't/g, 'do not'],
      [/can't/g, 'cannot'],
      [/won't/g, 'will not'],
      [/Hey/g, 'Dear'],
      [/Hi/g, 'Dear'],
      [/thanks/g, 'thank you'],
      [/Thanks/g, 'Thank you'],
      [/quick/g, 'brief'],
      [/chat/g, 'discussion'],
      [/stuff/g, 'items'],
      [/things/g, 'items'],
      [/pretty good/g, 'satisfactory'],
      [/awesome/g, 'excellent'],
      [/amazing/g, 'outstanding']
    ];

    let adjusted = body;
    formalReplacements.forEach(([pattern, replacement]) => {
      adjusted = adjusted.replace(pattern, replacement);
    });

    return adjusted;
  }

  _adjustLength(body) {
    const sentences = body.split(/(?<=[.!?])\s+/);
    if (sentences.length <= 3) {
      return body + '\n\nI look forward to hearing from you.';
    }

    const compressed = sentences.filter((_, i) => {
      if (i === 0) return true;
      if (i === sentences.length - 1) return true;
      return Math.random() > 0.3;
    });

    return compressed.join(' ');
  }

  _changeOpeningHook(body) {
    const lines = body.split('\n');
    const firstContentLine = lines.findIndex(l => l.trim().length > 0 && !l.match(/^(Hi|Hello|Hey|Dear|Salut|Hola|Oi|Hallo|Ciao|Bonjour)/i));

    if (firstContentLine < 0) return body;

    const hooks = [
      'I hope this message finds you well.',
      'I hope you\'re having a great week.',
      'I wanted to reach out about something that could help.',
      'I have a quick question for you.',
      'Something came to mind that I wanted to share.',
      'I was thinking about your business and had an idea.'
    ];

    const randomHook = hooks[Math.floor(Math.random() * hooks.length)];

    const contentWithoutHook = lines.filter((_, i) => i !== firstContentLine);
    const newLines = [lines[0], '', randomHook, '', ...contentWithoutHook.filter(l => l.trim())];

    return newLines.join('\n');
  }

  validateTemplate(template) {
    const errors = [];

    if (!template.name || typeof template.name !== 'string' || template.name.trim().length === 0) {
      errors.push('Template name is required');
    }

    if (!template.category || typeof template.category !== 'string') {
      errors.push('Template category is required');
    }

    if (!template.body || typeof template.body !== 'string' || template.body.trim().length === 0) {
      errors.push('Template body is required');
    }

    if (template.body && template.body.length > 1024) {
      errors.push('Template body exceeds maximum length (1024 characters)');
    }

    if (template.body && /^\{\{\d+\}\}/.test(template.body.trim())) {
      errors.push('Template body cannot start with a variable placeholder');
    }

    if (template.body && /\{\{\d+\}\}$/.test(template.body.trim())) {
      errors.push('Template body cannot end with a variable placeholder');
    }

    const hasOptOut = template.buttons && template.buttons.some(b => b.action_tag === 'BLACKLIST_OPTOUT');
    if (!hasOptOut) {
      errors.push('Template must include an opt-out button (action_tag: BLACKLIST_OPTOUT)');
    }

    if (template.placeholders) {
      const placeholderNames = template.placeholders.map(p => p.name);
      const duplicates = placeholderNames.filter((name, index) => placeholderNames.indexOf(name) !== index);
      if (duplicates.length > 0) {
        errors.push(`Duplicate placeholders: ${[...new Set(duplicates)].join(', ')}`);
      }

      const bodyPlaceholders = (template.body || '').match(/\{\{([a-z_]+)\}\}/gi) || [];
      const bodyPlaceholderNames = bodyPlaceholders.map(p => p.replace(/[{}]/g, ''));

      bodyPlaceholderNames.forEach(name => {
        if (!placeholderNames.includes(name)) {
          errors.push(`Placeholder {{${name}}} used in body but not defined in placeholders array`);
        }
      });

      template.placeholders.forEach(p => {
        if (!p.name || !p.description) {
          errors.push(`Placeholder missing name or description: ${JSON.stringify(p)}`);
        }
      });
    }

    if (!template.best_for || typeof template.best_for !== 'string') {
      errors.push('best_for description is recommended');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings: this._getValidationWarnings(template)
    };
  }

  _getValidationWarnings(template) {
    const warnings = [];

    if (!template.cultural_notes) {
      warnings.push('No cultural notes provided - consider adding region-specific guidance');
    }

    if (!template.compliance_notes) {
      warnings.push('No compliance notes provided - WhatsApp policies may apply');
    }

    if (template.body && template.body.length > 800) {
      warnings.push('Template body is quite long - consider shorter alternatives for better engagement');
    }

    if (template.body) {
      const placeholderCount = (template.body.match(/\{\{[a-z_]+\}\}/gi) || []).length;
      if (placeholderCount > 5) {
        warnings.push('Template has many placeholders - personalization may feel forced');
      }
    }

    return warnings;
  }

  trackUsage(templateId, contactId, metadata = {}) {
    this.usageHistory.push({
      templateId,
      contactId,
      timestamp: Date.now(),
      ...metadata
    });

    if (this.usageHistory.length > 1000) {
      this.usageHistory = this.usageHistory.slice(-1000);
    }
  }

  setFrequencyCap(contactId, templateId, maxUses, windowMs) {
    this.frequencyCaps.set(`${contactId}:${templateId}`, {
      maxUses,
      windowMs,
      setAt: Date.now()
    });
  }

  addToSuppressionList(contactId) {
    this.suppressionList.add(contactId);
  }

  removeFromSuppressionList(contactId) {
    this.suppressionList.delete(contactId);
  }

  isSuppressed(contactId) {
    return this.suppressionList.has(contactId);
  }

  async exportTemplates() {
    if (!this._initialized) await this.init();
    return JSON.stringify(this.templates, null, 2);
  }

  async importTemplates(jsonString) {
    const imported = JSON.parse(jsonString);
    if (!Array.isArray(imported)) throw new Error('Invalid template format');

    let added = 0;
    let updated = 0;

    for (const template of imported) {
      const validation = this.validateTemplate(template);
      if (!validation.valid) continue;

      const existingIndex = this.templates.findIndex(t => t.id === template.id);
      if (existingIndex >= 0) {
        this.templates[existingIndex] = { ...this.templates[existingIndex], ...template, updated_at: new Date().toISOString() };
        updated++;
      } else {
        if (!template.id) template.id = uuidv4();
        template.created_at = new Date().toISOString();
        template.updated_at = new Date().toISOString();
        this.templates.push(template);
        added++;
      }
    }

    await this.saveTemplates(this.templates);
    return { added, updated, total: this.templates.length };
  }

  getUsageStats() {
    const stats = {
      totalTemplates: this.templates.length,
      categories: {},
      mostUsed: [],
      leastUsed: [],
      recentlyUsed: []
    };

    this.templates.forEach(t => {
      if (!stats.categories[t.category]) {
        stats.categories[t.category] = 0;
      }
      stats.categories[t.category]++;
    });

    const usageCounts = {};
    this.usageHistory.forEach(u => {
      usageCounts[u.templateId] = (usageCounts[u.templateId] || 0) + 1;
    });

    const sortedByUsage = Object.entries(usageCounts)
      .sort((a, b) => b[1] - a[1]);

    stats.mostUsed = sortedByUsage.slice(0, 5).map(([id, count]) => ({
      template: this.templates.find(t => t.id === id),
      count
    })).filter(m => m.template);

    stats.leastUsed = sortedByUsage.slice(-5).map(([id, count]) => ({
      template: this.templates.find(t => t.id === id),
      count
    })).filter(m => m.template);

    const recentThreshold = Date.now() - 604800000;
    stats.recentlyUsed = this.usageHistory
      .filter(u => u.timestamp > recentThreshold)
      .sort((a, b) => b.timestamp - a.timestamp)
      .slice(0, 10)
      .map(u => ({
        template: this.templates.find(t => t.id === u.templateId),
        contactId: u.contactId,
        timestamp: new Date(u.timestamp).toISOString()
      }))
      .filter(r => r.template);

    return stats;
  }
}

module.exports = TemplateManager;
