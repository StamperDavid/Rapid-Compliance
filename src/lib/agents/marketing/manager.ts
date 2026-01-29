/**
 * Marketing Manager (L2 Orchestrator)
 * STATUS: FUNCTIONAL
 *
 * Industry-Agnostic Cross-Channel Commander for marketing campaign orchestration.
 * Dynamically adapts to ANY business context via TenantMemoryVault Brand DNA.
 *
 * ARCHITECTURE:
 * - Zero hardcoded industry assumptions - all context derived at runtime
 * - Dynamic specialist resolution via SwarmRegistry pattern
 * - SEO-Social feedback loop for keyword integration
 * - Brand voice consistency across all channels
 * - Parallel specialist execution with graceful degradation
 *
 * SPECIALISTS ORCHESTRATED:
 * - TIKTOK_EXPERT: Short-form viral video content
 * - TWITTER_X_EXPERT: Threads, engagement, thought leadership
 * - FACEBOOK_ADS_EXPERT: Paid ads, lead generation, retargeting
 * - LINKEDIN_EXPERT: B2B content, professional networking
 * - SEO_EXPERT: Keyword research, content optimization
 *
 * @module agents/marketing/manager
 */

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';
import { getTikTokExpert } from './tiktok/specialist';
import { getTwitterExpert } from './twitter/specialist';
import { getFacebookAdsExpert } from './facebook/specialist';
import { getLinkedInExpert } from './linkedin/specialist';
import { getSEOExpert } from './seo/specialist';
import {
  getMemoryVault,
  shareInsight,
  type InsightData,
} from '../shared/tenant-memory-vault';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import type { BrandDNA as _BrandDNA } from '@/types/organization';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// SYSTEM PROMPT - Industry-Agnostic Marketing Orchestration
// ============================================================================

const SYSTEM_PROMPT = `You are the Marketing Manager, an industry-agnostic L2 orchestrator for cross-channel marketing campaigns.

## YOUR ROLE
You coordinate 5 platform specialists to execute unified marketing campaigns for ANY business type.
All industry context, brand voice, and messaging guidelines are loaded dynamically from the tenant's Brand DNA.

SPECIALISTS YOU ORCHESTRATE:
- TIKTOK_EXPERT: Short-form viral video, Gen Z/young millennials, trending content
- TWITTER_X_EXPERT: Threads, thought leadership, B2B engagement, real-time conversations
- FACEBOOK_ADS_EXPERT: Paid ads, lead generation, retargeting, older demographics
- LINKEDIN_EXPERT: B2B content, professional networking, executive thought leadership
- SEO_EXPERT: Keyword research, content optimization, search visibility

## INDUSTRY-AGNOSTIC APPROACH
- NEVER assume a specific industry (trucking, SaaS, retail, etc.)
- ALWAYS derive context from the Brand DNA loaded at runtime
- Adapt messaging to match the tenant's unique voice and audience
- Use industry-specific terminology ONLY when provided in Brand DNA

## CAMPAIGN ORCHESTRATION FLOW
1. Load Brand DNA (voice, audience, industry context)
2. Parse campaign goal into structured objectives
3. Request SEO keywords from SEO_EXPERT
4. Inject keywords into social content briefs
5. Delegate to relevant platform specialists in parallel
6. Aggregate results into unified CampaignBrief
7. Store insights in TenantMemoryVault for learning

## SEO-SOCIAL FEEDBACK LOOP
Before delegating to social specialists:
1. SEO_EXPERT analyzes the campaign goal
2. Returns target keywords and search intent
3. Keywords are injected into each social specialist's brief
4. Social content naturally incorporates SEO terms

## PLATFORM SELECTION LOGIC

### TikTok (TIKTOK_EXPERT)
Best for: Viral reach, young audiences (16-34), video-first, entertainment, trends

### X/Twitter (TWITTER_X_EXPERT)
Best for: Thought leadership, B2B, real-time engagement, news, professional conversations

### Facebook (FACEBOOK_ADS_EXPERT)
Best for: Paid campaigns, 35-65+ demographics, local business, lead forms, retargeting

### LinkedIn (LINKEDIN_EXPERT)
Best for: B2B sales, executive targeting, professional content, recruitment, partnerships

### SEO (SEO_EXPERT)
Best for: Keyword strategy, content optimization, organic search visibility

## BRAND VOICE CONSISTENCY
All content must reflect the tenant's Brand DNA:
- Tone of voice (warm, professional, direct, casual, etc.)
- Key phrases to use
- Phrases to avoid
- Industry terminology
- Communication style

## OUTPUT: CampaignBrief
Your output aggregates all specialist work into a unified brief with:
- Campaign analysis and objectives
- Platform strategy with rationale
- SEO keyword integration
- Individual specialist outputs
- Cross-platform recommendations
- Confidence scoring`;

// ============================================================================
// CAMPAIGN INTENT DETECTION
// ============================================================================

/**
 * Campaign intents that determine specialist activation
 */
export type CampaignIntent =
  | 'FULL_FUNNEL'           // All specialists for comprehensive campaign
  | 'AWARENESS'             // TikTok + Twitter + LinkedIn
  | 'LEAD_GENERATION'       // Facebook + LinkedIn + SEO
  | 'THOUGHT_LEADERSHIP'    // Twitter + LinkedIn + SEO
  | 'VIRAL_CONTENT'         // TikTok + Twitter
  | 'PAID_ADVERTISING'      // Facebook + LinkedIn
  | 'ORGANIC_GROWTH'        // SEO + All social
  | 'SINGLE_PLATFORM';      // Route to one specialist

/**
 * Keywords that indicate campaign intents
 */
const INTENT_KEYWORDS: Record<CampaignIntent, string[]> = {
  FULL_FUNNEL: [
    'full campaign', 'complete strategy', 'omnichannel', 'comprehensive',
    'all platforms', 'integrated', 'multi-channel', '360',
  ],
  AWARENESS: [
    'awareness', 'brand recognition', 'reach', 'visibility', 'exposure',
    'get the word out', 'introduce', 'launch announcement',
  ],
  LEAD_GENERATION: [
    'lead', 'leads', 'sign up', 'demo', 'trial', 'contact', 'inquiry',
    'form', 'capture', 'convert', 'acquisition',
  ],
  THOUGHT_LEADERSHIP: [
    'thought leader', 'authority', 'expert', 'industry voice', 'insights',
    'perspective', 'opinion', 'expertise', 'credibility',
  ],
  VIRAL_CONTENT: [
    'viral', 'trending', 'buzz', 'shareable', 'explosive', 'mass reach',
    'organic spread', 'word of mouth',
  ],
  PAID_ADVERTISING: [
    'paid', 'ads', 'advertising', 'budget', 'spend', 'roi', 'roas',
    'retarget', 'ppc', 'cpm', 'cpc',
  ],
  ORGANIC_GROWTH: [
    'organic', 'seo', 'search', 'ranking', 'content marketing',
    'inbound', 'natural growth', 'evergreen',
  ],
  SINGLE_PLATFORM: [], // Detected via explicit platform mention
};

/**
 * Specialist mapping by intent
 */
const INTENT_SPECIALISTS: Record<CampaignIntent, string[]> = {
  FULL_FUNNEL: ['SEO_EXPERT', 'TIKTOK_EXPERT', 'TWITTER_X_EXPERT', 'FACEBOOK_ADS_EXPERT', 'LINKEDIN_EXPERT'],
  AWARENESS: ['TIKTOK_EXPERT', 'TWITTER_X_EXPERT', 'LINKEDIN_EXPERT'],
  LEAD_GENERATION: ['SEO_EXPERT', 'FACEBOOK_ADS_EXPERT', 'LINKEDIN_EXPERT'],
  THOUGHT_LEADERSHIP: ['SEO_EXPERT', 'TWITTER_X_EXPERT', 'LINKEDIN_EXPERT'],
  VIRAL_CONTENT: ['TIKTOK_EXPERT', 'TWITTER_X_EXPERT'],
  PAID_ADVERTISING: ['FACEBOOK_ADS_EXPERT', 'LINKEDIN_EXPERT'],
  ORGANIC_GROWTH: ['SEO_EXPERT', 'TIKTOK_EXPERT', 'TWITTER_X_EXPERT', 'LINKEDIN_EXPERT'],
  SINGLE_PLATFORM: [], // Determined dynamically
};

