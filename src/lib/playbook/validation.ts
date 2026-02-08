/**
 * Playbook Builder - Input Validation
 * 
 * Comprehensive Zod schemas for validating all playbook-related inputs.
 * Ensures data integrity and type safety across the playbook system.
 * 
 * @module lib/playbook/validation
 */

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

/**
 * Playbook category schema
 */
export const playbookCategorySchema = z.enum([
  'discovery',
  'demo',
  'objection_handling',
  'closing',
  'negotiation',
  'follow_up',
  'prospecting',
  'relationship_building',
  'competitive_positioning',
  'value_articulation',
  'general',
]);

/**
 * Deal size range schema
 */
export const dealSizeRangeSchema = z.enum([
  'smb',
  'mid_market',
  'enterprise',
  'any',
]);

/**
 * Playbook status schema
 */
export const playbookStatusSchema = z.enum([
  'draft',
  'active',
  'testing',
  'archived',
  'deprecated',
]);

/**
 * Conversation type schema
 */
export const conversationTypeSchema = z.enum([
  'discovery_call',
  'demo',
  'follow_up',
  'negotiation',
  'close_call',
  'check_in',
  'internal_meeting',
  'other',
]);

/**
 * Objection type schema
 */
export const objectionTypeSchema = z.enum([
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

/**
 * Coaching category schema
 */
export const coachingCategorySchema = z.enum([
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

/**
 * Performance tier schema
 */
export const performanceTierSchema = z.enum([
  'top_performer',
  'high_performer',
  'solid_performer',
  'developing',
  'needs_improvement',
]);

// ============================================================================
// PATTERN SCHEMAS
// ============================================================================

/**
 * Pattern category schema
 */
export const patternCategorySchema = z.enum([
  'opening',
  'discovery_question',
  'value_proposition',
  'objection_response',
  'closing_technique',
  'rapport_building',
  'pain_exploration',
  'feature_positioning',
  'competitor_dismissal',
  'urgency_creation',
  'stakeholder_engagement',
  'next_steps',
  'other',
]);

/**
 * Applicability rule type schema
 */
export const applicabilityRuleTypeSchema = z.enum([
  'conversation_type',
  'deal_size',
  'industry',
  'stage',
  'sentiment',
  'objection_type',
  'topic',
  'competitor',
  'stakeholder_role',
  'time_in_call',
  'custom',
]);

/**
 * Applicability rule schema
 */
export const applicabilityRuleSchema = z.object({
  type: applicabilityRuleTypeSchema,
  condition: z.string().min(1).max(500),
  value: z.union([
    z.string(),
    z.number(),
    z.array(z.string()),
  ]).optional(),
  operator: z.enum(['equals', 'contains', 'greater_than', 'less_than', 'in']).optional(),
});

/**
 * Pattern example schema
 */
export const patternExampleSchema = z.object({
  conversationId: z.string().min(1),
  repId: z.string().min(1),
  repName: z.string().min(1).max(200),
  timestamp: z.number().min(0),
  situation: z.string().min(1).max(1000),
  quote: z.string().min(1).max(2000),
  outcome: z.string().min(1).max(1000),
  sentimentBefore: z.number().min(-1).max(1),
  sentimentAfter: z.number().min(-1).max(1),
  effectiveness: z.enum(['excellent', 'good', 'fair']),
  keyFactors: z.array(z.string().max(500)).max(10),
});

/**
 * Pattern schema
 */
export const patternSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: patternCategorySchema,
  situation: z.string().min(1).max(1000),
  approach: z.string().min(1).max(2000),
  outcome: z.string().min(1).max(1000),
  examples: z.array(patternExampleSchema).max(20),
  frequency: z.number().min(0),
  successRate: z.number().min(0).max(100),
  avgImpact: z.number().min(0).max(100),
  sourceConversationIds: z.array(z.string()).max(100),
  topPerformerIds: z.array(z.string()).max(50),
  applicableWhen: z.array(applicabilityRuleSchema).max(10),
  notApplicableWhen: z.array(applicabilityRuleSchema).max(10).optional(),
  avgSentimentChange: z.number().min(-2).max(2),
  avgScoreChange: z.number().min(-100).max(100),
  confidence: z.number().min(0).max(100),
  sampleSize: z.number().min(0),
});

// ============================================================================
// TALK TRACK SCHEMAS
// ============================================================================

/**
 * Talk track purpose schema
 */
export const talkTrackPurposeSchema = z.enum([
  'opening',
  'value_prop',
  'discovery',
  'demo_intro',
  'objection_handling',
  'pricing_discussion',
  'closing',
  'follow_up',
  'competitor_comparison',
  'case_study',
  'feature_explanation',
  'pain_acknowledgment',
  'urgency_building',
  'stakeholder_alignment',
  'next_steps',
]);

/**
 * Tonality schema
 */
export const tonalitySchema = z.enum([
  'consultative',
  'assertive',
  'empathetic',
  'enthusiastic',
  'professional',
  'casual',
  'urgent',
  'educational',
]);

/**
 * Pace schema
 */
export const paceSchema = z.enum([
  'slow',
  'moderate',
  'fast',
]);

/**
 * Talk track section schema
 */
export const talkTrackSectionSchema = z.object({
  order: z.number().min(1),
  name: z.string().min(1).max(200),
  content: z.string().min(1).max(2000),
  purpose: z.string().min(1).max(500),
  estimatedDuration: z.number().min(0),
  criticalPoints: z.array(z.string().max(500)).max(10),
});

/**
 * A/B test results schema
 */
export const abTestResultsSchema = z.object({
  variantA: z.string().min(1),
  variantB: z.string().min(1),
  variantASuccessRate: z.number().min(0).max(100),
  variantBSuccessRate: z.number().min(0).max(100),
  winner: z.string(),
  sampleSizeA: z.number().min(0),
  sampleSizeB: z.number().min(0),
  confidence: z.number().min(0).max(100),
  pValue: z.number().min(0).max(1),
  recommendation: z.string().min(1).max(1000),
});

/**
 * Talk track variation schema
 */
export const talkTrackVariationSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  script: z.string().min(1).max(5000),
  differencesFrom: z.string().min(1).max(1000),
  useCase: z.string().min(1).max(500),
  successRate: z.number().min(0).max(100),
  sampleSize: z.number().min(0),
  abTestResults: abTestResultsSchema.optional(),
});

