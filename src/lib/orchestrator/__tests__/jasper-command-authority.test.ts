/**
 * Integration tests for Jasper Command Authority (Phase 8)
 *
 * Tests cover:
 * - 8a: Executive Briefing System
 * - 8b: Approval Gateway
 * - 8c: Command Authority
 *
 * @see src/lib/orchestrator/jasper-command-authority.ts
 */

import { jest } from '@jest/globals';

// Setup simple mocks that return empty data
const mockMemoryVault = {
  write: jest.fn(),
  query: jest.fn(() => []),
  read: jest.fn(),
  delete: jest.fn(),
  subscribe: jest.fn(),
  unsubscribe: jest.fn(),
  getMetrics: jest.fn(() => ({ reads: 0, writes: 0 })),
};

const mockSignalBus = {
  createSignal: jest.fn((type: string, from: string, to: string, payload: Record<string, unknown>) => ({
    signalId: `signal-${Date.now()}`,
    type,
    from,
    to,
    payload,
    timestamp: new Date(),
  })),
  send: jest.fn(() => Promise.resolve([])),
};

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
};

// Mock dependencies before importing
jest.mock('@/lib/agents/shared/memory-vault', () => ({
  getMemoryVault: () => mockMemoryVault,
}));

jest.mock('@/lib/orchestrator/signal-bus', () => ({
  getSignalBus: () => mockSignalBus,
}));

jest.mock('@/lib/agents', () => ({
  AGENT_IDS: {
    INTELLIGENCE_MANAGER: 'INTELLIGENCE_MANAGER',
    MARKETING_MANAGER: 'MARKETING_MANAGER',
    BUILDER_MANAGER: 'BUILDER_MANAGER',
    COMMERCE_MANAGER: 'COMMERCE_MANAGER',
    OUTREACH_MANAGER: 'OUTREACH_MANAGER',
    CONTENT_MANAGER: 'CONTENT_MANAGER',
    ARCHITECT_MANAGER: 'ARCHITECT_MANAGER',
    REVENUE_DIRECTOR: 'REVENUE_DIRECTOR',
    REPUTATION_MANAGER: 'REPUTATION_MANAGER',
  },
}));

jest.mock('@/lib/logger/logger', () => ({
  logger: mockLogger,
}));

// Import after mocks are set up
import {
  getJasperCommandAuthority,
  resetJasperCommandAuthority,
} from '@/lib/orchestrator/jasper-command-authority';

import { AGENT_IDS } from '@/lib/agents';

