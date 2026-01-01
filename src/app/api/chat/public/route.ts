import { NextRequest, NextResponse } from 'next/server';
import { AgentInstanceManager } from '@/lib/agent/instance-manager';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

// Force Node.js runtime (required for Firebase Admin SDK)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public Chat API
 * This endpoint is designed for embedded chat widgets on customer websites.
 * It doesn't require user authentication but validates orgId and customerId.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - stricter for public endpoint
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/chat/public');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body = await request.json();
    const { customerId, orgId, message } = body;

    // Validate required fields
    if (!customerId || !orgId || !message) {
      return errors.badRequest('Missing required fields: customerId, orgId, message');
    }

    // Validate message length
    if (message.length > 2000) {
      return errors.badRequest('Message too long. Maximum 2000 characters.');
    }

    // Note: The 'platform-admin' organization is for the landing page demo
    // It uses the trained golden master from /admin/sales-agent/training
    // and spawns ephemeral agents the same way as regular organizations

    // Verify organization exists and has chat enabled (prefer Admin SDK, fallback to client SDK)
    let organization: any = null;
    let chatConfig: any = null;
    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      const { getOrgSubCollection } = await import('@/lib/firebase/collections');
      if (adminDb) {
        const orgSnap = await adminDb.collection(COLLECTIONS.ORGANIZATIONS).doc(orgId).get();
        if (orgSnap.exists) {
          organization = { id: orgSnap.id, ...orgSnap.data() };
        }
        const settingsPath = getOrgSubCollection(orgId, 'settings');
        const chatSnap = await adminDb
          .collection(settingsPath)
          .doc('chatWidget')
          .get();
        if (chatSnap.exists) {
          chatConfig = chatSnap.data();
        }
      }
    } catch (e) {
      // Ignore and fallback
    }

    if (!organization) {
      organization = await FirestoreService.get(COLLECTIONS.ORGANIZATIONS, orgId);
    }
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Invalid organization' },
        { status: 404 }
      );
    }

    if (!chatConfig) {
      chatConfig = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/settings`,
        'chatWidget'
      );
    }

    // Default to enabled if no config exists
    if (chatConfig && chatConfig.enabled === false) {
      return NextResponse.json(
        { success: false, error: 'Chat is not available for this organization' },
        { status: 403 }
      );
    }

    // Get or spawn agent instance
    const instanceManager = new AgentInstanceManager();
    
    let instance;
    try {
      instance = await instanceManager.spawnInstance(customerId, orgId);
    } catch (error: any) {
      // If no Golden Master exists, provide a helpful response
      if (error.message?.includes('Golden Master')) {
        return NextResponse.json({
          success: true,
          response: "Thanks for reaching out! Our team is still setting up the AI assistant. Please check back soon or contact us directly.",
          model: 'fallback',
          processingTime: 0,
        });
      }
      throw error;
    }

    // Get agent configuration (prefer Admin SDK)
    let agentConfig: any = null;
    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      const { getOrgSubCollection } = await import('@/lib/firebase/collections');
      if (adminDb) {
        const agentConfigPath = getOrgSubCollection(orgId, 'agentConfig');
        const cfgSnap = await adminDb
          .collection(agentConfigPath)
          .doc('default')
          .get();
        if (cfgSnap.exists) {
          agentConfig = cfgSnap.data();
        }
      }
    } catch (e) {
      // Ignore and fallback
    }
    if (!agentConfig) {
      agentConfig = await FirestoreService.get(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/agentConfig`,
        'default'
      );
    }
    
    const selectedModel = (agentConfig as any)?.selectedModel || 'openrouter/anthropic/claude-3.5-sonnet';
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

    // Enhance system prompt with RAG
    let enhancedSystemPrompt = instance.systemPrompt;
    try {
      const { enhanceChatWithRAG } = await import('@/lib/agent/rag-service');
      const ragMessages = messages.map(m => ({
        role: m.role === 'user' ? 'user' as const : 'model' as const,
        parts: [{ text: m.content }],
      }));
      const ragResult = await enhanceChatWithRAG(ragMessages, orgId, instance.systemPrompt);
      enhancedSystemPrompt = ragResult.enhancedSystemPrompt;
    } catch (error) {
      logger.warn('RAG enhancement failed, using base prompt', { route: '/api/chat/public', error });
    }

    // Generate response using AI
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

    // Track conversation for analytics
    try {
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/chatSessions/${customerId}/messages`,
        `msg_${Date.now()}`,
        {
          customerId,
          userMessage: message,
          assistantResponse: response.text,
          model: selectedModel,
          processingTime,
          timestamp: new Date().toISOString(),
        },
        false
      );
    } catch (error) {
      logger.warn('Failed to track chat message', { route: '/api/chat/public', error });
      // Don't fail the request if analytics tracking fails
    }

    return NextResponse.json({
      success: true,
      response: response.text,
      model: selectedModel,
      processingTime,
    });

  } catch (error: any) {
    logger.error('Public chat error', error, { route: '/api/chat/public' });
    
    // Handle API key issues
    if (error?.message?.includes('API key')) {
      return NextResponse.json({
        success: true,
        response: "I'm having trouble connecting right now. Please try again in a moment, or contact support if the issue persists.",
        model: 'error',
        processingTime: 0,
      });
    }
    
    // Handle rate limiting
    if (error?.message?.includes('rate limit')) {
      return NextResponse.json(
        { success: false, error: 'Too many requests. Please wait a moment.' },
        { status: 429 }
      );
    }
    
    // Generic error - don't expose internal details
    return NextResponse.json({
      success: true,
      response: "I'm sorry, something went wrong. Please try again.",
      model: 'error',
      processingTime: 0,
    });
  }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') || '*';
  
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': origin,
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}


