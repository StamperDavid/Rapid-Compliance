/**
 * Next Best Action Engine
 * 
 * AI-powered recommendation engine for deal management.
 * Analyzes deal health, activities, and context to suggest optimal next actions.
 * 
 * LIVING LEDGER COMPLIANCE:
 * - Real-time action recommendations based on deal health
 * - Signal Bus integration for automated triggers
 * - Confidence-based prioritization (High/Med/Low)
 * - Context-aware suggestions (stage, value, timing)
 * - Multi-factor analysis (health, engagement, timing, probability)
 * 
 * Recommendation Algorithm:
 * 1. Deal Health Analysis (0-100 score) - Overall deal wellness
 * 2. Stage Duration Analysis - Time in current stage vs expected
 * 3. Engagement Analysis - Activity recency and quality
 * 4. Value & Probability Analysis - Revenue risk assessment
 * 5. Timing Analysis - Close date proximity and urgency
 */

import { logger } from '@/lib/logger/logger';
import type { Deal } from './deal-service';
 
import { calculateDealHealth, type DealHealthScore } from './deal-health';
import type { ActivityStats } from '@/types/activity';
import { getActivityStats } from './activity-service';

// ============================================================================
// TYPES
// ============================================================================

export interface NextBestAction {
  id: string;
  type: ActionType;
  priority: 'High' | 'Medium' | 'Low';
  confidence: number; // 0-1
  title: string;
  description: string;
  reasoning: string[];
  suggestedTimeline: string; // "Today", "This Week", "Next Week", etc.
  estimatedImpact: 'High' | 'Medium' | 'Low';
  automatable: boolean; // Can this be automated?
  metadata?: Record<string, unknown>;
}

export type ActionType =
  | 'call'
  | 'email'
  | 'meeting'
  | 'proposal'
  | 'followup'
  | 'discount'
  | 'escalate'
  | 'nurture'
  | 'close'
  | 'reassess'
  | 'research';

export interface ActionRecommendations {
  dealId: string;
  dealName: string;
  actions: NextBestAction[];
  healthScore: DealHealthScore;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  generatedAt: Date;
  confidence: number; // Overall confidence in recommendations
}

// ============================================================================
// MAIN RECOMMENDATION ENGINE
// ============================================================================

/**
 * Generate next best action recommendations for a deal
 * 
 * This is the main entry point for getting AI-powered recommendations.
 * 
 * @param organizationId - Organization ID
 * @param workspaceId - Workspace ID
 * @param dealId - Deal ID
 * @returns Prioritized action recommendations
 * 
 * @example
 * ```typescript
 * const recommendations = await generateNextBestActions(
 *   'org_123',
 *   'default',
 *   'deal_456'
 * );
 * 
 * console.log(`Urgency: ${recommendations.urgency}`);
 * console.log(`Top action: ${recommendations.actions[0].title}`);
 * ```
 */
