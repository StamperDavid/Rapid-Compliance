/**
 * Intelligence Module - Validation Schemas
 *
 * Zod schemas for validating all LLM responses and API inputs.
 * NO UNVALIDATED DATA enters the platform core.
 *
 * STRICT ZONE: Every external response must pass schema validation.
 *
 * @module lib/intelligence
 */

import { z } from 'zod';
import {
  IntelligenceError,
  IntelligenceErrorCode,
  type AgentConfig,
  type KnowledgeChunk,
  type LLMResponse,
  type OrchestrationRequest,
  type RetrievalRequest,
  type Result,
} from './types';

// ============================================================================
// ENUM SCHEMAS
// ============================================================================

export const AgentStatusSchema = z.enum([
  'idle',
  'thinking',
  'executing',
  'waiting_for_input',
  'completed',
  'failed',
  'timeout',
]);

export const AgentRoleSchema = z.enum([
  'orchestrator',
  'specialist',
  'analyst',
  'executor',
  'validator',
  'retriever',
]);

export const TaskTypeSchema = z.enum([
  'question_answering',
  'data_analysis',
  'content_generation',
  'lead_scoring',
  'email_drafting',
  'conversation_analysis',
  'recommendation',
  'action_execution',
  'knowledge_retrieval',
]);

export const KnowledgeContentTypeSchema = z.enum([
  'text',
  'markdown',
  'html',
  'pdf',
  'transcript',
  'email',
  'chat',
  'structured_data',
]);

export const KnowledgeSourceSchema = z.enum([
  'manual_upload',
  'web_scrape',
  'api_import',
  'email_sync',
  'crm_sync',
  'conversation',
  'generated',
]);

export const KnowledgeCategorySchema = z.enum([
  'product',
  'pricing',
  'competitor',
  'case_study',
  'faq',
  'process',
  'policy',
  'training',
  'template',
  'other',
]);

export const KnowledgeStatusSchema = z.enum([
  'pending',
  'processing',
  'indexed',
  'failed',
  'outdated',
]);

export const LLMRoleSchema = z.enum(['system', 'user', 'assistant', 'tool']);

export const FinishReasonSchema = z.enum([
  'stop',
  'length',
  'tool_calls',
  'content_filter',
]);

// ============================================================================
// COMMON SCHEMAS
// ============================================================================

export const OrganizationIdSchema = z.string().min(1).max(100);
export const WorkspaceIdSchema = z.string().min(1).max(100);
export const UserIdSchema = z.string().min(1).max(100);
export const DocumentIdSchema = z.string().min(1).max(200);

export const DateRangeSchema = z.object({
  start: z.date().optional(),
  end: z.date().optional(),
}).strict();

// ============================================================================
// LLM SCHEMAS - Critical for type safety
// ============================================================================

/**
 * LLM Message schema
 */
export const LLMMessageSchema = z.object({
  role: LLMRoleSchema,
  content: z.string(),
  name: z.string().optional(),
  toolCallId: z.string().optional(),
}).strict();

/**
 * LLM Usage schema
 */
export const LLMUsageSchema = z.object({
  promptTokens: z.number().int().nonnegative(),
  completionTokens: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
}).strict();

/**
 * LLM Tool Call schema
 */
export const LLMToolCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal('function'),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string(),
  }).strict(),
}).strict();

/**
 * LLM Response schema - CRITICAL: Validates all LLM outputs
 */
export const LLMResponseSchema = z.object({
  content: z.string(),
  finishReason: FinishReasonSchema,
  usage: LLMUsageSchema,
  toolCalls: z.array(LLMToolCallSchema).optional(),
}).strict();

/**
 * Raw LLM API response schema (OpenAI format)
 */
export const RawOpenAIResponseSchema = z.object({
  id: z.string(),
  object: z.string(),
  created: z.number(),
  model: z.string(),
  choices: z.array(z.object({
    index: z.number(),
    message: z.object({
      role: z.string(),
      content: z.string().nullable(),
      tool_calls: z.array(z.object({
        id: z.string(),
        type: z.literal('function'),
        function: z.object({
          name: z.string(),
          arguments: z.string(),
        }),
      })).optional(),
    }),
    finish_reason: z.string().nullable(),
  })),
  usage: z.object({
    prompt_tokens: z.number(),
    completion_tokens: z.number(),
    total_tokens: z.number(),
  }).optional(),
}).passthrough(); // Allow additional fields from API

