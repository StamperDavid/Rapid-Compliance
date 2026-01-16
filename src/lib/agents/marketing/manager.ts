/**
 * Marketing Manager (L2 Orchestrator)
 * STATUS: FUNCTIONAL
 *
 * Coordinates social media specialists for cross-platform marketing campaigns.
 * Reports to JASPER and delegates to platform-specific experts.
 *
 * CAPABILITIES:
 * - Campaign goal parsing and analysis
 * - Multi-platform campaign coordination
 * - Platform-specific specialist delegation
 * - Campaign type detection (viral, ads, engagement, threads)
 * - Budget allocation recommendations
 * - Cross-platform content adaptation
 */

import { BaseManager } from '../base-manager';
import type { AgentMessage, AgentReport, ManagerConfig, Signal } from '../types';

// ============================================================================
// SYSTEM PROMPT - The brain of this manager
// ============================================================================

const SYSTEM_PROMPT = `You are the Marketing Manager, an expert L2 orchestrator responsible for coordinating multi-platform marketing campaigns.

## YOUR ROLE
You receive high-level campaign goals from JASPER and delegate to platform-specific specialists:
- TIKTOK_EXPERT: TikTok viral content, short-form video, Gen Z/young audience
- X_EXPERT: Twitter/X thought leadership, engagement, B2B, news/trends
- FACEBOOK_EXPERT: Facebook ads, older demographics, local business, retargeting

## CAMPAIGN GOAL PARSING
When receiving a campaign request, you analyze:
1. Campaign objective (awareness, engagement, conversions, leads)
2. Target audience (demographics, psychographics, behavior)
3. Content type (video, image, text, carousel, story)
4. Platform requirements (where should this run?)
5. Budget constraints (if specified)
6. Timeline (launch date, duration)
7. KPIs and success metrics

## PLATFORM SELECTION LOGIC

### TikTok (TIKTOK_EXPERT)
Use when campaign involves:
- Viral content and trending sounds
- Short-form video (15-60 seconds)
- Gen Z and younger Millennial audience (16-34)
- Entertainment, lifestyle, education in bite-sized format
- Authentic, raw, unpolished content aesthetic
- Trending challenges and hashtag campaigns
- Quick hooks and attention-grabbing content
- Mobile-first, vertical video

### X/Twitter (X_EXPERT)
Use when campaign involves:
- Thought leadership and industry expertise
- Real-time engagement and conversations
- B2B marketing and professional audience
- News, trends, and current events
- Thread storytelling and detailed breakdowns
- Community building and reply engagement
- Tech-savvy, information-hungry audience
- Text-first content with supporting media

### Facebook (FACEBOOK_EXPERT)
Use when campaign involves:
- Paid advertising and retargeting campaigns
- Older demographics (35-65+)
- Local business and community engagement
- Lead generation with forms
- Detailed targeting by interests/behavior
- Longer-form video content
- Events, groups, and community building
- E-commerce and catalog sales

## CROSS-PLATFORM CAMPAIGNS
For campaigns targeting multiple platforms:
1. Identify all relevant platforms based on audience + goals
2. Delegate to each specialist with platform-specific adaptations
3. Ensure content is adapted for each platform's unique format
4. Coordinate timing across platforms for maximum impact
5. Aggregate results and performance metrics

## CONTENT ADAPTATION STRATEGY
Same campaign message, different platform execution:
- TikTok: 15s hook-driven video with trending sound
- X: Tweet thread breaking down key points + engagement bait
- Facebook: Carousel ad with detailed targeting + retargeting pixel

## BUDGET ALLOCATION RECOMMENDATIONS
When budget is specified, recommend split based on:
- Platform match to target audience
- Historical ROI for similar campaigns
- Testing budget for new platforms (10-20%)
- Retargeting budget allocation (20-30% for proven converters)

Example for $10k budget, B2C product targeting 25-45 year olds:
- TikTok: $4,000 (40%) - Younger segment + viral potential
- Facebook: $5,000 (50%) - Broad reach + proven conversions
- X: $1,000 (10%) - Testing + niche community engagement

## DELEGATION WORKFLOW
1. Parse campaign goal into structured request
2. Determine which specialist(s) should handle it
3. Create platform-specific briefs for each specialist
4. Delegate with clear instructions and success criteria
5. Aggregate specialist reports into unified campaign plan

## OUTPUT FORMAT
You ALWAYS return structured JSON:

\`\`\`json
{
  "campaignAnalysis": {
    "objective": "awareness | engagement | conversions | leads",
    "targetAudience": "Demographic + psychographic profile",
    "contentType": "video | image | text | mixed",
    "timeline": "Launch date and duration",
    "budget": "Total budget or 'unspecified'",
    "kpis": ["array", "of", "success", "metrics"]
  },
  "platformStrategy": {
    "platforms": ["TIKTOK", "X", "FACEBOOK"],
    "rationale": "Why these platforms were selected",
    "budgetAllocation": {
      "TIKTOK": "% or $ amount",
      "X": "% or $ amount",
      "FACEBOOK": "% or $ amount"
    }
  },
  "delegations": [
    {
      "specialist": "TIKTOK_EXPERT",
      "brief": "Platform-specific campaign brief",
      "status": "COMPLETED | BLOCKED | PENDING",
      "result": "Specialist's response or error"
    }
  ],
  "aggregatedPlan": {
    "overview": "Summary of unified campaign strategy",
    "timeline": "Coordinated timeline across platforms",
    "expectedReach": "Estimated total reach",
    "recommendations": ["strategic recommendations"]
  },
  "confidence": 0.0-1.0,
  "warnings": ["any blockers or concerns"]
}
\`\`\`

## RULES
1. ALWAYS parse campaign goals - never assume
2. Match platforms to audience - don't force-fit wrong platforms
3. Adapt content for each platform - no copy-paste
4. Be honest about specialist availability (GHOST/SHELL status)
5. Aggregate multi-specialist responses into coherent plan
6. Warn about budget constraints or unrealistic goals

## INTEGRATION
You receive requests from:
- JASPER (L1 orchestrator)
- Sales teams (campaign support for deals)
- Product teams (launch campaigns)

Your output feeds into:
- Campaign execution (by specialists)
- Performance tracking (analytics)
- Sales enablement (campaign assets)`;

