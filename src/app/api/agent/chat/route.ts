import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { AgentInstanceManager } from '@/lib/agent/instance-manager';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { agentChatSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { handleAPIError, errors, successResponse } from '@/lib/api/error-handler';
import { logger } from '@/lib/logger/logger';

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
    const body = await request.json();
    const validation = validateInput(agentChatSchema, body);

    if (!validation.success) {
      // Type assertion: when success is false, we have the error structure
      const validationError = validation as { success: false; errors: any };
      const errorDetails = validationError.errors?.errors?.map((e: any) => {
        const joinedPath = e.path?.join('.');
        return {
          path: (joinedPath !== '' && joinedPath != null) ? joinedPath : 'unknown',
          message: (e.message !== '' && e.message != null) ? e.message : 'Validation error',
        };
      }) ?? [];
      
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: errorDetails,
        },
        { status: 400 }
      );
    }

    const { customerId, orgId, message, stream } = validation.data;

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
    const agentConfig = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
      'default'
    );
    
    // Single model configuration (ensemble removed for MVP)
    const configSelectedModel = (agentConfig as any)?.selectedModel;
    const selectedModel = (configSelectedModel !== '' && configSelectedModel != null) ? configSelectedModel : 'gpt-4-turbo';
    const modelConfig = (agentConfig as any)?.modelConfig ?? {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
    };

    // Build conversation history
    const messages = [
      ...instance.customerMemory.conversationHistory.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content:msg.content ?? msg.text,
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
      const ragMessages = messages.map(m => ({
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
    const response = await provider.generateResponse(
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
  } catch (error: any) {
    logger.error('Agent chat error', error, { route: '/api/agent/chat' });
    
    // Handle specific error cases
    if (error?.message?.includes('API key')) {
      return handleAPIError(errors.missingAPIKey('AI Provider'));
    }
    
    if (error?.code === 'permission-denied') {
      return handleAPIError(errors.forbidden('You do not have access to this AI agent'));
    }
    
    if (error?.message?.includes('rate limit')) {
      return handleAPIError(errors.tooManyRequests());
    }
    
    return handleAPIError(error);
  }
}
