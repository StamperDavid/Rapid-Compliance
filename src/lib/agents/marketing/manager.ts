// STATUS: SHELL - INCOMPLETE LOGIC
// Marketing Manager - Coordinates social media and SEO specialists
// TODO: Implement actual delegation and campaign coordination

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';

const MARKETING_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'MARKETING_MANAGER',
    name: 'Marketing Manager',
    role: 'manager',
    status: 'SHELL',
    reportsTo: 'JASPER',
    capabilities: [
      'social_media_coordination',
      'seo_oversight',
      'campaign_planning',
      'content_distribution',
    ],
  },
  systemPrompt: `You are the Marketing Manager, responsible for coordinating all marketing efforts.
Your specialists:
- TIKTOK_EXPERT: TikTok content and trends
- X_EXPERT: Twitter/X engagement
- FACEBOOK_EXPERT: Facebook ads and pages
- LINKEDIN_EXPERT: B2B and professional content
- SEO_EXPERT: Search engine optimization

Coordinate multi-platform campaigns and ensure consistent brand messaging.`,
  tools: ['delegate', 'schedule', 'analyze_performance'],
  outputSchema: {},
  maxTokens: 4096,
  temperature: 0.4,
  specialists: ['TIKTOK_EXPERT', 'X_EXPERT', 'FACEBOOK_EXPERT', 'LINKEDIN_EXPERT', 'SEO_EXPERT'],
  delegationRules: [
    {
      triggerKeywords: ['tiktok', 'short video', 'viral', 'trends'],
      delegateTo: 'TIKTOK_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['twitter', 'tweet', 'x post', 'thread'],
      delegateTo: 'X_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['facebook', 'fb ads', 'meta ads', 'facebook page'],
      delegateTo: 'FACEBOOK_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['linkedin', 'b2b', 'professional', 'thought leadership'],
      delegateTo: 'LINKEDIN_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['seo', 'search engine', 'keywords', 'ranking', 'serp'],
      delegateTo: 'SEO_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

export class MarketingManager extends BaseManager {
  constructor() {
    super(MARKETING_MANAGER_CONFIG);
  }

  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Marketing Manager...');
    this.isInitialized = true;
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    // STATUS: SHELL - Cannot actually coordinate campaigns
    return this.createReport(
      message.id,
      'BLOCKED',
      { reason: 'MARKETING_MANAGER_IS_SHELL' },
      ['Marketing Manager cannot execute - all specialists are GHOST']
    );
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    return this.createReport(
      signal.id,
      'BLOCKED',
      { reason: 'Signal handling not implemented' }
    );
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return false;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 0, boilerplate: 85 };
  }
}
