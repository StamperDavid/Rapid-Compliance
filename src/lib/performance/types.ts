/**
 * Performance Analytics - Type Definitions
 * 
 * Team-wide conversation performance analytics and benchmarking.
 * Aggregates conversation intelligence data across all sales reps
 * to provide manager-level insights and team performance tracking.
 * 
 * CAPABILITIES:
 * - Team performance aggregation
 * - Individual vs team benchmarking
 * - Top performer identification
 * - Trend analysis over time
 * - Skill gap analysis
 * - Conversation quality metrics
 * - Coaching priority recommendations
 * 
 * @module lib/performance
 */

import type { Timestamp } from 'firebase/firestore';
import type {
  ConversationScores,
  CoachingCategory,
  ObjectionType,
  TopicCategory,
} from '@/lib/conversation/types';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Team performance analytics
 */
export interface TeamPerformanceAnalytics {
  // Time period
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  
  // Team metrics
  teamMetrics: TeamMetrics;
  individualMetrics: RepPerformanceMetrics[];
  
  // Benchmarks
  benchmarks: PerformanceBenchmarks;
  
  // Insights
  topPerformers: TopPerformer[];
  improvementOpportunities: ImprovementOpportunity[];
  trendAnalysis: TrendAnalysis;
  
  // Recommendations
  coachingPriorities: CoachingPriority[];
  bestPractices: BestPractice[];
  
  // Metadata
  generatedAt: Date;
  conversationsAnalyzed: number;
  repsIncluded: number;
}

/**
 * Time period type
 */
export type PeriodType = 
  | 'day'
  | 'week'
  | 'month'
  | 'quarter'
  | 'year'
  | 'custom';

/**
 * Team-wide metrics
 */
export interface TeamMetrics {
  // Conversation metrics
  totalConversations: number;
  avgConversationsPerRep: number;
  
  // Score metrics
  avgOverallScore: number;
  avgDiscoveryScore: number;
  avgValueArticulationScore: number;
  avgObjectionHandlingScore: number;
  avgClosingScore: number;
  avgRapportScore: number;
  avgEngagementScore: number;
  
  // Sentiment metrics
  avgSentiment: number; // -1 to 1
  sentimentDistribution: SentimentDistribution;
  
  // Talk ratio metrics
  avgRepTalkPercentage: number;
  idealTalkRatioPercentage: number; // % of conversations with ideal ratio
  
  // Quality metrics
  avgQualityScore: number; // 0-100
  redFlagRate: number; // per conversation
  positiveSignalRate: number; // per conversation
  
  // Objection metrics
  avgObjectionsPerConversation: number;
  objectionHandlingRate: number; // % addressed successfully
  
  // Topic coverage
  avgTopicsCovered: number;
  topicCoverageScore: number; // 0-100
  
  // Coaching metrics
  avgCoachingInsights: number;
  avgFollowUpActions: number;
}

/**
 * Sentiment distribution
 */
export interface SentimentDistribution {
  veryPositive: number; // percentage
  positive: number;
  neutral: number;
  negative: number;
  veryNegative: number;
}

/**
 * Individual rep performance metrics
 */
export interface RepPerformanceMetrics {
  repId: string;
  repName: string;
  repEmail?: string;
  
  // Conversation count
  totalConversations: number;
  
  // Scores
  scores: ConversationScores;
  
  // Sentiment
  avgSentiment: number;
  sentimentTrend: 'improving' | 'declining' | 'stable';
  
  // Talk ratio
  avgRepTalkPercentage: number;
  idealTalkRatioPercentage: number;
  
  // Quality
  avgQualityScore: number;
  redFlagCount: number;
  positiveSignalCount: number;
  
  // Objections
  avgObjectionsPerConversation: number;
  objectionHandlingRate: number;
  topObjectionTypes: ObjectionType[];
  
  // Topics
  avgTopicsCovered: number;
  topicCoverageScore: number;
  strongTopics: TopicCategory[];
  weakTopics: TopicCategory[];
  