/**
 * Talk track schema
 */
export const talkTrackSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  purpose: talkTrackPurposeSchema,
  script: z.string().min(1).max(5000),
  keyPhrases: z.array(z.string().max(200)).max(20),
  tonality: tonalitySchema,
  pace: paceSchema,
  structure: z.array(talkTrackSectionSchema).max(10),
  variations: z.array(talkTrackVariationSchema).max(10),
  useWhen: z.array(z.string().max(500)).max(10),
  avoidWhen: z.array(z.string().max(500)).max(10),
  successRate: z.number().min(0).max(100),
  avgSentimentScore: z.number().min(-1).max(1),
  avgConversionRate: z.number().min(0).max(100),
  sourceConversationIds: z.array(z.string()).max(100),
  originatingRepId: z.string().min(1),
  originatingRepName: z.string().min(1).max(200),
  adoptionRate: z.number().min(0).max(100),
  usageCount: z.number().min(0),
  avgTimeToDeliver: z.number().min(0),
  avgSentimentChange: z.number().min(-2).max(2),
  confidence: z.number().min(0).max(100),
  sampleSize: z.number().min(0),
});

// ============================================================================
// OBJECTION RESPONSE SCHEMAS
// ============================================================================

/**
 * Response type schema
 */
export const responseTypeSchema = z.enum([
  'acknowledge_and_reframe',
  'question_based',
  'story_based',
  'data_driven',
  'social_proof',
  'risk_reversal',
  'comparison',
  'urgency',
  'value_reinforcement',
  'alternative_offer',
]);

/**
 * Response strategy schema
 */
export const responseStrategySchema = z.enum([
  'empathize_then_educate',
  'feel_felt_found',
  'boomerang',
  'isolation',
  'reframe',
  'story',
  'question',
  'evidence',
  'trial_close',
]);

/**
 * Objection response example schema
 */
export const objectionResponseExampleSchema = z.object({
  conversationId: z.string().min(1),
  repId: z.string().min(1),
  repName: z.string().min(1).max(200),
  dealSize: z.number().min(0),
  industry: z.string().min(1).max(200),
  stage: z.string().min(1).max(100),
  objectionQuote: z.string().min(1).max(2000),
  objectionSeverity: z.enum(['critical', 'high', 'medium', 'low']),
  responseQuote: z.string().min(1).max(2000),
  outcome: z.enum(['resolved', 'partially_resolved', 'unresolved']),
  dealWon: z.boolean(),
  sentimentBefore: z.number().min(-1).max(1),
  sentimentAfter: z.number().min(-1).max(1),
  successFactors: z.array(z.string().max(500)).max(10),
  lessonsLearned: z.array(z.string().max(500)).max(10),
});

/**
 * Objection response schema
 */
