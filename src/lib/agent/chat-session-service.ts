/**
 * Chat Session Service
 * Manages real-time AI chat sessions for conversations monitoring
 * Replaces mock data in conversations page
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { limit as firestoreLimit, orderBy, where, type QueryConstraint } from 'firebase/firestore';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export interface ChatSession {
  id: string;
  customerId: string;
  customerName: string;
  customerEmail: string;
  status: 'active' | 'needs_help' | 'completed' | 'abandoned';
  sentiment: 'positive' | 'neutral' | 'frustrated';
  startedAt: string;
  completedAt?: string;
  lastMessageAt: string;
  messageCount: number;
  lastMessage: string;
  agentHandoff?: {
    requestedAt: string;
    requestedBy: string; // customer or system
    handoffReason?: string;
    assignedTo?: string;
  };
  metadata?: {
    source?: string;
    ipAddress?: string;
    userAgent?: string;
    referrer?: string;
  };
}

export interface ChatMessage {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'agent';
  content: string;
  timestamp: string;
  metadata?: {
    model?: string;
    tokens?: number;
    confidence?: number;
    sources?: string[];
    handoffReason?: string;
  };
}

export interface SessionMetrics {
  totalSessions: number;
  activeSessions: number;
  needsAttention: number;
  avgDuration: number;
  avgMessages: number;
  completionRate: number;
  sentimentBreakdown: {
    positive: number;
    neutral: number;
    frustrated: number;
  };
}

/**
 * Chat Session Service
 */
export class ChatSessionService {
  /**
   * Get active chat sessions
   */
  static async getActiveSessions(
    limitCount: number = 50
  ): Promise<ChatSession[]> {
    try {
      return await FirestoreService.getAll<ChatSession>(
        getSubCollection('chatSessions'),
        [
          where('status', 'in', ['active', 'needs_help']),
          orderBy('lastMessageAt', 'desc'),
          firestoreLimit(limitCount),
        ]
      );
    } catch (err: unknown) {
      const isIndexError = err instanceof Error && err.message.includes('requires an index');
      if (!isIndexError) { throw err; }

      logger.warn('[ChatSession] Composite index unavailable — falling back to simple query', {
        file: 'chat-session-service.ts',
      });
      const allSessions = await FirestoreService.getAll<ChatSession>(
        getSubCollection('chatSessions'),
        [firestoreLimit(limitCount * 2)]
      );
      return allSessions
        .filter(s => s.status === 'active' || s.status === 'needs_help')
        .sort((a, b) => (b.lastMessageAt ?? '').localeCompare(a.lastMessageAt ?? ''))
        .slice(0, limitCount);
    }
  }

  /**
   * Get session history (completed sessions)
   */
  static async getSessionHistory(
    limitCount: number = 100,
    filters?: QueryConstraint[]
  ): Promise<ChatSession[]> {
    const constraints = [
      where('status', 'in', ['completed', 'abandoned']),
      orderBy('completedAt', 'desc'),
      firestoreLimit(limitCount),
      ...(filters ?? []),
    ];

    try {
      return await FirestoreService.getAll<ChatSession>(
        getSubCollection('chatSessions'),
        constraints
      );
    } catch (err: unknown) {
      // Fallback: if composite index is missing, use simpler query and sort in memory
      const isIndexError = err instanceof Error && err.message.includes('requires an index');
      if (!isIndexError) { throw err; }

      logger.warn('[ChatSession] Composite index unavailable — falling back to simple query', {
        file: 'chat-session-service.ts',
      });
      const allSessions = await FirestoreService.getAll<ChatSession>(
        getSubCollection('chatSessions'),
        [firestoreLimit(limitCount * 2)]
      );
      return allSessions
        .filter(s => s.status === 'completed' || s.status === 'abandoned')
        .sort((a, b) => (b.completedAt ?? '').localeCompare(a.completedAt ?? ''))
        .slice(0, limitCount);
    }
  }

  /**
   * Subscribe to active sessions (real-time)
   */
  static subscribeToActiveSessions(
    callback: (sessions: ChatSession[]) => void
  ): () => void {
    return FirestoreService.subscribeToCollection<ChatSession>(
      getSubCollection('chatSessions'),
      [
        where('status', 'in', ['active', 'needs_help']),
        orderBy('lastMessageAt', 'desc'),
        firestoreLimit(50),
      ],
      callback
    );
  }

