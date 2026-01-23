/**
 * Call Context Service
 * Handles storing and retrieving call context in Firestore
 * Used for warm transfers and conversation continuity
 */

import { logger } from '@/lib/logger/logger';
import type { QueryConstraint } from 'firebase/firestore';

export interface StoredCallContext {
  callId: string;
  organizationId: string;
  agentId: string;
  mode: 'prospector' | 'closer';

  // Customer info
  customerPhone: string;
  customerName?: string;
  customerCompany?: string;
  customerEmail?: string;

  // Conversation state
  state: string;
  qualificationScore: number;
  sentiment: 'positive' | 'neutral' | 'negative';
  objectionCount: number;
  buyingSignals: string[];

  // Conversation history
  turns: Array<{
    role: 'agent' | 'customer';
    content: string;
    timestamp: string;
  }>;

  // Transfer info
  transferReason?: string;
  transferredTo?: string;
  transferredAt?: string;

  // Timing
  createdAt: string;
  updatedAt: string;
  endedAt?: string;

  // Metrics
  totalTurns: number;
  avgResponseTime?: number;
  callDuration?: number;
}

export interface CallContextQuery {
  organizationId?: string;
  customerPhone?: string;
  state?: string;
  minQualificationScore?: number;
  sentiment?: string;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

class CallContextService {
  private cache = new Map<string, StoredCallContext>();
  private cacheExpiry = new Map<string, number>();
  private readonly CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  /**
   * Store call context in Firestore
   */
  async storeContext(context: StoredCallContext): Promise<void> {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const path = `organizations/${context.organizationId}/callContexts`;

      await FirestoreService.set(
        path,
        context.callId,
        {
          ...context,
          updatedAt: new Date().toISOString(),
        },
        true // merge
      );

      // Update cache
      this.cache.set(context.callId, context);
      this.cacheExpiry.set(context.callId, Date.now() + this.CACHE_TTL);

      logger.info('[CallContext] Stored context', {
        callId: context.callId,
        state: context.state,
        file: 'call-context-service.ts',
      });
    } catch (error) {
      const _message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CallContext] Failed to store context:', error instanceof Error ? error : undefined, {
        file: 'call-context-service.ts',
      });
      throw new Error(`Failed to store call context: ${_message}`);
    }
  }

  /**
   * Get call context from cache or Firestore
   */
  async getContext(organizationId: string, callId: string): Promise<StoredCallContext | null> {
    // Check cache first
    const expiry = this.cacheExpiry.get(callId);
    if (expiry && expiry > Date.now()) {
      const cached = this.cache.get(callId);
      if (cached) {return cached;}
    }

    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const path = `organizations/${organizationId}/callContexts`;
      const context = await FirestoreService.get(path, callId);

      if (context) {
        // Update cache
        this.cache.set(callId, context as StoredCallContext);
        this.cacheExpiry.set(callId, Date.now() + this.CACHE_TTL);
        return context as StoredCallContext;
      }

      return null;
    } catch (error) {
      logger.error('[CallContext] Failed to get context:', error instanceof Error ? error : undefined, {
        file: 'call-context-service.ts',
      });
      return null;
    }
  }

  /**
   * Get context by customer phone number (for callback scenarios)
   */
  async getContextByPhone(organizationId: string, phone: string): Promise<StoredCallContext | null> {
    try {
      const { where, orderBy, limit } = await import('firebase/firestore');

      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const path = `organizations/${organizationId}/callContexts`;
      const results = await FirestoreService.getAll<StoredCallContext>(path, [
        where('customerPhone', '==', phone),
        orderBy('updatedAt', 'desc'),
        limit(1),
      ]);

      return results[0] ?? null;
    } catch (error) {
      logger.error('[CallContext] Failed to get context by phone:', error instanceof Error ? error : undefined, {
        file: 'call-context-service.ts',
      });
      return null;
    }
  }

  /**
   * Update call context
   */
  async updateContext(
    organizationId: string,
    callId: string,
    updates: Partial<StoredCallContext>
  ): Promise<void> {
    try {
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const path = `organizations/${organizationId}/callContexts`;

      await FirestoreService.set(
        path,
        callId,
        {
          ...updates,
          updatedAt: new Date().toISOString(),
        },
        true // merge
      );

      // Update cache if exists
      const cached = this.cache.get(callId);
      if (cached) {
        this.cache.set(callId, { ...cached, ...updates });
      }
    } catch (error) {
      const _message = error instanceof Error ? error.message : 'Unknown error';
      logger.error('[CallContext] Failed to update context:', error instanceof Error ? error : undefined, {
        file: 'call-context-service.ts',
      });
      throw new Error(`Failed to update call context: ${_message}`);
    }
  }

  /**
   * End call context
   */
  async endCall(
    organizationId: string,
    callId: string,
    outcome: {
      finalState: string;
      transferReason?: string;
      callDuration?: number;
    }
  ): Promise<void> {
    await this.updateContext(organizationId, callId, {
      state: outcome.finalState,
      transferReason: outcome.transferReason,
      callDuration: outcome.callDuration,
      endedAt: new Date().toISOString(),
    });

    // Remove from cache
    this.cache.delete(callId);
    this.cacheExpiry.delete(callId);
  }

  /**
   * Query call contexts
   */
  async queryContexts(queryParams: CallContextQuery): Promise<StoredCallContext[]> {
    try {
      const { where, orderBy, limit: limitFn } = await import('firebase/firestore');
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      if (!queryParams.organizationId) {
        throw new Error('organizationId is required for query');
      }

      const path = `organizations/${queryParams.organizationId}/callContexts`;
      const constraints: QueryConstraint[] = [];

      if (queryParams.customerPhone) {
        constraints.push(where('customerPhone', '==', queryParams.customerPhone));
      }

      if (queryParams.state) {
        constraints.push(where('state', '==', queryParams.state));
      }

      if (queryParams.minQualificationScore !== undefined) {
        constraints.push(where('qualificationScore', '>=', queryParams.minQualificationScore));
      }

      if (queryParams.sentiment) {
        constraints.push(where('sentiment', '==', queryParams.sentiment));
      }

      constraints.push(orderBy('updatedAt', 'desc'));
      constraints.push(limitFn(queryParams.limit ?? 50));

      const results = await FirestoreService.getAll<StoredCallContext>(path, constraints);

      return results;
    } catch (error) {
      logger.error('[CallContext] Failed to query contexts:', error instanceof Error ? error : undefined, {
        file: 'call-context-service.ts',
      });
      return [];
    }
  }

  /**
   * Get recent qualified leads
   */
  async getQualifiedLeads(
    organizationId: string,
    minScore: number = 70,
    limit: number = 50
  ): Promise<StoredCallContext[]> {
    return this.queryContexts({
      organizationId,
      minQualificationScore: minScore,
      limit,
    });
  }

  /**
   * Get calls requiring follow-up
   */
  async getFollowUpCalls(organizationId: string, limitCount: number = 50): Promise<StoredCallContext[]> {
    try {
      const { where, orderBy, limit: limitFn } = await import('firebase/firestore');
      const { FirestoreService } = await import('@/lib/db/firestore-service');

      const path = `organizations/${organizationId}/callContexts`;

      // Get calls with positive sentiment but not transferred
      const results = await FirestoreService.getAll<StoredCallContext>(
        path,
        [
          where('sentiment', '==', 'positive'),
          where('qualificationScore', '>=', 50),
          orderBy('updatedAt', 'desc'),
          limitFn(limitCount),
        ]
      );

      // Filter out transferred calls (Firestore doesn't support null comparisons well)
      return results.filter(r => !r.transferReason);
    } catch (error) {
      logger.error('[CallContext] Failed to get follow-up calls:', error instanceof Error ? error : undefined, {
        file: 'call-context-service.ts',
      });
      return [];
    }
  }

  /**
   * Generate transfer summary for human agent
   */
  generateTransferSummary(context: StoredCallContext): string {
    const lines: string[] = [
      '=== AI CALL TRANSFER SUMMARY ===',
      '',
      `Customer: ${context.customerName ?? 'Unknown'} (${context.customerPhone})`,
      context.customerCompany ? `Company: ${context.customerCompany}` : '',
      '',
      `Qualification Score: ${context.qualificationScore}/100`,
      `Sentiment: ${context.sentiment.toUpperCase()}`,
      `Objections Raised: ${context.objectionCount}`,
      context.buyingSignals.length > 0 ? `Buying Signals: ${context.buyingSignals.join(', ')}` : '',
      '',
      '--- CONVERSATION SUMMARY ---',
    ];

    // Add last few turns
    const recentTurns = context.turns.slice(-6);
    for (const turn of recentTurns) {
      lines.push(`${turn.role.toUpperCase()}: ${turn.content.substring(0, 200)}${turn.content.length > 200 ? '...' : ''}`);
    }

    lines.push('');
    lines.push('--- SUGGESTED ACTIONS ---');

    if (context.qualificationScore >= 70) {
      lines.push('- High qualification - proceed to proposal/demo');
    } else if (context.qualificationScore >= 50) {
      lines.push('- Moderate qualification - continue discovery');
    } else {
      lines.push('- Low qualification - verify need/fit');
    }

    if (context.objectionCount > 0) {
      lines.push('- Address outstanding objections');
    }

    if (context.buyingSignals.length > 0) {
      lines.push('- Capitalize on buying signals');
    }

    return lines.filter(l => l !== '').join('\n');
  }

  /**
   * Clear expired cache entries
   */
  clearExpiredCache(): void {
    const now = Date.now();
    for (const [callId, expiry] of Array.from(this.cacheExpiry.entries())) {
      if (expiry <= now) {
        this.cache.delete(callId);
        this.cacheExpiry.delete(callId);
      }
    }
  }

  /**
   * Get conversation logs for training
   */
  async getTrainingData(
    organizationId: string,
    startDate: Date,
    endDate: Date,
    limit: number = 1000
  ): Promise<Array<{ input: string; output: string; context: { state: string; qualificationScore: number; sentiment: string; mode: string } }>> {
    try {
      const contexts = await this.queryContexts({
        organizationId,
        startDate,
        endDate,
        limit,
      });

      const trainingData: Array<{ input: string; output: string; context: { state: string; qualificationScore: number; sentiment: string; mode: string } }> = [];

      for (const ctx of contexts) {
        // Create training pairs from conversation turns
        for (let i = 0; i < ctx.turns.length - 1; i += 2) {
          const customerTurn = ctx.turns[i];
          const agentTurn = ctx.turns[i + 1];

          if (customerTurn?.role === 'customer' && agentTurn?.role === 'agent') {
            trainingData.push({
              input: customerTurn.content,
              output: agentTurn.content,
              context: {
                state: ctx.state,
                qualificationScore: ctx.qualificationScore,
                sentiment: ctx.sentiment,
                mode: ctx.mode,
              },
            });
          }
        }
      }

      return trainingData;
    } catch (error) {
      logger.error('[CallContext] Failed to get training data:', error instanceof Error ? error : undefined, {
        file: 'call-context-service.ts',
      });
      return [];
    }
  }
}

// Export singleton
export const callContextService = new CallContextService();
export default callContextService;
