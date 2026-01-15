/**
 * Intelligence Module - Type Definitions
 *
 * Core types for the AI orchestration layer and RAG architecture.
 * Defines strict interfaces for agent state management, knowledge retrieval,
 * and type-safe error handling patterns.
 *
 * STRICT ZONE: Zero tolerance for type violations.
 * - No `any` types
 * - All LLM responses validated via Zod
 * - Result pattern for error handling
 *
 * @module lib/intelligence
 */

import type { Timestamp } from 'firebase/firestore';

// ============================================================================
// RESULT PATTERN - Type-Safe Error Handling
// ============================================================================

/**
 * Success result wrapper
 */
export interface SuccessResult<T> {
  readonly success: true;
  readonly data: T;
  readonly metadata?: ResultMetadata;
}

/**
 * Error result wrapper
 */
export interface ErrorResult<E extends Error = Error> {
  readonly success: false;
  readonly error: E;
  readonly code: string;
  readonly metadata?: ResultMetadata;
}

/**
 * Result type - Union of success and error states
 * Use this for all fallible operations instead of throwing
 */
export type Result<T, E extends Error = Error> = SuccessResult<T> | ErrorResult<E>;

/**
 * Metadata attached to results for debugging/telemetry
 */
export interface ResultMetadata {
  readonly timestamp: Date;
  readonly durationMs?: number;
  readonly requestId?: string;
  readonly retryCount?: number;
}

// ============================================================================
// INTELLIGENCE ERRORS
// ============================================================================

/**
 * Base error class for intelligence module operations
 */
export class IntelligenceError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 500,
    public readonly context?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'IntelligenceError';
    Object.setPrototypeOf(this, IntelligenceError.prototype);
  }
}

/**
 * Error codes for intelligence operations
 */
export const IntelligenceErrorCode = {
  // Orchestrator errors
  ORCHESTRATION_FAILED: 'ORCHESTRATION_FAILED',
  AGENT_TIMEOUT: 'AGENT_TIMEOUT',
  AGENT_STATE_INVALID: 'AGENT_STATE_INVALID',
  REASONING_LOOP_EXCEEDED: 'REASONING_LOOP_EXCEEDED',

  // Vector store errors
  EMBEDDING_FAILED: 'EMBEDDING_FAILED',
  VECTOR_SEARCH_FAILED: 'VECTOR_SEARCH_FAILED',
  KNOWLEDGE_NOT_FOUND: 'KNOWLEDGE_NOT_FOUND',
  INDEX_CORRUPTED: 'INDEX_CORRUPTED',

  // LLM errors
  LLM_RESPONSE_INVALID: 'LLM_RESPONSE_INVALID',
  LLM_TIMEOUT: 'LLM_TIMEOUT',
  LLM_RATE_LIMITED: 'LLM_RATE_LIMITED',
  LLM_CONTEXT_OVERFLOW: 'LLM_CONTEXT_OVERFLOW',

  // Validation errors
  SCHEMA_VALIDATION_FAILED: 'SCHEMA_VALIDATION_FAILED',
  INPUT_VALIDATION_FAILED: 'INPUT_VALIDATION_FAILED',
} as const;

export type IntelligenceErrorCodeType = typeof IntelligenceErrorCode[keyof typeof IntelligenceErrorCode];

// ============================================================================
// AGENT STATE
// ============================================================================

/**
 * Agent execution state
 */
export type AgentStatus =
  | 'idle'
  | 'thinking'
  | 'executing'
  | 'waiting_for_input'
  | 'completed'
  | 'failed'
  | 'timeout';

/**
 * Agent role in the orchestration hierarchy
 */
export type AgentRole =
  | 'orchestrator'      // Top-level coordinator
  | 'specialist'        // Domain-specific agent
  | 'analyst'           // Data analysis agent
  | 'executor'          // Action execution agent
  | 'validator'         // Quality assurance agent
  | 'retriever';        // RAG retrieval agent

/**
 * Reasoning step in the agent's thought process
 */
export interface ReasoningStep {
  readonly id: string;
  readonly timestamp: Date;
  readonly thought: string;
  readonly action?: string;
  readonly observation?: string;
  readonly confidence: number; // 0-100
}

/**
 * Agent memory context
 */
export interface AgentMemory {
  readonly shortTerm: ReadonlyArray<MemoryItem>;
  readonly workingContext: Record<string, unknown>;
  readonly relevantKnowledge: ReadonlyArray<KnowledgeChunk>;
}

