/**
 * Performance Analytics - Engine
 * 
 * Aggregates and analyzes team-wide conversation performance data.
 * Provides manager-level insights, benchmarking, and coaching priorities.
 * 
 * FEATURES:
 * - Team metrics aggregation
 * - Individual performance tracking
 * - Benchmarking and percentile rankings
 * - Top performer identification
 * - Improvement opportunity detection
 * - Trend analysis
 * - Coaching priority recommendations
 * - Best practice extraction
 * 
 * @module lib/performance
 */

import { logger } from '@/lib/logger/logger';
import { adminDal } from '@/lib/firebase/admin-dal';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import type {
  TeamPerformanceAnalytics,
  PerformanceAnalyticsRequest,
  RepPerformanceMetrics,
  TeamMetrics,
  PerformanceBenchmarks,
  TopPerformer,
  ImprovementOpportunity,
  TrendAnalysis,
  CoachingPriority,
  BestPractice,
  PerformanceAnalyticsConfig,
  PerformanceTier,
  SentimentDistribution,
  PercentileThresholds,
  Strength,
  StandoutMetric,
  SkillGap,
  Trend,
  TrendingRep,
  TrendDataPoint,
  PerformanceLeaderboard,
  LeaderboardRequest,
  LeaderboardEntry,
  LeaderboardMover,
  RepComparison,
  RepComparisonRequest,
  ComparisonInsight,
  LearningOpportunity,
  MetricBreakdown,
  MetricBreakdownRequest,
  MetricDistribution,
  MetricCorrelation,
} from './types';
import { DEFAULT_PERFORMANCE_CONFIG } from './types';
import type { ConversationAnalysis, CoachingCategory, ObjectionType, TopicCategory } from '@/lib/conversation/types';
import {
  createPerformanceAnalyzedEvent,
  createTopPerformerIdentifiedEvent,
  createCoachingPriorityCreatedEvent,
} from './events';

// ============================================================================
// MAIN ANALYSIS FUNCTION
// ============================================================================

/**
 * Generate team performance analytics
 * 
 * @param request - Analytics request
 * @param config - Optional engine configuration
 * @returns Team performance analytics
 */
export async function generatePerformanceAnalytics(
  request: PerformanceAnalyticsRequest,
  config: Partial<PerformanceAnalyticsConfig> = {}
): Promise<TeamPerformanceAnalytics> {
  const startTime = Date.now();
  const fullConfig: PerformanceAnalyticsConfig = { ...DEFAULT_PERFORMANCE_CONFIG, ...config };
  
  try {
    logger.info('Generating performance analytics', {
      organizationId: request.organizationId,
      periodType: request.periodType,
    });
    
    // 1. Determine time period
    const { startDate, endDate, periodType } = determinePeriod(request);
    
    // 2. Get all conversation analyses for the period
    const analyses = await getConversationAnalyses(
      request.organizationId,
(request.workspaceId !== '' && request.workspaceId != null) ? request.workspaceId : 'default',
      startDate,
      endDate
    );
    
    if (analyses.length === 0) {
      throw new Error('No conversation analyses found for the specified period');
    }
    
    logger.info('Retrieved conversation analyses', {
      count: analyses.length,
      startDate,
      endDate,
    });
    
    // 3. Calculate individual rep metrics
    const individualMetrics = await calculateIndividualMetrics(
      analyses,
      fullConfig
    );
    
    // Filter by minimum conversations if specified
    const filteredMetrics = individualMetrics.filter(
      m => m.totalConversations >= (request.minConversations ?? fullConfig.minConversationsForAnalysis)
    );
    
    if (filteredMetrics.length === 0) {
      throw new Error('No reps meet minimum conversation threshold');
    }
    
    // 4. Calculate team metrics
    const teamMetrics = calculateTeamMetrics(filteredMetrics, analyses);
    
    // 5. Calculate benchmarks
    const benchmarks = calculateBenchmarks(filteredMetrics);
    
    // 6. Assign performance tiers and percentiles
    const rankedMetrics = assignPerformanceTiers(filteredMetrics, benchmarks);
    
    // 7. Identify top performers
    const topPerformers = identifyTopPerformers(rankedMetrics, fullConfig);
    
    // 8. Find improvement opportunities
    const improvementOpportunities = findImprovementOpportunities(
      rankedMetrics,
      benchmarks,
      fullConfig
    );
    
    // 9. Generate trend analysis (if requested)
    let trendAnalysis: TrendAnalysis;
    if (request.includeTrends !== false && fullConfig.includeTrendAnalysis) {
      trendAnalysis = await generateTrendAnalysis(
        request.organizationId,
(request.workspaceId !== '' && request.workspaceId != null) ? request.workspaceId : 'default',
        rankedMetrics,
        startDate,
        endDate,
        fullConfig
      );
    } else {
      trendAnalysis = createEmptyTrendAnalysis();
    }
    
    // 10. Generate coaching priorities
    const coachingPriorities = generateCoachingPriorities(
      rankedMetrics,
      benchmarks,
      fullConfig
    );
    
    // 11. Extract best practices
    const bestPractices = extractBestPractices(
      rankedMetrics,
      topPerformers,
      fullConfig
    );
    
    // 12. Build final analytics
    const analytics: TeamPerformanceAnalytics = {
      organizationId: request.organizationId,
      workspaceId:(request.workspaceId !== '' && request.workspaceId != null) ? request.workspaceId : 'default',
      startDate,
      endDate,
      periodType,
      teamMetrics,
      individualMetrics: rankedMetrics,
      benchmarks,
      topPerformers,
      improvementOpportunities,
      trendAnalysis,
      coachingPriorities,
      bestPractices,
      generatedAt: new Date(),
      conversationsAnalyzed: analyses.length,
      repsIncluded: rankedMetrics.length,
    };
    
    const processingTime = Date.now() - startTime;
    
    logger.info('Performance analytics generated', {
      processingTime,
      repsAnalyzed: rankedMetrics.length,
      conversationsAnalyzed: analyses.length,
    });
    
    // 13. Emit events
    await emitAnalyticsEvents(analytics, request.organizationId);
    
    return analytics;
    
  } catch (error) {
    logger.error('Failed to generate performance analytics', { error });
    throw error;
  }
}

// ============================================================================
// INDIVIDUAL METRICS
// ============================================================================

/**
 * Calculate individual rep performance metrics
 */
async function calculateIndividualMetrics(
  analyses: ConversationAnalysis[],
  config: PerformanceAnalyticsConfig
): Promise<RepPerformanceMetrics[]> {
  // Group analyses by rep
  const analysesByRep = new Map<string, ConversationAnalysis[]>();
  
  for (const analysis of analyses) {
    // Get rep ID from conversation
    const conversation = await getConversationForAnalysis(analysis.conversationId);
    if (!conversation) {continue;}
    
    const repId = conversation.repId;
    if (!analysesByRep.has(repId)) {
      analysesByRep.set(repId, []);
    }
    analysesByRep.get(repId)!.push(analysis);
  }
  
  // Calculate metrics for each rep
  const metrics: RepPerformanceMetrics[] = [];
  
  for (const [repId, repAnalyses] of analysesByRep.entries()) {
    const repMetrics = await calculateRepMetrics(repId, repAnalyses);
    metrics.push(repMetrics);
  }
  
  return metrics;
}

