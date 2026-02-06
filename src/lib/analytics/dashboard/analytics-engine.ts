/**
 * Advanced Analytics Engine
 * 
 * SOVEREIGN CORPORATE BRAIN - ANALYTICS MODULE
 * 
 * This service aggregates data from all platform features to provide
 * comprehensive analytics and insights.
 * 
 * FEATURES:
 * - Multi-source data aggregation (workflows, emails, deals, revenue)
 * - Intelligent caching (5-minute TTL for performance)
 * - Trend calculations (period-over-period comparisons)
 * - Time series generation
 * - Performance optimization
 * 
 * INTEGRATION:
 * - Workflow Engine for automation analytics
 * - Email Writer for email analytics
 * - Deal Scoring for pipeline insights
 * - Revenue Forecasting for revenue predictions
 * - DAL for environment-aware data access
 */

import type {
  DashboardOverview,
  TimePeriod,
  WorkflowOverviewMetrics,
  EmailOverviewMetrics,
  DealOverviewMetrics,
  RevenueOverviewMetrics,
  TeamOverviewMetrics,
  TimeSeriesDataPoint,
  WorkflowPerformanceSummary,
  ActionTypeMetrics,
  EmailTypeMetrics,
  TierDistribution,
  StageMetrics,
  TierMetrics,
  RepPerformanceSummary,
} from './types';

import { adminDal } from '@/lib/firebase/admin-dal';
import type { Workflow, WorkflowExecution } from '@/lib/workflow/types';
import { emitDashboardGenerated } from './events';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

// ============================================================================
// CACHE CONFIGURATION
// ============================================================================

/** Cache TTL in seconds (5 minutes) */
const CACHE_TTL = 300;

/** In-memory cache */
const analyticsCache = new Map<string, { data: DashboardOverview; timestamp: Date }>();

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Firestore Timestamp-like object */
interface FirestoreTimestamp {
  toDate: () => Date;
}

/**
 * Convert Firestore Timestamp or Date-like object to Date
 */
function toDate(value: Date | FirestoreTimestamp | string | number): Date {
  if (value instanceof Date) {
    return value;
  }
  if (value && typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    return value.toDate();
  }
  return new Date(value as string | number);
}

// ============================================================================
// MAIN ANALYTICS ENGINE
// ============================================================================

/**
 * Get comprehensive dashboard analytics
 *
 * @param period - Time period for analytics
 * @param startDate - Custom start date (for custom period)
 * @param endDate - Custom end date (for custom period)
 * @returns Dashboard overview with all metrics
 */
export async function getDashboardAnalytics(
  period: TimePeriod,
  startDate?: Date,
  endDate?: Date
): Promise<DashboardOverview> {
  const startTime = Date.now();

  // Check cache
  const cacheKey = `${DEFAULT_ORG_ID}:${period}:${startDate?.toISOString()}:${endDate?.toISOString()}`;
  const cached = analyticsCache.get(cacheKey);

  if (cached) {
    const age = Date.now() - cached.timestamp.getTime();
    if (age < CACHE_TTL * 1000) {
      // Emit event for cached response
      const generationTime = Date.now() - startTime;
      await emitDashboardGenerated(
        DEFAULT_ORG_ID,
        period,
        generationTime,
        true,
        cached.data
      );
      return cached.data;
    }
  }

  // Calculate date range
  const dateRange = calculateDateRange(period, startDate, endDate);
  const previousDateRange = calculatePreviousDateRange(dateRange.start, dateRange.end);

  // Aggregate data from all sources in parallel
  const [workflows, deals, revenue, team] = await Promise.all([
    getWorkflowMetrics(dateRange.start, dateRange.end, previousDateRange),
    getDealMetrics(dateRange.start, dateRange.end, previousDateRange),
    getRevenueMetrics(dateRange.start, dateRange.end, previousDateRange),
    getTeamMetrics(dateRange.start, dateRange.end),
  ]);

  // Get email metrics synchronously (no async DB calls)
  const emails = getEmailMetrics(dateRange.start, dateRange.end, previousDateRange);

  const dashboard: DashboardOverview = {
    period,
    startDate: dateRange.start,
    endDate: dateRange.end,
    workflows,
    emails,
    deals,
    revenue,
    team,
  };

  // Cache result
  analyticsCache.set(cacheKey, {
    data: dashboard,
    timestamp: new Date(),
  });

  // Emit event for new generation
  const generationTime = Date.now() - startTime;
  await emitDashboardGenerated(
    DEFAULT_ORG_ID,
    period,
    generationTime,
    false,
    dashboard
  );

  return dashboard;
}

