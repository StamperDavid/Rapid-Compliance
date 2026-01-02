/**
 * Conversation Intelligence - Signal Bus Events
 * 
 * Event definitions for conversation intelligence integration with the Signal Bus.
 * Enables workflow automation based on conversation analysis results.
 * 
 * EVENT TYPES:
 * - conversation.analyzed - Analysis completed
 * - conversation.low_score - Poor conversation quality detected
 * - conversation.red_flag - Critical warning identified
 * - conversation.coaching_needed - Coaching opportunity detected
 * - conversation.competitor_mentioned - Competitor discussion identified
 * - conversation.objection_raised - Unaddressed objection detected
 * - conversation.positive_signal - Buying signal identified
 * - conversation.follow_up_required - Action items generated
 * - conversation.sentiment_negative - Negative sentiment trend
 * 
 * @module lib/conversation
 */

import type { SalesSignal } from '@/lib/orchestration';
import type {
  ConversationAnalysis,
  Conversation,
  CoachingInsight,
  RedFlag,
  CompetitorMention,
  ObjectionAnalysis,
  PositiveSignal,
  FollowUpAction,
} from './types';

// ============================================================================
// EVENT TYPE DEFINITIONS
// ============================================================================

/**
 * Conversation analyzed event
 * 
 * Emitted when conversation analysis is complete.
 * 
 * TRIGGERS:
 * - After successful conversation analysis
 * - Every time a conversation is re-analyzed
 * 
 * USE CASES:
 * - Update CRM with conversation insights
 * - Trigger follow-up workflows
 * - Log analysis to analytics dashboard
 */
export interface ConversationAnalyzedEvent extends SalesSignal {
  type: 'conversation.analyzed';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    conversationType: string;
    overallScore: number;
    sentiment: string;
    talkRatio: number;
    redFlagsCount: number;
    coachingInsightsCount: number;
    followUpActionsCount: number;
    dealId?: string;
    leadId?: string;
    repId: string;
    duration: number; // seconds
    tokensUsed: number;
  };
}

/**
 * Low conversation score event
 * 
 * Emitted when conversation score is below threshold (< 50).
 * 
 * TRIGGERS:
 * - Overall conversation score < 50
 * - Multiple quality indicators marked as 'poor'
 * 
 * USE CASES:
 * - Alert sales manager for coaching intervention
 * - Trigger rep training recommendation
 * - Flag deal as at-risk if associated
 */
export interface ConversationLowScoreEvent extends SalesSignal {
  type: 'conversation.low_score';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    overallScore: number;
    discoveryScore: number;
    objectionHandlingScore: number;
    closingScore: number;
    primaryIssue: string;
    recommendation: string;
    repId: string;
    managerId?: string;
  };
}

/**
 * Red flag detected event
 * 
 * Emitted when critical warning is identified.
 * 
 * TRIGGERS:
 * - Critical or high severity red flag detected
 * - Multiple red flags in single conversation
 * 
 * USE CASES:
 * - Immediate manager notification
 * - Create urgent follow-up task
 * - Flag deal as at-risk
 */
export interface ConversationRedFlagEvent extends SalesSignal {
  type: 'conversation.red_flag';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    redFlagType: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    description: string;
    recommendation: string;
    quote?: string;
    timestamp?: number;
    dealId?: string;
    repId: string;
  };
}

/**
 * Coaching needed event
 * 
 * Emitted when high-impact coaching opportunity is identified.
 * 
 * TRIGGERS:
 * - Critical or high priority coaching insight
 * - Repeated skill gap across multiple conversations
 * 
 * USE CASES:
 * - Schedule coaching session
 * - Add to coaching dashboard
 * - Send coaching resources to rep
 */
export interface ConversationCoachingNeededEvent extends SalesSignal {
  type: 'conversation.coaching_needed';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    coachingCategory: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    insight: string;
    whatToImprove: string;
    specificExample: string;
    recommendedAction: string;
    skillArea: string;
    impact: number;
    repId: string;
    managerId?: string;
  };
}

