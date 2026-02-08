/**
 * Intelligence Orchestrator - The Brain
 *
 * Central coordination layer for AI agent orchestration.
 * Manages agent state, reasoning loops, and knowledge retrieval integration.
 *
 * STRICT ZONE COMPLIANCE:
 * - Zero `any` types
 * - All LLM responses validated via Zod
 * - Result<T, E> pattern for error handling
 * - void pattern for background telemetry
 * - Explicit timeout handling for all AI operations
 *
 * @module lib/intelligence
 */

import { logger } from '@/lib/logger/logger';
import { retryWithBackoff, LLMRetryOptions } from '@/lib/utils/retry';
import {
  DEFAULT_AGENT_CONFIG,
  DEFAULT_ORCHESTRATION_OPTIONS,
  IntelligenceError,
  IntelligenceErrorCode,
  type AgentConfig,
  type AgentMetrics,
  type AgentRole,
  type AgentState,
  type AgentStatus,
  type KnowledgeChunk,
  type LLMMessage,
  type LLMRequest,
  type LLMResponse,
  type MemoryItem,
  type OrchestrationMetrics,
  type OrchestrationOptions,
  type OrchestrationResult,
  type ReasoningStep,
  type Result,
  type TaskContext,
} from './types';
import {
  validateOrchestrationRequest,
  validateStructuredOutput,
  LLMReasoningOutputSchema,
  parseOpenAIResponse,
} from './validation';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// RESULT HELPERS
// ============================================================================

/**
 * Create a success result
 */
function success<T>(data: T): Result<T, IntelligenceError> {
  return { success: true, data };
}

/**
 * Create an error result
 */
function failure(
  message: string,
  code: string,
  statusCode = 500,
  context?: Record<string, unknown>
): Result<never, IntelligenceError> {
  return {
    success: false,
    error: new IntelligenceError(message, code, statusCode, context),
    code,
  };
}

// ============================================================================
// AGENT STATE FACTORY
// ============================================================================

/**
 * Create initial agent state
 */
function createInitialAgentState(
  workspaceId: string,
  role: AgentRole,
  task: TaskContext,
  config: AgentConfig = DEFAULT_AGENT_CONFIG
): AgentState {
  const now = new Date();
  const timeoutAt = new Date(now.getTime() + config.timeoutMs);

  return {
    id: `agent_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`,
    workspaceId,
    role,
    name: `${role}_agent`,
    description: `Agent handling ${task.type}`,
    status: 'idle',
    currentTask: task,
    reasoningSteps: [],
    memory: {
      shortTerm: [],
      workingContext: {},
      relevantKnowledge: [],
    },
    metrics: createInitialMetrics(),
    startedAt: now,
    lastActivityAt: now,
    timeoutAt,
    childAgentIds: [],
    config,
  };
}

/**
 * Create initial metrics
 */
function createInitialMetrics(): AgentMetrics {
  return {
    reasoningStepCount: 0,
    tokensUsed: 0,
    apiCallCount: 0,
    totalDurationMs: 0,
    llmLatencyMs: 0,
    retrievalLatencyMs: 0,
  };
}

// ============================================================================
// AGENT STATE MANAGEMENT
// ============================================================================

/**
 * Update agent status
 */
function updateAgentStatus(
  state: AgentState,
  status: AgentStatus,
  message?: string
): AgentState {
  return {
    ...state,
    status,
    statusMessage: message,
    lastActivityAt: new Date(),
  };
}

/**
 * Add reasoning step to agent state
 */
function addReasoningStep(
  state: AgentState,
  step: Omit<ReasoningStep, 'id' | 'timestamp'>
): AgentState {
  const newStep: ReasoningStep = {
    ...step,
    id: `step_${state.reasoningSteps.length + 1}`,
    timestamp: new Date(),
  };

  return {
    ...state,
    reasoningSteps: [...state.reasoningSteps, newStep],
    lastActivityAt: new Date(),
    metrics: {
      ...state.metrics,
      reasoningStepCount: state.metrics.reasoningStepCount + 1,
    },
  };
}

/**
 * Update agent metrics
 */
function updateAgentMetrics(
  state: AgentState,
  updates: Partial<AgentMetrics>
): AgentState {
  return {
    ...state,
    metrics: {
      ...state.metrics,
      ...updates,
    },
    lastActivityAt: new Date(),
  };
}