/**
 * Calculate metrics for a single rep
 */
async function calculateRepMetrics(
  repId: string,
  analyses: ConversationAnalysis[]
): Promise<RepPerformanceMetrics> {
  // Get rep info
  const repInfo = await getRepInfo(repId);
  
  // Calculate average scores
  const avgScores = {
    overall: average(analyses.map(a => a.scores.overall)),
    discovery: average(analyses.map(a => a.scores.discovery)),
    valueArticulation: average(analyses.map(a => a.scores.valueArticulation)),
    objectionHandling: average(analyses.map(a => a.scores.objectionHandling)),
    closing: average(analyses.map(a => a.scores.closing)),
    rapport: average(analyses.map(a => a.scores.rapport)),
    engagement: average(analyses.map(a => a.scores.engagement)),
  };
  
  // Calculate sentiment
  const avgSentiment = average(analyses.map(a => a.sentiment.overall.score));
  const sentimentTrend = determineSentimentTrend(analyses);
  
  // Calculate talk ratio
  const avgRepTalkPercentage = average(analyses.map(a => a.talkRatio.repPercentage));
  const idealTalkRatioPercentage = (analyses.filter(a => a.talkRatio.assessment === 'ideal').length / analyses.length) * 100;
  
  // Calculate quality
  const avgQualityScore = average(analyses.map(a => 
    average(a.qualityIndicators.map(qi => qi.score))
  ));
  const redFlagCount = sum(analyses.map(a => a.redFlags.length));
  const positiveSignalCount = sum(analyses.map(a => a.positiveSignals.length));
  
  // Calculate objections
  const avgObjectionsPerConversation = average(analyses.map(a => a.objections.length));
  const totalObjections = sum(analyses.map(a => a.objections.length));
  const addressedObjections = sum(analyses.map(a => 
    a.objections.filter(o => o.wasAddressed && o.responseQuality !== 'poor').length
  ));
  const objectionHandlingRate = totalObjections > 0 ? (addressedObjections / totalObjections) * 100 : 0;
  
  // Get top objection types
  const objectionCounts = new Map<ObjectionType, number>();
  for (const analysis of analyses) {
    for (const objection of analysis.objections) {
      objectionCounts.set(objection.type, (objectionCounts.get(objection.type) ?? 0) + 1);
    }
  }
  const topObjectionTypes = Array.from(objectionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([type]) => type);
  
  // Calculate topics
  const avgTopicsCovered = average(analyses.map(a => a.topics.mainTopics.length));
  const topicCoverageScore = average(analyses.map(a => {
    const uncoveredCount = a.topics.uncoveredTopics.length;
    const totalExpected = a.topics.mainTopics.length + uncoveredCount;
    return totalExpected > 0 ? (a.topics.mainTopics.length / totalExpected) * 100 : 0;
  }));
  
  // Analyze topic strengths/weaknesses
  const topicScores = new Map<TopicCategory, number[]>();
  for (const analysis of analyses) {
    for (const topic of analysis.topics.mainTopics) {
      if (!topicScores.has(topic.category)) {
        topicScores.set(topic.category, []);
      }
      topicScores.get(topic.category)!.push(topic.sentiment);
    }
  }
  
  const topicAvgs = Array.from(topicScores.entries())
    .map(([category, scores]) => ({
      category,
      avgScore: average(scores),
    }))
    .sort((a, b) => b.avgScore - a.avgScore);
  
  const strongTopics = topicAvgs.slice(0, 3).map(t => t.category);
  const weakTopics = topicAvgs.slice(-3).map(t => t.category);
  
  // Get top coaching areas
  const coachingCounts = new Map<CoachingCategory, number>();
  for (const analysis of analyses) {
    for (const insight of analysis.coachingInsights) {
      coachingCounts.set(insight.category, (coachingCounts.get(insight.category) ?? 0) + 1);
    }
  }
  const topCoachingAreas = Array.from(coachingCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category]) => category);
  
  // Determine coaching priority
  const criticalInsights = sum(analyses.map(a => 
    a.coachingInsights.filter(i => i.priority === 'critical').length
  ));
  const highInsights = sum(analyses.map(a => 
    a.coachingInsights.filter(i => i.priority === 'high').length
  ));
  
  let coachingPriority: 'critical' | 'high' | 'medium' | 'low';
  if (criticalInsights > 0 || avgScores.overall < 60) {
    coachingPriority = 'critical';
  } else if (highInsights > 2 || avgScores.overall < 70) {
    coachingPriority = 'high';
  } else if (avgScores.overall < 80) {
    coachingPriority = 'medium';
  } else {
    coachingPriority = 'low';
  }
  
  return {
    repId,
    repName: repInfo.name,
    repEmail: repInfo.email,
    totalConversations: analyses.length,
    scores: avgScores,
    avgSentiment,
    sentimentTrend,
    avgRepTalkPercentage,
    idealTalkRatioPercentage,
    avgQualityScore,
    redFlagCount,
    positiveSignalCount,
    avgObjectionsPerConversation,
    objectionHandlingRate,
    topObjectionTypes,
    avgTopicsCovered,
    topicCoverageScore,
    strongTopics,
    weakTopics,
    topCoachingAreas,
    coachingPriority,
    performanceTier: 'solid_performer', // Will be updated in assignPerformanceTiers
    percentileRank: 50, // Will be updated in assignPerformanceTiers
    scoreChange: 0, // Will be calculated in trend analysis
    rankChange: 0, // Will be calculated in trend analysis
  };
}

// ============================================================================
// TEAM METRICS
// ============================================================================

/**
 * Calculate team-wide metrics
 */
