/**
 * Agent Training Validation Schemas
 *
 * Zod schemas for all agent performance tracking, specialist improvement,
 * and agent-type training configuration types.
 *
 * Follows patterns established in `src/lib/coaching/validation.ts`.
 *
 * @module training/agent-training-validation
 */

import { z } from 'zod';

// ============================================================================
// ENUMS & PRIMITIVES
// ============================================================================

export const AgentDomainSchema = z.enum(['chat', 'social', 'email', 'voice', 'seo']);

export const AgentTypeWithSwarmSchema = z.union([
  z.literal('swarm_specialist'),
  AgentDomainSchema,
]);

export const ReviewSeveritySchema = z.enum(['PASS', 'MINOR', 'MAJOR', 'BLOCK']);

export const QualityTrendSchema = z.enum(['improving', 'declining', 'stable']);

export const ImprovementStatusSchema = z.enum([
  'pending_review',
  'approved',
  'rejected',
  'applied',
]);

// ============================================================================
// AGENT PERFORMANCE ENTRY
// ============================================================================

export const AgentPerformanceEntrySchema = z.object({
  id: z.string().min(1),
  agentId: z.string().min(1),
  agentType: AgentTypeWithSwarmSchema,
  taskId: z.string().min(1),
  timestamp: z.string().datetime({ offset: true }).or(z.string().min(1)),
  qualityScore: z.number().min(0).max(100),
  approved: z.boolean(),
  retryCount: z.number().int().min(0),
  responseTimeMs: z.number().min(0),
  reviewSeverity: ReviewSeveritySchema,
  feedback: z.array(z.string()),
  failureMode: z.string().optional(),
  metadata: z.record(z.string(), z.unknown()),
});

// ============================================================================
// AGENT PERFORMANCE AGGREGATION
// ============================================================================

export const FailureModeCountSchema = z.object({
  mode: z.string().min(1),
  count: z.number().int().min(1),
});

export const AgentPerformanceAggregationSchema = z.object({
  agentId: z.string().min(1),
  agentType: AgentTypeWithSwarmSchema,
  period: z.string().min(1),
  totalExecutions: z.number().int().min(0),
  successRate: z.number().min(0).max(1),
  averageQualityScore: z.number().min(0).max(100),
  retryRate: z.number().min(0).max(1),
  commonFailureModes: z.array(FailureModeCountSchema),
  qualityTrend: QualityTrendSchema,
  lastUpdated: z.string().min(1),
});

// ============================================================================
// SPECIALIST IMPROVEMENT PIPELINE
// ============================================================================

export const ProposedSpecialistChangeSchema = z.object({
  field: z.string().min(1),
  currentValue: z.unknown(),
  proposedValue: z.unknown(),
  reason: z.string().min(1),
  confidence: z.number().min(0).max(1),
});

export const SpecialistImprovementImpactSchema = z.object({
  expectedImprovement: z.number().min(0).max(100),
  areasImproved: z.array(z.string()),
  risks: z.array(z.string()),
  confidence: z.number().min(0).max(1),
});

export const SpecialistImprovementRequestSchema = z.object({
  id: z.string().min(1),
  specialistId: z.string().min(1),
  specialistName: z.string().min(1),
  sourcePerformanceEntries: z.array(z.string()),
  proposedChanges: z.array(ProposedSpecialistChangeSchema).min(1),
  impactAnalysis: SpecialistImprovementImpactSchema,
  status: ImprovementStatusSchema,
  reviewedBy: z.string().optional(),
  reviewNotes: z.string().optional(),
  createdAt: z.string().min(1),
  appliedAt: z.string().optional(),
});

// ============================================================================
// AGENT-TYPE TRAINING CONFIGURATION
// ============================================================================

export const AgentTypeScoringCriterionSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(100),
  description: z.string().min(5).max(500),
  weight: z.number().min(0).max(1),
});

export const AgentTypeScenarioSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1).max(100),
  description: z.string().min(5).max(500),
  examples: z.array(z.string()),
});

export const PerformanceThresholdsSchema = z.object({
  flagForTrainingBelow: z.number().min(0).max(100),
  excellentAbove: z.number().min(0).max(100),
  minSamplesForTrend: z.number().int().min(1),
});