// ============================================================================
// WORKFLOW ANALYTICS
// ============================================================================

/**
 * Get workflow analytics metrics
 */
async function getWorkflowMetrics(
  startDate: Date,
  endDate: Date,
  previousDateRange: { start: Date; end: Date }
): Promise<WorkflowOverviewMetrics> {
  if (!adminDal) {
    return {
      totalActiveWorkflows: 0,
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      successRate: 0,
      averageExecutionTime: 0,
      totalActionsExecuted: 0,
      executionsTrend: 0,
      topWorkflows: [],
      executionsByDay: [],
      actionBreakdown: [],
    };
  }

  // Get all workflows - cast from DAL's Record<string, unknown>[] to typed array
  const workflows = await adminDal.getAllWorkflows() as unknown as Workflow[];
  const activeWorkflows = workflows.filter((w) => w.status === 'active');

  // Get executions in current period - cast from DAL's Record<string, unknown>[] to typed array
  const executions = await adminDal.getWorkflowExecutions(
    startDate,
    endDate
  ) as unknown as WorkflowExecution[];

  // Get executions in previous period (for trend) - cast from DAL's Record<string, unknown>[] to typed array
  const previousExecutions = await adminDal.getWorkflowExecutions(
    previousDateRange.start,
    previousDateRange.end
  ) as unknown as WorkflowExecution[];
  
  // Calculate basic metrics
  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter((e) => e.status === 'completed').length;
  const failedExecutions = executions.filter((e) => e.status === 'failed').length;
  const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

  // Calculate average execution time
  const executionTimes = executions
    .filter((e) => e.completedAt && e.startedAt)
    .map((e) => {
      // Type guard ensures these are defined since we filtered above
      if (!e.startedAt || !e.completedAt) {
        return 0;
      }
      const start = toDate(e.startedAt);
      const end = toDate(e.completedAt);
      return end.getTime() - start.getTime();
    });

  const averageExecutionTime = executionTimes.length > 0
    ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
    : 0;

  // Calculate total actions
  const totalActionsExecuted = executions.reduce((sum, e) => {
    return sum + (e.actionsExecuted?.length ?? 0);
  }, 0);
  
  // Calculate trend
  const executionsTrend = previousExecutions.length > 0
    ? ((totalExecutions - previousExecutions.length) / previousExecutions.length) * 100
    : 0;
  
  // Get top workflows
  const topWorkflows = calculateTopWorkflows(workflows, executions);

  // Get executions by day
  const executionsByDay = generateTimeSeries(executions, startDate, endDate, () => 1);

  // Get action breakdown
  const actionBreakdown = calculateActionBreakdown(executions, totalActionsExecuted);
  
  return {
    totalActiveWorkflows: activeWorkflows.length,
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    successRate,
    averageExecutionTime,
    totalActionsExecuted,
    executionsTrend,
    topWorkflows,
    executionsByDay,
    actionBreakdown,
  };
}

/**
 * Calculate top performing workflows
 */
