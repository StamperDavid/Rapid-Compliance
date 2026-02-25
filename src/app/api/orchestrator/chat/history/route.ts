/**
 * Orchestrator Chat History API
 *
 * Loads the most recent conversation messages from Firestore so Jasper
 * can restore context across page reloads.
 *
 * Collection path: orchestratorConversations/jasper_{context}/messages/
 * Each doc: { userMessage, assistantResponse, timestamp, modelUsed, context }
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { requireAuth } from '@/lib/auth/api-auth';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const querySchema = z.object({
  context: z.enum(['admin', 'merchant']).default('admin'),
});

interface StoredMessage {
  id: string;
  userMessage: string;
  assistantResponse: string;
  timestamp: string;
  modelUsed?: string;
  context?: string;
}

interface HistoryMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);

    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const parsed = querySchema.safeParse({
      context: searchParams.get('context') ?? undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid context parameter' },
        { status: 400 }
      );
    }

    const { context } = parsed.data;
    const conversationId = `jasper_${context}`;
    const messagesPath = `${getSubCollection('orchestratorConversations')}/${conversationId}/messages`;

    const docs = await FirestoreService.getAll<StoredMessage>(messagesPath, [
      orderBy('timestamp', 'desc'),
      firestoreLimit(50),
    ]);

    // Expand each stored doc into a user + assistant message pair
    const messages: HistoryMessage[] = [];
    for (const doc of docs) {
      if (doc.userMessage) {
        messages.push({
          role: 'user',
          content: doc.userMessage,
          timestamp: doc.timestamp,
        });
      }
      if (doc.assistantResponse) {
        messages.push({
          role: 'assistant',
          content: doc.assistantResponse,
          timestamp: doc.timestamp,
        });
      }
    }

    // Sort chronologically (oldest first) since Firestore returned desc order
    messages.sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());

    logger.info('[Jasper] History loaded', {
      context,
      messageCount: messages.length,
      docCount: docs.length,
    });

    return NextResponse.json({ success: true, messages });
  } catch (error: unknown) {
    logger.error(
      '[Jasper] History fetch failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/orchestrator/chat/history' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load conversation history' },
      { status: 500 }
    );
  }
}