  // Coaching
  topCoachingAreas: CoachingCategory[];
  coachingPriority: 'critical' | 'high' | 'medium' | 'low';
  
  // Performance tier
  performanceTier: PerformanceTier;
  percentileRank: number; // 0-100
  
  // Trends
  scoreChange: number; // vs previous period
  rankChange: number; // position change
}

/**
 * Performance tier
 */
export type PerformanceTier = 
  | 'top_performer' // Top 20%
  | 'high_performer' // 20-40%
  | 'solid_performer' // 40-60%
  | 'developing' // 60-80%
  | 'needs_improvement'; // Bottom 20%

/**
 * Performance benchmarks
 */
export interface PerformanceBenchmarks {
  // Score benchmarks
  topPerformerAvgScore: number;
  teamMedianScore: number;
  bottomPerformerAvgScore: number;
  
  // Sentiment benchmarks
  topPerformerAvgSentiment: number;
  teamMedianSentiment: number;
  
  // Talk ratio benchmarks
  topPerformerTalkRatio: number;
  teamMedianTalkRatio: number;
  
  // Quality benchmarks
  topPerformerQuality: number;
  teamMedianQuality: number;
  
  // Objection benchmarks
  topPerformerObjectionHandling: number;
  teamMedianObjectionHandling: number;
  
  // Percentile thresholds
  percentiles: PercentileThresholds;
}

/**
 * Percentile thresholds
 */
export interface PercentileThresholds {
  p90: number; // 90th percentile score
  p75: number; // 75th percentile
  p50: number; // 50th percentile (median)
  p25: number; // 25th percentile
  p10: number; // 10th percentile
}

/**
 * Top performer
 */
export interface TopPerformer {
  repId: string;
  repName: string;
  rank: number;
  
  // Performance
  overallScore: number;
  percentileRank: number;
  
  // Strengths
  topStrengths: Strength[];
  
  // Standout metrics
  standoutMetrics: StandoutMetric[];
  
  // What makes them great
  successFactors: string[];
  
  // Recommendations
  recommendedAsMentor: boolean;
  mentorshipAreas: CoachingCategory[];
}

/**
 * Strength
 */
export interface Strength {
  area: string;
  score: number; // 0-100
  vsTeamAvg: number; // percentage points above team avg
  description: string;
}

/**
 * Standout metric
 */
export interface StandoutMetric {
  metric: string;
  value: number;
  teamAvg: number;
  percentageBetter: number;
  description: string;
}

/**
 * Improvement opportunity
 */
export interface ImprovementOpportunity {
  repId: string;
  repName: string;
  
  // Current state
  currentScore: number;
  currentTier: PerformanceTier;
  
  // Gap analysis
  gaps: SkillGap[];
  
  // Recommendations
  recommendedActions: string[];
  targetScore: number;
  potentialImpact: 'high' | 'medium' | 'low';
  
  // Timeline
  estimatedTimeToImprove: string; // e.g., "2-4 weeks"
}

/**
 * Skill gap
 */
export interface SkillGap {
  skill: string;
  category: CoachingCategory;
  currentScore: number;
  teamAvgScore: number;
  topPerformerScore: number;
  gapSize: number; // points behind team avg
  priority: 'critical' | 'high' | 'medium' | 'low';
  recommendedTraining: string;
}

/**
 * Trend analysis
 */
export interface TrendAnalysis {
  // Overall trends
  overallScoreTrend: Trend;
  sentimentTrend: Trend;
  qualityTrend: Trend;
  
  // Detailed trends
  trendsByMetric: Record<string, Trend>;
  
  // Rep movement
  risers: TrendingRep[]; // Improving the most
  fallers: TrendingRep[]; // Declining the most
  consistent: TrendingRep[]; // Most stable
  
  // Insights
  trendInsights: string[];
}

/**
 * Trend
 */