describe('Jasper Command Authority (Phase 8)', () => {
  beforeEach(() => {
    // Reset singleton before each test
    resetJasperCommandAuthority();
  });

  describe('Singleton Lifecycle', () => {
    test('getJasperCommandAuthority returns same instance', () => {
      const instance1 = getJasperCommandAuthority();
      const instance2 = getJasperCommandAuthority();

      expect(instance1).toBe(instance2);
    });

    test('reset creates new instance', () => {
      const instance1 = getJasperCommandAuthority();
      resetJasperCommandAuthority();
      const instance2 = getJasperCommandAuthority();

      expect(instance1).not.toBe(instance2);
    });
  });

  describe('8a: Executive Briefing System', () => {
    test('generateExecutiveBriefing returns valid ExecutiveBriefing structure', async () => {
      const jasper = getJasperCommandAuthority();
      const briefing = await jasper.generateExecutiveBriefing();

      // Validate structure
      expect(briefing).toBeDefined();
      expect(briefing.briefingId).toMatch(/^brief_\d+_[a-z0-9]+$/);
      expect(briefing.generatedAt).toBeInstanceOf(Date);
      expect(briefing.periodStart).toBeInstanceOf(Date);
      expect(briefing.periodEnd).toBeInstanceOf(Date);
      expect(typeof briefing.summary).toBe('string');
      expect(Array.isArray(briefing.highlights)).toBe(true);
      expect(Array.isArray(briefing.pendingApprovals)).toBe(true);
      expect(Array.isArray(briefing.departmentSummaries)).toBe(true);
      expect(briefing.metrics).toBeDefined();
    });

    test('briefing has 9 department summaries (one per manager)', async () => {
      const jasper = getJasperCommandAuthority();
      const briefing = await jasper.generateExecutiveBriefing();

      expect(briefing.departmentSummaries).toHaveLength(9);

      // Verify each department summary has required fields
      briefing.departmentSummaries.forEach((dept) => {
        expect(typeof dept.department).toBe('string');
        expect(typeof dept.managerId).toBe('string');
        expect(['HEALTHY', 'NEEDS_ATTENTION', 'CRITICAL']).toContain(dept.status);
        expect(typeof dept.actionsCompleted).toBe('number');
        expect(typeof dept.actionsPending).toBe('number');
        expect(typeof dept.keyMetric).toBe('string');
        expect(typeof dept.keyMetricValue).toBe('string');
        expect(['UP', 'DOWN', 'STABLE']).toContain(dept.trend);
      });

      // Verify all managers are represented
      const managerIds = briefing.departmentSummaries.map(d => d.managerId);
      expect(managerIds).toContain(AGENT_IDS.INTELLIGENCE_MANAGER);
      expect(managerIds).toContain(AGENT_IDS.MARKETING_MANAGER);
      expect(managerIds).toContain(AGENT_IDS.BUILDER_MANAGER);
      expect(managerIds).toContain(AGENT_IDS.COMMERCE_MANAGER);
      expect(managerIds).toContain(AGENT_IDS.OUTREACH_MANAGER);
      expect(managerIds).toContain(AGENT_IDS.CONTENT_MANAGER);
      expect(managerIds).toContain(AGENT_IDS.ARCHITECT_MANAGER);
      expect(managerIds).toContain(AGENT_IDS.REVENUE_DIRECTOR);
      expect(managerIds).toContain(AGENT_IDS.REPUTATION_MANAGER);
    });

    test('briefing metrics have reasonable defaults', async () => {
      const jasper = getJasperCommandAuthority();
      const briefing = await jasper.generateExecutiveBriefing();

      expect(briefing.metrics).toBeDefined();
      expect(typeof briefing.metrics.totalOperationalCycles).toBe('number');
      expect(typeof briefing.metrics.totalActionsExecuted).toBe('number');
      expect(typeof briefing.metrics.successRate).toBe('number');
      expect(typeof briefing.metrics.inboundRepliesProcessed).toBe('number');
      expect(typeof briefing.metrics.leadsAdvanced).toBe('number');
      expect(typeof briefing.metrics.contentProduced).toBe('number');
      expect(typeof briefing.metrics.reviewsResponded).toBe('number');

      // Success rate should be between 0 and 100
      expect(briefing.metrics.successRate).toBeGreaterThanOrEqual(0);
      expect(briefing.metrics.successRate).toBeLessThanOrEqual(100);

      // All counts should be non-negative
      expect(briefing.metrics.totalOperationalCycles).toBeGreaterThanOrEqual(0);
      expect(briefing.metrics.totalActionsExecuted).toBeGreaterThanOrEqual(0);
      expect(briefing.metrics.inboundRepliesProcessed).toBeGreaterThanOrEqual(0);
      expect(briefing.metrics.leadsAdvanced).toBeGreaterThanOrEqual(0);
      expect(briefing.metrics.contentProduced).toBeGreaterThanOrEqual(0);
      expect(briefing.metrics.reviewsResponded).toBeGreaterThanOrEqual(0);
    });
  });

  describe('8b: Approval Gateway', () => {
    test('queueForApproval creates PendingApproval with status PENDING', () => {
      const jasper = getJasperCommandAuthority();

      const approvalId = jasper.queueForApproval({
        requestedBy: AGENT_IDS.OUTREACH_MANAGER,
        type: 'LARGE_CAMPAIGN',
        description: 'Send email to 500 leads',
        urgency: 'HIGH',
        context: { recipientCount: 500 },
      });

      expect(approvalId).toBeDefined();
      expect(approvalId).toMatch(/^appr_\d+_[a-z0-9]+$/);

      // Verify it was added to pending approvals
      const pendingApprovals = jasper.getPendingApprovals();
      expect(pendingApprovals).toHaveLength(1);
      expect(pendingApprovals[0].approvalId).toBe(approvalId);
      expect(pendingApprovals[0].requestedBy).toBe(AGENT_IDS.OUTREACH_MANAGER);
      expect(pendingApprovals[0].type).toBe('LARGE_CAMPAIGN');
      expect(pendingApprovals[0].status).toBe('PENDING');
    });

    test('processApproval with APPROVED updates status correctly', async () => {
      const jasper = getJasperCommandAuthority();

      const approvalId = jasper.queueForApproval({
        requestedBy: AGENT_IDS.CONTENT_MANAGER,
        type: 'LOW_CONFIDENCE_ACTION',
        description: 'Publish blog post',
        urgency: 'NORMAL',
        context: { confidence: 0.65 },
      });

      const result = await jasper.processApproval(approvalId, 'APPROVED', 'Decision approved by owner');

      expect(result.commandId).toBe(approvalId);
      expect(result.status).toBe('EXECUTED');
      expect(result.response).toBeDefined();
      expect(result.response?.decision).toBe('APPROVED');

      // Verify it was removed from pending approvals
      const pendingApprovals = jasper.getPendingApprovals();
      expect(pendingApprovals.find(a => a.approvalId === approvalId)).toBeUndefined();
    });

    test('processApproval with REJECTED updates status correctly', async () => {
      const jasper = getJasperCommandAuthority();

      const approvalId = jasper.queueForApproval({
        requestedBy: AGENT_IDS.COMMERCE_MANAGER,
        type: 'PRICING_CHANGE',
        description: 'Reduce product price by 50%',
        urgency: 'CRITICAL',
        context: { oldPrice: 100, newPrice: 50 },
      });

      const result = await jasper.processApproval(approvalId, 'REJECTED', 'Price reduction too steep');

      expect(result.commandId).toBe(approvalId);
      expect(result.status).toBe('EXECUTED');
      expect(result.response).toBeDefined();
      expect(result.response?.decision).toBe('REJECTED');
      expect(result.response?.reason).toBe('Price reduction too steep');

      // Verify it was removed from pending approvals
      const pendingApprovals = jasper.getPendingApprovals();
      expect(pendingApprovals.find(a => a.approvalId === approvalId)).toBeUndefined();
    });

    test('processApproval for nonexistent ID returns FAILED status', async () => {
      const jasper = getJasperCommandAuthority();

      const result = await jasper.processApproval('nonexistent-approval', 'APPROVED', 'Reason');

      expect(result.commandId).toBe('nonexistent-approval');
      expect(result.status).toBe('FAILED');
      expect(result.error).toBe('Approval not found');
    });

    test('getPendingApprovals returns only PENDING status items', async () => {
      const jasper = getJasperCommandAuthority();

      // Create multiple approvals
      const approval1 = jasper.queueForApproval({
        requestedBy: AGENT_IDS.OUTREACH_MANAGER,
        type: 'LARGE_CAMPAIGN',
        description: 'Campaign 1',
        urgency: 'HIGH',
        context: {},
      });

      jasper.queueForApproval({
        requestedBy: AGENT_IDS.CONTENT_MANAGER,
        type: 'REVIEW_RESPONSE',
        description: 'Response 1',
        urgency: 'NORMAL',
        context: {},
      });

      const approval3 = jasper.queueForApproval({
        requestedBy: AGENT_IDS.MARKETING_MANAGER,
        type: 'ESCALATION',
        description: 'Escalation 1',
        urgency: 'CRITICAL',
        context: {},
      });

      // Approve one, reject another
      await jasper.processApproval(approval1, 'APPROVED', 'jasper-owner');
      await jasper.processApproval(approval3, 'REJECTED', 'jasper-owner');

      const pendingApprovals = jasper.getPendingApprovals();

      // Only the middle one should remain pending
      expect(pendingApprovals).toHaveLength(1);
      expect(pendingApprovals[0].status).toBe('PENDING');
      expect(pendingApprovals[0].description).toBe('Response 1');
    });

    test('shouldRequireApproval: LOW_CONFIDENCE_ACTION when confidence < 80', () => {
      const jasper = getJasperCommandAuthority();

      const requiresApproval = jasper.shouldRequireApproval({
        type: 'CONTENT_GENERATION',
        confidence: 65,
      });

      expect(requiresApproval).toBe(true);
    });

    test('shouldRequireApproval: LARGE_CAMPAIGN when recipientCount > 100', () => {
      const jasper = getJasperCommandAuthority();

      const requiresApproval = jasper.shouldRequireApproval({
        type: 'EMAIL_CAMPAIGN',
        confidence: 90,
        recipientCount: 250,
      });

      expect(requiresApproval).toBe(true);
    });

    test('shouldRequireApproval: PRICING_CHANGE type always requires approval', () => {
      const jasper = getJasperCommandAuthority();

      const requiresApproval = jasper.shouldRequireApproval({
        type: 'pricing_change',
        confidence: 100,
      });

      expect(requiresApproval).toBe(true);
    });

    test('shouldRequireApproval: high amount (>1000) requires approval', () => {
      const jasper = getJasperCommandAuthority();

      const requiresApproval = jasper.shouldRequireApproval({
        type: 'PURCHASE',
        confidence: 90,
        amount: 2500,
      });

      expect(requiresApproval).toBe(true);
    });

    test('shouldRequireApproval: normal action with high confidence does NOT require approval', () => {
      const jasper = getJasperCommandAuthority();

      const requiresApproval = jasper.shouldRequireApproval({
        type: 'ROUTINE_ACTION',
        confidence: 95,
        recipientCount: 10,
        amount: 50,
      });

      expect(requiresApproval).toBe(false);
    });
  });

  describe('8c: Command Authority', () => {
    test('issueCommand returns CommandResult with status QUEUED', async () => {
      const jasper = getJasperCommandAuthority();

      const result = await jasper.issueCommand(
        AGENT_IDS.MARKETING_MANAGER,
        'INCREASE_CAMPAIGN_FREQUENCY',
        { frequency: 'daily' },
        'HIGH'
      );

      expect(result).toBeDefined();
      expect(result.commandId).toMatch(/^cmd_\d+_[a-z0-9]+$/);
      expect(result.status).toBe('QUEUED');
      expect(result.error).toBeUndefined();
    });

    test('issueCommand executes command and tracks in history', async () => {
      const jasper = getJasperCommandAuthority();

      const result = await jasper.issueCommand(
        AGENT_IDS.OUTREACH_MANAGER,
        'PAUSE_OUTREACH',
        { reason: 'maintenance' },
        'CRITICAL'
      );

      // Verify command result
      expect(result).toBeDefined();
      expect(result.commandId).toMatch(/^cmd_\d+_[a-z0-9]+$/);
      expect(result.status).toBe('QUEUED');

      // Verify command appears in history
      const history = jasper.getCommandHistory(10);
      expect(history.some(cmd => cmd.commandId === result.commandId)).toBe(true);
      expect(history.some(cmd => cmd.command === 'PAUSE_OUTREACH')).toBe(true);
    });

    test('overrideAutonomousDecision creates override command', async () => {
      const jasper = getJasperCommandAuthority();

      const result = await jasper.overrideAutonomousDecision(
        AGENT_IDS.COMMERCE_MANAGER,
        'pricing_error',
        { correctPrice: 99.99 }
      );

      // Verify command was created
      expect(result.status).toBe('QUEUED');
      expect(result.commandId).toMatch(/^cmd_\d+_[a-z0-9]+$/);

      // Verify it's in command history with override command
      const history = jasper.getCommandHistory(10);
      expect(history.some(cmd => cmd.command === 'OVERRIDE_DECISION')).toBe(true);
      expect(history.some(cmd => cmd.targetManager === AGENT_IDS.COMMERCE_MANAGER)).toBe(true);
    });

    test('setObjective creates objective command for manager', async () => {
      const jasper = getJasperCommandAuthority();

      const result = await jasper.setObjective(
        AGENT_IDS.REVENUE_DIRECTOR,
        'Increase MRR by 20%',
        'Q1 2026',
        'MRR: $60k'
      );

      // Verify command was created
      expect(result.status).toBe('QUEUED');
      expect(result.commandId).toMatch(/^cmd_\d+_[a-z0-9]+$/);

      // Verify it's in command history with objective command
      const history = jasper.getCommandHistory(10);
      expect(history.some(cmd => cmd.command === 'SET_OBJECTIVE')).toBe(true);
      expect(history.some(cmd => cmd.targetManager === AGENT_IDS.REVENUE_DIRECTOR)).toBe(true);
    });

    test('getCommandHistory tracks issued commands', async () => {
      const jasper = getJasperCommandAuthority();

      // Issue multiple commands
      await jasper.issueCommand(
        AGENT_IDS.INTELLIGENCE_MANAGER,
        'ANALYZE_MARKET',
        { focus: 'competitors' },
        'NORMAL'
      );

      await jasper.issueCommand(
        AGENT_IDS.BUILDER_MANAGER,
        'BUILD_LANDING_PAGE',
        { template: 'saas' },
        'HIGH'
      );

      const history = jasper.getCommandHistory();

      expect(history).toHaveLength(2);
      expect(history[0].targetManager).toBe(AGENT_IDS.INTELLIGENCE_MANAGER);
      expect(history[0].command).toBe('ANALYZE_MARKET');
      expect(history[0].priority).toBe('NORMAL');
      expect(history[1].targetManager).toBe(AGENT_IDS.BUILDER_MANAGER);
      expect(history[1].command).toBe('BUILD_LANDING_PAGE');
      expect(history[1].priority).toBe('HIGH');
    });

    test('getCommandHistory respects limit parameter', async () => {
      const jasper = getJasperCommandAuthority();

      // Issue 5 commands
      for (let i = 0; i < 5; i++) {
        await jasper.issueCommand(
          AGENT_IDS.CONTENT_MANAGER,
          `COMMAND_${i}`,
          { index: i },
          'NORMAL'
        );
      }

      const limitedHistory = jasper.getCommandHistory(3);

      expect(limitedHistory).toHaveLength(3);
      // Should return last 3 commands (getCommandHistory returns slice(-limit))
      expect(limitedHistory[0].command).toBe('COMMAND_2');
      expect(limitedHistory[1].command).toBe('COMMAND_3');
      expect(limitedHistory[2].command).toBe('COMMAND_4');
    });
  });
});