export async function generateNextBestActions(
  organizationId: string,
  workspaceId: string,
  dealId: string,
  deal?: Deal
): Promise<ActionRecommendations> {
  try {
    logger.info('Generating next best actions', {
      organizationId,
      dealId,
    });

    // Step 1: Get or calculate deal health
    const healthScore = await calculateDealHealth(
      organizationId,
      workspaceId,
      dealId
    );

    // Step 2: Get deal data if not provided
    if (!deal) {
      const { getDeal } = await import('./deal-service');
      const fetchedDeal = await getDeal(dealId, workspaceId);
      if (!fetchedDeal) {
        throw new Error('Deal not found');
      }
      deal = fetchedDeal;
    }

    // Step 3: Get activity stats
    const activityStats = await getActivityStats(
      organizationId,
      workspaceId,
      'deal',
      dealId
    );

    // Step 4: Generate actions based on health and context
    const actions: NextBestAction[] = [];

    // Strategy 1: Health-based actions
    const healthActions = generateHealthBasedActions(deal, healthScore);
    actions.push(...healthActions);

    // Strategy 2: Stage-based actions
    const stageActions = generateStageBasedActions(deal, healthScore);
    actions.push(...stageActions);

    // Strategy 3: Engagement-based actions
    const engagementActions = generateEngagementBasedActions(
      deal,
      healthScore,
      activityStats
    );
    actions.push(...engagementActions);

    // Strategy 4: Timing-based actions
    const timingActions = generateTimingBasedActions(deal, healthScore);
    actions.push(...timingActions);

    // Strategy 5: Value-based actions
    const valueActions = generateValueBasedActions(deal, healthScore);
    actions.push(...valueActions);

    // Step 5: Deduplicate and prioritize
    const prioritizedActions = prioritizeActions(actions);

    // Step 6: Calculate overall urgency
    const urgency = calculateUrgency(healthScore, deal, activityStats);

    // Step 7: Calculate overall confidence
    const confidence = calculateOverallConfidence(
      prioritizedActions,
      healthScore
    );

    const recommendations: ActionRecommendations = {
      dealId,
      dealName: deal.name,
      actions: prioritizedActions.slice(0, 5), // Top 5 actions
      healthScore,
      urgency,
      generatedAt: new Date(),
      confidence,
    };

    logger.info('Next best actions generated', {
      dealId,
      actionCount: recommendations.actions.length,
      urgency: recommendations.urgency,
      topAction: recommendations.actions[0]?.type,
    });

    return recommendations;
  } catch (error) {
    const errorInstance = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to generate next best actions', errorInstance, {
      organizationId,
      dealId,
    });
    throw errorInstance;
  }
}

// ============================================================================
// ACTION GENERATION STRATEGIES
// ============================================================================

/**
 * Generate actions based on overall deal health
 */
function generateHealthBasedActions(
  deal: Deal,
  health: DealHealthScore
): NextBestAction[] {
  const actions: NextBestAction[] = [];

  // Critical health - immediate intervention needed
  if (health.status === 'critical') {
    actions.push({
      id: `action-critical-call-${Date.now()}`,
      type: 'call',
      priority: 'High',
      confidence: 0.95,
      title: 'Emergency call to save deal',
      description: `Deal health is critical (${health.overall}/100). Schedule an urgent call to address concerns and re-engage the prospect.`,
      reasoning: [
        `Critical health score: ${health.overall}/100`,
        ...health.warnings,
      ],
      suggestedTimeline: 'Today',
      estimatedImpact: 'High',
      automatable: false,
    });

    actions.push({
      id: `action-critical-escalate-${Date.now()}`,
      type: 'escalate',
      priority: 'High',
      confidence: 0.85,
      title: 'Escalate to senior leadership',
      description: `Deal value $${deal.value.toLocaleString()} is at risk. Consider escalating to executive sponsor or bringing in subject matter expert.`,
      reasoning: [
        'Critical health status requires intervention',
        `Deal value: $${deal.value.toLocaleString()}`,
        'Multiple warning signals detected',
      ],
      suggestedTimeline: 'Today',
      estimatedImpact: 'High',
      automatable: false,
    });
  }

  // At-risk health - proactive action needed
  if (health.status === 'at-risk') {
    actions.push({
      id: `action-atrisk-followup-${Date.now()}`,
      type: 'followup',
      priority: 'High',
      confidence: 0.90,
      title: 'Proactive follow-up call',
      description: `Deal health is declining (${health.overall}/100). Follow up to understand concerns and reinforce value proposition.`,
      reasoning: [
        `Health score: ${health.overall}/100`,
        ...health.recommendations,
      ],
      suggestedTimeline: 'This Week',
      estimatedImpact: 'High',
      automatable: false,
    });

    // Check if discount might help close
    if (deal.value > 50000 && deal.probability < 60) {
      actions.push({
        id: `action-atrisk-discount-${Date.now()}`,
        type: 'discount',
        priority: 'Medium',
        confidence: 0.75,
        title: 'Consider strategic discount',
        description: 'Deal probability is moderate. A strategic discount (5-10%) might help move this to close.',
        reasoning: [
          `Low probability: ${deal.probability}%`,
          `High deal value: $${deal.value.toLocaleString()}`,
          'Health declining - incentive may help',
        ],
        suggestedTimeline: 'This Week',
        estimatedImpact: 'Medium',
        automatable: false,
      });
    }
  }

  // Healthy - maintain momentum
  if (health.status === 'healthy') {
    actions.push({
      id: `action-healthy-close-${Date.now()}`,
      type: 'close',
      priority: 'High',
      confidence: 0.85,
      title: 'Push for close',
      description: `Deal is healthy (${health.overall}/100). Now is the time to ask for the business and move to close.`,
      reasoning: [
        `Healthy score: ${health.overall}/100`,
        `Probability: ${deal.probability}%`,
        'Momentum is strong',
      ],
      suggestedTimeline: 'This Week',
      estimatedImpact: 'High',
      automatable: false,
    });
  }

  return actions;
}