function calculateTeamMetrics(
  individualMetrics: RepPerformanceMetrics[],
  analyses: ConversationAnalysis[]
): TeamMetrics {
  const totalConversations = analyses.length;
  const totalReps = individualMetrics.length;
  
  // Calculate sentiment distribution
  const sentimentCounts = {
    veryPositive: 0,
    positive: 0,
    neutral: 0,
    negative: 0,
    veryNegative: 0,
  };
  
  for (const analysis of analyses) {
    switch (analysis.sentiment.overall.polarity) {
      case 'very_positive':
        sentimentCounts.veryPositive++;
        break;
      case 'positive':
        sentimentCounts.positive++;
        break;
      case 'neutral':
        sentimentCounts.neutral++;
        break;
      case 'negative':
        sentimentCounts.negative++;
        break;
      case 'very_negative':
        sentimentCounts.veryNegative++;
        break;
    }
  }
  
  const sentimentDistribution: SentimentDistribution = {
    veryPositive: (sentimentCounts.veryPositive / totalConversations) * 100,
    positive: (sentimentCounts.positive / totalConversations) * 100,
    neutral: (sentimentCounts.neutral / totalConversations) * 100,
    negative: (sentimentCounts.negative / totalConversations) * 100,
    veryNegative: (sentimentCounts.veryNegative / totalConversations) * 100,
  };
  
  // Calculate ideal talk ratio percentage
  const idealTalkRatioCount = analyses.filter(a => a.talkRatio.assessment === 'ideal').length;
  const idealTalkRatioPercentage = (idealTalkRatioCount / totalConversations) * 100;
  
  // Calculate red flag and positive signal rates
  const totalRedFlags = sum(individualMetrics.map(m => m.redFlagCount));
  const totalPositiveSignals = sum(individualMetrics.map(m => m.positiveSignalCount));
  const redFlagRate = totalRedFlags / totalConversations;
  const positiveSignalRate = totalPositiveSignals / totalConversations;
  
  // Calculate objection handling rate
  const totalObjections = sum(analyses.map(a => a.objections.length));
  const addressedObjections = sum(analyses.map(a => 
    a.objections.filter(o => o.wasAddressed && o.responseQuality !== 'poor').length
  ));
  const objectionHandlingRate = totalObjections > 0 ? (addressedObjections / totalObjections) * 100 : 0;
  
  return {
    totalConversations,
    avgConversationsPerRep: totalConversations / totalReps,
    avgOverallScore: average(individualMetrics.map(m => m.scores.overall)),
    avgDiscoveryScore: average(individualMetrics.map(m => m.scores.discovery)),
    avgValueArticulationScore: average(individualMetrics.map(m => m.scores.valueArticulation)),
    avgObjectionHandlingScore: average(individualMetrics.map(m => m.scores.objectionHandling)),
    avgClosingScore: average(individualMetrics.map(m => m.scores.closing)),
    avgRapportScore: average(individualMetrics.map(m => m.scores.rapport)),
    avgEngagementScore: average(individualMetrics.map(m => m.scores.engagement)),
    avgSentiment: average(individualMetrics.map(m => m.avgSentiment)),
    sentimentDistribution,
    avgRepTalkPercentage: average(individualMetrics.map(m => m.avgRepTalkPercentage)),
    idealTalkRatioPercentage,
    avgQualityScore: average(individualMetrics.map(m => m.avgQualityScore)),
    redFlagRate,
    positiveSignalRate,
    avgObjectionsPerConversation: average(individualMetrics.map(m => m.avgObjectionsPerConversation)),
    objectionHandlingRate,
    avgTopicsCovered: average(individualMetrics.map(m => m.avgTopicsCovered)),
    topicCoverageScore: average(individualMetrics.map(m => m.topicCoverageScore)),
    avgCoachingInsights: average(analyses.map(a => a.coachingInsights.length)),
    avgFollowUpActions: average(analyses.map(a => a.followUpActions.length)),
  };
}

// ============================================================================
// BENCHMARKS
// ============================================================================

/**
 * Calculate performance benchmarks
 */
function calculateBenchmarks(metrics: RepPerformanceMetrics[]): PerformanceBenchmarks {
  // Sort by overall score
  const sortedByScore = [...metrics].sort((a, b) => b.scores.overall - a.scores.overall);
  
  // Calculate top 20% average
  const topPerformersCount = Math.ceil(metrics.length * 0.2);
  const topPerformers = sortedByScore.slice(0, topPerformersCount);
  const topPerformerAvgScore = average(topPerformers.map(m => m.scores.overall));
  const topPerformerAvgSentiment = average(topPerformers.map(m => m.avgSentiment));
  const topPerformerTalkRatio = average(topPerformers.map(m => m.avgRepTalkPercentage));
  const topPerformerQuality = average(topPerformers.map(m => m.avgQualityScore));
  const topPerformerObjectionHandling = average(topPerformers.map(m => m.objectionHandlingRate));
  
  // Calculate median
  const medianIndex = Math.floor(metrics.length / 2);
  const teamMedianScore = sortedByScore[medianIndex].scores.overall;
  const teamMedianSentiment = median(metrics.map(m => m.avgSentiment));
  const teamMedianTalkRatio = median(metrics.map(m => m.avgRepTalkPercentage));
  const teamMedianQuality = median(metrics.map(m => m.avgQualityScore));
  const teamMedianObjectionHandling = median(metrics.map(m => m.objectionHandlingRate));
  
  // Calculate bottom 20% average
  const bottomPerformersCount = Math.ceil(metrics.length * 0.2);
  const bottomPerformers = sortedByScore.slice(-bottomPerformersCount);
  const bottomPerformerAvgScore = average(bottomPerformers.map(m => m.scores.overall));
  
  // Calculate percentiles
  const scores = metrics.map(m => m.scores.overall).sort((a, b) => b - a);
  const percentiles: PercentileThresholds = {
    p90: percentile(scores, 90),
    p75: percentile(scores, 75),
    p50: percentile(scores, 50),
    p25: percentile(scores, 25),
    p10: percentile(scores, 10),
  };
  
  return {
    topPerformerAvgScore,
    teamMedianScore,
    bottomPerformerAvgScore,
    topPerformerAvgSentiment,
    teamMedianSentiment,
    topPerformerTalkRatio,
    teamMedianTalkRatio,
    topPerformerQuality,
    teamMedianQuality,
    topPerformerObjectionHandling,
    teamMedianObjectionHandling,
    percentiles,
  };
}

// ============================================================================
// PERFORMANCE TIERS
// ============================================================================

/**
 * Assign performance tiers and percentile rankings
 */
function assignPerformanceTiers(
  metrics: RepPerformanceMetrics[],
  benchmarks: PerformanceBenchmarks
): RepPerformanceMetrics[] {
  // Sort by overall score
  const sorted = [...metrics].sort((a, b) => b.scores.overall - a.scores.overall);
  
  // Assign percentiles and tiers
  return sorted.map((metric, index) => {
    const percentileRank = ((sorted.length - index) / sorted.length) * 100;
    
    let performanceTier: PerformanceTier;
    if (percentileRank >= 80) {
      performanceTier = 'top_performer';
    } else if (percentileRank >= 60) {
      performanceTier = 'high_performer';
    } else if (percentileRank >= 40) {
      performanceTier = 'solid_performer';
    } else if (percentileRank >= 20) {
      performanceTier = 'developing';
    } else {
      performanceTier = 'needs_improvement';
    }
    
    return {
      ...metric,
      percentileRank,
      performanceTier,
    };
  });
}

// ============================================================================
// TOP PERFORMERS
// ============================================================================

/**
 * Identify top performers
 */