  /**
   * Get messages for a specific session
   */
  static async getSessionMessages(
    sessionId: string
  ): Promise<ChatMessage[]> {
    const messages = await FirestoreService.getAll<ChatMessage>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/chatSessions/${sessionId}/messages`,
      [orderBy('timestamp', 'asc')]
    );

    return messages;
  }

  /**
   * Subscribe to session messages (real-time)
   */
  static subscribeToSessionMessages(
    sessionId: string,
    callback: (messages: ChatMessage[]) => void
  ): () => void {
    return FirestoreService.subscribeToCollection<ChatMessage>(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/chatSessions/${sessionId}/messages`,
      [orderBy('timestamp', 'asc')],
      callback
    );
  }

  /**
   * Request agent takeover
   */
  static async requestTakeover(
    sessionId: string,
    agentId: string,
    reason?: string
  ): Promise<void> {
    await FirestoreService.update(
      getSubCollection('chatSessions'),
      sessionId,
      {
        status: 'needs_help',
        agentHandoff: {
          requestedAt: new Date().toISOString(),
          requestedBy: 'system',
          handoffReason: reason,
          assignedTo: agentId,
        },
      }
    );

    // Create system message
    await this.addMessage(sessionId, {
      role: 'system',
      content: `Agent ${agentId} has taken over this conversation.`,
      metadata: {
        handoffReason: reason,
      },
    });
  }

  /**
   * Complete session
   */
  static async completeSession(
    sessionId: string,
    outcome?: 'sale' | 'no_sale' | 'abandoned' | 'human_requested'
  ): Promise<void> {
    await FirestoreService.update(
      getSubCollection('chatSessions'),
      sessionId,
      {
        status: 'completed',
        completedAt: new Date().toISOString(),
        outcome,
      }
    );

    // Auto-trigger conversation analysis (fire-and-forget)
    this.triggerChatAnalysis(sessionId).catch(err => {
      logger.error('[ChatSession] Auto-analysis failed:', err instanceof Error ? err : new Error(String(err)), { file: 'chat-session-service.ts' });
    });
  }

  /**
   * Trigger automatic analysis for a completed chat session
   * Uses the analysis API endpoint to avoid importing server-only modules
   * (chat-session-service is used by client-side pages)
   */
  private static async triggerChatAnalysis(sessionId: string): Promise<void> {
    try {
      const sessionData = await FirestoreService.get(
        getSubCollection('chatSessions'),
        sessionId
      );

      if (!sessionData) {
        return;
      }

      const session = sessionData as ChatSession;

      const messages = await this.getSessionMessages(sessionId);
      if (messages.length < 2) {
        return;
      }

      const transcript = messages
        .map(m => `${m.role.toUpperCase()}: ${m.content}`)
        .join('\n');

      const startTime = new Date(session.startedAt);
      const endTime = session.completedAt ? new Date(session.completedAt) : new Date();
      const durationSecs = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

      // Call the analysis API endpoint instead of importing server-only modules directly.
      // This avoids the server-only import chain (conversation-engine → coordinator-factory-server)
      // that would break webpack builds for client-side pages importing this service.
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/conversation/analyze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          transcript,
          conversationType: 'discovery_call',
          participants: [
            { id: 'ai-chat-agent', name: 'AI Chat Agent', role: 'sales_rep' },
            { id: session.customerId, name: session.customerName, role: 'prospect' },
          ],
          repId: 'ai-chat-agent',
          duration: durationSecs,
          includeCoaching: true,
          includeFollowUps: true,
        }),
      });

      if (response.ok) {
        const result = await response.json() as { data?: { scores?: { overall?: number } } };
        const overallScore = result.data?.scores?.overall;
        logger.info('[ChatSession] Auto-analysis completed via API', {
          sessionId,
          overallScore,
          file: 'chat-session-service.ts',
        });

        // Route through production monitor for scoring + auto-flag pipeline
        this.triggerProductionMonitor(sessionId, overallScore).catch(err => {
          logger.error('[ChatSession] Production monitor failed:', err instanceof Error ? err : new Error(String(err)), { file: 'chat-session-service.ts' });
        });
      } else {
        logger.warn('[ChatSession] Auto-analysis API returned non-OK', {
          sessionId,
          status: response.status,
          file: 'chat-session-service.ts',
        });
      }
    } catch (error) {
      logger.error('[ChatSession] Analysis error:', error instanceof Error ? error : new Error(String(error)), { file: 'chat-session-service.ts' });
    }
  }

  /**
   * Route a completed session through the production monitor pipeline.
   * This scores the session, records it, and auto-flags if below threshold.
   */
  private static async triggerProductionMonitor(sessionId: string, score?: number): Promise<void> {
    try {
      const baseUrl = typeof window !== 'undefined'
        ? window.location.origin
        : process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';

      const response = await fetch(`${baseUrl}/api/agent-performance/score-session`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sessionId,
          agentType: 'chat',
          agentId: 'agent_chat_primary',
          ...(typeof score === 'number' ? { score } : {}),
        }),
      });

      if (response.ok) {
        const result = await response.json() as { scored: boolean; flagged: boolean; score: number };
        logger.info('[ChatSession] Production monitor completed', {
          sessionId,
          scored: result.scored,
          flagged: result.flagged,
          score: result.score,
          file: 'chat-session-service.ts',
        });
      } else {
        logger.warn('[ChatSession] Production monitor returned non-OK', {
          sessionId,
          status: response.status,
          file: 'chat-session-service.ts',
        });
      }
    } catch (error) {
      logger.error('[ChatSession] Production monitor error:', error instanceof Error ? error : new Error(String(error)), { file: 'chat-session-service.ts' });
    }
  }

  /**
   * Add message to session
   */
  static async addMessage(
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<void> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/chatSessions/${sessionId}/messages`,
      messageId,
      {
        ...message,
        sessionId,
        timestamp: new Date().toISOString(),
      },
      false
    );

    // Update session's last message
    await FirestoreService.update(
      getSubCollection('chatSessions'),
      sessionId,
      {
        lastMessage: message.content.substring(0, 200),
        lastMessageAt: new Date().toISOString(),
        messageCount: (await this.getSessionMessages(sessionId)).length,
      }
    );
  }

  /**
   * Update session sentiment
   */
  static async updateSentiment(
    sessionId: string,
    sentiment: 'positive' | 'neutral' | 'frustrated'
  ): Promise<void> {
    await FirestoreService.update(
      getSubCollection('chatSessions'),
      sessionId,
      { sentiment }
    );
  }

  /**
   * Get session metrics
   */
  static async getMetrics(): Promise<SessionMetrics> {
    const allSessions = await FirestoreService.getAll<ChatSession>(
      getSubCollection('chatSessions'),
      []
    );

    const activeSessions = allSessions.filter(
      (s) => s.status === 'active' || s.status === 'needs_help'
    );
    const needsAttention = allSessions.filter((s) => s.status === 'needs_help');
    const completed = allSessions.filter((s) => s.status === 'completed');

    // Calculate averages
    const totalDuration = completed.reduce((acc, s) => {
      if (s.completedAt) {
        const duration = new Date(s.completedAt).getTime() - new Date(s.startedAt).getTime();
        return acc + duration;
      }
      return acc;
    }, 0);

    const avgDuration = completed.length > 0 ? totalDuration / completed.length / 1000 / 60 : 0; // in minutes

    const totalMessages = completed.reduce((acc, s) => acc + s.messageCount, 0);
    const avgMessages = completed.length > 0 ? totalMessages / completed.length : 0;

    const completionRate = allSessions.length > 0 ? (completed.length / allSessions.length) * 100 : 0;

    // Sentiment breakdown
    const sentimentBreakdown = {
      positive: allSessions.filter((s) => s.sentiment === 'positive').length,
      neutral: allSessions.filter((s) => s.sentiment === 'neutral').length,
      frustrated: allSessions.filter((s) => s.sentiment === 'frustrated').length,
    };

    return {
      totalSessions: allSessions.length,
      activeSessions: activeSessions.length,
      needsAttention: needsAttention.length,
      avgDuration,
      avgMessages,
      completionRate,
      sentimentBreakdown,
    };
  }

  /**
   * Flag session for training
   */
  static async flagForTraining(
    sessionId: string,
    issue: string
  ): Promise<void> {
    await FirestoreService.update(
      getSubCollection('chatSessions'),
      sessionId,
      {
        flaggedForTraining: true,
        trainingIssue: issue,
        flaggedAt: new Date().toISOString(),
      }
    );
  }

  /**
   * Create new session (called when customer starts chat)
   */
  static async createSession(
    customerId: string,
    customerName: string,
    customerEmail: string,
    metadata?: ChatSession['metadata']
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await FirestoreService.set(
      getSubCollection('chatSessions'),
      sessionId,
      {
        customerId,
        customerName,
        customerEmail,
        status: 'active',
        sentiment: 'neutral',
        startedAt: new Date().toISOString(),
        lastMessageAt: new Date().toISOString(),
        messageCount: 0,
        lastMessage: '',
        metadata: metadata ?? {},
      },
      false
    );

    return sessionId;
  }
}

