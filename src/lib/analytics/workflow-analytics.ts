/**
 * Workflow Analytics Service
 * Analyzes workflow execution data
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, Timestamp } from 'firebase/firestore';

// Core data structure interfaces
interface WorkflowData {
  id: string;
  name?: string;
  status?: string;
}

interface FirestoreTimestamp {
  toDate?: () => Date;
}

interface ActionResult {
  actionType?: string;
  status?: string;
  duration?: number;
}

interface WorkflowExecution {
  id: string;
  workflowId: string;
  status?: string;
  startedAt: Timestamp | FirestoreTimestamp | Date;
  completedAt?: Timestamp | FirestoreTimestamp | Date;
  actionResults?: ActionResult[];
}

interface ActionBreakdownStats {
  count: number;
  success: number;
  totalTime: number;
  times: number[];
}

interface DayStats {
  count: number;
  success: number;
  failed: number;
}

export interface WorkflowAnalytics {
  workflowId: string;
  workflowName: string;
  period: string;

  // Execution metrics
  totalExecutions: number;
  successfulExecutions: number;
  failedExecutions: number;
  successRate: number;

  // Performance metrics
  averageExecutionTime: number; // milliseconds
  totalActionsExecuted: number;
  averageActionsPerExecution: number;

  // Action breakdown
  actionBreakdown: Array<{
    actionType: string;
    count: number;
    successRate: number;
    averageTime: number;
  }>;

  // Trends
  executionsByDay: Array<{
    date: Date;
    count: number;
    success: number;
    failed: number;
  }>;
}

/**
 * Convert Firestore timestamp to Date
 */
function toDate(timestamp: Timestamp | FirestoreTimestamp | Date): Date {
  if (timestamp instanceof Date) {
    return timestamp;
  }
  if ('toDate' in timestamp && typeof timestamp.toDate === 'function') {
    return timestamp.toDate();
  }
  return new Date(timestamp as unknown as string);
}

/**
 * Get workflow analytics
 */
export async function getWorkflowAnalytics(
  organizationId: string,
  workspaceId: string,
  workflowId: string,
  startDate: Date,
  endDate: Date
): Promise<WorkflowAnalytics> {
  // Get workflow
  const workflowDoc = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/${COLLECTIONS.WORKFLOWS}`,
    workflowId
  );

  if (!workflowDoc) {
    throw new Error('Workflow not found');
  }

  const workflow = workflowDoc as WorkflowData;

  // Get executions in period
  const executionDocs = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/workflowExecutions`,
    [
      where('workflowId', '==', workflowId),
      where('startedAt', '>=', Timestamp.fromDate(startDate)),
      where('startedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('startedAt', 'desc'),
    ]
  );

  const executions = executionDocs as WorkflowExecution[];

  // Calculate metrics
  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter((e) => e.status === 'completed').length;
  const failedExecutions = executions.filter((e) => e.status === 'failed').length;
  const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;

  // Calculate average execution time
  const executionTimes = executions
    .filter((e) => e.completedAt && e.startedAt)
    .map((e) => {
      const started = toDate(e.startedAt);
      // We know completedAt exists because of the filter above
      const completedAt = e.completedAt as Timestamp | FirestoreTimestamp | Date;
      const completed = toDate(completedAt);
      return completed.getTime() - started.getTime();
    });

  const averageExecutionTime = executionTimes.length > 0
    ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
    : 0;

  // Calculate action breakdown
  const actionBreakdown = calculateActionBreakdown(executions);

  // Calculate total actions
  const totalActionsExecuted = executions.reduce((sum, e) => {
    return sum + (e.actionResults?.length ?? 0);
  }, 0);

  const averageActionsPerExecution = totalExecutions > 0
    ? totalActionsExecuted / totalExecutions
    : 0;

  // Calculate trends
  const executionsByDay = calculateExecutionsByDay(executions, startDate, endDate);

  return {
    workflowId,
    workflowName: workflow.name ?? 'Unknown',
    period: `${startDate.toISOString().split('T')[0]} to ${endDate.toISOString().split('T')[0]}`,
    totalExecutions,
    successfulExecutions,
    failedExecutions,
    successRate,
    averageExecutionTime,
    totalActionsExecuted,
    averageActionsPerExecution,
    actionBreakdown,
    executionsByDay,
  };
}

/**
 * Calculate action breakdown
 */
function calculateActionBreakdown(executions: WorkflowExecution[]): Array<{
  actionType: string;
  count: number;
  successRate: number;
  averageTime: number;
}> {
  const actionMap = new Map<string, ActionBreakdownStats>();

  executions.forEach((execution) => {
    const results = execution.actionResults ?? [];
    results.forEach((result) => {
      const actionType = result.actionType ?? 'unknown';
      const existing = actionMap.get(actionType) ?? { count: 0, success: 0, totalTime: 0, times: [] };

      actionMap.set(actionType, {
        count: existing.count + 1,
        success: existing.success + (result.status === 'success' ? 1 : 0),
        totalTime: existing.totalTime + (result.duration ?? 0),
        times: [...existing.times, result.duration ?? 0],
      });
    });
  });

  return Array.from(actionMap.entries()).map(([actionType, data]) => ({
    actionType,
    count: data.count,
    successRate: data.count > 0 ? (data.success / data.count) * 100 : 0,
    averageTime: data.times.length > 0
      ? data.times.reduce((sum, t) => sum + t, 0) / data.times.length
      : 0,
  }));
}

/**
 * Calculate executions by day
 */
function calculateExecutionsByDay(
  executions: WorkflowExecution[],
  _startDate: Date,
  _endDate: Date
): Array<{
  date: Date;
  count: number;
  success: number;
  failed: number;
}> {
  const dayMap = new Map<string, DayStats>();

  executions.forEach((execution) => {
    const started = toDate(execution.startedAt);
    const dayKey = started.toISOString().split('T')[0];

    const existing = dayMap.get(dayKey) ?? { count: 0, success: 0, failed: 0 };
    dayMap.set(dayKey, {
      count: existing.count + 1,
      success: existing.success + (execution.status === 'completed' ? 1 : 0),
      failed: existing.failed + (execution.status === 'failed' ? 1 : 0),
    });
  });

  return Array.from(dayMap.entries())
    .map(([dateKey, data]) => ({
      date: new Date(dateKey),
      count: data.count,
      success: data.success,
      failed: data.failed,
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

/**
 * Get all workflows analytics summary
 */
export async function getAllWorkflowsAnalytics(
  organizationId: string,
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ workflowId: string; workflowName: string; executions: number; successRate: number }>> {
  // Get all workflows
  const workflowDocs = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/${COLLECTIONS.WORKFLOWS}`,
    [where('status', '==', 'active')]
  );

  const workflows = workflowDocs as WorkflowData[];

  // Get analytics for each
  const analytics = await Promise.all(
    workflows.map(async (workflow) => {
      const executionDocs = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/workspaces/${workspaceId}/workflowExecutions`,
        [
          where('workflowId', '==', workflow.id),
          where('startedAt', '>=', Timestamp.fromDate(startDate)),
          where('startedAt', '<=', Timestamp.fromDate(endDate)),
        ]
      );

      const executions = executionDocs as WorkflowExecution[];
      const successful = executions.filter((e) => e.status === 'completed').length;
      const successRate = executions.length > 0 ? (successful / executions.length) * 100 : 0;

      return {
        workflowId: workflow.id,
        workflowName: workflow.name ?? 'Unknown',
        executions: executions.length,
        successRate,
      };
    })
  );

  return analytics.sort((a, b) => b.executions - a.executions);
}






















