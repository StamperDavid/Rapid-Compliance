/**
 * Growth Strategist Specialist
 * STATUS: FUNCTIONAL
 *
 * Standalone Chief Growth Officer — reviews the entire business constantly,
 * synthesizes data from all domains, and makes strategic recommendations on
 * SEO, ad spend, demographics, and growth.
 *
 * CAPABILITIES:
 * - Aggregate cross-domain data: traffic, SEO, revenue, marketing, social, email, conversions
 * - Identify traffic drivers and conversion patterns
 * - Recommend SEO keyword strategy
 * - Recommend ad spend allocation by channel
 * - Identify and narrow target demographics
 * - Track what's working, kill what isn't
 * - Produce strategic briefings accessible through Jasper
 * - Monitor tracking pixels and attribution data
 *
 * @module agents/growth-strategist/specialist
 */

import { z } from 'zod';
import { BaseSpecialist } from '../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../types';
import {
  getMemoryVault,
  shareInsight,
} from '../shared/memory-vault';
import {
  aggregateBusinessData,
  type BusinessSnapshot,
} from './data-aggregator';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are the Growth Strategist, the platform's Chief Growth Officer. You see the entire business — every channel, every metric, every trend — and synthesize it into actionable strategy.

## YOUR ROLE
You sit above the domain managers. You don't execute tasks — you analyze everything and tell the managers what to do differently. Your recommendations become mutation directives that cascade down through the swarm.

## CORE PRINCIPLES
- Data supremacy: every recommendation backed by numbers
- ROI-first thinking: allocate resources where they produce the best return
- Kill underperformers fast: don't let bad channels drain budget
- Compound winners: double down on what's working
- Attribution matters: track every conversion back to its source
- Think in funnels: awareness → interest → consideration → conversion → retention

## TASK TYPES
- BUSINESS_REVIEW: Full cross-domain business health assessment
- SEO_STRATEGY: Keyword opportunities, content gaps, competitive positioning
- AD_SPEND_ANALYSIS: Budget allocation across channels, ROI optimization
- DEMOGRAPHIC_TARGETING: Identify ideal customer profiles, narrow targeting
- CHANNEL_ATTRIBUTION: Map conversions to sources, identify best channels
- STRATEGIC_BRIEFING: Executive summary for Jasper to relay to the human

