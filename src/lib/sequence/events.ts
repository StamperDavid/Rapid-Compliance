/**
 * Email Sequence Intelligence - Signal Bus Events
 * 
 * Event definitions for email sequence intelligence integration with
 * the platform's Signal Bus orchestration system.
 * 
 * @module sequence/events
 */

import { SalesSignal } from '@/lib/orchestration';
import { 
  SequenceAnalysis,
  SequencePattern,
  OptimizationRecommendation,
  SequenceMetrics,
  ABTest,
} from './types';

// ============================================================================
// EVENT TYPE DEFINITIONS
// ============================================================================

/**
 * Sequence analysis completed
 */
export type SequenceAnalyzedEvent = SalesSignal & {
  type: 'sequence.analyzed';
  payload: {
    analysisId: string;
    sequenceIds: string[];
    totalSequences: number;
    avgReplyRate: number;
    avgMeetingRate: number;
    patternsFound: number;
    optimizationsCount: number;
  };
};

/**
 * High-performing pattern detected
 */
export type PatternDetectedEvent = SalesSignal & {
  type: 'sequence.pattern_detected';
  payload: {
    patternId: string;
    patternType: string;
    patternName: string;
    replyLift: number;
    meetingLift: number;
    confidence: string;
    affectedSequences: number;
  };
};

/**
 * Low-performing sequence identified
 */
export type UnderperformingSequenceEvent = SalesSignal & {
  type: 'sequence.underperforming';
  payload: {
    sequenceId: string;
    sequenceName: string;
    replyRate: number;
    benchmarkReplyRate: number;
    gap: number;
    urgency: 'low' | 'medium' | 'high' | 'critical';
  };
};

/**
 * Critical optimization needed
 */
export type OptimizationNeededEvent = SalesSignal & {
  type: 'sequence.optimization_needed';
  payload: {
    recommendationId: string;
    sequenceId: string;
    area: string;
    priority: string;
    expectedLift: number;
    estimatedEffort: string;
    estimatedImpact: string;
  };
};

/**
 * Optimal send time discovered
 */
export type OptimalTimingFoundEvent = SalesSignal & {
  type: 'sequence.optimal_timing_found';
  payload: {
    sequenceId: string;
    bestHours: number[];
    bestDays: string[];
    improvementPotential: number;
    currentTimingScore: number;
  };
};

/**
 * A/B test completed
 */
export type ABTestCompletedEvent = SalesSignal & {
  type: 'sequence.ab_test_completed';
  payload: {
    testId: string;
    testName: string;
    winningVariant: 'A' | 'B';
    lift: number;
    metric: string;
    statisticalSignificance: number;
  };
};

/**
 * Sequence performance declined
 */
export type PerformanceDeclineEvent = SalesSignal & {
  type: 'sequence.performance_decline';
  payload: {
    sequenceId: string;
    sequenceName: string;
    metric: string;
    previousValue: number;
    currentValue: number;
    percentageChange: number;
    timeframe: string;
  };
};

/**
 * Best practice identified
 */
export type BestPracticeFoundEvent = SalesSignal & {
  type: 'sequence.best_practice_found';
  payload: {
    practice: string;
    category: string;
    impact: string;
    adoption: number;
    sequences: string[];
  };
};

/**
 * Sequence metrics updated
 */
export type SequenceMetricsUpdatedEvent = SalesSignal & {
  type: 'sequence.metrics_updated';
  payload: {
    sequenceId: string;
    totalRecipients: number;
    replyRate: number;
    meetingRate: number;
    opportunityRate: number;
    period: string;
  };
};

// ============================================================================
// EVENT UNION TYPE
// ============================================================================

export type SequenceEvent =
  | SequenceAnalyzedEvent
  | PatternDetectedEvent
  | UnderperformingSequenceEvent
  | OptimizationNeededEvent
  | OptimalTimingFoundEvent
  | ABTestCompletedEvent
  | PerformanceDeclineEvent
  | BestPracticeFoundEvent
  | SequenceMetricsUpdatedEvent;

// ============================================================================
// EVENT CREATORS
// ============================================================================

/**
 * Create sequence analyzed event
 */
export function createSequenceAnalyzedEvent(
  analysis: SequenceAnalysis,
  orgId: string = 'default'
): Omit<SequenceAnalyzedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'sequence.analyzed',
    orgId,
    confidence: 0.9,
    priority: 'Low' as const,
    payload: {
      analysisId: analysis.analysisId,
      sequenceIds: analysis.sequences.map(s => s.id),
      totalSequences: analysis.summary.totalSequences,
      avgReplyRate: analysis.summary.avgReplyRate,
      avgMeetingRate: analysis.summary.avgMeetingRate,
      patternsFound: analysis.patterns?.total || 0,
      optimizationsCount: analysis.optimizations?.total || 0,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      sequenceCount: analysis.sequences.length,
      source: 'sequence-engine',
    },
  } as Omit<SequenceAnalyzedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create pattern detected event
 */
