/**
 * Facebook Messenger Webhook API Route
 *
 * Handles Facebook Messenger webhook verification (GET) and message handling (POST).
 * Routes incoming messages to the same AI Chat Sales Agent used by /api/chat/public.
 * Sends responses back via the Facebook Graph API.
 *
 * Setup:
 * 1. Configure Facebook App with Messenger product
 * 2. Set webhook URL to: https://yourdomain.com/api/chat/facebook
 * 3. Store FACEBOOK_VERIFY_TOKEN and FACEBOOK_PAGE_ACCESS_TOKEN in Firestore API keys
 *
 * @module api/chat/facebook
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { AgentInstanceManager } from '@/lib/agent/instance-manager';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { logger } from '@/lib/logger/logger';
import type { ChatMessage, ModelName } from '@/types/ai-models';
import type { ConversationMessage } from '@/types/agent-memory';

// Force Node.js runtime (required for Firebase Admin SDK)
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// ============================================================================
// FACEBOOK WEBHOOK VERIFICATION (GET)
// ============================================================================

/**
 * GET /api/chat/facebook
 *
 * Facebook webhook verification challenge.
 * Facebook sends a GET with hub.mode, hub.verify_token, and hub.challenge.
 * We verify the token and echo back the challenge.
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  if (mode !== 'subscribe' || !token || !challenge) {
    return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
  }

  // Load verify token from Firestore API keys
  const verifyToken = await getFacebookVerifyToken();
  if (!verifyToken) {
    logger.error('Facebook verify token not configured', new Error('Missing FACEBOOK_VERIFY_TOKEN'), {
      route: '/api/chat/facebook',
    });
    return NextResponse.json({ error: 'Webhook not configured' }, { status: 500 });
  }

  if (token !== verifyToken) {
    logger.warn('Facebook webhook verification failed — token mismatch', {
      route: '/api/chat/facebook',
    });
    return NextResponse.json({ error: 'Verification failed' }, { status: 403 });
  }

  logger.info('Facebook webhook verified successfully', { route: '/api/chat/facebook' });
  return new NextResponse(challenge, { status: 200 });
}

// ============================================================================
// FACEBOOK MESSAGE HANDLER (POST)
// ============================================================================

const facebookWebhookSchema = z.object({
  object: z.string(),
  entry: z.array(z.object({
    id: z.string(),
    time: z.number(),
    messaging: z.array(z.object({
      sender: z.object({ id: z.string() }),
      recipient: z.object({ id: z.string() }),
      timestamp: z.number(),
      message: z.object({
        mid: z.string(),
        text: z.string().optional(),
      }).optional(),
    })).optional(),
  })),
});

/**
 * POST /api/chat/facebook
 *
 * Receives messages from Facebook Messenger, processes them through the
 * AI Chat Sales Agent, and sends responses back via the Graph API.
 */
export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/chat/facebook');
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: unknown = await request.json();
    const parseResult = facebookWebhookSchema.safeParse(body);

    if (!parseResult.success) {
      logger.warn('Invalid Facebook webhook payload', {
        route: '/api/chat/facebook',
        error: parseResult.error.message,
      });
      // Always return 200 to Facebook to prevent retries
      return NextResponse.json({ status: 'ignored' }, { status: 200 });
    }

    const { object, entry } = parseResult.data;

    if (object !== 'page') {
      return NextResponse.json({ status: 'not_page' }, { status: 200 });
    }

    // Process each message event
    for (const entryItem of entry) {
      const messagingEvents = entryItem.messaging ?? [];
      for (const event of messagingEvents) {
        if (event.message?.text) {
          // Fire-and-forget — don't block the webhook response
          void handleFacebookMessage(
            event.sender.id,
            event.message.text
          ).catch((err: unknown) => {
            logger.error('Error handling Facebook message', err instanceof Error ? err : new Error(String(err)), {
              route: '/api/chat/facebook',
              senderId: event.sender.id,
            });
          });
        }
      }
    }

    // Always return 200 quickly to satisfy Facebook's 20-second timeout
    return NextResponse.json({ status: 'ok' }, { status: 200 });
  } catch (error: unknown) {
    logger.error('Facebook webhook error', error instanceof Error ? error : new Error(String(error)), {
      route: '/api/chat/facebook',
    });
    // Still return 200 to prevent Facebook from disabling the webhook
    return NextResponse.json({ status: 'error' }, { status: 200 });
  }
}

// ============================================================================
// MESSAGE PROCESSING
// ============================================================================