export interface Trend {
  direction: 'improving' | 'declining' | 'stable';
  changePercentage: number;
  dataPoints: TrendDataPoint[];
  confidence: 'high' | 'medium' | 'low';
}

/**
 * Trend data point
 */
export interface TrendDataPoint {
  date: Date;
  value: number;
  label: string;
}

/**
 * Trending rep
 */
export interface TrendingRep {
  repId: string;
  repName: string;
  scoreChange: number;
  rankChange: number;
  trend: 'up' | 'down' | 'stable';
  description: string;
}

/**
 * Coaching priority
 */
export interface CoachingPriority {
  category: CoachingCategory;
  priority: 'critical' | 'high' | 'medium' | 'low';
  
  // Affected reps
  repsAffected: number;
  avgGap: number; // vs team avg
  
  // Impact
  potentialImpact: string;
  estimatedROI: 'high' | 'medium' | 'low';
  
  // Recommendation
  recommendation: string;
  suggestedActions: string[];
  resources: string[];
}

/**
 * Best practice
 */
export interface BestPractice {
  id: string;
  title: string;
  description: string;
  
  // Source
  sourceRepId: string;
  sourceRepName: string;
  
  // Evidence
  successMetric: string;
  successValue: number;
  vsTeamAvg: number;
  
  // Application
  applicableTo: CoachingCategory[];
  difficulty: 'easy' | 'medium' | 'hard';
  expectedImpact: 'high' | 'medium' | 'low';
  
  // How to implement
  implementation: string;
  examples: string[];
}

// ============================================================================
// COMPARISON TYPES
// ============================================================================

/**
 * Rep comparison
 */
export interface RepComparison {
  rep1: RepPerformanceMetrics;
  rep2: RepPerformanceMetrics;
  
  // Differences
  scoreDifferences: Record<string, number>;
  strengthComparison: ComparisonInsight[];
  weaknessComparison: ComparisonInsight[];
  
  // Recommendations
  learningOpportunities: LearningOpportunity[];
}

/**
 * Comparison insight
 */
export interface ComparisonInsight {
  metric: string;
  rep1Value: number;
  rep2Value: number;
  difference: number;
  significance: 'major' | 'moderate' | 'minor';
  insight: string;
}

/**
 * Learning opportunity
 */
export interface LearningOpportunity {
  fromRep: string;
  toRep: string;
  skill: string;
  potential: string;
}

// ============================================================================
// METRIC DETAILS
// ============================================================================

/**
 * Detailed metric breakdown
 */
export interface MetricBreakdown {
  metric: string;
  teamAvg: number;
  teamMedian: number;
  teamMin: number;
  teamMax: number;
  standardDeviation: number;
  
  // Distribution
  distribution: MetricDistribution[];
  
  // By tier
  byTier: Record<PerformanceTier, number>;
  
  // Correlation
  correlations: MetricCorrelation[];
}

/**
 * Metric distribution
 */
export interface MetricDistribution {
  range: string; // e.g., "0-20"
  count: number;
  percentage: number;
}

/**
 * Metric correlation
 */
export interface MetricCorrelation {
  metric: string;
  correlation: number; // -1 to 1
  strength: 'strong' | 'moderate' | 'weak' | 'none';
  insight: string;
}

// ============================================================================
// LEADERBOARD
// ============================================================================

/**
 * Performance leaderboard
 */
export interface PerformanceLeaderboard {
  // Period
  startDate: Date;
  endDate: Date;
  periodType: PeriodType;
  
  // Rankings
  overall: LeaderboardEntry[];
  byCategory: Record<string, LeaderboardEntry[]>;
  
  // Changes from previous period
  movers: LeaderboardMover[];
  
  // Metadata
  generatedAt: Date;
  totalReps: number;
}

/**
 * Leaderboard entry
 */
export interface LeaderboardEntry {
  rank: number;
  repId: string;
  repName: string;
  score: number;
  badge?: LeaderboardBadge;
  change: number; // rank change from previous period
}

/**
 * Leaderboard badge
 */