/**
 * Memory item in agent's short-term memory
 */
export interface MemoryItem {
  readonly id: string;
  readonly type: 'user_input' | 'agent_response' | 'observation' | 'tool_result';
  readonly content: string;
  readonly timestamp: Date;
  readonly importance: number; // 0-100
}

/**
 * Core agent state interface
 * Represents the complete state of an agent at any point in time
 */
export interface AgentState {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string;

  // Identity
  readonly role: AgentRole;
  readonly name: string;
  readonly description: string;

  // Current status
  readonly status: AgentStatus;
  readonly statusMessage?: string;

  // Execution context
  readonly currentTask?: TaskContext;
  readonly reasoningSteps: ReadonlyArray<ReasoningStep>;
  readonly memory: AgentMemory;

  // Metrics
  readonly metrics: AgentMetrics;

  // Timing
  readonly startedAt: Date;
  readonly lastActivityAt: Date;
  readonly timeoutAt?: Date;

  // Parent/child relationships
  readonly parentAgentId?: string;
  readonly childAgentIds: ReadonlyArray<string>;

  // Configuration
  readonly config: AgentConfig;
}

/**
 * Agent execution metrics
 */
export interface AgentMetrics {
  readonly reasoningStepCount: number;
  readonly tokensUsed: number;
  readonly apiCallCount: number;
  readonly totalDurationMs: number;
  readonly llmLatencyMs: number;
  readonly retrievalLatencyMs: number;
}

/**
 * Agent configuration
 */
export interface AgentConfig {
  readonly model: string;
  readonly temperature: number;
  readonly maxTokens: number;
  readonly maxReasoningSteps: number;
  readonly timeoutMs: number;
  readonly retryConfig: RetryConfig;
}

/**
 * Retry configuration for agent operations
 */
export interface RetryConfig {
  readonly maxRetries: number;
  readonly baseDelayMs: number;
  readonly maxDelayMs: number;
  readonly retryableErrors: ReadonlyArray<string>;
}

/**
 * Task context for agent execution
 */
export interface TaskContext {
  readonly id: string;
  readonly type: TaskType;
  readonly description: string;
  readonly input: Record<string, unknown>;
  readonly expectedOutput?: string;
  readonly constraints?: ReadonlyArray<string>;
  readonly deadline?: Date;
}

/**
 * Task types supported by agents
 */
export type TaskType =
  | 'question_answering'
  | 'data_analysis'
  | 'content_generation'
  | 'lead_scoring'
  | 'email_drafting'
  | 'conversation_analysis'
  | 'recommendation'
  | 'action_execution'
  | 'knowledge_retrieval';

// ============================================================================
// KNOWLEDGE BASE
// ============================================================================

/**
 * Document stored in the knowledge base
 */
export interface KnowledgeDocument {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId: string;

  // Content
  readonly title: string;
  readonly content: string;
  readonly contentType: KnowledgeContentType;
  readonly summary?: string;

  // Metadata
  readonly source: KnowledgeSource;
  readonly sourceUrl?: string;
  readonly author?: string;
  readonly tags: ReadonlyArray<string>;
  readonly category: KnowledgeCategory;

  // Processing status
  readonly status: KnowledgeStatus;
  readonly chunkCount: number;
  readonly totalTokens: number;

  // Timestamps
  readonly createdAt: Date | Timestamp;
  readonly updatedAt: Date | Timestamp;
  readonly indexedAt?: Date | Timestamp;
  readonly lastAccessedAt?: Date | Timestamp;

  // Access control
  readonly visibility: 'public' | 'organization' | 'workspace' | 'private';
  readonly accessRoles?: ReadonlyArray<string>;
}

/**
 * Content types for knowledge documents
 */
export type KnowledgeContentType =
  | 'text'
  | 'markdown'
  | 'html'
  | 'pdf'
  | 'transcript'
  | 'email'
  | 'chat'
  | 'structured_data';

/**
 * Knowledge sources
 */
export type KnowledgeSource =
  | 'manual_upload'
  | 'web_scrape'
  | 'api_import'
  | 'email_sync'
  | 'crm_sync'
  | 'conversation'
  | 'generated';

/**
 * Knowledge categories
 */
export type KnowledgeCategory =
  | 'product'
  | 'pricing'
  | 'competitor'
  | 'case_study'
  | 'faq'
  | 'process'
  | 'policy'
  | 'training'
  | 'template'
  | 'other';

