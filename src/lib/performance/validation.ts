/**
 * Performance Analytics - Validation Schemas
 * 
 * Zod validation schemas for performance analytics requests and responses.
 * Ensures data integrity and type safety for all API operations.
 * 
 * @module lib/performance
 */

import { z } from 'zod';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const PeriodTypeSchema = z.enum([
  'day',
  'week',
  'month',
  'quarter',
  'year',
  'custom',
]);

export const PerformanceTierSchema = z.enum([
  'top_performer',
  'high_performer',
  'solid_performer',
  'developing',
  'needs_improvement',
]);

export const PrioritySchema = z.enum([
  'critical',
  'high',
  'medium',
  'low',
]);

export const ImpactSchema = z.enum([
  'high',
  'medium',
  'low',
]);

export const TrendDirectionSchema = z.enum([
  'improving',
  'declining',
  'stable',
]);

export const ConfidenceSchema = z.enum([
  'high',
  'medium',
  'low',
]);

export const CoachingCategorySchema = z.enum([
  'discovery',
  'listening',
  'objection_handling',
  'value_articulation',
  'questioning',
  'closing',
  'rapport_building',
  'time_management',
  'technical_knowledge',
  'competitor_positioning',
  'next_steps',
  'other',
]);

export const LeaderboardBadgeSchema = z.enum([
  'top_performer',
  'most_improved',
  'consistency_award',
  'coaching_master',
  'objection_handler',
  'discovery_expert',
  'closer',
]);

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Performance analytics request schema
 */
export const PerformanceAnalyticsRequestSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().optional(),
  
  // Time period
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
  periodType: PeriodTypeSchema.optional(),
  
  // Filters
  repIds: z.array(z.string()).optional(),
  minConversations: z.number().int().min(1).max(100).optional(),
  
  // Options
  includeComparisons: z.boolean().optional(),
  includeTrends: z.boolean().optional(),
  includeLeaderboard: z.boolean().optional(),
  
  // Force refresh
  forceRefresh: z.boolean().optional(),
});

/**
 * Rep comparison request schema
 */
export const RepComparisonRequestSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().optional(),
  rep1Id: z.string().min(1, 'Rep 1 ID is required'),
  rep2Id: z.string().min(1, 'Rep 2 ID is required'),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
}).refine(
  (data) => data.rep1Id !== data.rep2Id,
  { message: 'Cannot compare a rep with themselves' }
);

/**
 * Leaderboard request schema
 */
export const LeaderboardRequestSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().optional(),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
  periodType: PeriodTypeSchema.optional(),
  category: z.string().optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

/**
 * Metric breakdown request schema
 */
export const MetricBreakdownRequestSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().optional(),
  metric: z.string().min(1, 'Metric name is required'),
  startDate: z.union([z.string(), z.date()]).optional(),
  endDate: z.union([z.string(), z.date()]).optional(),
});

// ============================================================================
// CORE TYPE SCHEMAS
// ============================================================================

/**
 * Sentiment distribution schema
 */
export const SentimentDistributionSchema = z.object({
  veryPositive: z.number().min(0).max(100),
  positive: z.number().min(0).max(100),
  neutral: z.number().min(0).max(100),
  negative: z.number().min(0).max(100),
  veryNegative: z.number().min(0).max(100),
});

/**
 * Team metrics schema
 */
export const TeamMetricsSchema = z.object({
  totalConversations: z.number().int().min(0),
  avgConversationsPerRep: z.number().min(0),
  avgOverallScore: z.number().min(0).max(100),
  avgDiscoveryScore: z.number().min(0).max(100),
  avgValueArticulationScore: z.number().min(0).max(100),
  avgObjectionHandlingScore: z.number().min(0).max(100),
  avgClosingScore: z.number().min(0).max(100),
  avgRapportScore: z.number().min(0).max(100),
  avgEngagementScore: z.number().min(0).max(100),
  avgSentiment: z.number().min(-1).max(1),
  sentimentDistribution: SentimentDistributionSchema,
  avgRepTalkPercentage: z.number().min(0).max(100),
  idealTalkRatioPercentage: z.number().min(0).max(100),
  avgQualityScore: z.number().min(0).max(100),
  redFlagRate: z.number().min(0),
  positiveSignalRate: z.number().min(0),
  avgObjectionsPerConversation: z.number().min(0),
  objectionHandlingRate: z.number().min(0).max(100),
  avgTopicsCovered: z.number().min(0),
  topicCoverageScore: z.number().min(0).max(100),
  avgCoachingInsights: z.number().min(0),
  avgFollowUpActions: z.number().min(0),
});

