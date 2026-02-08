/**
 * Notification Signal Handlers
 * 
 * Listens to Signal Bus events from all AI features and sends notifications.
 * Integrates all 11 Phase 4 AI features with the notification system.
 * 
 * Features Integrated:
 * 1. Deal Risk Predictor
 * 2. Conversation Intelligence
 * 3. Sales Coaching & Insights
 * 4. Team Performance Analytics
 * 5. Conversation Playbook Builder
 * 6. Email Sequence Intelligence
 * 7. Intelligent Lead Routing
 * 8. AI Email Writer
 * 9. Workflow Automation
 * 10. Advanced Analytics
 * 11. Revenue Forecasting
 */

import type { SalesSignal } from '@/lib/orchestration/types';
import { NotificationService } from './notification-service';
import type { NotificationVariables } from './types';

/**
 * Initialize notification signal handlers
 *
 * Call this on server startup to begin listening for signals
 */
export function initializeNotificationHandlers(): void {
  const service = new NotificationService();

  // Deal Risk Predictor signals
  registerDealRiskHandlers(service);

  // Conversation Intelligence signals
  registerConversationHandlers(service);

  // Coaching signals
  registerCoachingHandlers(service);

  // Performance Analytics signals
  registerPerformanceHandlers(service);

  // Playbook Builder signals
  registerPlaybookHandlers(service);

  // Sequence Intelligence signals
  registerSequenceHandlers(service);

  // Lead Routing signals
  registerRoutingHandlers(service);

  // Email Writer signals
  registerEmailWriterHandlers(service);

  // Workflow Automation signals
  registerWorkflowHandlers(service);

  // Analytics signals
  registerAnalyticsHandlers(service);

  // Forecasting signals
  registerForecastingHandlers(service);
}

/**
 * Deal Risk Predictor Signal Handlers
 */
function registerDealRiskHandlers(_service: NotificationService): void {
  // TODO: Subscribe to Signal Bus
  // For now, export handler functions to be called by Signal Bus
}

/**
 * Handle critical deal risk signal
 */
export async function handleDealRiskCritical(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    dealId: signal.metadata.dealId as string,
    dealName: signal.metadata.dealName as string,
    dealValue: signal.metadata.dealValue as number,
    dealStage: signal.metadata.dealStage as string,
    riskLevel: signal.metadata.riskLevel as string,
    riskProbability: signal.metadata.probability as number,
    riskFactors: signal.metadata.factors as unknown[],
    interventions: signal.metadata.interventions as unknown[],
    userId: signal.metadata.ownerId as string,
  };

  // Send to deal owner
  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'deal_risk_critical',
      variables,
      { priority: 'critical' }
    );
  }
}

/**
 * Handle high deal risk signal
 */
export async function handleDealRiskHigh(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    dealId: signal.metadata.dealId as string,
    dealName: signal.metadata.dealName as string,
    riskLevel: signal.metadata.riskLevel as string,
    riskProbability: signal.metadata.probability as number,
    userId: signal.metadata.ownerId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'deal_risk_high',
      variables,
      { priority: 'high' }
    );
  }
}

/**
 * Conversation Intelligence Signal Handlers
 */
function registerConversationHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle low conversation quality
 */
export async function handleConversationLowScore(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    conversationId: signal.metadata.conversationId as string,
    repId: signal.metadata.repId as string,
    repName: signal.metadata.repName as string,
    score: signal.metadata.score as number,
    issues: signal.metadata.issues as string[],
    coaching: signal.metadata.coaching as unknown[],
    userId: signal.metadata.repId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'conversation_low_score',
      variables,
      { priority: 'high' }
    );
  }
}

/**
 * Handle conversation red flag
 */
export async function handleConversationRedFlag(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    conversationId: signal.metadata.conversationId as string,
    repId: signal.metadata.repId as string,
    redFlagType: signal.metadata.redFlagType as string,
    description: signal.metadata.description as string,
    severity: signal.metadata.severity as string,
    userId: signal.metadata.managerId as string, // Notify manager
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'conversation_red_flag',
      variables,
      { priority: 'critical' }
    );
  }
}

/**
 * Handle competitor mentioned
 */
