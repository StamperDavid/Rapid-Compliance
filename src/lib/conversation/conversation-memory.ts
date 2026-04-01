/**
 * ConversationMemory Service
 *
 * Unified retrieval layer for customer interaction history across all channels.
 * Agents query this service to get context before contacting a lead.
 *
 * CHANNELS QUERIED:
 * - Voice calls (callContexts + conversations collection)
 * - Chat sessions (chatSessions)
 * - SMS messages (smsMessages)
 * - Orchestrator conversations (orchestratorConversations)
 *
 * KEY METHODS:
 * - getInteractions(identifier) — All interactions for a customer
 * - brief(identifier) — Structured Lead Briefing for agent consumption
 * - getChannelHistory(identifier, channel) — Single-channel history
 *
 * ARCHITECTURE:
 * - ConversationMemory = customer interaction history (this service)
 * - MemoryVault = agent-to-agent coordination (separate concern)
 *
 * @module lib/conversation
 */

import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { adminDb } from '@/lib/firebase/admin';

function getDb() {
  if (!adminDb) {throw new Error('Firebase Admin not initialized');}
  return adminDb;
}

// ============================================================================
// TYPES
// ============================================================================

export type ConversationChannel = 'voice' | 'chat' | 'sms' | 'email' | 'orchestrator';

export interface CustomerInteraction {
  id: string;
  channel: ConversationChannel;
  timestamp: string;
  endedAt?: string;
  durationSeconds?: number;

  // Customer identification
  customerPhone?: string;
  customerEmail?: string;
  customerName?: string;
  customerId?: string;
  leadId?: string;

  // Content summary
  summary?: string;
  transcript?: string;
  messageCount?: number;
  lastMessage?: string;

  // Analysis data (populated if auto-analysis ran)
  sentiment?: 'positive' | 'neutral' | 'negative' | 'frustrated';
  qualificationScore?: number;
  objectionCount?: number;
  buyingSignals?: string[];
  outcome?: string;

  // Raw source reference
  sourceCollection: string;
  sourceId: string;
}

export interface InteractionQuery {
  phone?: string;
  email?: string;
  customerId?: string;
  leadId?: string;
  channel?: ConversationChannel;
  limit?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface LeadBriefing {
  identifier: string;
  identifierType: 'phone' | 'email' | 'customerId' | 'leadId';
  generatedAt: string;

  // Contact summary
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerCompany?: string;

  // Interaction overview
  totalInteractions: number;
  channelBreakdown: Record<ConversationChannel, number>;
  lastContactDate?: string;
  lastContactChannel?: ConversationChannel;
  daysSinceLastContact?: number;

  // Sentiment & qualification
  sentimentTrend: 'improving' | 'declining' | 'stable' | 'unknown';
  currentSentiment?: string;
  highestQualificationScore?: number;

  // Key context
  keyContext: string[];
  openObjections: string[];
  buyingSignals: string[];
  painPoints: string[];

  // Recommendations
  recommendedApproach: string[];

  // Recent interactions (summarized)
  recentInteractions: Array<{
    channel: ConversationChannel;
    date: string;
    summary: string;
    sentiment?: string;
    outcome?: string;
  }>;
}

// ============================================================================
// SERVICE
// ============================================================================

class ConversationMemoryService {
  /**
   * Get all interactions for a customer across all channels
   */
  async getInteractions(query: InteractionQuery): Promise<CustomerInteraction[]> {
    const interactions: CustomerInteraction[] = [];

    try {
      // Query all channels in parallel for speed
      const [voiceCalls, chatSessions, smsMessages] = await Promise.all([
        this.getVoiceInteractions(query),
        this.getChatInteractions(query),
        this.getSmsInteractions(query),
      ]);

      interactions.push(...voiceCalls, ...chatSessions, ...smsMessages);

      // Sort by timestamp descending (most recent first)
      interactions.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      );

      // Apply limit
      if (query.limit) {
        return interactions.slice(0, query.limit);
      }

      return interactions;
    } catch (error) {
      logger.error('[ConversationMemory] Failed to get interactions:', error instanceof Error ? error : new Error(String(error)), { file: 'conversation-memory.ts' });
      return interactions;
    }
  }

