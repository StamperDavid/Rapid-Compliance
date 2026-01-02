/**
 * Conversation Intelligence - Validation Schemas
 * 
 * Comprehensive Zod schemas for all conversation intelligence types.
 * Ensures type safety and data validation at API boundaries.
 * 
 * @module lib/conversation
 */

import { z } from 'zod';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const ConversationTypeSchema = z.enum([
  'discovery_call',
  'demo',
  'follow_up',
  'negotiation',
  'close_call',
  'check_in',
  'internal_meeting',
  'other',
]);

export const ConversationStatusSchema = z.enum([
  'scheduled',
  'in_progress',
  'completed',
  'cancelled',
  'no_show',
]);

export const ParticipantRoleSchema = z.enum([
  'sales_rep',
  'sales_manager',
  'sales_engineer',
  'prospect',
  'decision_maker',
  'influencer',
  'champion',
  'blocker',
  'other',
]);

export const SentimentPolaritySchema = z.enum([
  'very_positive',
  'positive',
  'neutral',
  'negative',
  'very_negative',
]);

export const TalkRatioAssessmentSchema = z.enum([
  'ideal',
  'rep_dominating',
  'prospect_dominating',
  'balanced',
  'needs_improvement',
]);

export const TopicCategorySchema = z.enum([
  'pain_points',
  'business_value',
  'technical_requirements',
  'pricing',
  'timeline',
  'competition',
  'stakeholders',
  'decision_process',
  'integration',
  'support',
  'other',
]);

export const ObjectionTypeSchema = z.enum([
  'pricing',
  'timing',
  'authority',
  'competition',
  'technical',
  'trust',
  'need',
  'urgency',
  'other',
]);

export const KeyMomentTypeSchema = z.enum([
  'buying_signal',
  'objection',
  'commitment',
  'concern',
  'decision_maker_engagement',
  'competitor_mention',
  'timeline_discussed',
  'budget_revealed',
  'next_steps_agreed',
  'red_flag',
  'other',
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

export const FollowUpActionTypeSchema = z.enum([
  'send_follow_up_email',
  'schedule_meeting',
  'send_proposal',
  'share_resources',
  'introduce_stakeholder',
  'address_concern',
  'provide_pricing',
  'schedule_demo',
  'send_case_study',
  'internal_alignment',
  'other',
]);

export const SeveritySchema = z.enum(['critical', 'high', 'medium', 'low']);
export const ImpactSchema = z.enum(['positive', 'negative', 'neutral']);
export const StatusQualitySchema = z.enum(['excellent', 'good', 'needs_improvement', 'poor']);
export const StrengthSchema = z.enum(['strong', 'moderate', 'weak']);
export const ResponseQualitySchema = z.enum(['excellent', 'good', 'poor', 'none']);
export const TrendDirectionSchema = z.enum(['improving', 'declining', 'stable']);
export const CriticalMomentTypeSchema = z.enum(['spike', 'drop']);

export const QualityIndicatorTypeSchema = z.enum([
  'talk_ratio',
  'question_frequency',
  'discovery_depth',
  'next_steps_clarity',
  'stakeholder_engagement',
  'objection_handling',
  'time_management',
  'energy_level',
  'professionalism',
]);

export const RedFlagTypeSchema = z.enum([
  'no_next_steps',
  'no_decision_maker',
  'budget_concerns',
  'timeline_vague',
  'competitor_preference',
  'low_engagement',
  'multiple_objections',
  'ghosting_risk',
  'poor_fit',
  'unrealistic_expectations',
]);

export const PositiveSignalTypeSchema = z.enum([
  'buying_intent',
  'budget_confirmed',
  'timeline_committed',
  'decision_maker_engaged',
  'champion_identified',
  'competitor_dismissed',
  'urgency_expressed',
  'clear_pain_point',
  'value_acknowledged',
  'next_steps_confirmed',
]);

// ============================================================================
// CORE SCHEMAS
// ============================================================================

export const ParticipantSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  email: z.string().email().optional(),
  role: ParticipantRoleSchema,
  company: z.string().max(200).optional(),
  title: z.string().max(200).optional(),
});