/**
 * Add memory item to agent
 */
function addMemoryItem(
  state: AgentState,
  item: Omit<MemoryItem, 'id' | 'timestamp'>
): AgentState {
  const newItem: MemoryItem = {
    ...item,
    id: `mem_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    timestamp: new Date(),
  };

  return {
    ...state,
    memory: {
      ...state.memory,
      shortTerm: [...state.memory.shortTerm, newItem],
    },
    lastActivityAt: new Date(),
  };
}

/**
 * Update agent memory with retrieved knowledge
 */
function updateRelevantKnowledge(
  state: AgentState,
  knowledge: ReadonlyArray<KnowledgeChunk>
): AgentState {
  return {
    ...state,
    memory: {
      ...state.memory,
      relevantKnowledge: knowledge,
    },
    lastActivityAt: new Date(),
  };
}

// ============================================================================
// TIMEOUT HANDLING
// ============================================================================

/**
 * Check if agent has timed out
 */
function isAgentTimedOut(state: AgentState): boolean {
  if (!state.timeoutAt) {
    return false;
  }
  return new Date() > state.timeoutAt;
}

/**
 * Create a promise that rejects after timeout
 */
function createTimeoutPromise(
  timeoutMs: number,
  operationName: string
): Promise<never> {
  return new Promise((_, reject) => {
    setTimeout(() => {
      reject(
        new IntelligenceError(
          `Operation "${operationName}" timed out after ${timeoutMs}ms`,
          IntelligenceErrorCode.AGENT_TIMEOUT,
          408,
          { timeoutMs, operationName }
        )
      );
    }, timeoutMs);
  });
}

/**
 * Execute operation with timeout
 */
async function withTimeout<T>(
  operation: Promise<T>,
  timeoutMs: number,
  operationName: string
): Promise<Result<T, IntelligenceError>> {
  try {
    const result = await Promise.race([
      operation,
      createTimeoutPromise(timeoutMs, operationName),
    ]);
    return success(result);
  } catch (error) {
    if (error instanceof IntelligenceError) {
      return {
        success: false,
        error,
        code: error.code,
      };
    }
    return failure(
      `Operation "${operationName}" failed: ${error instanceof Error ? error.message : String(error)}`,
      IntelligenceErrorCode.ORCHESTRATION_FAILED,
      500,
      { operationName }
    );
  }
}

// ============================================================================
// LLM INTEGRATION
// ============================================================================

/**
 * LLM provider interface (to be implemented with actual provider)
 */
interface LLMProvider {
  chat(request: LLMRequest): Promise<unknown>;
}

/**
 * Mock LLM provider for development/testing
 * Replace with actual UnifiedAI integration
 */
const mockLLMProvider: LLMProvider = {
  async chat(_request: LLMRequest): Promise<unknown> {
    // Simulate LLM latency
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 100);
    });

    return {
      id: `chatcmpl_${Date.now()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-4o',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: JSON.stringify({
              thought: 'Analyzing the request to determine the best approach.',
              confidence: 85,
              needsMoreInfo: false,
            }),
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: 100,
        completion_tokens: 50,
        total_tokens: 150,
      },
    };
  },
};

/**
 * Call LLM with validation and retry logic
 */
async function callLLM(
  provider: LLMProvider,
  request: LLMRequest,
  timeoutMs: number
): Promise<Result<LLMResponse, IntelligenceError>> {
  const startTime = Date.now();

  try {
    const rawResponse = await retryWithBackoff(
      async () => {
        const response = await withTimeout(
          provider.chat(request),
          timeoutMs,
          'LLM_CALL'
        );

        if (!response.success) {
          throw response.error;
        }

        return response.data;
      },
      {
        ...LLMRetryOptions,
        operationName: 'LLM call',
      }
    );

    // Validate and normalize response
    const parseResult = parseOpenAIResponse(rawResponse);

    if (!parseResult.success) {
      return parseResult;
    }

    const duration = Date.now() - startTime;
    logger.info('LLM call completed', {
      model: request.model,
      durationMs: duration,
      tokens: parseResult.data.usage.totalTokens,
    });

    return parseResult;
  } catch (error) {
    const duration = Date.now() - startTime;
    logger.error('LLM call failed', error instanceof Error ? error : new Error(String(error)), {
      model: request.model,
      durationMs: duration,
    });

    if (error instanceof IntelligenceError) {
      return {
        success: false,
        error,
        code: error.code,
      };
    }

    return failure(
      `LLM call failed: ${error instanceof Error ? error.message : String(error)}`,
      IntelligenceErrorCode.ORCHESTRATION_FAILED,
      500
    );
  }
}