/**
 * Raw LLM API response schema (Anthropic format)
 */
export const RawAnthropicResponseSchema = z.object({
  id: z.string(),
  type: z.literal('message'),
  role: z.literal('assistant'),
  content: z.array(z.object({
    type: z.string(),
    text: z.string().optional(),
  })),
  model: z.string(),
  stop_reason: z.string().nullable(),
  usage: z.object({
    input_tokens: z.number(),
    output_tokens: z.number(),
  }),
}).passthrough();

// ============================================================================
// AGENT SCHEMAS
// ============================================================================

/**
 * Reasoning step schema
 */
export const ReasoningStepSchema = z.object({
  id: z.string().min(1),
  timestamp: z.date(),
  thought: z.string().min(1),
  action: z.string().optional(),
  observation: z.string().optional(),
  confidence: z.number().min(0).max(100),
}).strict();

/**
 * Memory item schema
 */
export const MemoryItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(['user_input', 'agent_response', 'observation', 'tool_result']),
  content: z.string(),
  timestamp: z.date(),
  importance: z.number().min(0).max(100),
}).strict();

/**
 * Retry config schema
 */
export const RetryConfigSchema = z.object({
  maxRetries: z.number().int().min(0).max(10),
  baseDelayMs: z.number().int().min(100).max(60000),
  maxDelayMs: z.number().int().min(1000).max(300000),
  retryableErrors: z.array(z.string()),
}).strict();

/**
 * Agent config schema
 */
export const AgentConfigSchema = z.object({
  model: z.string().min(1),
  temperature: z.number().min(0).max(2),
  maxTokens: z.number().int().min(1).max(128000),
  maxReasoningSteps: z.number().int().min(1).max(50),
  timeoutMs: z.number().int().min(1000).max(600000),
  retryConfig: RetryConfigSchema,
}).strict();

/**
 * Task context schema
 */
export const TaskContextSchema = z.object({
  id: z.string().min(1),
  type: TaskTypeSchema,
  description: z.string().min(1),
  input: z.record(z.unknown()),
  expectedOutput: z.string().optional(),
  constraints: z.array(z.string()).optional(),
  deadline: z.date().optional(),
}).strict();

/**
 * Agent metrics schema
 */
export const AgentMetricsSchema = z.object({
  reasoningStepCount: z.number().int().nonnegative(),
  tokensUsed: z.number().int().nonnegative(),
  apiCallCount: z.number().int().nonnegative(),
  totalDurationMs: z.number().nonnegative(),
  llmLatencyMs: z.number().nonnegative(),
  retrievalLatencyMs: z.number().nonnegative(),
}).strict();

// ============================================================================
// KNOWLEDGE BASE SCHEMAS
// ============================================================================

/**
 * Chunk metadata schema
 */
export const ChunkMetadataSchema = z.object({
  documentTitle: z.string(),
  category: KnowledgeCategorySchema,
  source: KnowledgeSourceSchema,
  tags: z.array(z.string()),
  pageNumber: z.number().int().positive().optional(),
  sectionTitle: z.string().optional(),
  previousChunkId: z.string().optional(),
  nextChunkId: z.string().optional(),
}).strict();

/**
 * Knowledge chunk schema
 */
export const KnowledgeChunkSchema = z.object({
  id: z.string().min(1),
  documentId: z.string().min(1),
  content: z.string().min(1),
  tokens: z.number().int().nonnegative(),
  chunkIndex: z.number().int().nonnegative(),
  totalChunks: z.number().int().positive(),
  embedding: z.array(z.number()).optional(),
  embeddingModel: z.string().optional(),
  metadata: ChunkMetadataSchema,
  score: z.number().min(0).max(1).optional(),
  rank: z.number().int().positive().optional(),
}).strict();

