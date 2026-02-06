/**
 * Workflow Service
 * Business logic layer for workflow automation management
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, Timestamp, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import type { Workflow } from '@/types/workflow';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

/**
 * Helper to extract error message from unknown error
 */
function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

export interface WorkflowFilters {
  status?: 'draft' | 'active' | 'paused' | 'archived';
  triggerType?: string;
}

export interface PaginationOptions {
  pageSize?: number;
  lastDoc?: QueryDocumentSnapshot;
}

export interface PaginatedResult<T> {
  data: T[];
  lastDoc: QueryDocumentSnapshot | null;
  hasMore: boolean;
}

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  status: 'running' | 'completed' | 'failed';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  context: Record<string, unknown>;
}

/**
 * Get workflows with pagination and filtering
 */
export async function getWorkflows(
  workspaceId: string = 'default',
  filters?: WorkflowFilters,
  options?: PaginationOptions
): Promise<PaginatedResult<Workflow>> {
  try {
    const constraints: QueryConstraint[] = [];

    // Apply filters
    if (filters?.status) {
      constraints.push(where('status', '==', filters.status));
    }

    if (filters?.triggerType) {
      constraints.push(where('trigger.type', '==', filters.triggerType));
    }

    // Default ordering
    constraints.push(orderBy('createdAt', 'desc'));

    const result = await FirestoreService.getAllPaginated<Workflow>(
      `organizations/${DEFAULT_ORG_ID}/workspaces/${workspaceId}/workflows`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Workflows retrieved', {
      organizationId: DEFAULT_ORG_ID,
      count: result.data.length,
      filterStatus: filters?.status,
      filterTriggerType: filters?.triggerType,
    });

    return result;
  } catch (error: unknown) {
    logger.error('Failed to get workflows', error instanceof Error ? error : undefined, {
      organizationId: DEFAULT_ORG_ID,
      filterStatus: filters?.status,
      filterTriggerType: filters?.triggerType,
    });
    throw new Error(`Failed to retrieve workflows: ${getErrorMessage(error)}`);
  }
}

/**
 * Get a single workflow
 */
export async function getWorkflow(
  workflowId: string,
  workspaceId: string = 'default'
): Promise<Workflow | null> {
  try {
    const workflow = await FirestoreService.get<Workflow>(
      `organizations/${DEFAULT_ORG_ID}/workspaces/${workspaceId}/workflows`,
      workflowId
    );

    if (!workflow) {
      logger.warn('Workflow not found', { organizationId: DEFAULT_ORG_ID, workflowId });
      return null;
    }

    logger.info('Workflow retrieved', { organizationId: DEFAULT_ORG_ID, workflowId });
    return workflow;
  } catch (error: unknown) {
    logger.error('Failed to get workflow', error instanceof Error ? error : undefined, { organizationId: DEFAULT_ORG_ID, workflowId });
    throw new Error(`Failed to retrieve workflow: ${getErrorMessage(error)}`);
  }
}

/**
 * Create a new workflow
 */
export async function createWorkflow(
  data: Omit<Workflow, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version' | 'stats'>,
  createdBy: string,
  workspaceId: string = 'default'
): Promise<Workflow> {
  try {
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date();

    const workflow: Workflow = {
      ...data,
      id: workflowId,
      workspaceId,
      status: data.status ?? 'draft',
      stats: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
      },
      createdAt: Timestamp.fromDate(now),
      updatedAt: Timestamp.fromDate(now),
      createdBy,
      version: 1,
    };

    await FirestoreService.set(
      `organizations/${DEFAULT_ORG_ID}/workspaces/${workspaceId}/workflows`,
      workflowId,
      workflow,
      false
    );

    logger.info('Workflow created', {
      organizationId: DEFAULT_ORG_ID,
      workflowId,
      name: workflow.name,
      triggerType: workflow.trigger?.type,
    });

    return workflow;
  } catch (error: unknown) {
    logger.error('Failed to create workflow', error instanceof Error ? error : undefined, {
      organizationId: DEFAULT_ORG_ID,
      workflowName: data.name,
      triggerType: data.trigger?.type,
    });
    throw new Error(`Failed to create workflow: ${getErrorMessage(error)}`);
  }
}

/**
 * Update workflow
 */