/**
 * Generate actions based on deal stage
 */
function generateStageBasedActions(
  deal: Deal,
  _health: DealHealthScore
): NextBestAction[] {
  const actions: NextBestAction[] = [];

  switch (deal.stage) {
    case 'prospecting':
      actions.push({
        id: `action-stage-qualify-${Date.now()}`,
        type: 'call',
        priority: 'High',
        confidence: 0.80,
        title: 'Qualification call',
        description: 'Schedule discovery call to qualify needs, budget, authority, and timeline (BANT).',
        reasoning: [
          'Deal is in prospecting stage',
          'Need to validate opportunity quality',
        ],
        suggestedTimeline: 'This Week',
        estimatedImpact: 'High',
        automatable: false,
      });
      break;

    case 'qualification':
      actions.push({
        id: `action-stage-demo-${Date.now()}`,
        type: 'meeting',
        priority: 'High',
        confidence: 0.85,
        title: 'Product demonstration',
        description: 'Schedule product demo tailored to their specific use case and pain points.',
        reasoning: [
          'Deal qualified - ready for demo',
          'Showcase solution fit',
        ],
        suggestedTimeline: 'This Week',
        estimatedImpact: 'High',
        automatable: false,
      });
      break;

    case 'proposal':
      actions.push({
        id: `action-stage-proposal-${Date.now()}`,
        type: 'proposal',
        priority: 'High',
        confidence: 0.90,
        title: 'Send formal proposal',
        description: 'Prepare and send formal proposal with pricing, terms, and implementation timeline.',
        reasoning: [
          'Deal ready for proposal',
          `Value: $${deal.value.toLocaleString()}`,
        ],
        suggestedTimeline: 'This Week',
        estimatedImpact: 'High',
        automatable: true,
        metadata: {
          template: 'standard-proposal',
        },
      });

      actions.push({
        id: `action-stage-proposal-followup-${Date.now()}`,
        type: 'followup',
        priority: 'Medium',
        confidence: 0.75,
        title: 'Follow up on proposal',
        description: 'Call to discuss proposal questions and address any concerns.',
        reasoning: [
          'Proposal stage requires engagement',
          'Address questions proactively',
        ],
        suggestedTimeline: '3 days after sending',
        estimatedImpact: 'Medium',
        automatable: false,
      });
      break;

    case 'negotiation':
      actions.push({
        id: `action-stage-negotiate-${Date.now()}`,
        type: 'meeting',
        priority: 'High',
        confidence: 0.88,
        title: 'Negotiation meeting',
        description: 'Schedule final negotiation meeting to address terms, pricing, and close date.',
        reasoning: [
          'Deal in negotiation stage',
          'Close is near - align on final terms',
        ],
        suggestedTimeline: 'This Week',
        estimatedImpact: 'High',
        automatable: false,
      });

      if (deal.value > 100000) {
        actions.push({
          id: `action-stage-legal-${Date.now()}`,
          type: 'escalate',
          priority: 'Medium',
          confidence: 0.70,
          title: 'Involve legal team',
          description: 'For high-value deals, bring in legal to review contract terms.',
          reasoning: [
            `High deal value: $${deal.value.toLocaleString()}`,
            'Ensure contract terms are favorable',
          ],
          suggestedTimeline: 'This Week',
          estimatedImpact: 'Medium',
          automatable: false,
        });
      }
      break;

    case 'closed_won':
      actions.push({
        id: `action-stage-onboard-${Date.now()}`,
        type: 'email',
        priority: 'High',
        confidence: 0.90,
        title: 'Initiate customer onboarding',
        description: 'Send welcome email and schedule kickoff call with implementation team.',
        reasoning: [
          'Deal won - begin onboarding',
          'Ensure smooth handoff to success team',
        ],
        suggestedTimeline: 'Today',
        estimatedImpact: 'High',
        automatable: true,
        metadata: {
          template: 'onboarding-welcome',
        },
      });
      break;

    case 'closed_lost':
      actions.push({
        id: `action-stage-postmortem-${Date.now()}`,
        type: 'research',
        priority: 'Low',
        confidence: 0.65,
        title: 'Conduct loss analysis',
        description: 'Document reasons for loss and identify lessons learned.',
        reasoning: [
          'Deal lost - capture insights',
          'Improve future win rate',
        ],
        suggestedTimeline: 'Next Week',
        estimatedImpact: 'Low',
        automatable: false,
      });
      break;
  }

  return actions;
}