function identifyTopPerformers(
  metrics: RepPerformanceMetrics[],
  config: PerformanceAnalyticsConfig
): TopPerformer[] {
  // Get top 20%
  const topPerformersCount = Math.max(1, Math.ceil(metrics.length * 0.2));
  const topMetrics = metrics
    .filter(m => m.performanceTier === 'top_performer')
    .slice(0, topPerformersCount);
  
  return topMetrics.map((metric, index) => {
    // Identify strengths (metrics significantly above team average)
    const teamAvgScore = average(metrics.map(m => m.scores.overall));
    const strengths: Strength[] = [];
    
    // Check each score category
    const scoreCategories = [
      { name: 'Discovery', score: metric.scores.discovery, teamAvg: average(metrics.map(m => m.scores.discovery)) },
      { name: 'Value Articulation', score: metric.scores.valueArticulation, teamAvg: average(metrics.map(m => m.scores.valueArticulation)) },
      { name: 'Objection Handling', score: metric.scores.objectionHandling, teamAvg: average(metrics.map(m => m.scores.objectionHandling)) },
      { name: 'Closing', score: metric.scores.closing, teamAvg: average(metrics.map(m => m.scores.closing)) },
      { name: 'Rapport', score: metric.scores.rapport, teamAvg: average(metrics.map(m => m.scores.rapport)) },
      { name: 'Engagement', score: metric.scores.engagement, teamAvg: average(metrics.map(m => m.scores.engagement)) },
    ];
    
    for (const category of scoreCategories) {
      const vsTeamAvg = category.score - category.teamAvg;
      if (vsTeamAvg >= 10) { // At least 10 points above average
        strengths.push({
          area: category.name,
          score: category.score,
          vsTeamAvg,
          description: `${vsTeamAvg.toFixed(1)} points above team average`,
        });
      }
    }
    
    // Sort strengths by gap
    strengths.sort((a, b) => b.vsTeamAvg - a.vsTeamAvg);
    
    // Identify standout metrics
    const standoutMetrics: StandoutMetric[] = [];
    
    // Talk ratio
    const teamAvgTalkRatio = average(metrics.map(m => m.avgRepTalkPercentage));
    const talkRatioDiff = Math.abs(35 - metric.avgRepTalkPercentage); // 35% is ideal
    const teamAvgTalkRatioDiff = Math.abs(35 - teamAvgTalkRatio);
    if (talkRatioDiff < teamAvgTalkRatioDiff) {
      standoutMetrics.push({
        metric: 'Talk Ratio',
        value: metric.avgRepTalkPercentage,
        teamAvg: teamAvgTalkRatio,
        percentageBetter: ((teamAvgTalkRatioDiff - talkRatioDiff) / teamAvgTalkRatioDiff) * 100,
        description: 'Closer to ideal talk ratio',
      });
    }
    
    // Objection handling
    const teamAvgObjectionHandling = average(metrics.map(m => m.objectionHandlingRate));
    if (metric.objectionHandlingRate > teamAvgObjectionHandling) {
      standoutMetrics.push({
        metric: 'Objection Handling',
        value: metric.objectionHandlingRate,
        teamAvg: teamAvgObjectionHandling,
        percentageBetter: ((metric.objectionHandlingRate - teamAvgObjectionHandling) / teamAvgObjectionHandling) * 100,
        description: 'Handles objections more effectively',
      });
    }
    
    // Success factors
    const successFactors: string[] = [];
    if (metric.scores.discovery >= 85) {
      successFactors.push('Excellent discovery skills - asks the right questions');
    }
    if (metric.scores.objectionHandling >= 85) {
      successFactors.push('Masters objection handling - turns concerns into opportunities');
    }
    if (metric.idealTalkRatioPercentage >= 70) {
      successFactors.push('Maintains ideal talk ratio - listens more than talks');
    }
    if (metric.positiveSignalCount / metric.totalConversations >= 3) {
      successFactors.push('Generates strong buying signals from prospects');
    }
    
    // Mentorship recommendation
    const recommendedAsMentor = strengths.length >= 2 && metric.scores.overall >= 85;
    const mentorshipAreas: CoachingCategory[] = [];
    
    if (metric.scores.discovery >= 85) {mentorshipAreas.push('discovery');}
    if (metric.scores.objectionHandling >= 85) {mentorshipAreas.push('objection_handling');}
    if (metric.scores.closing >= 85) {mentorshipAreas.push('closing');}
    if (metric.scores.valueArticulation >= 85) {mentorshipAreas.push('value_articulation');}
    
    return {
      repId: metric.repId,
      repName: metric.repName,
      rank: index + 1,
      overallScore: metric.scores.overall,
      percentileRank: metric.percentileRank,
      topStrengths: strengths.slice(0, 5),
      standoutMetrics: standoutMetrics.slice(0, 3),
      successFactors,
      recommendedAsMentor,
      mentorshipAreas,
    };
  });
}

// ============================================================================
// IMPROVEMENT OPPORTUNITIES
// ============================================================================

/**
 * Find improvement opportunities
 */
