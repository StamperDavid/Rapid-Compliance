import { NextRequest, NextResponse } from 'next/server';
import { sendEnsembleRequest, streamEnsembleRequest, EnsembleRequest } from '@/lib/ai/ensemble-service';
import { AgentInstanceManager } from '@/lib/agent/instance-manager';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { agentChatSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';

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
      return NextResponse.json(
        {
          success: false,
          error: 'Validation failed',
          details: validation.errors.errors.map((e: any) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
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
    
    const useEnsemble = (agentConfig as any)?.useEnsemble !== false; // Default to true
    const ensembleMode = (agentConfig as any)?.ensembleMode || 'best';
    const modelConfig = (agentConfig as any)?.modelConfig || {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
    };

    // Build conversation history
    const messages = [
      ...instance.customerMemory.conversationHistory.map((msg: any) => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content || msg.text,
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
      console.warn('RAG enhancement failed, using base prompt:', error);
      // Continue with base prompt if RAG fails
    }

    if (stream) {
      // Stream response (use fastest model first for streaming)
      const responseStream = new ReadableStream({
        async start(controller) {
          try {
            for await (const chunk of streamEnsembleRequest({
              messages,
              systemInstruction: enhancedSystemPrompt,
              temperature: modelConfig.temperature,
              maxTokens: modelConfig.maxTokens,
              topP: modelConfig.topP,
              mode: ensembleMode,
            }, orgId)) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
            }
            controller.close();
          } catch (error: any) {
            controller.error(error);
          }
        },
      });

      return new Response(responseStream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Ensemble mode: Query multiple models and return best
      const ensembleResponse = await sendEnsembleRequest({
        messages,
        systemInstruction: enhancedSystemPrompt,
        temperature: modelConfig.temperature,
        maxTokens: modelConfig.maxTokens,
        topP: modelConfig.topP,
        mode: ensembleMode,
      }, orgId);

      // Save conversation to customer memory
      await instanceManager.addMessageToMemory(
        customerId,
        orgId,
        message,
        ensembleResponse.bestResponse
      );

      return NextResponse.json({
        success: true,
        response: ensembleResponse.bestResponse,
        model: ensembleResponse.selectedModel,
        confidenceScore: ensembleResponse.confidenceScore,
        reasoning: ensembleResponse.reasoning,
        allResponses: ensembleResponse.allResponses.map(r => ({
          model: r.model,
          provider: r.provider,
          score: r.score,
          cost: r.usage.cost,
          responseTime: r.responseTime,
        })),
        totalCost: ensembleResponse.totalCost,
        processingTime: ensembleResponse.processingTime,
      });
    }
  } catch (error: any) {
    console.error('Error in agent chat:', error);
    return NextResponse.json(
      { success: false, error: error.message || 'Failed to process chat' },
      { status: 500 }
    );
  }
}