## OUTPUTS
Your outputs are strategic directives. Each one includes:
- What to change
- Why (data backing)
- Expected impact
- Which manager/specialist should execute it`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const GROWTH_STRATEGIST_CONFIG: SpecialistConfig = {
  identity: {
    id: 'GROWTH_STRATEGIST',
    name: 'Growth Strategist',
    role: 'standalone',
    status: 'FUNCTIONAL',
    reportsTo: null,
    capabilities: [
      'business_review',
      'seo_strategy',
      'ad_spend_analysis',
      'demographic_targeting',
      'channel_attribution',
      'strategic_briefing',
      'cross_domain_synthesis',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['aggregate_data', 'analyze_channels', 'generate_strategy', 'produce_briefing'],
  outputSchema: {
    type: 'object',
    properties: {
      snapshot: { type: 'object' },
      directives: { type: 'array' },
      briefing: { type: 'string' },
      recommendations: { type: 'array' },
    },
  },
  maxTokens: 4096,
  temperature: 0.3,
};

// ============================================================================
// TYPES
// ============================================================================

type StrategyTaskType =
  | 'BUSINESS_REVIEW'
  | 'SEO_STRATEGY'
  | 'AD_SPEND_ANALYSIS'
  | 'DEMOGRAPHIC_TARGETING'
  | 'CHANNEL_ATTRIBUTION'
  | 'STRATEGIC_BRIEFING';

export interface StrategicDirective {
  id: string;
  type: StrategyTaskType;
  targetManager: string;
  action: string;
  rationale: string;
  expectedImpact: string;
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  confidence: number; // 0-100
  createdAt: Date;
}

export interface StrategicBriefing {
  briefingId: string;
  generatedAt: string;
  snapshot: BusinessSnapshot;
  directives: StrategicDirective[];
  executiveSummary: string;
  topPriorities: string[];
  risksAndWarnings: string[];
}

// ---------------------------------------------------------------------------
// GROWTH STRATEGIST LLM RESPONSE SCHEMAS
// ---------------------------------------------------------------------------

const BusinessReviewLLMSchema = z.object({
  healthScore: z.number().min(0).max(100),
  executiveSummary: z.string().min(20).max(2000),
  keyFindings: z.array(z.string().min(10).max(400)).min(1).max(10),
  directives: z.array(z.object({
    targetManager: z.string().min(2).max(80),
    action: z.string().min(10).max(400),
    rationale: z.string().min(10).max(400),
    expectedImpact: z.string().min(10).max(400),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    confidence: z.number().min(0).max(100),
  })).min(1).max(10),
  risksAndWarnings: z.array(z.string().min(10).max(400)).min(0).max(6),
});

const SEOStrategyLLMSchema = z.object({
  seoHealth: z.enum(['strong', 'growing', 'weak', 'inactive']),
  strategySummary: z.string().min(20).max(1000),
  keywordOpportunities: z.array(z.string().min(5).max(200)).min(1).max(8),
  contentGaps: z.array(z.string().min(5).max(200)).min(0).max(6),
  directives: z.array(z.object({
    targetManager: z.string().min(2).max(80),
    action: z.string().min(10).max(400),
    rationale: z.string().min(10).max(400),
    expectedImpact: z.string().min(10).max(400),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    confidence: z.number().min(0).max(100),
  })).min(1).max(8),
});

const AdSpendLLMSchema = z.object({
  budgetRecommendation: z.string().min(20).max(1000),
  channelAssessments: z.array(z.object({
    channel: z.string().min(2).max(80),
    verdict: z.enum(['scale', 'maintain', 'reduce', 'pause']),
    reasoning: z.string().min(10).max(400),
  })).min(1).max(10),
  directives: z.array(z.object({
    targetManager: z.string().min(2).max(80),
    action: z.string().min(10).max(400),
    rationale: z.string().min(10).max(400),
    expectedImpact: z.string().min(10).max(400),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    confidence: z.number().min(0).max(100),
  })).min(1).max(10),
});

const ChannelAttributionLLMSchema = z.object({
  attributionNarrative: z.string().min(20).max(1000),
  channelInsights: z.array(z.object({
    channel: z.string().min(2).max(80),
    revenueShare: z.number().min(0).max(100),
    qualityAssessment: z.string().min(10).max(400),
    recommendation: z.string().min(10).max(400),
  })).min(1).max(10),
  topChannel: z.string().min(2).max(80),
  underutilizedChannels: z.array(z.string().min(2).max(80)).min(0).max(5),
  directives: z.array(z.object({
    targetManager: z.string().min(2).max(80),
    action: z.string().min(10).max(400),
    rationale: z.string().min(10).max(400),
    expectedImpact: z.string().min(10).max(400),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    confidence: z.number().min(0).max(100),
  })).min(1).max(8),
});

const StrategicBriefingLLMSchema = z.object({
  executiveSummary: z.string().min(50).max(3000),
  topPriorities: z.array(z.string().min(10).max(400)).min(1).max(6),
  risksAndWarnings: z.array(z.string().min(10).max(400)).min(0).max(6),
  quickWins: z.array(z.string().min(10).max(400)).min(0).max(4),
  thirtyDayOutlook: z.string().min(20).max(800),
  directives: z.array(z.object({
    targetManager: z.string().min(2).max(80),
    action: z.string().min(10).max(400),
    rationale: z.string().min(10).max(400),
    expectedImpact: z.string().min(10).max(400),
    priority: z.enum(['HIGH', 'MEDIUM', 'LOW']),
    confidence: z.number().min(0).max(100),
  })).min(1).max(10),
});

// ---------------------------------------------------------------------------
// DEMOGRAPHIC PERSONA — Zod schema + inferred type
// ---------------------------------------------------------------------------

const DemographicPersonaSchema = z.object({
  who: z.object({
    jobTitles: z.array(z.string()),
    companySizeRange: z.string(),
    ageRange: z.string(),
    incomeBracket: z.string(),
    decisionMakingAuthority: z.string(),
  }),
  whereToReachThem: z.object({
    primaryPlatforms: z.array(z.string()),
    linkedInVsTwitter: z.string(),
    emailVsSocial: z.string(),
    platformNotes: z.string(),
  }),
  whenToReachThem: z.object({
    bestDaysForPosting: z.array(z.string()),
    bestTimesForPosting: z.array(z.string()),
    bestTimesForEmail: z.string(),
    adSchedulingRecommendation: z.string(),
  }),
  psychographics: z.object({
    coreValues: z.array(z.string()),
    primaryMotivations: z.array(z.string()),
    mainPainPoints: z.array(z.string()),
    buyingTriggers: z.array(z.string()),
    riskTolerance: z.enum(['low', 'medium', 'high']),
  }),
  messagingAngle: z.object({
    resonantLanguage: z.array(z.string()),
    languageToAvoid: z.array(z.string()),
    emotionalVsLogical: z.string(),
    primaryEmotionalHook: z.string(),
    suggestedHeadlines: z.array(z.string()),
  }),
  politicalCulturalProfile: z.object({
    politicalLean: z.enum(['conservative', 'moderate', 'progressive', 'mixed']),
    geographicProfile: z.enum(['urban', 'suburban', 'rural', 'mixed']),
    techForwardness: z.enum(['tech-forward', 'traditional', 'mixed']),
    adToneImplication: z.string(),
  }),
  contentPreferences: z.object({
    formatPreference: z.enum(['short-form', 'long-form', 'mixed']),
    mediumPreference: z.enum(['video', 'text', 'mixed']),
    stylePreference: z.enum(['educational', 'entertaining', 'mixed']),
    topContentFormats: z.array(z.string()),
  }),
  budgetSensitivity: z.object({
    orientation: z.enum(['price-conscious', 'value-driven', 'premium-seeking']),
    typicalDealSize: z.string(),
    decisionTimeline: z.string(),
    approvalProcess: z.string(),
  }),
  confidence: z.number().min(0).max(100),
  dataBasis: z.string(),
});

export type DemographicPersona = z.infer<typeof DemographicPersonaSchema>;

// ============================================================================
// SPECIALIST CLASS
// ============================================================================

export class GrowthStrategist extends BaseSpecialist {
  private lastSnapshot: BusinessSnapshot | null = null;

  constructor() {
    super(GROWTH_STRATEGIST_CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    if (this.isInitialized) { return; }
    this.log('INFO', 'Growth Strategist initializing...');
    this.isInitialized = true;
    this.log('INFO', 'Growth Strategist ready');
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 450, boilerplate: 100 };
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const startTime = Date.now();
    const payload = message.payload as {
      taskType?: StrategyTaskType;
      periodDays?: number;
    };

    const taskType = payload.taskType ?? 'BUSINESS_REVIEW';
    const periodDays = payload.periodDays ?? 30;

    // Always start by aggregating fresh data
    const snapshot = await aggregateBusinessData(periodDays);
    this.lastSnapshot = snapshot;

    let result: Record<string, unknown>;

    switch (taskType) {
      case 'BUSINESS_REVIEW':
        result = await this.conductBusinessReview(snapshot);
        break;
      case 'SEO_STRATEGY':
        result = await this.analyzeSEOStrategy(snapshot);
        break;
      case 'AD_SPEND_ANALYSIS':
        result = await this.analyzeAdSpend(snapshot);
        break;
      case 'DEMOGRAPHIC_TARGETING':
        result = await this.analyzeDemographics(snapshot);
        break;
      case 'CHANNEL_ATTRIBUTION':
        result = await this.analyzeChannelAttribution(snapshot);
        break;
      case 'STRATEGIC_BRIEFING':
        result = await this.produceStrategicBriefing(snapshot);
        break;
      default:
        result = await this.conductBusinessReview(snapshot);
    }

    const duration = Date.now() - startTime;
    this.log('INFO', `Strategy task ${taskType} completed in ${duration}ms`);

    return this.createReport(message.id, 'COMPLETED', {
      taskType,
      periodDays,
      ...result,
      durationMs: duration,
    });
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const payload = signal.payload;
    this.log('INFO', `Received signal from ${signal.origin}: ${payload.type}`);

    // React to important business signals
    if (payload.type === 'ALERT') {
      // Re-run business review on alerts
      const snapshot = await aggregateBusinessData();
      const review = await this.conductBusinessReview(snapshot);
      return this.createReport(signal.id, 'COMPLETED', {
        action: 'alert_response_review',
        ...review,
      });
    }

    if (payload.type === 'QUERY') {
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
  // SHARED LLM HELPER
  // ==========================================================================

  /**
   * Load the Growth Strategist's Golden Master and call the LLM via OpenRouter.
   * Brand DNA is already baked into gm.config.systemPrompt at seed time —
   * no second Firestore call required (Standing Rule #1).
   */
  private async callGMLLM(userPrompt: string): Promise<string> {
    const { getActiveSpecialistGMByIndustry } = await import('@/lib/training/specialist-golden-master-service');
    const gmRecord = await getActiveSpecialistGMByIndustry('GROWTH_STRATEGIST', 'saas_sales_ops');
    if (!gmRecord) {
      throw new Error(
        'Growth Strategist GM not found. Run: node scripts/seed-growth-strategist-gm.js',
      );
    }
    const gmConfig = gmRecord.config as { systemPrompt?: string } | undefined;
    const resolvedSystemPrompt = gmConfig?.systemPrompt ?? gmRecord.systemPromptSnapshot ?? '';
    if (resolvedSystemPrompt.length < 100) {
      throw new Error(
        `Growth Strategist GM ${gmRecord.id} has no usable systemPrompt (length=${resolvedSystemPrompt.length}).`,
      );
    }

    const provider = new OpenRouterProvider(PLATFORM_ID);
    const response = await provider.chat({
      model: 'claude-sonnet-4.6',
      messages: [
        { role: 'system', content: resolvedSystemPrompt },
        { role: 'user', content: userPrompt },
      ],
      temperature: 0.3,
      maxTokens: 4096,
    });

    const rawContent = response.content
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/\s*```\s*$/i, '')
      .trim();

    if (rawContent.length === 0) {
      throw new Error('Growth Strategist: LLM returned empty response');
    }

    return rawContent;
  }

  // ==========================================================================
  // TASK HANDLERS
  // ==========================================================================

  private async conductBusinessReview(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    const fallbackHealthScore = this.calculateHealthScore(snapshot);

    // Primary path: LLM-driven business review using the GM's baked-in Brand DNA
    try {
      const snapshotContext = JSON.stringify({
        revenue: {
          mrr: snapshot.revenue.mrr,
          totalCustomers: snapshot.revenue.totalCustomers,
          revenueGrowthRate: snapshot.revenue.revenueGrowthRate,
          churnRate: snapshot.revenue.churnRate,
          ltv: snapshot.revenue.ltv,
          newCustomersThisPeriod: snapshot.revenue.newCustomersThisPeriod,
        },
        pipeline: {
          totalLeads: snapshot.pipeline.totalLeads,
          winRate: snapshot.pipeline.winRate,
          dealsPipeline: snapshot.pipeline.dealsPipeline,
          avgDealCycleDays: snapshot.pipeline.avgDealCycledays,
        },
        channels: snapshot.channels.map(c => ({
          channel: c.channel,
          roi: c.roi,
          revenue: c.revenue,
          conversionRate: c.conversionRate,
          costPerAcquisition: c.costPerAcquisition,
        })),
        seo: { organicTraffic: snapshot.seo.organicTraffic, domainAuthority: snapshot.seo.domainAuthority },
        social: { engagementRate: snapshot.social.engagementRate, topPlatform: snapshot.social.topPlatform },
        email: { openRate: snapshot.email.openRate, clickRate: snapshot.email.clickRate },
      }, null, 2);

      const userPrompt = `TASK: BUSINESS_REVIEW

Analyze the full business snapshot below and produce a cross-domain health assessment with strategic directives for the department managers.

## BUSINESS SNAPSHOT
${snapshotContext}

Respond with ONLY a valid JSON object:
{
  "healthScore": <0-100 integer representing overall business health>,
  "executiveSummary": "<2-4 sentence narrative summary of overall business health>",
  "keyFindings": ["<1-3 key findings, each a complete sentence>"],
  "directives": [
    {
      "targetManager": "<manager id, e.g. MARKETING_MANAGER>",
      "action": "<specific action to take>",
      "rationale": "<data-backed reason, cite specific numbers from snapshot>",
      "expectedImpact": "<what will improve and by how much>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "confidence": <0-100>
    }
  ],
  "risksAndWarnings": ["<risks or warning signals spotted in the data>"]
}`;

      const raw = await this.callGMLLM(userPrompt);
      const parsed: unknown = JSON.parse(raw);
      const llmResult = BusinessReviewLLMSchema.parse(parsed);

      const directives: StrategicDirective[] = llmResult.directives.map(d =>
        this.createDirective('BUSINESS_REVIEW', d.targetManager, d.action, d.rationale, d.expectedImpact, d.priority, d.confidence)
      );

      const vault = getMemoryVault();
      vault.write('STRATEGY', `business_review_${Date.now()}`, {
        snapshot,
        directives,
        recommendations: snapshot.topRecommendations,
      }, 'GROWTH_STRATEGIST', {
        tags: ['business-review', 'strategic-directive'],
        priority: 'HIGH',
      });

      return {
        healthScore: llmResult.healthScore,
        executiveSummary: llmResult.executiveSummary,
        keyFindings: llmResult.keyFindings,
        risksAndWarnings: llmResult.risksAndWarnings,
        directives,
        recommendations: snapshot.topRecommendations,
        analysisMethod: 'llm',
        snapshot: {
          mrr: snapshot.revenue.mrr,
          totalCustomers: snapshot.revenue.totalCustomers,
          pipeline: snapshot.pipeline.totalLeads,
          winRate: snapshot.pipeline.winRate,
          organicTraffic: snapshot.seo.organicTraffic,
          socialEngagement: snapshot.social.engagementRate,
          emailOpenRate: snapshot.email.openRate,
        },
      };
    } catch (err: unknown) {
      // Fallback: threshold-based directives
      this.log('WARN', `BUSINESS_REVIEW LLM call failed — using threshold fallback: ${err instanceof Error ? err.message : String(err)}`);

      const directives: StrategicDirective[] = [];

      if (snapshot.revenue.churnRate > 5) {
        directives.push(this.createDirective('BUSINESS_REVIEW', 'OUTREACH_MANAGER', 'Launch win-back email sequence for churned customers', `Churn rate at ${snapshot.revenue.churnRate}% exceeds 5% threshold`, 'Recover 10-15% of churned revenue', 'HIGH', 85));
      }
      if (snapshot.revenue.revenueGrowthRate < 0) {
        directives.push(this.createDirective('BUSINESS_REVIEW', 'REVENUE_DIRECTOR', 'Review pricing strategy and pipeline velocity', `Revenue declining at ${snapshot.revenue.revenueGrowthRate}%`, 'Stabilize revenue trajectory within 30 days', 'HIGH', 90));
      }
      if (snapshot.pipeline.winRate < 20 && snapshot.pipeline.totalLeads > 0) {
        directives.push(this.createDirective('BUSINESS_REVIEW', 'REVENUE_DIRECTOR', 'Tighten lead qualification criteria and improve sales process', `Win rate at ${snapshot.pipeline.winRate}% is below 20% threshold`, 'Improve win rate to 25%+ by qualifying better leads', 'HIGH', 80));
      }
      const bestChannel = snapshot.channels.reduce<{ channel: string; roi: number } | null>(
        (best, ch) => (!best || ch.roi > best.roi) ? { channel: ch.channel, roi: ch.roi } : best,
        null
      );
      if (bestChannel && bestChannel.roi > 100) {
        directives.push(this.createDirective('BUSINESS_REVIEW', 'MARKETING_MANAGER', `Increase investment in ${bestChannel.channel} channel`, `${bestChannel.channel} showing ${bestChannel.roi}% ROI — highest performer`, 'Scale winning channel for 2x revenue impact', 'MEDIUM', 75));
      }

      const vault = getMemoryVault();
      vault.write('STRATEGY', `business_review_${Date.now()}`, { snapshot, directives, recommendations: snapshot.topRecommendations }, 'GROWTH_STRATEGIST', { tags: ['business-review', 'strategic-directive'], priority: 'HIGH' });

      return {
        healthScore: fallbackHealthScore,
        directives,
        recommendations: snapshot.topRecommendations,
        analysisMethod: 'threshold-fallback',
        snapshot: {
          mrr: snapshot.revenue.mrr,
          totalCustomers: snapshot.revenue.totalCustomers,
          pipeline: snapshot.pipeline.totalLeads,
          winRate: snapshot.pipeline.winRate,
          organicTraffic: snapshot.seo.organicTraffic,
          socialEngagement: snapshot.social.engagementRate,
          emailOpenRate: snapshot.email.openRate,
        },
      };
    }
  }

  private async analyzeSEOStrategy(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    // Primary path: LLM-driven SEO strategy using the GM's baked-in Brand DNA
    try {
      const seoContext = JSON.stringify({
        organicTraffic: snapshot.seo.organicTraffic,
        domainAuthority: snapshot.seo.domainAuthority,
        topKeywords: snapshot.seo.topKeywords.slice(0, 10),
        channels: snapshot.channels.map(c => ({ channel: c.channel, roi: c.roi, revenue: c.revenue })),
        pipeline: { totalLeads: snapshot.pipeline.totalLeads, leadSources: snapshot.pipeline.leadSources.slice(0, 5) },
      }, null, 2);

      const userPrompt = `TASK: SEO_STRATEGY

Analyze the SEO and traffic data below and produce a strategic SEO directive with keyword opportunities and content gaps.

## SEO DATA
${seoContext}

Respond with ONLY a valid JSON object:
{
  "seoHealth": "<strong|growing|weak|inactive>",
  "strategySummary": "<2-3 sentence strategic overview of the SEO position>",
  "keywordOpportunities": ["<specific keyword or keyword cluster to target>"],
  "contentGaps": ["<topic or content type missing from the strategy>"],
  "directives": [
    {
      "targetManager": "<MARKETING_MANAGER|CONTENT_MANAGER|SEO_EXPERT>",
      "action": "<specific SEO action>",
      "rationale": "<data-backed rationale citing numbers from the snapshot>",
      "expectedImpact": "<expected traffic or ranking outcome>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "confidence": <0-100>
    }
  ]
}`;

      const raw = await this.callGMLLM(userPrompt);
      const parsed: unknown = JSON.parse(raw);
      const llmResult = SEOStrategyLLMSchema.parse(parsed);

      const directives: StrategicDirective[] = llmResult.directives.map(d =>
        this.createDirective('SEO_STRATEGY', d.targetManager, d.action, d.rationale, d.expectedImpact, d.priority, d.confidence)
      );

      await shareInsight('GROWTH_STRATEGIST', 'PERFORMANCE', 'SEO Strategy Update', llmResult.strategySummary, { confidence: 80, tags: ['seo-strategy'] });

      return {
        seoHealth: llmResult.seoHealth,
        strategySummary: llmResult.strategySummary,
        keywordOpportunities: llmResult.keywordOpportunities,
        contentGaps: llmResult.contentGaps,
        directives,
        currentMetrics: snapshot.seo,
        analysisMethod: 'llm',
      };
    } catch (err: unknown) {
      // Fallback: basic threshold directives
      this.log('WARN', `SEO_STRATEGY LLM call failed — using threshold fallback: ${err instanceof Error ? err.message : String(err)}`);

      const directives: StrategicDirective[] = [];
      if (snapshot.seo.organicTraffic === 0) {
        directives.push(this.createDirective('SEO_STRATEGY', 'MARKETING_MANAGER', 'Initiate content marketing campaign targeting high-intent keywords', 'Zero organic traffic detected — no SEO foundation exists', 'Establish organic traffic baseline within 60 days', 'HIGH', 90));
      }
      if (snapshot.seo.domainAuthority < 20) {
        directives.push(this.createDirective('SEO_STRATEGY', 'CONTENT_MANAGER', 'Produce high-quality backlink-worthy content (guides, tools, research)', `Domain authority at ${snapshot.seo.domainAuthority} — needs improvement`, 'Increase DA by 10+ points in 6 months', 'MEDIUM', 70));
      }

      await shareInsight('GROWTH_STRATEGIST', 'PERFORMANCE', 'SEO Strategy Update', `Organic traffic: ${snapshot.seo.organicTraffic}, DA: ${snapshot.seo.domainAuthority}, Keywords tracked: ${snapshot.seo.topKeywords.length}`, { confidence: 80, tags: ['seo-strategy'] });

      return {
        seoHealth: snapshot.seo.organicTraffic > 0 ? 'active' : 'inactive',
        directives,
        currentMetrics: snapshot.seo,
        analysisMethod: 'threshold-fallback',
      };
    }
  }

  private async analyzeAdSpend(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    const channels = snapshot.channels;
    const sortedByROI = [...channels].sort((a, b) => b.roi - a.roi);

    // Primary path: LLM-driven ad spend analysis using the GM's baked-in Brand DNA
    try {
      const channelContext = JSON.stringify(sortedByROI.map(c => ({
        channel: c.channel,
        roi: c.roi,
        revenue: c.revenue,
        conversions: c.conversions,
        conversionRate: c.conversionRate,
        costPerAcquisition: c.costPerAcquisition,
      })), null, 2);

      const userPrompt = `TASK: AD_SPEND_ANALYSIS

Analyze the channel performance data below and produce budget allocation recommendations that maximize ROI while cutting underperformers.

## CHANNEL DATA (sorted by ROI, highest first)
${channelContext}

## BUSINESS CONTEXT
Total channels: ${channels.length}
Profitable (ROI > 0): ${sortedByROI.filter(c => c.roi > 0).length}
Unprofitable (ROI ≤ 0): ${sortedByROI.filter(c => c.roi <= 0).length}

Respond with ONLY a valid JSON object:
{
  "budgetRecommendation": "<2-3 sentence overall budget allocation strategy>",
  "channelAssessments": [
    {
      "channel": "<channel name>",
      "verdict": "<scale|maintain|reduce|pause>",
      "reasoning": "<data-backed reasoning citing ROI and CPA numbers>"
    }
  ],
  "directives": [
    {
      "targetManager": "<MARKETING_MANAGER|REVENUE_DIRECTOR>",
      "action": "<specific budget action>",
      "rationale": "<data-backed rationale>",
      "expectedImpact": "<expected revenue or CPA improvement>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "confidence": <0-100>
    }
  ]
}`;

      const raw = await this.callGMLLM(userPrompt);
      const parsed: unknown = JSON.parse(raw);
      const llmResult = AdSpendLLMSchema.parse(parsed);

      const directives: StrategicDirective[] = llmResult.directives.map(d =>
        this.createDirective('AD_SPEND_ANALYSIS', d.targetManager, d.action, d.rationale, d.expectedImpact, d.priority, d.confidence)
      );

      return {
        totalChannels: channels.length,
        profitable: sortedByROI.filter(c => c.roi > 0).length,
        unprofitable: sortedByROI.filter(c => c.roi <= 0).length,
        budgetRecommendation: llmResult.budgetRecommendation,
        channelAssessments: llmResult.channelAssessments,
        directives,
        channelRankings: sortedByROI.map(c => ({ channel: c.channel, roi: c.roi, cpa: c.costPerAcquisition, revenue: c.revenue })),
        analysisMethod: 'llm',
      };
    } catch (err: unknown) {
      // Fallback: threshold-based channel scoring
      this.log('WARN', `AD_SPEND_ANALYSIS LLM call failed — using threshold fallback: ${err instanceof Error ? err.message : String(err)}`);

      const profitableChannels = sortedByROI.filter(c => c.roi > 0);
      const unprofitableChannels = sortedByROI.filter(c => c.roi <= 0);
      const directives: StrategicDirective[] = [];

      for (const channel of unprofitableChannels) {
        directives.push(this.createDirective('AD_SPEND_ANALYSIS', 'MARKETING_MANAGER', `Pause or reduce spend on ${channel.channel}`, `${channel.channel} has negative ROI of ${channel.roi}%`, 'Stop bleeding money on non-converting channel', 'HIGH', 85));
      }
      for (const channel of profitableChannels.slice(0, 3)) {
        if (channel.roi > 100) {
          directives.push(this.createDirective('AD_SPEND_ANALYSIS', 'MARKETING_MANAGER', `Increase budget allocation to ${channel.channel} by 25-50%`, `${channel.channel} producing ${channel.roi}% ROI with CPA of $${channel.costPerAcquisition}`, 'Scale proven channel for higher revenue', 'MEDIUM', 75));
        }
      }

      return {
        totalChannels: channels.length,
        profitable: profitableChannels.length,
        unprofitable: unprofitableChannels.length,
        directives,
        channelRankings: sortedByROI.map(c => ({ channel: c.channel, roi: c.roi, cpa: c.costPerAcquisition, revenue: c.revenue })),
        analysisMethod: 'threshold-fallback',
      };
    }
  }

  private async analyzeDemographics(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    // ------------------------------------------------------------------
    // Primary path: AI-generated deep demographic persona via OpenRouter.
    // Per the standing rule (CLAUDE.md), Brand DNA is baked into the
    // Growth Strategist's Golden Master at seed time — we load ONE doc
    // from Firestore, not two.
    // ------------------------------------------------------------------
    try {
      // Load the GM — Brand DNA is already baked into gmRecord.config.systemPrompt
      const { getActiveSpecialistGMByIndustry } = await import('@/lib/training/specialist-golden-master-service');
      const gmRecord = await getActiveSpecialistGMByIndustry('GROWTH_STRATEGIST', 'saas_sales_ops');
      if (!gmRecord) {
        throw new Error(
          'Growth Strategist GM not found. Run: node scripts/seed-growth-strategist-gm.js to seed.',
        );
      }
      const gmConfig = gmRecord.config as { systemPrompt?: string } | undefined;
      const resolvedSystemPrompt = gmConfig?.systemPrompt ?? gmRecord.systemPromptSnapshot ?? '';
      if (resolvedSystemPrompt.length < 100) {
        throw new Error(
          `Growth Strategist GM ${gmRecord.id} has no usable systemPrompt (length=${resolvedSystemPrompt.length}).`,
        );
      }

      // Build a rich context block to ground the AI analysis
      const snapshotContext = JSON.stringify({
        revenue: {
          mrr: snapshot.revenue.mrr,
          totalCustomers: snapshot.revenue.totalCustomers,
          newCustomersThisPeriod: snapshot.revenue.newCustomersThisPeriod,
          churnRate: snapshot.revenue.churnRate,
          ltv: snapshot.revenue.ltv,
          averageOrderValue: snapshot.revenue.averageOrderValue,
        },
        pipeline: {
          totalLeads: snapshot.pipeline.totalLeads,
          winRate: snapshot.pipeline.winRate,
          dealsPipeline: snapshot.pipeline.dealsPipeline,
          avgDealCycleDays: snapshot.pipeline.avgDealCycledays,
          topLeadSources: snapshot.pipeline.leadSources
            .sort((a, b) => b.conversionRate - a.conversionRate)
            .slice(0, 5),
        },
        social: {
          topPlatform: snapshot.social.topPlatform,
          engagementRate: snapshot.social.engagementRate,
          totalFollowers: snapshot.social.totalFollowers,
          platforms: snapshot.social.platforms,
        },
        email: {
          openRate: snapshot.email.openRate,
          clickRate: snapshot.email.clickRate,
          totalSubscribers: snapshot.email.totalSubscribers,
        },
        channels: snapshot.channels.map(c => ({
          channel: c.channel,
          conversionRate: c.conversionRate,
          roi: c.roi,
          costPerAcquisition: c.costPerAcquisition,
        })),
        seo: {
          organicTraffic: snapshot.seo.organicTraffic,
          topKeywords: snapshot.seo.topKeywords.slice(0, 10),
          domainAuthority: snapshot.seo.domainAuthority,
        },
      }, null, 2);

      // Brand DNA is already in resolvedSystemPrompt (baked in at seed time) —
      // no need to rebuild a brandContext block in the user prompt.

      const userPrompt = `Analyze the following business data to generate a comprehensive marketing persona. Use the Brand DNA section of your system prompt for tenant-specific identity.

## BUSINESS SNAPSHOT (Last 30 Days)
${snapshotContext}

## REQUIRED OUTPUT SCHEMA
Respond with ONLY a JSON object with these exact fields:

{
  "who": {
    "jobTitles": ["array of specific job titles that buy this product"],
    "companySizeRange": "e.g. 10-200 employees (SMB)",
    "ageRange": "e.g. 32-52",
    "incomeBracket": "e.g. $75k-$200k household income",
    "decisionMakingAuthority": "e.g. Final decision-maker, budget owner"
  },
  "whereToReachThem": {
    "primaryPlatforms": ["ranked list of platforms"],
    "linkedInVsTwitter": "LinkedIn strongly preferred — explain why",
    "emailVsSocial": "Email first — explain why",
    "platformNotes": "Specific notes on platform behavior"
  },
  "whenToReachThem": {
    "bestDaysForPosting": ["Tuesday", "Wednesday", "Thursday"],
    "bestTimesForPosting": ["7-9am EST", "12-1pm EST"],
    "bestTimesForEmail": "Tuesday 9-11am EST",
    "adSchedulingRecommendation": "Specific scheduling strategy"
  },
  "psychographics": {
    "coreValues": ["array of 3-5 values"],
    "primaryMotivations": ["array of top motivations"],
    "mainPainPoints": ["array of top pain points"],
    "buyingTriggers": ["array of what pushes them to buy"],
    "riskTolerance": "low|medium|high"
  },
  "messagingAngle": {
    "resonantLanguage": ["phrases and words that resonate"],
    "languageToAvoid": ["phrases that turn them off"],
    "emotionalVsLogical": "e.g. 70% logical, 30% emotional — explain",
    "primaryEmotionalHook": "The single strongest emotional angle",
    "suggestedHeadlines": ["3-5 sample ad/email headlines"]
  },
  "politicalCulturalProfile": {
    "politicalLean": "conservative|moderate|progressive|mixed",
    "geographicProfile": "urban|suburban|rural|mixed",
    "techForwardness": "tech-forward|traditional|mixed",
    "adToneImplication": "How the above should shape your ad tone and creative"
  },
  "contentPreferences": {
    "formatPreference": "short-form|long-form|mixed",
    "mediumPreference": "video|text|mixed",
    "stylePreference": "educational|entertaining|mixed",
    "topContentFormats": ["e.g. case studies", "LinkedIn posts", "short demo videos"]
  },
  "budgetSensitivity": {
    "orientation": "price-conscious|value-driven|premium-seeking",
    "typicalDealSize": "e.g. $500-$2,000/month",
    "decisionTimeline": "e.g. 2-4 weeks average",
    "approvalProcess": "e.g. Single decision-maker, no committee"
  },
  "confidence": 82,
  "dataBasis": "Brief explanation of how confident you are and what data you relied on"
}`;

      const provider = new OpenRouterProvider(PLATFORM_ID);
      const response = await provider.chat({
        model: 'claude-sonnet-4.6',
        messages: [
          { role: 'system', content: resolvedSystemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        maxTokens: 3000,
      });

      // Strip any markdown code fences the model may have wrapped the JSON in
      const rawContent = response.content
        .replace(/^```(?:json)?\s*/i, '')
        .replace(/\s*```\s*$/i, '')
        .trim();

      const parsed: unknown = JSON.parse(rawContent);
      const persona = DemographicPersonaSchema.parse(parsed);

      // Build strategic directives from the persona findings
      const directives: StrategicDirective[] = [];

      directives.push(this.createDirective(
        'DEMOGRAPHIC_TARGETING',
        'MARKETING_MANAGER',
        `Target ${persona.who.jobTitles.slice(0, 3).join(', ')} on ${persona.whereToReachThem.primaryPlatforms[0] ?? 'LinkedIn'}`,
        `AI persona analysis (confidence: ${persona.confidence}%) identified ${persona.who.jobTitles[0] ?? 'decision-makers'} at ${persona.who.companySizeRange} companies as the highest-fit audience`,
        'Improve ad targeting precision and reduce cost-per-acquisition',
        'HIGH',
        persona.confidence
      ));

      directives.push(this.createDirective(
        'DEMOGRAPHIC_TARGETING',
        'CONTENT_MANAGER',
        `Produce ${persona.contentPreferences.topContentFormats[0] ?? 'case studies'} and ${persona.contentPreferences.topContentFormats[1] ?? 'LinkedIn posts'} as primary content formats`,
        `Persona prefers ${persona.contentPreferences.formatPreference} ${persona.contentPreferences.mediumPreference} content with ${persona.contentPreferences.stylePreference} style`,
        'Increase content engagement by matching format to audience preference',
        'MEDIUM',
        Math.round(persona.confidence * 0.9)
      ));

      directives.push(this.createDirective(
        'DEMOGRAPHIC_TARGETING',
        'MARKETING_MANAGER',
        `Schedule email sends on ${persona.whenToReachThem.bestTimesForEmail} and social posts on ${persona.whenToReachThem.bestDaysForPosting.slice(0, 2).join('/')}`,
        `Timing analysis for ${persona.who.jobTitles[0] ?? 'target persona'} shows peak engagement windows`,
        'Lift open and engagement rates by 15-25% through precise timing',
        'MEDIUM',
        75
      ));

      directives.push(this.createDirective(
        'DEMOGRAPHIC_TARGETING',
        'MARKETING_MANAGER',
        `Lead messaging with: "${persona.messagingAngle.primaryEmotionalHook}" — ${persona.messagingAngle.emotionalVsLogical}`,
        `Persona responds to ${persona.psychographics.coreValues.slice(0, 2).join(' and ')} framing with primary pain points: ${persona.psychographics.mainPainPoints.slice(0, 2).join(', ')}`,
        'Improve ad click-through rate and landing page conversion by aligning copy to persona psychology',
        'HIGH',
        Math.round(persona.confidence * 0.85)
      ));

      // Persist persona to MemoryVault under PROFILE category so other agents can reference it
      const vault = getMemoryVault();
      vault.write('PROFILE', `marketing_persona_${Date.now()}`, {
        persona,
        snapshot: {
          mrr: snapshot.revenue.mrr,
          totalCustomers: snapshot.revenue.totalCustomers,
          topLeadSource: snapshot.pipeline.leadSources[0]?.source ?? 'unknown',
        },
        directives,
        generatedAt: new Date().toISOString(),
        platformId: PLATFORM_ID,
      }, 'GROWTH_STRATEGIST', {
        tags: ['demographic-persona', 'marketing-persona', 'cmo-analysis', 'jasper-accessible'],
        priority: 'HIGH',
      });

      // Share as a cross-agent insight
      await shareInsight(
        'GROWTH_STRATEGIST',
        'AUDIENCE',
        'Marketing Persona Generated',
        `Target: ${persona.who.jobTitles.slice(0, 2).join(', ')} at ${persona.who.companySizeRange}. ` +
        `Reach via ${persona.whereToReachThem.primaryPlatforms.slice(0, 2).join(' and ')}. ` +
        `Primary hook: ${persona.messagingAngle.primaryEmotionalHook}. ` +
        `Budget orientation: ${persona.budgetSensitivity.orientation}.`,
        {
          confidence: persona.confidence,
          tags: ['demographic-persona', 'marketing-persona', 'jasper-accessible'],
          actions: directives.map(d => d.action),
        }
      );

      return {
        persona,
        directives,
        topLeadSources: snapshot.pipeline.leadSources
          .sort((a, b) => b.conversionRate - a.conversionRate)
          .slice(0, 5),
        currentCustomerCount: snapshot.revenue.totalCustomers,
        newCustomersThisPeriod: snapshot.revenue.newCustomersThisPeriod,
        analysisMethod: 'ai-persona',
      };
    } catch (aiError: unknown) {
      // ------------------------------------------------------------------
      // Fallback path: simple lead-source conversion analysis
      // ------------------------------------------------------------------
      this.log(
        'WARN',
        `AI demographic analysis failed — falling back to lead-source heuristics: ${aiError instanceof Error ? aiError.message : String(aiError)}`
      );

      const directives: StrategicDirective[] = [];

      const topSources = snapshot.pipeline.leadSources
        .sort((a, b) => b.conversionRate - a.conversionRate)
        .slice(0, 5);

      if (topSources.length > 0) {
        const bestSource = topSources[0];
        directives.push(this.createDirective(
          'DEMOGRAPHIC_TARGETING',
          'MARKETING_MANAGER',
          `Focus targeting on audiences similar to ${bestSource.source} leads`,
          `${bestSource.source} has ${bestSource.conversionRate}% conversion rate — highest of all sources`,
          'Improve overall conversion rate by focusing on proven demographics',
          'MEDIUM',
          70
        ));
      }

      return {
        topLeadSources: topSources,
        directives,
        currentCustomerCount: snapshot.revenue.totalCustomers,
        newCustomersThisPeriod: snapshot.revenue.newCustomersThisPeriod,
        analysisMethod: 'fallback-heuristic',
      };
    }
  }

  private async analyzeChannelAttribution(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    const channels = snapshot.channels;
    const totalRevenue = channels.reduce((sum, c) => sum + c.revenue, 0);
    const attribution = channels.map(c => ({
      channel: c.channel,
      revenue: c.revenue,
      revenueShare: totalRevenue > 0 ? Math.round((c.revenue / totalRevenue) * 100 * 10) / 10 : 0,
      conversions: c.conversions,
      conversionRate: c.conversionRate,
      roi: c.roi,
    }));

    // Primary path: LLM-driven attribution analysis using the GM's baked-in Brand DNA
    try {
      const attributionContext = JSON.stringify({
        totalRevenue,
        channels: attribution,
        leadSources: snapshot.pipeline.leadSources.slice(0, 8),
        pipeline: { totalLeads: snapshot.pipeline.totalLeads, winRate: snapshot.pipeline.winRate },
      }, null, 2);

      const userPrompt = `TASK: CHANNEL_ATTRIBUTION

Analyze the multi-channel attribution data below. Go beyond arithmetic revenue shares — reason about channel quality, lead-to-close efficiency, and underutilized channels.

## ATTRIBUTION DATA
${attributionContext}

Respond with ONLY a valid JSON object:
{
  "attributionNarrative": "<2-3 sentence narrative explaining what the attribution data reveals>",
  "channelInsights": [
    {
      "channel": "<channel name>",
      "revenueShare": <0-100 number>,
      "qualityAssessment": "<insight beyond raw share — e.g. high revenue but low conversion, low share but high ROI>",
      "recommendation": "<specific action for this channel>"
    }
  ],
  "topChannel": "<name of the strategically most important channel>",
  "underutilizedChannels": ["<channels with potential that are underinvested>"],
  "directives": [
    {
      "targetManager": "<MARKETING_MANAGER|REVENUE_DIRECTOR|OUTREACH_MANAGER>",
      "action": "<specific attribution-informed action>",
      "rationale": "<cite specific channel data>",
      "expectedImpact": "<expected revenue or efficiency improvement>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "confidence": <0-100>
    }
  ]
}`;

      const raw = await this.callGMLLM(userPrompt);
      const parsed: unknown = JSON.parse(raw);
      const llmResult = ChannelAttributionLLMSchema.parse(parsed);

      const directives: StrategicDirective[] = llmResult.directives.map(d =>
        this.createDirective('CHANNEL_ATTRIBUTION', d.targetManager, d.action, d.rationale, d.expectedImpact, d.priority, d.confidence)
      );

      return {
        totalRevenue,
        attribution,
        attributionNarrative: llmResult.attributionNarrative,
        channelInsights: llmResult.channelInsights,
        topChannel: llmResult.topChannel,
        underutilizedChannels: llmResult.underutilizedChannels,
        directives,
        analysisMethod: 'llm',
      };
    } catch (err: unknown) {
      // Fallback: arithmetic attribution only
      this.log('WARN', `CHANNEL_ATTRIBUTION LLM call failed — using arithmetic fallback: ${err instanceof Error ? err.message : String(err)}`);

      const sortedByShare = [...attribution].sort((a, b) => b.revenueShare - a.revenueShare);
      return {
        totalRevenue,
        attribution,
        topChannel: sortedByShare[0] ?? null,
        analysisMethod: 'arithmetic-fallback',
      };
    }
  }

  private async produceStrategicBriefing(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    const review = await this.conductBusinessReview(snapshot);
    const healthScore = review.healthScore as number;
    const directives = review.directives as StrategicDirective[];

    // Primary path: LLM-driven strategic briefing using the GM's baked-in Brand DNA
    try {
      const briefingContext = JSON.stringify({
        healthScore,
        revenue: {
          mrr: snapshot.revenue.mrr,
          totalCustomers: snapshot.revenue.totalCustomers,
          revenueGrowthRate: snapshot.revenue.revenueGrowthRate,
          churnRate: snapshot.revenue.churnRate,
        },
        pipeline: {
          totalLeads: snapshot.pipeline.totalLeads,
          winRate: snapshot.pipeline.winRate,
          dealsPipeline: snapshot.pipeline.dealsPipeline,
        },
        channels: snapshot.channels.map(c => ({ channel: c.channel, roi: c.roi, revenue: c.revenue })),
        seo: { organicTraffic: snapshot.seo.organicTraffic, domainAuthority: snapshot.seo.domainAuthority },
        social: { engagementRate: snapshot.social.engagementRate, topPlatform: snapshot.social.topPlatform },
        email: { openRate: snapshot.email.openRate },
        existingDirectives: directives.map(d => ({ action: d.action, priority: d.priority, targetManager: d.targetManager })),
        topRecommendations: snapshot.topRecommendations,
      }, null, 2);

      const userPrompt = `TASK: STRATEGIC_BRIEFING

Synthesize the full business review data below into a concise executive briefing that Jasper can relay to the human operator. Be specific, cite numbers, and tell a coherent growth story.

## BUSINESS REVIEW DATA
${briefingContext}

Respond with ONLY a valid JSON object:
{
  "executiveSummary": "<3-5 sentence executive narrative: where we are, what's working, what needs fixing, what to do next>",
  "topPriorities": ["<the 3-5 most important things to act on this period>"],
  "risksAndWarnings": ["<risks or warning signals that need operator attention>"],
  "quickWins": ["<actions that can move a metric within 7-14 days>"],
  "thirtyDayOutlook": "<1-2 sentence projection: if current directives are executed, what should improve in 30 days>",
  "directives": [
    {
      "targetManager": "<manager id>",
      "action": "<specific high-priority action>",
      "rationale": "<data-backed rationale>",
      "expectedImpact": "<expected outcome>",
      "priority": "<HIGH|MEDIUM|LOW>",
      "confidence": <0-100>
    }
  ]
}`;

      const raw = await this.callGMLLM(userPrompt);
      const parsed: unknown = JSON.parse(raw);
      const llmResult = StrategicBriefingLLMSchema.parse(parsed);

      const llmDirectives: StrategicDirective[] = llmResult.directives.map(d =>
        this.createDirective('STRATEGIC_BRIEFING', d.targetManager, d.action, d.rationale, d.expectedImpact, d.priority, d.confidence)
      );

      const briefing: StrategicBriefing = {
        briefingId: `strat_brief_${Date.now()}`,
        generatedAt: new Date().toISOString(),
        snapshot,
        directives: llmDirectives,
        executiveSummary: llmResult.executiveSummary,
        topPriorities: llmResult.topPriorities,
        risksAndWarnings: llmResult.risksAndWarnings,
      };

      const vault = getMemoryVault();
      vault.write('STRATEGY', `strategic_briefing_${briefing.briefingId}`, briefing, 'GROWTH_STRATEGIST', {
        tags: ['strategic-briefing', 'executive-summary', 'jasper-accessible'],
        priority: 'HIGH',
      });

      await shareInsight('GROWTH_STRATEGIST', 'PERFORMANCE', 'Strategic Briefing Ready', llmResult.executiveSummary, { confidence: 90, tags: ['strategic-briefing', 'jasper-accessible'] });

      return {
        briefing,
        healthScore,
        directiveCount: llmDirectives.length,
        highPriorityCount: llmResult.topPriorities.length,
        quickWins: llmResult.quickWins,
        thirtyDayOutlook: llmResult.thirtyDayOutlook,
        analysisMethod: 'llm',
      };
    } catch (err: unknown) {
      // Fallback: template-based summary using review directives
      this.log('WARN', `STRATEGIC_BRIEFING LLM call failed — using template fallback: ${err instanceof Error ? err.message : String(err)}`);

      const executiveSummary = this.buildExecutiveSummary(snapshot, healthScore, directives);

      const briefing: StrategicBriefing = {
        briefingId: `strat_brief_${Date.now()}`,
        generatedAt: new Date().toISOString(),
        snapshot,
        directives,
        executiveSummary,
        topPriorities: directives.filter(d => d.priority === 'HIGH').map(d => d.action),
        risksAndWarnings: snapshot.topRecommendations.filter(r =>
          r.toLowerCase().includes('decline') || r.toLowerCase().includes('negative') || r.toLowerCase().includes('below')
        ),
      };

      const vault = getMemoryVault();
      vault.write('STRATEGY', `strategic_briefing_${briefing.briefingId}`, briefing, 'GROWTH_STRATEGIST', { tags: ['strategic-briefing', 'executive-summary', 'jasper-accessible'], priority: 'HIGH' });

      await shareInsight('GROWTH_STRATEGIST', 'PERFORMANCE', 'Strategic Briefing Ready', executiveSummary, { confidence: 90, tags: ['strategic-briefing', 'jasper-accessible'] });

      return {
        briefing,
        healthScore,
        directiveCount: directives.length,
        highPriorityCount: briefing.topPriorities.length,
        analysisMethod: 'template-fallback',
      };
    }
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  private calculateHealthScore(snapshot: BusinessSnapshot): number {
    let score = 50; // Start at neutral

    // Revenue health (±20)
    if (snapshot.revenue.mrr > 0) { score += 10; }
    if (snapshot.revenue.revenueGrowthRate > 0) { score += 10; }
    if (snapshot.revenue.churnRate > 5) { score -= 10; }
    if (snapshot.revenue.churnRate > 10) { score -= 10; }

    // Pipeline health (±15)
    if (snapshot.pipeline.totalLeads > 0) { score += 5; }
    if (snapshot.pipeline.winRate > 20) { score += 10; }
    if (snapshot.pipeline.winRate < 10 && snapshot.pipeline.totalLeads > 0) { score -= 10; }

    // SEO health (±10)
    if (snapshot.seo.organicTraffic > 0) { score += 5; }
    if (snapshot.seo.domainAuthority > 20) { score += 5; }

    // Social health (±5)
    if (snapshot.social.engagementRate > 2) { score += 5; }

    // Email health (±5)
    if (snapshot.email.openRate > 20) { score += 5; }

    return Math.max(0, Math.min(100, score));
  }

  private buildExecutiveSummary(
    snapshot: BusinessSnapshot,
    healthScore: number,
    directives: StrategicDirective[]
  ): string {
    const highPriority = directives.filter(d => d.priority === 'HIGH').length;
    const healthLabel = healthScore >= 75 ? 'strong' : healthScore >= 50 ? 'moderate' : 'needs attention';

    let summary = `Business health: ${healthScore}/100 (${healthLabel}).`;

    if (snapshot.revenue.mrr > 0) {
      summary += ` MRR: $${snapshot.revenue.mrr.toLocaleString()}.`;
    }
    if (snapshot.revenue.totalCustomers > 0) {
      summary += ` ${snapshot.revenue.totalCustomers} active customers.`;
    }
    if (snapshot.pipeline.totalLeads > 0) {
      summary += ` Pipeline: ${snapshot.pipeline.totalLeads} leads, ${snapshot.pipeline.winRate}% win rate.`;
    }
    if (highPriority > 0) {
      summary += ` ${highPriority} high-priority action${highPriority > 1 ? 's' : ''} recommended.`;
    }

    return summary;
  }

  private createDirective(
    type: StrategyTaskType,
    targetManager: string,
    action: string,
    rationale: string,
    expectedImpact: string,
    priority: 'HIGH' | 'MEDIUM' | 'LOW',
    confidence: number
  ): StrategicDirective {
    return {
      id: `dir_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      type,
      targetManager,
      action,
      rationale,
      expectedImpact,
      priority,
      confidence,
      createdAt: new Date(),
    };
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: GrowthStrategist | null = null;

export function getGrowthStrategist(): GrowthStrategist {
  instance ??= new GrowthStrategist();
  return instance;
}
