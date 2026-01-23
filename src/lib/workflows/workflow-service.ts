/**
 * Workflow Service
 * Business logic layer for workflow automation management
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { where, orderBy, Timestamp, type QueryConstraint, type QueryDocumentSnapshot } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import type { Workflow, WorkflowExecution } from '@/types/workflow';

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

/**
 * Get workflows with pagination and filtering
 */
export async function getWorkflows(
  organizationId: string,
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
      `organizations/${organizationId}/workspaces/${workspaceId}/workflows`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Workflows retrieved', {
      organizationId,
      count: result.data.length,
      filters: JSON.stringify(filters ?? {}),
    });

    return result;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get workflows', err, { organizationId, filters: JSON.stringify(filters ?? {}) });
    throw new Error(`Failed to retrieve workflows: ${err.message}`);
  }
}

/**
 * Get a single workflow
 */
export async function getWorkflow(
  organizationId: string,
  workflowId: string,
  workspaceId: string = 'default'
): Promise<Workflow | null> {
  try {
    const workflow = await FirestoreService.get<Workflow>(
      `organizations/${organizationId}/workspaces/${workspaceId}/workflows`,
      workflowId
    );

    if (!workflow) {
      logger.warn('Workflow not found', { organizationId, workflowId });
      return null;
    }

    logger.info('Workflow retrieved', { organizationId, workflowId });
    return workflow;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get workflow', err, { organizationId, workflowId });
    throw new Error(`Failed to retrieve workflow: ${err.message}`);
  }
}

/**
 * Create a new workflow
 */
export async function createWorkflow(
  organizationId: string,
  data: Omit<Workflow, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'updatedAt' | 'createdBy' | 'version' | 'stats'>,
  createdBy: string,
  workspaceId: string = 'default'
): Promise<Workflow> {
  try {
    const workflowId = `workflow-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    const now = Timestamp.now();

    const workflow: Workflow = {
      ...data,
      id: workflowId,
      organizationId,
      workspaceId,
      status: data.status || 'draft',
      stats: {
        totalRuns: 0,
        successfulRuns: 0,
        failedRuns: 0,
      },
      createdAt: now,
      updatedAt: now,
      createdBy,
      version: 1,
    };

    await FirestoreService.set(
      `organizations/${organizationId}/workspaces/${workspaceId}/workflows`,
      workflowId,
      workflow,
      false
    );

    logger.info('Workflow created', {
      organizationId,
      workflowId,
      name: workflow.name,
      triggerType: workflow.trigger?.type ?? 'unknown',
    });

    return workflow;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to create workflow', err, { organizationId, workflowName: data.name ?? 'unknown' });
    throw new Error(`Failed to create workflow: ${err.message}`);
  }
}

/**
 * Update workflow
 */
export async function updateWorkflow(
  organizationId: string,
  workflowId: string,
  updates: Partial<Omit<Workflow, 'id' | 'organizationId' | 'workspaceId' | 'createdAt' | 'stats'>>,
  workspaceId: string = 'default'
): Promise<Workflow> {
  try {
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    await FirestoreService.update(
      `organizations/${organizationId}/workspaces/${workspaceId}/workflows`,
      workflowId,
      updatedData
    );

    logger.info('Workflow updated', {
      organizationId,
      workflowId,
      updatedFields: Object.keys(updates),
    });

    const workflow = await getWorkflow(organizationId, workflowId, workspaceId);
    if (!workflow) {
      throw new Error('Workflow not found after update');
    }

    return workflow;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to update workflow', err, { organizationId, workflowId });
    throw new Error(`Failed to update workflow: ${err.message}`);
  }
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(
  organizationId: string,
  workflowId: string,
  workspaceId: string = 'default'
): Promise<void> {
  try {
    await FirestoreService.delete(
      `organizations/${organizationId}/workspaces/${workspaceId}/workflows`,
      workflowId
    );

    logger.info('Workflow deleted', { organizationId, workflowId });
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to delete workflow', err, { organizationId, workflowId });
    throw new Error(`Failed to delete workflow: ${err.message}`);
  }
}

/**
 * Activate/pause workflow
 */
export async function setWorkflowStatus(
  organizationId: string,
  workflowId: string,
  status: 'active' | 'paused',
  workspaceId: string = 'default'
): Promise<Workflow> {
  try {
    const workflow = await updateWorkflow(organizationId, workflowId, { status }, workspaceId);

    logger.info('Workflow status changed', {
      organizationId,
      workflowId,
      newStatus: status,
    });

    return workflow;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to change workflow status', err, { organizationId, workflowId, status });
    throw new Error(`Failed to change workflow status: ${err.message}`);
  }
}

/**
 * Execute workflow manually
 */
export async function executeWorkflow(
  organizationId: string,
  workflowId: string,
  context: Record<string, unknown>,
  workspaceId: string = 'default'
): Promise<{ success: boolean; executionId: string; error?: string }> {
  try {
    const workflow = await getWorkflow(organizationId, workflowId, workspaceId);
    if (!workflow) {
      throw new Error('Workflow not found');
    }

    // Execute via workflow engine
    const { executeWorkflowImpl: runEngine } = await import('./workflow-engine');

    const result = await runEngine(workflow, context);

    logger.info('Workflow executed', {
      organizationId,
      workflowId,
      executionId: result.id,
      status: result.status,
    });

    return {
      success: result.status === 'completed',
      executionId: result.id,
    };
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Workflow execution failed', err, { organizationId, workflowId });
    return {
      success: false,
      executionId: '',
      error: err.message,
    };
  }
}

/**
 * Get workflow execution history
 */
export async function getWorkflowRuns(
  organizationId: string,
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
      `organizations/${organizationId}/workspaces/${workspaceId}/workflowExecutions`,
      constraints,
      options?.pageSize ?? 50,
      options?.lastDoc
    );

    logger.info('Workflow runs retrieved', {
      organizationId,
      workflowId,
      count: result.data.length,
    });

    return result;
  } catch (error: unknown) {
    const err = error instanceof Error ? error : new Error(String(error));
    logger.error('Failed to get workflow runs', err, { organizationId, workflowId });
    throw new Error(`Failed to retrieve workflow runs: ${err.message}`);
  }
}

