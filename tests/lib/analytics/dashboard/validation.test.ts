/**
 * Analytics Dashboard Validation Tests
 * 
 * Tests for Zod validation schemas
 */

import {
  AnalyticsRequestSchema,
  TimePeriodSchema,
  DashboardOverviewSchema,
  WorkflowOverviewMetricsSchema,
  EmailOverviewMetricsSchema,
  DealOverviewMetricsSchema,
  RevenueOverviewMetricsSchema,
  TeamOverviewMetricsSchema,
} from '@/lib/analytics/dashboard/validation';
import { ZodError } from 'zod';

describe('Analytics Dashboard Validation', () => {
  describe('TimePeriodSchema', () => {
    it('should accept valid time periods', () => {
      const validPeriods = ['24h', '7d', '30d', '90d', 'month', 'quarter', 'year', 'custom'];
      
      validPeriods.forEach(period => {
        expect(() => TimePeriodSchema.parse(period)).not.toThrow();
      });
    });

    it('should reject invalid time periods', () => {
      expect(() => TimePeriodSchema.parse('invalid')).toThrow(ZodError);
      expect(() => TimePeriodSchema.parse('1week')).toThrow(ZodError);
      expect(() => TimePeriodSchema.parse(123)).toThrow(ZodError);
    });
  });

  describe('AnalyticsRequestSchema', () => {
    it('should accept valid request', () => {
      const validRequest = {
        organizationId: 'org123',
        workspaceId: 'ws456',
        period: '30d',
      };

      expect(() => AnalyticsRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should require organizationId', () => {
      const invalidRequest = {
        workspaceId: 'ws456',
        period: '30d',
      };

      expect(() => AnalyticsRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should require period', () => {
      const invalidRequest = {
        organizationId: 'org123',
        // Missing period
      };

      expect(() => AnalyticsRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should require startDate and endDate for custom period', () => {
      const invalidRequest = {
        organizationId: 'org123',
        workspaceId: 'ws456',
        period: 'custom',
      };

      expect(() => AnalyticsRequestSchema.parse(invalidRequest)).toThrow(ZodError);

      const validRequest = {
        organizationId: 'org123',
        workspaceId: 'ws456',
        period: 'custom',
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
      };

      expect(() => AnalyticsRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should validate that endDate is after startDate', () => {
      const invalidRequest = {
        organizationId: 'org123',
        workspaceId: 'ws456',
        period: 'custom',
        startDate: new Date('2024-01-31'),
        endDate: new Date('2024-01-01'),
      };

      expect(() => AnalyticsRequestSchema.parse(invalidRequest)).toThrow(ZodError);
    });

    it('should accept optional metrics array', () => {
      const validRequest = {
        organizationId: 'org123',
        workspaceId: 'ws456',
        period: '30d',
        metrics: ['workflows', 'emails'],
      };

      expect(() => AnalyticsRequestSchema.parse(validRequest)).not.toThrow();
    });

    it('should coerce date strings to Date objects', () => {
      const request = {
        organizationId: 'org123',
        workspaceId: 'ws456',
        period: 'custom',
        startDate: '2024-01-01',
        endDate: '2024-01-31',
      };

      const parsed = AnalyticsRequestSchema.parse(request);
      expect(parsed.startDate).toBeInstanceOf(Date);
      expect(parsed.endDate).toBeInstanceOf(Date);
    });
  });

  describe('WorkflowOverviewMetricsSchema', () => {
    it('should accept valid workflow metrics', () => {
      const validMetrics = {
        totalActiveWorkflows: 5,
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 5,
        successRate: 95.0,
        averageExecutionTime: 1500,
        totalActionsExecuted: 250,
        executionsTrend: 15.5,
        topWorkflows: [],
        executionsByDay: [],
        actionBreakdown: [],
      };

      expect(() => WorkflowOverviewMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it('should reject negative counts', () => {
      const invalidMetrics = {
        totalActiveWorkflows: -1,
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 5,
        successRate: 95.0,
        averageExecutionTime: 1500,
        totalActionsExecuted: 250,
        executionsTrend: 15.5,
        topWorkflows: [],
        executionsByDay: [],
        actionBreakdown: [],
      };

      expect(() => WorkflowOverviewMetricsSchema.parse(invalidMetrics)).toThrow(ZodError);
    });

    it('should validate success rate range (0-100)', () => {
      const invalidMetrics = {
        totalActiveWorkflows: 5,
        totalExecutions: 100,
        successfulExecutions: 95,
        failedExecutions: 5,
        successRate: 150.0,
        averageExecutionTime: 1500,
        totalActionsExecuted: 250,
        executionsTrend: 15.5,
        topWorkflows: [],
        executionsByDay: [],
        actionBreakdown: [],
      };

      expect(() => WorkflowOverviewMetricsSchema.parse(invalidMetrics)).toThrow(ZodError);
    });
  });

  describe('EmailOverviewMetricsSchema', () => {
    it('should accept valid email metrics', () => {
      const validMetrics = {
        totalGenerated: 50,
        totalSent: 45,
        averageGenerationTime: 1200,
        mostUsedType: 'intro',
        generationTrend: 10.5,
        byType: [],
        emailsByDay: [],
        byTier: [],
      };

      expect(() => EmailOverviewMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it('should reject negative counts', () => {
      const invalidMetrics = {
        totalGenerated: -10,
        totalSent: 45,
        averageGenerationTime: 1200,
        mostUsedType: 'intro',
        generationTrend: 10.5,
        byType: [],
        emailsByDay: [],
        byTier: [],
      };

      expect(() => EmailOverviewMetricsSchema.parse(invalidMetrics)).toThrow(ZodError);
    });
  });

  describe('DealOverviewMetricsSchema', () => {
    it('should accept valid deal metrics', () => {
      const validMetrics = {
        totalActiveDeals: 25,
        totalValue: 500000,
        averageValue: 20000,
        hotDeals: 8,
        atRiskDeals: 3,
        dealsTrend: 12.5,
        byStage: [],
        byTier: [],
        averageVelocity: 30,
        pipelineByDay: [],
      };

      expect(() => DealOverviewMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it('should reject negative values', () => {
      const invalidMetrics = {
        totalActiveDeals: 25,
        totalValue: -500000,
        averageValue: 20000,
        hotDeals: 8,
        atRiskDeals: 3,
        dealsTrend: 12.5,
        byStage: [],
        byTier: [],
        averageVelocity: 30,
        pipelineByDay: [],
      };

      expect(() => DealOverviewMetricsSchema.parse(invalidMetrics)).toThrow(ZodError);
    });
  });

  describe('RevenueOverviewMetricsSchema', () => {
    it('should accept valid revenue metrics', () => {
      const validMetrics = {
        totalRevenue: 100000,
        quota: 150000,
        quotaAttainment: 66.67,
        forecastOptimistic: 200000,
        forecastRealistic: 150000,
        forecastPessimistic: 100000,
        revenueTrend: 25.0,
        revenueByDay: [],
        winRate: 45.5,
        averageDealSize: 15000,
      };

      expect(() => RevenueOverviewMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it('should allow quota attainment over 100%', () => {
      const validMetrics = {
        totalRevenue: 200000,
        quota: 150000,
        quotaAttainment: 133.33,
        forecastOptimistic: 250000,
        forecastRealistic: 200000,
        forecastPessimistic: 150000,
        revenueTrend: 50.0,
        revenueByDay: [],
        winRate: 55.0,
        averageDealSize: 20000,
      };

      expect(() => RevenueOverviewMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it('should validate win rate range (0-100)', () => {
      const invalidMetrics = {
        totalRevenue: 100000,
        quota: 150000,
        quotaAttainment: 66.67,
        forecastOptimistic: 200000,
        forecastRealistic: 150000,
        forecastPessimistic: 100000,
        revenueTrend: 25.0,
        revenueByDay: [],
        winRate: 150.0,
        averageDealSize: 15000,
      };

      expect(() => RevenueOverviewMetricsSchema.parse(invalidMetrics)).toThrow(ZodError);
    });
  });

  describe('TeamOverviewMetricsSchema', () => {
    it('should accept valid team metrics', () => {
      const validMetrics = {
        totalReps: 10,
        topPerformers: [],
        averageDealsPerRep: 5.5,
        averageQuotaAttainment: 85.5,
        teamVelocity: 28.5,
      };

      expect(() => TeamOverviewMetricsSchema.parse(validMetrics)).not.toThrow();
    });

    it('should reject negative rep count', () => {
      const invalidMetrics = {
        totalReps: -5,
        topPerformers: [],
        averageDealsPerRep: 5.5,
        averageQuotaAttainment: 85.5,
        teamVelocity: 28.5,
      };

      expect(() => TeamOverviewMetricsSchema.parse(invalidMetrics)).toThrow(ZodError);
    });
  });

  describe('DashboardOverviewSchema', () => {
    it('should accept complete valid dashboard data', () => {
      const validDashboard = {
        period: '30d' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        workflows: {
          totalActiveWorkflows: 5,
          totalExecutions: 100,
          successfulExecutions: 95,
          failedExecutions: 5,
          successRate: 95.0,
          averageExecutionTime: 1500,
          totalActionsExecuted: 250,
          executionsTrend: 15.5,
          topWorkflows: [],
          executionsByDay: [],
          actionBreakdown: [],
        },
        emails: {
          totalGenerated: 50,
          totalSent: 45,
          averageGenerationTime: 1200,
          mostUsedType: 'intro',
          generationTrend: 10.5,
          byType: [],
          emailsByDay: [],
          byTier: [],
        },
        deals: {
          totalActiveDeals: 25,
          totalValue: 500000,
          averageValue: 20000,
          hotDeals: 8,
          atRiskDeals: 3,
          dealsTrend: 12.5,
          byStage: [],
          byTier: [],
          averageVelocity: 30,
          pipelineByDay: [],
        },
        revenue: {
          totalRevenue: 100000,
          quota: 150000,
          quotaAttainment: 66.67,
          forecastOptimistic: 200000,
          forecastRealistic: 150000,
          forecastPessimistic: 100000,
          revenueTrend: 25.0,
          revenueByDay: [],
          winRate: 45.5,
          averageDealSize: 15000,
        },
        team: {
          totalReps: 10,
          topPerformers: [],
          averageDealsPerRep: 5.5,
          averageQuotaAttainment: 85.5,
          teamVelocity: 28.5,
        },
      };

      expect(() => DashboardOverviewSchema.parse(validDashboard)).not.toThrow();
    });

    it('should require all sections', () => {
      const incompleteDashboard = {
        period: '30d' as const,
        startDate: new Date('2024-01-01'),
        endDate: new Date('2024-01-31'),
        workflows: {
          totalActiveWorkflows: 5,
          totalExecutions: 100,
          successfulExecutions: 95,
          failedExecutions: 5,
          successRate: 95.0,
          averageExecutionTime: 1500,
          totalActionsExecuted: 250,
          executionsTrend: 15.5,
          topWorkflows: [],
          executionsByDay: [],
          actionBreakdown: [],
        },
        // Missing emails, deals, revenue, team
      };

      expect(() => DashboardOverviewSchema.parse(incompleteDashboard)).toThrow(ZodError);
    });
  });
});