/**
 * Competitor mentioned event
 * 
 * Emitted when competitor is discussed in conversation.
 * 
 * TRIGGERS:
 * - Competitor mention detected
 * - High concern level (competitive threat)
 * 
 * USE CASES:
 * - Send battlecard to rep
 * - Alert sales manager
 * - Track competitive intelligence
 */
export interface ConversationCompetitorMentionedEvent extends SalesSignal {
  type: 'conversation.competitor_mentioned';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    competitor: string;
    mentions: number;
    sentiment: number;
    concernLevel: 'high' | 'medium' | 'low';
    context: string[];
    recommendedResponse: string;
    battlecardId?: string;
    dealId?: string;
    repId: string;
  };
}

/**
 * Objection raised event
 * 
 * Emitted when objection is not adequately addressed.
 * 
 * TRIGGERS:
 * - Objection detected and not addressed
 * - Objection addressed poorly
 * 
 * USE CASES:
 * - Send objection handling resources
 * - Create follow-up task to address
 * - Alert manager for coaching
 */
export interface ConversationObjectionRaisedEvent extends SalesSignal {
  type: 'conversation.objection_raised';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    objectionType: string;
    objection: string;
    quote: string;
    severity: 'critical' | 'high' | 'medium' | 'low';
    wasAddressed: boolean;
    responseQuality?: string;
    recommendedResponse: string;
    timestamp: number;
    repId: string;
  };
}

/**
 * Positive signal detected event
 * 
 * Emitted when strong buying signal is identified.
 * 
 * TRIGGERS:
 * - Strong positive signal detected
 * - Multiple positive signals in conversation
 * 
 * USE CASES:
 * - Accelerate deal timeline
 * - Notify manager of hot opportunity
 * - Trigger proposal generation
 */
export interface ConversationPositiveSignalEvent extends SalesSignal {
  type: 'conversation.positive_signal';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    signalType: string;
    strength: 'strong' | 'moderate' | 'weak';
    description: string;
    quote?: string;
    timestamp?: number;
    impact: string;
    dealId?: string;
    repId: string;
  };
}

/**
 * Follow-up required event
 * 
 * Emitted when critical follow-up action is recommended.
 * 
 * TRIGGERS:
 * - Critical or high priority follow-up action
 * - Urgent deadline (within 24 hours)
 * 
 * USE CASES:
 * - Create task in CRM
 * - Send reminder to rep
 * - Add to follow-up queue
 */
export interface ConversationFollowUpRequiredEvent extends SalesSignal {
  type: 'conversation.follow_up_required';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    actionType: string;
    priority: 'critical' | 'high' | 'medium' | 'low';
    title: string;
    description: string;
    reasoning: string;
    deadline: string;
    estimatedEffort: number;
    dealId?: string;
    repId: string;
  };
}

/**
 * Negative sentiment event
 * 
 * Emitted when negative sentiment trend is detected.
 * 
 * TRIGGERS:
 * - Overall negative or very negative sentiment
 * - Sentiment declining during conversation
 * - Critical negative moment detected
 * 
 * USE CASES:
 * - Alert manager immediately
 * - Create damage control task
 * - Flag deal as at-risk
 */
export interface ConversationSentimentNegativeEvent extends SalesSignal {
  type: 'conversation.sentiment_negative';
  metadata: {
    source: 'conversation-intelligence';
    conversationId: string;
    sentimentPolarity: string;
    sentimentScore: number;
    trendDirection: 'declining' | 'stable';
    criticalMomentsCount: number;
    recommendation: string;
    dealId?: string;
    repId: string;
  };
}

// ============================================================================
// EVENT FACTORIES
// ============================================================================

/**
 * Create conversation analyzed event
 */