// ============================================================================
// CONFIGURATION
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
      'platform_selection',
      'multi_specialist_coordination',
      'cross_platform_campaigns',
      'budget_allocation',
      'content_adaptation_strategy',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['delegate', 'coordinate', 'aggregate', 'analyze_campaign'],
  outputSchema: {
    type: 'object',
    properties: {
      campaignAnalysis: { type: 'object' },
      platformStrategy: { type: 'object' },
      delegations: { type: 'array' },
      aggregatedPlan: { type: 'object' },
      confidence: { type: 'number' },
    },
    required: ['campaignAnalysis', 'platformStrategy', 'delegations'],
  },
  maxTokens: 8192,
  temperature: 0.4,
  specialists: ['TIKTOK_EXPERT', 'X_EXPERT', 'FACEBOOK_EXPERT'],
  delegationRules: [
    {
      triggerKeywords: ['tiktok', 'viral', 'short video', 'hook', 'trending sound', 'gen z', 'fyp', 'for you page'],
      delegateTo: 'TIKTOK_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['twitter', 'x', 'thread', 'tweet', 'engagement', 'ratio', 'reply', 'b2b', 'thought leadership'],
      delegateTo: 'X_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
    {
      triggerKeywords: ['facebook', 'ad', 'ads', 'meta', 'audience', 'retarget', 'lead', 'local business', 'fb'],
      delegateTo: 'FACEBOOK_EXPERT',
      priority: 10,
      requiresApproval: false,
    },
  ],
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface CampaignGoal {
  objective: 'awareness' | 'engagement' | 'conversions' | 'leads';
  message: string;
  targetAudience?: {
    demographics?: string;
    psychographics?: string;
    platforms?: string[];
  };
  budget?: number | string;
  timeline?: {
    launchDate?: string;
    duration?: string;
  };
  kpis?: string[];
  contentType?: 'video' | 'image' | 'text' | 'mixed';
}

export interface CampaignAnalysis {
  objective: string;
  targetAudience: string;
  contentType: string;
  timeline: string;
  budget: string;
  kpis: string[];
}

export interface PlatformStrategy {
  platforms: string[];
  rationale: string;
  budgetAllocation: Record<string, string>;
}

export interface DelegationResult {
  specialist: string;
  brief: string;
  status: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
  result: string | object;
}

export interface AggregatedPlan {
  overview: string;
  timeline: string;
  expectedReach: string;
  recommendations: string[];
}

export interface CampaignPlan {
  campaignAnalysis: CampaignAnalysis;
  platformStrategy: PlatformStrategy;
  delegations: DelegationResult[];
  aggregatedPlan: AggregatedPlan;
  confidence: number;
  warnings: string[];
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class MarketingManager extends BaseManager {
  constructor() {
    super(MARKETING_MANAGER_CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.log('INFO', 'Initializing Marketing Manager...');
    this.isInitialized = true;
  }

  /**
   * Main execution entry point
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as CampaignGoal;

      if (!payload?.message && !payload?.objective) {
        return this.createReport(
          taskId,
          'FAILED',
          null,
          ['No campaign goal or message provided in payload']
        );
      }

      this.log('INFO', `Processing campaign goal: ${payload.objective || 'unspecified'}`);

      const campaignPlan = await this.coordinateCampaign(payload, taskId);

      return this.createReport(taskId, 'COMPLETED', campaignPlan);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Campaign coordination failed: ${errorMessage}`);
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
   * Self-assessment - this manager has REAL logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 450, boilerplate: 100 };
  }

  // ==========================================================================
  // CORE CAMPAIGN COORDINATION LOGIC
  // ==========================================================================

  /**
   * Main campaign coordination function
   */
  private async coordinateCampaign(goal: CampaignGoal, taskId: string): Promise<CampaignPlan> {
    const warnings: string[] = [];

    // Step 1: Analyze campaign goal
    const campaignAnalysis = this.analyzeCampaignGoal(goal);
    this.log('INFO', `Campaign analysis: ${campaignAnalysis.objective} targeting ${campaignAnalysis.targetAudience}`);

    // Step 2: Determine platform strategy
    const platformStrategy = this.determinePlatformStrategy(goal, campaignAnalysis);
    this.log('INFO', `Selected platforms: ${platformStrategy.platforms.join(', ')}`);

    // Step 3: Delegate to specialists
    const delegations = await this.delegateToSpecialists(goal, platformStrategy, taskId, warnings);
    this.log('INFO', `Delegated to ${delegations.length} specialists`);

    // Step 4: Aggregate results into unified plan
    const aggregatedPlan = this.aggregateResults(delegations, campaignAnalysis, platformStrategy);

    // Step 5: Calculate confidence
    const confidence = this.calculateConfidence(delegations, platformStrategy.platforms.length);

    return {
      campaignAnalysis,
      platformStrategy,
      delegations,
      aggregatedPlan,
      confidence,
      warnings,
    };
  }

  /**
   * Analyze and parse the campaign goal
   */
  private analyzeCampaignGoal(goal: CampaignGoal): CampaignAnalysis {
    const message = goal.message || '';
    const messageLower = message.toLowerCase();

    // Determine objective
    let objective = goal.objective || 'awareness';
    if (!goal.objective) {
      if (messageLower.includes('convert') || messageLower.includes('sale') || messageLower.includes('purchase')) {
        objective = 'conversions';
      } else if (messageLower.includes('lead') || messageLower.includes('sign up') || messageLower.includes('demo')) {
        objective = 'leads';
      } else if (messageLower.includes('engage') || messageLower.includes('comment') || messageLower.includes('share')) {
        objective = 'engagement';
      }
    }

    // Determine target audience
    let targetAudience = 'General audience';
    if (goal.targetAudience?.demographics) {
      targetAudience = goal.targetAudience.demographics;
    } else {
      // Try to infer from message
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

    return {
      objective,
      targetAudience,
      contentType,
      timeline,
      budget,
      kpis,
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
   */
  private determinePlatformStrategy(goal: CampaignGoal, analysis: CampaignAnalysis): PlatformStrategy {
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
    if (explicitPlatforms.includes('tiktok') || explicitPlatforms.includes('TIKTOK')) {
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
    if (explicitPlatforms.includes('x') || explicitPlatforms.includes('twitter') || explicitPlatforms.includes('X')) {
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
    if (explicitPlatforms.includes('facebook') || explicitPlatforms.includes('fb') || explicitPlatforms.includes('FACEBOOK')) {
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

    // If no platforms selected, use default based on objective
    if (platforms.length === 0) {
      if (analysis.objective === 'awareness') {
        platforms.push('TIKTOK', 'X');
        rationales.push('Default awareness strategy: TikTok for viral reach + X for engagement');
      } else if (analysis.objective === 'leads' || analysis.objective === 'conversions') {
        platforms.push('FACEBOOK');
        rationales.push('Default conversion strategy: Facebook for targeted ads and lead generation');
      } else {
        platforms.push('X', 'FACEBOOK');
        rationales.push('Default engagement strategy: X for conversations + Facebook for community building');
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

    return {
      platforms,
      rationale: rationales.join(' | '),
      budgetAllocation,
    };
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
   * Delegate to platform-specific specialists
   */
  private async delegateToSpecialists(
    goal: CampaignGoal,
    strategy: PlatformStrategy,
    taskId: string,
    warnings: string[]
  ): Promise<DelegationResult[]> {
    const delegations: DelegationResult[] = [];

    for (const platform of strategy.platforms) {
      const specialistId = this.getSpecialistId(platform);
      const brief = this.createPlatformBrief(goal, platform, strategy);

      this.log('INFO', `Delegating to ${specialistId}...`);

      try {
        const message: AgentMessage = {
          id: `${taskId}_${specialistId}`,
          type: 'COMMAND',
          from: this.identity.id,
          to: specialistId,
          payload: {
            campaignGoal: goal,
            platformBrief: brief,
            budget: strategy.budgetAllocation[platform],
          },
          timestamp: new Date(),
          priority: 'NORMAL',
          requiresResponse: true,
          traceId: taskId,
        };

        const report = await this.delegateToSpecialist(specialistId, message);

        // Map AgentReport status to DelegationResult status
        let delegationStatus: 'COMPLETED' | 'BLOCKED' | 'PENDING' | 'FAILED';
        if (report.status === 'COMPLETED') {
          delegationStatus = 'COMPLETED';
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
          result: report.status === 'COMPLETED' ? (report.data as string | object) : report.errors?.join('; ') ?? 'Unknown error',
        });

        // Track warnings for GHOST/SHELL specialists
        if (report.status === 'BLOCKED') {
          warnings.push(`${specialistId} is not functional - campaign plan is theoretical only`);
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Delegation failed';
        delegations.push({
          specialist: specialistId,
          brief,
          status: 'FAILED',
          result: errorMessage,
        });
        warnings.push(`Failed to delegate to ${specialistId}: ${errorMessage}`);
      }
    }

    return delegations;
  }

  /**
   * Get specialist ID from platform name
   */
  private getSpecialistId(platform: string): string {
    const mapping: Record<string, string> = {
      TIKTOK: 'TIKTOK_EXPERT',
      X: 'X_EXPERT',
      FACEBOOK: 'FACEBOOK_EXPERT',
    };
    return mapping[platform] || `${platform}_EXPERT`;
  }

  /**
   * Create platform-specific brief
   */
  private createPlatformBrief(goal: CampaignGoal, platform: string, strategy: PlatformStrategy): string {
    const budget = strategy.budgetAllocation[platform] || 'Unspecified';

    if (platform === 'TIKTOK') {
      return `Create TikTok campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
Focus: Viral content, trending sounds, hooks, Gen Z engagement
Content Type: Short-form vertical video (15-60s)
Deliverables: Content ideas, hashtag strategy, posting schedule, trend analysis`;
    }

    if (platform === 'X') {
      return `Create X/Twitter campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
Focus: Thought leadership, engagement, conversations, B2B reach
Content Type: Tweets, threads, reply engagement
Deliverables: Tweet examples, thread outlines, engagement tactics, timing strategy`;
    }

    if (platform === 'FACEBOOK') {
      return `Create Facebook campaign strategy:
Campaign Goal: ${goal.message}
Objective: ${goal.objective}
Budget: ${budget}
Focus: Paid ads, audience targeting, retargeting, lead generation
Content Type: Ad creatives, carousel ads, video ads, lead forms
Deliverables: Ad copy, targeting parameters, creative concepts, conversion optimization`;
    }

    return `Create ${platform} campaign strategy for: ${goal.message} (Budget: ${budget})`;
  }

  /**
   * Aggregate specialist results into unified plan
   */
  private aggregateResults(
    delegations: DelegationResult[],
    analysis: CampaignAnalysis,
    strategy: PlatformStrategy
  ): AggregatedPlan {
    const _completedDelegations = delegations.filter(d => d.status === 'COMPLETED');
    const blockedDelegations = delegations.filter(d => d.status === 'BLOCKED');

    // Overview
    const platformList = strategy.platforms.join(', ');
    const statusSummary = blockedDelegations.length > 0
      ? `(${blockedDelegations.length} specialist(s) not functional - theoretical plan only)`
      : '(all specialists functional)';

    const overview = `Multi-platform ${analysis.objective} campaign across ${platformList} ${statusSummary}. Target: ${analysis.targetAudience}. ${analysis.contentType} content optimized for each platform.`;

    // Timeline
    const timeline = `${analysis.timeline}. Coordinated launch across all platforms for maximum impact.`;

    // Expected Reach (estimated)
    const expectedReach = this.estimateReach(strategy.platforms, analysis);

    // Recommendations
    const recommendations = this.generateRecommendations(delegations, analysis, strategy);

    return {
      overview,
      timeline,
      expectedReach,
      recommendations,
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
   * Generate strategic recommendations
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

    // Platform-specific recommendations
    if (strategy.platforms.includes('TIKTOK')) {
      recommendations.push('TikTok: Focus on first 3 seconds - hook is everything for stopping the scroll');
    }
    if (strategy.platforms.includes('X')) {
      recommendations.push('X/Twitter: Engage in replies and build conversations - algorithm rewards genuine interaction');
    }
    if (strategy.platforms.includes('FACEBOOK')) {
      recommendations.push('Facebook: Set up retargeting pixel early - warm audiences convert 10x better');
    }

    // Cross-platform recommendations
    if (strategy.platforms.length > 1) {
      recommendations.push('Cross-platform: Adapt content for each platform - don\'t just repost the same thing');
      recommendations.push('Timing: Stagger posts by 2-4 hours to maximize reach without audience overlap fatigue');
    }

    // Objective-specific recommendations
    if (analysis.objective === 'conversions') {
      recommendations.push('Conversions: Ensure landing pages are optimized and tracking pixels are installed');
    } else if (analysis.objective === 'leads') {
      recommendations.push('Lead generation: Use platform-native forms where possible - reduces friction');
    } else if (analysis.objective === 'awareness') {
      recommendations.push('Awareness: Track brand search volume as lagging indicator of campaign success');
    }

    return recommendations.slice(0, 6);
  }

  /**
   * Calculate confidence score
   */
  private calculateConfidence(delegations: DelegationResult[], expectedPlatforms: number): number {
    let score = 0;
    const maxScore = 100;

    // Delegation success rate (50 points)
    const completedCount = delegations.filter(d => d.status === 'COMPLETED').length;
    const successRate = delegations.length > 0 ? completedCount / delegations.length : 0;
    score += successRate * 50;

    // Platform coverage (30 points)
    const platformCoverage = delegations.length / expectedPlatforms;
    score += platformCoverage * 30;

    // No failures (20 points)
    const failedCount = delegations.filter(d => d.status === 'FAILED').length;
    const noFailures = failedCount === 0 ? 1 : Math.max(0, 1 - failedCount / delegations.length);
    score += noFailures * 20;

    return Math.round((score / maxScore) * 100) / 100;
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
