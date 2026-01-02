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
import { BaseAgentDAL } from '@/lib/dal/BaseAgentDAL';
import { db } from '@/lib/firebase-admin';
import { WorkflowEngine, type WorkflowExecutionContext, type WorkflowExecutionResult } from './workflow-engine';
import { WorkflowCoordinator } from './workflow-coordinator';
import type {
  Workflow,
  WorkflowStatus,
  WorkflowExecution,
  WorkflowStats,
  WorkflowSettings,
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
      organizationId: input.organizationId,
      workflowName: input.name,
      userId,
    });
    
    const now = Timestamp.now();
    
    const workflow: Workflow = {
      id: '', // Will be set by Firestore
      organizationId: input.organizationId,
      workspaceId: input.workspaceId,
      name: input.name,
      description: input.description,
      status: input.status || 'draft',
      trigger: input.trigger,
      actions: input.actions,
      settings: this.getDefaultSettings(input.settings),
      createdBy: userId,
      createdAt: now,
      updatedAt: now,
      stats: this.getDefaultStats(),
      tags: input.tags || [],
    };
    
    // Save to Firestore (use collection path as string)
    const workflowsPath = `${this.dal.getColPath('organizations')}/${input.organizationId}/${this.dal.getSubColPath('workflows')}`;
    
    const docRef = await this.dal.safeAddDoc(
      workflowsPath,
      workflow
    );
    
    const createdWorkflow = { ...workflow, id: docRef.id };
    
    logger.info('Workflow created successfully', {
      workflowId: createdWorkflow.id,
      organizationId: input.organizationId,
    });
    
    return createdWorkflow;
  }
  
  /**
   * Get workflow by ID
   */
  async getWorkflow(
    organizationId: string,
    workflowId: string
  ): Promise<Workflow | null> {
    const workflowsPath = `${this.dal.getColPath('organizations')}/${organizationId}/${this.dal.getSubColPath('workflows')}`;
    
    const docSnap = await this.dal.safeGetDoc<Workflow>(
      workflowsPath,
      workflowId
    );
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { id: workflowId, ...docSnap.data() } as Workflow;
  }
  
  /**
   * Query workflows with filters
   */
  async getWorkflows(
    filters: WorkflowFilterInput
  ): Promise<{ workflows: Workflow[]; total: number }> {
    logger.debug('Querying workflows', filters);
    
    const workflowsCollection = this.dal.getOrgSubCollection(
      filters.organizationId,
      'workflows'
    );
    
    // In production, implement proper Firestore querying with filters
    // For now, return empty array
    // TODO: Implement with Firestore queries
    
    return {
      workflows: [],
      total: 0,
    };
  }
  
  /**
   * Update workflow
   */
  async updateWorkflow(
    organizationId: string,
    workflowId: string,
    updates: UpdateWorkflowInput
  ): Promise<Workflow> {
    logger.info('Updating workflow', {
      organizationId,
      workflowId,
      updates,
    });
    
    const workflow = await this.getWorkflow(organizationId, workflowId);
    
    if (!workflow) {
      throw new Error(`Workflow not found: ${workflowId}`);
    }
    
    const workflowsPath = `${this.dal.getColPath('organizations')}/${organizationId}/${this.dal.getSubColPath('workflows')}`;
    
    const updatedData = {
      ...updates,
      updatedAt: Timestamp.now(),
    };
    
    await this.dal.safeUpdateDoc(
      workflowsPath,
      workflowId,
      updatedData
    );
    
    const updatedWorkflow = { ...workflow, ...updatedData };
    
    logger.info('Workflow updated successfully', {
      workflowId,
      organizationId,
    });
    
    return updatedWorkflow;
  }
  
  /**
   * Update workflow status (activate/pause/archive)
   */
  async setWorkflowStatus(
    organizationId: string,
    workflowId: string,
    status: WorkflowStatus
  ): Promise<Workflow> {
    logger.info('Updating workflow status', {
      organizationId,
      workflowId,
      status,
    });
    
    return this.updateWorkflow(organizationId, workflowId, { status });
  }
  
  /**
   * Delete workflow
   */
  async deleteWorkflow(
    organizationId: string,
    workflowId: string
  ): Promise<void> {
    logger.info('Deleting workflow', {
      organizationId,
      workflowId,
    });
    
    const workflowsPath = `${this.dal.getColPath('organizations')}/${organizationId}/${this.dal.getSubColPath('workflows')}`;
    
    await this.dal.safeDeleteDoc(workflowsPath, workflowId);
    
    logger.info('Workflow deleted successfully', {
      workflowId,
      organizationId,
    });
  }
  
  /**
   * Execute workflow manually
   */
  async executeWorkflow(
    organizationId: string,
    workflowId: string,
    context: Omit<WorkflowExecutionContext, 'organizationId'>
  ): Promise<WorkflowExecutionResult> {
    logger.info('Manually executing workflow', {
      organizationId,
      workflowId,
      dealId: context.dealId,
    });
    
    const fullContext: WorkflowExecutionContext = {
      ...context,
      organizationId,
      triggeredBy: 'manual',
    };
    
    return this.coordinator.executeWorkflowManually(workflowId, fullContext);
  }
  
  /**
   * Get workflow executions
   */
  async getWorkflowExecutions(
    organizationId: string,
    workflowId?: string,
    limit: number = 50
  ): Promise<WorkflowExecution[]> {
    logger.debug('Getting workflow executions', {
      organizationId,
      workflowId,
      limit,
    });
    
    const executionsCollection = this.dal.getOrgSubCollection(
      organizationId,
      'workflow_executions'
    );
    
    // In production, implement proper Firestore querying with filters
    // For now, return empty array
    // TODO: Implement with Firestore queries
    
    return [];
  }
  
  /**
   * Get workflow execution by ID
   */
  async getWorkflowExecution(
    organizationId: string,
    executionId: string
  ): Promise<WorkflowExecution | null> {
    const executionsPath = `${this.dal.getColPath('organizations')}/${organizationId}/${this.dal.getSubColPath('workflow_executions')}`;
    
    const docSnap = await this.dal.safeGetDoc<WorkflowExecution>(
      executionsPath,
      executionId
    );
    
    if (!docSnap.exists()) {
      return null;
    }
    
    return { id: executionId, ...docSnap.data() } as WorkflowExecution;
  }
  
  /**
   * Get workflow statistics
   */
  async getWorkflowStats(
    organizationId: string,
    workflowId: string
  ): Promise<WorkflowStats> {
    const workflow = await this.getWorkflow(organizationId, workflowId);
    
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
      maxExecutionsPerDay: settings?.maxExecutionsPerDay || 100,
      maxExecutionsPerDeal: settings?.maxExecutionsPerDeal || 10,
      cooldownMinutes: settings?.cooldownMinutes || 60,
      executeOnWeekends: settings?.executeOnWeekends ?? true,
      executeOnHolidays: settings?.executeOnHolidays ?? true,
      applyToNewDealsOnly: settings?.applyToNewDealsOnly ?? false,
      dealFilters: settings?.dealFilters || [],
      notifyOnSuccess: settings?.notifyOnSuccess ?? false,
      notifyOnFailure: settings?.notifyOnFailure ?? true,
      notificationRecipients: settings?.notificationRecipients || [],
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
  organizationId: string,
  workflowData: CreateWorkflowInput,
  userId: string,
  workspaceId?: string
): Promise<Workflow> {
  const dal = new BaseAgentDAL(db as any);
  const service = getWorkflowService(dal);
  
  const input: CreateWorkflowInput = {
    ...workflowData,
    organizationId,
    workspaceId: workspaceId || workflowData.workspaceId,
  };
  
  return service.createWorkflow(input, userId);
}