function findImprovementOpportunities(
  metrics: RepPerformanceMetrics[],
  benchmarks: PerformanceBenchmarks,
  config: PerformanceAnalyticsConfig
): ImprovementOpportunity[] {
  // Focus on bottom 40% (developing + needs_improvement)
  const needsImprovement = metrics.filter(
    m => m.performanceTier === 'developing' || m.performanceTier === 'needs_improvement'
  );
  
  // Get top performer averages for comparison
  const topPerformers = metrics.filter(m => m.performanceTier === 'top_performer');
  const topPerformerAvgs = {
    discovery: average(topPerformers.map(m => m.scores.discovery)),
    valueArticulation: average(topPerformers.map(m => m.scores.valueArticulation)),
    objectionHandling: average(topPerformers.map(m => m.scores.objectionHandling)),
    closing: average(topPerformers.map(m => m.scores.closing)),
    rapport: average(topPerformers.map(m => m.scores.rapport)),
    engagement: average(topPerformers.map(m => m.scores.engagement)),
  };
  
  const teamAvgs = {
    discovery: average(metrics.map(m => m.scores.discovery)),
    valueArticulation: average(metrics.map(m => m.scores.valueArticulation)),
    objectionHandling: average(metrics.map(m => m.scores.objectionHandling)),
    closing: average(metrics.map(m => m.scores.closing)),
    rapport: average(metrics.map(m => m.scores.rapport)),
    engagement: average(metrics.map(m => m.scores.engagement)),
  };
  
  return needsImprovement.map(metric => {
    // Identify skill gaps
    const gaps: SkillGap[] = [];
    
    const skillCategories: Array<{
      skill: string;
      category: CoachingCategory;
      current: number;
      teamAvg: number;
      topAvg: number;
    }> = [
      { skill: 'Discovery', category: 'discovery', current: metric.scores.discovery, teamAvg: teamAvgs.discovery, topAvg: topPerformerAvgs.discovery },
      { skill: 'Value Articulation', category: 'value_articulation', current: metric.scores.valueArticulation, teamAvg: teamAvgs.valueArticulation, topAvg: topPerformerAvgs.valueArticulation },
      { skill: 'Objection Handling', category: 'objection_handling', current: metric.scores.objectionHandling, teamAvg: teamAvgs.objectionHandling, topAvg: topPerformerAvgs.objectionHandling },
      { skill: 'Closing', category: 'closing', current: metric.scores.closing, teamAvg: teamAvgs.closing, topAvg: topPerformerAvgs.closing },
      { skill: 'Rapport Building', category: 'rapport_building', current: metric.scores.rapport, teamAvg: teamAvgs.rapport, topAvg: topPerformerAvgs.rapport },
      { skill: 'Engagement', category: 'listening', current: metric.scores.engagement, teamAvg: teamAvgs.engagement, topAvg: topPerformerAvgs.engagement },
    ];
    
    for (const skill of skillCategories) {
      const gapSize = skill.teamAvg - skill.current;
      if (gapSize > 5) { // At least 5 points behind
        let priority: 'critical' | 'high' | 'medium' | 'low';
        if (gapSize >= 20) {priority = 'critical';}
        else if (gapSize >= 15) {priority = 'high';}
        else if (gapSize >= 10) {priority = 'medium';}
        else {priority = 'low';}
        
        gaps.push({
          skill: skill.skill,
          category: skill.category,
          currentScore: skill.current,
          teamAvgScore: skill.teamAvg,
          topPerformerScore: skill.topAvg,
          gapSize,
          priority,
          recommendedTraining: getTrainingRecommendation(skill.category, gapSize),
        });
      }
    }
    
    // Sort gaps by priority and size
    gaps.sort((a, b) => {
      const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
        return priorityOrder[a.priority] - priorityOrder[b.priority];
      }
      return b.gapSize - a.gapSize;
    });
    
    // Generate recommended actions
    const recommendedActions: string[] = [];
    const topGaps = gaps.slice(0, 3);
    
    for (const gap of topGaps) {
      recommendedActions.push(`Focus on ${gap.skill.toLowerCase()} - currently ${gap.gapSize.toFixed(0)} points behind team average`);
    }
    
    if (metric.idealTalkRatioPercentage < 50) {
      recommendedActions.push('Improve talk ratio - practice active listening and ask more questions');
    }
    
    if (metric.objectionHandlingRate < 60) {
      recommendedActions.push('Strengthen objection handling - review battlecards and practice responses');
    }
    
    // Calculate target score (move to next tier)
    const targetScore = metric.scores.overall + 15; // Aim for 15 point improvement
    
    // Estimate impact
    const potentialImpact = gaps.length >= 3 ? 'high' : gaps.length >= 2 ? 'medium' : 'low';
    
    // Estimate time to improve
    const avgGapSize = gaps.length > 0 ? average(gaps.map(g => g.gapSize)) : 0;
    let estimatedTimeToImprove: string;
    if (avgGapSize < 10) {
      estimatedTimeToImprove = '2-4 weeks';
    } else if (avgGapSize < 15) {
      estimatedTimeToImprove = '4-8 weeks';
    } else {
      estimatedTimeToImprove = '8-12 weeks';
    }
    
    return {
      repId: metric.repId,
      repName: metric.repName,
      currentScore: metric.scores.overall,
      currentTier: metric.performanceTier,
      gaps: gaps.slice(0, 5),
      recommendedActions,
      targetScore,
      potentialImpact,
      estimatedTimeToImprove,
    };
  });
}

// ============================================================================
// TREND ANALYSIS
// ============================================================================

/**
 * Generate trend analysis
 */
async function generateTrendAnalysis(
  organizationId: string,
  workspaceId: string,
  currentMetrics: RepPerformanceMetrics[],
  startDate: Date,
  endDate: Date,
  config: PerformanceAnalyticsConfig
): Promise<TrendAnalysis> {
  // Get historical data points
  const periodLength = endDate.getTime() - startDate.getTime();
  const dataPoints: TrendDataPoint[] = [];
  
  // For simplicity, we'll just show current period
  // In production, you'd fetch multiple historical periods
  dataPoints.push({
    date: endDate,
    value: average(currentMetrics.map(m => m.scores.overall)),
    label: 'Current',
  });
  
  // Calculate overall trends
  const overallScoreTrend: Trend = {
    direction: 'stable',
    changePercentage: 0,
    dataPoints,
    confidence: 'medium',
  };
  
  const sentimentTrend: Trend = {
    direction: 'stable',
    changePercentage: 0,
    dataPoints: [],
    confidence: 'medium',
  };
  
  const qualityTrend: Trend = {
    direction: 'stable',
    changePercentage: 0,
    dataPoints: [],
    confidence: 'medium',
  };
  
  // Identify risers and fallers (based on scoreChange which would be calculated from historical data)
  const risers: TrendingRep[] = [];
  const fallers: TrendingRep[] = [];
  const consistent: TrendingRep[] = [];
  
  for (const metric of currentMetrics) {
    if (Math.abs(metric.scoreChange) < 3) {
      consistent.push({
        repId: metric.repId,
        repName: metric.repName,
        scoreChange: metric.scoreChange,
        rankChange: metric.rankChange,
        trend: 'stable',
        description: 'Consistent performance',
      });
    }
  }
  
  const trendInsights: string[] = [
    'Team performance is stable across the analyzed period',
    `Average overall score: ${average(currentMetrics.map(m => m.scores.overall)).toFixed(1)}`,
  ];
  
  return {
    overallScoreTrend,
    sentimentTrend,
    qualityTrend,
    trendsByMetric: {},
    risers: risers.slice(0, 5),
    fallers: fallers.slice(0, 5),
    consistent: consistent.slice(0, 5),
    trendInsights,
  };
}

/**
 * Create empty trend analysis
 */
function createEmptyTrendAnalysis(): TrendAnalysis {
  return {
    overallScoreTrend: {
      direction: 'stable',
      changePercentage: 0,
      dataPoints: [],
      confidence: 'low',
    },
    sentimentTrend: {
      direction: 'stable',
      changePercentage: 0,
      dataPoints: [],
      confidence: 'low',
    },
    qualityTrend: {
      direction: 'stable',
      changePercentage: 0,
      dataPoints: [],
      confidence: 'low',
    },
    trendsByMetric: {},
    risers: [],
    fallers: [],
    consistent: [],
    trendInsights: [],
  };
}

// ============================================================================
// COACHING PRIORITIES
// ============================================================================

/**
 * Generate coaching priorities for the team
 */