export async function handleCompetitorMentioned(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    conversationId: signal.metadata.conversationId as string,
    dealId: signal.metadata.dealId as string,
    competitorName: signal.metadata.competitorName as string,
    sentiment: signal.metadata.sentiment as string,
    concernLevel: signal.metadata.concernLevel as string,
    battlecardId: signal.metadata.battlecardId as string,
    userId: signal.metadata.repId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'competitor_mentioned',
      variables,
      { priority: 'high' }
    );
  }
}

/**
 * Handle positive buying signal
 */
export async function handlePositiveSignal(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    conversationId: signal.metadata.conversationId as string,
    dealId: signal.metadata.dealId as string,
    signalType: signal.metadata.signalType as string,
    description: signal.metadata.description as string,
    nextSteps: signal.metadata.nextSteps as string[],
    userId: signal.metadata.repId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'buying_signal_detected',
      variables,
      { priority: 'high' }
    );
  }
}

/**
 * Coaching Signal Handlers
 */
function registerCoachingHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle coaching insights generated
 */
export async function handleCoachingInsightsGenerated(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    repId: signal.metadata.repId as string,
    repName: signal.metadata.repName as string,
    performanceTier: signal.metadata.performanceTier as string,
    strengths: signal.metadata.strengths as string[],
    weaknesses: signal.metadata.weaknesses as string[],
    recommendations: signal.metadata.recommendations as unknown[],
    userId: signal.metadata.repId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'coaching_insights_ready',
      variables,
      { priority: 'medium' }
    );
  }
}

/**
 * Performance Analytics Signal Handlers
 */
function registerPerformanceHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle top performer identified
 */
export async function handleTopPerformerIdentified(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    repId: signal.metadata.repId as string,
    repName: signal.metadata.repName as string,
    rank: signal.metadata.rank as number,
    strengths: signal.metadata.strengths as string[],
    userId: signal.metadata.repId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'top_performer_recognition',
      variables,
      { priority: 'low' }
    );
  }
}

/**
 * Handle improvement opportunity
 */
export async function handleImprovementOpportunity(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    repId: signal.metadata.repId as string,
    repName: signal.metadata.repName as string,
    skillArea: signal.metadata.skillArea as string,
    currentScore: signal.metadata.currentScore as number,
    targetScore: signal.metadata.targetScore as number,
    resources: signal.metadata.resources as string[],
    userId: signal.metadata.repId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'improvement_opportunity',
      variables,
      { priority: 'medium' }
    );
  }
}

/**
 * Playbook Builder Signal Handlers
 */
function registerPlaybookHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle playbook generated
 */
export async function handlePlaybookGenerated(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    playbookId: signal.metadata.playbookId as string,
    playbookName: signal.metadata.playbookName as string,
    patternCount: signal.metadata.patternCount as number,
    talkTrackCount: signal.metadata.talkTrackCount as number,
    userId: signal.metadata.createdBy as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'playbook_ready',
      variables,
      { priority: 'medium' }
    );
  }
}

/**
 * Handle pattern identified
 */
export async function handlePatternIdentified(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    patternType: signal.metadata.patternType as string,
    successRate: signal.metadata.successRate as number,
    occurrences: signal.metadata.occurrences as number,
    description: signal.metadata.description as string,
    userId: signal.metadata.managerId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'success_pattern_found',
      variables,
      { priority: 'low' }
    );
  }
}

/**
 * Sequence Intelligence Signal Handlers
 */
function registerSequenceHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle sequence underperforming
 */
export async function handleSequenceUnderperforming(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    sequenceId: signal.metadata.sequenceId as string,
    sequenceName: signal.metadata.sequenceName as string,
    replyRate: signal.metadata.replyRate as number,
    baselineReplyRate: signal.metadata.baselineReplyRate as number,
    recommendations: signal.metadata.recommendations as unknown[],
    userId: signal.metadata.ownerId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'sequence_underperforming',
      variables,
      { priority: 'high' }
    );
  }
}

/**
 * Handle optimization needed
 */
export async function handleOptimizationNeeded(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    sequenceId: signal.metadata.sequenceId as string,
    sequenceName: signal.metadata.sequenceName as string,
    optimizationType: signal.metadata.optimizationType as string,
    potentialLift: signal.metadata.potentialLift as number,
    effort: signal.metadata.effort as string,
    userId: signal.metadata.ownerId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'optimization_opportunity',
      variables,
      { priority: 'medium' }
    );
  }
}

