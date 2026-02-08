/**
 * Event Router Integration Tests
 *
 * Comprehensive test suite for the Event Router's business event processing,
 * rule matching, action dispatching, circuit breaker, and metrics tracking.
 */

import {
  getEventRouter,
  resetEventRouter,
  createBusinessEvent,
  emitBusinessEvent,
  type EventRule,
  type EventPriority,
} from '../event-router';

// ============================================================================
// MOCKS
// ============================================================================

// Mock the signal-bus
const mockCreateSignal = jest.fn();
const mockSend = jest.fn();

jest.mock('@/lib/orchestrator/signal-bus', () => ({
  getSignalBus: jest.fn(() => ({
    createSignal: mockCreateSignal,
    send: mockSend,
  })),
}));

// Mock the logger to silence console output during tests
jest.mock('@/lib/logger/logger', () => ({
  logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  },
}));

// Mock AGENT_IDS from the agents module
jest.mock('@/lib/agents', () => ({
  AGENT_IDS: {
    MASTER_ORCHESTRATOR: 'MASTER_ORCHESTRATOR',
    INTELLIGENCE_MANAGER: 'INTELLIGENCE_MANAGER',
    MARKETING_MANAGER: 'MARKETING_MANAGER',
    BUILDER_MANAGER: 'BUILDER_MANAGER',
    COMMERCE_MANAGER: 'COMMERCE_MANAGER',
    OUTREACH_MANAGER: 'OUTREACH_MANAGER',
    CONTENT_MANAGER: 'CONTENT_MANAGER',
    ARCHITECT_MANAGER: 'ARCHITECT_MANAGER',
    REVENUE_DIRECTOR: 'REVENUE_DIRECTOR',
    REPUTATION_MANAGER: 'REPUTATION_MANAGER',
    GROWTH_ANALYST: 'GROWTH_ANALYST',
  },
}));

// ============================================================================
// TEST SETUP / TEARDOWN
// ============================================================================

