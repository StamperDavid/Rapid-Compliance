/**
 * Analytics Engine Unit Tests
 * 
 * Comprehensive tests for the analytics dashboard engine
 */

import { getDashboardAnalytics, clearAnalyticsCache } from '@/lib/analytics/dashboard/analytics-engine';
import { adminDal } from '@/lib/firebase/admin-dal';
import type { Workflow, WorkflowExecution } from '@/lib/workflow/types';

// Mock admin DAL
jest.mock('@/lib/firebase/admin-dal', () => ({
  adminDal: {
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
  },
}));

describe('Analytics Engine', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    clearAnalyticsCache();
  });

  describe('getDashboardAnalytics', () => {
    it('should return complete dashboard analytics', async () => {
      // Setup mocks
      const mockWorkflows: Workflow[] = [
        {
          id: 'wf1',
          name: 'Test Workflow 1',
          status: 'active',
          trigger: { type: 'deal.score.changed', conditions: [] },
          actions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Workflow,
        {
          id: 'wf2',
          name: 'Test Workflow 2',
          status: 'active',
          trigger: { type: 'deal.tier.changed', conditions: [] },
          actions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Workflow,
      ];

      const mockExecutions: WorkflowExecution[] = [
        {
          id: 'ex1',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date('2024-01-15'),
          completedAt: new Date('2024-01-15'),
          actionResults: [
            { actionType: 'email', status: 'success', duration: 100 },
            { actionType: 'task', status: 'success', duration: 50 },
          ],
        } as WorkflowExecution,
        {
          id: 'ex2',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date('2024-01-16'),
          completedAt: new Date('2024-01-16'),
          actionResults: [
            { actionType: 'email', status: 'success', duration: 120 },
          ],
        } as WorkflowExecution,
        {
          id: 'ex3',
          workflowId: 'wf2',
          status: 'failed',
          startedAt: new Date('2024-01-17'),
          completedAt: new Date('2024-01-17'),
          actionResults: [],
        } as WorkflowExecution,
      ];

      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue(mockWorkflows);
      (adminDal.getWorkflowExecutions as jest.Mock).mockResolvedValue(mockExecutions);
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);
      (adminDal.getRepDeals as jest.Mock).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', 'ws1', '30d');

      // Verify
      expect(result).toHaveProperty('workflows');
      expect(result).toHaveProperty('emails');
      expect(result).toHaveProperty('deals');
      expect(result).toHaveProperty('revenue');
      expect(result).toHaveProperty('team');
      expect(result.period).toBe('30d');
    });

    it('should calculate workflow metrics correctly', async () => {
      // Setup
      const mockWorkflows: Workflow[] = [
        {
          id: 'wf1',
          name: 'Active Workflow',
          status: 'active',
          trigger: { type: 'deal.score.changed', conditions: [] },
          actions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Workflow,
      ];

      const mockExecutions: WorkflowExecution[] = [
        {
          id: 'ex1',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date('2024-01-15T10:00:00'),
          completedAt: new Date('2024-01-15T10:00:05'),
          actionResults: [
            { actionType: 'email', status: 'success', duration: 100 },
          ],
        } as WorkflowExecution,
        {
          id: 'ex2',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date('2024-01-16T10:00:00'),
          completedAt: new Date('2024-01-16T10:00:03'),
          actionResults: [
            { actionType: 'task', status: 'success', duration: 50 },
          ],
        } as WorkflowExecution,
        {
          id: 'ex3',
          workflowId: 'wf1',
          status: 'failed',
          startedAt: new Date('2024-01-17T10:00:00'),
          completedAt: new Date('2024-01-17T10:00:02'),
          actionResults: [],
        } as WorkflowExecution,
      ];

      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue(mockWorkflows);
      (adminDal.getWorkflowExecutions as jest.Mock)
        .mockResolvedValueOnce(mockExecutions) // Current period
        .mockResolvedValueOnce([]); // Previous period
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', 'ws1', '30d');

      // Verify workflow metrics
      expect(result.workflows.totalActiveWorkflows).toBe(1);
      expect(result.workflows.totalExecutions).toBe(3);
      expect(result.workflows.successfulExecutions).toBe(2);
      expect(result.workflows.failedExecutions).toBe(1);
      expect(result.workflows.successRate).toBeCloseTo(66.67, 1);
      expect(result.workflows.totalActionsExecuted).toBe(2);
    });

    it('should calculate action breakdown correctly', async () => {
      // Setup
      const mockWorkflows: Workflow[] = [
        {
          id: 'wf1',
          name: 'Test Workflow',
          status: 'active',
          trigger: { type: 'deal.score.changed', conditions: [] },
          actions: [],
          createdAt: new Date(),
          updatedAt: new Date(),
        } as Workflow,
      ];

      const mockExecutions: WorkflowExecution[] = [
        {
          id: 'ex1',
          workflowId: 'wf1',
          status: 'completed',
          startedAt: new Date(),
          completedAt: new Date(),
          actionResults: [
            { actionType: 'email', status: 'success', duration: 100 },
            { actionType: 'email', status: 'success', duration: 120 },
            { actionType: 'task', status: 'success', duration: 50 },
          ],
        } as WorkflowExecution,
      ];

      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue(mockWorkflows);
      (adminDal.getWorkflowExecutions as jest.Mock)
        .mockResolvedValueOnce(mockExecutions)
        .mockResolvedValueOnce([]);
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', 'ws1', '30d');

      // Verify action breakdown
      expect(result.workflows.actionBreakdown).toHaveLength(2);
      
      const emailAction = result.workflows.actionBreakdown.find(a => a.actionType === 'email');
      expect(emailAction).toBeDefined();
      expect(emailAction?.count).toBe(2);
      expect(emailAction?.percentage).toBeCloseTo(66.67, 1);
      expect(emailAction?.averageTime).toBe(110);

      const taskAction = result.workflows.actionBreakdown.find(a => a.actionType === 'task');
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

      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue([]);
      (adminDal.getWorkflowExecutions as jest.Mock).mockResolvedValue([]);
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue(mockDeals);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue(mockClosedDeals);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', 'ws1', '30d');

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

      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue([]);
      (adminDal.getWorkflowExecutions as jest.Mock).mockResolvedValue([]);
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue(mockAllClosedDeals);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue(mockWonDeals);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({
        optimistic: 120000,
        realistic: 100000,
        pessimistic: 80000,
      });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', 'ws1', '30d');

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
      // Setup minimal mocks
      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue([]);
      (adminDal.getWorkflowExecutions as jest.Mock).mockResolvedValue([]);
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);

      // First call
      await getDashboardAnalytics('org1', 'ws1', '30d');
      expect(adminDal.getAllWorkflows).toHaveBeenCalledTimes(1);

      // Second call (should use cache)
      await getDashboardAnalytics('org1', 'ws1', '30d');
      expect(adminDal.getAllWorkflows).toHaveBeenCalledTimes(1); // Still 1 (cached)

      // Clear cache
      clearAnalyticsCache();

      // Third call (should fetch again)
      await getDashboardAnalytics('org1', 'ws1', '30d');
      expect(adminDal.getAllWorkflows).toHaveBeenCalledTimes(2);
    });

    it('should calculate trends correctly', async () => {
      // Setup
      const currentExecutions: WorkflowExecution[] = [
        { id: 'ex1', workflowId: 'wf1', status: 'completed', startedAt: new Date(), completedAt: new Date(), actionResults: [] } as WorkflowExecution,
        { id: 'ex2', workflowId: 'wf1', status: 'completed', startedAt: new Date(), completedAt: new Date(), actionResults: [] } as WorkflowExecution,
        { id: 'ex3', workflowId: 'wf1', status: 'completed', startedAt: new Date(), completedAt: new Date(), actionResults: [] } as WorkflowExecution,
      ];

      const previousExecutions: WorkflowExecution[] = [
        { id: 'ex0', workflowId: 'wf1', status: 'completed', startedAt: new Date(), completedAt: new Date(), actionResults: [] } as WorkflowExecution,
      ];

      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue([]);
      (adminDal.getWorkflowExecutions as jest.Mock)
        .mockResolvedValueOnce(currentExecutions) // Current period
        .mockResolvedValueOnce(previousExecutions); // Previous period
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', 'ws1', '30d');

      // Verify trend (200% increase: from 1 to 3)
      expect(result.workflows.executionsTrend).toBe(200);
    });

    it('should handle different time periods correctly', async () => {
      // Setup minimal mocks
      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue([]);
      (adminDal.getWorkflowExecutions as jest.Mock).mockResolvedValue([]);
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);

      // Test different periods
      const periods = ['24h', '7d', '30d', '90d', 'month', 'quarter', 'year'] as const;

      for (const period of periods) {
        const result = await getDashboardAnalytics('org1', 'ws1', period);
        expect(result.period).toBe(period);
        expect(result.startDate).toBeInstanceOf(Date);
        expect(result.endDate).toBeInstanceOf(Date);
        expect(result.startDate.getTime()).toBeLessThan(result.endDate.getTime());
      }
    });

    it('should generate time series data correctly', async () => {
      // Setup
      const mockExecutions: WorkflowExecution[] = [
        { id: 'ex1', workflowId: 'wf1', status: 'completed', startedAt: new Date('2024-01-15'), completedAt: new Date(), actionResults: [] } as WorkflowExecution,
        { id: 'ex2', workflowId: 'wf1', status: 'completed', startedAt: new Date('2024-01-15'), completedAt: new Date(), actionResults: [] } as WorkflowExecution,
        { id: 'ex3', workflowId: 'wf1', status: 'completed', startedAt: new Date('2024-01-16'), completedAt: new Date(), actionResults: [] } as WorkflowExecution,
      ];

      (adminDal.getAllWorkflows as jest.Mock).mockResolvedValue([]);
      (adminDal.getWorkflowExecutions as jest.Mock)
        .mockResolvedValueOnce(mockExecutions)
        .mockResolvedValueOnce([]);
      (adminDal.getEmailGenerations as jest.Mock).mockResolvedValue([]);
      (adminDal.getActiveDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getDealsSnapshot as jest.Mock).mockResolvedValue([]);
      (adminDal.getClosedDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getWonDeals as jest.Mock).mockResolvedValue([]);
      (adminDal.getRevenueForecast as jest.Mock).mockResolvedValue({ optimistic: 100000, realistic: 80000, pessimistic: 60000 });
      (adminDal.getSalesReps as jest.Mock).mockResolvedValue([]);

      // Execute
      const result = await getDashboardAnalytics('org1', 'ws1', '7d');

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