export function createConversationAnalyzedEvent(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationAnalyzedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> {
  return {
    type: 'conversation.analyzed',
    leadId: conversation.leadId || 'unknown',
    orgId: analysis.organizationId,
    workspaceId: analysis.workspaceId,
    confidence: analysis.confidence / 100,
    priority: 'Low',
    metadata: {
      source: 'conversation-intelligence',
      conversationId: conversation.id,
      conversationType: conversation.type,
      overallScore: analysis.scores.overall,
      sentiment: analysis.sentiment.overall.polarity,
      talkRatio: analysis.talkRatio.repPercentage,
      redFlagsCount: analysis.redFlags.length,
      coachingInsightsCount: analysis.coachingInsights.length,
      followUpActionsCount: analysis.followUpActions.length,
      dealId: conversation.dealId,
      leadId: conversation.leadId,
      repId: conversation.repId,
      duration: conversation.duration,
      tokensUsed: analysis.tokensUsed,
    },
  } as ConversationAnalyzedEvent;
}

/**
 * Create low score event
 */
export function createLowScoreEvent(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationLowScoreEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> | null {
  if (analysis.scores.overall >= 50) {
    return null;
  }
  
  // Find primary issue (lowest score)
  const scores = analysis.scores;
  const scoreEntries = [
    { area: 'discovery', score: scores.discovery },
    { area: 'objection_handling', score: scores.objectionHandling },
    { area: 'closing', score: scores.closing },
    { area: 'value_articulation', score: scores.valueArticulation },
    { area: 'rapport', score: scores.rapport },
  ];
  
  const lowestScore = scoreEntries.sort((a, b) => a.score - b.score)[0];
  
  return {
    type: 'conversation.low_score',
    leadId: conversation.leadId || 'unknown',
    orgId: analysis.organizationId,
    workspaceId: analysis.workspaceId,
    confidence: analysis.confidence / 100,
    priority: analysis.scores.overall < 30 ? 'High' : 'Medium',
    metadata: {
      source: 'conversation-intelligence',
      conversationId: conversation.id,
      overallScore: analysis.scores.overall,
      discoveryScore: scores.discovery,
      objectionHandlingScore: scores.objectionHandling,
      closingScore: scores.closing,
      primaryIssue: lowestScore.area,
      recommendation: `Focus on improving ${lowestScore.area.replace('_', ' ')} skills`,
      repId: conversation.repId,
    },
  } as ConversationLowScoreEvent;
}

/**
 * Create red flag events
 */
export function createRedFlagEvents(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationRedFlagEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>[] {
  return analysis.redFlags
    .filter(flag => flag.severity === 'critical' || flag.severity === 'high')
    .map(flag => ({
      type: 'conversation.red_flag' as const,
      leadId: conversation.leadId || 'unknown',
      orgId: analysis.organizationId,
      workspaceId: analysis.workspaceId,
      confidence: 0.9,
      priority: flag.severity === 'critical' ? 'High' as const : 'Medium' as const,
      metadata: {
        source: 'conversation-intelligence',
        conversationId: conversation.id,
        redFlagType: flag.type,
        severity: flag.severity,
        description: flag.description,
        recommendation: flag.recommendation,
        quote: flag.quote,
        timestamp: flag.timestamp,
        dealId: conversation.dealId,
        repId: conversation.repId,
      },
    }));
}

/**
 * Create coaching needed events
 */
export function createCoachingNeededEvents(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationCoachingNeededEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>[] {
  return analysis.coachingInsights
    .filter(insight => insight.priority === 'critical' || insight.priority === 'high')
    .map(insight => ({
      type: 'conversation.coaching_needed' as const,
      leadId: conversation.leadId || 'unknown',
      orgId: analysis.organizationId,
      workspaceId: analysis.workspaceId,
      confidence: 0.85,
      priority: insight.priority === 'critical' ? 'High' as const : 'Medium' as const,
      metadata: {
        source: 'conversation-intelligence',
        conversationId: conversation.id,
        coachingCategory: insight.category,
        priority: insight.priority,
        insight: insight.insight,
        whatToImprove: insight.whatToImprove,
        specificExample: insight.specificExample,
        recommendedAction: insight.recommendedAction,
        skillArea: insight.skillArea,
        impact: insight.impact,
        repId: conversation.repId,
      },
    }));
}

/**
 * Create competitor mentioned events
 */
export function createCompetitorMentionedEvents(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationCompetitorMentionedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>[] {
  return analysis.competitors
    .filter(competitor => competitor.concernLevel === 'high' || competitor.mentions >= 3)
    .map(competitor => ({
      type: 'conversation.competitor_mentioned' as const,
      leadId: conversation.leadId || 'unknown',
      orgId: analysis.organizationId,
      workspaceId: analysis.workspaceId,
      confidence: 0.9,
      priority: competitor.concernLevel === 'high' ? 'High' as const : 'Medium' as const,
      metadata: {
        source: 'conversation-intelligence',
        conversationId: conversation.id,
        competitor: competitor.competitor,
        mentions: competitor.mentions,
        sentiment: competitor.sentiment,
        concernLevel: competitor.concernLevel,
        context: competitor.context,
        recommendedResponse: competitor.recommendedResponse,
        battlecardId: competitor.battlecardId,
        dealId: conversation.dealId,
        repId: conversation.repId,
      },
    }));
}

/**
 * Create objection raised events
 */
export function createObjectionRaisedEvents(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationObjectionRaisedEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>[] {
  return analysis.objections
    .filter(objection => 
      !objection.wasAddressed || 
      objection.responseQuality === 'poor' ||
      objection.severity === 'critical'
    )
    .map(objection => ({
      type: 'conversation.objection_raised' as const,
      leadId: conversation.leadId || 'unknown',
      orgId: analysis.organizationId,
      workspaceId: analysis.workspaceId,
      confidence: 0.85,
      priority: objection.severity === 'critical' ? 'High' as const : 'Medium' as const,
      metadata: {
        source: 'conversation-intelligence',
        conversationId: conversation.id,
        objectionType: objection.type,
        objection: objection.objection,
        quote: objection.quote,
        severity: objection.severity,
        wasAddressed: objection.wasAddressed,
        responseQuality: objection.responseQuality,
        recommendedResponse: objection.recommendedResponse || 'Review objection handling best practices',
        timestamp: objection.timestamp,
        repId: conversation.repId,
      },
    }));
}

/**
 * Create positive signal events
 */
export function createPositiveSignalEvents(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationPositiveSignalEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>[] {
  return analysis.positiveSignals
    .filter(signal => signal.strength === 'strong')
    .map(signal => ({
      type: 'conversation.positive_signal' as const,
      leadId: conversation.leadId || 'unknown',
      orgId: analysis.organizationId,
      workspaceId: analysis.workspaceId,
      confidence: 0.85,
      priority: 'Medium' as const,
      metadata: {
        source: 'conversation-intelligence',
        conversationId: conversation.id,
        signalType: signal.type,
        strength: signal.strength,
        description: signal.description,
        quote: signal.quote,
        timestamp: signal.timestamp,
        impact: signal.impact,
        dealId: conversation.dealId,
        repId: conversation.repId,
      },
    }));
}

/**
 * Create follow-up required events
 */
export function createFollowUpRequiredEvents(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationFollowUpRequiredEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>[] {
  return analysis.followUpActions
    .filter(action => 
      action.priority === 'critical' || 
      action.priority === 'high' ||
      action.deadline.includes('24 hours')
    )
    .map(action => ({
      type: 'conversation.follow_up_required' as const,
      leadId: conversation.leadId || 'unknown',
      orgId: analysis.organizationId,
      workspaceId: analysis.workspaceId,
      confidence: 0.8,
      priority: action.priority === 'critical' ? 'High' as const : 'Medium' as const,
      metadata: {
        source: 'conversation-intelligence',
        conversationId: conversation.id,
        actionType: action.type,
        priority: action.priority,
        title: action.title,
        description: action.description,
        reasoning: action.reasoning,
        deadline: action.deadline,
        estimatedEffort: action.estimatedEffort,
        dealId: conversation.dealId,
        repId: conversation.repId,
      },
    }));
}

/**
 * Create negative sentiment event
 */
export function createNegativeSentimentEvent(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<ConversationSentimentNegativeEvent, 'ttl' | 'createdAt' | 'processed' | 'processedAt'> | null {
  const sentiment = analysis.sentiment.overall;
  
  // Only emit if sentiment is negative or declining
  if (sentiment.polarity !== 'negative' && 
      sentiment.polarity !== 'very_negative' && 
      analysis.sentiment.trendDirection !== 'declining') {
    return null;
  }
  
  return {
    type: 'conversation.sentiment_negative',
    leadId: conversation.leadId || 'unknown',
    orgId: analysis.organizationId,
    workspaceId: analysis.workspaceId,
    confidence: sentiment.confidence / 100,
    priority: sentiment.polarity === 'very_negative' ? 'High' : 'Medium',
    metadata: {
      source: 'conversation-intelligence',
      conversationId: conversation.id,
      sentimentPolarity: sentiment.polarity,
      sentimentScore: sentiment.score,
      trendDirection: analysis.sentiment.trendDirection === 'improving' ? 'stable' : analysis.sentiment.trendDirection,
      criticalMomentsCount: analysis.sentiment.criticalMoments.filter(m => m.type === 'drop').length,
      recommendation: 'Immediate follow-up required to address prospect concerns',
      dealId: conversation.dealId,
      repId: conversation.repId,
    },
  } as ConversationSentimentNegativeEvent;
}

/**
 * Create all relevant events from analysis
 */
export function createAllConversationEvents(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>[] {
  const events: Omit<SalesSignal, 'ttl' | 'createdAt' | 'processed' | 'processedAt'>[] = [];
  
  // Always emit analyzed event
  events.push(createConversationAnalyzedEvent(analysis, conversation));
  
  // Low score event
  const lowScoreEvent = createLowScoreEvent(analysis, conversation);
  if (lowScoreEvent) {
    events.push(lowScoreEvent);
  }
  
  // Red flag events
  events.push(...createRedFlagEvents(analysis, conversation));
  
  // Coaching events
  events.push(...createCoachingNeededEvents(analysis, conversation));
  
  // Competitor events
  events.push(...createCompetitorMentionedEvents(analysis, conversation));
  
  // Objection events
  events.push(...createObjectionRaisedEvents(analysis, conversation));
  
  // Positive signal events
  events.push(...createPositiveSignalEvents(analysis, conversation));
  
  // Follow-up events
  events.push(...createFollowUpRequiredEvents(analysis, conversation));
  
  // Negative sentiment event
  const negativeEvent = createNegativeSentimentEvent(analysis, conversation);
  if (negativeEvent) {
    events.push(negativeEvent);
  }
  
  return events;
}

// ============================================================================
// EVENT EMISSION HELPERS
// ============================================================================

/**
 * Emit all conversation events to Signal Bus
 */
export async function emitConversationEvents(
  analysis: ConversationAnalysis,
  conversation: Conversation
): Promise<void> {
  const { getServerSignalCoordinator } = await import('@/lib/orchestration/coordinator-factory-server');
  const coordinator = getServerSignalCoordinator();
  
  const events = createAllConversationEvents(analysis, conversation);
  
  // Emit each event
  for (const event of events) {
    try {
      await coordinator.emitSignal(event);
    } catch (error) {
      console.error(`Failed to emit event ${event.type}:`, error);
    }
  }
}
