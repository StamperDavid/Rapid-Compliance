import { type NextRequest, NextResponse } from 'next/server';
import { AgentInstanceManager } from '@/lib/agent/instance-manager';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import type { ChatMessage, ModelName } from '@/types/ai-models';
import type { ConversationMessage } from '@/types/agent-memory';

// Minimal Organization type for this route
interface Organization {
  id: string;
  [key: string]: unknown;
}

// Force Node.js runtime (required for Firebase Admin SDK)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Public Chat API
 * This endpoint is designed for embedded chat widgets on customer websites.
 * It doesn't require user authentication but validates customerId.
 * Penthouse model: Always uses PLATFORM_ID.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting - stricter for public endpoint
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/chat/public');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: unknown = await request.json();
    const { customerId, message } = body as { customerId?: string; message?: string };

    // Validate required fields
    if (!customerId || !message) {
      return errors.badRequest('Missing required fields: customerId, message');
    }

    // Validate message length
    if (typeof message === 'string' && message.length > 2000) {
      return errors.badRequest('Message too long. Maximum 2000 characters.');
    }

    // Penthouse model: use PLATFORM_ID
    const { PLATFORM_ID } = await import('@/lib/constants/platform');

    // Verify organization exists and has chat enabled (prefer Admin SDK, fallback to client SDK)
    let organization: Organization | null = null;
    let chatConfig: { enabled?: boolean } | null = null;
    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      const { getOrgSubCollection } = await import('@/lib/firebase/collections');
      if (adminDb) {
        const orgSnap = await adminDb.collection(COLLECTIONS.ORGANIZATIONS).doc(PLATFORM_ID).get();
        if (orgSnap.exists) {
          organization = { id: orgSnap.id, ...orgSnap.data() } as Organization;
        }
        const settingsPath = getOrgSubCollection('settings');
        const chatSnap = await adminDb
          .collection(settingsPath)
          .doc('chatWidget')
          .get();
        if (chatSnap.exists) {
          chatConfig = chatSnap.data() as { enabled?: boolean };
        }
      }
    } catch (_e) {
      // Ignore and fallback
    }

    organization ??= await FirestoreService.get<Organization>(COLLECTIONS.ORGANIZATIONS, PLATFORM_ID);
    if (!organization) {
      return NextResponse.json(
        { success: false, error: 'Invalid organization' },
        { status: 404 }
      );
    }

    chatConfig ??= await FirestoreService.get<{ enabled?: boolean }>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/settings`,
      'chatWidget'
    );

    // Default to enabled if no config exists
    if (chatConfig?.enabled === false) {
      return NextResponse.json(
        { success: false, error: 'Chat is not available for this organization' },
        { status: 403 }
      );
    }

    // Get or spawn agent instance
    const instanceManager = new AgentInstanceManager();

    let instance;
    try {
      instance = await instanceManager.spawnInstance(customerId);
    } catch (error: unknown) {
      // If no Golden Master exists, provide a helpful response
      if (error instanceof Error && error.message.includes('Golden Master')) {
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
    interface AgentConfigData {
      selectedModel?: string;
      modelConfig?: {
        temperature?: number;
        maxTokens?: number;
        topP?: number;
      };
    }

    let agentConfig: AgentConfigData | null = null;
    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      const { getOrgSubCollection } = await import('@/lib/firebase/collections');
      if (adminDb) {
        const agentConfigPath = getOrgSubCollection('agentConfig');
        const cfgSnap = await adminDb
          .collection(agentConfigPath)
          .doc('default')
          .get();
        if (cfgSnap.exists) {
          agentConfig = cfgSnap.data() as AgentConfigData;
        }
      }
    } catch (_e) {
      // Ignore and fallback
    }
    agentConfig ??= await FirestoreService.get<AgentConfigData>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/agentConfig`,
      'default'
    );

    const selectedModel = (agentConfig?.selectedModel ?? 'openrouter/anthropic/claude-3.5-sonnet') as ModelName;
    const modelConfig = agentConfig?.modelConfig ?? {
      temperature: 0.7,
      maxTokens: 2048,
      topP: 0.9,
    };

    // Build conversation history
    const messages: ChatMessage[] = [
      ...instance.customerMemory.conversationHistory.map((msg: ConversationMessage): ChatMessage => ({
        role: msg.role === 'customer' ? 'user' : 'assistant',
        content: msg.content,
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
      const ragResult = await enhanceChatWithRAG(ragMessages, instance.systemPrompt);
      enhancedSystemPrompt = ragResult.enhancedSystemPrompt;
    } catch (error: unknown) {
      logger.warn('RAG enhancement failed, using base prompt', {
        route: '/api/chat/public',
        error: error instanceof Error ? error.message : String(error),
      });
    }

    // Generate response using AI
    const { AIProviderFactory } = await import('@/lib/ai/provider-factory');
    const provider = AIProviderFactory.createProvider(selectedModel);
    
    const startTime = Date.now();
    // Filter to only valid AI provider roles (messages are already user/assistant, this narrows the type)
    const validMessages = messages.filter(
      (msg): msg is ChatMessage & { role: 'user' | 'system' | 'assistant' } =>
        msg.role === 'user' || msg.role === 'system' || msg.role === 'assistant'
    );
    const response = await provider.generateResponse(
      validMessages,
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

    // Track conversation for analytics
    try {
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/chatSessions/${customerId}/messages`,
        `msg_${Date.now()}`,
        {
          customerId,
          userMessage: message,
          assistantResponse: response.text,
          model: selectedModel as string,
          processingTime,
          timestamp: new Date().toISOString(),
        },
        false
      );
    } catch (error: unknown) {
      logger.warn('Failed to track chat message', {
        route: '/api/chat/public',
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the request if analytics tracking fails
    }

    return NextResponse.json({
      success: true,
      response: response.text,
      model: selectedModel as string,
      processingTime,
    });

  } catch (error: unknown) {
    logger.error('Public chat error', error instanceof Error ? error : new Error(String(error)), { route: '/api/chat/public' });

    // Handle API key issues
    if (error instanceof Error && error.message.includes('API key')) {
      return NextResponse.json({
        success: true,
        response: "I'm having trouble connecting right now. Please try again in a moment, or contact support if the issue persists.",
        model: 'error',
        processingTime: 0,
      });
    }

    // Handle rate limiting
    if (error instanceof Error && error.message.includes('rate limit')) {
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
export function OPTIONS(request: NextRequest) {
  const origin = request.headers.get('origin') ?? '*';

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


