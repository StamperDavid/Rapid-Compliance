/**
 * AI Chat Sales Agent Specialist
 * STATUS: FUNCTIONAL
 *
 * Standalone customer-facing sales agent for website chat widgets and
 * Facebook Messenger. Converts visitors into free trial signups for
 * SalesVelocity.ai (multi-tenant SaaS).
 *
 * Uses its own Golden Master (separate from Jasper) to prevent drift.
 * The client can rename this agent from settings — it's their brand's face.
 *
 * CAPABILITIES:
 * - Handle public chat conversations (website widget + Facebook Messenger)
 * - Qualify leads (budget, need, timeline, authority)
 * - Answer product questions about SalesVelocity.ai
 * - Guide prospects to start free trials
 * - Schedule demos for enterprise prospects
 * - Handle common objections
 *
 * @module agents/sales-chat/specialist
 */

import { BaseSpecialist } from '../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../types';
import {
  getMemoryVault,
  shareInsight,
} from '../shared/memory-vault';

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are the AI Chat Sales Agent for SalesVelocity.ai — a multi-tenant SaaS platform that gives every subscriber their own AI-powered sales, marketing, and operations command center.

## YOUR ROLE
You are the customer-facing sales agent deployed on the website chat widget and Facebook Messenger. Your job is to convert visitors into free trial signups by understanding their needs and demonstrating how SalesVelocity.ai solves their problems.

## WHAT YOU ARE SELLING
SalesVelocity.ai is a multi-tenant SaaS product. Each subscriber gets their own fully isolated deployment with:
- A 52-agent AI swarm (marketing, sales, content, SEO, social, analytics, reputation management)
- AI-powered website builder with funnel optimization
- Omni-channel outreach (email, SMS, social media, voice AI)
- E-commerce with Stripe integration
- Real-time analytics and business intelligence
- White-label capabilities for agencies

This is NOT a service — subscribers own their platform instance and can configure, customize, and scale it themselves.

## PRICING
- Free Trial: 14 days, full access, no credit card required
- Starter: $99/mo — Up to 1,000 AI conversations/month, core agent swarm
- Professional: $299/mo — Up to 5,000 conversations/month, full swarm + voice AI
- Enterprise: Custom — Unlimited conversations, white-label, dedicated support, SLA
- Annual plans: 20% discount

## TASK TYPES
- QUALIFY_LEAD: Assess budget, need, timeline, and decision-making authority
- ANSWER_PRODUCT_QUESTION: Respond to questions about features, pricing, integrations
- GUIDE_TO_TRIAL: Walk interested prospects through starting a free trial
- SCHEDULE_DEMO: Book a demo for enterprise or complex prospects
- HANDLE_OBJECTION: Address price, trust, complexity, or competitor concerns

## QUALIFICATION FRAMEWORK (BANT)
- Budget: Can they afford $99-$299/mo? Or do they need enterprise?
- Authority: Are they the decision-maker or an influencer?
- Need: What specific problem are they trying to solve?
- Timeline: How soon do they need a solution?

## OBJECTION HANDLING
- Price: "The average SalesVelocity subscriber replaces 3-4 separate tools. The ROI is usually clear within the first week of the trial."
- Trust/AI accuracy: "Every agent is trained on your specific business context. Plus, you have full control over escalation rules — the AI only handles what you want it to."
- Complexity: "Setup takes about 15 minutes. The onboarding wizard walks you through everything, and your AI assistant Jasper helps you configure the rest."
- Competitor: "Most alternatives give you a chatbot. SalesVelocity gives you a 52-agent workforce that handles marketing, sales, content, SEO, and analytics — all in one platform."

