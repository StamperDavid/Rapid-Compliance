/**
 * Performance Analytics - Signal Bus Events
 * 
 * Events for team performance analytics tracking and orchestration.
 * Integrates with the Signal Bus for workflow automation and notifications.
 * 
 * EVENT TYPES:
 * - performance.analyzed - Team performance analysis completed
 * - performance.top_performer_identified - Top performer identified
 * - performance.improvement_opportunity - Improvement opportunity detected
 * - performance.coaching_priority_created - Coaching priority identified
 * - performance.best_practice_extracted - Best practice extracted from top performer
 * - performance.trend_detected - Performance trend detected
 * - performance.leaderboard_updated - Leaderboard updated
 * - performance.benchmark_changed - Performance benchmark changed
 * - performance.alert_triggered - Performance alert triggered
 * 
 * @module lib/performance
 */

import type { SalesSignal } from '@/lib/orchestration';
import type { CoachingCategory } from '@/lib/conversation/types';
import type { PerformanceTier } from './types';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// ============================================================================
// EVENT INTERFACES
// ============================================================================

/**
 * Performance analyzed event
 */
export interface PerformanceAnalyzedEvent extends SalesSignal {
  type: 'performance.analyzed';
  payload: {
    repsAnalyzed: number;
    conversationsAnalyzed: number;
    avgTeamScore: number;
    startDate: Date;
    endDate: Date;
    topPerformersCount: number;
    improvementOpportunitiesCount: number;
    coachingPrioritiesCount: number;
  };
}

/**
 * Top performer identified event
 */
export interface TopPerformerIdentifiedEvent extends SalesSignal {
  type: 'performance.top_performer_identified';
  payload: {
    repId: string;
    rank: number;
    overallScore: number;
    percentileRank: number;
    topStrengths: string[];
    recommendedAsMentor: boolean;
  };
}

/**
 * Improvement opportunity detected event
 */
export interface ImprovementOpportunityDetectedEvent extends SalesSignal {
  type: 'performance.improvement_opportunity';
  payload: {
    repId: string;
    currentScore: number;
    currentTier: PerformanceTier;
    topGaps: Array<{
      skill: string;
      gapSize: number;
      priority: 'critical' | 'high' | 'medium' | 'low';
    }>;
    targetScore: number;
    potentialImpact: 'high' | 'medium' | 'low';
  };
}

/**
 * Coaching priority created event
 */
export interface CoachingPriorityCreatedEvent extends SalesSignal {
  type: 'performance.coaching_priority_created';
  payload: {
    category: CoachingCategory;
    priority: 'critical' | 'high' | 'medium' | 'low';
    repsAffected: number;
    avgGap: number;
    recommendation: string;
  };
}

/**
 * Best practice extracted event
 */
export interface BestPracticeExtractedEvent extends SalesSignal {
  type: 'performance.best_practice_extracted';
  payload: {
    practiceId: string;
    title: string;
    sourceRepId: string;
    category: CoachingCategory;
    successMetric: string;
    successValue: number;
    vsTeamAvg: number;
  };
}

/**
 * Trend detected event
 */
export interface TrendDetectedEvent extends SalesSignal {
  type: 'performance.trend_detected';
  payload: {
    trendType: 'overall_score' | 'sentiment' | 'quality';
    direction: 'improving' | 'declining' | 'stable';
    changePercentage: number;
    significance: 'major' | 'moderate' | 'minor';
    affectedReps: number;
  };
}

/**
 * Leaderboard updated event
 */
export interface LeaderboardUpdatedEvent extends SalesSignal {
  type: 'performance.leaderboard_updated';
  payload: {
    category: string;
    topReps: Array<{
      repId: string;
      rank: number;
      score: number;
    }>;
    moversCount: number;
    totalReps: number;
  };
}

/**
 * Benchmark changed event
 */
export interface BenchmarkChangedEvent extends SalesSignal {
  type: 'performance.benchmark_changed';
  payload: {
    benchmarkType: string;
    previousValue: number;
    newValue: number;
    changePercentage: number;
    direction: 'up' | 'down';
  };
}

/**
 * Performance alert triggered event
 */
export interface PerformanceAlertTriggeredEvent extends SalesSignal {
  type: 'performance.alert_triggered';
  payload: {
    alertType: 'critical_gap' | 'declining_trend' | 'low_performance' | 'high_achievement';
    severity: 'critical' | 'high' | 'medium' | 'low';
    repId?: string;
    message: string;
    actionRequired: boolean;
  };
}

// ============================================================================
// EVENT CREATORS
// ============================================================================

/**
 * Create performance analyzed event
 */