export const ConversationSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  
  type: ConversationTypeSchema,
  title: z.string().min(1).max(500),
  description: z.string().max(2000).optional(),
  
  participants: z.array(ParticipantSchema).min(1),
  repId: z.string().min(1),
  
  startedAt: z.date(),
  endedAt: z.date().optional(),
  duration: z.number().int().min(0).max(28800), // Max 8 hours
  
  transcript: z.string().max(1000000).optional(), // Max 1MB
  recordingUrl: z.string().url().optional(),
  
  dealId: z.string().optional(),
  leadId: z.string().optional(),
  accountId: z.string().optional(),
  
  status: ConversationStatusSchema,
  
  source: z.string().max(100).optional(),
  externalId: z.string().max(200).optional(),
  
  createdAt: z.date(),
  updatedAt: z.date().optional(),
});

// ============================================================================
// ANALYSIS SCHEMAS
// ============================================================================

export const SentimentScoreSchema = z.object({
  polarity: SentimentPolaritySchema,
  score: z.number().min(-1).max(1),
  confidence: z.number().int().min(0).max(100),
  tone: z.array(z.string().max(100)),
});

export const SentimentTimePointSchema = z.object({
  timestamp: z.number().int().min(0),
  sentiment: z.number().min(-1).max(1),
  speaker: z.string().min(1).max(200),
  context: z.string().max(500).optional(),
});

export const CriticalMomentSchema = z.object({
  timestamp: z.number().int().min(0),
  type: CriticalMomentTypeSchema,
  magnitude: z.number(),
  speaker: z.string().min(1).max(200),
  quote: z.string().max(1000),
  context: z.string().max(1000),
  impact: SeveritySchema,
});

export const SentimentAnalysisSchema = z.object({
  overall: SentimentScoreSchema,
  byParticipant: z.record(z.string(), SentimentScoreSchema),
  timeline: z.array(SentimentTimePointSchema),
  trendDirection: TrendDirectionSchema,
  criticalMoments: z.array(CriticalMomentSchema),
});

export const TalkRatioSchema = z.object({
  speakerTime: z.number().min(0),
  listenerTime: z.number().min(0),
  ratio: z.number().min(0),
  isIdeal: z.boolean(),
});

export const ParticipantTalkStatsSchema = z.object({
  totalTime: z.number().min(0),
  percentage: z.number().int().min(0).max(100),
  turnCount: z.number().int().min(0),
  avgTurnDuration: z.number().min(0),
  longestTurn: z.number().min(0),
  interruptionCount: z.number().int().min(0),
  questionCount: z.number().int().min(0),
});

export const TalkRatioAnalysisSchema = z.object({
  overall: TalkRatioSchema,
  byParticipant: z.record(z.string(), ParticipantTalkStatsSchema),
  repTalkTime: z.number().min(0),
  prospectTalkTime: z.number().min(0),
  repPercentage: z.number().int().min(0).max(100),
  prospectPercentage: z.number().int().min(0).max(100),
  assessment: TalkRatioAssessmentSchema,
  recommendation: z.string().max(500),
});

export const TopicSchema = z.object({
  name: z.string().min(1).max(200),
  category: TopicCategorySchema,
  mentions: z.number().int().min(0),
  duration: z.number().min(0),
  sentiment: z.number().min(-1).max(1),
  importance: SeveritySchema,
  quotes: z.array(z.string().max(1000)),
});

export const TopicTimeAllocationSchema = z.object({
  topic: z.string().min(1).max(200),
  duration: z.number().min(0),
  percentage: z.number().min(0).max(100),
  isAppropriate: z.boolean(),
  recommendation: z.string().max(500).optional(),
});

export const TopicAnalysisSchema = z.object({
  mainTopics: z.array(TopicSchema),
  coverageMap: z.record(z.string(), z.number()),
  uncoveredTopics: z.array(z.string().max(200)),
  timeAllocation: z.array(TopicTimeAllocationSchema),
});

