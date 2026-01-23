/**
 * Workflow Execution Engine
 * Handles workflow triggers, conditions, and actions
 * Production implementation with all action types supported
 */

import type {
  Workflow,
  WorkflowAction,
  WorkflowCondition,
  WorkflowTriggerData,
  SendEmailAction,
  SendSMSAction,
  CreateEntityAction,
  UpdateEntityAction,
  DeleteEntityAction,
  HTTPRequestAction,
  DelayAction,
  ConditionalBranchAction,
  SendSlackAction,
  LoopAction,
  AIAgentAction,
  CreateTaskAction
} from '@/types/workflow';
import { where, orderBy, limit as firestoreLimit } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

export interface WorkflowEngineExecution {
  id: string;
  workflowId: string;
  triggerId: string;
  triggerData: WorkflowTriggerData;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: Date;
  completedAt?: Date;
  error?: string;
  actionResults: Array<{
    actionId: string;
    status: 'success' | 'failed' | 'skipped';
    result?: unknown;
    error?: string;
  }>;
}

interface FirestoreWorkflowEngineExecution {
  id: string;
  workflowId: string;
  triggerId: string;
  triggerData: WorkflowTriggerData;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  startedAt: string;
  completedAt?: string;
  error?: string;
  actionResults: Array<{
    actionId: string;
    status: 'success' | 'failed' | 'skipped';
    result?: unknown;
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
  triggerData: WorkflowTriggerData
): Promise<WorkflowEngineExecution> {
  const executionId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const execution: WorkflowEngineExecution = {
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
      const conditionsMet = evaluateConditions(workflow.conditions, triggerData, workflow.conditionOperator ?? 'and');
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
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        execution.actionResults.push({
          actionId: action.id,
          status: 'failed',
          error: errorMessage,
        });
        
        // Stop execution if action fails and workflow is set to stop on error
        if (workflow.settings.onError === 'stop') {
          execution.status = 'failed';
          execution.error = `Action ${action.name} failed: ${errorMessage}`;
          execution.completedAt = new Date();
          return execution;
        }
      }
    }

    execution.status = 'completed';
    execution.completedAt = new Date();

    // Store execution in Firestore
    const orgId = triggerData?.organizationId ?? workflow.organizationId;
    const workspaceId = triggerData?.workspaceId ?? workflow.workspaceId;
    
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
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    execution.status = 'failed';
    execution.error = errorMessage;
    execution.completedAt = new Date();
    return execution;
  }
}

/**
 * Evaluate workflow conditions
 * Evaluates conditions against trigger data with AND/OR logic
 */
function evaluateConditions(
  conditions: WorkflowCondition[],
  triggerData: WorkflowTriggerData,
  operator: 'and' | 'or'
): boolean {
  const results = conditions.map(condition => evaluateCondition(condition, triggerData));

  if (operator === 'and') {
    return results.every(r => r);
  } else {
    return results.some(r => r);
  }
}

/**
 * Evaluate single condition
 */
function evaluateCondition(condition: WorkflowCondition, triggerData: WorkflowTriggerData): boolean {
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
  triggerData: WorkflowTriggerData,
  workflow: Workflow
): Promise<unknown> {
  const organizationId = triggerData?.organizationId ?? workflow.workspaceId;

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
      return executeEmailAction(action as SendEmailAction, triggerData, organizationId);

    case 'send_sms':
      return executeSMSAction(action as SendSMSAction, triggerData, organizationId);

    case 'create_entity':
    case 'update_entity':
    case 'delete_entity':
      return executeEntityAction(
        action as CreateEntityAction | UpdateEntityAction | DeleteEntityAction,
        triggerData,
        organizationId
      );

    case 'http_request':
      return executeHTTPAction(action as HTTPRequestAction, triggerData);

    case 'delay':
      return executeDelayAction(action as DelayAction, triggerData);

    case 'conditional_branch':
      return executeConditionalAction(action as ConditionalBranchAction, triggerData, workflow, organizationId);

    case 'send_slack':
      return executeSlackAction(convertToSlackConfig(action as SendSlackAction), triggerData, organizationId);

    case 'loop':
      return executeLoopAction(convertToLoopConfig(action as LoopAction), triggerData, workflow, organizationId);

    case 'ai_agent':
      return executeAIAgentAction(convertToAIAgentConfig(action as AIAgentAction), triggerData, organizationId);

    case 'cloud_function':
      // Cloud functions are called via HTTP action with the function URL
      logger.warn('[Workflow Engine] Cloud function actions should use http_request with function URL', { file: 'workflow-engine.ts' });
      throw new Error('Cloud Function action: Use http_request with your function URL instead');

    case 'create_task': {
      const taskAction = action as CreateTaskAction;
      // Create task is handled as entity action
      return executeEntityAction({
        ...taskAction,
        type: 'create_entity',
        schemaId: 'tasks',
        fieldMappings: [
          { targetField: 'assignTo', source: 'static', staticValue: taskAction.assignTo },
          { targetField: 'title', source: 'static', staticValue: taskAction.title },
          { targetField: 'description', source: 'static', staticValue: taskAction.description },
          { targetField: 'dueDate', source: 'static', staticValue: taskAction.dueDate },
          { targetField: 'priority', source: 'static', staticValue: taskAction.priority },
        ],
      } as CreateEntityAction, triggerData, organizationId);
    }

    default: {
      const exhaustiveCheck: never = action;
      throw new Error(`Unknown action type: ${(exhaustiveCheck as WorkflowAction).type}`);
    }
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: WorkflowTriggerData, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) =>
    (current as Record<string, unknown>)?.[key], obj);
}

