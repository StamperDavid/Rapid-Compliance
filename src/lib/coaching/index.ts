/**
 * Sales Coaching & Insights Module
 * 
 * SOVEREIGN CORPORATE BRAIN - COACHING MODULE
 * 
 * Public exports for the sales coaching and insights system.
 * 
 * MAIN COMPONENTS:
 * - CoachingAnalyticsEngine: Performance analysis and metrics calculation
 * - CoachingGenerator: AI-powered insights and recommendations
 * - Types: Complete TypeScript type system
 * - Validation: Zod schemas for all types
 * - Events: Signal Bus event definitions and builders
 * 
 * USAGE:
 * ```typescript
 * import { CoachingAnalyticsEngine, CoachingGenerator } from '@/lib/coaching';
 * 
 * const engine = new CoachingAnalyticsEngine(adminDal);
 * const generator = new CoachingGenerator();
 * 
 * const performance = await engine.analyzeRepPerformance(repId, 'last_30_days');
 * const insights = await generator.generateCoachingInsights(performance);
 * ```
 */

// Core engines
export { CoachingAnalyticsEngine } from './coaching-analytics-engine';
export { CoachingGenerator } from './coaching-generator';

// Types
export type {
  // Performance metrics
  RepPerformanceMetrics,
  DealPerformanceMetrics,
  CommunicationMetrics,
  ActivityMetrics,
  ConversionMetrics,
  RevenueMetrics,
  EfficiencyMetrics,
  SkillScores,
  PerformanceComparison,
  PerformanceTier,
  
  // Coaching insights
  CoachingInsights,
  PerformanceSummary,
  Strength,
  Weakness,
  Opportunity,
  Risk,
  BestPractice,
  CoachingRecommendation,
  TrainingSuggestion,
  ActionItem,
  
  // Team insights
  TeamCoachingInsights,
  TeamPerformanceSummary,
  
  // Categories
  SkillCategory,
  RiskCategory,
  
  // Time periods
  TimePeriod,
  CustomDateRange,
  
  // API types
  GenerateCoachingRequest,
  GenerateCoachingResponse,
  GenerateTeamCoachingRequest,
  GenerateTeamCoachingResponse
} from './types';

// Validation
export {
  // Schemas
  GenerateCoachingRequestSchema,
  GenerateCoachingResponseSchema,
  GenerateTeamCoachingRequestSchema,
  GenerateTeamCoachingResponseSchema,
  RepPerformanceMetricsSchema,
  CoachingInsightsSchema,
  TeamCoachingInsightsSchema,
  
  // Validation helpers
  validateGenerateCoachingRequest,
  validateGenerateTeamCoachingRequest,
  safeValidateGenerateCoachingRequest,
  safeValidateGenerateTeamCoachingRequest
} from './validation';

// Events
export type {
  CoachingEvent,
  CoachingInsightsGeneratedEvent,
  CoachingInsightsViewedEvent,
  TeamInsightsGeneratedEvent,
  RecommendationAcceptedEvent,
  RecommendationDismissedEvent,
  ActionItemCompletedEvent,
  TrainingStartedEvent,
  TrainingCompletedEvent
} from './events';

export {
  createCoachingInsightsGeneratedEvent,
  createCoachingInsightsViewedEvent,
  createTeamInsightsGeneratedEvent,
  createRecommendationAcceptedEvent,
  createRecommendationDismissedEvent,
  createActionItemCompletedEvent,
  createTrainingStartedEvent,
  createTrainingCompletedEvent
} from './events';