export const objectionResponseSchema = z.object({
  id: z.string().min(1),
  objectionType: objectionTypeSchema,
  objectionText: z.string().min(1).max(500),
  variations: z.array(z.string().max(500)).max(20),
  response: z.string().min(1).max(2000),
  responseType: responseTypeSchema,
  strategy: responseStrategySchema,
  keyTechniques: z.array(z.string().max(300)).max(10),
  examples: z.array(objectionResponseExampleSchema).max(20),
  successRate: z.number().min(0).max(100),
  avgSentimentChange: z.number().min(-2).max(2),
  dealSaveRate: z.number().min(0).max(100),
  sourceConversationIds: z.array(z.string()).max(100),
  topPerformerIds: z.array(z.string()).max(50),
  worksWellWith: z.array(z.string().max(200)).max(10),
  followUpWith: z.array(z.string().max(200)).max(10),
  avgTimeToResolve: z.number().min(0),
  avgTurnsToResolve: z.number().min(0),
  confidence: z.number().min(0).max(100),
  sampleSize: z.number().min(0),
});

// ============================================================================
// BEST PRACTICE SCHEMAS
// ============================================================================

/**
 * Best practice evidence schema
 */
export const bestPracticeEvidenceSchema = z.object({
  metric: z.string().min(1).max(200),
  topPerformerAvg: z.number(),
  teamAvg: z.number(),
  lift: z.number(),
  significance: z.enum(['high', 'medium', 'low']),
  description: z.string().min(1).max(500),
});

/**
 * Playbook best practice schema
 */
export const playbookBestPracticeSchema = z.object({
  id: z.string().min(1),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: coachingCategorySchema,
  whatToDo: z.string().min(1).max(1000),
  whatNotToDo: z.string().min(1).max(1000),
  rationale: z.string().min(1).max(2000),
  psychologicalPrinciples: z.array(z.string().max(300)).max(10).optional(),
  evidence: z.array(bestPracticeEvidenceSchema).max(10),
  implementationSteps: z.array(z.string().max(500)).max(10),
  difficulty: z.enum(['easy', 'medium', 'hard']),
  impactOnConversions: z.number(),
  impactOnSentiment: z.number(),
  impactOnWinRate: z.number(),
  topPerformerIds: z.array(z.string()).max(50),
  sourceConversationIds: z.array(z.string()).max(100),
  adoptionRate: z.number().min(0).max(100),
  timeToMaster: z.string().min(1).max(100),
  repsUsingIt: z.number().min(0),
  avgSuccessRate: z.number().min(0).max(100),
  confidence: z.number().min(0).max(100),
  sampleSize: z.number().min(0),
});

// ============================================================================
// PLAYBOOK SCHEMAS
// ============================================================================

/**
 * Success metrics schema
 */
export const successMetricsSchema = z.object({
  avgConversionRate: z.number().min(0).max(100),
  vsBaselineConversion: z.number(),
  avgSentimentScore: z.number().min(-1).max(1),
  vsBaselineSentiment: z.number(),
  avgOverallScore: z.number().min(0).max(100),
  vsBaselineScore: z.number(),
  objectionSuccessRate: z.number().min(0).max(100),
  vsBaselineObjectionSuccess: z.number(),
  winRate: z.number().min(0).max(100),
  vsBaselineWinRate: z.number(),
  conversationsAnalyzed: z.number().min(0),
  repsUsing: z.number().min(0),
  confidence: z.number().min(0).max(100),
  pValue: z.number().min(0).max(1).optional(),
});

/**
 * Playbook schema
 */
export const playbookSchema = z.object({
  id: z.string().min(1),
  workspaceId: z.string().min(1),
  name: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
  category: playbookCategorySchema,
  tags: z.array(z.string().max(50)).max(20),
  conversationType: conversationTypeSchema,
  industry: z.string().max(100).optional(),
  dealSize: dealSizeRangeSchema.optional(),
  patterns: z.array(patternSchema).max(50),
  talkTracks: z.array(talkTrackSchema).max(30),
  objectionResponses: z.array(objectionResponseSchema).max(30),
  bestPractices: z.array(playbookBestPracticeSchema).max(20),
  successMetrics: successMetricsSchema,
  sourceConversations: z.array(z.string()).max(500),
  topPerformers: z.array(z.string()).max(100),
  adoptionRate: z.number().min(0).max(100),
  effectiveness: z.number().min(0).max(100),
  usageCount: z.number().min(0),
  status: playbookStatusSchema,
  confidence: z.number().min(0).max(100),
  createdBy: z.string().min(1),
  updatedBy: z.string().optional(),
  version: z.number().min(1),
});

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Date range schema
 */
export const dateRangeSchema = z.object({
  startDate: z.union([z.date(), z.string().datetime()]),
  endDate: z.union([z.date(), z.string().datetime()]),
});

/**
 * Extract patterns request schema
 */
export const extractPatternsRequestSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  conversationIds: z.array(z.string()).max(500).optional(),
  repIds: z.array(z.string()).max(100).optional(),
  conversationType: conversationTypeSchema.optional(),
  minPerformanceScore: z.number().min(0).max(100).optional(),
  dateRange: dateRangeSchema.optional(),
  minFrequency: z.number().min(1).max(100).optional(),
  minSuccessRate: z.number().min(0).max(100).optional(),
  minConfidence: z.number().min(0).max(100).optional(),
  extractPatterns: z.boolean().optional(),
  extractTalkTracks: z.boolean().optional(),
  extractObjectionResponses: z.boolean().optional(),
  extractBestPractices: z.boolean().optional(),
  includeExamples: z.boolean().optional(),
  maxExamplesPerPattern: z.number().min(1).max(50).optional(),
  groupByCategory: z.boolean().optional(),
});