export const ObjectionAnalysisSchema = z.object({
  id: z.string().min(1),
  type: ObjectionTypeSchema,
  objection: z.string().min(1).max(500),
  quote: z.string().max(1000),
  timestamp: z.number().int().min(0),
  speaker: z.string().min(1).max(200),
  severity: SeveritySchema,
  wasAddressed: z.boolean(),
  repResponse: z.string().max(1000).optional(),
  responseQuality: ResponseQualitySchema.optional(),
  recommendedResponse: z.string().max(1000).optional(),
});

export const CompetitorMentionSchema = z.object({
  competitor: z.string().min(1).max(200),
  mentions: z.number().int().min(0),
  context: z.array(z.string().max(1000)),
  sentiment: z.number().min(-1).max(1),
  concernLevel: SeveritySchema,
  recommendedResponse: z.string().max(1000),
  battlecardId: z.string().optional(),
});

export const KeyMomentSchema = z.object({
  id: z.string().min(1),
  timestamp: z.number().int().min(0),
  type: KeyMomentTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  speaker: z.string().min(1).max(200),
  quote: z.string().max(1000),
  impact: ImpactSchema,
  significance: SeveritySchema,
});

export const CoachingInsightSchema = z.object({
  id: z.string().min(1),
  category: CoachingCategorySchema,
  priority: SeveritySchema,
  insight: z.string().min(1).max(500),
  whatWentWell: z.string().max(500).optional(),
  whatToImprove: z.string().min(1).max(500),
  specificExample: z.string().min(1).max(1000),
  recommendedAction: z.string().min(1).max(500),
  skillArea: z.string().min(1).max(200),
  impact: z.number().int().min(0).max(100),
});

export const FollowUpActionSchema = z.object({
  id: z.string().min(1),
  type: FollowUpActionTypeSchema,
  priority: SeveritySchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  reasoning: z.string().min(1).max(500),
  deadline: z.string().min(1).max(100),
  assignee: z.string().max(200).optional(),
  estimatedEffort: z.number().min(0).max(40),
});

export const ConversationScoresSchema = z.object({
  overall: z.number().int().min(0).max(100),
  discovery: z.number().int().min(0).max(100),
  valueArticulation: z.number().int().min(0).max(100),
  objectionHandling: z.number().int().min(0).max(100),
  closing: z.number().int().min(0).max(100),
  rapport: z.number().int().min(0).max(100),
  engagement: z.number().int().min(0).max(100),
});

export const QualityIndicatorSchema = z.object({
  type: QualityIndicatorTypeSchema,
  status: StatusQualitySchema,
  score: z.number().int().min(0).max(100),
  description: z.string().min(1).max(500),
  recommendation: z.string().max(500).optional(),
});

export const RedFlagSchema = z.object({
  type: RedFlagTypeSchema,
  severity: SeveritySchema,
  description: z.string().min(1).max(500),
  quote: z.string().max(1000).optional(),
  timestamp: z.number().int().min(0).optional(),
  recommendation: z.string().min(1).max(500),
});

export const PositiveSignalSchema = z.object({
  type: PositiveSignalTypeSchema,
  strength: StrengthSchema,
  description: z.string().min(1).max(500),
  quote: z.string().max(1000).optional(),
  timestamp: z.number().int().min(0).optional(),
  impact: z.string().min(1).max(500),
});

export const ConversationAnalysisSchema = z.object({
  conversationId: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().min(1),
  
  sentiment: SentimentAnalysisSchema,
  talkRatio: TalkRatioAnalysisSchema,
  topics: TopicAnalysisSchema,
  objections: z.array(ObjectionAnalysisSchema),
  competitors: z.array(CompetitorMentionSchema),
  
  keyMoments: z.array(KeyMomentSchema),
  coachingInsights: z.array(CoachingInsightSchema),
  followUpActions: z.array(FollowUpActionSchema),
  
  scores: ConversationScoresSchema,
  qualityIndicators: z.array(QualityIndicatorSchema),
  redFlags: z.array(RedFlagSchema),
  positiveSignals: z.array(PositiveSignalSchema),
  
  summary: z.string().min(1).max(2000),
  highlights: z.array(z.string().max(500)),
  
  confidence: z.number().int().min(0).max(100),
  analyzedAt: z.date(),
  analysisVersion: z.string().min(1).max(50),
  aiModel: z.string().min(1).max(100),
  tokensUsed: z.number().int().min(0),
  processingTime: z.number().int().min(0),
});

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