export function createPerformanceAnalyzedEvent(
  workspaceId: string,
  repsAnalyzed: number,
  conversationsAnalyzed: number,
  avgTeamScore: number,
  startDate: Date,
  endDate: Date,
  topPerformersCount = 0,
  improvementOpportunitiesCount = 0,
  coachingPrioritiesCount = 0
): Omit<PerformanceAnalyzedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'performance.analyzed' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 0.95,
    priority: 'Medium',
    payload: {
      repsAnalyzed,
      conversationsAnalyzed,
      avgTeamScore,
      startDate,
      endDate,
      topPerformersCount,
      improvementOpportunitiesCount,
      coachingPrioritiesCount,
    },
    metadata: {
      source: 'performance-analytics',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create top performer identified event
 */
export function createTopPerformerIdentifiedEvent(
  workspaceId: string,
  repId: string,
  rank: number,
  overallScore: number,
  topStrengths: string[],
  percentileRank = 100,
  recommendedAsMentor = false
): Omit<TopPerformerIdentifiedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'performance.top_performer_identified' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 0.9,
    priority: 'High',
    payload: {
      repId,
      rank,
      overallScore,
      percentileRank,
      topStrengths,
      recommendedAsMentor,
    },
    metadata: {
      source: 'performance-analytics',
      repId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create improvement opportunity detected event
 */
export function createImprovementOpportunityDetectedEvent(
  workspaceId: string,
  repId: string,
  currentScore: number,
  currentTier: PerformanceTier,
  topGaps: Array<{ skill: string; gapSize: number; priority: 'critical' | 'high' | 'medium' | 'low' }>,
  targetScore: number,
  potentialImpact: 'high' | 'medium' | 'low'
): Omit<ImprovementOpportunityDetectedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const hasCriticalGap = topGaps.some(g => g.priority === 'critical');

  return {
    type: 'performance.improvement_opportunity' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 0.85,
    priority: hasCriticalGap ? 'High' : 'Medium',
    payload: {
      repId,
      currentScore,
      currentTier,
      topGaps: topGaps.slice(0, 3),
      targetScore,
      potentialImpact,
    },
    metadata: {
      source: 'performance-analytics',
      repId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create coaching priority created event
 */
export function createCoachingPriorityCreatedEvent(
  workspaceId: string,
  category: CoachingCategory,
  priority: 'critical' | 'high' | 'medium' | 'low',
  repsAffected: number,
  recommendation: string,
  avgGap = 10
): Omit<CoachingPriorityCreatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'performance.coaching_priority_created' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 0.9,
    priority: priority === 'critical' ? 'High' : 'Medium',
    payload: {
      category,
      priority,
      repsAffected,
      avgGap,
      recommendation,
    },
    metadata: {
      source: 'performance-analytics',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create best practice extracted event
 */
export function createBestPracticeExtractedEvent(
  workspaceId: string,
  practiceId: string,
  title: string,
  sourceRepId: string,
  category: CoachingCategory,
  successMetric: string,
  successValue: number,
  vsTeamAvg: number
): Omit<BestPracticeExtractedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'performance.best_practice_extracted' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 0.85,
    priority: 'Medium',
    payload: {
      practiceId,
      title,
      sourceRepId,
      category,
      successMetric,
      successValue,
      vsTeamAvg,
    },
    metadata: {
      source: 'performance-analytics',
      repId: sourceRepId,
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create trend detected event
 */
export function createTrendDetectedEvent(
  workspaceId: string,
  trendType: 'overall_score' | 'sentiment' | 'quality',
  direction: 'improving' | 'declining' | 'stable',
  changePercentage: number,
  significance: 'major' | 'moderate' | 'minor',
  affectedReps: number
): Omit<TrendDetectedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const isNegative = direction === 'declining' && (significance === 'major' || significance === 'moderate');

  return {
    type: 'performance.trend_detected' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 0.8,
    priority: isNegative ? 'High' : 'Medium',
    payload: {
      trendType,
      direction,
      changePercentage,
      significance,
      affectedReps,
    },
    metadata: {
      source: 'performance-analytics',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create leaderboard updated event
 */
export function createLeaderboardUpdatedEvent(
  workspaceId: string,
  category: string,
  topReps: Array<{ repId: string; rank: number; score: number }>,
  moversCount: number,
  totalReps: number
): Omit<LeaderboardUpdatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'performance.leaderboard_updated' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 1.0,
    priority: 'Low',
    payload: {
      category,
      topReps: topReps.slice(0, 5),
      moversCount,
      totalReps,
    },
    metadata: {
      source: 'performance-analytics',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create benchmark changed event
 */
export function createBenchmarkChangedEvent(
  workspaceId: string,
  benchmarkType: string,
  previousValue: number,
  newValue: number
): Omit<BenchmarkChangedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const changePercentage = previousValue > 0 ? ((newValue - previousValue) / previousValue) * 100 : 0;
  const direction = newValue > previousValue ? 'up' : 'down';

  return {
    type: 'performance.benchmark_changed' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 1.0,
    priority: 'Low',
    payload: {
      benchmarkType,
      previousValue,
      newValue,
      changePercentage,
      direction,
    },
    metadata: {
      source: 'performance-analytics',
      timestamp: new Date().toISOString(),
    },
  };
}

/**
 * Create performance alert triggered event
 */
export function createPerformanceAlertTriggeredEvent(
  workspaceId: string,
  alertType: 'critical_gap' | 'declining_trend' | 'low_performance' | 'high_achievement',
  severity: 'critical' | 'high' | 'medium' | 'low',
  message: string,
  actionRequired: boolean,
  repId?: string
): Omit<PerformanceAlertTriggeredEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'performance.alert_triggered' as const,
    orgId: DEFAULT_ORG_ID,
    workspaceId,
    confidence: 0.9,
    priority: severity === 'critical' || severity === 'high' ? 'High' : 'Medium',
    payload: {
      alertType,
      severity,
      repId,
      message,
      actionRequired,
    },
    metadata: {
      source: 'performance-analytics',
      repId,
      timestamp: new Date().toISOString(),
    },
  };
}