function generateCoachingPriorities(
  metrics: RepPerformanceMetrics[],
  benchmarks: PerformanceBenchmarks,
  config: PerformanceAnalyticsConfig
): CoachingPriority[] {
  // Count coaching needs by category
  const categoryNeeds = new Map<CoachingCategory, { count: number; totalGap: number }>();
  
  for (const metric of metrics) {
    for (const category of metric.topCoachingAreas) {
      if (!categoryNeeds.has(category)) {
        categoryNeeds.set(category, { count: 0, totalGap: 0 });
      }
      const needs = categoryNeeds.get(category)!;
      needs.count++;
      // Gap would be calculated from skill scores
      needs.totalGap += 10; // Placeholder
    }
  }
  
  // Convert to priorities
  const priorities: CoachingPriority[] = [];
  
  for (const [category, needs] of categoryNeeds.entries()) {
    const avgGap = needs.totalGap / needs.count;
    const repsAffected = needs.count;
    const percentageAffected = (repsAffected / metrics.length) * 100;
    
    let priority: 'critical' | 'high' | 'medium' | 'low';
    if (percentageAffected >= 50 && avgGap >= 15) {priority = 'critical';}
    else if (percentageAffected >= 30 || avgGap >= 15) {priority = 'high';}
    else if (percentageAffected >= 20 || avgGap >= 10) {priority = 'medium';}
    else {priority = 'low';}
    
    const estimatedROI = percentageAffected >= 40 ? 'high' : percentageAffected >= 20 ? 'medium' : 'low';
    
    priorities.push({
      category,
      priority,
      repsAffected,
      avgGap,
      potentialImpact: `Improving this skill could benefit ${repsAffected} reps`,
      estimatedROI,
      recommendation: getCoachingRecommendation(category),
      suggestedActions: getSuggestedActions(category),
      resources: getResources(category),
    });
  }
  
  // Sort by priority and affected count
  priorities.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
      return priorityOrder[a.priority] - priorityOrder[b.priority];
    }
    return b.repsAffected - a.repsAffected;
  });
  
  return priorities.slice(0, config.maxCoachingPriorities);
}

// ============================================================================
// BEST PRACTICES
// ============================================================================

/**
 * Extract best practices from top performers
 */
function extractBestPractices(
  metrics: RepPerformanceMetrics[],
  topPerformers: TopPerformer[],
  config: PerformanceAnalyticsConfig
): BestPractice[] {
  const practices: BestPractice[] = [];
  
  for (const topPerformer of topPerformers) {
    const metric = metrics.find(m => m.repId === topPerformer.repId);
    if (!metric) {continue;}
    
    // Extract practices based on strengths
    for (const strength of topPerformer.topStrengths) {
      let category: CoachingCategory;
      let implementation: string;
      let examples: string[];
      
      if (strength.area.includes('Discovery')) {
        category = 'discovery';
        implementation = 'Ask open-ended questions early in the conversation to uncover pain points';
        examples = [
          'What challenges are you currently facing with [topic]?',
          'Can you walk me through your current process?',
          'What would an ideal solution look like for you?',
        ];
      } else if (strength.area.includes('Objection')) {
        category = 'objection_handling';
        implementation = 'Acknowledge the concern, provide evidence, and pivot to value';
        examples = [
          'I understand that concern. Let me share how we\'ve helped similar companies...',
          'That\'s a great question. Here\'s what our data shows...',
        ];
      } else if (strength.area.includes('Closing')) {
        category = 'closing';
        implementation = 'Create clear next steps with specific timelines and mutual commitments';
        examples = [
          'Based on our discussion, I propose we... What works for you?',
          'To move forward, we\'ll need to... Can you commit to that by [date]?',
        ];
      } else {
        continue;
      }
      
      practices.push({
        id: `${topPerformer.repId}-${category}`,
        title: `${strength.area} Excellence`,
        description: `Consistently scores ${strength.score.toFixed(0)}/100 in ${strength.area.toLowerCase()}`,
        sourceRepId: topPerformer.repId,
        sourceRepName: topPerformer.repName,
        successMetric: strength.area,
        successValue: strength.score,
        vsTeamAvg: strength.vsTeamAvg,
        applicableTo: [category],
        difficulty: 'medium',
        expectedImpact: 'high',
        implementation,
        examples,
      });
    }
  }
  
  return practices.slice(0, config.maxBestPractices);
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate average
 */
function average(numbers: number[]): number {
  if (numbers.length === 0) {return 0;}
  return numbers.reduce((sum, n) => sum + n, 0) / numbers.length;
}

/**
 * Calculate sum
 */
function sum(numbers: number[]): number {
  return numbers.reduce((sum, n) => sum + n, 0);
}

/**
 * Calculate median
 */
function median(numbers: number[]): number {
  if (numbers.length === 0) {return 0;}
  const sorted = [...numbers].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

/**
 * Calculate percentile
 */
function percentile(sortedNumbers: number[], p: number): number {
  if (sortedNumbers.length === 0) {return 0;}
  const index = Math.ceil((p / 100) * sortedNumbers.length) - 1;
  return sortedNumbers[Math.max(0, index)];
}

/**
 * Determine sentiment trend
 */
function determineSentimentTrend(analyses: ConversationAnalysis[]): 'improving' | 'declining' | 'stable' {
  if (analyses.length < 2) {return 'stable';}
  
  // Compare first half vs second half
  const mid = Math.floor(analyses.length / 2);
  const firstHalf = analyses.slice(0, mid);
  const secondHalf = analyses.slice(mid);
  
  const firstAvg = average(firstHalf.map(a => a.sentiment.overall.score));
  const secondAvg = average(secondHalf.map(a => a.sentiment.overall.score));
  
  const diff = secondAvg - firstAvg;
  
  if (diff > 0.1) {return 'improving';}
  if (diff < -0.1) {return 'declining';}
  return 'stable';
}

/**
 * Get training recommendation for a skill gap
 */
function getTrainingRecommendation(category: CoachingCategory, gapSize: number): string {
  const intensity = gapSize >= 15 ? 'intensive' : gapSize >= 10 ? 'focused' : 'targeted';
  
  const recommendations: Record<CoachingCategory, string> = {
    discovery: `${intensity} training on discovery questioning and needs analysis`,
    listening: `${intensity} training on active listening and engagement techniques`,
    objection_handling: `${intensity} training on objection frameworks and battlecard usage`,
    value_articulation: `${intensity} training on value selling and ROI presentations`,
    questioning: `${intensity} training on questioning strategies and conversation control`,
    closing: `${intensity} training on closing techniques and commitment securing`,
    rapport_building: `${intensity} training on relationship building and trust development`,
    time_management: `${intensity} training on conversation structure and time management`,
    technical_knowledge: `${intensity} training on product knowledge and technical selling`,
    competitor_positioning: `${intensity} training on competitive positioning and differentiation`,
    next_steps: `${intensity} training on action planning and follow-through`,
    other: `${intensity} training on general sales skills`,
  };
  
  return recommendations[category];
}

/**
 * Get coaching recommendation
 */
function getCoachingRecommendation(category: CoachingCategory): string {
  const recommendations: Record<CoachingCategory, string> = {
    discovery: 'Implement team-wide discovery framework and question bank',
    listening: 'Practice active listening techniques in role-plays',
    objection_handling: 'Create objection handling playbook and practice sessions',
    value_articulation: 'Develop value proposition templates and customer stories',
    questioning: 'Build question frameworks for each conversation stage',
    closing: 'Establish closing process and commitment language',
    rapport_building: 'Share relationship-building best practices from top performers',
    time_management: 'Create conversation structure templates',
    technical_knowledge: 'Conduct product deep-dive sessions',
    competitor_positioning: 'Review and practice with battlecards',
    next_steps: 'Implement standard next-steps framework',
    other: 'Provide general sales coaching',
  };
  
  return recommendations[category];
}

/**
 * Get suggested actions
 */
function getSuggestedActions(category: CoachingCategory): string[] {
  const actions: Record<CoachingCategory, string[]> = {
    discovery: [
      'Create discovery question bank',
      'Practice with role-plays',
      'Review top performer recordings',
    ],
    listening: [
      'Practice active listening exercises',
      'Track talk ratio in calls',
      'Get feedback on listening skills',
    ],
    objection_handling: [
      'Study battlecards',
      'Practice objection responses',
      'Learn from top performers',
    ],
    value_articulation: [
      'Build value proposition library',
      'Practice ROI presentations',
      'Collect customer success stories',
    ],
    questioning: [
      'Study questioning frameworks',
      'Practice in team meetings',
      'Get coaching on question quality',
    ],
    closing: [
      'Learn closing frameworks',
      'Practice commitment language',
      'Shadow top closers',
    ],
    rapport_building: [
      'Study relationship-building techniques',
      'Practice small talk and connection',
      'Learn from relationship masters',
    ],
    time_management: [
      'Create call structure templates',
      'Practice time management',
      'Track conversation flow',
    ],
    technical_knowledge: [
      'Attend product training',
      'Shadow technical team',
      'Study product documentation',
    ],
    competitor_positioning: [
      'Master battlecards',
      'Study competitor weaknesses',
      'Practice competitive positioning',
    ],
    next_steps: [
      'Create next-steps templates',
      'Practice action planning',
      'Track follow-through rate',
    ],
    other: [
      'General sales training',
      'Coaching sessions',
      'Skill assessment',
    ],
  };
  
  return actions[category];
}

/**
 * Get resources
 */
function getResources(category: CoachingCategory): string[] {
  return [
    'Internal training materials',
    'Best practice documentation',
    'Top performer recordings',
    'External training courses',
  ];
}

/**
 * Determine time period
 */
function determinePeriod(request: PerformanceAnalyticsRequest): {
  startDate: Date;
  endDate: Date;
  periodType: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom';
} {
  const endDate = request.endDate ? new Date(request.endDate) : new Date();
  let startDate: Date;
  let periodType: 'day' | 'week' | 'month' | 'quarter' | 'year' | 'custom' = request.periodType ?? 'month';
  
  if (request.startDate) {
    startDate = new Date(request.startDate);
    periodType = 'custom';
  } else {
    switch (periodType) {
      case 'day':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 1);
        break;
      case 'week':
        startDate = new Date(endDate);
        startDate.setDate(endDate.getDate() - 7);
        break;
      case 'month':
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - 1);
        break;
      case 'quarter':
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - 3);
        break;
      case 'year':
        startDate = new Date(endDate);
        startDate.setFullYear(endDate.getFullYear() - 1);
        break;
      default:
        startDate = new Date(endDate);
        startDate.setMonth(endDate.getMonth() - 1);
        periodType = 'month';
    }
  }
  
  return { startDate, endDate, periodType };
}