/**
 * Conversation scores schema
 */
export const ConversationScoresSchema = z.object({
  overall: z.number().min(0).max(100),
  discovery: z.number().min(0).max(100),
  valueArticulation: z.number().min(0).max(100),
  objectionHandling: z.number().min(0).max(100),
  closing: z.number().min(0).max(100),
  rapport: z.number().min(0).max(100),
  engagement: z.number().min(0).max(100),
});

/**
 * Rep performance metrics schema
 */
export const RepPerformanceMetricsSchema = z.object({
  repId: z.string(),
  repName: z.string(),
  repEmail: z.string().email().optional(),
  totalConversations: z.number().int().min(0),
  scores: ConversationScoresSchema,
  avgSentiment: z.number().min(-1).max(1),
  sentimentTrend: TrendDirectionSchema,
  avgRepTalkPercentage: z.number().min(0).max(100),
  idealTalkRatioPercentage: z.number().min(0).max(100),
  avgQualityScore: z.number().min(0).max(100),
  redFlagCount: z.number().int().min(0),
  positiveSignalCount: z.number().int().min(0),
  avgObjectionsPerConversation: z.number().min(0),
  objectionHandlingRate: z.number().min(0).max(100),
  topObjectionTypes: z.array(z.string()),
  avgTopicsCovered: z.number().min(0),
  topicCoverageScore: z.number().min(0).max(100),
  strongTopics: z.array(z.string()),
  weakTopics: z.array(z.string()),
  topCoachingAreas: z.array(CoachingCategorySchema),
  coachingPriority: PrioritySchema,
  performanceTier: PerformanceTierSchema,
  percentileRank: z.number().min(0).max(100),
  scoreChange: z.number(),
  rankChange: z.number().int(),
});

/**
 * Percentile thresholds schema
 */
export const PercentileThresholdsSchema = z.object({
  p90: z.number().min(0).max(100),
  p75: z.number().min(0).max(100),
  p50: z.number().min(0).max(100),
  p25: z.number().min(0).max(100),
  p10: z.number().min(0).max(100),
});

/**
 * Performance benchmarks schema
 */
export const PerformanceBenchmarksSchema = z.object({
  topPerformerAvgScore: z.number().min(0).max(100),
  teamMedianScore: z.number().min(0).max(100),
  bottomPerformerAvgScore: z.number().min(0).max(100),
  topPerformerAvgSentiment: z.number().min(-1).max(1),
  teamMedianSentiment: z.number().min(-1).max(1),
  topPerformerTalkRatio: z.number().min(0).max(100),
  teamMedianTalkRatio: z.number().min(0).max(100),
  topPerformerQuality: z.number().min(0).max(100),
  teamMedianQuality: z.number().min(0).max(100),
  topPerformerObjectionHandling: z.number().min(0).max(100),
  teamMedianObjectionHandling: z.number().min(0).max(100),
  percentiles: PercentileThresholdsSchema,
});

/**
 * Strength schema
 */
export const StrengthSchema = z.object({
  area: z.string(),
  score: z.number().min(0).max(100),
  vsTeamAvg: z.number(),
  description: z.string(),
});

/**
 * Standout metric schema
 */
export const StandoutMetricSchema = z.object({
  metric: z.string(),
  value: z.number(),
  teamAvg: z.number(),
  percentageBetter: z.number(),
  description: z.string(),
});

/**
 * Top performer schema
 */
export const TopPerformerSchema = z.object({
  repId: z.string(),
  repName: z.string(),
  rank: z.number().int().min(1),
  overallScore: z.number().min(0).max(100),
  percentileRank: z.number().min(0).max(100),
  topStrengths: z.array(StrengthSchema),
  standoutMetrics: z.array(StandoutMetricSchema),
  successFactors: z.array(z.string()),
  recommendedAsMentor: z.boolean(),
  mentorshipAreas: z.array(CoachingCategorySchema),
});