describe('EventRouter', () => {
  beforeEach(() => {
    // Reset the singleton and clear all mocks before each test
    resetEventRouter();
    jest.clearAllMocks();

    // Default mock implementations (successful dispatch)
    mockCreateSignal.mockReturnValue({ id: 'signal-123', type: 'DIRECT' });
    mockSend.mockResolvedValue(undefined);
  });

  afterEach(() => {
    resetEventRouter();
  });

  // ==========================================================================
  // INITIALIZATION TESTS
  // ==========================================================================

  describe('Initialization', () => {
    it('should initialize with 21 default rules', () => {
      const router = getEventRouter();
      const rules = router.getRules();

      expect(rules).toHaveLength(21);
      expect(rules.every(r => r.enabled)).toBe(true);
    });

    it('should return the same singleton instance on subsequent calls', () => {
      const router1 = getEventRouter();
      const router2 = getEventRouter();

      expect(router1).toBe(router2);
    });

    it('should create a fresh instance after resetEventRouter', () => {
      const router1 = getEventRouter();
      resetEventRouter();
      const router2 = getEventRouter();

      expect(router1).not.toBe(router2);
    });
  });

  // ==========================================================================
  // EVENT MATCHING TESTS
  // ==========================================================================

  describe('Event Matching', () => {
    it('should match email.reply.received with intent=interested to rev-reply-interested rule', async () => {
      const router = getEventRouter();
      const event = createBusinessEvent('email.reply.received', 'test-webhook', {
        classification: { intent: 'interested' },
        leadId: 'lead-123',
        from: 'prospect@example.com',
        threadId: 'thread-456',
      });

      const result = await router.processEvent(event);

      expect(result.matchedRules).toContain('rev-reply-interested');
      expect(result.dispatchedActions).toHaveLength(1);
      expect(result.dispatchedActions[0].targetManager).toBe('REVENUE_DIRECTOR');
      expect(result.dispatchedActions[0].command).toBe('ADVANCE_LEAD_STAGE');
      expect(result.dispatchedActions[0].success).toBe(true);
    });

    it('should match email.reply.received with intent=objection to rev-reply-objection rule', async () => {
      const router = getEventRouter();
      const event = createBusinessEvent('email.reply.received', 'test-webhook', {
        classification: {
          intent: 'objection',
          entities: { objectionType: 'price' },
        },
        leadId: 'lead-123',
        from: 'prospect@example.com',
        threadId: 'thread-456',
      });

      const result = await router.processEvent(event);

      expect(result.matchedRules).toContain('rev-reply-objection');
      expect(result.dispatchedActions).toHaveLength(2);
      expect(result.dispatchedActions[0].targetManager).toBe('REVENUE_DIRECTOR');
      expect(result.dispatchedActions[0].command).toBe('DEPLOY_OBJECTION_HANDLER');
      expect(result.dispatchedActions[1].targetManager).toBe('OUTREACH_MANAGER');
      expect(result.dispatchedActions[1].command).toBe('SEND_REBUTTAL');
    });

    it('should match email.reply.received with intent=meeting_request to rev-reply-meeting rule', async () => {
      const router = getEventRouter();
      const event = createBusinessEvent('email.reply.received', 'test-webhook', {
        classification: {
          intent: 'meeting_request',
          entities: { meetingTime: '2026-02-10T10:00:00Z' },
        },
        leadId: 'lead-123',
        from: 'prospect@example.com',
      });

      const result = await router.processEvent(event);

      expect(result.matchedRules).toContain('rev-reply-meeting');
      expect(result.dispatchedActions).toHaveLength(1);
      expect(result.dispatchedActions[0].targetManager).toBe('REVENUE_DIRECTOR');
      expect(result.dispatchedActions[0].command).toBe('ADVANCE_TO_NEGOTIATION');
    });

    it('should match post.metrics.updated with high engagement to mkt-viral-post rule', async () => {
      const router = getEventRouter();
      const event = createBusinessEvent('post.metrics.updated', 'analytics-cron', {
        postId: 'post-123',
        platform: 'linkedin',
        engagementMultiplier: 7.5,
        metrics: { likes: 500, shares: 100 },
      });

      const result = await router.processEvent(event);

      expect(result.matchedRules).toContain('mkt-viral-post');
      expect(result.dispatchedActions).toHaveLength(1);
      expect(result.dispatchedActions[0].targetManager).toBe('CONTENT_MANAGER');
      expect(result.dispatchedActions[0].command).toBe('PRODUCE_FOLLOWUP_CONTENT');
    });

    it('should match cart.abandoned to com-cart-abandoned rule', async () => {
      const router = getEventRouter();
      const event = createBusinessEvent('cart.abandoned', 'stripe-webhook', {
        cartId: 'cart-123',
        customerEmail: 'customer@example.com',
        cartValue: 299.99,
        items: ['item-1', 'item-2'],
      });

      const result = await router.processEvent(event);

      expect(result.matchedRules).toContain('com-cart-abandoned');
      expect(result.dispatchedActions).toHaveLength(1);
      expect(result.dispatchedActions[0].targetManager).toBe('OUTREACH_MANAGER');
      expect(result.dispatchedActions[0].command).toBe('START_RECOVERY_SEQUENCE');
    });

    it('should match review.received with rating=5 to BOTH rep-review-positive AND rep-review-five-star', async () => {
      const router = getEventRouter();
      const event = createBusinessEvent('review.received', 'google-webhook', {
        reviewId: 'review-123',
        rating: 5,
        reviewText: 'Amazing product!',
        reviewerName: 'John Doe',
        platform: 'google',
      });

      const result = await router.processEvent(event);

      // Should match both rules
      expect(result.matchedRules).toContain('rep-review-positive');
      expect(result.matchedRules).toContain('rep-review-five-star');
      expect(result.dispatchedActions).toHaveLength(2);

      // Check first action (positive review response)
      expect(result.dispatchedActions[0].targetManager).toBe('REPUTATION_MANAGER');
      expect(result.dispatchedActions[0].command).toBe('AUTO_RESPOND_TO_REVIEW');

      // Check second action (repurpose as social proof)
      expect(result.dispatchedActions[1].targetManager).toBe('MARKETING_MANAGER');
      expect(result.dispatchedActions[1].command).toBe('REPURPOSE_AS_SOCIAL_PROOF');
    });

    it('should match review.received with rating=1 to rep-review-negative', async () => {
      const router = getEventRouter();
      const event = createBusinessEvent('review.received', 'yelp-webhook', {
        reviewId: 'review-456',
        rating: 1,
        reviewText: 'Terrible service',
        platform: 'yelp',
      });

      const result = await router.processEvent(event);

      expect(result.matchedRules).toContain('rep-review-negative');
      expect(result.dispatchedActions).toHaveLength(1);
      expect(result.dispatchedActions[0].targetManager).toBe('REPUTATION_MANAGER');
      expect(result.dispatchedActions[0].command).toBe('DRAFT_RESPONSE_FOR_APPROVAL');
    });
  });

  // ==========================================================================
  // CONDITION EVALUATION TESTS
  // ==========================================================================

  describe('Condition Evaluation', () => {
    describe('Numeric operators', () => {
      it('should correctly evaluate > operator', async () => {
        const router = getEventRouter();
        const event = createBusinessEvent('post.metrics.updated', 'test', {
          engagementMultiplier: 6,
        });

        const result = await router.processEvent(event);

        // mkt-viral-post rule checks engagementMultiplier > 5
        expect(result.matchedRules).toContain('mkt-viral-post');
      });

      it('should correctly evaluate >= operator', async () => {
        const router = getEventRouter();
        const event = createBusinessEvent('lead.bant_score.updated', 'test', {
          leadId: 'lead-123',
          score: 70,
          grade: 'A',
        });

        const result = await router.processEvent(event);

        // rev-bant-threshold rule checks score >= 70
        expect(result.matchedRules).toContain('rev-bant-threshold');
      });

      it('should correctly evaluate < operator', async () => {
        const router = getEventRouter();
        const event = createBusinessEvent('email.sequence.underperforming', 'test', {
          sequenceId: 'seq-123',
          openRate: 5,
          currentSubjects: ['Test Subject'],
        });

        const result = await router.processEvent(event);

        // out-sequence-underperforming rule checks openRate < 10
        expect(result.matchedRules).toContain('out-sequence-underperforming');
      });

      it('should correctly evaluate <= operator', async () => {
        const router = getEventRouter();
        const event = createBusinessEvent('review.received', 'test', {
          reviewId: 'review-789',
          rating: 2,
          reviewText: 'Not great',
          platform: 'trustpilot',
        });

        const result = await router.processEvent(event);

        // rep-review-negative rule checks rating <= 2
        expect(result.matchedRules).toContain('rep-review-negative');
      });
    });

    describe('String operators', () => {
      it('should correctly evaluate includes operator', async () => {
        const router = getEventRouter();

        // Add a custom rule for testing includes
        router.addRule({
          id: 'test-includes',
          event: 'test.event',
          conditions: [{ field: 'message', operator: 'includes', value: 'error' }],
          actions: [{
            targetManager: 'MARKETING_MANAGER' as const,
            command: 'TEST_COMMAND',
            payloadMapping: {},
          }],
          priority: 'NORMAL',
          enabled: true,
          description: 'Test includes operator',
        });

        // Test with matching event
        const event = createBusinessEvent('test.event', 'test', {
          message: 'This is an error message',
        });

        const result = await router.processEvent(event);
        expect(result.matchedRules).toContain('test-includes');
      });

      it('should correctly evaluate startsWith operator', async () => {
        const router = getEventRouter();

        // Add a custom rule for testing startsWith
        router.addRule({
          id: 'test-startswith',
          event: 'test.event',
          conditions: [{ field: 'prefix', operator: 'startsWith', value: 'urgent' }],
          actions: [{
            targetManager: 'MARKETING_MANAGER' as const,
            command: 'TEST_COMMAND',
            payloadMapping: {},
          }],
          priority: 'NORMAL',
          enabled: true,
          description: 'Test startsWith operator',
        });

        // Test with matching event
        const event = createBusinessEvent('test.event', 'test', {
          prefix: 'urgent: this is urgent',
        });

        const result = await router.processEvent(event);
        expect(result.matchedRules).toContain('test-startswith');
      });
    });

    describe('Nested field access', () => {
      it('should correctly access nested fields using dot notation', async () => {
        const router = getEventRouter();
        const event = createBusinessEvent('email.reply.received', 'test', {
          classification: {
            intent: 'interested',
            entities: {
              requestedInfo: 'pricing',
            },
          },
          leadId: 'lead-123',
        });

        const result = await router.processEvent(event);

        // Rule checks classification.intent === 'interested'
        expect(result.matchedRules).toContain('rev-reply-interested');
      });

      it('should return undefined for non-existent nested fields', async () => {
        const router = getEventRouter();
        const event = createBusinessEvent('email.reply.received', 'test', {
          leadId: 'lead-123',
          // Missing classification.intent
        });

        const result = await router.processEvent(event);

        // Should not match any email.reply.received rules without proper intent
        expect(result.matchedRules).toHaveLength(0);
      });
    });
  });

  // ==========================================================================
  // CIRCUIT BREAKER TESTS
  // ==========================================================================

  describe('Circuit Breaker', () => {
    it('should open after 10 consecutive failures', async () => {
      const router = getEventRouter();

      // Mock send to fail
      mockSend.mockRejectedValue(new Error('Dispatch failed'));

      // Create an event that will match a rule
      const event = createBusinessEvent('email.reply.received', 'test', {
        classification: { intent: 'interested' },
        leadId: 'lead-123',
        from: 'test@example.com',
        threadId: 'thread-123',
      });

      // Process 10 events to trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        await router.processEvent(event);
      }

      // Check metrics - circuit breaker should be open
      const metrics = router.getMetrics();
      expect(metrics.circuitBreakerOpen).toBe(true);
      expect(metrics.totalActionsFailed).toBe(10);
    });

    it('should block events when circuit breaker is open', async () => {
      const router = getEventRouter();

      // Mock send to fail
      mockSend.mockRejectedValue(new Error('Dispatch failed'));

      // Create event
      const event = createBusinessEvent('email.reply.received', 'test', {
        classification: { intent: 'interested' },
        leadId: 'lead-123',
        from: 'test@example.com',
        threadId: 'thread-123',
      });

      // Trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        await router.processEvent(event);
      }

      // Circuit breaker should be open
      expect(router.getMetrics().circuitBreakerOpen).toBe(true);

      // Next event should be dropped
      const result = await router.processEvent(event);
      expect(result.matchedRules).toHaveLength(0);
      expect(result.dispatchedActions).toHaveLength(0);
    });

    it('should reset after timeout', async () => {
      const router = getEventRouter();

      // Mock send to fail initially
      mockSend.mockRejectedValue(new Error('Dispatch failed'));

      // Create event
      const event = createBusinessEvent('email.reply.received', 'test', {
        classification: { intent: 'interested' },
        leadId: 'lead-123',
        from: 'test@example.com',
        threadId: 'thread-123',
      });

      // Trigger circuit breaker
      for (let i = 0; i < 10; i++) {
        await router.processEvent(event);
      }

      expect(router.getMetrics().circuitBreakerOpen).toBe(true);

      // Mock successful send for next call
      mockSend.mockResolvedValue(undefined);

      // Fast-forward time by 61 seconds (beyond reset timeout)
      jest.useFakeTimers();
      jest.advanceTimersByTime(61_000);

      // Process another event - should reset circuit breaker
      const result = await router.processEvent(event);
      expect(result.matchedRules.length).toBeGreaterThan(0);
      expect(router.getMetrics().circuitBreakerOpen).toBe(false);

      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // COOLDOWN ENFORCEMENT TESTS
  // ==========================================================================

  describe('Cooldown Enforcement', () => {
    it('should enforce cooldown on rules with cooldownMs', async () => {
      const router = getEventRouter();

      // cart.abandoned has 1-hour cooldown
      const event = createBusinessEvent('cart.abandoned', 'test', {
        cartId: 'cart-123',
        customerEmail: 'test@example.com',
        cartValue: 100,
        items: [],
      });

      // First event should process
      const result1 = await router.processEvent(event);
      expect(result1.matchedRules).toContain('com-cart-abandoned');
      expect(result1.dispatchedActions).toHaveLength(1);

      // Second event immediately after should be blocked by cooldown
      const result2 = await router.processEvent(event);
      expect(result2.matchedRules).toContain('com-cart-abandoned');
      expect(result2.dispatchedActions).toHaveLength(0); // No actions due to cooldown
    });

    it('should allow rule firing after cooldown expires', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('cart.abandoned', 'test', {
        cartId: 'cart-123',
        customerEmail: 'test@example.com',
        cartValue: 100,
        items: [],
      });

      // First event
      await router.processEvent(event);

      // Fast-forward time by 3601 seconds (beyond 1-hour cooldown)
      jest.useFakeTimers();
      jest.advanceTimersByTime(3_601_000);

      // Second event should process
      const result = await router.processEvent(event);
      expect(result.matchedRules).toContain('com-cart-abandoned');
      expect(result.dispatchedActions).toHaveLength(1);

      jest.useRealTimers();
    });
  });

  // ==========================================================================
  // RULE MANAGEMENT TESTS
  // ==========================================================================

  describe('Rule Management', () => {
    it('should add a new rule', () => {
      const router = getEventRouter();
      const initialRuleCount = router.getRules().length;

      const newRule: EventRule = {
        id: 'test-rule',
        event: 'test.event',
        conditions: [],
        actions: [{
          targetManager: 'MARKETING_MANAGER' as const,
          command: 'TEST_COMMAND',
          payloadMapping: {},
        }],
        priority: 'NORMAL',
        enabled: true,
        description: 'Test rule',
      };

      router.addRule(newRule);

      expect(router.getRules()).toHaveLength(initialRuleCount + 1);
      expect(router.getRulesForEvent('test.event')).toHaveLength(1);
    });

    it('should remove a rule by ID', () => {
      const router = getEventRouter();
      const initialRuleCount = router.getRules().length;

      const removed = router.removeRule('rev-reply-interested');

      expect(removed).toBe(true);
      expect(router.getRules()).toHaveLength(initialRuleCount - 1);
      expect(router.getRulesForEvent('email.reply.received').find(r => r.id === 'rev-reply-interested')).toBeUndefined();
    });

    it('should return false when removing non-existent rule', () => {
      const router = getEventRouter();
      const removed = router.removeRule('non-existent-rule');
      expect(removed).toBe(false);
    });

    it('should enable/disable a rule', () => {
      const router = getEventRouter();

      // Disable the rule
      router.setRuleEnabled('rev-reply-interested', false);
      const disabledRule = router.getRules().find(r => r.id === 'rev-reply-interested');
      expect(disabledRule?.enabled).toBe(false);

      // Re-enable the rule
      router.setRuleEnabled('rev-reply-interested', true);
      const enabledRule = router.getRules().find(r => r.id === 'rev-reply-interested');
      expect(enabledRule?.enabled).toBe(true);
    });

    it('should skip disabled rules during event processing', async () => {
      const router = getEventRouter();

      // Disable the rule
      router.setRuleEnabled('rev-reply-interested', false);

      const event = createBusinessEvent('email.reply.received', 'test', {
        classification: { intent: 'interested' },
        leadId: 'lead-123',
        from: 'test@example.com',
        threadId: 'thread-123',
      });

      const result = await router.processEvent(event);

      expect(result.matchedRules).not.toContain('rev-reply-interested');
    });
  });

  // ==========================================================================
  // METRICS TRACKING TESTS
  // ==========================================================================

  describe('Metrics Tracking', () => {
    it('should track totalEventsProcessed', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('test.event', 'test', {});

      await router.processEvent(event);
      await router.processEvent(event);
      await router.processEvent(event);

      const metrics = router.getMetrics();
      expect(metrics.totalEventsProcessed).toBe(3);
    });

    it('should track totalRulesMatched', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('email.reply.received', 'test', {
        classification: { intent: 'interested' },
        leadId: 'lead-123',
        from: 'test@example.com',
        threadId: 'thread-123',
      });

      await router.processEvent(event);

      const metrics = router.getMetrics();
      expect(metrics.totalRulesMatched).toBe(1);
    });

    it('should track totalActionsDispatched', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('email.reply.received', 'test', {
        classification: { intent: 'objection' },
        leadId: 'lead-123',
        from: 'test@example.com',
        threadId: 'thread-123',
      });

      await router.processEvent(event);

      const metrics = router.getMetrics();
      expect(metrics.totalActionsDispatched).toBe(2); // Objection rule has 2 actions
    });

    it('should track totalActionsFailed', async () => {
      const router = getEventRouter();

      // Mock send to fail
      mockSend.mockRejectedValue(new Error('Dispatch failed'));

      const event = createBusinessEvent('email.reply.received', 'test', {
        classification: { intent: 'interested' },
        leadId: 'lead-123',
        from: 'test@example.com',
        threadId: 'thread-123',
      });

      await router.processEvent(event);

      const metrics = router.getMetrics();
      expect(metrics.totalActionsFailed).toBe(1);
    });

    it('should track lastEventAt timestamp', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('test.event', 'test', {});

      await router.processEvent(event);

      const metrics = router.getMetrics();
      expect(metrics.lastEventAt).toBeInstanceOf(Date);
    });

    it('should track eventCountByType', async () => {
      const router = getEventRouter();

      await router.processEvent(createBusinessEvent('test.event.1', 'test', {}));
      await router.processEvent(createBusinessEvent('test.event.1', 'test', {}));
      await router.processEvent(createBusinessEvent('test.event.2', 'test', {}));

      const metrics = router.getMetrics();
      expect(metrics.eventCountByType['test.event.1']).toBe(2);
      expect(metrics.eventCountByType['test.event.2']).toBe(1);
    });

    it('should track circuitBreakerOpen status', () => {
      const router = getEventRouter();

      const metrics = router.getMetrics();
      expect(metrics.circuitBreakerOpen).toBe(false);
    });

    it('should track ruleCount and enabledRuleCount', () => {
      const router = getEventRouter();

      const metrics = router.getMetrics();
      expect(metrics.ruleCount).toBe(21);
      expect(metrics.enabledRuleCount).toBe(21);

      // Disable one rule
      router.setRuleEnabled('rev-reply-interested', false);

      const updatedMetrics = router.getMetrics();
      expect(updatedMetrics.ruleCount).toBe(21);
      expect(updatedMetrics.enabledRuleCount).toBe(20);
    });

    it('should reset metrics', async () => {
      const router = getEventRouter();

      // Generate some metrics
      await router.processEvent(createBusinessEvent('test.event', 'test', {}));

      router.resetMetrics();

      const metrics = router.getMetrics();
      expect(metrics.totalEventsProcessed).toBe(0);
      expect(metrics.totalRulesMatched).toBe(0);
      expect(metrics.totalActionsDispatched).toBe(0);
      expect(metrics.totalActionsFailed).toBe(0);
      expect(metrics.lastEventAt).toBeNull();
      expect(metrics.circuitBreakerOpen).toBe(false);
    });
  });

  // ==========================================================================
  // PRIORITY ORDERING TESTS
  // ==========================================================================

  describe('Priority Ordering', () => {
    it('should process CRITICAL priority rules before LOW priority rules', async () => {
      const router = getEventRouter();

      // Add custom rules with different priorities
      router.addRule({
        id: 'low-priority',
        event: 'priority.test',
        conditions: [],
        actions: [{
          targetManager: 'MARKETING_MANAGER' as const,
          command: 'LOW_COMMAND',
          payloadMapping: {},
        }],
        priority: 'LOW',
        enabled: true,
        description: 'Low priority rule',
      });

      router.addRule({
        id: 'critical-priority',
        event: 'priority.test',
        conditions: [],
        actions: [{
          targetManager: 'MARKETING_MANAGER' as const,
          command: 'CRITICAL_COMMAND',
          payloadMapping: {},
        }],
        priority: 'CRITICAL',
        enabled: true,
        description: 'Critical priority rule',
      });

      const event = createBusinessEvent('priority.test', 'test', {});
      const result = await router.processEvent(event);

      // Critical rule should be processed first
      expect(result.matchedRules[0]).toBe('critical-priority');
      expect(result.matchedRules[1]).toBe('low-priority');
    });

    it('should maintain priority order: CRITICAL > HIGH > NORMAL > LOW', async () => {
      const router = getEventRouter();

      const priorities: EventPriority[] = ['LOW', 'NORMAL', 'HIGH', 'CRITICAL'];

      priorities.forEach(priority => {
        router.addRule({
          id: `${priority.toLowerCase()}-rule`,
          event: 'multi.priority.test',
          conditions: [],
          actions: [{
            targetManager: 'MARKETING_MANAGER' as const,
            command: `${priority}_COMMAND`,
            payloadMapping: {},
          }],
          priority,
          enabled: true,
          description: `${priority} priority rule`,
        });
      });

      const event = createBusinessEvent('multi.priority.test', 'test', {});
      const result = await router.processEvent(event);

      // Should be ordered: CRITICAL, HIGH, NORMAL, LOW
      expect(result.matchedRules[0]).toBe('critical-rule');
      expect(result.matchedRules[1]).toBe('high-rule');
      expect(result.matchedRules[2]).toBe('normal-rule');
      expect(result.matchedRules[3]).toBe('low-rule');
    });
  });

  // ==========================================================================
  // HELPER FUNCTIONS TESTS
  // ==========================================================================

  describe('Helper Functions', () => {
    describe('createBusinessEvent', () => {
      it('should create a properly structured BusinessEvent', () => {
        const event = createBusinessEvent('test.event', 'test-source', {
          key1: 'value1',
          key2: 123,
        });

        expect(event.id).toMatch(/^evt_\d+_[a-z0-9]+$/);
        expect(event.type).toBe('test.event');
        expect(event.source).toBe('test-source');
        expect(event.timestamp).toBeInstanceOf(Date);
        expect(event.payload).toEqual({ key1: 'value1', key2: 123 });
      });

      it('should generate unique event IDs', () => {
        const event1 = createBusinessEvent('test', 'source', {});
        const event2 = createBusinessEvent('test', 'source', {});

        expect(event1.id).not.toBe(event2.id);
      });
    });

    describe('emitBusinessEvent', () => {
      it('should create and process an event in one call', async () => {
        const result = await emitBusinessEvent('email.reply.received', 'test', {
          classification: { intent: 'interested' },
          leadId: 'lead-123',
          from: 'test@example.com',
          threadId: 'thread-123',
        });

        expect(result.eventType).toBe('email.reply.received');
        expect(result.matchedRules).toContain('rev-reply-interested');
        expect(result.dispatchedActions).toHaveLength(1);
      });

      it('should return processing result', async () => {
        const result = await emitBusinessEvent('test.event', 'test-source', {});

        expect(result).toHaveProperty('eventId');
        expect(result).toHaveProperty('eventType');
        expect(result).toHaveProperty('matchedRules');
        expect(result).toHaveProperty('dispatchedActions');
        expect(result).toHaveProperty('processingTimeMs');
        expect(typeof result.processingTimeMs).toBe('number');
      });
    });

    describe('resetEventRouter', () => {
      it('should create a fresh instance with clean state', async () => {
        const router1 = getEventRouter();

        // Process an event to generate metrics
        await router1.processEvent(createBusinessEvent('test.event', 'test', {}));

        expect(router1.getMetrics().totalEventsProcessed).toBe(1);

        // Reset
        resetEventRouter();

        const router2 = getEventRouter();
        expect(router2.getMetrics().totalEventsProcessed).toBe(0);
        expect(router1).not.toBe(router2);
      });
    });
  });

  // ==========================================================================
  // EDGE CASES
  // ==========================================================================

  describe('Edge Cases', () => {
    it('should handle events with no matching rules', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('nonexistent.event', 'test', {});
      const result = await router.processEvent(event);

      expect(result.matchedRules).toHaveLength(0);
      expect(result.dispatchedActions).toHaveLength(0);
    });

    it('should handle events with empty payload', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('test.event', 'test', {});
      const result = await router.processEvent(event);

      expect(result).toHaveProperty('eventId');
      expect(result).toHaveProperty('processingTimeMs');
    });

    it('should handle rules with empty actions array', () => {
      const router = getEventRouter();

      router.addRule({
        id: 'no-actions',
        event: 'test.event',
        conditions: [],
        actions: [],
        priority: 'NORMAL',
        enabled: true,
        description: 'Rule with no actions',
      });

      const rules = router.getRulesForEvent('test.event');
      expect(rules).toHaveLength(1);
    });

    it('should handle payload with null values', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('test.event', 'test', {
        nullValue: null,
        validValue: 'test',
      });

      const result = await router.processEvent(event);
      expect(result).toHaveProperty('eventId');
    });

    it('should handle deeply nested payload structures', async () => {
      const router = getEventRouter();

      const event = createBusinessEvent('email.reply.received', 'test', {
        classification: {
          intent: 'needs_more_info',
          entities: {
            requestedInfo: 'pricing',
            nestedData: {
              deeply: {
                nested: {
                  value: 'test',
                },
              },
            },
          },
        },
        leadId: 'lead-123',
      });

      const result = await router.processEvent(event);
      expect(result.matchedRules).toContain('rev-reply-needs-info');
    });
  });
});
