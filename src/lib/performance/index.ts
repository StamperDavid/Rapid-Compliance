/**
 * Performance Analytics - Module Exports
 * 
 * Team-wide conversation performance analytics and benchmarking system.
 * Provides manager-level insights, top performer identification,
 * improvement opportunities, and coaching priorities.
 * 
 * MAIN FEATURES:
 * - Team performance aggregation and metrics
 * - Individual vs team benchmarking
 * - Top performer identification
 * - Improvement opportunity detection
 * - Trend analysis over time
 * - Coaching priority recommendations
 * - Best practice extraction
 * - Performance leaderboards
 * - Rep comparison
 * - Metric breakdown analysis
 * 
 * USAGE:
 * ```typescript
 * import { generatePerformanceAnalytics } from '@/lib/performance';
 * 
 * const analytics = await generatePerformanceAnalytics({
 *   periodType: 'month',
 * });
 * ```
 * 
 * @module lib/performance
 */

// ============================================================================
// ENGINE
// ============================================================================

export {
  generatePerformanceAnalytics,
  generateLeaderboard,
  compareReps,
  getMetricBreakdown,
} from './performance-engine';

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Core types
  TeamPerformanceAnalytics,
  PeriodType,
  TeamMetrics,
  SentimentDistribution,
  RepPerformanceMetrics,
  PerformanceTier,
  PerformanceBenchmarks,
  PercentileThresholds,
  
  // Top performers
  TopPerformer,
  Strength,
  StandoutMetric,
  
  // Improvement
  ImprovementOpportunity,
  SkillGap,
  
  // Trends
  TrendAnalysis,
  Trend,
  TrendDataPoint,
  TrendingRep,
  
  // Coaching
  CoachingPriority,
  BestPractice,
  
  // Comparison
  RepComparison,
  ComparisonInsight,
  LearningOpportunity,
  
  // Leaderboard
  PerformanceLeaderboard,
  LeaderboardEntry,
  LeaderboardBadge,
  LeaderboardMover,
  
  // Metric breakdown
  MetricBreakdown,
  MetricDistribution,
  MetricCorrelation,
  
  // Requests
  PerformanceAnalyticsRequest,
  RepComparisonRequest,
  LeaderboardRequest,
  MetricBreakdownRequest,
  
  // Config
  PerformanceAnalyticsConfig,
} from './types';

export {
  DEFAULT_PERFORMANCE_CONFIG,
} from './types';

// ============================================================================
// VALIDATION
// ============================================================================

export {
  // Schemas
  PerformanceAnalyticsRequestSchema,
  RepComparisonRequestSchema,
  LeaderboardRequestSchema,
  MetricBreakdownRequestSchema,
  TeamPerformanceAnalyticsSchema,
  PerformanceLeaderboardSchema,
  RepComparisonSchema,
  MetricBreakdownSchema,
  TeamMetricsSchema,
  RepPerformanceMetricsSchema,
  PerformanceBenchmarksSchema,
  TopPerformerSchema,
  ImprovementOpportunitySchema,
  TrendAnalysisSchema,
  CoachingPrioritySchema,
  BestPracticeSchema,
  
  // Validation functions
  validatePerformanceAnalyticsRequest,
  validateRepComparisonRequest,
  validateLeaderboardRequest,
  validateMetricBreakdownRequest,
  validateTeamPerformanceAnalytics,
  validatePerformanceLeaderboard,
  validateRepComparison,
  validateMetricBreakdown,
} from './validation';

// ============================================================================
// EVENTS
// ============================================================================

export type {
  PerformanceAnalyzedEvent,
  TopPerformerIdentifiedEvent,
  ImprovementOpportunityDetectedEvent,
  CoachingPriorityCreatedEvent,
  BestPracticeExtractedEvent,
  TrendDetectedEvent,
  LeaderboardUpdatedEvent,
  BenchmarkChangedEvent,
  PerformanceAlertTriggeredEvent,
} from './events';

export {
  createPerformanceAnalyzedEvent,
  createTopPerformerIdentifiedEvent,
  createImprovementOpportunityDetectedEvent,
  createCoachingPriorityCreatedEvent,
  createBestPracticeExtractedEvent,
  createTrendDetectedEvent,
  createLeaderboardUpdatedEvent,
  createBenchmarkChangedEvent,
  createPerformanceAlertTriggeredEvent,
} from './events';