// ============================================================================
// REASONING LOOP
// ============================================================================

/**
 * Execute a single reasoning step
 */
async function executeReasoningStep(
  state: AgentState,
  provider: LLMProvider
): Promise<Result<{ state: AgentState; isComplete: boolean }, IntelligenceError>> {
  // Check timeout
  if (isAgentTimedOut(state)) {
    return failure(
      'Agent timed out during reasoning',
      IntelligenceErrorCode.AGENT_TIMEOUT,
      408,
      { agentId: state.id, stepCount: state.metrics.reasoningStepCount }
    );
  }

  // Check reasoning step limit
  if (state.metrics.reasoningStepCount >= state.config.maxReasoningSteps) {
    return failure(
      `Reasoning loop exceeded maximum steps (${state.config.maxReasoningSteps})`,
      IntelligenceErrorCode.REASONING_LOOP_EXCEEDED,
      400,
      { maxSteps: state.config.maxReasoningSteps }
    );
  }

  // Build messages for LLM
  const messages: LLMMessage[] = buildReasoningMessages(state);

  const llmRequest: LLMRequest = {
    model: state.config.model,
    messages,
    temperature: state.config.temperature,
    maxTokens: state.config.maxTokens,
    responseFormat: { type: 'json_object' },
  };

  // Call LLM
  const startTime = Date.now();
  const llmResult = await callLLM(provider, llmRequest, state.config.timeoutMs);

  if (!llmResult.success) {
    return {
      success: false,
      error: llmResult.error,
      code: llmResult.error.code,
    };
  }

  const llmDuration = Date.now() - startTime;

  // Validate structured output
  const outputResult = validateStructuredOutput(
    LLMReasoningOutputSchema,
    llmResult.data.content,
    'reasoning_step'
  );

  if (!outputResult.success) {
    return {
      success: false,
      error: outputResult.error,
      code: outputResult.error.code,
    };
  }

  const output = outputResult.data;

  // Update state with reasoning step
  let updatedState = addReasoningStep(state, {
    thought: output.thought,
    action: output.action,
    confidence: output.confidence,
  });

  // Update metrics
  updatedState = updateAgentMetrics(updatedState, {
    tokensUsed: updatedState.metrics.tokensUsed + llmResult.data.usage.totalTokens,
    apiCallCount: updatedState.metrics.apiCallCount + 1,
    llmLatencyMs: updatedState.metrics.llmLatencyMs + llmDuration,
  });

  // Check if reasoning is complete
  const isComplete = output.finalAnswer !== undefined && output.finalAnswer !== '';

  return success({ state: updatedState, isComplete });
}

/**
 * Build messages for reasoning step
 */
function buildReasoningMessages(state: AgentState): LLMMessage[] {
  const messages: LLMMessage[] = [];

  // System message
  messages.push({
    role: 'system',
    content: buildSystemPrompt(state),
  });

  // Add memory context
  for (const item of state.memory.shortTerm.slice(-10)) {
    messages.push({
      role: item.type === 'user_input' ? 'user' : 'assistant',
      content: item.content,
    });
  }

  // Add knowledge context if available
  if (state.memory.relevantKnowledge.length > 0) {
    const knowledgeContext = state.memory.relevantKnowledge
      .map((chunk) => `[${chunk.metadata.documentTitle}]: ${chunk.content}`)
      .join('\n\n');

    messages.push({
      role: 'system',
      content: `Relevant knowledge:\n${knowledgeContext}`,
    });
  }

  // Add previous reasoning steps
  for (const step of state.reasoningSteps) {
    messages.push({
      role: 'assistant',
      content: JSON.stringify({
        thought: step.thought,
        action: step.action,
        observation: step.observation,
        confidence: step.confidence,
      }),
    });
  }

  // Current task
  if (state.currentTask) {
    messages.push({
      role: 'user',
      content: `Task: ${state.currentTask.description}\nInput: ${JSON.stringify(state.currentTask.input)}`,
    });
  }

  return messages;
}

/**
 * Build system prompt for agent
 */
