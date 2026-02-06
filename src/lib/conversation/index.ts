/**
 * Conversation Intelligence - Module Exports
 * 
 * Central export point for conversation intelligence functionality.
 * 
 * FEATURES:
 * - AI-powered conversation analysis
 * - Sentiment and tone detection
 * - Talk ratio calculation
 * - Topic extraction and objection handling
 * - Coaching insights and follow-up recommendations
 * - Signal Bus integration
 * 
 * USAGE:
 * ```typescript
 * import { analyzeConversation, analyzeTranscript } from '@/lib/conversation';
 * 
 * // Analyze existing conversation
 * const analysis = await analyzeConversation({
 *   conversationId: 'conv-123',
 *   includeCoaching: true,
 *   includeFollowUps: true,
 * });
 *
 * // Analyze raw transcript
 * const analysis = await analyzeTranscript({
 *   transcript: 'conversation text...',
 *   conversationType: 'discovery_call',
 *   participants: [...],
 *   repId: 'rep-789',
 *   duration: 1800,
 * });
 * ```
 * 
 * @module lib/conversation
 */

// ============================================================================
// CORE ENGINE
// ============================================================================

export {
  analyzeConversation,
  analyzeTranscript,
  analyzeBatchConversations,
} from './conversation-engine';

// ============================================================================
// TYPES
// ============================================================================

export type {
  // Core Types
  Conversation,
  ConversationType,
  ConversationStatus,
  Participant,
  ParticipantRole,
  
  // Analysis Types
  ConversationAnalysis,
  SentimentAnalysis,
  SentimentScore,
  SentimentTimePoint,
  CriticalMoment,
  TalkRatioAnalysis,
  TalkRatio,
  ParticipantTalkStats,
  TalkRatioAssessment,
  TopicAnalysis,
  Topic,
  TopicCategory,
  TopicTimeAllocation,
  ObjectionAnalysis,
  ObjectionType,
  CompetitorMention,
  KeyMoment,
  KeyMomentType,
  CoachingInsight,
  CoachingCategory,
  FollowUpAction,
  FollowUpActionType,
  ConversationScores,
  QualityIndicator,
  QualityIndicatorType,
  RedFlag,
  RedFlagType,
  PositiveSignal,
  PositiveSignalType,
  
  // Request/Response Types
  AnalyzeConversationRequest,
  AnalyzeTranscriptRequest,
  BatchAnalysisRequest,
  BatchAnalysisResponse,
  AnalysisSummary,
  CoachingArea,
  ObjectionSummary,
  CompetitorSummary,
  
  // Configuration
  ConversationEngineConfig,
  
  // Firestore
  ConversationDocument,
  ConversationAnalysisDocument,
} from './types';

export { DEFAULT_CONVERSATION_CONFIG } from './types';

// ============================================================================
// VALIDATION
// ============================================================================

export {
  // Schemas
  ConversationTypeSchema,
  ConversationStatusSchema,
  ParticipantRoleSchema,
  SentimentPolaritySchema,
  TalkRatioAssessmentSchema,
  TopicCategorySchema,
  ObjectionTypeSchema,
  KeyMomentTypeSchema,
  CoachingCategorySchema,
  FollowUpActionTypeSchema,
  SeveritySchema,
  ImpactSchema,
  StatusQualitySchema,
  StrengthSchema,
  ResponseQualitySchema,
  TrendDirectionSchema,
  CriticalMomentTypeSchema,
  QualityIndicatorTypeSchema,
  RedFlagTypeSchema,
  PositiveSignalTypeSchema,
  ParticipantSchema,
  ConversationSchema,
  SentimentScoreSchema,
  SentimentAnalysisSchema,
  TalkRatioAnalysisSchema,
  TopicAnalysisSchema,
  ObjectionAnalysisSchema,
  CompetitorMentionSchema,
  KeyMomentSchema,
  CoachingInsightSchema,
  FollowUpActionSchema,
  ConversationScoresSchema,
  QualityIndicatorSchema,
  RedFlagSchema,
  PositiveSignalSchema,
  ConversationAnalysisSchema,
  AnalyzeConversationRequestSchema,
  AnalyzeTranscriptRequestSchema,
  BatchAnalysisRequestSchema,
  ConversationEngineConfigSchema,
  
  // Validation Functions
  validateAnalyzeConversationRequest,
  validateAnalyzeTranscriptRequest,
  validateBatchAnalysisRequest,
  validateConversationAnalysis,
  validateEngineConfig,
  safeParseAnalyzeRequest,
} from './validation';

// ============================================================================
// EVENTS
// ============================================================================

export type {
  ConversationAnalyzedEvent,
  ConversationLowScoreEvent,
  ConversationRedFlagEvent,
  ConversationCoachingNeededEvent,
  ConversationCompetitorMentionedEvent,
  ConversationObjectionRaisedEvent,
  ConversationPositiveSignalEvent,
  ConversationFollowUpRequiredEvent,
  ConversationSentimentNegativeEvent,
} from './events';

export {
  createConversationAnalyzedEvent,
  createLowScoreEvent,
  createRedFlagEvents,
  createCoachingNeededEvents,
  createCompetitorMentionedEvents,
  createObjectionRaisedEvents,
  createPositiveSignalEvents,
  createFollowUpRequiredEvents,
  createNegativeSentimentEvent,
  createAllConversationEvents,
  emitConversationEvents,
} from './events';