async function handleFacebookMessage(senderId: string, text: string): Promise<void> {
  const { PLATFORM_ID } = await import('@/lib/constants/platform');

  // Spawn agent instance for this Facebook user
  const instanceManager = new AgentInstanceManager();

  let instance;
  try {
    instance = await instanceManager.spawnInstance(`fb_${senderId}`, 'SALES_CHAT');
  } catch (error: unknown) {
    if (error instanceof Error && error.message.includes('Golden Master')) {
      await sendFacebookMessage(
        senderId,
        "Thanks for reaching out! Our team is still getting set up. Please check back soon or visit our website."
      );
      return;
    }
    throw error;
  }

  // Get agent config
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
      const cfgSnap = await adminDb.collection(agentConfigPath).doc('default').get();
      if (cfgSnap.exists) {
        agentConfig = cfgSnap.data() as AgentConfigData;
      }
    }
  } catch (_e) {
    // Ignore and use defaults
  }

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
    { role: 'user' as const, content: text },
  ];

  // Enhance with RAG if available
  let enhancedSystemPrompt = instance.systemPrompt;
  try {
    const { enhanceChatWithRAG } = await import('@/lib/agent/rag-service');
    const ragMessages = messages.map(m => ({
      role: m.role === 'user' ? 'user' as const : 'model' as const,
      parts: [{ text: m.content }],
    }));
    const ragResult = await enhanceChatWithRAG(ragMessages, instance.systemPrompt);
    enhancedSystemPrompt = ragResult.enhancedSystemPrompt;
  } catch (_ragError) {
    // Use base prompt
  }

  // Generate AI response
  const { AIProviderFactory } = await import('@/lib/ai/provider-factory');
  const provider = AIProviderFactory.createProvider(selectedModel);

  const validMessages = messages.filter(
    (msg): msg is ChatMessage & { role: 'user' | 'system' | 'assistant' } =>
      msg.role === 'user' || msg.role === 'system' || msg.role === 'assistant'
  );
  const response = await provider.generateResponse(
    validMessages,
    enhancedSystemPrompt,
    modelConfig
  );

  // Save conversation to memory
  await instanceManager.addMessageToMemory(`fb_${senderId}`, text, response.text);

  // Track for analytics
  try {
    await AdminFirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/chatSessions/fb_${senderId}/messages`,
      `msg_${Date.now()}`,
      {
        customerId: `fb_${senderId}`,
        userMessage: text,
        assistantResponse: response.text,
        model: selectedModel as string,
        channel: 'facebook_messenger',
        timestamp: new Date().toISOString(),
      },
      false
    );
  } catch (_trackError) {
    // Don't fail on analytics
  }

  // Send response back to Facebook
  await sendFacebookMessage(senderId, response.text);
}

// ============================================================================
// FACEBOOK GRAPH API
// ============================================================================

async function sendFacebookMessage(recipientId: string, text: string): Promise<void> {
  const pageAccessToken = await getFacebookPageAccessToken();
  if (!pageAccessToken) {
    logger.error('Facebook page access token not configured', new Error('Missing FACEBOOK_PAGE_ACCESS_TOKEN'), {
      route: '/api/chat/facebook',
    });
    return;
  }

  // Facebook limits messages to 2000 characters
  const truncatedText = text.length > 2000 ? `${text.substring(0, 1997)}...` : text;

  const response = await fetch('https://graph.facebook.com/v19.0/me/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${pageAccessToken}`,
    },
    body: JSON.stringify({
      recipient: { id: recipientId },
      message: { text: truncatedText },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    logger.error('Failed to send Facebook message', new Error(`Graph API ${response.status}: ${errorBody}`), {
      route: '/api/chat/facebook',
      recipientId,
    });
  }
}

// ============================================================================
// API KEY RETRIEVAL (from Firestore, per project convention)
// ============================================================================

async function getFacebookVerifyToken(): Promise<string | null> {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    if (adminDb) {
      const { PLATFORM_ID } = await import('@/lib/constants/platform');
      const doc = await adminDb
        .collection(COLLECTIONS.ORGANIZATIONS)
        .doc(PLATFORM_ID)
        .collection('settings')
        .doc('api-keys')
        .get();
      if (doc.exists) {
        const data = doc.data() as Record<string, unknown>;
        return (data.facebookVerifyToken as string) ?? null;
      }
    }
  } catch (_e) {
    // Fallback
  }
  return null;
}

async function getFacebookPageAccessToken(): Promise<string | null> {
  try {
    const { adminDb } = await import('@/lib/firebase/admin');
    if (adminDb) {
      const { PLATFORM_ID } = await import('@/lib/constants/platform');
      const doc = await adminDb
        .collection(COLLECTIONS.ORGANIZATIONS)
        .doc(PLATFORM_ID)
        .collection('settings')
        .doc('api-keys')
        .get();
      if (doc.exists) {
        const data = doc.data() as Record<string, unknown>;
        return (data.facebookPageAccessToken as string) ?? null;
      }
    }
  } catch (_e) {
    // Fallback
  }
  return null;
}
