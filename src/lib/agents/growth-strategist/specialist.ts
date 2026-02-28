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
  // TASK HANDLERS
  // ==========================================================================

  private async conductBusinessReview(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    await Promise.resolve();
    const directives: StrategicDirective[] = [];

    // Revenue analysis
    if (snapshot.revenue.churnRate > 5) {
      directives.push(this.createDirective(
        'BUSINESS_REVIEW',
        'OUTREACH_MANAGER',
        'Launch win-back email sequence for churned customers',
        `Churn rate at ${snapshot.revenue.churnRate}% exceeds 5% threshold`,
        'Recover 10-15% of churned revenue',
        'HIGH',
        85
      ));
    }

    if (snapshot.revenue.revenueGrowthRate < 0) {
      directives.push(this.createDirective(
        'BUSINESS_REVIEW',
        'REVENUE_DIRECTOR',
        'Review pricing strategy and pipeline velocity',
        `Revenue declining at ${snapshot.revenue.revenueGrowthRate}%`,
        'Stabilize revenue trajectory within 30 days',
        'HIGH',
        90
      ));
    }

    // Pipeline analysis
    if (snapshot.pipeline.winRate < 20 && snapshot.pipeline.totalLeads > 0) {
      directives.push(this.createDirective(
        'BUSINESS_REVIEW',
        'REVENUE_DIRECTOR',
        'Tighten lead qualification criteria and improve sales process',
        `Win rate at ${snapshot.pipeline.winRate}% is below 20% threshold`,
        'Improve win rate to 25%+ by qualifying better leads',
        'HIGH',
        80
      ));
    }

    // Channel analysis
    const bestChannel = snapshot.channels.reduce<{ channel: string; roi: number } | null>(
      (best, ch) => (!best || ch.roi > best.roi) ? { channel: ch.channel, roi: ch.roi } : best,
      null
    );

    if (bestChannel && bestChannel.roi > 100) {
      directives.push(this.createDirective(
        'BUSINESS_REVIEW',
        'MARKETING_MANAGER',
        `Increase investment in ${bestChannel.channel} channel`,
        `${bestChannel.channel} showing ${bestChannel.roi}% ROI — highest performer`,
        'Scale winning channel for 2x revenue impact',
        'MEDIUM',
        75
      ));
    }

    // Store business review in MemoryVault
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
      healthScore: this.calculateHealthScore(snapshot),
      directives,
      recommendations: snapshot.topRecommendations,
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

  private async analyzeSEOStrategy(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    const directives: StrategicDirective[] = [];

    if (snapshot.seo.organicTraffic === 0) {
      directives.push(this.createDirective(
        'SEO_STRATEGY',
        'MARKETING_MANAGER',
        'Initiate content marketing campaign targeting high-intent keywords',
        'Zero organic traffic detected — no SEO foundation exists',
        'Establish organic traffic baseline within 60 days',
        'HIGH',
        90
      ));
    }

    if (snapshot.seo.domainAuthority < 20) {
      directives.push(this.createDirective(
        'SEO_STRATEGY',
        'CONTENT_MANAGER',
        'Produce high-quality backlink-worthy content (guides, tools, research)',
        `Domain authority at ${snapshot.seo.domainAuthority} — needs improvement`,
        'Increase DA by 10+ points in 6 months',
        'MEDIUM',
        70
      ));
    }

    // Share insight for cross-agent visibility
    await shareInsight(
      'GROWTH_STRATEGIST',
      'PERFORMANCE',
      'SEO Strategy Update',
      `Organic traffic: ${snapshot.seo.organicTraffic}, DA: ${snapshot.seo.domainAuthority}, Keywords tracked: ${snapshot.seo.topKeywords.length}`,
      { confidence: 80, tags: ['seo-strategy'] }
    );

    return {
      seoHealth: snapshot.seo.organicTraffic > 0 ? 'active' : 'inactive',
      directives,
      currentMetrics: snapshot.seo,
    };
  }

  private async analyzeAdSpend(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    await Promise.resolve();
    const directives: StrategicDirective[] = [];
    const channels = snapshot.channels;

    // Sort channels by ROI
    const sortedByROI = [...channels].sort((a, b) => b.roi - a.roi);
    const profitableChannels = sortedByROI.filter(c => c.roi > 0);
    const unprofitableChannels = sortedByROI.filter(c => c.roi <= 0);

    // Kill underperformers
    for (const channel of unprofitableChannels) {
      directives.push(this.createDirective(
        'AD_SPEND_ANALYSIS',
        'MARKETING_MANAGER',
        `Pause or reduce spend on ${channel.channel}`,
        `${channel.channel} has negative ROI of ${channel.roi}%`,
        'Stop bleeding money on non-converting channel',
        'HIGH',
        85
      ));
    }

    // Scale winners
    for (const channel of profitableChannels.slice(0, 3)) {
      if (channel.roi > 100) {
        directives.push(this.createDirective(
          'AD_SPEND_ANALYSIS',
          'MARKETING_MANAGER',
          `Increase budget allocation to ${channel.channel} by 25-50%`,
          `${channel.channel} producing ${channel.roi}% ROI with CPA of $${channel.costPerAcquisition}`,
          'Scale proven channel for higher revenue',
          'MEDIUM',
          75
        ));
      }
    }

    return {
      totalChannels: channels.length,
      profitable: profitableChannels.length,
      unprofitable: unprofitableChannels.length,
      directives,
      channelRankings: sortedByROI.map(c => ({
        channel: c.channel,
        roi: c.roi,
        cpa: c.costPerAcquisition,
        revenue: c.revenue,
      })),
    };
  }

  private async analyzeDemographics(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    await Promise.resolve();
    const directives: StrategicDirective[] = [];

    // Analyze lead sources for demographic patterns
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
    };
  }

  private async analyzeChannelAttribution(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    await Promise.resolve();
    const channels = snapshot.channels;
    const totalRevenue = channels.reduce((sum, c) => sum + c.revenue, 0);

    const attribution = channels.map(c => ({
      channel: c.channel,
      revenue: c.revenue,
      revenueShare: totalRevenue > 0 ? ((c.revenue / totalRevenue) * 100) : 0,
      conversions: c.conversions,
      conversionRate: c.conversionRate,
      roi: c.roi,
    }));

    return {
      totalRevenue,
      attribution,
      topChannel: attribution.sort((a, b) => b.revenueShare - a.revenueShare)[0] ?? null,
    };
  }

  private async produceStrategicBriefing(
    snapshot: BusinessSnapshot
  ): Promise<Record<string, unknown>> {
    const review = await this.conductBusinessReview(snapshot);
    const healthScore = review.healthScore as number;
    const directives = review.directives as StrategicDirective[];

    const executiveSummary = this.buildExecutiveSummary(snapshot, healthScore, directives);

    const briefing: StrategicBriefing = {
      briefingId: `strat_brief_${Date.now()}`,
      generatedAt: new Date().toISOString(),
      snapshot,
      directives,
      executiveSummary,
      topPriorities: directives
        .filter(d => d.priority === 'HIGH')
        .map(d => d.action),
      risksAndWarnings: snapshot.topRecommendations.filter(r =>
        r.toLowerCase().includes('decline') ||
        r.toLowerCase().includes('negative') ||
        r.toLowerCase().includes('below')
      ),
    };

    // Store briefing in MemoryVault for Jasper to access
    const vault = getMemoryVault();
    vault.write('STRATEGY', `strategic_briefing_${briefing.briefingId}`, briefing, 'GROWTH_STRATEGIST', {
      tags: ['strategic-briefing', 'executive-summary', 'jasper-accessible'],
      priority: 'HIGH',
    });

    // Share insight so Jasper picks it up
    await shareInsight(
      'GROWTH_STRATEGIST',
      'PERFORMANCE',
      'Strategic Briefing Ready',
      executiveSummary,
      { confidence: 90, tags: ['strategic-briefing', 'jasper-accessible'] }
    );

    return {
      briefing,
      healthScore,
      directiveCount: directives.length,
      highPriorityCount: briefing.topPriorities.length,
    };
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