/**
 * Skill gap schema
 */
export const SkillGapSchema = z.object({
  skill: z.string(),
  category: CoachingCategorySchema,
  currentScore: z.number().min(0).max(100),
  teamAvgScore: z.number().min(0).max(100),
  topPerformerScore: z.number().min(0).max(100),
  gapSize: z.number(),
  priority: PrioritySchema,
  recommendedTraining: z.string(),
});

/**
 * Improvement opportunity schema
 */
export const ImprovementOpportunitySchema = z.object({
  repId: z.string(),
  repName: z.string(),
  currentScore: z.number().min(0).max(100),
  currentTier: PerformanceTierSchema,
  gaps: z.array(SkillGapSchema),
  recommendedActions: z.array(z.string()),
  targetScore: z.number().min(0).max(100),
  potentialImpact: ImpactSchema,
  estimatedTimeToImprove: z.string(),
});

/**
 * Trend data point schema
 */
export const TrendDataPointSchema = z.object({
  date: z.date(),
  value: z.number(),
  label: z.string(),
});

/**
 * Trend schema
 */
export const TrendSchema = z.object({
  direction: TrendDirectionSchema,
  changePercentage: z.number(),
  dataPoints: z.array(TrendDataPointSchema),
  confidence: ConfidenceSchema,
});

/**
 * Trending rep schema
 */
export const TrendingRepSchema = z.object({
  repId: z.string(),
  repName: z.string(),
  scoreChange: z.number(),
  rankChange: z.number().int(),
  trend: z.enum(['up', 'down', 'stable']),
  description: z.string(),
});

/**
 * Trend analysis schema
 */
export const TrendAnalysisSchema = z.object({
  overallScoreTrend: TrendSchema,
  sentimentTrend: TrendSchema,
  qualityTrend: TrendSchema,
  trendsByMetric: z.record(z.string(), TrendSchema),
  risers: z.array(TrendingRepSchema),
  fallers: z.array(TrendingRepSchema),
  consistent: z.array(TrendingRepSchema),
  trendInsights: z.array(z.string()),
});

/**
 * Coaching priority schema
 */
export const CoachingPrioritySchema = z.object({
  category: CoachingCategorySchema,
  priority: PrioritySchema,
  repsAffected: z.number().int().min(0),
  avgGap: z.number(),
  potentialImpact: z.string(),
  estimatedROI: ImpactSchema,
  recommendation: z.string(),
  suggestedActions: z.array(z.string()),
  resources: z.array(z.string()),
});

/**
 * Best practice schema
 */
export const BestPracticeSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string(),
  sourceRepId: z.string(),
  sourceRepName: z.string(),
  successMetric: z.string(),
  successValue: z.number(),
  vsTeamAvg: z.number(),
  applicableTo: z.array(CoachingCategorySchema),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  expectedImpact: ImpactSchema,
  implementation: z.string(),
  examples: z.array(z.string()),
});

/**
 * Team performance analytics schema
 */
export const TeamPerformanceAnalyticsSchema = z.object({
  organizationId: z.string(),
  workspaceId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  periodType: PeriodTypeSchema,
  teamMetrics: TeamMetricsSchema,
  individualMetrics: z.array(RepPerformanceMetricsSchema),
  benchmarks: PerformanceBenchmarksSchema,
  topPerformers: z.array(TopPerformerSchema),
  improvementOpportunities: z.array(ImprovementOpportunitySchema),
  trendAnalysis: TrendAnalysisSchema,
  coachingPriorities: z.array(CoachingPrioritySchema),
  bestPractices: z.array(BestPracticeSchema),
  generatedAt: z.date(),
  conversationsAnalyzed: z.number().int().min(0),
  repsIncluded: z.number().int().min(0),
});

// ============================================================================
// LEADERBOARD SCHEMAS
// ============================================================================

/**
 * Leaderboard entry schema
 */
export const LeaderboardEntrySchema = z.object({
  rank: z.number().int().min(1),
  repId: z.string(),
  repName: z.string(),
  score: z.number().min(0).max(100),
  badge: LeaderboardBadgeSchema.optional(),
  change: z.number().int(),
});