export function createPatternDetectedEvent(
  pattern: SequencePattern,
  affectedSequences: number,
  orgId: string = 'default'
): Omit<PatternDetectedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const confidenceMap = { high: 0.9, medium: 0.75, low: 0.6 };
  return {
    type: 'sequence.pattern_detected',
    orgId,
    confidence: confidenceMap[pattern.confidence],
    priority: pattern.confidence === 'high' ? 'High' as const : 'Medium' as const,
    payload: {
      patternId: pattern.id,
      patternType: pattern.type,
      patternName: pattern.name,
      replyLift: pattern.replyLift,
      meetingLift: pattern.meetingLift,
      confidence: pattern.confidence,
      affectedSequences,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      patternType: pattern.type,
      sampleSize: pattern.sampleSize,
      source: 'sequence-engine',
    },
  } as Omit<PatternDetectedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create underperforming sequence event
 */
export function createUnderperformingSequenceEvent(
  sequenceMetrics: SequenceMetrics,
  benchmarkReplyRate: number,
  orgId: string = 'default'
): Omit<UnderperformingSequenceEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const gap = benchmarkReplyRate - sequenceMetrics.overallReplyRate;
  const urgency: 'low' | 'medium' | 'high' | 'critical' = 
    gap > 50 ? 'critical' :
    gap > 30 ? 'high' :
    gap > 15 ? 'medium' : 'low';
  
  return {
    type: 'sequence.underperforming',
    orgId,
    confidence: 0.85,
    priority: urgency === 'critical' || urgency === 'high' ? 'High' as const : 'Medium' as const,
    payload: {
      sequenceId: sequenceMetrics.sequenceId,
      sequenceName: sequenceMetrics.sequenceName,
      replyRate: sequenceMetrics.overallReplyRate,
      benchmarkReplyRate,
      gap,
      urgency,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      recipients: sequenceMetrics.totalRecipients,
      source: 'sequence-engine',
    },
  } as Omit<UnderperformingSequenceEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create optimization needed event
 */
export function createOptimizationNeededEvent(
  recommendation: OptimizationRecommendation,
  sequenceId: string,
  orgId: string = 'default'
): Omit<OptimizationNeededEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const confidenceMap = { high: 0.9, medium: 0.75, low: 0.6 };
  return {
    type: 'sequence.optimization_needed',
    orgId,
    confidence: confidenceMap[recommendation.confidence],
    priority: recommendation.priority === 'critical' ? 'High' as const :
             recommendation.priority === 'high' ? 'High' as const : 'Medium' as const,
    payload: {
      recommendationId: recommendation.id,
      sequenceId,
      area: recommendation.area,
      priority: recommendation.priority,
      expectedLift: recommendation.expectedLift,
      estimatedEffort: recommendation.estimatedEffort,
      estimatedImpact: recommendation.estimatedImpact,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      optimizationArea: recommendation.area,
      source: 'sequence-engine',
    },
  } as Omit<OptimizationNeededEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create optimal timing found event
 */
export function createOptimalTimingFoundEvent(
  sequenceId: string,
  bestHours: number[],
  bestDays: string[],
  improvementPotential: number,
  currentTimingScore: number,
  orgId: string = 'default'
): Omit<OptimalTimingFoundEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'sequence.optimal_timing_found',
    orgId,
    confidence: 0.85,
    priority: improvementPotential > 20 ? 'High' as const : 'Medium' as const,
    payload: {
      sequenceId,
      bestHours,
      bestDays,
      improvementPotential,
      currentTimingScore,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      source: 'sequence-engine',
    },
  } as Omit<OptimalTimingFoundEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create A/B test completed event
 */
export function createABTestCompletedEvent(
  test: ABTest,
  orgId: string = 'default'
): Omit<ABTestCompletedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  if (!test.winningVariant || test.lift === undefined) {
    throw new Error('Cannot create event for incomplete A/B test');
  }
  
  return {
    type: 'sequence.ab_test_completed',
    orgId,
    confidence: (test.statisticalSignificance || 0) / 100,
    priority: test.lift > 20 ? 'High' as const : 'Medium' as const,
    payload: {
      testId: test.id,
      testName: test.name,
      winningVariant: test.winningVariant,
      lift: test.lift,
      metric: test.successMetric,
      statisticalSignificance: test.statisticalSignificance || 0,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      testDuration: test.minimumDuration,
      source: 'sequence-engine',
    },
  } as Omit<ABTestCompletedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create performance decline event
 */