export type LeaderboardBadge = 
  | 'top_performer'
  | 'most_improved'
  | 'consistency_award'
  | 'coaching_master'
  | 'objection_handler'
  | 'discovery_expert'
  | 'closer';

/**
 * Leaderboard mover
 */
export interface LeaderboardMover {
  repId: string;
  repName: string;
  direction: 'up' | 'down';
  rankChange: number;
  scoreChange: number;
  reason: string;
}

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * Request for team performance analytics
 */
export interface PerformanceAnalyticsRequest {
  // Time period
  startDate?: Date | string;
  endDate?: Date | string;
  periodType?: PeriodType;
  
  // Filters
  repIds?: string[];
  minConversations?: number;
  
  // Options
  includeComparisons?: boolean;
  includeTrends?: boolean;
  includeLeaderboard?: boolean;
  
  // Force refresh
  forceRefresh?: boolean;
}

/**
 * Request for rep comparison
 */
export interface RepComparisonRequest {
  rep1Id: string;
  rep2Id: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

/**
 * Request for leaderboard
 */
export interface LeaderboardRequest {
  startDate?: Date | string;
  endDate?: Date | string;
  periodType?: PeriodType;
  category?: string; // 'overall' or specific metric
  limit?: number;
}

/**
 * Request for metric breakdown
 */
export interface MetricBreakdownRequest {
  metric: string;
  startDate?: Date | string;
  endDate?: Date | string;
}

// ============================================================================
// ENGINE CONFIGURATION
// ============================================================================

/**
 * Performance analytics engine configuration
 */
export interface PerformanceAnalyticsConfig {
  // Thresholds
  minConversationsForAnalysis: number;
  topPerformerPercentile: number; // e.g., 80 = top 20%
  needsImprovementPercentile: number; // e.g., 20 = bottom 20%
  
  // Analysis settings
  includeTrendAnalysis: boolean;
  trendDataPoints: number;
  
  // Benchmarking
  enableBenchmarking: boolean;
  compareToTopPerformers: boolean;
  
  // Coaching
  maxCoachingPriorities: number;
  maxBestPractices: number;
  
  // Performance
  cacheTTL: number; // seconds
  enableCaching: boolean;
}

/**
 * Default configuration
 */
export const DEFAULT_PERFORMANCE_CONFIG: PerformanceAnalyticsConfig = {
  minConversationsForAnalysis: 3,
  topPerformerPercentile: 80, // Top 20%
  needsImprovementPercentile: 20, // Bottom 20%
  
  includeTrendAnalysis: true,
  trendDataPoints: 7, // 7 data points for trend
  
  enableBenchmarking: true,
  compareToTopPerformers: true,
  
  maxCoachingPriorities: 5,
  maxBestPractices: 5,
  
  cacheTTL: 3600, // 1 hour
  enableCaching: true,
};

// ============================================================================
// FIRESTORE SCHEMA
// ============================================================================

/**
 * Firestore performance analytics document
 */
export interface PerformanceAnalyticsDocument {
  startDate: Timestamp;
  endDate: Timestamp;
  periodType: PeriodType;
  teamMetrics: TeamMetrics;
  individualMetrics: RepPerformanceMetrics[];
  benchmarks: PerformanceBenchmarks;
  topPerformers: TopPerformer[];
  improvementOpportunities: ImprovementOpportunity[];
  trendAnalysis: TrendAnalysis;
  coachingPriorities: CoachingPriority[];
  bestPractices: BestPractice[];
  generatedAt: Timestamp;
  conversationsAnalyzed: number;
  repsIncluded: number;
}

/**
 * Firestore leaderboard document
 */
export interface LeaderboardDocument {
  startDate: Timestamp;
  endDate: Timestamp;
  periodType: PeriodType;
  overall: LeaderboardEntry[];
  byCategory: Record<string, LeaderboardEntry[]>;
  movers: LeaderboardMover[];
  generatedAt: Timestamp;
  totalReps: number;
}
