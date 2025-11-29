import { NextRequest, NextResponse } from 'next/server';
import { sendChatMessage, streamChatMessage } from '@/lib/ai/gemini-service';
import { AgentInstanceManager } from '@/lib/agent/instance-manager';
import type { ChatMessage } from '@/lib/ai/gemini-service';
import { requireAuth, requireOrganization } from '@/lib/auth/api-auth';
import { agentChatSchema, validateInput } from '@/lib/validation/schemas';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

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

    // Build conversation history
    const messages: ChatMessage[] = [
      ...instance.customerMemory.conversationHistory.map((msg: any) => ({
        role: msg.role as 'user' | 'model',
        parts: [{ text: msg.content || msg.text }],
      })),
      {
        role: 'user',
        parts: [{ text: message }],
      },
    ];

    // Enhance system prompt with RAG (Retrieval Augmented Generation)
    let enhancedSystemPrompt = instance.systemPrompt;
    try {
      const { enhanceChatWithRAG } = await import('@/lib/agent/rag-service');
      const ragResult = await enhanceChatWithRAG(messages, orgId, instance.systemPrompt);
      enhancedSystemPrompt = ragResult.enhancedSystemPrompt;
    } catch (error) {
      console.warn('RAG enhancement failed, using base prompt:', error);
      // Continue with base prompt if RAG fails
    }

    if (stream) {
      // Stream response
      const stream = new ReadableStream({
        async start(controller) {
          try {
            const { streamChatMessage } = await import('@/lib/ai/gemini-service');
            
            for await (const chunk of streamChatMessage(messages, enhancedSystemPrompt)) {
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ chunk })}\n\n`));
            }
            controller.close();
          } catch (error: any) {
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      });
    } else {
      // Regular response
      const response = await sendChatMessage(messages, enhancedSystemPrompt);

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
        usage: response.usage,
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