export async function updateWorkflow(
  workflowId: string,
  updates: Partial<Omit<Workflow, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'stats'>>,
  workspaceId: string = 'default'
): Promise<Workflow> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: new Date(),
    };

    await FirestoreService.update(
      `organizations/${DEFAULT_ORG_ID}/workspaces/${workspaceId}/workflows`,
      workflowId,
      updatedData
    );

    logger.info('Workflow updated', {
      organizationId: DEFAULT_ORG_ID,
      workflowId,
      updatedFields: Object.keys(updates),
    });

    const workflow = await getWorkflow(workflowId, workspaceId);
    if (!workflow) {
      throw new Error('Workflow not found after update');
    }

    return workflow;
  } catch (error: unknown) {
    logger.error('Failed to update workflow', error instanceof Error ? error : undefined, { organizationId: DEFAULT_ORG_ID, workflowId });
    throw new Error(`Failed to update workflow: ${getErrorMessage(error)}`);
  }
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(
  workflowId: string,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    await FirestoreService.delete(
      `organizations/${DEFAULT_ORG_ID}/workspaces/${workspaceId}/workflows`,
      workflowId
    );

    logger.info('Workflow deleted', { organizationId: DEFAULT_ORG_ID, workflowId });
  } catch (error: unknown) {
    logger.error('Failed to delete workflow', error instanceof Error ? error : undefined, { organizationId: DEFAULT_ORG_ID, workflowId });
    throw new Error(`Failed to delete workflow: ${getErrorMessage(error)}`);
  }
}

/**
 * Activate/pause workflow
 */
export async function setWorkflowStatus(
  workflowId: string,
  status: 'active' | 'paused',
  workspaceId: string = 'default'
): Promise<Workflow> {
  try {
    const workflow = await updateWorkflow(workflowId, { status }, workspaceId);

    logger.info('Workflow status changed', {
      organizationId: DEFAULT_ORG_ID,
      workflowId,
      newStatus: status,
    });

    return workflow;
  } catch (error: unknown) {
    logger.error('Failed to change workflow status', error instanceof Error ? error : undefined, { organizationId: DEFAULT_ORG_ID, workflowId, status });
    throw new Error(`Failed to change workflow status: ${getErrorMessage(error)}`);
  }
}

/**
 * Execute workflow manually
 */
export async function executeWorkflow(
  workflowId: string,
  context: Record<string, unknown>,
  workspaceId: string = 'default'
): Promise<{ success: boolean; executionId: string; error?: string }> {
  try {
    const workflow = await getWorkflow(workflowId, workspaceId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Execute via workflow engine
    const { executeWorkflowImpl: runEngine } = await import('./workflow-engine');

    const result = await runEngine(workflow, context);

    logger.info('Workflow executed', {
      organizationId: DEFAULT_ORG_ID,
      workflowId,
      executionId: result.id,
      status: result.status,
    });

    return {
      success: result.status === 'completed',
      executionId: result.id,
    };
  } catch (error: unknown) {
    logger.error('Workflow execution failed', error instanceof Error ? error : undefined, { organizationId: DEFAULT_ORG_ID, workflowId });
    return {
      success: false,
      executionId: '',
      error: getErrorMessage(error),
    };
  }
}

/**
 * Get workflow execution history
 */
export async function getWorkflowRuns(
  workflowId: string,
  workspaceId: string = 'default',
  options?: PaginationOptions
): Promise<PaginatedResult<WorkflowExecution>> {
  try {
    const constraints: QueryConstraint[] = [
      where('workflowId', '==', workflowId),
      orderBy('startedAt', 'desc'),
    ];

    const result = await FirestoreService.getAllPaginated<WorkflowExecution>(
      `organizations/${DEFAULT_ORG_ID}/workspaces/${workspaceId}/workflowExecutions`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Workflow runs retrieved', {
      organizationId: DEFAULT_ORG_ID,
      workflowId,
      count: result.data.length,
    });

    return result;
  } catch (error: unknown) {
    logger.error('Failed to get workflow runs', error instanceof Error ? error : undefined, { organizationId: DEFAULT_ORG_ID, workflowId });
    throw new Error(`Failed to retrieve workflow runs: ${getErrorMessage(error)}`);
  }
}

