/**
 * Workflow Analytics Service
 * Analyzes workflow execution data
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { where, orderBy, limit, Timestamp } from 'firebase/firestore';

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
 * Get workflow analytics
 */
export async function getWorkflowAnalytics(
  workspaceId: string,
  workflowId: string,
  startDate: Date,
  endDate: Date
): Promise<WorkflowAnalytics> {
  // Get workflow
  const workflow = await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/${COLLECTIONS.WORKFLOWS}`,
    workflowId
  );
  
  if (!workflow) {
    throw new Error('Workflow not found');
  }
  
  // Get executions in period
  const executions = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/workflowExecutions`,
    [
      where('workflowId', '==', workflowId),
      where('startedAt', '>=', Timestamp.fromDate(startDate)),
      where('startedAt', '<=', Timestamp.fromDate(endDate)),
      orderBy('startedAt', 'desc'),
    ]
  );
  
  // Calculate metrics
  const totalExecutions = executions.length;
  const successfulExecutions = executions.filter((e: any) => e.status === 'completed').length;
  const failedExecutions = executions.filter((e: any) => e.status === 'failed').length;
  const successRate = totalExecutions > 0 ? (successfulExecutions / totalExecutions) * 100 : 0;
  
  // Calculate average execution time
  const executionTimes = executions
    .filter((e: any) => e.completedAt && e.startedAt)
    .map((e: any) => {
      const started = e.startedAt.toDate?.() || new Date(e.startedAt);
      const completed = e.completedAt.toDate?.() || new Date(e.completedAt);
      return completed.getTime() - started.getTime();
    });
  
  const averageExecutionTime = executionTimes.length > 0
    ? executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length
    : 0;
  
  // Calculate action breakdown
  const actionBreakdown = calculateActionBreakdown(executions);
  
  // Calculate total actions
  const totalActionsExecuted = executions.reduce((sum, e: any) => {
    return sum + (e.actionResults?.length || 0);
  }, 0);
  
  const averageActionsPerExecution = totalExecutions > 0
    ? totalActionsExecuted / totalExecutions
    : 0;
  
  // Calculate trends
  const executionsByDay = calculateExecutionsByDay(executions, startDate, endDate);
  
  return {
    workflowId,
    workflowName: (workflow as any).name || 'Unknown',
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
function calculateActionBreakdown(executions: any[]): any[] {
  const actionMap = new Map<string, { count: number; success: number; totalTime: number; times: number[] }>();
  
  executions.forEach((execution: any) => {
    const results = execution.actionResults || [];
    results.forEach((result: any) => {
      const actionType = result.actionType || 'unknown';
      const existing = actionMap.get(actionType) || { count: 0, success: 0, totalTime: 0, times: [] };
      
      actionMap.set(actionType, {
        count: existing.count + 1,
        success: existing.success + (result.status === 'success' ? 1 : 0),
        totalTime: existing.totalTime + (result.duration || 0),
        times: [...existing.times, result.duration || 0],
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
function calculateExecutionsByDay(executions: any[], startDate: Date, endDate: Date): any[] {
  const dayMap = new Map<string, { count: number; success: number; failed: number }>();
  
  executions.forEach((execution: any) => {
    const started = execution.startedAt.toDate?.() || new Date(execution.startedAt);
    const dayKey = started.toISOString().split('T')[0];
    
    const existing = dayMap.get(dayKey) || { count: 0, success: 0, failed: 0 };
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
  workspaceId: string,
  startDate: Date,
  endDate: Date
): Promise<Array<{ workflowId: string; workflowName: string; executions: number; successRate: number }>> {
  // Get all workflows
  const workflows = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/${COLLECTIONS.WORKFLOWS}`,
    [where('status', '==', 'active')]
  );
  
  // Get analytics for each
  const analytics = await Promise.all(
    workflows.map(async (workflow: any) => {
      const executions = await FirestoreService.getAll(
        `${COLLECTIONS.ORGANIZATIONS}/*/workspaces/${workspaceId}/workflowExecutions`,
        [
          where('workflowId', '==', workflow.id),
          where('startedAt', '>=', Timestamp.fromDate(startDate)),
          where('startedAt', '<=', Timestamp.fromDate(endDate)),
        ]
      );
      
      const successful = executions.filter((e: any) => e.status === 'completed').length;
      const successRate = executions.length > 0 ? (successful / executions.length) * 100 : 0;
      
      return {
        workflowId: workflow.id,
        workflowName: workflow.name || 'Unknown',
        executions: executions.length,
        successRate,
      };
    })
  );
  
  return analytics.sort((a, b) => b.executions - a.executions);
}