/**
 * Generate playbook request schema
 */
export const generatePlaybookRequestSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  category: playbookCategorySchema,
  conversationType: conversationTypeSchema,
  sourceConversationIds: z.array(z.string()).max(500).optional(),
  topPerformerIds: z.array(z.string()).max(100).optional(),
  minPerformanceScore: z.number().min(0).max(100).optional(),
  dateRange: dateRangeSchema.optional(),
  includePatterns: z.boolean().optional(),
  includeTalkTracks: z.boolean().optional(),
  includeObjectionResponses: z.boolean().optional(),
  includeBestPractices: z.boolean().optional(),
  autoActivate: z.boolean().optional(),
});

/**
 * Get adoption metrics request schema
 */
export const getAdoptionMetricsRequestSchema = z.object({
  playbookId: z.string().min(1),
  workspaceId: z.string().min(1).optional(),
  startDate: z.union([z.date(), z.string().datetime()]).optional(),
  endDate: z.union([z.date(), z.string().datetime()]).optional(),
});

/**
 * Playbook deviation schema
 */
export const playbookDeviationSchema = z.object({
  elementId: z.string().min(1),
  elementType: z.enum(['pattern', 'talk_track', 'objection_response']),
  expectedUsage: z.string().min(1).max(1000),
  actualUsage: z.string().min(1).max(1000),
  impact: z.enum(['positive', 'negative', 'neutral']),
  reason: z.string().max(500).optional(),
});

/**
 * Track playbook usage request schema
 */
export const trackPlaybookUsageRequestSchema = z.object({
  playbookId: z.string().min(1),
  conversationId: z.string().min(1),
  repId: z.string().min(1),
  patternsUsed: z.array(z.string()).max(50),
  talkTracksUsed: z.array(z.string()).max(30),
  objectionResponsesUsed: z.array(z.string()).max(30),
  overallEffectiveness: z.enum(['excellent', 'good', 'fair', 'poor']),
  adherenceScore: z.number().min(0).max(100),
  deviations: z.array(playbookDeviationSchema).max(20).optional(),
});

/**
 * Search playbooks request schema
 */
export const searchPlaybooksRequestSchema = z.object({
  workspaceId: z.string().min(1).optional(),
  query: z.string().max(200).optional(),
  category: playbookCategorySchema.optional(),
  conversationType: conversationTypeSchema.optional(),
  status: playbookStatusSchema.optional(),
  tags: z.array(z.string().max(50)).max(20).optional(),
  minEffectiveness: z.number().min(0).max(100).optional(),
  minAdoptionRate: z.number().min(0).max(100).optional(),
  sortBy: z.enum(['effectiveness', 'adoption', 'usage', 'created', 'updated']).optional(),
  sortOrder: z.enum(['asc', 'desc']).optional(),
  limit: z.number().min(1).max(100).optional(),
  offset: z.number().min(0).optional(),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate extract patterns request
 */
export function validateExtractPatternsRequest(data: unknown) {
  return extractPatternsRequestSchema.parse(data);
}

/**
 * Validate generate playbook request
 */
export function validateGeneratePlaybookRequest(data: unknown) {
  return generatePlaybookRequestSchema.parse(data);
}

/**
 * Validate get adoption metrics request
 */
export function validateGetAdoptionMetricsRequest(data: unknown) {
  return getAdoptionMetricsRequestSchema.parse(data);
}

/**
 * Validate track playbook usage request
 */
export function validateTrackPlaybookUsageRequest(data: unknown) {
  return trackPlaybookUsageRequestSchema.parse(data);
}

/**
 * Validate search playbooks request
 */
export function validateSearchPlaybooksRequest(data: unknown) {
  return searchPlaybooksRequestSchema.parse(data);
}

/**
 * Validate playbook
 */
export function validatePlaybook(data: unknown) {
  return playbookSchema.parse(data);
}

/**
 * Validate pattern
 */
export function validatePattern(data: unknown) {
  return patternSchema.parse(data);
}

/**
 * Validate talk track
 */
export function validateTalkTrack(data: unknown) {
  return talkTrackSchema.parse(data);
}

/**
 * Validate objection response
 */
export function validateObjectionResponse(data: unknown) {
  return objectionResponseSchema.parse(data);
}

/**
 * Validate best practice
 */
export function validateBestPractice(data: unknown) {
  return playbookBestPracticeSchema.parse(data);
}
