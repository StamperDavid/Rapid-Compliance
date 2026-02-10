import { NextResponse, type NextRequest } from 'next/server';
import { AgentInstanceManager } from '@/lib/agent/instance-manager';
import { requireAuth } from '@/lib/auth/api-auth';
import { agentChatSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { handleAPIError, errors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';
import type { ModelName } from '@/types/ai-models';

export const dynamic = 'force-dynamic';

// ===== TYPE DEFINITIONS =====

/**
 * Validation error detail structure
 */
interface ValidationErrorDetail {
  path: string;
  message: string;
}

/**
 * Zod validation error structure
 */
interface ZodValidationIssue {
  path: Array<string | number>;
  message: string;
}

/**
 * Agent configuration from Firestore
 */
interface AgentConfig {
  selectedModel: string;
  modelConfig: ModelConfig;
}

/**
 * Model configuration parameters
 */
interface ModelConfig {
  temperature: number;
  maxTokens: number;
  topP: number;
}

/**
 * Conversation message from customer memory
 */
interface MemoryMessage {
  role: 'customer' | 'agent' | 'human_agent';
  content?: string;
  text?: string;
}

/**
 * Chat message format for AI provider
 */
interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

/**
 * RAG message format
 */
interface RAGMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

/**
 * AI provider response
 */
interface AIResponse {
  text: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
}

/**
 * Success response for agent chat
 * Follows Result<T, E> pattern for type-safe API responses
 */
interface _ChatSuccessResponse {
  success: true;
  response: string;
  model: string;
  usage?: {
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
  };
  processingTime: number;
}

/**
 * Error response for agent chat
 * Follows Result<T, E> pattern for type-safe API responses
 */
interface _ChatErrorResponse {
  success: false;
  error: string;
  details?: unknown;
}

// ===== TYPE GUARDS =====

/**
 * Type guard to check if a value is a valid AgentConfig
 */
function isAgentConfig(value: unknown): value is AgentConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    (typeof obj.selectedModel === 'string' || obj.selectedModel === undefined) &&
    (typeof obj.modelConfig === 'object' || obj.modelConfig === undefined)
  );
}

/**
 * Type guard to check if a value is a valid ModelConfig
 */
function isModelConfig(value: unknown): value is ModelConfig {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const obj = value as Record<string, unknown>;
  return (
    typeof obj.temperature === 'number' &&
    typeof obj.maxTokens === 'number' &&
    typeof obj.topP === 'number'
  );
}

/**
 * Type guard to check if a string is a valid ModelName
 */
function isModelName(value: string): value is ModelName {
  const validModels: readonly string[] = [
    'gpt-4-turbo',
    'gpt-4',
    'gpt-3.5-turbo',
    'claude-3-5-sonnet',
    'claude-3-opus',
    'claude-3-sonnet',
    'claude-3-haiku',
    'gemini-1.5-pro',
    'gemini-1.5-flash',
    'gemini-1.0-pro',
  ];
  return validModels.includes(value) || value.startsWith('openrouter/');
}

/**
 * Type guard to check if error has API key issue
 */
function isAPIKeyError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as Record<string, unknown>;
  const message = err.message;
  return typeof message === 'string' && message.includes('API key');
}

/**
 * Type guard to check if error is permission denied
 */
function isPermissionDeniedError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as Record<string, unknown>;
  return err.code === 'permission-denied';
}

/**
 * Type guard to check if error is rate limit
 */
function isRateLimitError(error: unknown): boolean {
  if (typeof error !== 'object' || error === null) {
    return false;
  }
  const err = error as Record<string, unknown>;
  const message = err.message;
  return typeof message === 'string' && message.includes('rate limit');
}

// ===== API ROUTE HANDLER =====