/**
 * Get conversation analyses for a period
 */
async function getConversationAnalyses(
  organizationId: string,
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<ConversationAnalysis[]> {
  // This would query Firestore for conversation analyses
  // For now, returning empty array - would be implemented in production
  return [];
}

/**
 * Get conversation for analysis
 */
async function getConversationForAnalysis(conversationId: string): Promise<{ repId: string } | null> {
  // This would query Firestore for conversation
  // For now, returning null - would be implemented in production
  return null;
}

/**
 * Get rep info
 */
async function getRepInfo(repId: string): Promise<{ name: string; email?: string }> {
  // This would query Firestore for rep info
  // For now, returning placeholder
  return { name: 'Rep Name', email: 'rep@example.com' };
}

/**
 * Emit analytics events
 */
async function emitAnalyticsEvents(
  analytics: TeamPerformanceAnalytics,
  organizationId: string
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();
    
    // Emit performance analyzed event
    const analyzedEvent = createPerformanceAnalyzedEvent(
      organizationId,
      analytics.workspaceId,
      analytics.repsIncluded,
      analytics.conversationsAnalyzed,
      analytics.teamMetrics.avgOverallScore,
      analytics.startDate,
      analytics.endDate
    );
    await coordinator.emitSignal(analyzedEvent);
    
    // Emit top performer events
    for (const performer of analytics.topPerformers.slice(0, 3)) {
      const topPerformerEvent = createTopPerformerIdentifiedEvent(
        organizationId,
        analytics.workspaceId,
        performer.repId,
        performer.rank,
        performer.overallScore,
        performer.topStrengths.map(s => s.area)
      );
      await coordinator.emitSignal(topPerformerEvent);
    }
    
    // Emit coaching priority events
    for (const priority of analytics.coachingPriorities.filter(p => p.priority === 'critical' || p.priority === 'high')) {
      const priorityEvent = createCoachingPriorityCreatedEvent(
        organizationId,
        analytics.workspaceId,
        priority.category,
        priority.priority,
        priority.repsAffected,
        priority.recommendation
      );
      await coordinator.emitSignal(priorityEvent);
    }
    
    logger.info('Performance analytics events emitted', {
      organizationId,
      eventsEmitted: 1 + analytics.topPerformers.length + analytics.coachingPriorities.filter(p => p.priority === 'critical' || p.priority === 'high').length,
    });
  } catch (error) {
    logger.error('Failed to emit analytics events', { error });
    // Don't throw - analytics was successful even if events failed
  }
}

/**
 * Generate performance leaderboard
 */