/**
 * Generate actions based on engagement level
 */
function generateEngagementBasedActions(
  deal: Deal,
  _health: DealHealthScore,
  activityStats: ActivityStats
): NextBestAction[] {
  const actions: NextBestAction[] = [];

  const daysSinceLastActivity = getDaysSinceLastActivity(activityStats);

  // Stale deal - re-engagement needed
  if (daysSinceLastActivity !== null && daysSinceLastActivity > 14) {
    actions.push({
      id: `action-engage-reactivate-${Date.now()}`,
      type: 'email',
      priority: 'High',
      confidence: 0.85,
      title: 'Re-engage stale deal',
      description: `No activity in ${daysSinceLastActivity} days. Send re-engagement email with new value proposition or case study.`,
      reasoning: [
        `${daysSinceLastActivity} days since last activity`,
        'Risk of deal going cold',
      ],
      suggestedTimeline: 'Today',
      estimatedImpact: 'High',
      automatable: true,
      metadata: {
        template: 're-engagement',
        daysSinceContact: daysSinceLastActivity,
      },
    });
  }

  // Low engagement score
  if (activityStats.engagementScore !== undefined && activityStats.engagementScore < 50) {
    actions.push({
      id: `action-engage-increase-${Date.now()}`,
      type: 'meeting',
      priority: 'Medium',
      confidence: 0.75,
      title: 'Increase engagement',
      description: 'Low engagement detected. Schedule a value-add meeting (product training, industry insights, etc.)',
      reasoning: [
        `Low engagement score: ${activityStats.engagementScore}/100`,
        'Need to rebuild interest',
      ],
      suggestedTimeline: 'This Week',
      estimatedImpact: 'Medium',
      automatable: false,
    });
  }

  return actions;
}

/**
 * Generate actions based on timing and close date
 */