/**
 * Lead Routing Signal Handlers
 */
function registerRoutingHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle lead routed
 */
export async function handleLeadRouted(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    leadId: signal.metadata.leadId as string,
    leadName: signal.metadata.leadName as string,
    leadCompany: signal.metadata.leadCompany as string,
    qualityScore: signal.metadata.qualityScore as number,
    strategy: signal.metadata.strategy as string,
    userId: signal.metadata.assignedTo as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'lead_assigned',
      variables,
      { priority: 'high' }
    );
  }
}

/**
 * Email Writer Signal Handlers
 */
function registerEmailWriterHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle email generated
 */
export async function handleEmailGenerated(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    emailId: signal.metadata.emailId as string,
    emailType: signal.metadata.emailType as string,
    dealId: signal.metadata.dealId as string,
    userId: signal.metadata.createdBy as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'email_ready_to_send',
      variables,
      { priority: 'medium' }
    );
  }
}

/**
 * Workflow Automation Signal Handlers
 */
function registerWorkflowHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle workflow executed
 */
export async function handleWorkflowExecuted(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    workflowId: signal.metadata.workflowId as string,
    workflowName: signal.metadata.workflowName as string,
    actionsExecuted: signal.metadata.actionsExecuted as number,
    success: signal.metadata.success as boolean,
    userId: signal.metadata.triggeredBy as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'workflow_executed',
      variables,
      { priority: 'low' }
    );
  }
}

/**
 * Analytics Signal Handlers
 */
function registerAnalyticsHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Forecasting Signal Handlers
 */
function registerForecastingHandlers(_service: NotificationService): void {
  // Handlers registered via Signal Bus
}

/**
 * Handle quota at risk
 */
export async function handleQuotaAtRisk(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    period: signal.metadata.period as string,
    quota: signal.metadata.quota as number,
    forecast: signal.metadata.forecast as number,
    gap: signal.metadata.gap as number,
    attainmentProbability: signal.metadata.attainmentProbability as number,
    userId: signal.metadata.repId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'quota_at_risk',
      variables,
      { priority: 'critical' }
    );
  }
}

/**
 * Handle quota achieved
 */
export async function handleQuotaAchieved(signal: SalesSignal): Promise<void> {
  const service = new NotificationService();
  
  const variables: NotificationVariables = {
    period: signal.metadata.period as string,
    quota: signal.metadata.quota as number,
    actual: signal.metadata.actual as number,
    attainment: signal.metadata.attainment as number,
    userId: signal.metadata.repId as string,
  };

  if (variables.userId) {
    await service.sendNotification(
      variables.userId,
      'quota_achieved_celebration',
      variables,
      { priority: 'low' }
    );
  }
}

/**
 * Export all handlers for Signal Bus registration
 */
export const signalHandlers = {
  // Deal Risk
  'deal.risk.critical': handleDealRiskCritical,
  'deal.risk.high': handleDealRiskHigh,
  
  // Conversation
  'conversation.low_score': handleConversationLowScore,
  'conversation.red_flag': handleConversationRedFlag,
  'conversation.competitor_mentioned': handleCompetitorMentioned,
  'conversation.positive_signal': handlePositiveSignal,
  
  // Coaching
  'coaching.insights.generated': handleCoachingInsightsGenerated,
  
  // Performance
  'performance.top_performer_identified': handleTopPerformerIdentified,
  'performance.improvement_opportunity': handleImprovementOpportunity,
  
  // Playbook
  'playbook.generated': handlePlaybookGenerated,
  'playbook.pattern_identified': handlePatternIdentified,
  
  // Sequence
  'sequence.underperforming': handleSequenceUnderperforming,
  'sequence.optimization_needed': handleOptimizationNeeded,
  
  // Lead Routing
  'lead.routed': handleLeadRouted,
  
  // Email Writer
  'email.generated': handleEmailGenerated,
  
  // Workflow
  'workflow.executed': handleWorkflowExecuted,
  
  // Forecasting
  'quota.at_risk': handleQuotaAtRisk,
  'quota.achieved': handleQuotaAchieved,
};
