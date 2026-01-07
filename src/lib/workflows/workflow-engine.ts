/**
 * Workflow Execution Engine
 * Handles workflow triggers, conditions, and actions
 * Production implementation with all action types supported
 */

import { WorkflowTrigger, type Workflow, type WorkflowAction, type WorkflowCondition } from '@/types/workflow';
import { where, orderBy, limit as firestoreLimit } from 'firebase/firestore'
import { logger } from '@/lib/logger/logger';

export interface WorkflowExecution {
  id: string;
  workflowId: string;
  triggerId: string;
  triggerData: any;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  actionResults: Array<{
    actionId: string;
    status: 'success' | 'failed' | 'skipped';
    result?: any;
    error?: string;
  }>;
}

/**
 * Execute workflow implementation
 * Executes workflows with real action implementations
 * Renamed to Impl to avoid circular dependency with triggers
 */
export async function executeWorkflowImpl(
  workflow: Workflow,
  triggerData: any
): Promise<WorkflowExecution> {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const execution: WorkflowExecution = {
    id: executionId,
    workflowId: workflow.id,
    triggerId: workflow.trigger.id,
    triggerData,
    status: 'running',
    startedAt: new Date(),
    actionResults: [],
  };

  try {
    // Check conditions before executing
    if (workflow.conditions && workflow.conditions.length > 0) {
      const conditionsMet = await evaluateConditions(workflow.conditions, triggerData, workflow.conditionOperator || 'and');
      if (!conditionsMet) {
        execution.status = 'completed';
        execution.completedAt = new Date();
        return execution;
      }
    }

    // Execute actions sequentially
    for (const action of workflow.actions) {
      try {
        const result = await executeAction(action, triggerData, workflow);
        execution.actionResults.push({
          actionId: action.id,
          status: 'success',
          result,
        });
      } catch (error: any) {
        execution.actionResults.push({
          actionId: action.id,
          status: 'failed',
          error: error.message,
        });
        
        // Stop execution if action fails and workflow is set to stop on error
        if (workflow.settings.onError === 'stop') {
          execution.status = 'failed';
          execution.error = `Action ${action.name} failed: ${error.message}`;
          execution.completedAt = new Date();
          return execution;
        }
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date();

    // Store execution in Firestore
    const orgId = triggerData?.organizationId || (workflow as any).organizationId;
    const workspaceId = triggerData?.workspaceId || (workflow as any).workspaceId;
    
    if (orgId && workspaceId) {
      const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
      await FirestoreService.set(
        `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflowExecutions`,
        execution.id,
        {
          ...execution,
          startedAt: execution.startedAt.toISOString(),
          completedAt: execution.completedAt?.toISOString(),
        }
      );
    }

    return execution;
  } catch (error: any) {
    execution.status = 'failed';
    execution.error = error.message;
    execution.completedAt = new Date();
    return execution;
  }
}

/**
 * Evaluate workflow conditions
 * Evaluates conditions against trigger data with AND/OR logic
 */
async function evaluateConditions(
  conditions: WorkflowCondition[],
  triggerData: any,
  operator: 'and' | 'or'
): Promise<boolean> {
  const results = await Promise.all(
    conditions.map(condition => evaluateCondition(condition, triggerData))
  );

  if (operator === 'and') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

/**
 * Evaluate single condition
 */
function evaluateCondition(condition: WorkflowCondition, triggerData: any): boolean {
  const fieldValue = getNestedValue(triggerData, condition.field);
  
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'not_equals':
      return fieldValue !== condition.value;
    case 'contains':
      return String(fieldValue).includes(String(condition.value));
    case 'not_contains':
      return !String(fieldValue).includes(String(condition.value));
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);
    case 'less_than':
      return Number(fieldValue) < Number(condition.value);
    case 'greater_than_or_equal':
      return Number(fieldValue) >= Number(condition.value);
    case 'less_than_or_equal':
      return Number(fieldValue) <= Number(condition.value);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    case 'not_exists':
      return fieldValue === undefined || fieldValue === null;
    default:
      return false;
  }
}

/**
 * Execute workflow action using real service implementations
 */
async function executeAction(
  action: WorkflowAction,
  triggerData: any,
  workflow: Workflow
): Promise<any> {
  const organizationId = triggerData?.organizationId || workflow.workspaceId;
  
  if (!organizationId) {
    throw new Error('Organization ID required for workflow execution');
  }
  
  // Import action executors
  const { executeEmailAction } = await import('./actions/email-action');
  const { executeSMSAction } = await import('./actions/sms-action');
  const { executeEntityAction } = await import('./actions/entity-action');
  const { executeHTTPAction } = await import('./actions/http-action');
  const { executeDelayAction } = await import('./actions/delay-action');
  const { executeConditionalAction } = await import('./actions/conditional-action');
  const { executeAIAgentAction } = await import('./actions/ai-agent-action');
  const { executeSlackAction } = await import('./actions/slack-action');
  const { executeLoopAction } = await import('./actions/loop-action');
  
  switch (action.type) {
    case 'send_email':
      return executeEmailAction(action as any, triggerData, organizationId);
    
    case 'send_sms':
      return executeSMSAction(action as any, triggerData, organizationId);
    
    case 'create_entity':
    case 'update_entity':
    case 'delete_entity':
      return executeEntityAction(action as any, triggerData, organizationId);
    
    case 'http_request':
      return executeHTTPAction(action as any, triggerData);
    
    case 'delay':
      return executeDelayAction(action as any, triggerData);
    
    case 'conditional_branch':
      return executeConditionalAction(action as any, triggerData, workflow, organizationId);
    
    case 'send_slack':
      return executeSlackAction(action as any, triggerData, organizationId);
    
    case 'loop':
      return executeLoopAction(action as any, triggerData, workflow, organizationId);
    
    case 'ai_agent':
      return executeAIAgentAction(action as any, triggerData, organizationId);
    
    case 'cloud_function':
      // Cloud functions are called via HTTP action with the function URL
      logger.warn('[Workflow Engine] Cloud function actions should use http_request with function URL', { file: 'workflow-engine.ts' });
      throw new Error('Cloud Function action: Use http_request with your function URL instead');
    
    case 'create_task':
      // Create task is handled as entity action
      return executeEntityAction({
        ...action,
        type: 'create_entity',
        config: {
          ...((action as any).config ?? {}),
          entityType: 'tasks',
        }
      } as any, triggerData, organizationId);
    
    default:
      throw new Error(`Unknown action type: ${(action as any).type}`);
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

/**
 * Register workflow trigger listener
 * REAL: Sets up trigger listeners based on trigger type
 */
export async function registerWorkflowTrigger(
  workflow: Workflow,
  organizationId: string,
  workspaceId: string
): Promise<void> {
  const { registerFirestoreTrigger } = await import('./triggers/firestore-trigger');
  const { registerWebhookTrigger } = await import('./triggers/webhook-trigger');
  const { registerScheduleTrigger } = await import('./triggers/schedule-trigger');
  
  switch (workflow.trigger.type) {
    case 'entity.created':
    case 'entity.updated':
    case 'entity.deleted':
      await registerFirestoreTrigger(workflow, organizationId, workspaceId);
      break;
    
    case 'webhook':
      await registerWebhookTrigger(workflow, organizationId, workspaceId);
      break;
    
    case 'schedule':
      await registerScheduleTrigger(workflow, organizationId, workspaceId);
      break;
    
    case 'manual':
    case 'ai_agent':
    case 'form.submitted':
    case 'email.received':
      // These don't need registration
      break;
    
    default:
      logger.warn('Unknown trigger type: ${(workflow.trigger as any).type}', { file: 'workflow-engine.ts' });
  }
  
  logger.info('Workflow Engine Registered trigger for workflow workflow.id}', { file: 'workflow-engine.ts' });
}

/**
 * Unregister workflow trigger listener
 */
export async function unregisterWorkflowTrigger(
  workflowId: string,
  organizationId: string,
  workspaceId: string
): Promise<void> {
  const { unregisterFirestoreTrigger } = await import('./triggers/firestore-trigger');
  const { unregisterScheduleTrigger } = await import('./triggers/schedule-trigger');
  
  // Unregister all trigger types (safe to call even if not registered)
  await Promise.all([
    unregisterFirestoreTrigger(workflowId, organizationId, workspaceId).catch(() => {}),
    unregisterScheduleTrigger(workflowId, organizationId, workspaceId).catch(() => {}),
  ]);
  
  logger.info('Workflow Engine Unregistered trigger for workflow workflowId}', { file: 'workflow-engine.ts' });
}

/**
 * Get workflow execution history
 * Queries Firestore for historical workflow executions
 */
export async function getWorkflowExecutions(
  workflowId: string,
  organizationId: string,
  workspaceId: string,
  limit: number = 50
): Promise<WorkflowExecution[]> {
  // Load executions from Firestore
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  const executions = await FirestoreService.getAll(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/workflowExecutions`,
    [
      where('workflowId', '==', workflowId),
      orderBy('startedAt', 'desc'),
      firestoreLimit(limit),
    ]
  );
  
  // Convert Firestore data back to WorkflowExecution format
  return executions.map((e: any) => ({
    ...e,
    startedAt: new Date(e.startedAt),
    completedAt: e.completedAt ? new Date(e.completedAt) : undefined,
  })) as WorkflowExecution[];
}

/**
 * Test workflow execution
 * Executes workflow with test data for validation purposes
 */
export async function testWorkflowExecution(
  workflow: Workflow,
  testData: any
): Promise<WorkflowExecution> {
  return executeWorkflowImpl(workflow, testData);
}