/**
 * Knowledge processing status
 */
export type KnowledgeStatus =
  | 'pending'
  | 'processing'
  | 'indexed'
  | 'failed'
  | 'outdated';

/**
 * Chunk of knowledge extracted from a document
 */
export interface KnowledgeChunk {
  readonly id: string;
  readonly documentId: string;
  readonly organizationId: string;

  // Content
  readonly content: string;
  readonly tokens: number;
  readonly chunkIndex: number;
  readonly totalChunks: number;

  // Embedding
  readonly embedding?: ReadonlyArray<number>;
  readonly embeddingModel?: string;

  // Context
  readonly metadata: ChunkMetadata;

  // Search relevance (populated during retrieval)
  readonly score?: number;
  readonly rank?: number;
}

/**
 * Metadata for knowledge chunks
 */
export interface ChunkMetadata {
  readonly documentTitle: string;
  readonly category: KnowledgeCategory;
  readonly source: KnowledgeSource;
  readonly tags: ReadonlyArray<string>;
  readonly pageNumber?: number;
  readonly sectionTitle?: string;
  readonly previousChunkId?: string;
  readonly nextChunkId?: string;
}

/**
 * Main knowledge base interface
 */
export interface KnowledgeBase {
  readonly id: string;
  readonly organizationId: string;
  readonly workspaceId?: string;

  // Configuration
  readonly name: string;
  readonly description: string;
  readonly config: KnowledgeBaseConfig;

  // Statistics
  readonly stats: KnowledgeBaseStats;

  // Status
  readonly status: 'active' | 'building' | 'error' | 'maintenance';
  readonly lastSyncAt?: Date | Timestamp;

  // Timestamps
  readonly createdAt: Date | Timestamp;
  readonly updatedAt: Date | Timestamp;
}

/**
 * Knowledge base configuration
 */
export interface KnowledgeBaseConfig {
  readonly embeddingModel: string;
  readonly chunkSize: number;
  readonly chunkOverlap: number;
  readonly maxDocuments: number;
  readonly maxChunksPerDocument: number;
  readonly similarityThreshold: number;
  readonly reranking: boolean;
  readonly rerankingModel?: string;
}

/**
 * Knowledge base statistics
 */
export interface KnowledgeBaseStats {
  readonly documentCount: number;
  readonly chunkCount: number;
  readonly totalTokens: number;
  readonly avgDocumentSize: number;
  readonly categoryCounts: Record<KnowledgeCategory, number>;
  readonly lastUpdated: Date;
}

// ============================================================================
// RETRIEVAL TYPES
// ============================================================================

/**
 * Request for knowledge retrieval
 */
export interface RetrievalRequest {
  readonly organizationId: string;
  readonly workspaceId?: string;
  readonly query: string;
  readonly filters?: RetrievalFilters;
  readonly options?: RetrievalOptions;
}

/**
 * Filters for knowledge retrieval
 */
export interface RetrievalFilters {
  readonly categories?: ReadonlyArray<KnowledgeCategory>;
  readonly sources?: ReadonlyArray<KnowledgeSource>;
  readonly tags?: ReadonlyArray<string>;
  readonly dateRange?: DateRange;
  readonly documentIds?: ReadonlyArray<string>;
}

/**
 * Date range filter
 */
export interface DateRange {
  readonly start?: Date;
  readonly end?: Date;
}

/**
 * Options for retrieval
 */
export interface RetrievalOptions {
  readonly topK: number;
  readonly minScore: number;
  readonly includeMetadata: boolean;
  readonly rerank: boolean;
  readonly expandContext: boolean;
}

/**
 * Result of knowledge retrieval
 */
export interface RetrievalResult {
  readonly chunks: ReadonlyArray<KnowledgeChunk>;
  readonly totalMatches: number;
  readonly queryEmbedding?: ReadonlyArray<number>;
  readonly processingTimeMs: number;
  readonly tokensUsed: number;
}

// ============================================================================
// LLM TYPES
// ============================================================================

/**
 * LLM request for the orchestrator
 */
export interface LLMRequest {
  readonly model: string;
  readonly messages: ReadonlyArray<LLMMessage>;
  readonly systemPrompt?: string;
  readonly temperature?: number;
  readonly maxTokens?: number;
  readonly stopSequences?: ReadonlyArray<string>;
  readonly responseFormat?: LLMResponseFormat;
  readonly tools?: ReadonlyArray<LLMTool>;
}