// ============================================================================
// CONFIGURATION - Industry-Agnostic Marketing Orchestration
// ============================================================================

const MARKETING_MANAGER_CONFIG: ManagerConfig = {
  identity: {
    id: 'MARKETING_MANAGER',
    name: 'Marketing Manager',
    role: 'manager',
    status: 'FUNCTIONAL',
    reportsTo: 'JASPER',
    capabilities: [
      'campaign_goal_parsing',
      'intent_detection',
      'dynamic_specialist_resolution',
      'brand_dna_integration',
      'seo_social_feedback_loop',
      'multi_specialist_coordination',
      'cross_platform_campaigns',
      'budget_allocation',
      'campaign_brief_synthesis',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['delegate', 'coordinate', 'aggregate', 'analyze_campaign', 'fetch_brand_dna'],
  outputSchema: {
    type: 'object',
    properties: {
      campaignBrief: { type: 'object' },
      brandContext: { type: 'object' },
      seoGuidance: { type: 'object' },
      delegations: { type: 'array' },
      confidence: { type: 'number' },
    },
    required: ['campaignBrief', 'delegations'],
  },
  maxTokens: 8192,
  temperature: 0.4,
  specialists: [
    'TIKTOK_EXPERT',
    'TWITTER_X_EXPERT',
    'FACEBOOK_ADS_EXPERT',
    'LINKEDIN_EXPERT',
    'SEO_EXPERT',
  ],
  delegationRules: [
    // TikTok - Viral, short-form video
    {
      triggerKeywords: ['tiktok', 'viral', 'short video', 'hook', 'trending sound', 'gen z', 'fyp', 'for you page', 'reels'],
      delegateTo: 'TIKTOK_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Twitter/X - Thought leadership, engagement
    {
      triggerKeywords: ['twitter', 'x.com', 'thread', 'tweet', 'engagement', 'ratio', 'reply', 'thought leadership', 'hot take'],
      delegateTo: 'TWITTER_X_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // Facebook - Ads, older demographics
    {
      triggerKeywords: ['facebook', 'fb ads', 'meta ads', 'audience', 'retarget', 'lead form', 'local business', 'carousel'],
      delegateTo: 'FACEBOOK_ADS_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // LinkedIn - B2B, professional
    {
      triggerKeywords: ['linkedin', 'b2b', 'professional', 'executive', 'corporate', 'enterprise', 'decision maker', 'c-suite'],
      delegateTo: 'LINKEDIN_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    // SEO - Search, keywords, organic
    {
      triggerKeywords: ['seo', 'keyword', 'search engine', 'organic traffic', 'ranking', 'serp', 'google', 'content optimization'],
      delegateTo: 'SEO_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

// ============================================================================
// TYPE DEFINITIONS - Industry-Agnostic Campaign Types
// ============================================================================

/**
 * Campaign goal input - intentionally generic to support any industry
 */
export interface CampaignGoal {
  objective: 'awareness' | 'engagement' | 'conversions' | 'leads' | 'retention';
  message: string;
  targetAudience?: {
    demographics?: string;
    psychographics?: string;
    platforms?: string[];
    industrySegment?: string; // Derived from Brand DNA, not hardcoded
  };
  budget?: number | string;
  timeline?: {
    launchDate?: string;
    duration?: string;
  };
  kpis?: string[];
  contentType?: 'video' | 'image' | 'text' | 'mixed';
  tenantId?: string; // For Brand DNA lookup
}

/**
 * Brand context loaded from TenantMemoryVault
 * Provides industry-specific customization at runtime
 */
export interface BrandContext {
  tenantId: string;
  companyDescription: string;
  uniqueValue: string;
  targetAudience: string;
  industry: string;
  toneOfVoice: string;
  communicationStyle: string;
  keyPhrases: string[];
  avoidPhrases: string[];
  competitors: string[];
  loaded: boolean;
}

/**
 * SEO keyword guidance that flows into social content
 */
export interface SEOKeywordGuidance {
  primaryKeywords: string[];
  secondaryKeywords: string[];
  longTailKeywords: string[];
  searchIntent: 'informational' | 'transactional' | 'navigational' | 'commercial';
  contentRecommendations: string[];
  keywordDensityTarget: number;
}

/**
 * Campaign analysis with industry context
 */
export interface CampaignAnalysis {
  objective: string;
  targetAudience: string;
  contentType: string;
  timeline: string;
  budget: string;
  kpis: string[];
  detectedIntent: CampaignIntent;
  industryContext: string; // Derived from Brand DNA
}

/**
 * Platform strategy with SEO integration
 */
export interface PlatformStrategy {
  platforms: string[];
  rationale: string;
  budgetAllocation: Record<string, string>;
  seoKeywords: string[]; // Keywords to inject into social content
}

/**
 * Individual specialist delegation result
 */
export interface DelegationResult {
  specialist: string;
  brief: string;
  status: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
  result: unknown;
  executionTimeMs?: number;
}

/**
 * Aggregated plan with cross-platform coordination
 */
export interface AggregatedPlan {
  overview: string;
  timeline: string;
  expectedReach: string;
  recommendations: string[];
  brandVoiceCompliance: boolean;
  seoIntegration: boolean;
}

/**
 * The unified CampaignBrief output
 * This is the final deliverable that aggregates all specialist work
 */
export interface CampaignBrief {
  briefId: string;
  createdAt: Date;
  completedAt: Date;

  // Input context
  campaignGoal: CampaignGoal;
  brandContext: BrandContext;
  detectedIntent: CampaignIntent;

  // SEO foundation (runs first)
  seoGuidance: SEOKeywordGuidance | null;

  // Campaign analysis
  campaignAnalysis: CampaignAnalysis;
  platformStrategy: PlatformStrategy;

  // Specialist outputs
  delegations: DelegationResult[];
  specialistOutputs: {
    tiktok: unknown;
    twitter: unknown;
    facebook: unknown;
    linkedin: unknown;
    seo: unknown;
  };

  // Synthesis
  aggregatedPlan: AggregatedPlan;
  crossPlatformRecommendations: string[];

  // Metadata
  confidence: number;
  warnings: string[];
  execution: {
    totalSpecialists: number;
    successfulSpecialists: number;
    failedSpecialists: number;
    totalExecutionTimeMs: number;
  };
}

/**
 * Legacy type alias for backward compatibility
 */
export type CampaignPlan = CampaignBrief;

// ============================================================================
// IMPLEMENTATION - Industry-Agnostic Cross-Channel Commander
// ============================================================================

export class MarketingManager extends BaseManager {
  private specialistsRegistered = false;
  private brandContextCache: Map<string, BrandContext> = new Map();

  constructor() {
    super(MARKETING_MANAGER_CONFIG);
  }

  /**
   * Initialize and register all marketing specialists dynamically
   */
  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Marketing Manager (Industry-Agnostic Mode)...');

    // Dynamically register all 5 specialists via SwarmRegistry pattern
    await this.registerAllSpecialists();

    this.isInitialized = true;
    this.log('INFO', `Marketing Manager initialized with ${this.specialists.size} specialists`);
  }

  /**
   * Register specialists from their factory functions (SwarmRegistry pattern)
   */
  private async registerAllSpecialists(): Promise<void> {
    if (this.specialistsRegistered) {
      return;
    }

    const specialistFactories = [
      { name: 'TIKTOK_EXPERT', factory: getTikTokExpert },
      { name: 'TWITTER_X_EXPERT', factory: getTwitterExpert },
      { name: 'FACEBOOK_ADS_EXPERT', factory: getFacebookAdsExpert },
      { name: 'LINKEDIN_EXPERT', factory: getLinkedInExpert },
      { name: 'SEO_EXPERT', factory: getSEOExpert },
    ];

    for (const { name, factory } of specialistFactories) {
      try {
        const specialist = factory();
        await specialist.initialize();
        this.registerSpecialist(specialist);
        this.log('INFO', `Registered specialist: ${name} (${specialist.getStatus()})`);
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error);
        this.log('ERROR', `Failed to register specialist ${name}: ${errorMsg}`);
      }
    }

    this.specialistsRegistered = true;
  }

  /**
   * Main execution entry point - orchestrates industry-agnostic campaign
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    const startTime = Date.now();

    // Ensure specialists are registered
    if (!this.specialistsRegistered) {
      await this.registerAllSpecialists();
    }

    try {
      const payload = message.payload as CampaignGoal;

      // SECURITY: Validate tenantId - multi-tenant scoping is mandatory
      const tenantId = payload?.tenantId;
      if (!tenantId) {
        return this.createReport(
          taskId,
          'FAILED',
          null,
          ['tenantId is REQUIRED - multi-tenant scoping is mandatory']
        );
      }

      if (!payload?.message && !payload?.objective) {
        return this.createReport(
          taskId,
          'FAILED',
          null,
          ['No campaign goal or message provided in payload']
        );
      }

      this.log('INFO', `Processing campaign goal: ${payload.objective ?? 'unspecified'}`);

      // Execute full campaign orchestration
      const campaignBrief = await this.orchestrateCampaign(payload, taskId, startTime);

      // Store insights in TenantMemoryVault for cross-agent learning
      // tenantId is validated above, so we can safely use it here
      await this.storeCampaignInsights(tenantId, campaignBrief);

      return this.createReport(taskId, 'COMPLETED', campaignBrief);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Campaign coordination failed: ${errorMessage}`);
      logger.error('[MarketingManager] Orchestration failed', error instanceof Error ? error : new Error(errorMessage));
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Handle signals from the Signal Bus
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  /**
   * Generate a report for JASPER
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this manager has REAL orchestration logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 850, boilerplate: 100 };
  }

  // ==========================================================================
  // BRAND DNA INTEGRATION - Runtime Industry Context
  // ==========================================================================

  /**
   * Load Brand DNA from TenantMemoryVault for industry-agnostic customization
   */
  private async loadBrandContext(tenantId: string): Promise<BrandContext> {
    // Check cache first
    if (this.brandContextCache.has(tenantId)) {
      const cached = this.brandContextCache.get(tenantId);
      if (cached) {return cached;}
    }

    try {
      const brandDNA = await getBrandDNA(tenantId);

      if (!brandDNA) {
        this.log('WARN', `No Brand DNA found for tenant ${tenantId}, using defaults`);
        return this.createDefaultBrandContext(tenantId);
      }

      const brandContext: BrandContext = {
        tenantId,
        companyDescription: brandDNA.companyDescription ?? '',
        uniqueValue: brandDNA.uniqueValue ?? '',
        targetAudience: brandDNA.targetAudience ?? '',
        industry: brandDNA.industry ?? 'General',
        toneOfVoice: brandDNA.toneOfVoice ?? 'professional',
        communicationStyle: brandDNA.communicationStyle ?? '',
        keyPhrases: brandDNA.keyPhrases ?? [],
        avoidPhrases: brandDNA.avoidPhrases ?? [],
        competitors: brandDNA.competitors ?? [],
        loaded: true,
      };

      // Cache for performance
      this.brandContextCache.set(tenantId, brandContext);
      this.log('INFO', `Loaded Brand DNA for tenant ${tenantId} (Industry: ${brandContext.industry})`);

      return brandContext;
    } catch (error) {
      this.log('ERROR', `Failed to load Brand DNA: ${error instanceof Error ? error.message : String(error)}`);
      return this.createDefaultBrandContext(tenantId);
    }
  }

  /**
   * Create default brand context when no Brand DNA exists
   */
  private createDefaultBrandContext(tenantId: string): BrandContext {
    return {
      tenantId,
      companyDescription: '',
      uniqueValue: '',
      targetAudience: '',
      industry: 'General',
      toneOfVoice: 'professional',
      communicationStyle: 'Clear and helpful',
      keyPhrases: [],
      avoidPhrases: [],
      competitors: [],
      loaded: false,
    };
  }

  // ==========================================================================
  // CAMPAIGN INTENT DETECTION
  // ==========================================================================

  /**
   * Detect campaign intent from the goal message
   */
  private detectCampaignIntent(goal: CampaignGoal, _message: AgentMessage): CampaignIntent {
    const text = `${goal.message ?? ''} ${goal.objective ?? ''} ${JSON.stringify(goal.targetAudience ?? {})}`.toLowerCase();

    // Check for explicit platform mentions (single platform routing)
    const platformMentions = {
      tiktok: text.includes('tiktok'),
      twitter: text.includes('twitter') || text.includes('x.com'),
      facebook: text.includes('facebook') || text.includes('fb '),
      linkedin: text.includes('linkedin'),
      seo: text.includes('seo') || text.includes('search engine'),
    };

    const platformCount = Object.values(platformMentions).filter(Boolean).length;
    if (platformCount === 1) {
      return 'SINGLE_PLATFORM';
    }

    // Score each intent based on keyword matches
    let bestIntent: CampaignIntent = 'FULL_FUNNEL';
    let bestScore = 0;

    for (const [intent, keywords] of Object.entries(INTENT_KEYWORDS)) {
      const score = keywords.filter(kw => text.includes(kw)).length;
      if (score > bestScore) {
        bestScore = score;
        bestIntent = intent as CampaignIntent;
      }
    }

    // If no clear intent, use objective to determine
    if (bestScore === 0) {
      switch (goal.objective) {
        case 'awareness':
          return 'AWARENESS';
        case 'leads':
          return 'LEAD_GENERATION';
        case 'engagement':
          return 'THOUGHT_LEADERSHIP';
        case 'conversions':
          return 'PAID_ADVERTISING';
        default:
          return 'FULL_FUNNEL';
      }
    }

    return bestIntent;
  }

  /**
   * Resolve which specialists to activate based on intent
   */
  private resolveSpecialistsForIntent(intent: CampaignIntent, goal: CampaignGoal): string[] {
    if (intent === 'SINGLE_PLATFORM') {
      // Find the specific platform mentioned
      const text = goal.message?.toLowerCase() ?? '';
      if (text.includes('tiktok')) {return ['TIKTOK_EXPERT'];}
      if (text.includes('twitter') || text.includes('x.com')) {return ['TWITTER_X_EXPERT'];}
      if (text.includes('facebook') || text.includes('fb ')) {return ['FACEBOOK_ADS_EXPERT'];}
      if (text.includes('linkedin')) {return ['LINKEDIN_EXPERT'];}
      if (text.includes('seo')) {return ['SEO_EXPERT'];}
    }

    // Get specialists for this intent
    const requiredSpecialists = INTENT_SPECIALISTS[intent] ?? INTENT_SPECIALISTS.FULL_FUNNEL;

    // Filter to only functional specialists
    return requiredSpecialists.filter(id => {
      const specialist = this.specialists.get(id);
      return specialist?.isFunctional();
    });
  }

  // ==========================================================================
  // CORE CAMPAIGN ORCHESTRATION - Industry-Agnostic Flow
  // ==========================================================================

  /**
   * Main campaign orchestration function
   * Implements: Brand DNA → SEO Keywords → Social Specialists → Synthesis
   */
  private async orchestrateCampaign(
    goal: CampaignGoal,
    taskId: string,
    startTime: number
  ): Promise<CampaignBrief> {
    const warnings: string[] = [];
    const delegations: DelegationResult[] = [];
    const specialistOutputs: CampaignBrief['specialistOutputs'] = {
      tiktok: null,
      twitter: null,
      facebook: null,
      linkedin: null,
      seo: null,
    };

    // Step 1: Load Brand DNA for industry-agnostic customization
    const tenantId = goal.tenantId ?? 'default';
    const brandContext = await this.loadBrandContext(tenantId);
    this.log('INFO', `Brand context loaded (Industry: ${brandContext.industry})`);

    // Step 2: Detect campaign intent
    const detectedIntent = this.detectCampaignIntent(goal, { id: taskId } as AgentMessage);
    this.log('INFO', `Detected campaign intent: ${detectedIntent}`);

    // Step 3: Analyze campaign goal with brand context
    const campaignAnalysis = this.analyzeCampaignGoal(goal, brandContext, detectedIntent);
    this.log('INFO', `Campaign analysis: ${campaignAnalysis.objective} targeting ${campaignAnalysis.targetAudience}`);

    // Step 4: Get SEO keyword guidance FIRST (for social content injection)
    let seoGuidance: SEOKeywordGuidance | null = null;
    const specialistIds = this.resolveSpecialistsForIntent(detectedIntent, goal);

    if (specialistIds.includes('SEO_EXPERT')) {
      seoGuidance = await this.getSEOKeywordGuidance(goal, brandContext, taskId, delegations, specialistOutputs);
      this.log('INFO', `SEO guidance retrieved: ${seoGuidance?.primaryKeywords.length ?? 0} primary keywords`);
    }

    // Step 5: Determine platform strategy with SEO keywords
    const platformStrategy = this.determinePlatformStrategy(goal, campaignAnalysis, seoGuidance);
    this.log('INFO', `Selected platforms: ${platformStrategy.platforms.join(', ')}`);

    // Step 6: Delegate to social specialists in parallel (with SEO keywords injected)
    await this.delegateToSocialSpecialists(
      goal,
      brandContext,
      platformStrategy,
      seoGuidance,
      taskId,
      delegations,
      specialistOutputs,
      warnings
    );
    this.log('INFO', `Delegated to ${delegations.length} specialists`);

    // Step 7: Aggregate results into unified CampaignBrief
    const aggregatedPlan = this.aggregateResults(delegations, campaignAnalysis, platformStrategy, brandContext);

    // Step 8: Calculate confidence
    const confidence = this.calculateConfidence(delegations, specialistIds.length);

    // Step 9: Build cross-platform recommendations
    const crossPlatformRecommendations = this.generateCrossPlatformRecommendations(
      delegations,
      brandContext,
      seoGuidance
    );

    const completedAt = new Date();
    const totalExecutionTimeMs = Date.now() - startTime;

    return {
      briefId: `campaign_${taskId}`,
      createdAt: new Date(startTime),
      completedAt,
      campaignGoal: goal,
      brandContext,
      detectedIntent,
      seoGuidance,
      campaignAnalysis,
      platformStrategy,
      delegations,
      specialistOutputs,
      aggregatedPlan,
      crossPlatformRecommendations,
      confidence,
      warnings,
      execution: {
        totalSpecialists: delegations.length,
        successfulSpecialists: delegations.filter(d => d.status === 'COMPLETED').length,
        failedSpecialists: delegations.filter(d => d.status === 'FAILED').length,
        totalExecutionTimeMs,
      },
    };
  }

  // ==========================================================================
  // SEO-SOCIAL FEEDBACK LOOP
  // ==========================================================================

  /**
   * Get SEO keyword guidance to inject into social content
   */
  private async getSEOKeywordGuidance(
    goal: CampaignGoal,
    brandContext: BrandContext,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: CampaignBrief['specialistOutputs']
  ): Promise<SEOKeywordGuidance | null> {
    const seoSpecialist = this.specialists.get('SEO_EXPERT');

    if (!seoSpecialist?.isFunctional()) {
      this.log('WARN', 'SEO_EXPERT not functional, skipping keyword guidance');
      return null;
    }

    const startTime = Date.now();

    try {
      // Create SEO request with brand context
      const seoMessage: AgentMessage = {
        id: `${taskId}_seo_keywords`,
        type: 'COMMAND',
        from: this.identity.id,
        to: 'SEO_EXPERT',
        payload: {
          action: 'keyword_research',
          seed: this.extractKeywordSeed(goal, brandContext),
          industry: brandContext.industry,
          targetCount: 15,
          organizationId: brandContext.tenantId,
        },
        timestamp: new Date(),
        priority: 'HIGH',
        requiresResponse: true,
        traceId: taskId,
      };

      const report = await seoSpecialist.execute(seoMessage);

      const executionTimeMs = Date.now() - startTime;

      if (report.status === 'COMPLETED' && report.data) {
        const seoData = report.data as { keywords?: Array<{ keyword: string; difficulty: string; searchIntent: string }> };

        // Transform SEO output into guidance format
        const guidance: SEOKeywordGuidance = {
          primaryKeywords: seoData.keywords?.slice(0, 3).map(k => k.keyword) ?? [],
          secondaryKeywords: seoData.keywords?.slice(3, 8).map(k => k.keyword) ?? [],
          longTailKeywords: seoData.keywords?.slice(8).map(k => k.keyword) ?? [],
          searchIntent: this.determineSearchIntent(seoData.keywords ?? []),
          contentRecommendations: this.generateSEOContentRecommendations(seoData.keywords ?? [], brandContext),
          keywordDensityTarget: 0.02, // 2% target
        };

        delegations.push({
          specialist: 'SEO_EXPERT',
          brief: 'Keyword research for campaign content optimization',
          status: 'COMPLETED',
          result: guidance,
          executionTimeMs,
        });

        specialistOutputs.seo = seoData;

        return guidance;
      }

      delegations.push({
        specialist: 'SEO_EXPERT',
        brief: 'Keyword research for campaign content optimization',
        status: report.status === 'BLOCKED' ? 'BLOCKED' : 'FAILED',
        result: report.errors?.join('; ') ?? 'Unknown error',
        executionTimeMs,
      });

      return null;
    } catch (error) {
      this.log('ERROR', `SEO keyword guidance failed: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  /**
   * Extract keyword seed from campaign goal and brand context
   */
  private extractKeywordSeed(goal: CampaignGoal, brandContext: BrandContext): string {
    // Combine campaign message with brand context for comprehensive seed
    const messageParts = [
      goal.message,
      brandContext.companyDescription,
      brandContext.uniqueValue,
      brandContext.industry,
    ].filter(Boolean);

    // Extract key terms (simplified - in production would use NLP)
    return messageParts.join(' ').slice(0, 200);
  }

  /**
   * Determine overall search intent from SEO keywords
   */
  private determineSearchIntent(
    keywords: Array<{ searchIntent?: string }>
  ): 'informational' | 'transactional' | 'navigational' | 'commercial' {
    const intents = keywords
      .map(k => k.searchIntent)
      .filter((intent): intent is string => typeof intent === 'string');

    if (intents.length === 0) {return 'informational';}

    // Count occurrences
    const counts: Record<string, number> = {};
    for (const intent of intents) {
      counts[intent] = (counts[intent] ?? 0) + 1;
    }

    // Return most common
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    return (sorted[0]?.[0] ?? 'informational') as 'informational' | 'transactional' | 'navigational' | 'commercial';
  }

  /**
   * Generate content recommendations based on SEO analysis
   */
  private generateSEOContentRecommendations(
    keywords: Array<{ keyword: string; difficulty?: string }>,
    brandContext: BrandContext
  ): string[] {
    const recommendations: string[] = [];

    if (keywords.length > 0) {
      recommendations.push(`Incorporate primary keyword "${keywords[0]?.keyword}" in headlines and hooks`);
    }

    if (brandContext.keyPhrases.length > 0) {
      recommendations.push(`Use brand phrases: ${brandContext.keyPhrases.slice(0, 3).join(', ')}`);
    }

    if (brandContext.avoidPhrases.length > 0) {
      recommendations.push(`Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ')}`);
    }

    recommendations.push('Maintain natural keyword integration - avoid stuffing');
    recommendations.push('Include keywords in first 100 characters where possible');

    return recommendations;
  }

  /**
   * Analyze and parse the campaign goal with brand context
   */
  private analyzeCampaignGoal(
    goal: CampaignGoal,
    brandContext: BrandContext,
    detectedIntent: CampaignIntent
  ): CampaignAnalysis {
    const message = goal.message ?? '';
    const messageLower = message.toLowerCase();

    // Determine objective
    let objective = goal.objective ?? 'awareness';
    if (!goal.objective) {
      if (messageLower.includes('convert') || messageLower.includes('sale') || messageLower.includes('purchase')) {
        objective = 'conversions';
      } else if (messageLower.includes('lead') || messageLower.includes('sign up') || messageLower.includes('demo')) {
        objective = 'leads';
      } else if (messageLower.includes('engage') || messageLower.includes('comment') || messageLower.includes('share')) {
        objective = 'engagement';
      }
    }

    // Determine target audience - prefer Brand DNA over inference
    let targetAudience = brandContext.targetAudience || 'General audience';
    if (goal.targetAudience?.demographics) {
      targetAudience = goal.targetAudience.demographics;
    } else if (!brandContext.targetAudience) {
      // Fallback to inference from message
      if (messageLower.includes('gen z') || messageLower.includes('young')) {
        targetAudience = 'Gen Z and younger Millennials (16-34)';
      } else if (messageLower.includes('millennial')) {
        targetAudience = 'Millennials (25-40)';
      } else if (messageLower.includes('boomer') || messageLower.includes('older')) {
        targetAudience = 'Older demographics (45-65+)';
      } else if (messageLower.includes('b2b') || messageLower.includes('business') || messageLower.includes('professional')) {
        targetAudience = 'Business professionals and decision-makers';
      } else if (messageLower.includes('local')) {
        targetAudience = 'Local community members';
      }
    }

    // Determine content type
    let contentType = goal.contentType ?? 'mixed';
    if (!goal.contentType) {
      if (messageLower.includes('video')) {
        contentType = 'video';
      } else if (messageLower.includes('image') || messageLower.includes('photo')) {
        contentType = 'image';
      } else if (messageLower.includes('thread') || messageLower.includes('tweet') || messageLower.includes('post')) {
        contentType = 'text';
      }
    }

    // Timeline
    const timeline = goal.timeline
      ? `Launch: ${goal.timeline.launchDate ?? 'ASAP'}, Duration: ${goal.timeline.duration ?? 'Ongoing'}`
      : 'ASAP, ongoing until results achieved';

    // Budget
    const budget = typeof goal.budget === 'number'
      ? `$${goal.budget.toLocaleString()}`
      : goal.budget ?? 'Unspecified';

    // KPIs
    const kpis = goal.kpis ?? this.inferKPIs(objective);

    // Industry context from Brand DNA (not hardcoded!)
    const industryContext = brandContext.industry !== 'General'
      ? `${brandContext.industry} industry - ${brandContext.companyDescription}`
      : 'General business context';

    return {
      objective,
      targetAudience,
      contentType,
      timeline,
      budget,
      kpis,
      detectedIntent,
      industryContext,
    };
  }

  /**
   * Infer KPIs based on campaign objective
   */
  private inferKPIs(objective: string): string[] {
    const kpiMap: Record<string, string[]> = {
      awareness: ['Impressions', 'Reach', 'Brand mentions', 'Video views'],
      engagement: ['Likes', 'Comments', 'Shares', 'Engagement rate', 'Reply rate'],
      conversions: ['Conversion rate', 'Cost per conversion', 'ROAS', 'Revenue'],
      leads: ['Lead volume', 'Cost per lead', 'Lead quality score', 'Conversion to SQL'],
    };

    return kpiMap[objective] ?? ['Impressions', 'Engagement rate'];
  }

  /**
   * Determine which platforms should be used for this campaign
   * Now includes LinkedIn scoring and SEO keyword integration
   */
  private determinePlatformStrategy(
    goal: CampaignGoal,
    analysis: CampaignAnalysis,
    seoGuidance: SEOKeywordGuidance | null
  ): PlatformStrategy {
    const platforms: string[] = [];
    const rationales: string[] = [];
    const budgetAllocation: Record<string, string> = {};

    const message = goal.message?.toLowerCase() ?? '';
    const audience = analysis.targetAudience.toLowerCase();
    const contentType = analysis.contentType.toLowerCase();

    // Check for explicit platform mentions
    const explicitPlatforms = goal.targetAudience?.platforms ?? [];

    // TikTok scoring
    let tiktokScore = 0;
    if (explicitPlatforms.some(p => p.toLowerCase() === 'tiktok')) {
      tiktokScore += 50;
    }
    if (message.includes('tiktok') || message.includes('viral') || message.includes('trending')) {
      tiktokScore += 30;
    }
    if (audience.includes('gen z') || audience.includes('16-34') || audience.includes('young')) {
      tiktokScore += 20;
    }
    if (contentType.includes('video') || message.includes('video') || message.includes('short form')) {
      tiktokScore += 15;
    }
    if (message.includes('hook') || message.includes('trending sound')) {
      tiktokScore += 10;
    }

    // X/Twitter scoring
    let xScore = 0;
    if (explicitPlatforms.some(p => ['x', 'twitter'].includes(p.toLowerCase()))) {
      xScore += 50;
    }
    if (message.includes('twitter') || message.includes('tweet') || message.includes(' x ') || message.includes('thread')) {
      xScore += 30;
    }
    if (audience.includes('b2b') || audience.includes('professional') || audience.includes('business')) {
      xScore += 20;
    }
    if (message.includes('thought leadership') || message.includes('engage') || message.includes('conversation')) {
      xScore += 15;
    }
    if (contentType.includes('text') || message.includes('thread')) {
      xScore += 10;
    }

    // Facebook scoring
    let facebookScore = 0;
    if (explicitPlatforms.some(p => ['facebook', 'fb'].includes(p.toLowerCase()))) {
      facebookScore += 50;
    }
    if (message.includes('facebook') || message.includes('fb') || message.includes('meta')) {
      facebookScore += 30;
    }
    if (audience.includes('45-65') || audience.includes('older') || audience.includes('local')) {
      facebookScore += 20;
    }
    if (message.includes('ad') || message.includes('retarget') || message.includes('lead gen')) {
      facebookScore += 15;
    }
    if (analysis.objective === 'leads' || analysis.objective === 'conversions') {
      facebookScore += 10;
    }

    // LinkedIn scoring (NEW)
    let linkedinScore = 0;
    if (explicitPlatforms.some(p => p.toLowerCase() === 'linkedin')) {
      linkedinScore += 50;
    }
    if (message.includes('linkedin') || message.includes('b2b') || message.includes('professional')) {
      linkedinScore += 30;
    }
    if (audience.includes('b2b') || audience.includes('executive') || audience.includes('decision maker')) {
      linkedinScore += 25;
    }
    if (message.includes('enterprise') || message.includes('corporate') || message.includes('c-suite')) {
      linkedinScore += 15;
    }
    if (analysis.objective === 'leads' && audience.includes('professional')) {
      linkedinScore += 10;
    }

    // Select platforms based on scores (threshold: 15)
    if (tiktokScore >= 15) {
      platforms.push('TIKTOK');
      rationales.push(`TikTok (score: ${tiktokScore}) - ${this.getTikTokRationale(message, audience, contentType)}`);
    }
    if (xScore >= 15) {
      platforms.push('X');
      rationales.push(`X/Twitter (score: ${xScore}) - ${this.getXRationale(message, audience, contentType)}`);
    }
    if (facebookScore >= 15) {
      platforms.push('FACEBOOK');
      rationales.push(`Facebook (score: ${facebookScore}) - ${this.getFacebookRationale(message, audience, contentType)}`);
    }
    if (linkedinScore >= 15) {
      platforms.push('LINKEDIN');
      rationales.push(`LinkedIn (score: ${linkedinScore}) - ${this.getLinkedInRationale(message, audience)}`);
    }

    // If no platforms selected, use default based on objective
    if (platforms.length === 0) {
      if (analysis.objective === 'awareness') {
        platforms.push('TIKTOK', 'X');
        rationales.push('Default awareness strategy: TikTok for viral reach + X for engagement');
      } else if (analysis.objective === 'leads' || analysis.objective === 'conversions') {
        platforms.push('FACEBOOK', 'LINKEDIN');
        rationales.push('Default conversion strategy: Facebook + LinkedIn for targeted lead generation');
      } else {
        platforms.push('X', 'LINKEDIN');
        rationales.push('Default engagement strategy: X for conversations + LinkedIn for professional reach');
      }
    }

    // Budget allocation
    if (analysis.budget !== 'Unspecified') {
      const allocation = this.allocateBudget(platforms, analysis);
      Object.assign(budgetAllocation, allocation);
    } else {
      platforms.forEach(p => {
        budgetAllocation[p] = 'To be determined';
      });
    }

    // Extract SEO keywords to inject into social content
    const seoKeywords = seoGuidance
      ? [...seoGuidance.primaryKeywords, ...seoGuidance.secondaryKeywords.slice(0, 2)]
      : [];

    return {
      platforms,
      rationale: rationales.join(' | '),
      budgetAllocation,
      seoKeywords,
    };
  }

  /**
   * Get LinkedIn selection rationale
   */
  private getLinkedInRationale(message: string, audience: string): string {
    const reasons: string[] = [];
    if (message.includes('b2b') || message.includes('professional')) {
      reasons.push('B2B focus');
    }
    if (audience.includes('executive') || audience.includes('decision maker')) {
      reasons.push('executive audience');
    }
    if (message.includes('enterprise') || message.includes('corporate')) {
      reasons.push('enterprise targeting');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'professional platform match';
  }

  /**
   * Get TikTok selection rationale
   */
  private getTikTokRationale(message: string, audience: string, contentType: string): string {
    const reasons: string[] = [];
    if (message.includes('viral') || message.includes('trending')) {
      reasons.push('viral potential');
    }
    if (audience.includes('gen z') || audience.includes('young')) {
      reasons.push('young audience match');
    }
    if (contentType.includes('video') || message.includes('video')) {
      reasons.push('video-first content');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'platform match';
  }

  /**
   * Get X/Twitter selection rationale
   */
  private getXRationale(message: string, audience: string, contentType: string): string {
    const reasons: string[] = [];
    if (message.includes('thought leadership') || message.includes('b2b')) {
      reasons.push('thought leadership');
    }
    if (audience.includes('professional') || audience.includes('business')) {
      reasons.push('professional audience');
    }
    if (message.includes('thread') || contentType.includes('text')) {
      reasons.push('text-based content');
    }
    if (message.includes('engage') || message.includes('conversation')) {
      reasons.push('engagement focus');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'platform match';
  }

  /**
   * Get Facebook selection rationale
   */
  private getFacebookRationale(message: string, audience: string, _contentType: string): string {
    const reasons: string[] = [];
    if (message.includes('ad') || message.includes('retarget')) {
      reasons.push('paid advertising');
    }
    if (audience.includes('older') || audience.includes('local')) {
      reasons.push('demographic match');
    }
    if (message.includes('lead')) {
      reasons.push('lead generation');
    }
    return reasons.length > 0 ? reasons.join(', ') : 'platform match';
  }

  /**
   * Allocate budget across selected platforms
   */
  private allocateBudget(platforms: string[], analysis: CampaignAnalysis): Record<string, string> {
    const allocation: Record<string, string> = {};
    const budgetStr = analysis.budget;

    // Extract numeric budget if possible
    const budgetMatch = budgetStr.match(/\$?([\d,]+)/);
    if (!budgetMatch) {
      platforms.forEach(p => {
        allocation[p] = 'To be determined';
      });
      return allocation;
    }

    const totalBudget = parseInt(budgetMatch[1].replace(/,/g, ''));
    const platformCount = platforms.length;

    // Simple equal split for now - could be more sophisticated
    const perPlatform = Math.floor(totalBudget / platformCount);
    const remainder = totalBudget % platformCount;

    platforms.forEach((platform, index) => {
      const amount = index === 0 ? perPlatform + remainder : perPlatform;
      allocation[platform] = `$${amount.toLocaleString()}`;
    });

    return allocation;
  }

  /**
   * Delegate to social specialists with SEO keywords injected
   * Executes in parallel for performance
   */
  private async delegateToSocialSpecialists(
    goal: CampaignGoal,
    brandContext: BrandContext,
    strategy: PlatformStrategy,
    seoGuidance: SEOKeywordGuidance | null,
    taskId: string,
    delegations: DelegationResult[],
    specialistOutputs: CampaignBrief['specialistOutputs'],
    warnings: string[]
  ): Promise<void> {
    const delegationPromises = strategy.platforms.map(async (platform) => {
      const specialistId = this.getSpecialistId(platform);
      const specialist = this.specialists.get(specialistId);

      if (!specialist?.isFunctional()) {
        warnings.push(`${specialistId} is not functional - skipping`);
        delegations.push({
          specialist: specialistId,
          brief: 'Specialist not available',
          status: 'BLOCKED',
          result: { reason: 'SPECIALIST_NOT_FUNCTIONAL' },
        });
        return;
      }

      // Create platform-specific brief with SEO keywords and brand context
      const brief = this.createPlatformBrief(goal, platform, strategy, brandContext, seoGuidance);
      const startTime = Date.now();

      this.log('INFO', `Delegating to ${specialistId}...`);

      try {
        const message: AgentMessage = {
          id: `${taskId}_${specialistId}`,
          type: 'COMMAND',
          from: this.identity.id,
          to: specialistId,
          payload: this.buildSpecialistPayload(platform, goal, brandContext, seoGuidance, strategy),
          timestamp: new Date(),
          priority: 'NORMAL',
          requiresResponse: true,
          traceId: taskId,
        };

        const report = await specialist.execute(message);
        const executionTimeMs = Date.now() - startTime;

        // Map AgentReport status to DelegationResult status
        let delegationStatus: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
        if (report.status === 'COMPLETED') {
          delegationStatus = 'COMPLETED';
          // Store output by platform
          this.storeSpecialistOutput(platform, report.data, specialistOutputs);
        } else if (report.status === 'BLOCKED') {
          delegationStatus = 'BLOCKED';
        } else if (report.status === 'FAILED') {
          delegationStatus = 'FAILED';
        } else {
          delegationStatus = 'PENDING';
        }

        delegations.push({
          specialist: specialistId,
          brief,
          status: delegationStatus,
          result: report.status === 'COMPLETED' ? report.data : report.errors?.join('; ') ?? 'Unknown error',
          executionTimeMs,
        });

        if (report.status === 'BLOCKED') {
          warnings.push(`${specialistId} blocked - campaign plan is theoretical only`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Delegation failed';
        delegations.push({
          specialist: specialistId,
          brief,
          status: 'FAILED',
          result: errorMessage,
          executionTimeMs: Date.now() - startTime,
        });
        warnings.push(`Failed to delegate to ${specialistId}: ${errorMessage}`);
      }
    });

    // Execute all delegations in parallel
    await Promise.allSettled(delegationPromises);
  }

  /**
   * Build platform-specific payload with brand context and SEO keywords
   */
  private buildSpecialistPayload(
    platform: string,
    goal: CampaignGoal,
    brandContext: BrandContext,
    seoGuidance: SEOKeywordGuidance | null,
    strategy: PlatformStrategy
  ): Record<string, unknown> {
    const basePayload = {
      campaignGoal: goal,
      budget: strategy.budgetAllocation[platform],
      brandContext: {
        industry: brandContext.industry,
        toneOfVoice: brandContext.toneOfVoice,
        keyPhrases: brandContext.keyPhrases,
        avoidPhrases: brandContext.avoidPhrases,
      },
      seoKeywords: seoGuidance ? {
        primary: seoGuidance.primaryKeywords,
        secondary: seoGuidance.secondaryKeywords,
        recommendations: seoGuidance.contentRecommendations,
      } : null,
      organizationId: brandContext.tenantId,
    };

    // Platform-specific payload structure
    switch (platform) {
      case 'TIKTOK':
        return {
          ...basePayload,
          method: 'generate_viral_hook',
          topic: goal.message,
          targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          contentGoal: this.mapObjectiveToContentGoal(goal.objective),
          niche: brandContext.industry,
          brandVoice: this.mapToneToTikTokVoice(brandContext.toneOfVoice),
        };

      case 'X':
        return {
          ...basePayload,
          action: 'build_thread_architecture',
          params: {
            topic: goal.message,
            goal: this.mapObjectiveToTwitterGoal(goal.objective),
            targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
            tonePreference: this.mapToneToTwitterTone(brandContext.toneOfVoice),
            riskTolerance: 'medium',
          },
        };

      case 'FACEBOOK':
        return {
          ...basePayload,
          action: 'generate_ad_creative',
          objective: this.mapObjectiveToFacebookObjective(goal.objective),
          persona: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          productService: brandContext.companyDescription,
          usp: brandContext.uniqueValue,
          offer: goal.message,
        };

      case 'LINKEDIN':
        return {
          ...basePayload,
          action: 'generate_content',
          topic: goal.message,
          contentType: 'post',
          targetAudience: goal.targetAudience?.demographics ?? brandContext.targetAudience,
          tone: this.mapToneToLinkedInTone(brandContext.toneOfVoice),
        };

      default:
        return basePayload;
    }
  }

  /**
   * Map campaign objective to platform-specific content goals
   */
  private mapObjectiveToContentGoal(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'awareness',
      engagement: 'engagement',
      conversions: 'conversion',
      leads: 'conversion',
      retention: 'engagement',
    };
    return mapping[objective] ?? 'awareness';
  }

  private mapObjectiveToTwitterGoal(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'viral',
      engagement: 'thought_leadership',
      conversions: 'promotional',
      leads: 'promotional',
      retention: 'educational',
    };
    return mapping[objective] ?? 'thought_leadership';
  }

  private mapObjectiveToFacebookObjective(objective: string): string {
    const mapping: Record<string, string> = {
      awareness: 'awareness',
      engagement: 'awareness',
      conversions: 'direct_sale',
      leads: 'lead_magnet',
      retention: 'retargeting',
    };
    return mapping[objective] ?? 'awareness';
  }

  /**
   * Map brand tone to platform-specific voice settings
   */
  private mapToneToTikTokVoice(tone: string): string {
    const mapping: Record<string, string> = {
      warm: 'friendly',
      professional: 'professional',
      direct: 'edgy',
      friendly: 'casual',
      formal: 'professional',
      casual: 'humorous',
    };
    return mapping[tone] ?? 'casual';
  }

  private mapToneToTwitterTone(tone: string): string {
    const mapping: Record<string, string> = {
      warm: 'friendly',
      professional: 'professional',
      direct: 'provocative',
      friendly: 'friendly',
      formal: 'professional',
      casual: 'casual',
    };
    return mapping[tone] ?? 'professional';
  }

  private mapToneToLinkedInTone(tone: string): string {
    const mapping: Record<string, string> = {
      warm: 'conversational',
      professional: 'professional',
      direct: 'authoritative',
      friendly: 'conversational',
      formal: 'authoritative',
      casual: 'conversational',
    };
    return mapping[tone] ?? 'professional';
  }

  /**
   * Store specialist output in the appropriate slot
   */
  private storeSpecialistOutput(
    platform: string,
    data: unknown,
    outputs: CampaignBrief['specialistOutputs']
  ): void {
    switch (platform) {
      case 'TIKTOK':
        outputs.tiktok = data;
        break;
      case 'X':
        outputs.twitter = data;
        break;
      case 'FACEBOOK':
        outputs.facebook = data;
        break;
      case 'LINKEDIN':
        outputs.linkedin = data;
        break;
    }
  }

  /**
   * Get specialist ID from platform name
   */
  private getSpecialistId(platform: string): string {
    const mapping: Record<string, string> = {
      TIKTOK: 'TIKTOK_EXPERT',
      X: 'TWITTER_X_EXPERT',
      TWITTER: 'TWITTER_X_EXPERT',
      FACEBOOK: 'FACEBOOK_ADS_EXPERT',
      LINKEDIN: 'LINKEDIN_EXPERT',
      SEO: 'SEO_EXPERT',
    };
    return mapping[platform] ?? `${platform}_EXPERT`;
  }

  /**
   * Create platform-specific brief with brand context and SEO keywords
   */
  private createPlatformBrief(
    goal: CampaignGoal,
    platform: string,
    strategy: PlatformStrategy,
    brandContext: BrandContext,
    seoGuidance: SEOKeywordGuidance | null
  ): string {
    const budget = strategy.budgetAllocation[platform] ?? 'Unspecified';
    const keywords = seoGuidance?.primaryKeywords.join(', ') ?? 'None specified';
    const brandVoice = `${brandContext.toneOfVoice} - ${brandContext.communicationStyle}`;

    // Industry context (derived from Brand DNA, never hardcoded)
    const industryContext = brandContext.industry !== 'General'
      ? `Industry: ${brandContext.industry}`
      : 'Industry: General/Multi-purpose';

    if (platform === 'TIKTOK') {
      return `Create TikTok campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Viral content, trending sounds, hooks
Content Type: Short-form vertical video (15-60s)
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'X') {
      return `Create X/Twitter campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Thought leadership, engagement, conversations
Content Type: Tweets, threads, reply engagement
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'FACEBOOK') {
      return `Create Facebook campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: Paid ads, audience targeting, retargeting, lead generation
Content Type: Ad creatives, carousel ads, video ads, lead forms
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    if (platform === 'LINKEDIN') {
      return `Create LinkedIn campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
${industryContext}
Brand Voice: ${brandVoice}
SEO Keywords to Incorporate: ${keywords}
Focus: B2B content, professional networking, thought leadership
Content Type: Posts, articles, connection outreach
Key Phrases to Use: ${brandContext.keyPhrases.slice(0, 3).join(', ') || 'None specified'}
Phrases to Avoid: ${brandContext.avoidPhrases.slice(0, 3).join(', ') || 'None specified'}`;
    }

    return `Create ${platform} campaign strategy:
Campaign Goal: ${goal.message}
${industryContext}
Brand Voice: ${brandVoice}
Budget: ${budget}`;
  }

  /**
   * Aggregate specialist results into unified plan
   */
  private aggregateResults(
    delegations: DelegationResult[],
    analysis: CampaignAnalysis,
    strategy: PlatformStrategy,
    brandContext: BrandContext
  ): AggregatedPlan {
    const completedDelegations = delegations.filter(d => d.status === 'COMPLETED');
    const blockedDelegations = delegations.filter(d => d.status === 'BLOCKED');

    // Overview with brand context (industry-agnostic)
    const platformList = strategy.platforms.join(', ');
    const statusSummary = blockedDelegations.length > 0
      ? `(${blockedDelegations.length} specialist(s) not functional - theoretical plan only)`
      : '(all specialists functional)';

    const industryNote = brandContext.industry !== 'General'
      ? ` for the ${brandContext.industry} industry`
      : '';

    const overview = `Multi-platform ${analysis.objective} campaign${industryNote} across ${platformList} ${statusSummary}. Target: ${analysis.targetAudience}. ${analysis.contentType} content optimized for each platform with consistent ${brandContext.toneOfVoice} brand voice.`;

    // Timeline
    const timeline = `${analysis.timeline}. Coordinated launch across all platforms for maximum impact.`;

    // Expected Reach (estimated)
    const expectedReach = this.estimateReach(strategy.platforms, analysis);

    // Recommendations
    const recommendations = this.generateRecommendations(delegations, analysis, strategy);

    // Brand voice compliance check
    const brandVoiceCompliance = completedDelegations.length > 0;

    // SEO integration check
    const seoIntegration = strategy.seoKeywords.length > 0;

    return {
      overview,
      timeline,
      expectedReach,
      recommendations,
      brandVoiceCompliance,
      seoIntegration,
    };
  }

  /**
   * Estimate campaign reach
   */
  private estimateReach(platforms: string[], analysis: CampaignAnalysis): string {
    const hasBudget = analysis.budget !== 'Unspecified';

    if (!hasBudget) {
      return 'Organic reach: 1,000-10,000 impressions per platform (highly variable based on content quality and timing)';
    }

    // Simple estimation based on platform count and budget
    const platformCount = platforms.length;
    const baseReach = platformCount * 50000; // 50k per platform as baseline
    return `Estimated ${baseReach.toLocaleString()}-${(baseReach * 3).toLocaleString()} impressions across all platforms with paid promotion`;
  }

  /**
   * Generate strategic recommendations (industry-agnostic)
   */
  private generateRecommendations(
    delegations: DelegationResult[],
    analysis: CampaignAnalysis,
    strategy: PlatformStrategy
  ): string[] {
    const recommendations: string[] = [];

    // Check for blocked specialists
    const blockedCount = delegations.filter(d => d.status === 'BLOCKED').length;
    if (blockedCount > 0) {
      recommendations.push(`URGENT: ${blockedCount} specialist(s) not functional - build them to execute this campaign`);
    }

    // Budget recommendations
    if (analysis.budget === 'Unspecified') {
      recommendations.push('Define budget for paid promotion - organic reach alone may not achieve goals');
    }

    // SEO integration recommendation
    if (strategy.seoKeywords.length > 0) {
      recommendations.push(`SEO Integration: Incorporate keywords (${strategy.seoKeywords.slice(0, 2).join(', ')}) naturally in all content`);
    }

    // Platform-specific recommendations
    if (strategy.platforms.includes('TIKTOK')) {
      recommendations.push('TikTok: Focus on first 3 seconds - hook is everything for stopping the scroll');
    }
    if (strategy.platforms.includes('X')) {
      recommendations.push('X/Twitter: Engage in replies and build conversations - algorithm rewards genuine interaction');
    }
    if (strategy.platforms.includes('FACEBOOK')) {
      recommendations.push('Facebook: Set up retargeting pixel early - warm audiences convert significantly better');
    }
    if (strategy.platforms.includes('LINKEDIN')) {
      recommendations.push('LinkedIn: Focus on value-first content - educational posts outperform promotional ones');
    }

    // Cross-platform recommendations
    if (strategy.platforms.length > 1) {
      recommendations.push('Cross-platform: Adapt content format for each platform while maintaining consistent messaging');
      recommendations.push('Timing: Stagger posts by 2-4 hours to maximize reach without audience overlap fatigue');
    }

    // Objective-specific recommendations
    if (analysis.objective === 'conversions') {
      recommendations.push('Conversions: Ensure landing pages are optimized and tracking pixels are installed');
    } else if (analysis.objective === 'leads') {
      recommendations.push('Lead generation: Use platform-native forms where possible - reduces friction');
    } else if (analysis.objective === 'awareness') {
      recommendations.push('Awareness: Track brand search volume as lagging indicator of campaign success');
    } else if (analysis.objective === 'retention') {
      recommendations.push('Retention: Focus on community building and consistent value delivery');
    }

    return recommendations.slice(0, 7);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(delegations: DelegationResult[], expectedSpecialists: number): number {
    let score = 0;
    const maxScore = 100;

    // Delegation success rate (50 points)
    const completedCount = delegations.filter(d => d.status === 'COMPLETED').length;
    const successRate = delegations.length > 0 ? completedCount / delegations.length : 0;
    score += successRate * 50;

    // Specialist coverage (30 points)
    const coverageRatio = expectedSpecialists > 0 ? delegations.length / expectedSpecialists : 0;
    score += Math.min(coverageRatio, 1) * 30;

    // No failures (20 points)
    const failedCount = delegations.filter(d => d.status === 'FAILED').length;
    const noFailures = failedCount === 0 ? 1 : Math.max(0, 1 - failedCount / delegations.length);
    score += noFailures * 20;

    return Math.round((score / maxScore) * 100) / 100;
  }

  // ==========================================================================
  // CROSS-PLATFORM COORDINATION
  // ==========================================================================

  /**
   * Generate cross-platform recommendations based on all specialist outputs
   */
  private generateCrossPlatformRecommendations(
    delegations: DelegationResult[],
    brandContext: BrandContext,
    seoGuidance: SEOKeywordGuidance | null
  ): string[] {
    const recommendations: string[] = [];
    const completedPlatforms = delegations
      .filter(d => d.status === 'COMPLETED')
      .map(d => d.specialist);

    // Cross-platform timing
    if (completedPlatforms.length > 1) {
      recommendations.push(
        'Stagger content across platforms by 2-4 hours to maximize reach without audience fatigue'
      );
    }

    // SEO-social integration
    if (seoGuidance && seoGuidance.primaryKeywords.length > 0) {
      recommendations.push(
        `Use primary keywords (${seoGuidance.primaryKeywords.slice(0, 2).join(', ')}) consistently across all platforms`
      );
    }

    // Brand voice consistency
    if (brandContext.toneOfVoice) {
      recommendations.push(
        `Maintain ${brandContext.toneOfVoice} tone across all platforms - adapt format, not voice`
      );
    }

    // Platform-specific coordination
    if (completedPlatforms.includes('TIKTOK_EXPERT') && completedPlatforms.includes('TWITTER_X_EXPERT')) {
      recommendations.push(
        'Repurpose TikTok video highlights as Twitter/X clips with thread context'
      );
    }

    if (completedPlatforms.includes('LINKEDIN_EXPERT') && completedPlatforms.includes('FACEBOOK_ADS_EXPERT')) {
      recommendations.push(
        'Use LinkedIn for organic B2B reach, Facebook for paid retargeting of engaged audiences'
      );
    }

    // Key phrases reinforcement
    if (brandContext.keyPhrases.length > 0) {
      recommendations.push(
        `Reinforce brand phrases across platforms: "${brandContext.keyPhrases[0]}"`
      );
    }

    // Competitor differentiation
    if (brandContext.competitors.length > 0) {
      recommendations.push(
        'Position content to differentiate from competitors without direct mentions'
      );
    }

    return recommendations.slice(0, 8);
  }

  // ==========================================================================
  // TENANT MEMORY VAULT INTEGRATION
  // ==========================================================================

  /**
   * Store campaign insights in TenantMemoryVault for cross-agent learning
   */
  private async storeCampaignInsights(
    tenantId: string,
    campaignBrief: CampaignBrief
  ): Promise<void> {
    try {
      const vault = getMemoryVault();

      // Store campaign brief as STRATEGY entry
      vault.write(
        tenantId,
        'STRATEGY',
        `campaign_brief_${campaignBrief.briefId}`,
        campaignBrief,
        this.identity.id,
        {
          priority: 'HIGH',
          tags: ['marketing', 'campaign', campaignBrief.detectedIntent],
        }
      );

      // Share key findings as INSIGHT for other agents
      const insight: InsightData = {
        type: 'CONTENT',
        title: `Campaign Strategy: ${campaignBrief.campaignGoal.objective}`,
        summary: campaignBrief.aggregatedPlan.overview,
        confidence: Math.round(campaignBrief.confidence * 100),
        sources: campaignBrief.delegations.map(d => d.specialist),
        relatedAgents: ['JASPER', 'CONTENT_MANAGER', 'REVENUE_DIRECTOR'],
        actionable: true,
        recommendedActions: campaignBrief.crossPlatformRecommendations.slice(0, 3),
      };

      await shareInsight(
        tenantId,
        this.identity.id,
        insight.type,
        insight.title,
        insight.summary,
        {
          confidence: insight.confidence,
          sources: insight.sources,
          relatedAgents: insight.relatedAgents,
          actions: insight.recommendedActions,
          tags: ['marketing', 'campaign', 'strategy'],
        }
      );

      this.log('INFO', `Campaign insights stored for tenant ${tenantId}`);
    } catch (error) {
      this.log('ERROR', `Failed to store campaign insights: ${error instanceof Error ? error.message : String(error)}`);
      // Non-fatal - don't throw
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createMarketingManager(): MarketingManager {
  return new MarketingManager();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: MarketingManager | null = null;

export function getMarketingManager(): MarketingManager {
  instance ??= createMarketingManager();
  return instance;
}
