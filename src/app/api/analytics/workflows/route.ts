import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

/**
 * GET /api/analytics/workflows - Get workflow analytics
 * 
 * Query params:
 * - orgId: organization ID (required)
 * - period: '7d' | '30d' | '90d' | 'all' (optional, default: '30d')
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/analytics/workflows');
    if (rateLimitResponse) {return rateLimitResponse;}

    const { searchParams } = new URL(request.url);
    const orgId = searchParams.get('orgId');
    const period = searchParams.get('period') || '30d';

    if (!orgId) {
      return errors.badRequest('orgId is required');
    }

    // Calculate date range based on period
    const now = new Date();
    let startDate: Date;
    
    switch (period) {
      case '7d':
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case '30d':
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case '90d':
        startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      case 'all':
        startDate = new Date('2020-01-01');
        break;
      default:
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get workflows from Firestore
    const workflowsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workflows`;
    let allWorkflows: any[] = [];
    
    try {
      allWorkflows = await FirestoreService.getAll(workflowsPath, []);
    } catch (e) {
      logger.debug('No workflows collection yet', { orgId });
    }

    // Get workflow executions
    const executionsPath = `${COLLECTIONS.ORGANIZATIONS}/${orgId}/workflowExecutions`;
    let allExecutions: any[] = [];
    
    try {
      allExecutions = await FirestoreService.getAll(executionsPath, []);
    } catch (e) {
      logger.debug('No workflow executions collection yet', { orgId });
    }

    // Filter executions by date
    const executionsInPeriod = allExecutions.filter(exec => {
      const execDate = exec.startedAt?.toDate?.() || exec.createdAt?.toDate?.() || new Date(exec.startedAt || exec.createdAt);
      return execDate >= startDate && execDate <= now;
    });

    // Calculate metrics
    const totalWorkflows = allWorkflows.length;
    const activeWorkflows = allWorkflows.filter(w => w.status === 'active' || w.enabled === true).length;
    const totalExecutions = executionsInPeriod.length;

    // Success/failure rates
    const successfulExecutions = executionsInPeriod.filter(exec => 
      exec.status === 'completed' || exec.status === 'success'
    );
    const failedExecutions = executionsInPeriod.filter(exec => 
      exec.status === 'failed' || exec.status === 'error'
    );

    const successRate = totalExecutions > 0 
      ? (successfulExecutions.length / totalExecutions) * 100 
      : 100; // Default to 100% if no executions

    // Average execution time
    const executionTimes = successfulExecutions
      .filter(exec => exec.startedAt && exec.completedAt)
      .map(exec => {
        const start = exec.startedAt?.toDate?.() || new Date(exec.startedAt);
        const end = exec.completedAt?.toDate?.() || new Date(exec.completedAt);
        return end.getTime() - start.getTime();
      });
    const avgExecutionTime = executionTimes.length > 0
      ? Math.round(executionTimes.reduce((sum, t) => sum + t, 0) / executionTimes.length)
      : 0;

    // By workflow
    const workflowMap = new Map<string, { name: string; executions: number; success: number; failed: number }>();
    executionsInPeriod.forEach(exec => {
      const workflowId = exec.workflowId;
      const workflow = allWorkflows.find(w => w.id === workflowId);
      const name = workflow?.name || exec.workflowName || 'Unknown Workflow';
      const isSuccess = exec.status === 'completed' || exec.status === 'success';
      const isFailed = exec.status === 'failed' || exec.status === 'error';
      
      const existing = workflowMap.get(workflowId) || { name, executions: 0, success: 0, failed: 0 };
      workflowMap.set(workflowId, {
        name,
        executions: existing.executions + 1,
        success: existing.success + (isSuccess ? 1 : 0),
        failed: existing.failed + (isFailed ? 1 : 0),
      });
    });

    const byWorkflow = Array.from(workflowMap.entries())
      .map(([workflowId, data]) => ({
        workflowId,
        name: data.name,
        executions: data.executions,
        successRate: data.executions > 0 ? (data.success / data.executions) * 100 : 100,
        failed: data.failed,
      }))
      .sort((a, b) => b.executions - a.executions);

    // By trigger type
    const triggerMap = new Map<string, number>();
    executionsInPeriod.forEach(exec => {
      const trigger = exec.triggerType || exec.trigger || 'manual';
      triggerMap.set(trigger, (triggerMap.get(trigger) || 0) + 1);
    });
    const byTrigger = Array.from(triggerMap.entries())
      .map(([trigger, count]) => ({ trigger, count }))
      .sort((a, b) => b.count - a.count);

    // Error breakdown
    const errorMap = new Map<string, number>();
    failedExecutions.forEach(exec => {
      const error = exec.error || exec.errorMessage || 'Unknown error';
      const errorType = error.split(':')[0].substring(0, 50);
      errorMap.set(errorType, (errorMap.get(errorType) || 0) + 1);
    });
    const topErrors = Array.from(errorMap.entries())
      .map(([error, count]) => ({ error, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);

    // Daily trends
    const dailyMap = new Map<string, { executions: number; success: number; failed: number }>();
    executionsInPeriod.forEach(exec => {
      const execDate = exec.startedAt?.toDate?.() || exec.createdAt?.toDate?.() || new Date(exec.startedAt || exec.createdAt);
      const dateKey = execDate.toISOString().split('T')[0];
      const isSuccess = exec.status === 'completed' || exec.status === 'success';
      const isFailed = exec.status === 'failed' || exec.status === 'error';
      
      const existing = dailyMap.get(dateKey) || { executions: 0, success: 0, failed: 0 };
      dailyMap.set(dateKey, {
        executions: existing.executions + 1,
        success: existing.success + (isSuccess ? 1 : 0),
        failed: existing.failed + (isFailed ? 1 : 0),
      });
    });

    const dailyTrends = Array.from(dailyMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    return NextResponse.json({
      success: true,
      analytics: {
        totalWorkflows,
        activeWorkflows,
        totalExecutions,
        successfulExecutions: successfulExecutions.length,
        failedExecutions: failedExecutions.length,
        successRate: Math.round(successRate * 10) / 10,
        avgExecutionTime, // in milliseconds
        avgExecutionTimeSeconds: Math.round(avgExecutionTime / 1000),
        byWorkflow,
        byTrigger,
        topErrors,
        dailyTrends,
      },
    });
  } catch (error: any) {
    logger.error('Error getting workflow analytics', error, { route: '/api/analytics/workflows' });
    return errors.database('Failed to get workflow analytics', error);
  }
}
