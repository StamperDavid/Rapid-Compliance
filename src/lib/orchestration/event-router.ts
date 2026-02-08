/**
 * Event Router - The Autonomous Business Event Dispatcher
 *
 * This is the nervous system that transforms SalesVelocity.ai from a
 * task-execution platform into an autonomous business operating system.
 *
 * HOW IT WORKS:
 * 1. Real-world events fire from webhooks, crons, and services
 * 2. Events are evaluated against a rules engine
 * 3. Matching rules dispatch commands to the appropriate Manager via SignalBus
 * 4. Managers execute autonomously using their specialist teams
 *
 * ARCHITECTURE:
 * - Rules are declarative: event + condition → action (targetManager + command)
 * - Conditions are evaluated safely via a whitelist of comparison operators
 * - All dispatches are logged for auditability
 * - Circuit breaker prevents runaway event loops
 *
 * @module orchestration/event-router
 */

import { logger } from '@/lib/logger/logger';
import { getSignalBus } from '@/lib/orchestrator/signal-bus';
import { AGENT_IDS, type ManagerId } from '@/lib/agents';
import type { AgentMessage } from '@/lib/agents/types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Priority levels for event processing order
 */
export type EventPriority = 'CRITICAL' | 'HIGH' | 'NORMAL' | 'LOW';

/**
 * Supported comparison operators for condition evaluation
 */
type ComparisonOperator = '===' | '!==' | '>' | '>=' | '<' | '<=' | 'includes' | 'startsWith';

/**
 * A single condition clause evaluated against event payload
 */
export interface ConditionClause {
  field: string;
  operator: ComparisonOperator;
  value: string | number | boolean;
}

/**
 * An action to execute when an event rule matches
 */
export interface EventAction {
  targetManager: ManagerId;
  command: string;
  payloadMapping: Record<string, string>;
}

/**
 * A declarative event routing rule
 */
export interface EventRule {
  id: string;
  event: string;
  conditions: ConditionClause[];
  actions: EventAction[];
  priority: EventPriority;
  enabled: boolean;
  description: string;
  cooldownMs?: number;
}

/**
 * An event emitted by a webhook, cron, or service
 */
export interface BusinessEvent {
  id: string;
  type: string;
  timestamp: Date;
  source: string;
  payload: Record<string, unknown>;
}

/**
 * Result of processing a single event
 */
export interface EventProcessingResult {
  eventId: string;
  eventType: string;
  matchedRules: string[];
  dispatchedActions: Array<{
    ruleId: string;
    targetManager: ManagerId;
    command: string;
    success: boolean;
    error?: string;
  }>;
  processingTimeMs: number;
}

/**
 * Event Router metrics for monitoring
 */
interface EventRouterMetrics {
  totalEventsProcessed: number;
  totalRulesMatched: number;
  totalActionsDispatched: number;
  totalActionsFailed: number;
  lastEventAt: Date | null;
  eventCountByType: Map<string, number>;
}

// ============================================================================
// PRIORITY WEIGHT MAP
// ============================================================================

const PRIORITY_WEIGHT: Record<EventPriority, number> = {
  CRITICAL: 4,
  HIGH: 3,
  NORMAL: 2,
  LOW: 1,
};

// ============================================================================
// EVENT ROUTER
// ============================================================================

export class EventRouter {
  private rules: Map<string, EventRule> = new Map();
  private metrics: EventRouterMetrics = {
    totalEventsProcessed: 0,
    totalRulesMatched: 0,
    totalActionsDispatched: 0,
    totalActionsFailed: 0,
    lastEventAt: null,
    eventCountByType: new Map(),
  };

  /** Cooldown tracker: ruleId → last fired timestamp */
  private cooldowns: Map<string, number> = new Map();

  /** Circuit breaker: prevents runaway event loops */
  private circuitBreaker = {
    isOpen: false,
    failureCount: 0,
    failureThreshold: 10,
    lastOpenedAt: null as Date | null,
    resetTimeoutMs: 60_000,
  };

  constructor() {
    this.registerDefaultRules();
    logger.info('[EventRouter] Initialized with default rules', {
      ruleCount: this.rules.size,
    });
  }

  // ==========================================================================
  // CORE EVENT PROCESSING
  // ==========================================================================