  /**
   * Get a structured Lead Briefing for agent consumption
   */
  async brief(identifier: string, identifierType: 'phone' | 'email' | 'customerId' | 'leadId' = 'phone'): Promise<LeadBriefing> {
    const query: InteractionQuery = {};
    switch (identifierType) {
      case 'phone': query.phone = identifier; break;
      case 'email': query.email = identifier; break;
      case 'customerId': query.customerId = identifier; break;
      case 'leadId': query.leadId = identifier; break;
    }

    const interactions = await this.getInteractions(query);
    const analyses = await this.getAnalyses(interactions.map(i => i.sourceId));

    return this.buildBriefing(identifier, identifierType, interactions, analyses);
  }

  /**
   * Get interaction history for a single channel
   */
  async getChannelHistory(
    query: InteractionQuery,
    channel: ConversationChannel
  ): Promise<CustomerInteraction[]> {
    switch (channel) {
      case 'voice': return this.getVoiceInteractions(query);
      case 'chat': return this.getChatInteractions(query);
      case 'sms': return this.getSmsInteractions(query);
      default: return [];
    }
  }

  // ============================================================================
  // CHANNEL-SPECIFIC QUERIES
  // ============================================================================

  /**
   * Query voice call interactions from callContexts and conversations collections
   */
  private async getVoiceInteractions(query: InteractionQuery): Promise<CustomerInteraction[]> {
    try {
      const interactions: CustomerInteraction[] = [];

      // Query conversations collection for voice records via adminDb
      let voiceQuery = getDb().collection(getSubCollection('conversations'))
        .where('channel', '==', 'voice');

      if (query.phone) {
        voiceQuery = voiceQuery.where('customerPhone', '==', query.phone);
      }

      const voiceSnap = await voiceQuery
        .orderBy('createdAt', 'desc')
        .limit(query.limit ?? 50)
        .get();

      for (const doc of voiceSnap.docs) {
        const conv = doc.data();
        interactions.push({
          id: doc.id,
          channel: 'voice',
          timestamp: (conv.createdAt as string) ?? '',
          endedAt: conv.endedAt as string | undefined,
          durationSeconds: conv.duration as number | undefined,
          customerPhone: conv.customerPhone as string | undefined,
          customerName: conv.customerName as string | undefined,
          customerEmail: conv.customerEmail as string | undefined,
          leadId: conv.leadId as string | undefined,
          transcript: conv.transcript as string | undefined,
          summary: conv.title as string | undefined,
          sentiment: conv.sentiment as CustomerInteraction['sentiment'],
          qualificationScore: conv.qualificationScore as number | undefined,
          objectionCount: conv.objectionCount as number | undefined,
          buyingSignals: conv.buyingSignals as string[] | undefined,
          outcome: conv.status as string | undefined,
          messageCount: conv.turnCount as number | undefined,
          sourceCollection: 'conversations',
          sourceId: doc.id,
        });
      }

      // Also query callContexts for legacy/transfer records
      if (query.phone) {
        const callSnap = await getDb().collection(getSubCollection('callContexts'))
          .where('customerPhone', '==', query.phone)
          .orderBy('updatedAt', 'desc')
          .limit(query.limit ?? 20)
          .get();

        for (const doc of callSnap.docs) {
          const ctx = doc.data();
          const callId = ctx.callId as string;
          if (interactions.some(i => i.id === `voice-${callId}`)) {
            continue;
          }

          interactions.push({
            id: `callctx-${callId}`,
            channel: 'voice',
            timestamp: (ctx.createdAt as string) ?? (ctx.updatedAt as string) ?? '',
            endedAt: ctx.endedAt as string | undefined,
            durationSeconds: ctx.callDuration as number | undefined,
            customerPhone: ctx.customerPhone as string | undefined,
            customerName: ctx.customerName as string | undefined,
            sentiment: ctx.sentiment as CustomerInteraction['sentiment'],
            qualificationScore: ctx.qualificationScore as number | undefined,
            objectionCount: ctx.objectionCount as number | undefined,
            buyingSignals: ctx.buyingSignals as string[] | undefined,
            outcome: ctx.state as string | undefined,
            messageCount: ctx.totalTurns as number | undefined,
            sourceCollection: 'callContexts',
            sourceId: callId,
          });
        }
      }

      return interactions;
    } catch (error) {
      logger.error('[ConversationMemory] Voice query failed:', error instanceof Error ? error : new Error(String(error)), { file: 'conversation-memory.ts' });
      return [];
    }
  }