function buildSystemPrompt(state: AgentState): string {
  return `You are an AI agent with role: ${state.role}.
Your task is to reason step by step and provide structured responses.

RULES:
1. Think carefully before acting
2. Break down complex tasks into steps
3. Validate your reasoning at each step
4. Provide confidence scores (0-100) for your conclusions
5. When you have a final answer, include it in the "finalAnswer" field

OUTPUT FORMAT (JSON):
{
  "thought": "Your current reasoning",
  "action": "Optional action to take",
  "actionInput": {},
  "finalAnswer": "Your final answer when complete",
  "confidence": 85,
  "needsMoreInfo": false
}

Current context:
- Organization: ${PLATFORM_ID}
- Workspace: ${state.workspaceId}
- Previous steps: ${state.reasoningSteps.length}
- Available knowledge chunks: ${state.memory.relevantKnowledge.length}`;
}

// ============================================================================
// MAIN ORCHESTRATION ENGINE
// ============================================================================

/**
 * Intelligence Orchestrator configuration
 */
export interface OrchestratorConfig {
  readonly defaultOptions: OrchestrationOptions;
  readonly llmProvider?: LLMProvider;
  readonly enableTelemetry: boolean;
}

/**
 * Default orchestrator configuration
 */
export const DEFAULT_ORCHESTRATOR_CONFIG: OrchestratorConfig = {
  defaultOptions: DEFAULT_ORCHESTRATION_OPTIONS,
  enableTelemetry: true,
};

/**
 * Intelligence Orchestrator - The Brain
 *
 * Coordinates AI agent execution, reasoning loops, and knowledge retrieval.
 */
export class IntelligenceOrchestrator {
  private readonly config: OrchestratorConfig;
  private readonly llmProvider: LLMProvider;
  private activeAgents: Map<string, AgentState> = new Map();

  constructor(config: Partial<OrchestratorConfig> = {}) {
    this.config = { ...DEFAULT_ORCHESTRATOR_CONFIG, ...config };
    this.llmProvider = config.llmProvider ?? mockLLMProvider;
  }