  /**
   * Process a business event through the rules engine
   */
  async processEvent(event: BusinessEvent): Promise<EventProcessingResult> {
    const startTime = Date.now();

    // Circuit breaker check
    if (this.circuitBreaker.isOpen) {
      const elapsed = Date.now() - (this.circuitBreaker.lastOpenedAt?.getTime() ?? 0);
      if (elapsed < this.circuitBreaker.resetTimeoutMs) {
        logger.warn('[EventRouter] Circuit breaker OPEN — event dropped', {
          eventType: event.type,
          eventId: event.id,
        });
        return {
          eventId: event.id,
          eventType: event.type,
          matchedRules: [],
          dispatchedActions: [],
          processingTimeMs: Date.now() - startTime,
        };
      }
      // Reset circuit breaker after timeout
      this.circuitBreaker.isOpen = false;
      this.circuitBreaker.failureCount = 0;
      logger.info('[EventRouter] Circuit breaker RESET');
    }

    // Update metrics
    this.metrics.totalEventsProcessed++;
    this.metrics.lastEventAt = event.timestamp;
    this.metrics.eventCountByType.set(
      event.type,
      (this.metrics.eventCountByType.get(event.type) ?? 0) + 1
    );

    // Find matching rules, sorted by priority
    const matchingRules = this.findMatchingRules(event);
    const matchedRuleIds = matchingRules.map(r => r.id);

    logger.info('[EventRouter] Processing event', {
      eventType: event.type,
      eventId: event.id,
      matchedRules: matchedRuleIds.length,
    });

    // Dispatch actions for each matching rule
    const dispatchedActions: EventProcessingResult['dispatchedActions'] = [];

    for (const rule of matchingRules) {
      // Check cooldown
      if (rule.cooldownMs) {
        const lastFired = this.cooldowns.get(rule.id);
        if (lastFired && Date.now() - lastFired < rule.cooldownMs) {
          logger.debug('[EventRouter] Rule on cooldown, skipping', {
            ruleId: rule.id,
            cooldownMs: rule.cooldownMs,
          });
          continue;
        }
      }

      for (const action of rule.actions) {
        const result = await this.dispatchAction(event, rule, action);
        dispatchedActions.push(result);

        if (!result.success) {
          this.circuitBreaker.failureCount++;
          if (this.circuitBreaker.failureCount >= this.circuitBreaker.failureThreshold) {
            this.circuitBreaker.isOpen = true;
            this.circuitBreaker.lastOpenedAt = new Date();
            logger.error('[EventRouter] Circuit breaker OPENED — too many failures', undefined, {
              failureCount: this.circuitBreaker.failureCount,
            });
          }
        }
      }

      // Update cooldown
      if (rule.cooldownMs) {
        this.cooldowns.set(rule.id, Date.now());
      }
    }

    this.metrics.totalRulesMatched += matchingRules.length;

    return {
      eventId: event.id,
      eventType: event.type,
      matchedRules: matchedRuleIds,
      dispatchedActions,
      processingTimeMs: Date.now() - startTime,
    };
  }

  // ==========================================================================
  // RULE MATCHING
  // ==========================================================================

  /**
   * Find all rules that match an event, sorted by priority (highest first)
   */
  private findMatchingRules(event: BusinessEvent): EventRule[] {
    const matched: EventRule[] = [];

    for (const rule of this.rules.values()) {
      if (!rule.enabled) { continue; }
      if (rule.event !== event.type) { continue; }

      // Evaluate all conditions (AND logic)
      const allConditionsMet = rule.conditions.every(condition =>
        this.evaluateCondition(condition, event.payload)
      );

      if (allConditionsMet) {
        matched.push(rule);
      }
    }

    // Sort by priority weight descending
    return matched.sort(
      (a, b) => PRIORITY_WEIGHT[b.priority] - PRIORITY_WEIGHT[a.priority]
    );
  }

  /**
   * Safely evaluate a single condition against event payload
   */
  private evaluateCondition(
    condition: ConditionClause,
    payload: Record<string, unknown>
  ): boolean {
    const fieldValue = this.getNestedValue(payload, condition.field);

    // If field doesn't exist in payload, condition fails
    if (fieldValue === undefined) { return false; }

    switch (condition.operator) {
      case '===':
        return fieldValue === condition.value;
      case '!==':
        return fieldValue !== condition.value;
      case '>':
        return typeof fieldValue === 'number' && fieldValue > Number(condition.value);
      case '>=':
        return typeof fieldValue === 'number' && fieldValue >= Number(condition.value);
      case '<':
        return typeof fieldValue === 'number' && fieldValue < Number(condition.value);
      case '<=':
        return typeof fieldValue === 'number' && fieldValue <= Number(condition.value);
      case 'includes':
        return typeof fieldValue === 'string' && fieldValue.includes(String(condition.value));
      case 'startsWith':
        return typeof fieldValue === 'string' && fieldValue.startsWith(String(condition.value));
      default:
        return false;
    }
  }

