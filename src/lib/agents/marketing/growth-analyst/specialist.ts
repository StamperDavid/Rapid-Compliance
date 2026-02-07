/**
 * Growth Analyst Specialist
 * STATUS: FUNCTIONAL
 *
 * L3 specialist under MARKETING_MANAGER. Analyzes social media performance
 * data, identifies patterns, generates mutation directives for content strategy,
 * and tracks progress against growth objectives.
 *
 * CAPABILITIES:
 * - Aggregate metrics across all platform specialists
 * - Calculate KPIs: follower growth rate, engagement rate, virality coefficient
 * - Identify content patterns that correlate with growth
 * - Generate mutation directives (content mix, tone, cadence, format, hashtags, topics)
 * - Track objectives against human-set growth goals
 * - Manage content library with recycling candidates
 * - Produce weekly executive reports
 *
 * @module agents/marketing/growth-analyst/specialist
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import {
  getMemoryVault,
  shareInsight,
  type MemoryEntry,
} from '../../shared/memory-vault';

// ============================================================================
// SYSTEM PROMPT
// ============================================================================

const SYSTEM_PROMPT = `You are the Growth Analyst, a data-driven specialist focused on optimizing social media growth through pattern analysis and strategic mutations.

## YOUR ROLE
You analyze performance data from all social media platform specialists, identify what works and what doesn't, and generate specific, actionable mutation directives that improve results over time.

## CORE PRINCIPLES
- Data over opinions — every recommendation must be backed by metrics
- Small mutations, measured results — change one variable at a time
- Never kill what's working — protect high performers
- Continuous learning — every cycle produces new insights
- Platform-aware — what works on Twitter may not work on LinkedIn

## TASK TYPES
- AGGREGATE_METRICS: Read PERFORMANCE data from all platforms, normalize
- CALCULATE_KPIS: Follower Growth Rate, Engagement Rate, Virality Coefficient, Content Velocity
- IDENTIFY_PATTERNS: Which content types/topics/formats/times correlate with growth
- GENERATE_MUTATIONS: Produce strategy shifts for specialists
- TRACK_OBJECTIVES: Compare metrics against human-set growth objectives
- CONTENT_LIBRARY: Track published content, tag top performers, flag recycling candidates
- WEEKLY_REPORT: Synthesize analysis into executive summary

## MUTATION TYPES
- CONTENT_MIX_SHIFT: Change ratio of content categories
- TONE_ADJUSTMENT: Shift voice/style based on audience response
- POSTING_CADENCE: Adjust frequency and timing
- FORMAT_PIVOT: Prefer formats that perform (e.g., threads over single tweets)
- HASHTAG_STRATEGY: Add/remove tags based on reach data
- TOPIC_KILL: Stop producing content on underperforming topics`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const GROWTH_ANALYST_CONFIG: SpecialistConfig = {
  identity: {
    id: 'GROWTH_ANALYST',
    name: 'Growth Analyst',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: [
      'metrics_aggregation',
      'kpi_calculation',
      'pattern_identification',
      'mutation_generation',
      'objective_tracking',
      'content_library_management',
      'weekly_reporting',
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['read_metrics', 'analyze_patterns', 'generate_mutations', 'track_objectives'],
  outputSchema: {
    type: 'object',
    properties: {
      analysis: { type: 'object' },
      mutations: { type: 'array' },
      kpis: { type: 'object' },
      recommendations: { type: 'array' },
    },
  },
  maxTokens: 4096,
  temperature: 0.3,
};

// ============================================================================
// TYPES
// ============================================================================

/** Mutation directive issued to platform specialists */
export interface MutationDirective {
  id: string;
  type: 'CONTENT_MIX_SHIFT' | 'TONE_ADJUSTMENT' | 'POSTING_CADENCE' | 'FORMAT_PIVOT' | 'HASHTAG_STRATEGY' | 'TOPIC_KILL';
  targetSpecialist: string;
  rationale: string;
  currentState: string;
  recommendedState: string;
  confidence: number;      // 0-100
  expectedImpact: string;
  createdAt: Date;
}