  /**
   * Execute orchestration request
   */
  async orchestrate(
    request: unknown
  ): Promise<Result<OrchestrationResult, IntelligenceError>> {
    const startTime = Date.now();
    const traceId = `trace_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    // Validate request
    const validationResult = validateOrchestrationRequest(request);
    if (!validationResult.success) {
      return validationResult;
    }

    const validatedRequest = validationResult.data;
    const options = { ...this.config.defaultOptions, ...validatedRequest.options };

    // Log orchestration start (void pattern for telemetry)
    void this.logTelemetry('orchestration_started', {
      traceId,
      taskType: validatedRequest.task.type,
    });

    // Create orchestrator agent
    let agentState = createInitialAgentState(
      validatedRequest.workspaceId,
      'orchestrator',
      validatedRequest.task,
      {
        ...DEFAULT_AGENT_CONFIG,
        maxReasoningSteps: options.maxReasoningSteps,
        timeoutMs: options.timeoutMs,
      }
    );

    // Register active agent
    this.activeAgents.set(agentState.id, agentState);

    try {
      // Update status to thinking
      agentState = updateAgentStatus(agentState, 'thinking', 'Starting reasoning loop');

      // Add conversation history to memory
      if (validatedRequest.conversationHistory) {
        for (const msg of validatedRequest.conversationHistory) {
          agentState = addMemoryItem(agentState, {
            type: msg.role === 'user' ? 'user_input' : 'agent_response',
            content: msg.content,
            importance: 70,
          });
        }
      }

      // Execute reasoning loop with timeout
      const reasoningResult = await withTimeout(
        this.executeReasoningLoop(agentState),
        options.timeoutMs,
        'reasoning_loop'
      );

      if (!reasoningResult.success) {
        agentState = updateAgentStatus(agentState, 'failed', reasoningResult.error.message);
        return reasoningResult as Result<OrchestrationResult, IntelligenceError>;
      }

      agentState = reasoningResult.data;
      agentState = updateAgentStatus(agentState, 'completed', 'Reasoning complete');

      // Build response
      const lastStep = agentState.reasoningSteps[agentState.reasoningSteps.length - 1];
      const response = this.buildFinalResponse(agentState, lastStep);

      // Calculate metrics
      const totalDuration = Date.now() - startTime;
      const metrics: OrchestrationMetrics = {
        totalDurationMs: totalDuration,
        llmDurationMs: agentState.metrics.llmLatencyMs,
        retrievalDurationMs: agentState.metrics.retrievalLatencyMs,
        agentCount: 1,
        reasoningStepCount: agentState.metrics.reasoningStepCount,
        totalTokensUsed: agentState.metrics.tokensUsed,
        retrievedChunkCount: agentState.memory.relevantKnowledge.length,
      };

      const result: OrchestrationResult = {
        success: true,
        response,
        agentStates: [agentState],
        retrievedKnowledge: [...agentState.memory.relevantKnowledge],
        metrics,
        traceId,
      };

      // Log completion (void pattern)
      void this.logTelemetry('orchestration_completed', {
        traceId,
        durationMs: totalDuration,
        tokensUsed: metrics.totalTokensUsed,
        steps: metrics.reasoningStepCount,
      });

      return success(result);
    } catch (error) {
      agentState = updateAgentStatus(
        agentState,
        'failed',
        error instanceof Error ? error.message : String(error)
      );

      // Log failure (void pattern)
      void this.logTelemetry('orchestration_failed', {
        traceId,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof IntelligenceError) {
        return {
          success: false,
          error,
          code: error.code,
        };
      }

      return failure(
        `Orchestration failed: ${error instanceof Error ? error.message : String(error)}`,
        IntelligenceErrorCode.ORCHESTRATION_FAILED,
        500,
        { traceId }
      );
    } finally {
      // Cleanup active agent
      this.activeAgents.delete(agentState.id);
    }
  }

  /**
   * Execute the reasoning loop
   */
  private async executeReasoningLoop(
    initialState: AgentState
  ): Promise<AgentState> {
    let state = initialState;
    let isComplete = false;

    while (!isComplete) {
      const stepResult = await executeReasoningStep(state, this.llmProvider);

      if (!stepResult.success) {
        throw stepResult.error;
      }

      state = stepResult.data.state;
      isComplete = stepResult.data.isComplete;

      // Update active agent reference
      this.activeAgents.set(state.id, state);
    }

    return state;
  }

  /**
   * Build final response from agent state
   */
  private buildFinalResponse(state: AgentState, lastStep?: ReasoningStep): string {
    if (!lastStep) {
      return 'Unable to generate response.';
    }

    // Try to extract final answer from last step observation or thought
    const finalAnswer = lastStep.observation ?? lastStep.thought;
    return finalAnswer;
  }

  /**
   * Log telemetry event (background, non-blocking)
   */
  private logTelemetry(
    event: string,
    data: Record<string, unknown>
  ): Promise<void> {
    return Promise.resolve().then(() => {
      try {
        logger.info(`[Telemetry] ${event}`, data as Record<string, string | number | boolean | undefined | null | string[] | number[]>);
        // In production, send to telemetry service
      } catch {
        // Silently ignore telemetry errors - don't affect main flow
      }
    });
  }

  /**
   * Get active agent by ID
   */
  getActiveAgent(agentId: string): AgentState | undefined {
    return this.activeAgents.get(agentId);
  }

  /**
   * Get all active agents
   */
  getAllActiveAgents(): ReadonlyArray<AgentState> {
    return Array.from(this.activeAgents.values());
  }

  /**
   * Cancel an active agent
   */
  cancelAgent(agentId: string): boolean {
    const agent = this.activeAgents.get(agentId);
    if (!agent) {
      return false;
    }

    const cancelledAgent = updateAgentStatus(agent, 'failed', 'Cancelled by user');
    this.activeAgents.set(agentId, cancelledAgent);

    // Log cancellation (void pattern)
    void this.logTelemetry('agent_cancelled', { agentId });

    return true;
  }
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let orchestratorInstance: IntelligenceOrchestrator | null = null;

/**
 * Get or create the orchestrator instance
 */
export function getOrchestrator(
  config?: Partial<OrchestratorConfig>
): IntelligenceOrchestrator {
  orchestratorInstance ??= new IntelligenceOrchestrator(config);
  return orchestratorInstance;
}

/**
 * Reset the orchestrator instance (for testing)
 */
export function resetOrchestrator(): void {
  orchestratorInstance = null;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  createInitialAgentState,
  updateAgentStatus,
  addReasoningStep,
  updateAgentMetrics,
  addMemoryItem,
  updateRelevantKnowledge,
  isAgentTimedOut,
  withTimeout,
};
