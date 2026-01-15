/**
 * Intelligence Module - Public API
 *
 * Central exports for the AI orchestration layer and RAG architecture.
 *
 * USAGE:
 * ```typescript
 * import {
 *   getOrchestrator,
 *   getVectorStore,
 *   type AgentState,
 *   type KnowledgeChunk,
 *   type Result,
 * } from '@/lib/intelligence';
 *
 * // Orchestration
 * const orchestrator = getOrchestrator();
 * const result = await orchestrator.orchestrate(request);
 *
 * // Knowledge retrieval
 * const vectorStore = getVectorStore();
 * const chunks = await vectorStore.retrieve(query);
 * ```
 *
 * @module lib/intelligence
 */

// ============================================================================
// TYPES - Core interfaces and type definitions
// ============================================================================

export type {
  // Result pattern
  Result,
  SuccessResult,
  ErrorResult,
  ResultMetadata,

  // Agent types
  AgentState,
  AgentStatus,
  AgentRole,
  AgentConfig,
  AgentMetrics,
  AgentMemory,
  MemoryItem,
  ReasoningStep,
  RetryConfig,
  TaskContext,
  TaskType,

  // Knowledge types
  KnowledgeBase,
  KnowledgeBaseConfig,
  KnowledgeBaseStats,
  KnowledgeDocument,
  KnowledgeChunk,
  ChunkMetadata,
  KnowledgeContentType,
  KnowledgeSource,
  KnowledgeCategory,
  KnowledgeStatus,

  // Retrieval types
  RetrievalRequest,
  RetrievalResult,
  RetrievalFilters,
  RetrievalOptions,
  DateRange,

  // LLM types
  LLMRequest,
  LLMResponse,
  LLMMessage,
  LLMUsage,
  LLMToolCall,
  LLMTool,
  LLMFunction,
  LLMResponseFormat,

  // Orchestration types
  OrchestrationRequest,
  OrchestrationResult,
  OrchestrationOptions,
  OrchestrationMetrics,
} from './types';

export {
  // Error handling
  IntelligenceError,
  IntelligenceErrorCode,
  type IntelligenceErrorCodeType,

  // Default configurations
  DEFAULT_AGENT_CONFIG,
  DEFAULT_KNOWLEDGE_BASE_CONFIG,
  DEFAULT_RETRIEVAL_OPTIONS,
  DEFAULT_ORCHESTRATION_OPTIONS,
} from './types';

// ============================================================================
// VALIDATION - Zod schemas and validation functions
// ============================================================================

export {
  // Enum schemas
  AgentStatusSchema,
  AgentRoleSchema,
  TaskTypeSchema,
  KnowledgeContentTypeSchema,
  KnowledgeSourceSchema,
  KnowledgeCategorySchema,
  KnowledgeStatusSchema,
  LLMRoleSchema,
  FinishReasonSchema,

  // Common schemas
  OrganizationIdSchema,
  WorkspaceIdSchema,
  UserIdSchema,
  DocumentIdSchema,
  DateRangeSchema,

  // LLM schemas
  LLMMessageSchema,
  LLMUsageSchema,
  LLMToolCallSchema,
  LLMResponseSchema,
  RawOpenAIResponseSchema,
  RawAnthropicResponseSchema,

  // Agent schemas
  ReasoningStepSchema,
  MemoryItemSchema,
  RetryConfigSchema,
  AgentConfigSchema,
  TaskContextSchema,
  AgentMetricsSchema,

  // Knowledge schemas
  ChunkMetadataSchema,
  KnowledgeChunkSchema,
  KnowledgeBaseConfigSchema,
  KnowledgeBaseStatsSchema,

  // Request schemas
  RetrievalFiltersSchema,
  RetrievalOptionsSchema,
  RetrievalRequestSchema,
  OrchestrationOptionsSchema,
  OrchestrationRequestSchema,

  // LLM output schemas
  LLMReasoningOutputSchema,
  LLMSearchQueryOutputSchema,
  LLMSummaryOutputSchema,
  LLMActionPlanOutputSchema,

  // Validation functions
  validateLLMResponse,
  validateRetrievalRequest,
  validateOrchestrationRequest,
  validateAgentConfig,
  validateKnowledgeChunk,
  safeParseWithErrors,
  parseOpenAIResponse,
  parseAnthropicResponse,
  validateStructuredOutput,

  // Validation types
  type ValidationResult,
  type ValidationErrorDetail,
} from './validation';

// ============================================================================
// ORCHESTRATOR - The Brain
// ============================================================================

export {
  // Main class
  IntelligenceOrchestrator,
  type OrchestratorConfig,
  DEFAULT_ORCHESTRATOR_CONFIG,

  // Singleton
  getOrchestrator,
  resetOrchestrator,

  // State management utilities
  createInitialAgentState,
  updateAgentStatus,
  addReasoningStep,
  updateAgentMetrics,
  addMemoryItem,
  updateRelevantKnowledge,
  isAgentTimedOut,
  withTimeout,
} from './orchestrator';

// ============================================================================
// VECTOR STORE - The Memory
// ============================================================================

export {
  // Main class
  VectorStore,
  type VectorStoreConfig,
  DEFAULT_VECTOR_STORE_CONFIG,

  // Singleton
  getVectorStore,
  resetVectorStore,

  // Utility functions
  chunkText,
  splitBySize,
  estimateTokens,
  cosineSimilarity,
  type ChunkingOptions,
  type EmbeddingProvider,
} from './vector-store';