function calculateTopWorkflows(
  workflows: Workflow[],
  executions: WorkflowExecution[]
): WorkflowPerformanceSummary[] {
  const workflowMap = new Map<string, {
    workflow: Workflow;
    executions: WorkflowExecution[];
  }>();
  
  // Group executions by workflow
  executions.forEach((execution: WorkflowExecution) => {
    const foundWorkflow = workflows.find((w: Workflow) => w.id === execution.workflowId);
    if (!foundWorkflow) {
      return;
    }

    const existing = workflowMap.get(execution.workflowId) ?? {
      workflow: foundWorkflow,
      executions: [],
    };

    if (existing.workflow) {
      existing.executions.push(execution);
      workflowMap.set(execution.workflowId, existing);
    }
  });
  
  // Calculate metrics for each workflow
  const summaries: WorkflowPerformanceSummary[] = Array.from(workflowMap.entries())
    .map(([workflowId, data]) => {
      const successCount = data.executions.filter(e => e.status === 'completed').length;
      const successRate = data.executions.length > 0
        ? (successCount / data.executions.length) * 100
        : 0;
      
      const executionTimes = data.executions
        .filter(e => e.completedAt && e.startedAt)
        .map(e => {
          // Type guard ensures these are defined since we filtered above
          if (!e.startedAt || !e.completedAt) {
            return 0;
          }
          const start = toDate(e.startedAt);
          const end = toDate(e.completedAt);
          return end.getTime() - start.getTime();
        });
      
      const averageTime = executionTimes.length > 0
        ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
        : 0;
      
      // Estimate time saved (assume each execution saves 10 minutes)
      const timeSaved = (data.executions.length * 10) / 60; // hours
      
      return {
        workflowId,
        name: data.workflow.name,
        executions: data.executions.length,
        successRate,
        averageTime,
        timeSaved,
      };
    })
    .sort((a, b) => b.executions - a.executions)
    .slice(0, 5);
  
  return summaries;
}

/**
 * Calculate action type breakdown
 */
/** Action execution result structure */
interface ActionExecutionResult {
  actionType?: string;
  status?: string;
  duration?: number;
}