  /**
   * Get a nested value from an object using dot notation
   * e.g., 'classification.intent' → payload.classification.intent
   */
  private getNestedValue(obj: Record<string, unknown>, path: string): unknown {
    const parts = path.split('.');
    let current: unknown = obj;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return undefined;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return current;
  }

  // ==========================================================================
  // ACTION DISPATCH
  // ==========================================================================

  /**
   * Dispatch a single action to a Manager via SignalBus
   */
  private async dispatchAction(
    event: BusinessEvent,
    rule: EventRule,
    action: EventAction
  ): Promise<EventProcessingResult['dispatchedActions'][number]> {
    try {
      const signalBus = getSignalBus();

      // Build the command payload from event data using payload mapping
      const commandPayload: Record<string, unknown> = {
        eventId: event.id,
        eventType: event.type,
        eventSource: event.source,
        ruleId: rule.id,
        command: action.command,
      };

      for (const [targetKey, sourceField] of Object.entries(action.payloadMapping)) {
        commandPayload[targetKey] = this.getNestedValue(event.payload, sourceField);
      }

      // Create an AgentMessage for the target manager
      const message: AgentMessage = {
        id: `evt_${event.id}_${rule.id}_${Date.now()}`,
        timestamp: new Date(),
        from: 'EVENT_ROUTER',
        to: action.targetManager,
        type: 'COMMAND',
        priority: rule.priority === 'CRITICAL' ? 'CRITICAL' : rule.priority === 'HIGH' ? 'HIGH' : 'NORMAL',
        payload: commandPayload,
        requiresResponse: false,
        traceId: event.id,
      };

      // Send via SignalBus DIRECT signal to the target manager
      const signal = signalBus.createSignal(
        'DIRECT',
        'EVENT_ROUTER',
        action.targetManager,
        message
      );

      await signalBus.send(signal);

      this.metrics.totalActionsDispatched++;

      logger.info('[EventRouter] Action dispatched', {
        ruleId: rule.id,
        targetManager: action.targetManager,
        command: action.command,
        eventId: event.id,
      });

      return {
        ruleId: rule.id,
        targetManager: action.targetManager,
        command: action.command,
        success: true,
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      this.metrics.totalActionsFailed++;

      logger.error('[EventRouter] Action dispatch failed', error instanceof Error ? error : undefined, {
        ruleId: rule.id,
        targetManager: action.targetManager,
        command: action.command,
        eventId: event.id,
      });

      return {
        ruleId: rule.id,
        targetManager: action.targetManager,
        command: action.command,
        success: false,
        error: errorMsg,
      };
    }
  }

  // ==========================================================================
  // RULE MANAGEMENT
  // ==========================================================================

  /**
   * Register a new event rule
   */
  addRule(rule: EventRule): void {
    this.rules.set(rule.id, rule);
    logger.debug('[EventRouter] Rule added', { ruleId: rule.id, event: rule.event });
  }

  /**
   * Remove a rule by ID
   */
  removeRule(ruleId: string): boolean {
    const deleted = this.rules.delete(ruleId);
    if (deleted) {
      logger.debug('[EventRouter] Rule removed', { ruleId });
    }
    return deleted;
  }

  /**
   * Enable or disable a rule
   */
  setRuleEnabled(ruleId: string, enabled: boolean): void {
    const rule = this.rules.get(ruleId);
    if (rule) {
      rule.enabled = enabled;
      logger.debug('[EventRouter] Rule toggled', { ruleId, enabled });
    }
  }

  /**
   * Get all registered rules
   */
  getRules(): EventRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Get rules for a specific event type
   */
  getRulesForEvent(eventType: string): EventRule[] {
    return Array.from(this.rules.values()).filter(r => r.event === eventType);
  }

  // ==========================================================================
  // MONITORING
  // ==========================================================================

  /**
   * Get current metrics
   */
  getMetrics(): {
    totalEventsProcessed: number;
    totalRulesMatched: number;
    totalActionsDispatched: number;
    totalActionsFailed: number;
    lastEventAt: Date | null;
    eventCountByType: Record<string, number>;
    circuitBreakerOpen: boolean;
    ruleCount: number;
    enabledRuleCount: number;
  } {
    const eventCountByType: Record<string, number> = {};
    for (const [type, count] of this.metrics.eventCountByType) {
      eventCountByType[type] = count;
    }

    return {
      ...this.metrics,
      eventCountByType,
      circuitBreakerOpen: this.circuitBreaker.isOpen,
      ruleCount: this.rules.size,
      enabledRuleCount: Array.from(this.rules.values()).filter(r => r.enabled).length,
    };
  }

  /**
   * Reset metrics (for testing)
   */
  resetMetrics(): void {
    this.metrics = {
      totalEventsProcessed: 0,
      totalRulesMatched: 0,
      totalActionsDispatched: 0,
      totalActionsFailed: 0,
      lastEventAt: null,
      eventCountByType: new Map(),
    };
    this.circuitBreaker.isOpen = false;
    this.circuitBreaker.failureCount = 0;
  }

  // ==========================================================================
  // DEFAULT RULES — THE AUTONOMOUS BUSINESS PLAYBOOK
  // ==========================================================================

  private registerDefaultRules(): void {
    // ========================================================================
    // REVENUE EVENTS
    // ========================================================================

    this.addRule({
      id: 'rev-reply-interested',
      event: 'email.reply.received',
      conditions: [{ field: 'classification.intent', operator: '===', value: 'interested' }],
      actions: [{
        targetManager: AGENT_IDS.REVENUE_DIRECTOR as ManagerId,
        command: 'ADVANCE_LEAD_STAGE',
        payloadMapping: { leadId: 'leadId', prospectEmail: 'from', threadId: 'threadId' },
      }],
      priority: 'HIGH',
      enabled: true,
      description: 'Interested reply → Revenue Director advances lead stage',
    });

    this.addRule({
      id: 'rev-reply-needs-info',
      event: 'email.reply.received',
      conditions: [{ field: 'classification.intent', operator: '===', value: 'needs_more_info' }],
      actions: [
        {
          targetManager: AGENT_IDS.CONTENT_MANAGER as ManagerId,
          command: 'GENERATE_PROSPECT_ASSETS',
          payloadMapping: { leadId: 'leadId', prospectEmail: 'from', requestedInfo: 'classification.entities.requestedInfo' },
        },
        {
          targetManager: AGENT_IDS.OUTREACH_MANAGER as ManagerId,
          command: 'REPLY_WITH_ATTACHMENTS',
          payloadMapping: { leadId: 'leadId', prospectEmail: 'from', threadId: 'threadId' },
        },
      ],
      priority: 'HIGH',
      enabled: true,
      description: 'Needs-more-info reply → Content generates assets, Outreach sends reply',
    });

    this.addRule({
      id: 'rev-reply-objection',
      event: 'email.reply.received',
      conditions: [{ field: 'classification.intent', operator: '===', value: 'objection' }],
      actions: [
        {
          targetManager: AGENT_IDS.REVENUE_DIRECTOR as ManagerId,
          command: 'DEPLOY_OBJECTION_HANDLER',
          payloadMapping: { leadId: 'leadId', objectionType: 'classification.entities.objectionType', threadId: 'threadId' },
        },
        {
          targetManager: AGENT_IDS.OUTREACH_MANAGER as ManagerId,
          command: 'SEND_REBUTTAL',
          payloadMapping: { leadId: 'leadId', prospectEmail: 'from', threadId: 'threadId' },
        },
      ],
      priority: 'HIGH',
      enabled: true,
      description: 'Objection reply → Revenue deploys Objection Handler, Outreach sends rebuttal',
    });

    this.addRule({
      id: 'rev-reply-meeting',
      event: 'email.reply.received',
      conditions: [{ field: 'classification.intent', operator: '===', value: 'meeting_request' }],
      actions: [{
        targetManager: AGENT_IDS.REVENUE_DIRECTOR as ManagerId,
        command: 'ADVANCE_TO_NEGOTIATION',
        payloadMapping: { leadId: 'leadId', prospectEmail: 'from', meetingTime: 'classification.entities.meetingTime' },
      }],
      priority: 'CRITICAL',
      enabled: true,
      description: 'Meeting request → Revenue Director advances to NEGOTIATION',
    });

    this.addRule({
      id: 'rev-bant-threshold',
      event: 'lead.bant_score.updated',
      conditions: [{ field: 'score', operator: '>=', value: 70 }],
      actions: [{
        targetManager: AGENT_IDS.REVENUE_DIRECTOR as ManagerId,
        command: 'AUTO_TRANSITION_TO_OUTREACH',
        payloadMapping: { leadId: 'leadId', score: 'score', grade: 'grade' },
      }],
      priority: 'HIGH',
      enabled: true,
      description: 'BANT score crosses 70 → Revenue Director auto-transitions to OUTREACH',
    });

    this.addRule({
      id: 'rev-deal-won',
      event: 'deal.closed.won',
      conditions: [],
      actions: [
        {
          targetManager: AGENT_IDS.REPUTATION_MANAGER as ManagerId,
          command: 'START_REVIEW_SOLICITATION',
          payloadMapping: { dealId: 'dealId', contactEmail: 'contactEmail', companyName: 'companyName' },
        },
        {
          targetManager: AGENT_IDS.COMMERCE_MANAGER as ManagerId,
          command: 'PROCESS_PAYMENT',
          payloadMapping: { dealId: 'dealId', amount: 'amount', contactEmail: 'contactEmail' },
        },
      ],
      priority: 'HIGH',
      enabled: true,
      description: 'Deal closed won → Reputation solicits review, Commerce processes payment',
    });

    this.addRule({
      id: 'rev-deal-lost',
      event: 'deal.closed.lost',
      conditions: [],
      actions: [{
        targetManager: AGENT_IDS.REVENUE_DIRECTOR as ManagerId,
        command: 'LOG_WIN_LOSS_AND_UPDATE_BATTLECARDS',
        payloadMapping: { dealId: 'dealId', lossReason: 'lossReason', competitorId: 'competitorId' },
      }],
      priority: 'NORMAL',
      enabled: true,
      description: 'Deal closed lost → Revenue logs win/loss, updates battlecards',
    });

    // ========================================================================
    // OUTREACH EVENTS
    // ========================================================================

    this.addRule({
      id: 'out-sequence-underperforming',
      event: 'email.sequence.underperforming',
      conditions: [{ field: 'openRate', operator: '<', value: 10 }],
      actions: [
        {
          targetManager: AGENT_IDS.CONTENT_MANAGER as ManagerId,
          command: 'REWRITE_SUBJECT_LINES',
          payloadMapping: { sequenceId: 'sequenceId', currentSubjects: 'currentSubjects', openRate: 'openRate' },
        },
        {
          targetManager: AGENT_IDS.OUTREACH_MANAGER as ManagerId,
          command: 'SWAP_TEMPLATES',
          payloadMapping: { sequenceId: 'sequenceId' },
        },
      ],
      priority: 'HIGH',
      enabled: true,
      description: 'Sequence open rate < 10% for 3 days → Copywriter rewrites, Outreach swaps',
    });

    this.addRule({
      id: 'out-engagement-ghosting',
      event: 'email.engagement.ghosting',
      conditions: [
        { field: 'openCount', operator: '>=', value: 5 },
        { field: 'replyCount', operator: '===', value: 0 },
      ],
      actions: [{
        targetManager: AGENT_IDS.OUTREACH_MANAGER as ManagerId,
        command: 'TRIGGER_PATTERN_BREAK',
        payloadMapping: { leadId: 'leadId', prospectEmail: 'prospectEmail', openCount: 'openCount' },
      }],
      priority: 'NORMAL',
      enabled: true,
      description: '5+ opens, no reply within 48hrs → Outreach triggers pattern-break email',
    });

    this.addRule({
      id: 'out-engagement-hot',
      event: 'email.engagement.hot',
      conditions: [],
      actions: [{
        targetManager: AGENT_IDS.OUTREACH_MANAGER as ManagerId,
        command: 'ACCELERATE_NEXT_STEP',
        payloadMapping: { leadId: 'leadId', sequenceId: 'sequenceId', openedWithinMinutes: 'openedWithinMinutes' },
      }],
      priority: 'HIGH',
      enabled: true,
      description: 'Opened within 1 hour → Outreach accelerates next step timing',
    });

    // ========================================================================
    // MARKETING EVENTS
    // ========================================================================

    this.addRule({
      id: 'mkt-viral-post',
      event: 'post.metrics.updated',
      conditions: [{ field: 'engagementMultiplier', operator: '>', value: 5 }],
      actions: [{
        targetManager: AGENT_IDS.CONTENT_MANAGER as ManagerId,
        command: 'PRODUCE_FOLLOWUP_CONTENT',
        payloadMapping: { postId: 'postId', platform: 'platform', metrics: 'metrics', engagementMultiplier: 'engagementMultiplier' },
      }],
      priority: 'HIGH',
      enabled: true,
      description: 'Post engagement > 5x average → Content produces follow-up',
    });

    this.addRule({
      id: 'mkt-dead-content',
      event: 'post.metrics.updated',
      conditions: [{ field: 'engagementRate', operator: '<', value: 1 }],
      actions: [{
        targetManager: AGENT_IDS.MARKETING_MANAGER as ManagerId,
        command: 'EMERGENCY_CONTENT_ANALYSIS',
        payloadMapping: { postId: 'postId', platform: 'platform', metrics: 'metrics' },
      }],
      priority: 'NORMAL',
      enabled: true,
      cooldownMs: 86_400_000, // 24 hour cooldown to avoid spam
      description: 'Engagement < 1% for 7 days → Growth Analyst emergency analysis',
    });

    this.addRule({
      id: 'mkt-trend-detected',
      event: 'trend.detected',
      conditions: [{ field: 'urgency', operator: '===', value: 'HIGH' }],
      actions: [{
        targetManager: AGENT_IDS.MARKETING_MANAGER as ManagerId,
        command: 'ENTER_OPPORTUNISTIC_MODE',
        payloadMapping: { trendTopic: 'topic', trendSource: 'source', urgency: 'urgency' },
      }],
      priority: 'CRITICAL',
      enabled: true,
      description: 'High-urgency trend detected → Marketing enters OPPORTUNISTIC mode',
    });

    this.addRule({
      id: 'mkt-sentiment-spike',
      event: 'sentiment.spike',
      conditions: [{ field: 'direction', operator: '===', value: 'negative' }],
      actions: [{
        targetManager: AGENT_IDS.MARKETING_MANAGER as ManagerId,
        command: 'ENTER_CRISIS_RESPONSE_MODE',
        payloadMapping: { sentimentScore: 'score', sources: 'sources', summary: 'summary' },
      }],
      priority: 'CRITICAL',
      enabled: true,
      description: 'Negative sentiment spike → Marketing enters CRISIS_RESPONSE mode',
    });

    // ========================================================================
    // COMMERCE EVENTS
    // ========================================================================

    this.addRule({
      id: 'com-cart-abandoned',
      event: 'cart.abandoned',
      conditions: [],
      actions: [{
        targetManager: AGENT_IDS.OUTREACH_MANAGER as ManagerId,
        command: 'START_RECOVERY_SEQUENCE',
        payloadMapping: { cartId: 'cartId', customerEmail: 'customerEmail', cartValue: 'cartValue', items: 'items' },
      }],
      priority: 'HIGH',
      enabled: true,
      cooldownMs: 3_600_000, // 1 hour cooldown per cart
      description: 'Cart abandoned → Outreach starts recovery sequence',
    });

    this.addRule({
      id: 'com-loyalty-threshold',
      event: 'customer.loyalty.threshold',
      conditions: [],
      actions: [
        {
          targetManager: AGENT_IDS.COMMERCE_MANAGER as ManagerId,
          command: 'GENERATE_LOYALTY_OFFER',
          payloadMapping: { customerId: 'customerId', tier: 'tier', totalSpend: 'totalSpend' },
        },
        {
          targetManager: AGENT_IDS.OUTREACH_MANAGER as ManagerId,
          command: 'SEND_LOYALTY_REWARD',
          payloadMapping: { customerId: 'customerId', customerEmail: 'customerEmail' },
        },
      ],
      priority: 'NORMAL',
      enabled: true,
      description: 'Customer crosses loyalty tier → Commerce generates offer, Outreach sends',
    });

    // ========================================================================
    // BUILDER EVENTS
    // ========================================================================

    this.addRule({
      id: 'bld-high-bounce',
      event: 'page.bounce_rate.high',
      conditions: [{ field: 'bounceRate', operator: '>', value: 60 }],
      actions: [
        {
          targetManager: AGENT_IDS.ARCHITECT_MANAGER as ManagerId,
          command: 'REDESIGN_RECOMMENDATION',
          payloadMapping: { pageUrl: 'pageUrl', bounceRate: 'bounceRate', pageTitle: 'pageTitle' },
        },
        {
          targetManager: AGENT_IDS.BUILDER_MANAGER as ManagerId,
          command: 'REBUILD_PAGE',
          payloadMapping: { pageUrl: 'pageUrl', pageId: 'pageId' },
        },
      ],
      priority: 'NORMAL',
      enabled: true,
      cooldownMs: 86_400_000, // 24 hour cooldown
      description: 'Bounce rate > 60% → Architect redesigns, Builder rebuilds',
    });

    this.addRule({
      id: 'bld-campaign-launched',
      event: 'campaign.launched',
      conditions: [],
      actions: [{
        targetManager: AGENT_IDS.BUILDER_MANAGER as ManagerId,
        command: 'CREATE_LANDING_PAGE',
        payloadMapping: { campaignId: 'campaignId', campaignName: 'campaignName', targetAudience: 'targetAudience' },
      }],
      priority: 'NORMAL',
      enabled: true,
      description: 'New campaign launched → Builder creates matching landing page',
    });

    // ========================================================================
    // REPUTATION EVENTS
    // ========================================================================

    this.addRule({
      id: 'rep-review-positive',
      event: 'review.received',
      conditions: [{ field: 'rating', operator: '>=', value: 3 }],
      actions: [{
        targetManager: AGENT_IDS.REPUTATION_MANAGER as ManagerId,
        command: 'AUTO_RESPOND_TO_REVIEW',
        payloadMapping: { reviewId: 'reviewId', rating: 'rating', reviewText: 'reviewText', platform: 'platform' },
      }],
      priority: 'NORMAL',
      enabled: true,
      description: 'Review 3-5 stars → Review Specialist auto-responds',
    });

    this.addRule({
      id: 'rep-review-negative',
      event: 'review.received',
      conditions: [{ field: 'rating', operator: '<=', value: 2 }],
      actions: [{
        targetManager: AGENT_IDS.REPUTATION_MANAGER as ManagerId,
        command: 'DRAFT_RESPONSE_FOR_APPROVAL',
        payloadMapping: { reviewId: 'reviewId', rating: 'rating', reviewText: 'reviewText', platform: 'platform' },
      }],
      priority: 'HIGH',
      enabled: true,
      description: 'Review 1-2 stars → Draft response queued for Jasper human approval',
    });

    this.addRule({
      id: 'rep-review-five-star',
      event: 'review.received',
      conditions: [{ field: 'rating', operator: '===', value: 5 }],
      actions: [{
        targetManager: AGENT_IDS.MARKETING_MANAGER as ManagerId,
        command: 'REPURPOSE_AS_SOCIAL_PROOF',
        payloadMapping: { reviewId: 'reviewId', reviewText: 'reviewText', reviewerName: 'reviewerName', platform: 'platform' },
      }],
      priority: 'NORMAL',
      enabled: true,
      description: '5-star review → Marketing repurposes as social proof',
    });
  }
}

// ============================================================================
// SINGLETON + EVENT HELPER
// ============================================================================

let eventRouterInstance: EventRouter | null = null;

/**
 * Get the singleton EventRouter instance
 */
export function getEventRouter(): EventRouter {
  eventRouterInstance ??= new EventRouter();
  return eventRouterInstance;
}

/**
 * Reset the EventRouter (for testing)
 */
export function resetEventRouter(): void {
  eventRouterInstance = null;
}

/**
 * Helper to create and emit a business event
 */
export function createBusinessEvent(
  type: string,
  source: string,
  payload: Record<string, unknown>
): BusinessEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    type,
    timestamp: new Date(),
    source,
    payload,
  };
}

/**
 * Convenience: create + process an event in one call
 */
export async function emitBusinessEvent(
  type: string,
  source: string,
  payload: Record<string, unknown>
): Promise<EventProcessingResult> {
  const event = createBusinessEvent(type, source, payload);
  const router = getEventRouter();
  return router.processEvent(event);
}
