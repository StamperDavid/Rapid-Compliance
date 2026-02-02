/**
 * Analytics Engine Unit Tests
 * 
 * Comprehensive tests for the analytics dashboard engine
 */

import { getDashboardAnalytics, clearAnalyticsCache } from '@/lib/analytics/dashboard/analytics-engine';
import { adminDal } from '@/lib/firebase/admin-dal';
import type { Workflow, WorkflowExecution } from '@/lib/workflow/types';

// Mock admin DAL
const mockAdminDal = {
  getAllWorkflows: jest.fn(),
  getWorkflowExecutions: jest.fn(),
  getEmailGenerations: jest.fn(),
  getActiveDeals: jest.fn(),
  getDealsSnapshot: jest.fn(),
  getClosedDeals: jest.fn(),
  getWonDeals: jest.fn(),
  getRevenueForecast: jest.fn(),
  getSalesReps: jest.fn(),
  getRepDeals: jest.fn(),
};

jest.mock('@/lib/firebase/admin-dal', () => ({
  adminDal: mockAdminDal,
}));

// Helper function to create a proper Workflow mock
function createMockWorkflow(overrides: Partial<Workflow> = {}): Workflow {
  const now = new Date();
  return {
    id: 'wf1',
    organizationId: 'org1',
    workspaceId: 'ws1',
    name: 'Test Workflow',
    description: 'Test workflow description',
    status: 'active',
    trigger: {
      id: 'trigger-1',
      type: 'deal.score.changed',
      conditions: [],
      conditionLogic: 'AND',
      name: 'Test Trigger',
      description: 'Test trigger description',
    },
    actions: [],
    settings: {},
    createdBy: 'user1',
    createdAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
    updatedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
    stats: {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTimeMs: 0,
    },
    ...overrides,
  };
}

// Helper function to create a proper WorkflowExecution mock
function createMockWorkflowExecution(overrides: Partial<WorkflowExecution> = {}): WorkflowExecution {
  const now = new Date();
  return {
    id: 'ex1',
    workflowId: 'wf1',
    organizationId: 'org1',
    workspaceId: 'ws1',
    triggeredBy: 'event',
    triggerData: {},
    status: 'completed',
    startedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
    actionsExecuted: [],
    ...overrides,
  };
}