/**
 * Convert SendSlackAction to SlackActionConfig format
 */
function convertToSlackConfig(action: SendSlackAction): {
  type: 'send_slack';
  id: string;
  name: string;
  continueOnError: boolean;
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoffMultiplier: number;
  };
  config: {
    channelId?: string;
    channelName?: string;
    message: string;
    blocks?: unknown[];
    unfurlLinks?: boolean;
    unfurlMedia?: boolean;
  };
} {
  return {
    type: 'send_slack',
    id: action.id,
    name: action.name,
    continueOnError: action.continueOnError,
    retry: action.retry,
    config: {
      channelName: action.channel,
      message: action.message,
      blocks: action.blocks,
      unfurlLinks: true,
      unfurlMedia: true,
    },
  };
}

/**
 * Convert LoopAction to LoopActionConfig format
 */
function convertToLoopConfig(action: LoopAction): {
  type: 'loop';
  id: string;
  name: string;
  continueOnError: boolean;
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoffMultiplier: number;
  };
  config: {
    arrayField: string;
    itemVariable?: string;
    indexVariable?: string;
    maxIterations?: number;
    continueOnError?: boolean;
    actions: WorkflowAction[];
    batchSize?: number;
    delayBetweenItems?: number;
  };
} {
  // Determine array field based on iterateOver type
  let arrayField = '';
  if (action.iterateOver === 'array_field' && action.arrayField) {
    arrayField = action.arrayField;
  } else if (action.iterateOver === 'query_results') {
    // Query results will be stored in a special field
    arrayField = '_queryResults';
  } else if (action.iterateOver === 'range') {
    // Range will be converted to an array
    arrayField = '_rangeArray';
  }

  return {
    type: 'loop',
    id: action.id,
    name: action.name,
    continueOnError: action.continueOnError,
    retry: action.retry,
    config: {
      arrayField,
      itemVariable: 'item',
      indexVariable: 'index',
      maxIterations: action.maxIterations,
      continueOnError: action.continueOnError,
      actions: action.actions,
      batchSize: 1,
      delayBetweenItems: 0,
    },
  };
}

/**
 * Convert AIAgentAction to AIAgentActionConfig format
 */
function convertToAIAgentConfig(action: AIAgentAction): {
  type: 'ai_agent';
  id: string;
  name: string;
  continueOnError: boolean;
  retry?: {
    enabled: boolean;
    maxAttempts: number;
    backoffMultiplier: number;
  };
  config: {
    prompt: string;
    model?: string;
    storeResult?: boolean;
    resultField?: string;
    maxTokens?: number;
    temperature?: number;
    systemPrompt?: string;
    useKnowledgeBase?: boolean;
    responseFormat?: 'text' | 'json';
  };
} {
  return {
    type: 'ai_agent',
    id: action.id,
    name: action.name,
    continueOnError: action.continueOnError,
    retry: action.retry,
    config: {
      prompt: action.prompt,
      storeResult: true,
      resultField: action.saveResponseAs,
      useKnowledgeBase: true,
      responseFormat: 'text',
    },
  };
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
    
    default: {
      const unknownTrigger = workflow.trigger as { type: string };
      logger.warn(`Unknown trigger type: ${unknownTrigger.type}`, { file: 'workflow-engine.ts' });
    }
  }

  logger.info(`Workflow Engine: Registered trigger for workflow ${workflow.id}`, { file: 'workflow-engine.ts' });
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

  logger.info(`Workflow Engine: Unregistered trigger for workflow ${workflowId}`, { file: 'workflow-engine.ts' });
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
): Promise<WorkflowEngineExecution[]> {
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

  // Convert Firestore data back to WorkflowEngineExecution format
  return executions.map((e): WorkflowEngineExecution => {
    const firestoreExec = e as unknown as FirestoreWorkflowEngineExecution;
    return {
      ...firestoreExec,
      status: firestoreExec.status,
      startedAt: new Date(firestoreExec.startedAt),
      completedAt: firestoreExec.completedAt ? new Date(firestoreExec.completedAt) : undefined,
      actionResults: firestoreExec.actionResults.map(ar => ({
        ...ar,
        status: ar.status,
      })),
    };
  });
}

/**
 * Test workflow execution
 * Executes workflow with test data for validation purposes
 */
export async function testWorkflowExecution(
  workflow: Workflow,
  testData: WorkflowTriggerData
): Promise<WorkflowEngineExecution> {
  return executeWorkflowImpl(workflow, testData);
}