/**
 * Get workflows
 */
export async function getWorkflows(
  organizationId: string,
  workspaceId: string,
  filters?: Record<string, unknown>
): Promise<{ data: Workflow[]; hasMore: boolean }> {
  const dal = new BaseAgentDAL(db as any);
  const service = getWorkflowService(dal);
  
  const result = await service.getWorkflows({
    organizationId,
    workspaceId,
    ...filters,
  } as WorkflowFilterInput);
  
  return {
    data: result.workflows,
    hasMore: false, // TODO: Implement pagination
  };
}

/**
 * Get workflow
 */
export async function getWorkflow(
  organizationId: string,
  workflowId: string,
  workspaceId?: string
): Promise<Workflow | null> {
  const dal = new BaseAgentDAL(db as any);
  const service = getWorkflowService(dal);
  
  return service.getWorkflow(organizationId, workflowId);
}

/**
 * Update workflow
 */
export async function updateWorkflow(
  organizationId: string,
  workflowId: string,
  updates: UpdateWorkflowInput,
  workspaceId?: string
): Promise<Workflow> {
  const dal = new BaseAgentDAL(db as any);
  const service = getWorkflowService(dal);
  
  return service.updateWorkflow(organizationId, workflowId, updates);
}

/**
 * Set workflow status
 */
export async function setWorkflowStatus(
  organizationId: string,
  workflowId: string,
  status: WorkflowStatus,
  workspaceId?: string
): Promise<Workflow> {
  const dal = new BaseAgentDAL(db as any);
  const service = getWorkflowService(dal);
  
  return service.setWorkflowStatus(organizationId, workflowId, status);
}

/**
 * Delete workflow
 */
export async function deleteWorkflow(
  organizationId: string,
  workflowId: string,
  workspaceId?: string
): Promise<void> {
  const dal = new BaseAgentDAL(db as any);
  const service = getWorkflowService(dal);
  
  return service.deleteWorkflow(organizationId, workflowId);
}