/**
 * Knowledge base config schema
 */
export const KnowledgeBaseConfigSchema = z.object({
  embeddingModel: z.string().min(1),
  chunkSize: z.number().int().min(100).max(8000),
  chunkOverlap: z.number().int().min(0).max(500),
  maxDocuments: z.number().int().min(1).max(100000),
  maxChunksPerDocument: z.number().int().min(1).max(10000),
  similarityThreshold: z.number().min(0).max(1),
  reranking: z.boolean(),
  rerankingModel: z.string().optional(),
}).strict();

/**
 * Knowledge base stats schema
 */
export const KnowledgeBaseStatsSchema = z.object({
  documentCount: z.number().int().nonnegative(),
  chunkCount: z.number().int().nonnegative(),
  totalTokens: z.number().int().nonnegative(),
  avgDocumentSize: z.number().nonnegative(),
  categoryCounts: z.record(KnowledgeCategorySchema, z.number().int().nonnegative()),
  lastUpdated: z.date(),
}).strict();

// ============================================================================
// REQUEST SCHEMAS
// ============================================================================

/**
 * Retrieval filters schema
 */
export const RetrievalFiltersSchema = z.object({
  categories: z.array(KnowledgeCategorySchema).optional(),
  sources: z.array(KnowledgeSourceSchema).optional(),
  tags: z.array(z.string()).optional(),
  dateRange: DateRangeSchema.optional(),
  documentIds: z.array(DocumentIdSchema).optional(),
}).strict();

/**
 * Retrieval options schema
 */
export const RetrievalOptionsSchema = z.object({
  topK: z.number().int().min(1).max(100),
  minScore: z.number().min(0).max(1),
  includeMetadata: z.boolean(),
  rerank: z.boolean(),
  expandContext: z.boolean(),
}).strict();

/**
 * Retrieval request schema
 */
export const RetrievalRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema.optional(),
  query: z.string().min(1).max(10000),
  filters: RetrievalFiltersSchema.optional(),
  options: RetrievalOptionsSchema.optional(),
}).strict();

/**
 * Orchestration options schema
 */
export const OrchestrationOptionsSchema = z.object({
  maxAgents: z.number().int().min(1).max(20),
  maxReasoningSteps: z.number().int().min(1).max(50),
  timeoutMs: z.number().int().min(5000).max(600000),
  enableRAG: z.boolean(),
  enableTools: z.boolean(),
  streamResponse: z.boolean(),
}).strict();

/**
 * Orchestration request schema
 */
export const OrchestrationRequestSchema = z.object({
  workspaceId: WorkspaceIdSchema,
  userId: UserIdSchema,
  task: TaskContextSchema,
  conversationHistory: z.array(LLMMessageSchema).optional(),
  contextDocuments: z.array(DocumentIdSchema).optional(),
  options: OrchestrationOptionsSchema.optional(),
}).strict();

// ============================================================================
// RESPONSE SCHEMAS - For validating structured LLM outputs
// ============================================================================

/**
 * Schema for LLM-generated reasoning output
 */
export const LLMReasoningOutputSchema = z.object({
  thought: z.string().min(1),
  action: z.string().optional(),
  actionInput: z.record(z.unknown()).optional(),
  finalAnswer: z.string().optional(),
  confidence: z.number().min(0).max(100),
  needsMoreInfo: z.boolean().optional(),
}).strict();

/**
 * Schema for LLM-generated search queries
 */
export const LLMSearchQueryOutputSchema = z.object({
  queries: z.array(z.object({
    query: z.string().min(1),
    intent: z.string(),
    priority: z.number().min(1).max(10),
  })),
  reasoning: z.string(),
}).strict();

/**
 * Schema for LLM-generated summaries
 */
export const LLMSummaryOutputSchema = z.object({
  summary: z.string().min(1),
  keyPoints: z.array(z.string()),
  confidence: z.number().min(0).max(100),
  sourceChunks: z.array(z.string()).optional(),
}).strict();

/**
 * Schema for LLM-generated action plans
 */