export function createPerformanceDeclineEvent(
  sequenceId: string,
  sequenceName: string,
  metric: string,
  previousValue: number,
  currentValue: number,
  timeframe: string,
  orgId: string = 'default'
): Omit<PerformanceDeclineEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  const percentageChange = ((currentValue - previousValue) / previousValue) * 100;
  
  return {
    type: 'sequence.performance_decline',
    orgId,
    confidence: 0.8,
    priority: percentageChange < -30 ? 'High' as const : 'Medium' as const,
    payload: {
      sequenceId,
      sequenceName,
      metric,
      previousValue,
      currentValue,
      percentageChange,
      timeframe,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      declinePercentage: Math.abs(percentageChange),
      source: 'sequence-engine',
    },
  } as Omit<PerformanceDeclineEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create best practice found event
 */
export function createBestPracticeFoundEvent(
  practice: string,
  category: string,
  impact: string,
  adoption: number,
  sequences: string[],
  orgId: string = 'default'
): Omit<BestPracticeFoundEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'sequence.best_practice_found',
    orgId,
    confidence: 0.85,
    priority: impact === 'high' ? 'High' as const : 'Medium' as const,
    payload: {
      practice,
      category,
      impact,
      adoption,
      sequences,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      sequenceCount: sequences.length,
      source: 'sequence-engine',
    },
  } as Omit<BestPracticeFoundEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

/**
 * Create sequence metrics updated event
 */
export function createSequenceMetricsUpdatedEvent(
  sequenceMetrics: SequenceMetrics,
  period: string,
  orgId: string = 'default'
): Omit<SequenceMetricsUpdatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'sequence.metrics_updated',
    orgId,
    confidence: 0.95,
    priority: 'Low' as const,
    payload: {
      sequenceId: sequenceMetrics.sequenceId,
      totalRecipients: sequenceMetrics.totalRecipients,
      replyRate: sequenceMetrics.overallReplyRate,
      meetingRate: sequenceMetrics.meetingRate,
      opportunityRate: sequenceMetrics.opportunityRate,
      period,
    },
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0',
      dataPoints: sequenceMetrics.dataPoints,
      source: 'sequence-engine',
    },
  } as Omit<SequenceMetricsUpdatedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>;
}

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Check if event is a sequence analyzed event
 */
export function isSequenceAnalyzedEvent(
  signal: SalesSignal
): signal is SalesSignal & SequenceAnalyzedEvent {
  return signal.type === 'sequence.analyzed';
}

/**
 * Check if event is a pattern detected event
 */
export function isPatternDetectedEvent(
  signal: SalesSignal
): signal is SalesSignal & PatternDetectedEvent {
  return signal.type === 'sequence.pattern_detected';
}

/**
 * Check if event is an underperforming sequence event
 */
export function isUnderperformingSequenceEvent(
  signal: SalesSignal
): signal is SalesSignal & UnderperformingSequenceEvent {
  return signal.type === 'sequence.underperforming';
}

/**
 * Check if event is an optimization needed event
 */
export function isOptimizationNeededEvent(
  signal: SalesSignal
): signal is SalesSignal & OptimizationNeededEvent {
  return signal.type === 'sequence.optimization_needed';
}

/**
 * Check if event is an optimal timing found event
 */
export function isOptimalTimingFoundEvent(
  signal: SalesSignal
): signal is SalesSignal & OptimalTimingFoundEvent {
  return signal.type === 'sequence.optimal_timing_found';
}

/**
 * Check if event is an A/B test completed event
 */
export function isABTestCompletedEvent(
  signal: SalesSignal
): signal is SalesSignal & ABTestCompletedEvent {
  return signal.type === 'sequence.ab_test_completed';
}

/**
 * Check if event is a performance decline event
 */
export function isPerformanceDeclineEvent(
  signal: SalesSignal
): signal is SalesSignal & PerformanceDeclineEvent {
  return signal.type === 'sequence.performance_decline';
}

/**
 * Check if event is a best practice found event
 */
export function isBestPracticeFoundEvent(
  signal: SalesSignal
): signal is SalesSignal & BestPracticeFoundEvent {
  return signal.type === 'sequence.best_practice_found';
}

/**
 * Check if event is a sequence metrics updated event
 */
export function isSequenceMetricsUpdatedEvent(
  signal: SalesSignal
): signal is SalesSignal & SequenceMetricsUpdatedEvent {
  return signal.type === 'sequence.metrics_updated';
}

// ============================================================================
// EXPORTS
// ============================================================================

export type {
  SequenceAnalyzedEvent,
  PatternDetectedEvent,
  UnderperformingSequenceEvent,
  OptimizationNeededEvent,
  OptimalTimingFoundEvent,
  ABTestCompletedEvent,
  PerformanceDeclineEvent,
  BestPracticeFoundEvent,
  SequenceMetricsUpdatedEvent,
  SequenceEvent,
};