/** KPI snapshot */
export interface GrowthKPIs {
  followerGrowthRate: number;      // % change over period
  engagementRate: number;          // engagements / impressions * 100
  viralityCoefficient: number;     // shares / total posts
  contentVelocity: number;         // posts per day
  topContentType: string;
  topPlatform: string;
  averageImpressionsPerPost: number;
  averageEngagementsPerPost: number;
  calculatedAt: Date;
}

/** Content library entry */
export interface ContentLibraryEntry {
  postId: string;
  platform: string;
  publishedAt: string;
  content: string;
  metrics: {
    impressions: number;
    engagements: number;
    engagementRate: number;
  };
  isTopPerformer: boolean;
  isRecyclable: boolean;         // true if 30+ days old and top performer
  tags: string[];
  lastRecycledAt?: string;
}

/** Growth objective set by human */
export interface GrowthObjective {
  id: string;
  metric: string;              // e.g., 'engagement_rate', 'follower_count'
  targetValue: number;
  currentValue: number;
  deadline: string;
  platform: string;            // 'all' or specific platform
  status: 'on_track' | 'behind' | 'ahead' | 'completed';
}

/** Weekly report */
export interface WeeklyReport {
  weekOf: string;
  kpis: GrowthKPIs;
  topPerformers: Array<{ postId: string; platform: string; engagementRate: number }>;
  mutations: MutationDirective[];
  objectiveProgress: GrowthObjective[];
  summary: string;
  recommendations: string[];
  generatedAt: Date;
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class GrowthAnalyst extends BaseSpecialist {
  constructor() {
    super(GROWTH_ANALYST_CONFIG);
  }

  initialize(): Promise<void> {
    this.log('INFO', 'Initializing Growth Analyst...');
    this.isInitialized = true;
    this.log('INFO', 'Growth Analyst initialized');
    return Promise.resolve();
  }

  /**
   * Main execution entry point — dispatches to task-specific handlers
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    const payload = message.payload as Record<string, unknown>;
    const action = (payload?.action as string) ?? (payload?.taskType as string) ?? 'AGGREGATE_METRICS';

    this.log('INFO', `Executing task: ${action}`);

    try {
      switch (action) {
        case 'AGGREGATE_METRICS':
          return this.handleAggregateMetrics(taskId);

        case 'CALCULATE_KPIS':
          return this.handleCalculateKPIs(taskId);

        case 'IDENTIFY_PATTERNS':
          return await this.handleIdentifyPatterns(taskId);

        case 'GENERATE_MUTATIONS':
          return this.handleGenerateMutations(taskId);

        case 'TRACK_OBJECTIVES':
          return this.handleTrackObjectives(taskId, payload);

        case 'CONTENT_LIBRARY':
          return this.handleContentLibrary(taskId);

        case 'WEEKLY_REPORT':
          return await this.handleWeeklyReport(taskId);

        default:
          return this.createReport(taskId, 'FAILED', null, [`Unknown action: ${action}`]);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.log('ERROR', `Task ${action} failed: ${errorMsg}`);
      return this.createReport(taskId, 'FAILED', null, [errorMsg]);
    }
  }

  handleSignal(signal: Signal): Promise<AgentReport> {
    return Promise.resolve(this.createReport(signal.id, 'COMPLETED', { acknowledged: true }));
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 500, boilerplate: 80 };
  }

  // ==========================================================================
  // TASK HANDLERS
  // ==========================================================================

  /** Aggregate performance metrics from MemoryVault */
  private handleAggregateMetrics(taskId: string): AgentReport {
    const vault = getMemoryVault();

    // Read all PERFORMANCE entries written by the metrics collector
    const performanceEntries = vault.query(this.identity.id, {
      category: 'PERFORMANCE',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 50,
    });

    if (performanceEntries.length === 0) {
      return this.createReport(taskId, 'COMPLETED', {
        message: 'No performance data available yet',
        entriesFound: 0,
      });
    }

    // Aggregate across entries
    const aggregated = this.aggregatePerformanceEntries(performanceEntries);

    // Store aggregated result
    vault.write(
      'PERFORMANCE',
      'growth_analyst_aggregated',
      aggregated,
      this.identity.id,
      { priority: 'HIGH', tags: ['aggregated', 'growth-analyst'], overwrite: true }
    );

    return this.createReport(taskId, 'COMPLETED', aggregated);
  }

  /** Calculate KPIs from aggregated data */
  private handleCalculateKPIs(taskId: string): AgentReport {
    const vault = getMemoryVault();

    const aggregated = vault.read<Record<string, unknown>>(
      'PERFORMANCE',
      'growth_analyst_aggregated',
      this.identity.id
    );

    if (!aggregated) {
      // Run aggregation first
      this.handleAggregateMetrics(`${taskId}_pre_agg`);
    }

    const data = aggregated?.value ?? {};
    const aggregate = (data.aggregate ?? {}) as Record<string, number>;

    const postsAnalyzed = (data.totalPosts as number) ?? 1;
    const totalImpressions = aggregate.totalImpressions ?? 0;
    const totalEngagements = aggregate.totalEngagements ?? 0;
    const totalShares = aggregate.totalShares ?? 0;

    const kpis: GrowthKPIs = {
      followerGrowthRate: 0, // Requires historical follower data
      engagementRate: totalImpressions > 0
        ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
        : 0,
      viralityCoefficient: postsAnalyzed > 0
        ? Math.round((totalShares / postsAnalyzed) * 100) / 100
        : 0,
      contentVelocity: postsAnalyzed, // Posts in the analysis window
      topContentType: (data.topContentType as string) ?? 'unknown',
      topPlatform: (data.topPlatform as string) ?? 'unknown',
      averageImpressionsPerPost: postsAnalyzed > 0
        ? Math.round(totalImpressions / postsAnalyzed)
        : 0,
      averageEngagementsPerPost: postsAnalyzed > 0
        ? Math.round(totalEngagements / postsAnalyzed)
        : 0,
      calculatedAt: new Date(),
    };

    vault.write(
      'PERFORMANCE',
      'growth_analyst_kpis',
      kpis,
      this.identity.id,
      { priority: 'HIGH', tags: ['kpis', 'growth-analyst'], overwrite: true }
    );

    return this.createReport(taskId, 'COMPLETED', kpis);
  }

  /** Identify patterns in content performance */
  private async handleIdentifyPatterns(taskId: string): Promise<AgentReport> {
    const vault = getMemoryVault();

    const performanceEntries = vault.query(this.identity.id, {
      category: 'PERFORMANCE',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 100,
    });

    const patterns = {
      totalEntries: performanceEntries.length,
      insights: [] as string[],
      topPerformingPosts: [] as Array<{ postId: string; engagements: number; platform: string }>,
    };

    // Extract per-post data from performance entries
    for (const entry of performanceEntries) {
      const value = entry.value as Record<string, unknown>;
      const perPost = (value.perPost as Array<Record<string, unknown>>) ?? [];

      for (const post of perPost) {
        const metrics = post.metrics as Record<string, number> | undefined;
        if (metrics) {
          patterns.topPerformingPosts.push({
            postId: post.postId as string,
            engagements: metrics.engagements ?? 0,
            platform: post.platform as string,
          });
        }
      }
    }

    // Sort by engagements descending
    patterns.topPerformingPosts.sort((a, b) => b.engagements - a.engagements);
    patterns.topPerformingPosts = patterns.topPerformingPosts.slice(0, 20);

    // Generate insights
    if (patterns.topPerformingPosts.length > 0) {
      const platformCounts: Record<string, number> = {};
      for (const post of patterns.topPerformingPosts) {
        platformCounts[post.platform] = (platformCounts[post.platform] ?? 0) + 1;
      }

      const topPlatform = Object.entries(platformCounts)
        .sort((a, b) => b[1] - a[1])[0];

      if (topPlatform) {
        patterns.insights.push(
          `Top performing platform: ${topPlatform[0]} (${topPlatform[1]}/${patterns.topPerformingPosts.length} top posts)`
        );
      }
    }

    if (patterns.insights.length > 0) {
      await shareInsight(
        this.identity.id,
        'PERFORMANCE',
        'Social Media Performance Patterns',
        patterns.insights.join('. '),
        {
          confidence: 70,
          relatedAgents: ['MARKETING_MANAGER', 'CONTENT_MANAGER'],
          tags: ['patterns', 'growth', 'performance'],
        }
      );
    }

    return this.createReport(taskId, 'COMPLETED', patterns);
  }

  /** Generate mutation directives based on analysis */
  private handleGenerateMutations(taskId: string): AgentReport {
    const vault = getMemoryVault();

    // Read current KPIs
    const kpisEntry = vault.read<GrowthKPIs>(
      'PERFORMANCE',
      'growth_analyst_kpis',
      this.identity.id
    );

    const kpis = kpisEntry?.value;
    const mutations: MutationDirective[] = [];

    if (!kpis) {
      return this.createReport(taskId, 'COMPLETED', {
        mutations: [],
        message: 'No KPI data available yet — run CALCULATE_KPIS first',
      });
    }

    // Low engagement rate → suggest format pivot
    if (kpis.engagementRate < 2) {
      mutations.push({
        id: `mutation_format_${Date.now()}`,
        type: 'FORMAT_PIVOT',
        targetSpecialist: 'TWITTER_EXPERT',
        rationale: `Engagement rate is ${kpis.engagementRate}% (below 2% target)`,
        currentState: 'Mixed format strategy',
        recommendedState: 'Increase thread ratio to 60% — threads consistently outperform single tweets',
        confidence: 72,
        expectedImpact: '+0.5-1% engagement rate improvement',
        createdAt: new Date(),
      });
    }

    // Low virality → suggest more shareable content
    if (kpis.viralityCoefficient < 0.5) {
      mutations.push({
        id: `mutation_content_${Date.now()}`,
        type: 'CONTENT_MIX_SHIFT',
        targetSpecialist: 'ALL',
        rationale: `Virality coefficient is ${kpis.viralityCoefficient} (below 0.5 target)`,
        currentState: 'Current content mix',
        recommendedState: 'Increase data-driven and contrarian content — these formats have highest share rates',
        confidence: 65,
        expectedImpact: '+0.2-0.5 virality coefficient',
        createdAt: new Date(),
      });
    }

    // Low content velocity → suggest cadence increase
    if (kpis.contentVelocity < 5) {
      mutations.push({
        id: `mutation_cadence_${Date.now()}`,
        type: 'POSTING_CADENCE',
        targetSpecialist: 'ALL',
        rationale: `Content velocity is ${kpis.contentVelocity} posts (low volume)`,
        currentState: `${kpis.contentVelocity} posts per analysis window`,
        recommendedState: 'Target 2x daily across primary platforms',
        confidence: 80,
        expectedImpact: 'Linear increase in impressions and reach',
        createdAt: new Date(),
      });
    }

    // Store mutations in MemoryVault
    if (mutations.length > 0) {
      vault.write(
        'STRATEGY',
        'growth_analyst_mutations',
        { mutations, generatedAt: new Date().toISOString() },
        this.identity.id,
        { priority: 'HIGH', tags: ['mutations', 'growth-analyst', 'strategy'], overwrite: true }
      );
    }

    return this.createReport(taskId, 'COMPLETED', { mutations, count: mutations.length });
  }

  /** Track progress against growth objectives */
  private handleTrackObjectives(
    taskId: string,
    payload: Record<string, unknown>
  ): AgentReport {
    const vault = getMemoryVault();

    // Read objectives from MemoryVault (set by human via API)
    const objectivesEntry = vault.read<GrowthObjective[]>(
      'STRATEGY',
      'growth_objectives',
      this.identity.id
    );

    const objectives = objectivesEntry?.value ?? [];

    if (objectives.length === 0) {
      // Check if objectives were provided in the payload
      const newObjectives = payload.objectives as GrowthObjective[] | undefined;
      if (newObjectives && newObjectives.length > 0) {
        vault.write(
          'STRATEGY',
          'growth_objectives',
          newObjectives,
          this.identity.id,
          { priority: 'HIGH', tags: ['objectives', 'growth'], overwrite: true }
        );
        return this.createReport(taskId, 'COMPLETED', {
          message: `${newObjectives.length} objectives saved`,
          objectives: newObjectives,
        });
      }
      return this.createReport(taskId, 'COMPLETED', {
        message: 'No growth objectives set. Use TRACK_OBJECTIVES with objectives payload to set them.',
        objectives: [],
      });
    }

    // Read current KPIs for comparison
    const kpisEntry = vault.read<GrowthKPIs>(
      'PERFORMANCE',
      'growth_analyst_kpis',
      this.identity.id
    );

    const kpis = kpisEntry?.value;

    // Update objective status based on current KPIs
    const updatedObjectives = objectives.map(obj => {
      if (!kpis) { return obj; }

      const kpiMap: Record<string, number> = {
        engagement_rate: kpis.engagementRate,
        virality_coefficient: kpis.viralityCoefficient,
        content_velocity: kpis.contentVelocity,
        avg_impressions: kpis.averageImpressionsPerPost,
        avg_engagements: kpis.averageEngagementsPerPost,
      };

      const currentValue = kpiMap[obj.metric] ?? obj.currentValue;
      const progress = obj.targetValue > 0 ? currentValue / obj.targetValue : 0;

      let status: GrowthObjective['status'] = 'behind';
      if (progress >= 1) { status = 'completed'; }
      else if (progress >= 0.8) { status = 'on_track'; }
      else if (progress >= 1.2) { status = 'ahead'; }

      return { ...obj, currentValue, status };
    });

    vault.write(
      'STRATEGY',
      'growth_objectives',
      updatedObjectives,
      this.identity.id,
      { priority: 'HIGH', tags: ['objectives', 'growth'], overwrite: true }
    );

    return this.createReport(taskId, 'COMPLETED', {
      objectives: updatedObjectives,
      kpis: kpis ?? null,
    });
  }

  /** Manage content library — tag top performers and recycling candidates */
  private handleContentLibrary(taskId: string): AgentReport {
    const vault = getMemoryVault();

    const performanceEntries = vault.query(this.identity.id, {
      category: 'PERFORMANCE',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 100,
    });

    const library: ContentLibraryEntry[] = [];
    const allPosts: Array<{ postId: string; platform: string; metrics: Record<string, number> }> = [];

    // Collect all post data
    for (const entry of performanceEntries) {
      const value = entry.value as Record<string, unknown>;
      const perPost = (value.perPost as Array<Record<string, unknown>>) ?? [];

      for (const post of perPost) {
        const metrics = post.metrics as Record<string, number> | undefined;
        if (metrics) {
          allPosts.push({
            postId: post.postId as string,
            platform: post.platform as string,
            metrics,
          });
        }
      }
    }

    if (allPosts.length === 0) {
      return this.createReport(taskId, 'COMPLETED', {
        library: [],
        message: 'No content data available yet',
      });
    }

    // Calculate average engagement rate
    const avgEngagement = allPosts.reduce((sum, p) => {
      const impressions = p.metrics.impressions ?? 0;
      const engagements = p.metrics.engagements ?? 0;
      return sum + (impressions > 0 ? engagements / impressions : 0);
    }, 0) / allPosts.length;

    const topPerformerThreshold = avgEngagement * 2;

    for (const post of allPosts) {
      const impressions = post.metrics.impressions ?? 0;
      const engagements = post.metrics.engagements ?? 0;
      const postEngagementRate = impressions > 0 ? engagements / impressions : 0;
      const isTopPerformer = postEngagementRate >= topPerformerThreshold;

      const publishedAt = (post as Record<string, unknown>).publishedAt as string | undefined;
      const publishDate = publishedAt ? new Date(publishedAt) : new Date();
      const daysSincePublished = Math.floor((Date.now() - publishDate.getTime()) / (1000 * 60 * 60 * 24));
      const meetsRecycleCooldown = daysSincePublished >= 30;
      const isRecyclable = isTopPerformer && meetsRecycleCooldown;

      library.push({
        postId: post.postId,
        platform: post.platform,
        publishedAt: publishDate.toISOString(),
        content: '',
        metrics: {
          impressions,
          engagements,
          engagementRate: Math.round(postEngagementRate * 10000) / 100,
        },
        isTopPerformer,
        isRecyclable,
        tags: [
          ...(isTopPerformer ? ['top-performer'] : []),
          ...(isRecyclable ? ['recyclable'] : []),
          ...(daysSincePublished < 30 ? ['cooldown-active'] : []),
        ],
      });
    }

    // Store library in MemoryVault
    vault.write(
      'CONTENT',
      'growth_analyst_content_library',
      { entries: library, lastUpdated: new Date().toISOString() },
      this.identity.id,
      { priority: 'MEDIUM', tags: ['content-library', 'growth-analyst'], overwrite: true }
    );

    return this.createReport(taskId, 'COMPLETED', {
      totalEntries: library.length,
      topPerformers: library.filter(e => e.isTopPerformer).length,
      recyclable: library.filter(e => e.isRecyclable).length,
    });
  }

  /** Generate weekly executive report */
  private async handleWeeklyReport(taskId: string): Promise<AgentReport> {
    // Run all analysis steps first
    this.handleAggregateMetrics(`${taskId}_agg`);
    const kpiReport = this.handleCalculateKPIs(`${taskId}_kpi`);
    const patternReport = await this.handleIdentifyPatterns(`${taskId}_patterns`);
    const mutationReport = this.handleGenerateMutations(`${taskId}_mutations`);
    const libraryReport = this.handleContentLibrary(`${taskId}_library`);

    const kpis = kpiReport.data as GrowthKPIs;
    const patterns = patternReport.data as Record<string, unknown>;
    const mutationsData = mutationReport.data as { mutations: MutationDirective[] };
    const libraryData = libraryReport.data as Record<string, unknown>;

    const topPerformers = ((patterns?.topPerformingPosts ?? []) as Array<{
      postId: string;
      platform: string;
      engagements: number;
    }>).slice(0, 5).map(p => ({
      postId: p.postId,
      platform: p.platform,
      engagementRate: 0, // Would need impressions for rate
    }));

    const summary = [
      `Engagement rate: ${kpis?.engagementRate ?? 0}%`,
      `Virality coefficient: ${kpis?.viralityCoefficient ?? 0}`,
      `Content velocity: ${kpis?.contentVelocity ?? 0} posts`,
      `Top performers: ${libraryData?.topPerformers ?? 0}`,
      `Mutations generated: ${mutationsData?.mutations?.length ?? 0}`,
    ].join(' | ');

    const recommendations: string[] = [];
    if (kpis?.engagementRate && kpis.engagementRate < 2) {
      recommendations.push('Focus on engagement — current rate below 2% benchmark');
    }
    if (kpis?.viralityCoefficient && kpis.viralityCoefficient < 0.5) {
      recommendations.push('Increase shareable content formats to boost virality');
    }
    if (mutationsData?.mutations?.length > 0) {
      recommendations.push(`${mutationsData.mutations.length} strategy mutations ready for deployment`);
    }

    const report: WeeklyReport = {
      weekOf: new Date().toISOString().split('T')[0],
      kpis: kpis ?? {
        followerGrowthRate: 0,
        engagementRate: 0,
        viralityCoefficient: 0,
        contentVelocity: 0,
        topContentType: 'unknown',
        topPlatform: 'unknown',
        averageImpressionsPerPost: 0,
        averageEngagementsPerPost: 0,
        calculatedAt: new Date(),
      },
      topPerformers,
      mutations: mutationsData?.mutations ?? [],
      objectiveProgress: [],
      summary,
      recommendations,
      generatedAt: new Date(),
    };

    // Store report in MemoryVault
    const vault = getMemoryVault();
    vault.write(
      'PERFORMANCE',
      `weekly_report_${report.weekOf}`,
      report,
      this.identity.id,
      { priority: 'HIGH', tags: ['weekly-report', 'growth-analyst', 'executive'] }
    );

    // Share as insight for other agents
    await shareInsight(
      this.identity.id,
      'PERFORMANCE',
      `Weekly Growth Report — ${report.weekOf}`,
      summary,
      {
        confidence: 85,
        relatedAgents: ['MARKETING_MANAGER', 'REVENUE_DIRECTOR'],
        actions: recommendations,
        tags: ['weekly-report', 'growth'],
      }
    );

    return this.createReport(taskId, 'COMPLETED', report);
  }

  // ==========================================================================
  // HELPER METHODS
  // ==========================================================================

  /** Aggregate performance data from multiple MemoryVault entries */
  private aggregatePerformanceEntries(entries: MemoryEntry[]): Record<string, unknown> {
    let totalImpressions = 0;
    let totalEngagements = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;
    let totalPosts = 0;

    const platformMetrics: Record<string, { impressions: number; engagements: number; posts: number }> = {};

    for (const entry of entries) {
      const value = entry.value as Record<string, unknown>;
      const aggregate = (value.aggregate ?? {}) as Record<string, number>;
      const postsAnalyzed = (value.postsAnalyzed as number) ?? 0;

      totalImpressions += aggregate.totalImpressions ?? 0;
      totalEngagements += aggregate.totalEngagements ?? 0;
      totalLikes += aggregate.totalLikes ?? 0;
      totalComments += aggregate.totalComments ?? 0;
      totalShares += aggregate.totalShares ?? 0;
      totalPosts += postsAnalyzed;

      // Per-post platform breakdown
      const perPost = (value.perPost as Array<Record<string, unknown>>) ?? [];
      for (const post of perPost) {
        const platform = post.platform as string;
        const metrics = post.metrics as Record<string, number> | undefined;
        if (platform && metrics) {
          platformMetrics[platform] ??= { impressions: 0, engagements: 0, posts: 0 };
          platformMetrics[platform].impressions += metrics.impressions ?? 0;
          platformMetrics[platform].engagements += metrics.engagements ?? 0;
          platformMetrics[platform].posts += 1;
        }
      }
    }

    // Find top platform
    const topPlatform = Object.entries(platformMetrics)
      .sort((a, b) => b[1].engagements - a[1].engagements)[0];

    return {
      totalPosts,
      entriesAnalyzed: entries.length,
      aggregate: {
        totalImpressions,
        totalEngagements,
        totalLikes,
        totalComments,
        totalShares,
        engagementRate: totalImpressions > 0
          ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
          : 0,
      },
      platformBreakdown: platformMetrics,
      topPlatform: topPlatform?.[0] ?? 'unknown',
      topContentType: 'unknown', // Would need content type tracking
      aggregatedAt: new Date().toISOString(),
    };
  }
}

// ============================================================================
// FACTORY FUNCTIONS
// ============================================================================

export function createGrowthAnalyst(): GrowthAnalyst {
  return new GrowthAnalyst();
}

let instance: GrowthAnalyst | null = null;

export function getGrowthAnalyst(): GrowthAnalyst {
  instance ??= createGrowthAnalyst();
  return instance;
}