/**
 * POST /api/agent/chat
 * Handles agent chat interactions with customers
 *
 * Returns:
 * - Success: ChatSuccessResponse with agent's reply
 * - Error: ChatErrorResponse with error details
 *
 * All responses follow Result<T, E> pattern for type-safe error handling
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/chat');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user: _user } = authResult;

    // Parse and validate input
    const body: unknown = await request.json();
    const validation = validateInput(agentChatSchema, body);

    if (!validation.success) {
      // Type-safe validation error handling
      const zodError = validation.errors;
      const errorDetails: ValidationErrorDetail[] = zodError.errors.map((e: ZodValidationIssue) => {
        const joinedPath = e.path.join('.');
        return {
          path: (joinedPath !== '' && joinedPath != null) ? joinedPath : 'unknown',
          message: (e.message !== '' && e.message != null) ? e.message : 'Validation error',
        };
      });

      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const { customerId, message } = validation.data;

    // Penthouse model: use PLATFORM_ID
    const { PLATFORM_ID } = await import('@/lib/constants/platform');

    // Get or spawn agent instance
    const instanceManager = new AgentInstanceManager();
    const instance = await instanceManager.spawnInstance(customerId);

    // Get agent configuration
    const agentConfigRaw: unknown = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/agentConfig`,
      'default'
    );

    // Type-safe agent configuration parsing with proper type guards
    const agentConfig = isAgentConfig(agentConfigRaw) ? agentConfigRaw : null;
    const configSelectedModel = agentConfig?.selectedModel;
    const selectedModelString = (configSelectedModel !== '' && configSelectedModel != null) ? configSelectedModel : 'gpt-4-turbo';

    // Validate model name before using
    const selectedModel: ModelName = isModelName(selectedModelString) ? selectedModelString : 'gpt-4-turbo';

    // Safely extract model config with proper type checking
    const rawModelConfig = agentConfig?.modelConfig;
    const modelConfig: ModelConfig = (rawModelConfig != null && isModelConfig(rawModelConfig))
      ? rawModelConfig
      : {
          temperature: 0.7,
          maxTokens: 2048,
          topP: 0.9,
        };

    // Build conversation history
    const messages: ChatMessage[] = [
      ...instance.customerMemory.conversationHistory.map((msg: MemoryMessage): ChatMessage => ({
        role: msg.role === 'customer' ? 'user' : 'assistant',
        content: msg.content ?? msg.text ?? '',
      })),
      {
        role: 'user' as const,
        content: message,
      },
    ];

    // Enhance system prompt with RAG (Retrieval Augmented Generation)
    let enhancedSystemPrompt = instance.systemPrompt;
    try {
      const { enhanceChatWithRAG } = await import('@/lib/agent/rag-service');
      // Convert to RAG format temporarily
      const ragMessages: RAGMessage[] = messages.map((m): RAGMessage => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));
      const ragResult = await enhanceChatWithRAG(ragMessages, instance.systemPrompt);
      enhancedSystemPrompt = ragResult.enhancedSystemPrompt;
    } catch (error) {
      logger.warn('RAG enhancement failed, using base prompt', { error: error instanceof Error ? error.message : String(error), customerId });
      // Continue with base prompt if RAG fails
    }

    // Use single model with RAG (MVP approach - proven to work)
    const { AIProviderFactory } = await import('@/lib/ai/provider-factory');
    const provider = AIProviderFactory.createProvider(selectedModel);

    const startTime = Date.now();
    const response: AIResponse = await provider.generateResponse(
      messages,
      enhancedSystemPrompt,
      modelConfig
    );
    const processingTime = Date.now() - startTime;

    // Save conversation to customer memory
    await instanceManager.addMessageToMemory(
      customerId,
      message,
      response.text
    );

    return NextResponse.json({
      success: true,
      response: response.text,
      model: selectedModel,
      usage: response.usage,
      processingTime,
    });
  } catch (error: unknown) {
    logger.error('Agent chat error', error instanceof Error ? error : undefined, { route: '/api/agent/chat' });

    // Type-safe error handling using type guards
    if (isAPIKeyError(error)) {
      return handleAPIError(errors.missingAPIKey('AI Provider'));
    }

    if (isPermissionDeniedError(error)) {
      return handleAPIError(errors.forbidden('You do not have access to this AI agent'));
    }

    if (isRateLimitError(error)) {
      return handleAPIError(errors.tooManyRequests());
    }

    return handleAPIError(error);
  }
}