export const AnalyzeConversationRequestSchema = z.object({
  conversationId: z.string().min(1).max(200),
  organizationId: z.string().min(1).max(200),
  workspaceId: z.string().min(1).max(200).optional(),
  
  dealId: z.string().max(200).optional(),
  leadId: z.string().max(200).optional(),
  
  includeCoaching: z.boolean().optional().default(true),
  includeFollowUps: z.boolean().optional().default(true),
  customContext: z.string().max(2000).optional(),
  
  forceRefresh: z.boolean().optional().default(false),
});

export const AnalyzeTranscriptRequestSchema = z.object({
  organizationId: z.string().min(1).max(200),
  workspaceId: z.string().min(1).max(200).optional(),
  
  transcript: z.string().min(100).max(1000000),
  conversationType: ConversationTypeSchema,
  participants: z.array(ParticipantSchema).min(1).max(20),
  repId: z.string().min(1).max(200),
  duration: z.number().int().min(60).max(28800), // 1 min to 8 hours
  
  dealId: z.string().max(200).optional(),
  leadId: z.string().max(200).optional(),
  title: z.string().max(500).optional(),
  
  includeCoaching: z.boolean().optional().default(true),
  includeFollowUps: z.boolean().optional().default(true),
  customContext: z.string().max(2000).optional(),
});

export const BatchAnalysisRequestSchema = z.object({
  conversationIds: z.array(z.string().min(1).max(200)).min(1).max(50),
  organizationId: z.string().min(1).max(200),
  workspaceId: z.string().min(1).max(200).optional(),
  includeCoaching: z.boolean().optional().default(false),
  includeFollowUps: z.boolean().optional().default(false),
});

// ============================================================================
// CONFIGURATION SCHEMA
// ============================================================================

export const ConversationEngineConfigSchema = z.object({
  aiModel: z.string().min(1).max(100),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(100).max(16000),
  
  minTranscriptLength: z.number().int().min(50).max(1000),
  idealTalkRatioMin: z.number().min(0).max(1),
  idealTalkRatioMax: z.number().min(0).max(1),
  
  minConfidence: z.number().int().min(0).max(100),
  enableSentimentAnalysis: z.boolean(),
  enableObjectionDetection: z.boolean(),
  enableCompetitorTracking: z.boolean(),
  
  maxCoachingInsights: z.number().int().min(1).max(10),
  maxFollowUpActions: z.number().int().min(1).max(10),
  coachingPriorityThreshold: SeveritySchema,
  
  cacheTTL: z.number().int().min(0).max(86400),
  enableCaching: z.boolean(),
});

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate analyze conversation request
 */
export function validateAnalyzeConversationRequest(data: unknown) {
  return AnalyzeConversationRequestSchema.parse(data);
}

/**
 * Validate analyze transcript request
 */
export function validateAnalyzeTranscriptRequest(data: unknown) {
  return AnalyzeTranscriptRequestSchema.parse(data);
}

/**
 * Validate batch analysis request
 */
export function validateBatchAnalysisRequest(data: unknown) {
  return BatchAnalysisRequestSchema.parse(data);
}

/**
 * Validate conversation analysis
 */
export function validateConversationAnalysis(data: unknown) {
  return ConversationAnalysisSchema.parse(data);
}

/**
 * Validate engine configuration
 */
export function validateEngineConfig(data: unknown) {
  return ConversationEngineConfigSchema.parse(data);
}

/**
 * Safe parse with error handling
 */
export function safeParseAnalyzeRequest(data: unknown) {
  const result = AnalyzeConversationRequestSchema.safeParse(data);
  
  if (!result.success) {
    return {
      success: false,
      error: result.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
      })),
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}
