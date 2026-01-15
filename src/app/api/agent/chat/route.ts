import { NextResponse, type NextRequest } from 'next/server';
import { AgentInstanceManager } from '@/lib/agent/instance-manager';
import { requireOrganization } from '@/lib/auth/api-auth';
import { agentChatSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { handleAPIError, errors } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';

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
 * Error object with optional properties
 */
interface APIError {
  message?: string;
  code?: string;
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/agent/chat');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    // Authentication
    const authResult = await requireOrganization(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

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

    const { customerId, orgId, message } = validation.data;

    // Verify user has access to this organization
    if (user.organizationId !== orgId) {
      return NextResponse.json(
        { success: false, error: 'Access denied to this organization' },
        { status: 403 }
      );
    }

    // Get or spawn agent instance
    const instanceManager = new AgentInstanceManager();
    const instance = await instanceManager.spawnInstance(customerId, orgId);

    // Get agent configuration
    const agentConfigRaw: unknown = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default'
    );

    // Type-safe agent configuration parsing
    const agentConfig = agentConfigRaw as Partial<AgentConfig> | null;
    const configSelectedModel = agentConfig?.selectedModel;
    const selectedModel = (configSelectedModel !== '' && configSelectedModel != null) ? configSelectedModel : 'gpt-4-turbo';
    const modelConfig: ModelConfig = agentConfig?.modelConfig ?? {
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
      const ragResult = await enhanceChatWithRAG(ragMessages, orgId, instance.systemPrompt);
      enhancedSystemPrompt = ragResult.enhancedSystemPrompt;
    } catch (error) {
      logger.warn('RAG enhancement failed, using base prompt', { error, orgId, customerId });
      // Continue with base prompt if RAG fails
    }

    // Use single model with RAG (MVP approach - proven to work)
    const { AIProviderFactory } = await import('@/lib/ai/provider-factory');
    const provider = await AIProviderFactory.createProvider(selectedModel, orgId);

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
      orgId,
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
    logger.error('Agent chat error', error, { route: '/api/agent/chat' });

    // Type-safe error handling
    const apiError = error as APIError;

    // Handle specific error cases
    if (apiError.message?.includes('API key')) {
      return handleAPIError(errors.missingAPIKey('AI Provider'));
    }

    if (apiError.code === 'permission-denied') {
      return handleAPIError(errors.forbidden('You do not have access to this AI agent'));
    }

    if (apiError.message?.includes('rate limit')) {
      return handleAPIError(errors.tooManyRequests());
    }

    return handleAPIError(error);
  }
}
