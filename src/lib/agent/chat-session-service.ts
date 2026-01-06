/**
 * Chat Session Service
 * Manages real-time AI chat sessions for conversations monitoring
 * Replaces mock data in conversations page
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { limit as firestoreLimit, orderBy, where, type QueryConstraint } from 'firebase/firestore';

export interface ChatSession {
  id: string;
  organizationId: string;
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
   * Get active chat sessions for organization
   */
  static async getActiveSessions(
    organizationId: string,
    limitCount: number = 50
  ): Promise<ChatSession[]> {
    const sessions = await FirestoreService.getAll<ChatSession>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
      [
        where('status', 'in', ['active', 'needs_help']),
        orderBy('lastMessageAt', 'desc'),
        firestoreLimit(limitCount),
      ]
    );

    return sessions;
  }

  /**
   * Get session history (completed sessions)
   */
  static async getSessionHistory(
    organizationId: string,
    limitCount: number = 100,
    filters?: QueryConstraint[]
  ): Promise<ChatSession[]> {
    const constraints = [
      where('status', 'in', ['completed', 'abandoned']),
      orderBy('completedAt', 'desc'),
      firestoreLimit(limitCount),
      ...(filters ?? []),
    ];

    const sessions = await FirestoreService.getAll<ChatSession>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
      constraints
    );

    return sessions;
  }

  /**
   * Subscribe to active sessions (real-time)
   */
  static subscribeToActiveSessions(
    organizationId: string,
    callback: (sessions: ChatSession[]) => void
  ): () => void {
    return FirestoreService.subscribeToCollection<ChatSession>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
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
    organizationId: string,
    sessionId: string
  ): Promise<ChatMessage[]> {
    const messages = await FirestoreService.getAll<ChatMessage>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions/${sessionId}/messages`,
      [orderBy('timestamp', 'asc')]
    );

    return messages;
  }

  /**
   * Subscribe to session messages (real-time)
   */
  static subscribeToSessionMessages(
    organizationId: string,
    sessionId: string,
    callback: (messages: ChatMessage[]) => void
  ): () => void {
    return FirestoreService.subscribeToCollection<ChatMessage>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions/${sessionId}/messages`,
      [orderBy('timestamp', 'asc')],
      callback
    );
  }

  /**
   * Request agent takeover
   */
  static async requestTakeover(
    organizationId: string,
    sessionId: string,
    agentId: string,
    reason?: string
  ): Promise<void> {
    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
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
    await this.addMessage(organizationId, sessionId, {
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
    organizationId: string,
    sessionId: string,
    outcome?: 'sale' | 'no_sale' | 'abandoned' | 'human_requested'
  ): Promise<void> {
    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
      sessionId,
      {
        status: 'completed',
        completedAt: new Date().toISOString(),
        outcome,
      }
    );
  }

  /**
   * Add message to session
   */
  static async addMessage(
    organizationId: string,
    sessionId: string,
    message: Omit<ChatMessage, 'id' | 'sessionId' | 'timestamp'>
  ): Promise<void> {
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions/${sessionId}/messages`,
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
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
      sessionId,
      {
        lastMessage: message.content.substring(0, 200),
        lastMessageAt: new Date().toISOString(),
        messageCount: (await this.getSessionMessages(organizationId, sessionId)).length,
      }
    );
  }

  /**
   * Update session sentiment
   */
  static async updateSentiment(
    organizationId: string,
    sessionId: string,
    sentiment: 'positive' | 'neutral' | 'frustrated'
  ): Promise<void> {
    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
      sessionId,
      { sentiment }
    );
  }

  /**
   * Get session metrics
   */
  static async getMetrics(organizationId: string): Promise<SessionMetrics> {
    const allSessions = await FirestoreService.getAll<ChatSession>(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
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
    organizationId: string,
    sessionId: string,
    issue: string
  ): Promise<void> {
    await FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
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
    organizationId: string,
    customerId: string,
    customerName: string,
    customerEmail: string,
    metadata?: ChatSession['metadata']
  ): Promise<string> {
    const sessionId = `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/chatSessions`,
      sessionId,
      {
        organizationId,
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


