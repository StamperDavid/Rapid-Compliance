/**
 * Workflow Service - High-Level Workflow Management
 * 
 * SOVEREIGN CORPORATE BRAIN - WORKFLOW MANAGEMENT API
 * 
 * This service provides high-level operations for workflow management:
 * - Create, read, update, delete workflows
 * - Execute workflows manually or via automation
 * - Query workflows and executions
 * - Manage workflow lifecycle
 * 
 * INTEGRATION:
 * - Workflow Engine for execution
 * - Workflow Coordinator for Signal Bus integration
 * - Firestore via DAL for persistence
 * - Validation schemas for input validation
 */

import { logger } from '@/lib/logger/logger';
import { Timestamp } from 'firebase-admin/firestore';
import type { Firestore, UpdateData, DocumentData, QueryConstraint } from 'firebase/firestore';
import { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';
import { db } from '@/lib/firebase-admin';
import { type WorkflowExecutionContext, type WorkflowExecutionResult } from './workflow-engine';
import { WorkflowCoordinator } from './workflow-coordinator';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type {
  Workflow,
  WorkflowStatus,
  WorkflowExecution,
  WorkflowStats,
  WorkflowSettings,
  WorkflowTrigger,
  WorkflowAction,
} from './types';
import type { CreateWorkflowInput, UpdateWorkflowInput, WorkflowFilterInput } from './validation';

// ============================================================================
// WORKFLOW SERVICE
// ============================================================================

/**
 * Workflow Service
 * 
 * Manages workflow CRUD operations and execution
 */
export class WorkflowService {
  private dal: BaseAgentDAL;
  private coordinator: WorkflowCoordinator;
  
  constructor(dalInstance: BaseAgentDAL) {
    this.dal = dalInstance;
    this.coordinator = new WorkflowCoordinator(dalInstance);
    
    logger.info('WorkflowService initialized');
  }
  
  /**
   * Create a new workflow
   * 
   * @param input - Workflow creation data
   * @param userId - User creating the workflow
   * @returns Created workflow
   */
  async createWorkflow(
    input: CreateWorkflowInput,
    userId: string
  ): Promise<Workflow> {
    logger.info('Creating workflow', {
      workflowName: input.name,
      userId,
    });

    const now = Timestamp.now();

    const workflow: Workflow = {
      id: '', // Will be set by Firestore
      name: input.name,
      description: input.description,
      status: input.status || 'draft',
      trigger: input.trigger as WorkflowTrigger,
      actions: input.actions as WorkflowAction[],
      settings: this.getDefaultSettings(input.settings as Partial<WorkflowSettings> | undefined),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      stats: this.getDefaultStats(),
      tags: input.tags ?? [],
    };
    
    // Save to Firestore (use collection path as string)
    const workflowsPath = `${this.dal.getColPath('organizations')}/${PLATFORM_ID}/${this.dal.getSubColPath('workflows')}`;
    
    const docRef = await this.dal.safeAddDoc(
      workflowsPath,
      workflow
    );
    
    const createdWorkflow = { ...workflow, id: docRef.id };
    
    logger.info('Workflow created successfully', {
      workflowId: createdWorkflow.id,
    });
    
    return createdWorkflow;
  }
  
  /**
   * Get workflow by ID
   */
  async getWorkflow(
    workflowId: string
  ): Promise<Workflow | null> {
    const workflowsPath = `${this.dal.getColPath('organizations')}/${PLATFORM_ID}/${this.dal.getSubColPath('workflows')}`;

    const docSnap = await this.dal.safeGetDoc<Workflow>(
      workflowsPath,
      workflowId
    );

    if (!docSnap.exists()) {
      return null;
    }

    return { ...docSnap.data(), id: workflowId } as Workflow;
  }
  
  /**
   * Query workflows with filters
   */
  async getWorkflows(
    filters: WorkflowFilterInput
  ): Promise<{ workflows: Workflow[]; total: number }> {
    logger.debug('Querying workflows', filters);

    const workflowsPath = `${this.dal.getColPath('organizations')}/${PLATFORM_ID}/${this.dal.getSubColPath('workflows')}`;

    try {
      // Build query constraints
      const constraints: QueryConstraint[] = [];

      // Apply status filter
      if (filters.status) {
        const { where } = await import('firebase/firestore');
        constraints.push(where('status', '==', filters.status));
      }

      // Apply trigger type filter
      if (filters.triggerType) {
        const { where } = await import('firebase/firestore');
        constraints.push(where('trigger.type', '==', filters.triggerType));
      }

      // Apply tags filter (array-contains for single tag)
      if (filters.tags && filters.tags.length > 0) {
        const { where } = await import('firebase/firestore');
        constraints.push(where('tags', 'array-contains', filters.tags[0]));
      }

      // Add ordering
      const { orderBy } = await import('firebase/firestore');
      constraints.push(orderBy('updatedAt', 'desc'));

      // Add limit
      const { limit } = await import('firebase/firestore');
      const limitValue = filters.limit ?? 20;
      constraints.push(limit(limitValue));

      // Execute query
      const querySnapshot = await this.dal.safeGetDocs(workflowsPath, ...constraints);

      const workflows: Workflow[] = [];
      querySnapshot.forEach((doc) => {
        workflows.push({ ...doc.data(), id: doc.id } as Workflow);
      });

      logger.info('Workflows queried successfully', {
        count: workflows.length,
      });

      return {
        workflows,
        total: workflows.length,
      };
    } catch (error) {
      logger.error('Failed to query workflows', error instanceof Error ? error : new Error(String(error)));
      return {
        workflows: [],
        total: 0,
      };
    }
  }
  
  /**
   * Update workflow
   */
  async updateWorkflow(
    workflowId: string,
    updates: UpdateWorkflowInput
  ): Promise<Workflow> {
    logger.info('Updating workflow', {
      workflowId,
      updateFields: Object.keys(updates).join(', '),
    });

    const workflow = await this.getWorkflow(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    const workflowsPath = `${this.dal.getColPath('organizations')}/${PLATFORM_ID}/${this.dal.getSubColPath('workflows')}`;

    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };

    // Type assertion needed because UpdateWorkflowInput contains complex nested types
    // that are compatible with Firestore at runtime but TypeScript can't infer
    await this.dal.safeUpdateDoc(
      workflowsPath,
      workflowId,
      updatedData as UpdateData<DocumentData>
    );

    const updatedWorkflow = { ...workflow, ...updatedData } as Workflow;

    logger.info('Workflow updated successfully', {
      workflowId,
    });

    return updatedWorkflow;
  }
  
  /**
   * Update workflow status (activate/pause/archive)
   */
  async setWorkflowStatus(
    workflowId: string,
    status: WorkflowStatus
  ): Promise<Workflow> {
    logger.info('Updating workflow status', {
      workflowId,
      status,
    });

    return this.updateWorkflow(workflowId, { status });
  }
  
  /**
   * Delete workflow
   */
  async deleteWorkflow(
    workflowId: string
  ): Promise<void> {
    logger.info('Deleting workflow', {
      workflowId,
    });

    const workflowsPath = `${this.dal.getColPath('organizations')}/${PLATFORM_ID}/${this.dal.getSubColPath('workflows')}`;

    await this.dal.safeDeleteDoc(workflowsPath, workflowId);

    logger.info('Workflow deleted successfully', {
      workflowId,
    });
  }
  
  /**
   * Execute workflow manually
   */
  async executeWorkflow(
    workflowId: string,
    context: WorkflowExecutionContext
  ): Promise<WorkflowExecutionResult> {
    logger.info('Manually executing workflow', {
      workflowId,
      dealId: context.dealId,
    });

    const fullContext: WorkflowExecutionContext = {
      ...context,
      triggeredBy: 'manual',
    };

    return this.coordinator.executeWorkflowManually(workflowId, fullContext);
  }
  
  /**
   * Get workflow executions
   */
  async getWorkflowExecutions(
    workflowId?: string,
    limitCount = 50
  ): Promise<WorkflowExecution[]> {
    logger.debug('Getting workflow executions', {
      workflowId,
      limit: limitCount,
    });

    const executionsPath = `${this.dal.getColPath('organizations')}/${PLATFORM_ID}/${this.dal.getSubColPath('workflow_executions')}`;

    try {
      // Build query constraints
      const constraints: QueryConstraint[] = [];

      // Filter by workflow ID if provided
      if (workflowId) {
        const { where } = await import('firebase/firestore');
        constraints.push(where('workflowId', '==', workflowId));
      }

      // Order by start time (most recent first)
      const { orderBy } = await import('firebase/firestore');
      constraints.push(orderBy('startedAt', 'desc'));

      // Apply limit
      const { limit } = await import('firebase/firestore');
      constraints.push(limit(limitCount));

      // Execute query
      const querySnapshot = await this.dal.safeGetDocs(executionsPath, ...constraints);

      const executions: WorkflowExecution[] = [];
      querySnapshot.forEach((doc) => {
        executions.push({ ...doc.data(), id: doc.id } as WorkflowExecution);
      });

      logger.info('Workflow executions retrieved successfully', {
        count: executions.length,
        workflowId,
      });

      return executions;
    } catch (error) {
      logger.error('Failed to get workflow executions', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }
  
  /**
   * Get workflow execution by ID
   */
  async getWorkflowExecution(
    executionId: string
  ): Promise<WorkflowExecution | null> {
    const executionsPath = `${this.dal.getColPath('organizations')}/${PLATFORM_ID}/${this.dal.getSubColPath('workflow_executions')}`;

    const docSnap = await this.dal.safeGetDoc<WorkflowExecution>(
      executionsPath,
      executionId
    );

    if (!docSnap.exists()) {
      return null;
    }

    return { ...docSnap.data(), id: executionId } as WorkflowExecution;
  }
  
  /**
   * Get workflow statistics
   */
  async getWorkflowStats(
    workflowId: string
  ): Promise<WorkflowStats> {
    const workflow = await this.getWorkflow(workflowId);

    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }

    return workflow.stats;
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Get default workflow settings
   */
  private getDefaultSettings(settings?: Partial<WorkflowSettings>): WorkflowSettings {
    return {
      maxExecutionsPerDay: settings?.maxExecutionsPerDay ?? 100,
      maxExecutionsPerDeal: settings?.maxExecutionsPerDeal ?? 10,
      cooldownMinutes: settings?.cooldownMinutes ?? 60,
      executeOnWeekends: settings?.executeOnWeekends ?? true,
      executeOnHolidays: settings?.executeOnHolidays ?? true,
      applyToNewDealsOnly: settings?.applyToNewDealsOnly ?? false,
      dealFilters: settings?.dealFilters ?? [],
      notifyOnSuccess: settings?.notifyOnSuccess ?? false,
      notifyOnFailure: settings?.notifyOnFailure ?? true,
      notificationRecipients: settings?.notificationRecipients ?? [],
    };
  }
  
  /**
   * Get default workflow statistics
   */
  private getDefaultStats(): WorkflowStats {
    return {
      totalExecutions: 0,
      successfulExecutions: 0,
      failedExecutions: 0,
      averageExecutionTimeMs: 0,
    };
  }
}

// ============================================================================
// SINGLETON INSTANCE (for API routes)
// ============================================================================

let workflowServiceInstance: WorkflowService | null = null;

/**
 * Get workflow service instance
 * 
 * @param dal - BaseAgentDAL instance (required for first call)
 * @returns WorkflowService instance
 */
export function getWorkflowService(dal?: BaseAgentDAL): WorkflowService {
  if (!workflowServiceInstance) {
    if (!dal) {
      throw new Error('DAL instance required for first WorkflowService initialization');
    }
    workflowServiceInstance = new WorkflowService(dal);
  }
  
  return workflowServiceInstance;
}

// ============================================================================
// CONVENIENCE EXPORTS (for API routes)
// ============================================================================

/**
 * Create workflow
 */
export async function createWorkflow(
  workflowData: CreateWorkflowInput,
  userId: string
): Promise<Workflow> {
  // Cast admin Firestore to client Firestore type - they share same API at runtime
  const dal = new BaseAgentDAL(db as unknown as Firestore);
  const service = getWorkflowService(dal);

  return service.createWorkflow(workflowData, userId);
}

/**
 * Get workflows
 */
export async function getWorkflows(
  filters?: Record<string, unknown>
): Promise<{ data: Workflow[]; hasMore: boolean }> {
  // Cast admin Firestore to client Firestore type - they share same API at runtime
  const dal = new BaseAgentDAL(db as unknown as Firestore);
  const service = getWorkflowService(dal);

  const result = await service.getWorkflows(filters as WorkflowFilterInput);

  return {
    data: result.workflows,
    hasMore: result.workflows.length >= ((filters?.limit as number | undefined) ?? 20),
  };
}

/**
 * Get workflow
 */
export async function getWorkflow(
  workflowId: string
): Promise<Workflow | null> {
  // Cast admin Firestore to client Firestore type - they share same API at runtime
  const dal = new BaseAgentDAL(db as unknown as Firestore);
  const service = getWorkflowService(dal);

  return service.getWorkflow(workflowId);
}

/**
 * Update workflow
 */
export async function updateWorkflow(
  workflowId: string,
  updates: UpdateWorkflowInput
): Promise<Workflow> {
  // Cast admin Firestore to client Firestore type - they share same API at runtime
  const dal = new BaseAgentDAL(db as unknown as Firestore);
  const service = getWorkflowService(dal);

  return service.updateWorkflow(workflowId, updates);
}

/**
 * Set workflow status
 */
export async function setWorkflowStatus(
  workflowId: string,
  status: WorkflowStatus
): Promise<Workflow> {
  // Cast admin Firestore to client Firestore type - they share same API at runtime
  const dal = new BaseAgentDAL(db as unknown as Firestore);
  const service = getWorkflowService(dal);

  return service.setWorkflowStatus(workflowId, status);
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(
  workflowId: string
): Promise<void> {
  // Cast admin Firestore to client Firestore type - they share same API at runtime
  const dal = new BaseAgentDAL(db as unknown as Firestore);
  const service = getWorkflowService(dal);

  return service.deleteWorkflow(workflowId);
}