## VOICE & TONE
- Professional but approachable — like a knowledgeable colleague, not a salesperson
- Solution-focused: understand their needs first, then recommend
- Concise: 2-3 sentences ideal, expand only when the prospect asks for detail
- Never pushy — focus on value, not pressure
- Always end with a clear next step`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const SALES_CHAT_CONFIG: SpecialistConfig = {
  identity: {
    id: 'AI_CHAT_SALES_AGENT',
    name: 'AI Chat Sales Agent',
    role: 'standalone',
    status: 'FUNCTIONAL',
    reportsTo: null,
    capabilities: [
      'lead_qualification',
      'product_questions',
      'trial_guidance',
      'demo_scheduling',
      'objection_handling',
      'facebook_messenger',
      'website_chat',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['qualify_lead', 'answer_question', 'schedule_demo', 'guide_trial'],
  outputSchema: {
    type: 'object',
    properties: {
      response: { type: 'string' },
      leadScore: { type: 'number' },
      qualificationStatus: { type: 'string' },
      nextAction: { type: 'string' },
    },
  },
  maxTokens: 2048,
  temperature: 0.7,
};

// ============================================================================
// TYPES
// ============================================================================

type SalesTaskType =
  | 'QUALIFY_LEAD'
  | 'ANSWER_PRODUCT_QUESTION'
  | 'GUIDE_TO_TRIAL'
  | 'SCHEDULE_DEMO'
  | 'HANDLE_OBJECTION';

interface LeadQualification {
  hasBudget: boolean;
  hasNeed: boolean;
  hasTimeline: boolean;
  isDecisionMaker: boolean;
  score: number; // 0-100
  status: 'cold' | 'warm' | 'hot' | 'qualified';
  notes: string[];
}

interface SalesConversationContext {
  taskType: SalesTaskType;
  channel: 'website' | 'facebook_messenger';
  visitorId: string;
  qualification: LeadQualification;
  conversationTurns: number;
  topicsDiscussed: string[];
  objectionsFaced: string[];
}

// ============================================================================
// SPECIALIST CLASS
// ============================================================================

export class SalesChatSpecialist extends BaseSpecialist {
  private activeContexts: Map<string, SalesConversationContext> = new Map();

  constructor() {
    super(SALES_CHAT_CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    if (this.isInitialized) { return; }
    this.log('INFO', 'AI Chat Sales Agent initializing...');
    this.isInitialized = true;
    this.log('INFO', 'AI Chat Sales Agent ready');
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 300, boilerplate: 80 };
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const startTime = Date.now();
    const payload = message.payload as {
      taskType?: SalesTaskType;
      channel?: 'website' | 'facebook_messenger';
      visitorId?: string;
      userMessage?: string;
    };

    const taskType = payload.taskType ?? this.classifyIntent(payload.userMessage ?? '');
    const channel = payload.channel ?? 'website';
    const visitorId = payload.visitorId ?? message.from;

    // Get or create conversation context
    let context = this.activeContexts.get(visitorId);
    if (!context) {
      context = this.createContext(taskType, channel, visitorId);
      this.activeContexts.set(visitorId, context);
    }
    context.conversationTurns += 1;
    context.taskType = taskType;

    let result: Record<string, unknown>;

    switch (taskType) {
      case 'QUALIFY_LEAD':
        result = await this.qualifyLead(context, payload.userMessage ?? '');
        break;
      case 'ANSWER_PRODUCT_QUESTION':
        result = await this.answerProductQuestion(context, payload.userMessage ?? '');
        break;
      case 'GUIDE_TO_TRIAL':
        result = await this.guideToTrial(context);
        break;
      case 'SCHEDULE_DEMO':
        result = await this.scheduleDemo(context, payload.userMessage ?? '');
        break;
      case 'HANDLE_OBJECTION':
        result = await this.handleObjection(context, payload.userMessage ?? '');
        break;
      default:
        result = await this.answerProductQuestion(context, payload.userMessage ?? '');
    }

    const duration = Date.now() - startTime;
    this.log('INFO', `Sales task ${taskType} completed in ${duration}ms (visitor: ${visitorId})`);

    return this.createReport(message.id, 'COMPLETED', {
      taskType,
      channel,
      visitorId,
      qualification: context.qualification,
      ...result,
      durationMs: duration,
    });
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const payload = signal.payload;
    this.log('INFO', `Received signal from ${signal.origin}: ${payload.type}`);

    if (payload.type === 'QUERY' && typeof payload.payload === 'object') {
      return this.execute(payload);
    }

    return this.createReport(signal.id, 'COMPLETED', {
      action: 'signal_acknowledged',
      signalType: payload.type,
    });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  // ==========================================================================
  // TASK HANDLERS
  // ==========================================================================

  private async qualifyLead(
    context: SalesConversationContext,
    userMessage: string
  ): Promise<Record<string, unknown>> {
    await Promise.resolve();
    const lowerMessage = userMessage.toLowerCase();
    const qualification = context.qualification;

    // Budget signals
    if (/budget|afford|cost|price|invest|spend/.test(lowerMessage)) {
      if (/yes|can|have|ready|ok|sure/.test(lowerMessage)) {
        qualification.hasBudget = true;
      }
      context.topicsDiscussed.push('budget');
    }

    // Need signals
    if (/need|problem|challenge|struggling|looking for|want to/.test(lowerMessage)) {
      qualification.hasNeed = true;
      context.topicsDiscussed.push('need');
    }

    // Timeline signals
    if (/asap|soon|this month|this week|immediately|urgent|quick/.test(lowerMessage)) {
      qualification.hasTimeline = true;
      context.topicsDiscussed.push('timeline');
    }

    // Decision-maker signals
    if (/owner|founder|ceo|cto|decide|my company|i run|my business/.test(lowerMessage)) {
      qualification.isDecisionMaker = true;
      context.topicsDiscussed.push('authority');
    }

    // Calculate score
    let score = 0;
    if (qualification.hasBudget) { score += 25; }
    if (qualification.hasNeed) { score += 30; }
    if (qualification.hasTimeline) { score += 25; }
    if (qualification.isDecisionMaker) { score += 20; }
    qualification.score = score;

    // Determine status
    if (score >= 75) {
      qualification.status = 'qualified';
    } else if (score >= 50) {
      qualification.status = 'hot';
    } else if (score >= 25) {
      qualification.status = 'warm';
    } else {
      qualification.status = 'cold';
    }

    // Write to MemoryVault for cross-agent visibility
    const vault = getMemoryVault();
    vault.write('PERFORMANCE', `lead_${context.visitorId}`, {
      qualification,
      channel: context.channel,
      conversationTurns: context.conversationTurns,
      lastActivity: new Date().toISOString(),
    }, 'AI_CHAT_SALES_AGENT', {
      tags: ['lead-qualification', context.channel],
      priority: qualification.status === 'qualified' ? 'HIGH' : 'MEDIUM',
    });

    return {
      qualification,
      nextQuestion: this.getNextQualificationQuestion(qualification),
    };
  }

  private async answerProductQuestion(
    context: SalesConversationContext,
    userMessage: string
  ): Promise<Record<string, unknown>> {
    const lowerMessage = userMessage.toLowerCase();
    const topics: string[] = [];

    if (/price|cost|plan|pricing|subscription/.test(lowerMessage)) {
      topics.push('pricing');
    }
    if (/feature|what can|capabilities|agent|swarm/.test(lowerMessage)) {
      topics.push('features');
    }
    if (/integrat|connect|stripe|api|webhook/.test(lowerMessage)) {
      topics.push('integrations');
    }
    if (/security|soc|gdpr|compliance|data/.test(lowerMessage)) {
      topics.push('security');
    }
    if (/white.?label|agency|resell/.test(lowerMessage)) {
      topics.push('white-label');
    }

    context.topicsDiscussed.push(...topics);

    // Read product knowledge from MemoryVault if available
    const vault = getMemoryVault();
    const productKnowledge = await vault.query('AI_CHAT_SALES_AGENT', {
      category: 'CONTENT',
      limit: 5,
    });

    return {
      topicsIdentified: topics,
      knowledgeSourcesUsed: productKnowledge.length,
      suggestedFollowUp: topics.includes('pricing') ? 'trial_guidance' : 'qualification',
    };
  }

  private async guideToTrial(
    context: SalesConversationContext
  ): Promise<Record<string, unknown>> {
    context.topicsDiscussed.push('trial_signup');

    // Share conversion signal
    await shareInsight(
      'AI_CHAT_SALES_AGENT',
      'PERFORMANCE',
      'Trial Interest Detected',
      `Visitor ${context.visitorId} expressed interest in free trial via ${context.channel}`,
      { confidence: 85, tags: ['trial-intent', context.channel] }
    );

    return {
      action: 'guide_to_trial',
      trialUrl: `/signup?ref=chat&channel=${context.channel}`,
      qualificationScore: context.qualification.score,
    };
  }

  private async scheduleDemo(
    context: SalesConversationContext,
    _userMessage: string
  ): Promise<Record<string, unknown>> {
    context.topicsDiscussed.push('demo_request');

    // Share high-priority conversion signal
    await shareInsight(
      'AI_CHAT_SALES_AGENT',
      'PERFORMANCE',
      'Demo Requested',
      `Enterprise prospect ${context.visitorId} requested a demo via ${context.channel}`,
      { confidence: 95, tags: ['demo-request', context.channel] }
    );

    return {
      action: 'schedule_demo',
      calendlyUrl: `/demo?ref=chat&channel=${context.channel}`,
      isEnterprise: context.qualification.score >= 75,
    };
  }

  private async handleObjection(
    context: SalesConversationContext,
    userMessage: string
  ): Promise<Record<string, unknown>> {
    await Promise.resolve();
    const lowerMessage = userMessage.toLowerCase();
    let objectionType = 'general';

    if (/expensive|too much|cost|price|afford|budget/.test(lowerMessage)) {
      objectionType = 'price';
    } else if (/trust|accurate|reliable|ai.*wrong|hallucin/.test(lowerMessage)) {
      objectionType = 'trust';
    } else if (/complex|hard|difficult|time|setup|learn/.test(lowerMessage)) {
      objectionType = 'complexity';
    } else if (/competitor|alternative|hubspot|salesforce|drift/.test(lowerMessage)) {
      objectionType = 'competitor';
    }

    context.objectionsFaced.push(objectionType);

    return {
      objectionType,
      handled: true,
      suggestedFollowUp: objectionType === 'price' ? 'trial_guidance' : 'qualification',
    };
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private classifyIntent(message: string): SalesTaskType {
    const lower = message.toLowerCase();

    if (/demo|meeting|call|schedule|book/.test(lower)) { return 'SCHEDULE_DEMO'; }
    if (/trial|sign.?up|start|try|free/.test(lower)) { return 'GUIDE_TO_TRIAL'; }
    if (/expensive|concern|but|worry|trust|complex/.test(lower)) { return 'HANDLE_OBJECTION'; }
    if (/price|feature|how|what|integrat|can you/.test(lower)) { return 'ANSWER_PRODUCT_QUESTION'; }
    return 'QUALIFY_LEAD';
  }

  private createContext(
    taskType: SalesTaskType,
    channel: 'website' | 'facebook_messenger',
    visitorId: string
  ): SalesConversationContext {
    return {
      taskType,
      channel,
      visitorId,
      qualification: {
        hasBudget: false,
        hasNeed: false,
        hasTimeline: false,
        isDecisionMaker: false,
        score: 0,
        status: 'cold',
        notes: [],
      },
      conversationTurns: 0,
      topicsDiscussed: [],
      objectionsFaced: [],
    };
  }

  private getNextQualificationQuestion(qualification: LeadQualification): string {
    if (!qualification.hasNeed) {
      return 'What specific challenge are you trying to solve with AI?';
    }
    if (!qualification.hasBudget) {
      return 'Have you set aside a budget for sales automation tools?';
    }
    if (!qualification.hasTimeline) {
      return 'When are you looking to get started?';
    }
    if (!qualification.isDecisionMaker) {
      return 'Are you the one making the decision on new tools for your team?';
    }
    return 'Based on what you have shared, I think our Professional plan would be a great fit. Want to start a free trial?';
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: SalesChatSpecialist | null = null;

export function getSalesChatSpecialist(): SalesChatSpecialist {
  instance ??= new SalesChatSpecialist();
  return instance;
}
