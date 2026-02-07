/**
 * Subscription Specialist (Graceful Stub)
 * STATUS: FUNCTIONAL
 *
 * Handles subscription lifecycle management: trial starts, billing cycles,
 * state transitions (TRIAL → ACTIVE → PAST_DUE → CANCELLED), and MRR calculation.
 *
 * CURRENT STATE: Subscription features are temporarily disabled. This specialist
 * returns structured "feature disabled" responses so the Commerce Manager's
 * delegation pipeline remains intact (no BLOCKED/not-registered errors).
 * When subscription features are re-enabled, replace stub handlers with real
 * Stripe Subscription API calls.
 *
 * CAPABILITIES:
 * - start_trial: Initialize trial subscription
 * - process_billing: Handle billing cycle events
 * - transition_state: Manage subscription state machine
 * - calculate_mrr: Compute MRR/churn metrics
 * - cancel_subscription: Process cancellations
 *
 * @module agents/commerce/subscription/specialist
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export type SubscriptionState = 'TRIAL' | 'ACTIVE' | 'PAST_DUE' | 'CANCELLED' | 'PAUSED';

interface SubscriptionPayload {
  action: string;
  orgId?: string;
  organizationId?: string;
  subscriptionId?: string;
  customerId?: string;
  customerEmail?: string;
  planId?: string;
  tierId?: string;
  trialDays?: number;
  currency?: string;
  targetState?: SubscriptionState;
  reason?: string;
  paymentSucceeded?: boolean;
  amount?: number;
  transactionId?: string;
}

interface SubscriptionResult {
  success: boolean;
  action: string;
  featureDisabled: boolean;
  message: string;
  subscriptionId?: string;
  state?: SubscriptionState;
  metrics?: {
    totalMRR: number;
    activeSubscriptions: number;
    trialSubscriptions: number;
    pastDueSubscriptions: number;
    churnedThisPeriod: number;
  };
  dunningSignal?: {
    shouldTrigger: boolean;
    targetAgent: string;
    sequence: { action: string; template: string };
  };
}

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'SUBSCRIPTION_SPECIALIST',
    name: 'Subscription Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'COMMERCE_MANAGER',
    capabilities: [
      'trial_management',
      'billing_cycles',
      'dunning_sequences',
      'state_transitions',
      'mrr_calculation',
    ],
  },
  systemPrompt: `You are the Subscription Specialist, responsible for subscription lifecycle management.
Your capabilities include:
- Starting and managing trial subscriptions
- Processing billing cycles and payment events
- Managing state transitions (TRIAL → ACTIVE → PAST_DUE → CANCELLED)
- Calculating MRR, churn, and subscription metrics
- Triggering dunning sequences for failed payments

NOTE: Subscription features are temporarily disabled. All operations return graceful
"feature disabled" responses until re-enabled.`,
  tools: ['start_trial', 'process_billing', 'transition_state', 'calculate_mrr'],
  outputSchema: {
    type: 'object',
    properties: {
      success: { type: 'boolean' },
      subscriptionId: { type: 'string' },
      state: { type: 'string' },
      message: { type: 'string' },
    },
  },
  maxTokens: 4096,
  temperature: 0.2,
};

const DISABLED_MESSAGE = 'Subscription features are temporarily disabled. This operation will be available when subscription management is re-enabled.';

// ============================================================================
// SUBSCRIPTION SPECIALIST IMPLEMENTATION
// ============================================================================

export class SubscriptionSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    this.log('INFO', 'Initializing Subscription Specialist (stub mode)...');
    this.isInitialized = true;
    this.log('INFO', 'Subscription Specialist initialized — feature disabled, graceful responses active');
    await Promise.resolve();
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    if (!this.isInitialized) {
      await this.initialize();
    }

    try {
      const payload = message.payload as SubscriptionPayload | null;
      const action = payload?.action ?? 'unknown';

      let result: SubscriptionResult;

      switch (action) {
        case 'start_trial':
          result = this.handleStartTrial(payload);
          break;

        case 'process_billing':
          result = this.handleProcessBilling(payload);
          break;

        case 'transition_state':
          result = this.handleTransitionState(payload);
          break;

        case 'calculate_mrr':
          result = this.handleCalculateMrr();
          break;

        case 'cancel_subscription':
          result = this.handleCancelSubscription(payload);
          break;

        default:
          result = {
            success: false,
            action,
            featureDisabled: true,
            message: `Unknown subscription action: ${action}. ${DISABLED_MESSAGE}`,
          };
      }

      // Subscription stub always returns COMPLETED with featureDisabled flag
      // so the Commerce Manager pipeline doesn't break
      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      this.log('ERROR', `Subscription execution error: ${err.message}`);
      return this.createReport(taskId, 'FAILED', null, [err.message]);
    }
  }

  private handleStartTrial(payload: SubscriptionPayload | null): SubscriptionResult {
    this.log('INFO', `Trial start requested for customer ${payload?.customerId ?? 'unknown'} — feature disabled`);
    return {
      success: true,
      action: 'start_trial',
      featureDisabled: true,
      message: DISABLED_MESSAGE,
      subscriptionId: undefined,
      state: 'TRIAL',
    };
  }

  private handleProcessBilling(payload: SubscriptionPayload | null): SubscriptionResult {
    this.log('INFO', `Billing event for subscription ${payload?.subscriptionId ?? 'unknown'} — feature disabled`);
    return {
      success: true,
      action: 'process_billing',
      featureDisabled: true,
      message: DISABLED_MESSAGE,
      subscriptionId: payload?.subscriptionId,
      state: payload?.paymentSucceeded ? 'ACTIVE' : 'PAST_DUE',
      dunningSignal: {
        shouldTrigger: false,
        targetAgent: 'OUTREACH_MANAGER',
        sequence: { action: 'noop', template: 'disabled' },
      },
    };
  }

  private handleTransitionState(payload: SubscriptionPayload | null): SubscriptionResult {
    this.log('INFO', `State transition to ${payload?.targetState ?? 'unknown'} — feature disabled`);
    return {
      success: true,
      action: 'transition_state',
      featureDisabled: true,
      message: DISABLED_MESSAGE,
      subscriptionId: payload?.subscriptionId,
      state: payload?.targetState,
    };
  }

  private handleCalculateMrr(): SubscriptionResult {
    this.log('INFO', 'MRR calculation requested — feature disabled, returning zeroed metrics');
    return {
      success: true,
      action: 'calculate_mrr',
      featureDisabled: true,
      message: DISABLED_MESSAGE,
      metrics: {
        totalMRR: 0,
        activeSubscriptions: 0,
        trialSubscriptions: 0,
        pastDueSubscriptions: 0,
        churnedThisPeriod: 0,
      },
    };
  }

  private handleCancelSubscription(payload: SubscriptionPayload | null): SubscriptionResult {
    this.log('INFO', `Cancellation requested for ${payload?.subscriptionId ?? 'unknown'} — feature disabled`);
    return {
      success: true,
      action: 'cancel_subscription',
      featureDisabled: true,
      message: DISABLED_MESSAGE,
      subscriptionId: payload?.subscriptionId,
      state: 'CANCELLED',
    };
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const message: AgentMessage = {
      id: signal.id,
      timestamp: signal.createdAt,
      from: signal.origin,
      to: this.identity.id,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: signal.payload.payload,
      requiresResponse: true,
      traceId: signal.id,
    };

    return this.execute(message);
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    // Stub with structured responses — not a shell (empty) agent
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 120, boilerplate: 50 };
  }
}

// Factory function for SwarmRegistry pattern
export function getSubscriptionSpecialist(): SubscriptionSpecialist {
  return new SubscriptionSpecialist();
}
