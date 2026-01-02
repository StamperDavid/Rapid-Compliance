/**
 * Playbook Builder - Module Exports
 * 
 * Centralized exports for the playbook builder module.
 * 
 * USAGE:
 * ```typescript
 * import {
 *   generatePlaybook,
 *   extractPatterns,
 *   type Playbook,
 *   type Pattern,
 *   validateGeneratePlaybookRequest,
 * } from '@/lib/playbook';
 * ```
 * 
 * @module lib/playbook
 */

// ============================================================================
// ENGINE EXPORTS
// ============================================================================

export {
  extractPatterns,
  generatePlaybook,
} from './playbook-engine';

// ============================================================================
// TYPE EXPORTS
// ============================================================================

export type {
  // Core types
  Playbook,
  Pattern,
  TalkTrack,
  ObjectionResponse,
  PlaybookBestPractice,
  PlaybookCategory,
  PlaybookStatus,
  DealSizeRange,
  
  // Pattern types
  PatternCategory,
  PatternExample,
  ApplicabilityRule,
  ApplicabilityRuleType,
  
  // Talk track types
  TalkTrackPurpose,
  TalkTrackSection,
  TalkTrackVariation,
  Tonality,
  Pace,
  ABTestResults,
  
  // Objection response types
  ResponseType,
  ResponseStrategy,
  ObjectionResponseExample,
  
  // Best practice types
  BestPracticeEvidence,
  
  // Metrics types
  SuccessMetrics,
  
  // Extraction types
  ExtractPatternsRequest,
  PatternExtractionResult,
  ExtractionSummary,
  PlaybookSuggestion,
  DateRange,
  
  // Playbook usage types
  PlaybookUsage,
  PlaybookDeviation,
  
  // Adoption types
  PlaybookAdoptionMetrics,
  UsageDataPoint,
  EffectivenessDistribution,
  ImpactMetrics,
  AdoptionBarrier,
  BarrierType,
  
  // Request/Response types
  GeneratePlaybookRequest,
  GeneratePlaybookResponse,
  GetAdoptionMetricsRequest,
  TrackPlaybookUsageRequest,
  SearchPlaybooksRequest,
  PlaybookSearchResults,
  
  // Config types
  PlaybookEngineConfig,
} from './types';

export {
  DEFAULT_PLAYBOOK_CONFIG,
} from './types';

// ============================================================================
// VALIDATION EXPORTS
// ============================================================================

export {
  // Schemas
  playbookCategorySchema,
  dealSizeRangeSchema,
  playbookStatusSchema,
  conversationTypeSchema,
  objectionTypeSchema,
  coachingCategorySchema,
  performanceTierSchema,
  patternCategorySchema,
  applicabilityRuleTypeSchema,
  applicabilityRuleSchema,
  patternExampleSchema,
  patternSchema,
  talkTrackPurposeSchema,
  tonalitySchema,
  paceSchema,
  talkTrackSectionSchema,
  abTestResultsSchema,
  talkTrackVariationSchema,
  talkTrackSchema,
  responseTypeSchema,
  responseStrategySchema,
  objectionResponseExampleSchema,
  objectionResponseSchema,
  bestPracticeEvidenceSchema,
  playbookBestPracticeSchema,
  successMetricsSchema,
  playbookSchema,
  dateRangeSchema,
  extractPatternsRequestSchema,
  generatePlaybookRequestSchema,
  getAdoptionMetricsRequestSchema,
  playbookDeviationSchema,
  trackPlaybookUsageRequestSchema,
  searchPlaybooksRequestSchema,
  
  // Validation functions
  validateExtractPatternsRequest,
  validateGeneratePlaybookRequest,
  validateGetAdoptionMetricsRequest,
  validateTrackPlaybookUsageRequest,
  validateSearchPlaybooksRequest,
  validatePlaybook,
  validatePattern,
  validateTalkTrack,
  validateObjectionResponse,
  validateBestPractice,
} from './validation';

// ============================================================================
// EVENT EXPORTS
// ============================================================================

export type {
  // Event types
  PlaybookGeneratedEvent,
  PatternsExtractedEvent,
  PlaybookActivatedEvent,
  PlaybookUsedEvent,
  PlaybookUpdatedEvent,
  AdoptionTrackedEvent,
  EffectivenessMeasuredEvent,
  PlaybookArchivedEvent,
  PatternIdentifiedEvent,
  PlaybookEvent,
  
  // Handler types
  PlaybookEventHandler,
  PlaybookEventHandlers,
} from './events';

export {
  // Event creators
  createPlaybookGeneratedEvent,
  createPatternsExtractedEvent,
  createPlaybookActivatedEvent,
  createPlaybookUsedEvent,
  createPlaybookUpdatedEvent,
  createAdoptionTrackedEvent,
  createEffectivenessMeasuredEvent,
  createPlaybookArchivedEvent,
  createPatternIdentifiedEvent,
  
  // Type guards
  isPlaybookGeneratedEvent,
  isPatternsExtractedEvent,
  isPlaybookActivatedEvent,
  isPlaybookUsedEvent,
  isPlaybookUpdatedEvent,
  isAdoptionTrackedEvent,
  isEffectivenessMeasuredEvent,
  isPlaybookArchivedEvent,
  isPatternIdentifiedEvent,
  isPlaybookEvent,
  
  // Event routing
  routePlaybookEvent,
  
  // Workflow triggers
  PLAYBOOK_WORKFLOW_TRIGGERS,
} from './events';