/**
 * Leaderboard mover schema
 */
export const LeaderboardMoverSchema = z.object({
  repId: z.string(),
  repName: z.string(),
  direction: z.enum(['up', 'down']),
  rankChange: z.number().int().min(1),
  scoreChange: z.number(),
  reason: z.string(),
});

/**
 * Performance leaderboard schema
 */
export const PerformanceLeaderboardSchema = z.object({
  organizationId: z.string(),
  workspaceId: z.string(),
  startDate: z.date(),
  endDate: z.date(),
  periodType: PeriodTypeSchema,
  overall: z.array(LeaderboardEntrySchema),
  byCategory: z.record(z.string(), z.array(LeaderboardEntrySchema)),
  movers: z.array(LeaderboardMoverSchema),
  generatedAt: z.date(),
  totalReps: z.number().int().min(0),
});

// ============================================================================
// COMPARISON SCHEMAS
// ============================================================================

/**
 * Comparison insight schema
 */
export const ComparisonInsightSchema = z.object({
  metric: z.string(),
  rep1Value: z.number(),
  rep2Value: z.number(),
  difference: z.number(),
  significance: z.enum(['major', 'moderate', 'minor']),
  insight: z.string(),
});

/**
 * Learning opportunity schema
 */
export const LearningOpportunitySchema = z.object({
  fromRep: z.string(),
  toRep: z.string(),
  skill: z.string(),
  potential: z.string(),
});

/**
 * Rep comparison schema
 */
export const RepComparisonSchema = z.object({
  rep1: RepPerformanceMetricsSchema,
  rep2: RepPerformanceMetricsSchema,
  scoreDifferences: z.record(z.string(), z.number()),
  strengthComparison: z.array(ComparisonInsightSchema),
  weaknessComparison: z.array(ComparisonInsightSchema),
  learningOpportunities: z.array(LearningOpportunitySchema),
});

// ============================================================================
// METRIC BREAKDOWN SCHEMAS
// ============================================================================

/**
 * Metric distribution schema
 */
export const MetricDistributionSchema = z.object({
  range: z.string(),
  count: z.number().int().min(0),
  percentage: z.number().min(0).max(100),
});

/**
 * Metric correlation schema
 */
export const MetricCorrelationSchema = z.object({
  metric: z.string(),
  correlation: z.number().min(-1).max(1),
  strength: z.enum(['strong', 'moderate', 'weak', 'none']),
  insight: z.string(),
});

/**
 * Metric breakdown schema
 */
export const MetricBreakdownSchema = z.object({
  metric: z.string(),
  teamAvg: z.number(),
  teamMedian: z.number(),
  teamMin: z.number(),
  teamMax: z.number(),
  standardDeviation: z.number().min(0),
  distribution: z.array(MetricDistributionSchema),
  byTier: z.record(PerformanceTierSchema, z.number()),
  correlations: z.array(MetricCorrelationSchema),
});

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validate performance analytics request
 */
export function validatePerformanceAnalyticsRequest(data: unknown) {
  return PerformanceAnalyticsRequestSchema.parse(data);
}

/**
 * Validate rep comparison request
 */
export function validateRepComparisonRequest(data: unknown) {
  return RepComparisonRequestSchema.parse(data);
}

/**
 * Validate leaderboard request
 */
export function validateLeaderboardRequest(data: unknown) {
  return LeaderboardRequestSchema.parse(data);
}

/**
 * Validate metric breakdown request
 */
export function validateMetricBreakdownRequest(data: unknown) {
  return MetricBreakdownRequestSchema.parse(data);
}

/**
 * Validate team performance analytics
 */
export function validateTeamPerformanceAnalytics(data: unknown) {
  return TeamPerformanceAnalyticsSchema.parse(data);
}

/**
 * Validate performance leaderboard
 */
export function validatePerformanceLeaderboard(data: unknown) {
  return PerformanceLeaderboardSchema.parse(data);
}

/**
 * Validate rep comparison
 */
export function validateRepComparison(data: unknown) {
  return RepComparisonSchema.parse(data);
}

/**
 * Validate metric breakdown
 */
export function validateMetricBreakdown(data: unknown) {
  return MetricBreakdownSchema.parse(data);
}