export const LLMActionPlanOutputSchema = z.object({
  goal: z.string().min(1),
  steps: z.array(z.object({
    id: z.string(),
    action: z.string(),
    description: z.string(),
    dependencies: z.array(z.string()),
    estimatedTokens: z.number().int().optional(),
  })),
  reasoning: z.string(),
}).strict();

// ============================================================================
// VALIDATION FUNCTIONS
// ============================================================================

/**
 * Validation error details
 */
export interface ValidationErrorDetail {
  readonly path: string;
  readonly message: string;
  readonly code: string;
}

/**
 * Validation result
 */
export interface ValidationResult<T> {
  readonly success: boolean;
  readonly data?: T;
  readonly errors?: ReadonlyArray<ValidationErrorDetail>;
}

/**
 * Format Zod errors into a consistent structure
 */
function formatZodErrors(error: z.ZodError): ReadonlyArray<ValidationErrorDetail> {
  return error.errors.map((err) => ({
    path: err.path.join('.'),
    message: err.message,
    code: err.code,
  }));
}

/**
 * Validate LLM response with schema
 * Returns Result<T, IntelligenceError> for type-safe error handling
 */
export function validateLLMResponse(
  data: unknown
): Result<LLMResponse, IntelligenceError> {
  const result = LLMResponseSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: new IntelligenceError(
      `LLM response validation failed: ${result.error.message}`,
      IntelligenceErrorCode.LLM_RESPONSE_INVALID,
      400,
      { errors: formatZodErrors(result.error) }
    ),
    code: IntelligenceErrorCode.LLM_RESPONSE_INVALID,
  };
}

/**
 * Validate retrieval request
 */
export function validateRetrievalRequest(
  data: unknown
): Result<RetrievalRequest, IntelligenceError> {
  const result = RetrievalRequestSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: new IntelligenceError(
      `Retrieval request validation failed: ${result.error.message}`,
      IntelligenceErrorCode.INPUT_VALIDATION_FAILED,
      400,
      { errors: formatZodErrors(result.error) }
    ),
    code: IntelligenceErrorCode.INPUT_VALIDATION_FAILED,
  };
}

/**
 * Validate orchestration request
 */
export function validateOrchestrationRequest(
  data: unknown
): Result<OrchestrationRequest, IntelligenceError> {
  const result = OrchestrationRequestSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: new IntelligenceError(
      `Orchestration request validation failed: ${result.error.message}`,
      IntelligenceErrorCode.INPUT_VALIDATION_FAILED,
      400,
      { errors: formatZodErrors(result.error) }
    ),
    code: IntelligenceErrorCode.INPUT_VALIDATION_FAILED,
  };
}

/**
 * Validate agent config
 */
export function validateAgentConfig(
  data: unknown
): Result<AgentConfig, IntelligenceError> {
  const result = AgentConfigSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: new IntelligenceError(
      `Agent config validation failed: ${result.error.message}`,
      IntelligenceErrorCode.SCHEMA_VALIDATION_FAILED,
      400,
      { errors: formatZodErrors(result.error) }
    ),
    code: IntelligenceErrorCode.SCHEMA_VALIDATION_FAILED,
  };
}

/**
 * Validate knowledge chunk
 */
export function validateKnowledgeChunk(
  data: unknown
): Result<KnowledgeChunk, IntelligenceError> {
  const result = KnowledgeChunkSchema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: new IntelligenceError(
      `Knowledge chunk validation failed: ${result.error.message}`,
      IntelligenceErrorCode.SCHEMA_VALIDATION_FAILED,
      400,
      { errors: formatZodErrors(result.error) }
    ),
    code: IntelligenceErrorCode.SCHEMA_VALIDATION_FAILED,
  };
}

/**
 * Safe parse with formatted errors - generic version
 */
export function safeParseWithErrors<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): ValidationResult<T> {
  const result = schema.safeParse(data);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    errors: formatZodErrors(result.error),
  };
}

/**
 * Parse raw OpenAI response into normalized LLMResponse
 */