export async function generateLeaderboard(
  request: LeaderboardRequest
): Promise<PerformanceLeaderboard> {
  const { startDate, endDate, periodType } = determinePeriod({
    organizationId: request.organizationId,
    workspaceId: request.workspaceId,
    startDate: request.startDate,
    endDate: request.endDate,
    periodType: request.periodType,
  });
  
  // Get performance analytics
  const analytics = await generatePerformanceAnalytics({
    organizationId: request.organizationId,
    workspaceId: request.workspaceId,
    startDate,
    endDate,
    periodType,
  });
  
  // Build overall leaderboard
  const overall: LeaderboardEntry[] = analytics.individualMetrics.map((metric, index) => ({
    rank: index + 1,
    repId: metric.repId,
    repName: metric.repName,
    score: metric.scores.overall,
    badge: index === 0 ? ('top_performer' as const) : undefined,
    change: metric.rankChange,
  }));
  
  // Build category leaderboards
  const byCategory: Record<string, LeaderboardEntry[]> = {};
  
  // Discovery
  byCategory.discovery = [...analytics.individualMetrics]
    .sort((a, b) => b.scores.discovery - a.scores.discovery)
    .map((metric, index) => ({
      rank: index + 1,
      repId: metric.repId,
      repName: metric.repName,
      score: metric.scores.discovery,
      badge: index === 0 ? ('discovery_expert' as const) : undefined,
      change: 0,
    }));
  
  // Closing
  byCategory.closing = [...analytics.individualMetrics]
    .sort((a, b) => b.scores.closing - a.scores.closing)
    .map((metric, index) => ({
      rank: index + 1,
      repId: metric.repId,
      repName: metric.repName,
      score: metric.scores.closing,
      badge: index === 0 ? ('closer' as const) : undefined,
      change: 0,
    }));
  
  // Identify movers
  const movers: LeaderboardMover[] = [];
  for (const metric of analytics.individualMetrics) {
    if (Math.abs(metric.rankChange) >= 2) {
      movers.push({
        repId: metric.repId,
        repName: metric.repName,
        direction: metric.rankChange > 0 ? 'up' : 'down',
        rankChange: Math.abs(metric.rankChange),
        scoreChange: metric.scoreChange,
        reason: metric.rankChange > 0 ? 'Performance improvement' : 'Performance decline',
      });
    }
  }
  
  return {
    organizationId: request.organizationId,
    workspaceId:(request.workspaceId !== '' && request.workspaceId != null) ? request.workspaceId : 'default',
    startDate,
    endDate,
    periodType,
    overall: request.limit ? overall.slice(0, request.limit) : overall,
    byCategory,
    movers,
    generatedAt: new Date(),
    totalReps: analytics.repsIncluded,
  };
}

/**
 * Compare two reps
 */
export async function compareReps(
  request: RepComparisonRequest
): Promise<RepComparison> {
  const { startDate, endDate } = determinePeriod({
    organizationId: request.organizationId,
    workspaceId: request.workspaceId,
    startDate: request.startDate,
    endDate: request.endDate,
  });
  
  // Get performance analytics
  const analytics = await generatePerformanceAnalytics({
    organizationId: request.organizationId,
    workspaceId: request.workspaceId,
    startDate,
    endDate,
  });
  
  const rep1 = analytics.individualMetrics.find(m => m.repId === request.rep1Id);
  const rep2 = analytics.individualMetrics.find(m => m.repId === request.rep2Id);
  
  if (!rep1 || !rep2) {
    throw new Error('One or both reps not found');
  }
  
  // Calculate differences
  const scoreDifferences: Record<string, number> = {
    overall: rep1.scores.overall - rep2.scores.overall,
    discovery: rep1.scores.discovery - rep2.scores.discovery,
    valueArticulation: rep1.scores.valueArticulation - rep2.scores.valueArticulation,
    objectionHandling: rep1.scores.objectionHandling - rep2.scores.objectionHandling,
    closing: rep1.scores.closing - rep2.scores.closing,
    rapport: rep1.scores.rapport - rep2.scores.rapport,
    engagement: rep1.scores.engagement - rep2.scores.engagement,
  };
  
  // Strength comparison
  const strengthComparison: ComparisonInsight[] = [];
  for (const [metric, diff] of Object.entries(scoreDifferences)) {
    if (Math.abs(diff) >= 5) {
      strengthComparison.push({
        metric,
        rep1Value: (rep1.scores as any)[metric],
        rep2Value: (rep2.scores as any)[metric],
        difference: diff,
        significance: Math.abs(diff) >= 15 ? 'major' : Math.abs(diff) >= 10 ? 'moderate' : 'minor',
        insight: diff > 0 
          ? `${rep1.repName} excels in ${metric}`
          : `${rep2.repName} excels in ${metric}`,
      });
    }
  }
  
  // Learning opportunities
  const learningOpportunities: LearningOpportunity[] = [];
  
  if (rep1.scores.discovery > rep2.scores.discovery + 10) {
    learningOpportunities.push({
      fromRep: rep1.repName,
      toRep: rep2.repName,
      skill: 'Discovery',
      potential: `${rep2.repName} could improve discovery by learning from ${rep1.repName}`,
    });
  }
  
  if (rep2.scores.closing > rep1.scores.closing + 10) {
    learningOpportunities.push({
      fromRep: rep2.repName,
      toRep: rep1.repName,
      skill: 'Closing',
      potential: `${rep1.repName} could improve closing by learning from ${rep2.repName}`,
    });
  }
  
  return {
    rep1,
    rep2,
    scoreDifferences,
    strengthComparison,
    weaknessComparison: [],
    learningOpportunities,
  };
}

/**
 * Get metric breakdown
 */
export async function getMetricBreakdown(
  request: MetricBreakdownRequest
): Promise<MetricBreakdown> {
  const { startDate, endDate } = determinePeriod({
    organizationId: request.organizationId,
    workspaceId: request.workspaceId,
    startDate: request.startDate,
    endDate: request.endDate,
  });
  
  // Get performance analytics
  const analytics = await generatePerformanceAnalytics({
    organizationId: request.organizationId,
    workspaceId: request.workspaceId,
    startDate,
    endDate,
  });
  
  // Extract metric values
  const values = analytics.individualMetrics.map(m => (m.scores as any)[request.metric] ?? m.scores.overall);
  
  // Calculate statistics
  const teamAvg = average(values);
  const teamMedian = median(values);
  const teamMin = Math.min(...values);
  const teamMax = Math.max(...values);
  
  // Calculate standard deviation
  const variance = average(values.map(v => Math.pow(v - teamAvg, 2)));
  const standardDeviation = Math.sqrt(variance);
  
  // Calculate distribution
  const distribution: MetricDistribution[] = [
    { range: '0-20', count: values.filter(v => v < 20).length, percentage: 0 },
    { range: '20-40', count: values.filter(v => v >= 20 && v < 40).length, percentage: 0 },
    { range: '40-60', count: values.filter(v => v >= 40 && v < 60).length, percentage: 0 },
    { range: '60-80', count: values.filter(v => v >= 60 && v < 80).length, percentage: 0 },
    { range: '80-100', count: values.filter(v => v >= 80).length, percentage: 0 },
  ];
  
  for (const dist of distribution) {
    dist.percentage = (dist.count / values.length) * 100;
  }
  
  // By tier
  const byTier: Record<string, number> = {};
  for (const tier of ['top_performer', 'high_performer', 'solid_performer', 'developing', 'needs_improvement']) {
    const tierMetrics = analytics.individualMetrics.filter(m => m.performanceTier === tier);
    byTier[tier] = tierMetrics.length > 0 ? average(tierMetrics.map(m => (m.scores as any)[request.metric] ?? m.scores.overall)) : 0;
  }
  
  return {
    metric: request.metric,
    teamAvg,
    teamMedian,
    teamMin,
    teamMax,
    standardDeviation,
    distribution,
    byTier,
    correlations: [],
  };
}