function generateTimingBasedActions(
  deal: Deal,
  _health: DealHealthScore
): NextBestAction[] {
  const actions: NextBestAction[] = [];

  if (!deal.expectedCloseDate) {
    // No close date set
    actions.push({
      id: `action-timing-setdate-${Date.now()}`,
      type: 'call',
      priority: 'Medium',
      confidence: 0.70,
      title: 'Establish close date',
      description: 'No expected close date set. Call to discuss timeline and set mutual close date.',
      reasoning: [
        'Missing expected close date',
        'Need timeline commitment',
      ],
      suggestedTimeline: 'This Week',
      estimatedImpact: 'Medium',
      automatable: false,
    });
    return actions;
  }

  const expectedDateValue = deal.expectedCloseDate;
  let expectedDate: Date;
  if (expectedDateValue && typeof expectedDateValue === 'object' && 'toDate' in expectedDateValue && typeof expectedDateValue.toDate === 'function') {
    expectedDate = expectedDateValue.toDate();
  } else if (expectedDateValue instanceof Date) {
    expectedDate = expectedDateValue;
  } else {
    expectedDate = new Date();
  }
  const daysToClose = Math.floor(
    (expectedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );

  // Overdue deal
  if (daysToClose < 0) {
    actions.push({
      id: `action-timing-overdue-${Date.now()}`,
      type: 'call',
      priority: 'High',
      confidence: 0.90,
      title: 'Address overdue deal',
      description: `Deal is ${Math.abs(daysToClose)} days overdue. Call to understand delay and reset expectations.`,
      reasoning: [
        `${Math.abs(daysToClose)} days past expected close`,
        'Need to reassess viability',
      ],
      suggestedTimeline: 'Today',
      estimatedImpact: 'High',
      automatable: false,
    });

    actions.push({
      id: `action-timing-reassess-${Date.now()}`,
      type: 'reassess',
      priority: 'High',
      confidence: 0.80,
      title: 'Reassess deal viability',
      description: 'Deal significantly overdue. Reassess if opportunity is still viable or should be closed lost.',
      reasoning: [
        'Extended delay indicates issues',
        `Overdue by ${Math.abs(daysToClose)} days`,
      ],
      suggestedTimeline: 'This Week',
      estimatedImpact: 'High',
      automatable: false,
    });
  }

  // Closing soon
  if (daysToClose >= 0 && daysToClose <= 7) {
    actions.push({
      id: `action-timing-urgent-${Date.now()}`,
      type: 'call',
      priority: 'High',
      confidence: 0.92,
      title: 'Urgent close push',
      description: `Deal closes in ${daysToClose} days. Make final push to secure commitment and finalize paperwork.`,
      reasoning: [
        `Only ${daysToClose} days to close`,
        'Time-sensitive action required',
      ],
      suggestedTimeline: 'Today',
      estimatedImpact: 'High',
      automatable: false,
    });
  }

  // Closing in 1-2 weeks
  if (daysToClose > 7 && daysToClose <= 14) {
    actions.push({
      id: `action-timing-prep-${Date.now()}`,
      type: 'proposal',
      priority: 'High',
      confidence: 0.85,
      title: 'Prepare for close',
      description: `Deal closes in ${daysToClose} days. Ensure all proposal materials, contracts, and approvals are ready.`,
      reasoning: [
        `${daysToClose} days to close`,
        'Prepare documentation now',
      ],
      suggestedTimeline: 'This Week',
      estimatedImpact: 'High',
      automatable: false,
    });
  }

  return actions;
}

/**
 * Generate actions based on deal value and probability
 */
function generateValueBasedActions(
  deal: Deal,
  _health: DealHealthScore
): NextBestAction[] {
  const actions: NextBestAction[] = [];

  // High-value, low-probability deals
  if (deal.value > 100000 && deal.probability < 60) {
    actions.push({
      id: `action-value-rescue-${Date.now()}`,
      type: 'escalate',
      priority: 'High',
      confidence: 0.80,
      title: 'Executive intervention for high-value deal',
      description: `High-value deal ($${deal.value.toLocaleString()}) has low probability (${deal.probability}%). Consider executive sponsor engagement.`,
      reasoning: [
        `High deal value: $${deal.value.toLocaleString()}`,
        `Low probability: ${deal.probability}%`,
        'Revenue at risk',
      ],
      suggestedTimeline: 'This Week',
      estimatedImpact: 'High',
      automatable: false,
    });
  }

  // High-value, high-probability deals - move to close
  if (deal.value > 100000 && deal.probability >= 75) {
    actions.push({
      id: `action-value-accelerate-${Date.now()}`,
      type: 'close',
      priority: 'High',
      confidence: 0.90,
      title: 'Accelerate high-value close',
      description: `Deal has high value ($${deal.value.toLocaleString()}) and high probability (${deal.probability}%). Prioritize closing this deal.`,
      reasoning: [
        `High deal value: $${deal.value.toLocaleString()}`,
        `High probability: ${deal.probability}%`,
        'Low-hanging fruit - close now',
      ],
      suggestedTimeline: 'This Week',
      estimatedImpact: 'High',
      automatable: false,
    });
  }

  // Low-value deals - consider automation
  if (deal.value < 10000 && deal.stage === 'prospecting') {
    actions.push({
      id: `action-value-automate-${Date.now()}`,
      type: 'nurture',
      priority: 'Low',
      confidence: 0.70,
      title: 'Move to automated nurture',
      description: `Low-value deal ($${deal.value.toLocaleString()}). Consider automated nurture sequence to qualify efficiently.`,
      reasoning: [
        `Low deal value: $${deal.value.toLocaleString()}`,
        'Not worth high-touch effort yet',
      ],
      suggestedTimeline: 'Next Week',
      estimatedImpact: 'Low',
      automatable: true,
      metadata: {
        sequenceType: 'low-value-nurture',
      },
    });
  }

  return actions;
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Prioritize and deduplicate actions
 */
function prioritizeActions(actions: NextBestAction[]): NextBestAction[] {
  // Remove duplicates (same type and priority)
  const seen = new Set<string>();
  const unique = actions.filter((action) => {
    const key = `${action.type}-${action.priority}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });

  // Sort by priority and confidence
  return unique.sort((a, b) => {
    const priorityOrder = { High: 3, Medium: 2, Low: 1 };
    const aPriority = priorityOrder[a.priority];
    const bPriority = priorityOrder[b.priority];

    if (aPriority !== bPriority) {
      return bPriority - aPriority; // Higher priority first
    }

    return b.confidence - a.confidence; // Higher confidence first
  });
}

/**
 * Calculate overall urgency level
 */
function calculateUrgency(
  health: DealHealthScore,
  deal: Deal,
  activityStats: ActivityStats
): 'critical' | 'high' | 'medium' | 'low' {
  // Critical if health is critical
  if (health.status === 'critical') {
    return 'critical';
  }

  // Critical if high-value deal is overdue
  if (deal.expectedCloseDate && deal.value > 50000) {
    const expectedDateValue = deal.expectedCloseDate;
    let expectedDate: Date;
    if (expectedDateValue && typeof expectedDateValue === 'object' && 'toDate' in expectedDateValue && typeof expectedDateValue.toDate === 'function') {
      expectedDate = expectedDateValue.toDate();
    } else if (expectedDateValue instanceof Date) {
      expectedDate = expectedDateValue;
    } else {
      expectedDate = new Date();
    }
    const daysToClose = Math.floor(
      (expectedDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    );
    if (daysToClose < 0) {
      return 'critical';
    }
    if (daysToClose <= 3) {
      return 'high';
    }
  }

  // High if at-risk
  if (health.status === 'at-risk') {
    return 'high';
  }

  // High if stale
  const daysSinceLastActivity = getDaysSinceLastActivity(activityStats);
  if (daysSinceLastActivity !== null && daysSinceLastActivity > 21) {
    return 'high';
  }

  // Medium if low engagement
  if (activityStats.engagementScore !== undefined && activityStats.engagementScore < 40) {
    return 'medium';
  }

  return 'low';
}

/**
 * Calculate overall recommendation confidence
 */
function calculateOverallConfidence(
  actions: NextBestAction[],
  _health: DealHealthScore
): number {
  if (actions.length === 0) {
    return 0;
  }

  // Average confidence of top 3 actions
  const topActions = actions.slice(0, 3);
  const avgConfidence =
    topActions.reduce((sum, action) => sum + action.confidence, 0) /
    topActions.length;

  // Return average confidence (health score doesn't have metadata.confidence)
  return Math.min(1, avgConfidence);
}

/**
 * Get days since last activity
 */
function getDaysSinceLastActivity(activityStats: ActivityStats): number | null {
  if (!activityStats.lastActivityDate) {return null;}

  const lastDateValue = activityStats.lastActivityDate;
  const lastDate = lastDateValue instanceof Date ? lastDateValue : new Date(lastDateValue);
  return Math.floor((Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24));
}