export const AgentTypeTrainingConfigSchema = z.object({
  agentType: AgentDomainSchema,
  scoringCriteria: z.array(AgentTypeScoringCriterionSchema).min(1),
  scenarioTypes: z.array(AgentTypeScenarioSchema).min(1),
  performanceThresholds: PerformanceThresholdsSchema,
});

// ============================================================================
// API REQUEST SCHEMAS
// ============================================================================

/**
 * Request to get agent type configurations.
 * GET /api/training/agent-types?agentType=chat
 */
export const GetAgentTypeConfigsRequestSchema = z.object({
  agentType: AgentDomainSchema.optional(),
});

/**
 * Request to list Golden Masters by agent type.
 * GET /api/training/golden-masters?agentType=voice
 */
export const ListGoldenMastersByTypeRequestSchema = z.object({
  agentType: AgentDomainSchema,
});

/**
 * Request to create an initial Golden Master for an agent type.
 * POST /api/training/golden-masters
 */
export const CreateGoldenMasterByTypeRequestSchema = z.object({
  agentType: AgentDomainSchema,
  userId: z.string().min(1, 'User ID is required'),
});

/**
 * Request to trigger agent performance analysis.
 * POST /api/agent-performance/analyze
 */
export const AnalyzeAgentPerformanceRequestSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  period: z.string().min(1, 'Period is required'),
});

/**
 * Request to get agent performance data.
 * GET /api/agent-performance/[agentId]?period=last_30_days
 */
export const GetAgentPerformanceRequestSchema = z.object({
  agentId: z.string().min(1),
  period: z.string().default('last_30_days'),
});

/**
 * Request to list flagged sessions.
 * GET /api/agent-performance/flagged-sessions?agentType=voice
 */
export const ListFlaggedSessionsRequestSchema = z.object({
  agentType: AgentDomainSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

/**
 * Request to get swarm specialist performance.
 * GET /api/swarm/performance?period=last_30_days
 */
export const GetSwarmPerformanceRequestSchema = z.object({
  period: z.string().default('last_30_days'),
  managerId: z.string().optional(),
});

/**
 * Request to trigger improvement analysis for a specialist.
 * POST /api/swarm/improvement-requests
 */
export const CreateImprovementRequestSchema = z.object({
  specialistId: z.string().min(1, 'Specialist ID is required'),
  specialistName: z.string().min(1, 'Specialist name is required'),
});

/**
 * Request to review/apply an improvement request.
 * PUT /api/swarm/improvement-requests/[requestId]
 */
export const ReviewImprovementRequestSchema = z.object({
  action: z.enum(['approve', 'reject']),
  notes: z.string().optional(),
});

/**
 * Request to apply an approved improvement request.
 * POST /api/swarm/improvement-requests/[requestId]
 */
export const ApplyImprovementRequestSchema = z.object({
  action: z.literal('apply'),
});

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

export function validateAgentPerformanceEntry(data: unknown) {
  return AgentPerformanceEntrySchema.parse(data);
}

export function safeValidateAgentPerformanceEntry(data: unknown) {
  return AgentPerformanceEntrySchema.safeParse(data);
}

export function validateSpecialistImprovementRequest(data: unknown) {
  return SpecialistImprovementRequestSchema.parse(data);
}

export function safeValidateSpecialistImprovementRequest(data: unknown) {
  return SpecialistImprovementRequestSchema.safeParse(data);
}

export function validateAnalyzeAgentPerformanceRequest(data: unknown) {
  return AnalyzeAgentPerformanceRequestSchema.parse(data);
}

export function safeValidateAnalyzeAgentPerformanceRequest(data: unknown) {
  return AnalyzeAgentPerformanceRequestSchema.safeParse(data);
}

export function validateCreateGoldenMasterByTypeRequest(data: unknown) {
  return CreateGoldenMasterByTypeRequestSchema.parse(data);
}

export function safeValidateCreateGoldenMasterByTypeRequest(data: unknown) {
  return CreateGoldenMasterByTypeRequestSchema.safeParse(data);
}
