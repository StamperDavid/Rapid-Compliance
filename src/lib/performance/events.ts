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
import type {
  PerformanceTier,
  CoachingCategory,
} from './types';

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
  organizationId: string,
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
    id: `perf-analyzed-${Date.now()}`,
    type: 'performance.analyzed',
    organizationId,
    workspaceId,
    priority: 'medium',
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
  } as Omit<PerformanceAnalyzedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create top performer identified event
 */
export function createTopPerformerIdentifiedEvent(
  organizationId: string,
  workspaceId: string,
  repId: string,
  rank: number,
  overallScore: number,
  topStrengths: string[],
  percentileRank = 100,
  recommendedAsMentor = false
): Omit<TopPerformerIdentifiedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    id: `top-performer-${repId}-${Date.now()}`,
    type: 'performance.top_performer_identified',
    organizationId,
    workspaceId,
    priority: 'high',
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
  } as Omit<TopPerformerIdentifiedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create improvement opportunity detected event
 */
export function createImprovementOpportunityDetectedEvent(
  organizationId: string,
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
    id: `improvement-${repId}-${Date.now()}`,
    type: 'performance.improvement_opportunity',
    organizationId,
    workspaceId,
    priority: hasCriticalGap ? 'high' : 'medium',
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
  } as Omit<ImprovementOpportunityDetectedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create coaching priority created event
 */
export function createCoachingPriorityCreatedEvent(
  organizationId: string,
  workspaceId: string,
  category: CoachingCategory,
  priority: 'critical' | 'high' | 'medium' | 'low',
  repsAffected: number,
  recommendation: string,
  avgGap = 10
): Omit<CoachingPriorityCreatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    id: `coaching-priority-${category}-${Date.now()}`,
    type: 'performance.coaching_priority_created',
    organizationId,
    workspaceId,
    priority: priority === 'critical' ? 'high' : 'medium',
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
  } as Omit<CoachingPriorityCreatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create best practice extracted event
 */
export function createBestPracticeExtractedEvent(
  organizationId: string,
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
    id: `best-practice-${practiceId}`,
    type: 'performance.best_practice_extracted',
    organizationId,
    workspaceId,
    priority: 'medium',
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
  } as Omit<BestPracticeExtractedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create trend detected event
 */
export function createTrendDetectedEvent(
  organizationId: string,
  workspaceId: string,
  trendType: 'overall_score' | 'sentiment' | 'quality',
  direction: 'improving' | 'declining' | 'stable',
  changePercentage: number,
  significance: 'major' | 'moderate' | 'minor',
  affectedReps: number
): Omit<TrendDetectedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const isNegative = direction === 'declining' && (significance === 'major' || significance === 'moderate');
  
  return {
    id: `trend-${trendType}-${Date.now()}`,
    type: 'performance.trend_detected',
    organizationId,
    workspaceId,
    priority: isNegative ? 'high' : 'medium',
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
  } as Omit<TrendDetectedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create leaderboard updated event
 */
export function createLeaderboardUpdatedEvent(
  organizationId: string,
  workspaceId: string,
  category: string,
  topReps: Array<{ repId: string; rank: number; score: number }>,
  moversCount: number,
  totalReps: number
): Omit<LeaderboardUpdatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    id: `leaderboard-${category}-${Date.now()}`,
    type: 'performance.leaderboard_updated',
    organizationId,
    workspaceId,
    priority: 'low',
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
  } as Omit<LeaderboardUpdatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create benchmark changed event
 */
export function createBenchmarkChangedEvent(
  organizationId: string,
  workspaceId: string,
  benchmarkType: string,
  previousValue: number,
  newValue: number
): Omit<BenchmarkChangedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const changePercentage = previousValue > 0 ? ((newValue - previousValue) / previousValue) * 100 : 0;
  const direction = newValue > previousValue ? 'up' : 'down';
  
  return {
    id: `benchmark-${benchmarkType}-${Date.now()}`,
    type: 'performance.benchmark_changed',
    organizationId,
    workspaceId,
    priority: 'low',
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
  } as Omit<BenchmarkChangedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create performance alert triggered event
 */
export function createPerformanceAlertTriggeredEvent(
  organizationId: string,
  workspaceId: string,
  alertType: 'critical_gap' | 'declining_trend' | 'low_performance' | 'high_achievement',
  severity: 'critical' | 'high' | 'medium' | 'low',
  message: string,
  actionRequired: boolean,
  repId?: string
): Omit<PerformanceAlertTriggeredEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    id: `alert-${alertType}-${Date.now()}`,
    type: 'performance.alert_triggered',
    organizationId,
    workspaceId,
    priority: severity === 'critical' || severity === 'high' ? 'high' : 'medium',
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
  } as Omit<PerformanceAlertTriggeredEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}