/**
 * LLM message
 */
export interface LLMMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly name?: string;
  readonly toolCallId?: string;
}

/**
 * LLM response format
 */
export interface LLMResponseFormat {
  readonly type: 'text' | 'json_object';
  readonly schema?: Record<string, unknown>;
}

/**
 * LLM tool definition
 */
export interface LLMTool {
  readonly type: 'function';
  readonly function: LLMFunction;
}

/**
 * LLM function definition
 */
export interface LLMFunction {
  readonly name: string;
  readonly description: string;
  readonly parameters: Record<string, unknown>;
}

/**
 * Validated LLM response
 */
export interface LLMResponse {
  readonly content: string;
  readonly finishReason: 'stop' | 'length' | 'tool_calls' | 'content_filter';
  readonly usage: LLMUsage;
  readonly toolCalls?: ReadonlyArray<LLMToolCall>;
}

/**
 * LLM usage statistics
 */
export interface LLMUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * LLM tool call
 */
export interface LLMToolCall {
  readonly id: string;
  readonly type: 'function';
  readonly function: {
    readonly name: string;
    readonly arguments: string;
  };
}

// ============================================================================
// ORCHESTRATION TYPES
// ============================================================================

/**
 * Orchestration request
 */
export interface OrchestrationRequest {
  readonly organizationId: string;
  readonly workspaceId: string;
  readonly userId: string;

  // Task
  readonly task: TaskContext;

  // Context
  readonly conversationHistory?: ReadonlyArray<LLMMessage>;
  readonly contextDocuments?: ReadonlyArray<string>;

  // Options
  readonly options?: OrchestrationOptions;
}

/**
 * Orchestration options
 */
export interface OrchestrationOptions {
  readonly maxAgents: number;
  readonly maxReasoningSteps: number;
  readonly timeoutMs: number;
  readonly enableRAG: boolean;
  readonly enableTools: boolean;
  readonly streamResponse: boolean;
}

/**
 * Orchestration result
 */
export interface OrchestrationResult {
  readonly success: boolean;
  readonly response: string;
  readonly agentStates: ReadonlyArray<AgentState>;
  readonly retrievedKnowledge: ReadonlyArray<KnowledgeChunk>;
  readonly metrics: OrchestrationMetrics;
  readonly traceId: string;
}

/**
 * Orchestration metrics
 */
export interface OrchestrationMetrics {
  readonly totalDurationMs: number;
  readonly llmDurationMs: number;
  readonly retrievalDurationMs: number;
  readonly agentCount: number;
  readonly reasoningStepCount: number;
  readonly totalTokensUsed: number;
  readonly retrievedChunkCount: number;
}

// ============================================================================
// DEFAULT CONFIGURATIONS
// ============================================================================

/**
 * Default agent configuration
 */
export const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: 'gpt-4o',
  temperature: 0.7,
  maxTokens: 4000,
  maxReasoningSteps: 10,
  timeoutMs: 60000, // 60 seconds
  retryConfig: {
    maxRetries: 3,
    baseDelayMs: 1000,
    maxDelayMs: 10000,
    retryableErrors: ['ETIMEDOUT', 'ECONNRESET', 'rate_limit', '429', '500', '502', '503'],
  },
};

/**
 * Default knowledge base configuration
 */
export const DEFAULT_KNOWLEDGE_BASE_CONFIG: KnowledgeBaseConfig = {
  embeddingModel: 'text-embedding-3-small',
  chunkSize: 512,
  chunkOverlap: 50,
  maxDocuments: 10000,
  maxChunksPerDocument: 1000,
  similarityThreshold: 0.7,
  reranking: true,
  rerankingModel: 'cohere-rerank-v3',
};

/**
 * Default retrieval options
 */
export const DEFAULT_RETRIEVAL_OPTIONS: RetrievalOptions = {
  topK: 5,
  minScore: 0.6,
  includeMetadata: true,
  rerank: true,
  expandContext: true,
};

/**
 * Default orchestration options
 */
export const DEFAULT_ORCHESTRATION_OPTIONS: OrchestrationOptions = {
  maxAgents: 5,
  maxReasoningSteps: 10,
  timeoutMs: 120000, // 2 minutes
  enableRAG: true,
  enableTools: true,
  streamResponse: false,
};