describe('Analytics Engine', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    await clearAnalyticsCache();
  });

  describe('getDashboardAnalytics', () => {
    it('should return complete dashboard analytics', async () => {
      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      // Setup mocks
      const mockWorkflows: Workflow[] = [
        createMockWorkflow({ id: 'wf1', name: 'Test Workflow 1' }),
        createMockWorkflow({ id: 'wf2', name: 'Test Workflow 2', trigger: { id: 'trigger-2', type: 'deal.tier.changed', conditions: [], conditionLogic: 'AND', name: 'Tier Changed', description: 'Tier changed trigger' } }),
      ];

      const mockExecutions: WorkflowExecution[] = [
        createMockWorkflowExecution({
          id: 'ex1',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date('2024-01-15') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          completedAt: new Date('2024-01-15') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          actionsExecuted: [
            { actionId: 'a1', actionType: 'email.send', status: 'success', startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, durationMs: 100 },
            { actionId: 'a2', actionType: 'task.create', status: 'success', startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, durationMs: 50 },
          ],
        }),
        createMockWorkflowExecution({
          id: 'ex2',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date('2024-01-16') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          completedAt: new Date('2024-01-16') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          actionsExecuted: [
            { actionId: 'a3', actionType: 'email.send', status: 'success', startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, durationMs: 120 },
          ],
        }),
        createMockWorkflowExecution({
          id: 'ex3',
          workflowId: 'wf2',
          status: 'failed',
          startedAt: new Date('2024-01-17') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          completedAt: new Date('2024-01-17') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          actionsExecuted: [],
        }),
      ];

      (mockAdminDal.getAllWorkflows).mockResolvedValue(mockWorkflows);
      (mockAdminDal.getWorkflowExecutions).mockResolvedValue(mockExecutions);
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue([]);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue([]);
      (mockAdminDal.getWonDeals).mockResolvedValue([]);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);
      (mockAdminDal.getRepDeals).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', '30d');

      // Verify
      expect(result).toHaveProperty('workflows');
      expect(result).toHaveProperty('emails');
      expect(result).toHaveProperty('deals');
      expect(result).toHaveProperty('revenue');
      expect(result).toHaveProperty('team');
      expect(result.period).toBe('30d');
    });

    it('should calculate workflow metrics correctly', async () => {
      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      // Setup
      const mockWorkflows: Workflow[] = [
        createMockWorkflow({ id: 'wf1', name: 'Active Workflow' }),
      ];

      const mockExecutions: WorkflowExecution[] = [
        createMockWorkflowExecution({
          id: 'ex1',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date('2024-01-15T10:00:00') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          completedAt: new Date('2024-01-15T10:00:05') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          actionsExecuted: [
            { actionId: 'a1', actionType: 'email.send', status: 'success', startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, durationMs: 100 },
          ],
        }),
        createMockWorkflowExecution({
          id: 'ex2',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date('2024-01-16T10:00:00') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          completedAt: new Date('2024-01-16T10:00:03') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          actionsExecuted: [
            { actionId: 'a2', actionType: 'task.create', status: 'success', startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, durationMs: 50 },
          ],
        }),
        createMockWorkflowExecution({
          id: 'ex3',
          workflowId: 'wf1',
          status: 'failed',
          startedAt: new Date('2024-01-17T10:00:00') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          completedAt: new Date('2024-01-17T10:00:02') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          actionsExecuted: [],
        }),
      ];

      (mockAdminDal.getAllWorkflows).mockResolvedValue(mockWorkflows);
      (mockAdminDal.getWorkflowExecutions)
        .mockResolvedValueOnce(mockExecutions) // Current period
        .mockResolvedValueOnce([]); // Previous period
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue([]);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue([]);
      (mockAdminDal.getWonDeals).mockResolvedValue([]);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', '30d');

      // Verify workflow metrics
      expect(result.workflows.totalActiveWorkflows).toBe(1);
      expect(result.workflows.totalExecutions).toBe(3);
      expect(result.workflows.successfulExecutions).toBe(2);
      expect(result.workflows.failedExecutions).toBe(1);
      expect(result.workflows.successRate).toBeCloseTo(66.67, 1);
      expect(result.workflows.totalActionsExecuted).toBe(2);
    });

    it('should calculate action breakdown correctly', async () => {
      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      // Setup
      const mockWorkflows: Workflow[] = [
        createMockWorkflow({ id: 'wf1', name: 'Test Workflow' }),
      ];

      const mockExecutions: WorkflowExecution[] = [
        createMockWorkflowExecution({
          id: 'ex1',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          completedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number },
          actionsExecuted: [
            { actionId: 'a1', actionType: 'email.send', status: 'success', startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, durationMs: 100 },
            { actionId: 'a2', actionType: 'email.send', status: 'success', startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, durationMs: 120 },
            { actionId: 'a3', actionType: 'task.create', status: 'success', startedAt: new Date() as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, durationMs: 50 },
          ],
        }),
      ];

      (mockAdminDal.getAllWorkflows).mockResolvedValue(mockWorkflows);
      (mockAdminDal.getWorkflowExecutions)
        .mockResolvedValueOnce(mockExecutions)
        .mockResolvedValueOnce([]);
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue([]);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue([]);
      (mockAdminDal.getWonDeals).mockResolvedValue([]);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', '30d');

      // Verify action breakdown
      expect(result.workflows.actionBreakdown).toHaveLength(2);
      
      const emailAction = result.workflows.actionBreakdown.find(a => a.actionType === 'email.send');
      expect(emailAction).toBeDefined();
      expect(emailAction?.count).toBe(2);
      expect(emailAction?.percentage).toBeCloseTo(66.67, 1);
      expect(emailAction?.averageTime).toBe(110);

      const taskAction = result.workflows.actionBreakdown.find(a => a.actionType === 'task.create');
      expect(taskAction).toBeDefined();
      expect(taskAction?.count).toBe(1);
      expect(taskAction?.percentage).toBeCloseTo(33.33, 1);
    });

    it('should calculate deal metrics correctly', async () => {
      // Setup
      const mockDeals = [
        { id: 'd1', status: 'active', value: 10000, tier: 'hot', stage: 'proposal', score: 85 },
        { id: 'd2', status: 'active', value: 15000, tier: 'warm', stage: 'negotiation', score: 70 },
        { id: 'd3', status: 'active', value: 8000, tier: 'at-risk', stage: 'discovery', score: 45 },
        { id: 'd4', status: 'active', value: 20000, tier: 'hot', stage: 'closing', score: 90 },
      ];

      const mockClosedDeals = [
        { id: 'c1', status: 'won', value: 12000, createdAt: new Date('2024-01-01'), closedAt: new Date('2024-01-30') },
      ];

      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      (mockAdminDal.getAllWorkflows).mockResolvedValue([]);
      (mockAdminDal.getWorkflowExecutions).mockResolvedValue([]);
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue(mockDeals);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue(mockClosedDeals);
      (mockAdminDal.getWonDeals).mockResolvedValue([]);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', '30d');

      // Verify deal metrics
      expect(result.deals.totalActiveDeals).toBe(4);
      expect(result.deals.totalValue).toBe(53000);
      expect(result.deals.averageValue).toBe(13250);
      expect(result.deals.hotDeals).toBe(2);
      expect(result.deals.atRiskDeals).toBe(1);
      expect(result.deals.averageVelocity).toBe(29); // 29 days
    });

    it('should calculate revenue metrics correctly', async () => {
      // Setup
      const mockWonDeals = [
        { id: 'w1', status: 'won', value: 10000, closedAt: new Date('2024-01-15') },
        { id: 'w2', status: 'won', value: 15000, closedAt: new Date('2024-01-20') },
        { id: 'w3', status: 'won', value: 8000, closedAt: new Date('2024-01-25') },
      ];

      const mockAllClosedDeals = [
        ...mockWonDeals,
        { id: 'l1', status: 'lost', value: 5000, closedAt: new Date('2024-01-18') },
        { id: 'l2', status: 'lost', value: 7000, closedAt: new Date('2024-01-22') },
      ];

      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      (mockAdminDal.getAllWorkflows).mockResolvedValue([]);
      (mockAdminDal.getWorkflowExecutions).mockResolvedValue([]);
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue([]);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue(mockAllClosedDeals);
      (mockAdminDal.getWonDeals).mockResolvedValue(mockWonDeals);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({
        optimistic: 120000,
        realistic: 100000,
        pessimistic: 80000,
      });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', '30d');

      // Verify revenue metrics
      expect(result.revenue.totalRevenue).toBe(33000);
      expect(result.revenue.quota).toBe(100000);
      expect(result.revenue.quotaAttainment).toBe(33);
      expect(result.revenue.forecastOptimistic).toBe(120000);
      expect(result.revenue.forecastRealistic).toBe(100000);
      expect(result.revenue.forecastPessimistic).toBe(80000);
      expect(result.revenue.winRate).toBe(60); // 3 won out of 5 total
      expect(result.revenue.averageDealSize).toBe(11000);
    });

    it('should cache results correctly', async () => {
      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      // Setup minimal mocks
      (mockAdminDal.getAllWorkflows).mockResolvedValue([]);
      (mockAdminDal.getWorkflowExecutions).mockResolvedValue([]);
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue([]);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue([]);
      (mockAdminDal.getWonDeals).mockResolvedValue([]);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);

      // First call
      await getDashboardAnalytics('org1', '30d');
      expect(mockAdminDal.getAllWorkflows).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      await getDashboardAnalytics('org1', '30d');
      expect(mockAdminDal.getAllWorkflows).toHaveBeenCalledTimes(1); // Still 1 (cached)

      // Clear cache
      await clearAnalyticsCache();

      // Third call (should fetch again)
      await getDashboardAnalytics('org1', '30d');
      expect(mockAdminDal.getAllWorkflows).toHaveBeenCalledTimes(2);
    });

    it('should calculate trends correctly', async () => {
      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      // Setup
      const now = new Date();
      const currentExecutions: WorkflowExecution[] = [
        createMockWorkflowExecution({ id: 'ex1', workflowId: 'wf1', status: 'completed', startedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, completedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, actionsExecuted: [] }),
        createMockWorkflowExecution({ id: 'ex2', workflowId: 'wf1', status: 'completed', startedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, completedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, actionsExecuted: [] }),
        createMockWorkflowExecution({ id: 'ex3', workflowId: 'wf1', status: 'completed', startedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, completedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, actionsExecuted: [] }),
      ];

      const previousExecutions: WorkflowExecution[] = [
        createMockWorkflowExecution({ id: 'ex0', workflowId: 'wf1', status: 'completed', startedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, completedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, actionsExecuted: [] }),
      ];

      (mockAdminDal.getAllWorkflows).mockResolvedValue([]);
      (mockAdminDal.getWorkflowExecutions)
        .mockResolvedValueOnce(currentExecutions) // Current period
        .mockResolvedValueOnce(previousExecutions); // Previous period
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue([]);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue([]);
      (mockAdminDal.getWonDeals).mockResolvedValue([]);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', '30d');

      // Verify trend (200% increase: from 1 to 3)
      expect(result.workflows.executionsTrend).toBe(200);
    });

    it('should handle different time periods correctly', async () => {
      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      // Setup minimal mocks
      (mockAdminDal.getAllWorkflows).mockResolvedValue([]);
      (mockAdminDal.getWorkflowExecutions).mockResolvedValue([]);
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue([]);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue([]);
      (mockAdminDal.getWonDeals).mockResolvedValue([]);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);

      // Test different periods
      const periods = ['24h', '7d', '30d', '90d', 'month', 'quarter', 'year'] as const;

      for (const period of periods) {
        const result = await getDashboardAnalytics('org1', period);
        expect(result.period).toBe(period);
        expect(result.startDate).toBeInstanceOf(Date);
        expect(result.endDate).toBeInstanceOf(Date);
        expect(result.startDate.getTime()).toBeLessThan(result.endDate.getTime());
      }
    });

    it('should generate time series data correctly', async () => {
      if (!adminDal) {
        throw new Error('adminDal is not initialized');
      }
      
      // Setup
      const now = new Date();
      const mockExecutions: WorkflowExecution[] = [
        createMockWorkflowExecution({ id: 'ex1', workflowId: 'wf1', status: 'completed', startedAt: new Date('2024-01-15') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, completedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, actionsExecuted: [] }),
        createMockWorkflowExecution({ id: 'ex2', workflowId: 'wf1', status: 'completed', startedAt: new Date('2024-01-15') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, completedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, actionsExecuted: [] }),
        createMockWorkflowExecution({ id: 'ex3', workflowId: 'wf1', status: 'completed', startedAt: new Date('2024-01-16') as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, completedAt: now as unknown as { toDate(): Date; toMillis(): number; seconds: number; nanoseconds: number }, actionsExecuted: [] }),
      ];

      (mockAdminDal.getAllWorkflows).mockResolvedValue([]);
      (mockAdminDal.getWorkflowExecutions)
        .mockResolvedValueOnce(mockExecutions)
        .mockResolvedValueOnce([]);
      (mockAdminDal.getEmailGenerations).mockResolvedValue([]);
      (mockAdminDal.getActiveDeals).mockResolvedValue([]);
      (mockAdminDal.getDealsSnapshot).mockResolvedValue([]);
      (mockAdminDal.getClosedDeals).mockResolvedValue([]);
      (mockAdminDal.getWonDeals).mockResolvedValue([]);
      (mockAdminDal.getRevenueForecast).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (mockAdminDal.getSalesReps).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', '7d');

      // Verify time series
      expect(result.workflows.executionsByDay).toBeInstanceOf(Array);
      expect(result.workflows.executionsByDay.length).toBeGreaterThan(0);
      
      // Check that dates are in order
      for (let i = 1; i < result.workflows.executionsByDay.length; i++) {
        const prev = result.workflows.executionsByDay[i - 1].date.getTime();
        const curr = result.workflows.executionsByDay[i].date.getTime();
        expect(curr).toBeGreaterThanOrEqual(prev);
      }
    });
  });
});
