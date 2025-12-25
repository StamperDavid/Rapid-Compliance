/**
 * Workflow Executor
 * Executes workflows and manages workflow execution state
 */

import { logger } from '@/lib/logger/logger';
import { executeWorkflow as engineExecuteWorkflow } from './workflow-engine';

/**
 * Execute a workflow
 * This is the main entry point for workflow execution
 */
export async function executeWorkflow(
  organizationId: string,
  workflowId: string,
  context: Record<string, any>
): Promise<void> {
  try {
    logger.info('Executing workflow', {
      organizationId,
      workflowId,
      contextKeys: Object.keys(context),
    });

    // Fetch the workflow
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const workflow = await FirestoreService.get<any>(
      `organizations/${organizationId}/workflows`,
      workflowId
    );

    if (!workflow) {
      throw new Error(`Workflow ${workflowId} not found`);
    }

    // Execute the workflow with the provided context
    await engineExecuteWorkflow(workflow, context);

    logger.info('Workflow execution completed', { workflowId });
  } catch (error: any) {
    logger.error('Workflow execution failed', error, {
      organizationId,
      workflowId,
    });
    throw error;
  }
}

/**
 * Execute a workflow asynchronously (fire-and-forget)
 */
export async function executeWorkflowAsync(
  organizationId: string,
  workflowId: string,
  context: Record<string, any>
): Promise<void> {
  // Execute in background without waiting
  executeWorkflow(organizationId, workflowId, context).catch((error) => {
    logger.error('Async workflow execution failed', error, {
      organizationId,
      workflowId,
    });
  });
}

/**
 * Execute multiple workflows in parallel
 */
export async function executeWorkflowsParallel(
  organizationId: string,
  workflows: Array<{ workflowId: string; context: Record<string, any> }>
): Promise<void> {
  try {
    await Promise.all(
      workflows.map(({ workflowId, context }) =>
        executeWorkflow(organizationId, workflowId, context)
      )
    );
  } catch (error: any) {
    logger.error('Parallel workflow execution failed', error);
    throw error;
  }
}

/**
 * Execute multiple workflows sequentially
 */
export async function executeWorkflowsSequential(
  organizationId: string,
  workflows: Array<{ workflowId: string; context: Record<string, any> }>
): Promise<void> {
  for (const { workflowId, context } of workflows) {
    await executeWorkflow(organizationId, workflowId, context);
  }
}