  /**
   * Query chat session interactions
   */
  private async getChatInteractions(query: InteractionQuery): Promise<CustomerInteraction[]> {
    try {
      const collectionPath = getSubCollection('chatSessions');
      let chatQuery: FirebaseFirestore.Query = getDb().collection(collectionPath);

      if (query.email) {
        chatQuery = chatQuery.where('customerEmail', '==', query.email);
      } else if (query.customerId) {
        chatQuery = chatQuery.where('customerId', '==', query.customerId);
      } else if (query.phone) {
        return [];
      } else {
        return [];
      }

      const snap = await chatQuery
        .orderBy('startedAt', 'desc')
        .limit(query.limit ?? 50)
        .get();

      return snap.docs.map(doc => {
        const session = doc.data();
        return {
          id: `chat-${doc.id}`,
          channel: 'chat' as ConversationChannel,
          timestamp: (session.startedAt as string) ?? '',
          endedAt: session.completedAt as string | undefined,
          customerEmail: session.customerEmail as string | undefined,
          customerName: session.customerName as string | undefined,
          customerId: session.customerId as string | undefined,
          summary: session.lastMessage as string | undefined,
          messageCount: session.messageCount as number | undefined,
          lastMessage: session.lastMessage as string | undefined,
          sentiment: this.mapChatSentiment(session.sentiment as string),
          outcome: session.status as string | undefined,
          sourceCollection: 'chatSessions',
          sourceId: doc.id,
        };
      });
    } catch (error) {
      logger.error('[ConversationMemory] Chat query failed:', error instanceof Error ? error : new Error(String(error)), { file: 'conversation-memory.ts' });
      return [];
    }
  }

  /**
   * Query SMS interactions
   */
  private async getSmsInteractions(query: InteractionQuery): Promise<CustomerInteraction[]> {
    try {
      if (!query.phone) {
        return [];
      }

      const snap = await getDb().collection(getSubCollection('smsMessages'))
        .where('to', '==', query.phone)
        .orderBy('sentAt', 'desc')
        .limit(query.limit ?? 50)
        .get();

      return snap.docs.map(doc => {
        const msg = doc.data();
        return {
          id: `sms-${msg.messageId as string}`,
          channel: 'sms' as ConversationChannel,
          timestamp: (msg.sentAt as string) ?? '',
          customerPhone: msg.to as string | undefined,
          lastMessage: msg.message as string | undefined,
          summary: msg.message as string | undefined,
          outcome: msg.status as string | undefined,
          sourceCollection: 'smsMessages',
          sourceId: msg.messageId as string,
        };
      });
    } catch (error) {
      logger.error('[ConversationMemory] SMS query failed:', error instanceof Error ? error : new Error(String(error)), { file: 'conversation-memory.ts' });
      return [];
    }
  }

  // ============================================================================
  // ANALYSIS RETRIEVAL
  // ============================================================================

  /**
   * Get stored analyses for a set of conversation IDs
   */
  private async getAnalyses(sourceIds: string[]): Promise<Map<string, Record<string, unknown>>> {
    const analysisMap = new Map<string, Record<string, unknown>>();
    if (sourceIds.length === 0) {
      return analysisMap;
    }

    try {
      const analysesPath = getSubCollection('conversationAnalyses');

      // Batch get analyses
      for (const id of sourceIds) {
        try {
          const doc = await getDb().collection(analysesPath).doc(id).get();
          if (doc.exists) {
            analysisMap.set(id, doc.data() as Record<string, unknown>);
          }
        } catch {
          // Skip missing analyses
        }
      }
    } catch (error) {
      logger.error('[ConversationMemory] Analysis retrieval failed:', error instanceof Error ? error : new Error(String(error)), { file: 'conversation-memory.ts' });
    }

    return analysisMap;
  }

