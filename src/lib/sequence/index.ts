/**
 * Email Sequence Intelligence - Module Exports
 * 
 * Centralized export point for email sequence intelligence functionality.
 * 
 * @module sequence
 */

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Core types
  EmailSequence,
  SequenceStep,
  SequenceStatus,
  SequenceStepType,
  TimingStrategy,
  
  // Execution
  SequenceExecution,
  EmailExecution,
  ExecutionStatus,
  
  // Metrics
  SequenceMetrics,
  EmailMetrics,
  SubjectLinePerformance,
  LinkPerformance,
  HourOfDay,
  DayOfWeek,
  
  // Patterns
  SequencePattern,
  PatternType,
  PatternConfidence,
  PatternCharacteristic,
  
  // Optimization
  OptimizationRecommendation,
  OptimizationArea,
  RecommendationPriority,
  ActionItem,
  
  // A/B Testing
  ABTest,
  ABTestStatus,
  ABTestResult,
  
  // Analysis
  SequenceAnalysis,
  SequenceAnalysisInput,
  PatternDetectionRequest,
  OptimizationRequest,
  
  // API
  SequenceAnalysisResponse,
  PatternDetectionResponse,
  OptimizationResponse,
} from './types';

// ============================================================================
// VALIDATION EXPORTS
// ============================================================================

export {
  // Core schemas
  sequenceStatusSchema,
  sequenceStepTypeSchema,
  timingStrategySchema,
  sequenceStepSchema,
  emailSequenceSchema,
  
  // Execution schemas
  executionStatusSchema,
  emailExecutionSchema,
  sequenceExecutionSchema,
  
  // Metrics schemas
  subjectLinePerformanceSchema,
  linkPerformanceSchema,
  emailMetricsSchema,
  hourOfDaySchema,
  dayOfWeekSchema,
  sequenceMetricsSchema,
  
  // Pattern schemas
  patternTypeSchema,
  patternConfidenceSchema,
  patternCharacteristicSchema,
  sequencePatternSchema,
  
  // Optimization schemas
  optimizationAreaSchema,
  recommendationPrioritySchema,
  actionItemSchema,
  optimizationRecommendationSchema,
  
  // A/B test schemas
  abTestStatusSchema,
  abTestResultSchema,
  abTestSchema,
  
  // Analysis schemas
  sequenceAnalysisInputSchema,
  sequenceAnalysisSchema,
  patternDetectionRequestSchema,
  optimizationRequestSchema,
  
  // Response schemas
  sequenceAnalysisResponseSchema,
  patternDetectionResponseSchema,
  optimizationResponseSchema,
} from './validation';

// ============================================================================
// ENGINE EXPORTS
// ============================================================================

export { 
  SequenceIntelligenceEngine,
  sequenceEngine,
} from './sequence-engine';

// ============================================================================
// EVENT EXPORTS
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
} from './events';

export {
  createSequenceAnalyzedEvent,
  createPatternDetectedEvent,
  createUnderperformingSequenceEvent,
  createOptimizationNeededEvent,
  createOptimalTimingFoundEvent,
  createABTestCompletedEvent,
  createPerformanceDeclineEvent,
  createBestPracticeFoundEvent,
  createSequenceMetricsUpdatedEvent,
  isSequenceAnalyzedEvent,
  isPatternDetectedEvent,
  isUnderperformingSequenceEvent,
  isOptimizationNeededEvent,
  isOptimalTimingFoundEvent,
  isABTestCompletedEvent,
  isPerformanceDeclineEvent,
  isBestPracticeFoundEvent,
  isSequenceMetricsUpdatedEvent,
} from './events';