function calculateActionBreakdown(
  executions: WorkflowExecution[],
  totalActions: number
): ActionTypeMetrics[] {
  const actionMap = new Map<string, {
    count: number;
    success: number;
    times: number[];
  }>();

  executions.forEach((execution: WorkflowExecution) => {
    const results = (execution.actionsExecuted ?? []) as ActionExecutionResult[];
    results.forEach((result: ActionExecutionResult) => {
      const actionType = result.actionType ?? 'unknown';
      const existing = actionMap.get(actionType) ?? {
        count: 0,
        success: 0,
        times: [],
      };

      actionMap.set(actionType, {
        count: existing.count + 1,
        success: existing.success + (result.status === 'success' ? 1 : 0),
        times: [...existing.times, result.duration ?? 0],
      });
    });
  });
  
  return Array.from(actionMap.entries())
    .map(([actionType, data]) => ({
      actionType,
      count: data.count,
      successRate: data.count > 0 ? (data.success / data.count) * 100 : 0,
      averageTime: data.times.length > 0
        ? data.times.reduce((sum, t) => sum + t, 0) / data.times.length
        : 0,
      percentage: totalActions > 0 ? (data.count / totalActions) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// EMAIL ANALYTICS
// ============================================================================

/**
 * Get email analytics metrics
 */
function getEmailMetrics(
  startDate: Date,
  endDate: Date,
  previousDateRange: { start: Date; end: Date }
): EmailOverviewMetrics {
  if (!adminDal) {
    return {
      totalGenerated: 0,
      totalSent: 0,
      averageGenerationTime: 0,
      mostUsedType: 'sales',
      generationTrend: 0,
      byType: [],
      emailsByDay: [],
      byTier: [],
    };
  }

  // Get email generation events from Signal Bus or email writer logs
  const emails = adminDal.getEmailGenerations(
    startDate,
    endDate
  );

  const previousEmails = adminDal.getEmailGenerations(
    previousDateRange.start,
    previousDateRange.end
  );
  
  const totalGenerated = emails.length;
  interface EmailData {
    generationTime?: number;
    type?: string;
    sent?: boolean;
  }

  const totalSent = emails.filter((e: EmailData) => e.sent).length;
  
  // Calculate average generation time
  const generationTimes = emails
    .filter((e: EmailData) => e.generationTime)
    .map((e: EmailData) => e.generationTime as number);
  
  const averageGenerationTime = generationTimes.length > 0
    ? generationTimes.reduce((sum: number, t: number) => sum + t, 0) / generationTimes.length
    : 0;
  
  // Get most used type
  const typeCount = new Map<string, number>();
  emails.forEach((e: EmailData) => {
    const type = e.type ?? 'unknown';
    typeCount.set(type, (typeCount.get(type) ?? 0) + 1);
  });
  
  const mostUsedType = Array.from(typeCount.entries())
    .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'intro';
  
  // Calculate trend
  const generationTrend = previousEmails.length > 0
    ? ((totalGenerated - previousEmails.length) / previousEmails.length) * 100
    : 0;
  
  // Get emails by type
  const byType = calculateEmailsByType(emails, totalGenerated);
  
  // Get emails by day
  const emailsByDay = generateTimeSeries(emails, startDate, endDate, () => 1);
  
  // Get emails by tier
  const byTier = calculateEmailsByTier(emails, totalGenerated);
  
  return {
    totalGenerated,
    totalSent,
    averageGenerationTime,
    mostUsedType,
    generationTrend,
    byType,
    emailsByDay,
    byTier,
  };
}

/** Email record structure for analytics */
interface EmailRecord {
  type?: string;
  generationTime?: number;
  dealTier?: string;
}

/**
 * Calculate emails by type
 */
function calculateEmailsByType(emails: EmailRecord[], total: number): EmailTypeMetrics[] {
  const typeMap = new Map<string, { count: number; times: number[] }>();

  emails.forEach((email: EmailRecord) => {
    const type = email.type ?? 'unknown';
    const existing = typeMap.get(type) ?? { count: 0, times: [] };
    
    typeMap.set(type, {
      count: existing.count + 1,
      times: [...existing.times, email.generationTime ?? 0],
    });
  });
  
  return Array.from(typeMap.entries())
    .map(([type, data]) => ({
      type,
      count: data.count,
      percentage: total > 0 ? (data.count / total) * 100 : 0,
      averageTime: data.times.length > 0
        ? data.times.reduce((sum, t) => sum + t, 0) / data.times.length
        : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate emails by tier
 */
function calculateEmailsByTier(emails: EmailRecord[], total: number): TierDistribution[] {
  const tierMap = new Map<string, number>();

  emails.forEach((email: EmailRecord) => {
    const tier = email.dealTier ?? 'unknown';
    tierMap.set(tier, (tierMap.get(tier) ?? 0) + 1);
  });
  
  return Array.from(tierMap.entries())
    .map(([tier, count]) => ({
      tier,
      count,
      percentage: total > 0 ? (count / total) * 100 : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

// ============================================================================
// DEAL ANALYTICS
// ============================================================================

/**
 * Get deal analytics metrics
 */
async function getDealMetrics(
  startDate: Date,
  endDate: Date,
  previousDateRange: { start: Date; end: Date }
): Promise<DealOverviewMetrics> {
  if (!adminDal) {
    return {
      totalActiveDeals: 0,
      totalValue: 0,
      averageValue: 0,
      hotDeals: 0,
      atRiskDeals: 0,
      dealsTrend: 0,
      byStage: [],
      byTier: [],
      averageVelocity: 0,
      pipelineByDay: [],
    };
  }

  // Get all active deals
  const deals = await adminDal.getActiveDeals();
  const previousDeals = await adminDal.getDealsSnapshot(
    previousDateRange.end
  );
  
  const totalActiveDeals = deals.length;
  interface DealRecord {
    value?: number;
    tier?: string;
    stage?: string;
    timeInStage?: number;
    score?: number;
    createdAt?: Date | FirestoreTimestamp | string;
    closedAt?: Date | FirestoreTimestamp | string;
    status?: string;
  }

  const totalValue = deals.reduce((sum: number, d: DealRecord) => sum + (d.value ?? 0), 0);
  const averageValue = totalActiveDeals > 0 ? totalValue / totalActiveDeals : 0;

  // Count hot and at-risk deals
  const hotDeals = deals.filter((d: DealRecord) => d.tier === 'hot').length;
  const atRiskDeals = deals.filter((d: DealRecord) => d.tier === 'at-risk').length;
  
  // Calculate trend
  const dealsTrend = previousDeals.length > 0
    ? ((totalActiveDeals - previousDeals.length) / previousDeals.length) * 100
    : 0;
  
  // Get deals by stage
  const byStage = calculateDealsByStage(deals);
  
  // Get deals by tier
  const byTier = calculateDealsByTier(deals);
  
  // Calculate average velocity
  const closedDeals = await adminDal.getClosedDeals(
    startDate,
    endDate
  );
  const averageVelocity = calculateAverageVelocity(closedDeals);

  // Get pipeline by day
  const pipelineByDay = generateDealPipelineTimeSeries(
    startDate,
    endDate
  );
  
  return {
    totalActiveDeals,
    totalValue,
    averageValue,
    hotDeals,
    atRiskDeals,
    dealsTrend,
    byStage,
    byTier,
    averageVelocity,
    pipelineByDay,
  };
}

/** Deal record for stage/tier calculations */
interface DealAnalyticsRecord {
  stage?: string;
  tier?: string;
  value?: number;
  timeInStage?: number;
  score?: number;
  createdAt?: Date | FirestoreTimestamp | string;
  closedAt?: Date | FirestoreTimestamp | string;
}

/**
 * Calculate deals by stage
 */
function calculateDealsByStage(deals: DealAnalyticsRecord[]): StageMetrics[] {
  const stageMap = new Map<string, {
    count: number;
    value: number;
    times: number[];
  }>();

  deals.forEach((deal: DealAnalyticsRecord) => {
    const stage = deal.stage ?? 'unknown';
    const existing = stageMap.get(stage) ?? { count: 0, value: 0, times: [] };
    
    stageMap.set(stage, {
      count: existing.count + 1,
      value: existing.value + (deal.value ?? 0),
      times: [...existing.times, deal.timeInStage ?? 0],
    });
  });
  
  const total = deals.length;
  
  return Array.from(stageMap.entries())
    .map(([stage, data]) => ({
      stage,
      count: data.count,
      value: data.value,
      percentage: total > 0 ? (data.count / total) * 100 : 0,
      averageTimeInStage: data.times.length > 0
        ? data.times.reduce((sum, t) => sum + t, 0) / data.times.length
        : 0,
    }))
    .sort((a, b) => b.count - a.count);
}

/**
 * Calculate deals by tier
 */
function calculateDealsByTier(deals: DealAnalyticsRecord[]): TierMetrics[] {
  const tierMap = new Map<string, {
    count: number;
    value: number;
    scores: number[];
  }>();

  deals.forEach((deal: DealAnalyticsRecord) => {
    const tier = deal.tier ?? 'unknown';
    const existing = tierMap.get(tier) ?? { count: 0, value: 0, scores: [] };
    
    tierMap.set(tier, {
      count: existing.count + 1,
      value: existing.value + (deal.value ?? 0),
      scores: [...existing.scores, deal.score ?? 0],
    });
  });
  
  const total = deals.length;
  
  return Array.from(tierMap.entries())
    .map(([tier, data]) => ({
      tier,
      count: data.count,
      value: data.value,
      percentage: total > 0 ? (data.count / total) * 100 : 0,
      averageScore: data.scores.length > 0
        ? data.scores.reduce((sum, s) => sum + s, 0) / data.scores.length
        : 0,
    }))
    .sort((a, b) => {
      const tierOrder: Record<string, number> = { hot: 0, warm: 1, cold: 2, 'at-risk': 3 };
      return (tierOrder[a.tier] || 99) - (tierOrder[b.tier] || 99);
    });
}

/**
 * Calculate average deal velocity (days to close)
 */
function calculateAverageVelocity(closedDeals: DealAnalyticsRecord[]): number {
  const velocities = closedDeals
    .filter((d) => d.createdAt && d.closedAt)
    .map((d) => {
      // Type guard ensures these are defined since we filtered above
      if (!d.createdAt || !d.closedAt) {
        return 0;
      }
      const created = toDate(d.createdAt);
      const closed = toDate(d.closedAt);
      const days = (closed.getTime() - created.getTime()) / (1000 * 60 * 60 * 24);
      return days;
    });

  return velocities.length > 0
    ? velocities.reduce((sum, v) => sum + v, 0) / velocities.length
    : 0;
}

/**
 * Generate deal pipeline time series
 */
function generateDealPipelineTimeSeries(
  _startDate: Date,
  _endDate: Date
): TimeSeriesDataPoint[] {
  // For now, return empty array - would need historical snapshots
  // This could be enhanced with deal history tracking
  return [];
}

// ============================================================================
// REVENUE ANALYTICS
// ============================================================================

/**
 * Get revenue analytics metrics
 */
async function getRevenueMetrics(
  startDate: Date,
  endDate: Date,
  previousDateRange: { start: Date; end: Date }
): Promise<RevenueOverviewMetrics> {
  if (!adminDal) {
    return {
      totalRevenue: 0,
      quota: 0,
      quotaAttainment: 0,
      forecastOptimistic: 0,
      forecastRealistic: 0,
      forecastPessimistic: 0,
      revenueTrend: 0,
      revenueByDay: [],
      winRate: 0,
      averageDealSize: 0,
    };
  }

  // Get closed/won deals in period
  const wonDeals = await adminDal.getWonDeals(
    startDate,
    endDate
  );

  const previousWonDeals = await adminDal.getWonDeals(
    previousDateRange.start,
    previousDateRange.end
  );
  
  const totalRevenue = wonDeals.reduce((sum: number, d: DealAnalyticsRecord) => sum + (d.value ?? 0), 0);
  const previousRevenue = previousWonDeals.reduce((sum: number, d: DealAnalyticsRecord) => sum + (d.value ?? 0), 0);
  
  // Get quota (would come from workspace settings)
  const quota = 100000; // TODO: Get from workspace settings
  const quotaAttainment = quota > 0 ? (totalRevenue / quota) * 100 : 0;
  
  // Get revenue forecast from forecasting engine
  const forecast = await adminDal.getRevenueForecast();
  
  // Calculate trend
  const revenueTrend = previousRevenue > 0
    ? ((totalRevenue - previousRevenue) / previousRevenue) * 100
    : 0;
  
  // Get revenue by day
  const revenueByDay = generateTimeSeries(
    wonDeals,
    startDate,
    endDate,
    (d: DealAnalyticsRecord) => d.value ?? 0
  );
  
  // Calculate win rate
  const allDeals = await adminDal.getClosedDeals(startDate, endDate);
  const winRate = allDeals.length > 0
    ? (wonDeals.length / allDeals.length) * 100
    : 0;
  
  // Calculate average deal size
  const averageDealSize = wonDeals.length > 0
    ? totalRevenue / wonDeals.length
    : 0;
  
  // Safely extract forecast values - forecast might be empty object or have different structure
  const forecastData = forecast as { optimistic?: number; realistic?: number; pessimistic?: number } | null;

  return {
    totalRevenue,
    quota,
    quotaAttainment,
    forecastOptimistic: forecastData?.optimistic ?? 0,
    forecastRealistic: forecastData?.realistic ?? 0,
    forecastPessimistic: forecastData?.pessimistic ?? 0,
    revenueTrend,
    revenueByDay,
    winRate,
    averageDealSize,
  };
}

// ============================================================================
// TEAM ANALYTICS
// ============================================================================

/**
 * Get team analytics metrics
 */
async function getTeamMetrics(
  startDate: Date,
  endDate: Date
): Promise<TeamOverviewMetrics> {
  if (!adminDal) {
    return {
      totalReps: 0,
      topPerformers: [],
      averageDealsPerRep: 0,
      averageQuotaAttainment: 0,
      teamVelocity: 0,
    };
  }

  const dal = adminDal; // Type narrowing for callbacks

  /** Sales rep record */
  interface RepRecord {
    id: string;
    name?: string;
    email?: string;
    quota?: number;
  }

  // Get all reps (users with role 'sales') - cast from DAL's Record<string, unknown>[] to typed array
  const reps = await dal.getSalesReps() as unknown as RepRecord[];

  // Get deals for each rep
  const repDeals = await Promise.all(
    reps.map((rep) =>
      dal.getRepDeals(rep.id, startDate, endDate)
    )
  ) as unknown as DealAnalyticsRecord[][];

  // Calculate rep performance
  const repPerformance: RepPerformanceSummary[] = reps.map((rep, index) => {
    const deals = repDeals[index] ?? [];
    type DealWithStatus = DealAnalyticsRecord & { status?: string };
    const wonDeals = (deals as DealWithStatus[]).filter((d) => d.status === 'won');
    const revenue = wonDeals.reduce((sum, d) => sum + (d.value ?? 0), 0);
    const quota = rep.quota ?? 100000;

    return {
      repId: rep.id,
      repName: rep.name ?? rep.email ?? 'Unknown',
      deals: deals.length,
      revenue,
      quotaAttainment: quota > 0 ? (revenue / quota) * 100 : 0,
      winRate: deals.length > 0 ? (wonDeals.length / deals.length) * 100 : 0,
      averageDealSize: wonDeals.length > 0 ? revenue / wonDeals.length : 0,
    };
  });
  
  // Get top performers
  const topPerformers = repPerformance
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, 5);
  
  // Calculate averages
  const totalDeals = repPerformance.reduce((sum, r) => sum + r.deals, 0);
  const averageDealsPerRep = reps.length > 0 ? totalDeals / reps.length : 0;
  
  const totalQuotaAttainment = repPerformance.reduce((sum, r) => sum + r.quotaAttainment, 0);
  const averageQuotaAttainment = reps.length > 0 ? totalQuotaAttainment / reps.length : 0;
  
  // Calculate team velocity
  const allRepDeals = repDeals.flat();
  const teamVelocity = calculateAverageVelocity(allRepDeals);
  
  return {
    totalReps: reps.length,
    topPerformers,
    averageDealsPerRep,
    averageQuotaAttainment,
    teamVelocity,
  };
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Calculate date range based on period
 */
function calculateDateRange(
  period: TimePeriod,
  customStart?: Date,
  customEnd?: Date
): { start: Date; end: Date } {
  const now = new Date();
  const end = customEnd ?? now;
  let start: Date;
  
  switch (period) {
    case '24h':
      start = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case '7d':
      start = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case '30d':
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    case '90d':
      start = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      break;
    case 'quarter': {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      break;
    }
    case 'year':
      start = new Date(now.getFullYear(), 0, 1);
      break;
    case 'custom':
      start = customStart ?? new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
    default:
      start = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  }
  
  return { start, end };
}

/**
 * Calculate previous date range for comparison
 */
function calculatePreviousDateRange(
  start: Date,
  end: Date
): { start: Date; end: Date } {
  const duration = end.getTime() - start.getTime();
  return {
    start: new Date(start.getTime() - duration),
    end: start,
  };
}

/**
 * Generate time series data
 */
function generateTimeSeries<T>(
  items: T[],
  startDate: Date,
  endDate: Date,
  valueExtractor: (item: T) => number
): TimeSeriesDataPoint[] {
  const dayMap = new Map<string, number>();
  
  // Initialize all days with 0
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  for (let i = 0; i <= days; i++) {
    const date = new Date(startDate.getTime() + i * 24 * 60 * 60 * 1000);
    const key = date.toISOString().split('T')[0];
    dayMap.set(key, 0);
  }
  
  // Add item values
  type ItemWithDate = T & { createdAt?: Date | FirestoreTimestamp | string; startedAt?: Date | FirestoreTimestamp | string; date?: Date | FirestoreTimestamp | string };
  (items as ItemWithDate[]).forEach((item) => {
    const date = item.createdAt ?? item.startedAt ?? item.date;
    if (date) {
      const dateObj = toDate(date);
      const key = dateObj.toISOString().split('T')[0];
      const existing = dayMap.get(key) ?? 0;
      dayMap.set(key, existing + valueExtractor(item as T));
    }
  });
  
  return Array.from(dayMap.entries())
    .map(([dateKey, value]) => ({
      date: new Date(dateKey),
      value,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Clear analytics cache
 */
export async function clearAnalyticsCache(reason: 'manual' | 'automatic' | 'expired' = 'manual', userId?: string): Promise<void> {
  analyticsCache.clear();
  
  // Emit cache cleared event
  const { emitCacheCleared } = await import('./events');
  await emitCacheCleared(reason, userId);
}