  // ============================================================================
  // BRIEFING GENERATOR
  // ============================================================================

  /**
   * Build a structured Lead Briefing from interactions and analyses
   */
  private buildBriefing(
    identifier: string,
    identifierType: 'phone' | 'email' | 'customerId' | 'leadId',
    interactions: CustomerInteraction[],
    analyses: Map<string, Record<string, unknown>>
  ): LeadBriefing {
    // Extract customer info from most recent interaction
    const latestInteraction = interactions[0];
    const customerName = interactions.find(i => i.customerName)?.customerName;
    const customerPhone = interactions.find(i => i.customerPhone)?.customerPhone;
    const customerEmail = interactions.find(i => i.customerEmail)?.customerEmail;

    // Channel breakdown
    const channelBreakdown: Record<ConversationChannel, number> = {
      voice: 0, chat: 0, sms: 0, email: 0, orchestrator: 0,
    };
    for (const interaction of interactions) {
      channelBreakdown[interaction.channel]++;
    }

    // Sentiment tracking
    const sentiments = interactions
      .filter(i => i.sentiment)
      .map(i => i.sentiment);
    const sentimentTrend = this.calculateSentimentTrend(sentiments as string[]);
    const currentSentiment = sentiments[0]; // Most recent

    // Highest qualification score
    const qualScores = interactions
      .filter(i => i.qualificationScore != null)
      .map(i => i.qualificationScore as number);
    const highestQualificationScore = qualScores.length > 0 ? Math.max(...qualScores) : undefined;

    // Aggregate buying signals and objections from analyses
    const allBuyingSignals: string[] = [];
    const allObjections: string[] = [];
    const allPainPoints: string[] = [];
    const keyContext: string[] = [];

    for (const interaction of interactions) {
      if (interaction.buyingSignals) {
        allBuyingSignals.push(...interaction.buyingSignals);
      }
    }

    // Extract from analyses
    for (const [, analysis] of analyses) {
      const objections = analysis['objections'] as Array<Record<string, unknown>> | undefined;
      if (objections) {
        for (const obj of objections) {
          if (!obj['wasAddressed']) {
            allObjections.push(obj['objection'] as string);
          }
        }
      }

      const topics = analysis['topics'] as Record<string, unknown> | undefined;
      if (topics) {
        const mainTopics = topics['mainTopics'] as Array<Record<string, unknown>> | undefined;
        if (mainTopics) {
          for (const topic of mainTopics) {
            if (topic['category'] === 'pain_points') {
              allPainPoints.push(topic['name'] as string);
            }
            keyContext.push(`${topic['name']}: discussed for ${topic['duration']}s`);
          }
        }
      }

      const summary = analysis['summary'] as string | undefined;
      if (summary) {
        keyContext.push(summary);
      }
    }

    // Days since last contact
    const lastContactDate = latestInteraction?.timestamp;
    const daysSinceLastContact = lastContactDate
      ? Math.floor((Date.now() - new Date(lastContactDate).getTime()) / (1000 * 60 * 60 * 24))
      : undefined;

    // Build recommended approach
    const recommendedApproach = this.buildRecommendations(
      interactions,
      sentimentTrend,
      allObjections,
      allBuyingSignals,
      highestQualificationScore,
      daysSinceLastContact
    );

    // Build recent interactions summary (last 5)
    const recentInteractions = interactions.slice(0, 5).map(i => ({
      channel: i.channel,
      date: i.timestamp,
      summary: i.summary ?? i.lastMessage ?? 'No summary available',
      sentiment: i.sentiment,
      outcome: i.outcome,
    }));

    return {
      identifier,
      identifierType,
      generatedAt: new Date().toISOString(),
      customerName,
      customerPhone,
      customerEmail,
      customerCompany: undefined, // Will be populated when we add company field to interactions
      totalInteractions: interactions.length,
      channelBreakdown,
      lastContactDate,
      lastContactChannel: latestInteraction?.channel,
      daysSinceLastContact,
      sentimentTrend,
      currentSentiment,
      highestQualificationScore,
      keyContext: [...new Set(keyContext)].slice(0, 10),
      openObjections: [...new Set(allObjections)],
      buyingSignals: [...new Set(allBuyingSignals)],
      painPoints: [...new Set(allPainPoints)],
      recommendedApproach,
      recentInteractions,
    };
  }