export function parseOpenAIResponse(
  rawResponse: unknown
): Result<LLMResponse, IntelligenceError> {
  const parseResult = RawOpenAIResponseSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    return {
      success: false,
      error: new IntelligenceError(
        `Invalid OpenAI response format: ${parseResult.error.message}`,
        IntelligenceErrorCode.LLM_RESPONSE_INVALID,
        400,
        { errors: formatZodErrors(parseResult.error) }
      ),
      code: IntelligenceErrorCode.LLM_RESPONSE_INVALID,
    };
  }

  const raw = parseResult.data;
  const choice = raw.choices[0];

  if (!choice) {
    return {
      success: false,
      error: new IntelligenceError(
        'No choices in OpenAI response',
        IntelligenceErrorCode.LLM_RESPONSE_INVALID,
        400
      ),
      code: IntelligenceErrorCode.LLM_RESPONSE_INVALID,
    };
  }

  const finishReason = (choice.finish_reason ?? 'stop') as LLMResponse['finishReason'];
  const usage = raw.usage ?? { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 };

  const normalizedResponse: LLMResponse = {
    content: choice.message.content ?? '',
    finishReason,
    usage: {
      promptTokens: usage.prompt_tokens,
      completionTokens: usage.completion_tokens,
      totalTokens: usage.total_tokens,
    },
    toolCalls: choice.message.tool_calls?.map((tc) => ({
      id: tc.id,
      type: tc.type,
      function: {
        name: tc.function.name,
        arguments: tc.function.arguments,
      },
    })),
  };

  return {
    success: true,
    data: normalizedResponse,
  };
}

/**
 * Parse raw Anthropic response into normalized LLMResponse
 */
export function parseAnthropicResponse(
  rawResponse: unknown
): Result<LLMResponse, IntelligenceError> {
  const parseResult = RawAnthropicResponseSchema.safeParse(rawResponse);

  if (!parseResult.success) {
    return {
      success: false,
      error: new IntelligenceError(
        `Invalid Anthropic response format: ${parseResult.error.message}`,
        IntelligenceErrorCode.LLM_RESPONSE_INVALID,
        400,
        { errors: formatZodErrors(parseResult.error) }
      ),
      code: IntelligenceErrorCode.LLM_RESPONSE_INVALID,
    };
  }

  const raw = parseResult.data;
  const textContent = raw.content.find((c) => c.type === 'text');

  const finishReason = (raw.stop_reason === 'end_turn' ? 'stop' : raw.stop_reason ?? 'stop') as LLMResponse['finishReason'];

  const normalizedResponse: LLMResponse = {
    content: textContent?.text ?? '',
    finishReason,
    usage: {
      promptTokens: raw.usage.input_tokens,
      completionTokens: raw.usage.output_tokens,
      totalTokens: raw.usage.input_tokens + raw.usage.output_tokens,
    },
  };

  return {
    success: true,
    data: normalizedResponse,
  };
}

/**
 * Validate structured LLM output (JSON mode)
 */
export function validateStructuredOutput<T>(
  schema: z.ZodSchema<T>,
  content: string,
  operationName: string
): Result<T, IntelligenceError> {
  let parsed: unknown;

  try {
    parsed = JSON.parse(content);
  } catch {
    return {
      success: false,
      error: new IntelligenceError(
        `Failed to parse LLM JSON output for ${operationName}`,
        IntelligenceErrorCode.LLM_RESPONSE_INVALID,
        400,
        { content: content.slice(0, 200) }
      ),
      code: IntelligenceErrorCode.LLM_RESPONSE_INVALID,
    };
  }

  const result = schema.safeParse(parsed);

  if (result.success) {
    return {
      success: true,
      data: result.data,
    };
  }

  return {
    success: false,
    error: new IntelligenceError(
      `Structured output validation failed for ${operationName}: ${result.error.message}`,
      IntelligenceErrorCode.SCHEMA_VALIDATION_FAILED,
      400,
      { errors: formatZodErrors(result.error) }
    ),
    code: IntelligenceErrorCode.SCHEMA_VALIDATION_FAILED,
  };
}