  // ============================================================================
  // HELPERS
  // ============================================================================

  /**
   * Calculate sentiment trend from ordered sentiment values
   */
  private calculateSentimentTrend(sentiments: string[]): LeadBriefing['sentimentTrend'] {
    if (sentiments.length < 2) {
      return 'unknown';
    }

    const toScore = (s: string): number => {
      switch (s) {
        case 'positive':
          return 1;
        case 'neutral':
          return 0;
        case 'negative':
        case 'frustrated':
          return -1;
        default:
          return 0;
      }
    };

    // Compare first half vs second half average
    const mid = Math.floor(sentiments.length / 2);
    const recentAvg = sentiments.slice(0, mid).reduce((sum, s) => sum + toScore(s), 0) / mid;
    const olderAvg = sentiments.slice(mid).reduce((sum, s) => sum + toScore(s), 0) / (sentiments.length - mid);

    const diff = recentAvg - olderAvg;
    if (diff > 0.3) {
      return 'improving';
    }
    if (diff < -0.3) {
      return 'declining';
    }
    return 'stable';
  }

  /**
   * Map chat sentiment values to standard format
   */
  private mapChatSentiment(sentiment: string | undefined): CustomerInteraction['sentiment'] {
    if (!sentiment) {
      return undefined;
    }
    if (sentiment === 'frustrated') {
      return 'negative';
    }
    if (sentiment === 'positive') {
      return 'positive';
    }
    if (sentiment === 'neutral') {
      return 'neutral';
    }
    if (sentiment === 'negative') {
      return 'negative';
    }
    return 'neutral';
  }

  /**
   * Build recommended approach based on interaction history
   */
  private buildRecommendations(
    interactions: CustomerInteraction[],
    sentimentTrend: string,
    objections: string[],
    buyingSignals: string[],
    qualScore: number | undefined,
    daysSinceContact: number | undefined,
  ): string[] {
    const recommendations: string[] = [];

    // Time-based recommendations
    if (daysSinceContact != null && daysSinceContact > 7) {
      recommendations.push(`Re-engage — ${daysSinceContact} days since last contact`);
    }

    // Sentiment-based
    if (sentimentTrend === 'declining') {
      recommendations.push('Sentiment is declining — lead with empathy and value');
    } else if (sentimentTrend === 'improving') {
      recommendations.push('Sentiment improving — maintain momentum');
    }

    // Objection-based
    if (objections.length > 0) {
      recommendations.push(`Address open objections: ${objections.slice(0, 3).join(', ')}`);
    }

    // Buying signal-based
    if (buyingSignals.length > 0) {
      recommendations.push(`Capitalize on buying signals: ${buyingSignals.slice(0, 3).join(', ')}`);
    }

    // Qualification-based
    if (qualScore != null) {
      if (qualScore >= 70) {
        recommendations.push('Highly qualified — move toward close');
      } else if (qualScore >= 50) {
        recommendations.push('Moderately qualified — continue discovery');
      } else {
        recommendations.push('Low qualification — verify fit before investing more time');
      }
    }

    // Channel preference
    const voiceCount = interactions.filter(i => i.channel === 'voice').length;
    const chatCount = interactions.filter(i => i.channel === 'chat').length;
    if (voiceCount > chatCount && voiceCount > 1) {
      recommendations.push('Customer prefers voice — consider calling');
    } else if (chatCount > voiceCount && chatCount > 1) {
      recommendations.push('Customer prefers chat — reach out via messaging');
    }

    return recommendations.length > 0 ? recommendations : ['No prior interactions — standard outreach'];
  }
}

// Export singleton
export const conversationMemory = new ConversationMemoryService();
export default conversationMemory;
