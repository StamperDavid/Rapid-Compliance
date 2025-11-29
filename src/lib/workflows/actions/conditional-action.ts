/**
 * Conditional Action Executor
 * Executes conditional logic in workflows
 */

import type { ConditionalBranchAction, WorkflowCondition, WorkflowAction } from '@/types/workflow';

/**
 * Execute conditional action
 */
export async function executeConditionalAction(
  action: ConditionalBranchAction,
  triggerData: any,
  workflow: any,
  organizationId: string
): Promise<any> {
  // Evaluate all branches
  let matchedBranch: ConditionalBranchAction['branches'][0] | null = null;
  
  for (const branch of action.branches) {
    const conditionsMet = await evaluateConditions(branch.conditions, triggerData, branch.conditionOperator);
    if (conditionsMet) {
      matchedBranch = branch;
      break;
    }
  }
  
  // Execute matched branch or default branch
  const actionsToExecute = matchedBranch ? matchedBranch.actions : (action.defaultBranch || []);
  const conditionMet = matchedBranch !== null;
  
  if (!actionsToExecute || actionsToExecute.length === 0) {
    return {
      conditionMet,
      executed: false,
      message: `No actions defined for ${conditionMet ? 'matched' : 'default'} branch`,
    };
  }
  
  // Execute actions in sequence
  const { executeWorkflow } = await import('@/lib/workflows/workflow-engine');
  const results = [];
  
  for (const subAction of actionsToExecute) {
    try {
      const result = await executeAction(subAction, triggerData, workflow, organizationId);
      results.push({
        actionId: subAction.id,
        success: true,
        result,
      });
    } catch (error: any) {
      results.push({
        actionId: subAction.id,
        success: false,
        error: error.message,
      });
      // Stop on first error (can be made configurable)
      break;
    }
  }
  
  return {
    conditionMet: matchedBranch !== null,
    executed: true,
    results,
  };
}

/**
 * Evaluate conditions
 */
async function evaluateConditions(
  conditions: WorkflowCondition[],
  triggerData: any,
  operator: 'and' | 'or'
): Promise<boolean> {
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
function evaluateCondition(condition: WorkflowCondition, triggerData: any): boolean {
  // Get value based on source
  let fieldValue: any;
  
  switch (condition.source) {
    case 'trigger_data':
      fieldValue = getNestedValue(triggerData, condition.field);
      break;
    case 'entity':
      // TODO: Query entity
      fieldValue = null;
      break;
    case 'variable':
      // TODO: Get from workflow variables
      fieldValue = null;
      break;
    case 'date':
      fieldValue = new Date();
      break;
    default:
      fieldValue = null;
  }
  
  // Compare
  switch (condition.operator) {
    case 'equals':
      return fieldValue === condition.value;
    case 'not_equals':
      return fieldValue !== condition.value;
    case 'contains':
      return String(fieldValue).includes(String(condition.value));
    case 'greater_than':
      return Number(fieldValue) > Number(condition.value);
    case 'less_than':
      return Number(fieldValue) < Number(condition.value);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null;
    default:
      return false;
  }
}

/**
 * Execute a single action (helper)
 */
async function executeAction(
  action: WorkflowAction,
  triggerData: any,
  workflow: any,
  organizationId: string
): Promise<any> {
  // Import action executors
  const { executeEmailAction } = await import('./email-action');
  const { executeSMSAction } = await import('./sms-action');
  const { executeEntityAction } = await import('./entity-action');
  const { executeHTTPAction } = await import('./http-action');
  const { executeDelayAction } = await import('./delay-action');
  
  switch (action.type) {
    case 'send_email':
      return executeEmailAction(action, triggerData, organizationId);
    case 'send_sms':
      return executeSMSAction(action, triggerData, organizationId);
    case 'create_entity':
    case 'update_entity':
    case 'delete_entity':
      return executeEntityAction(action, triggerData, organizationId);
    case 'http_request':
      return executeHTTPAction(action, triggerData);
    case 'delay':
      return executeDelayAction(action, triggerData);
    default:
      throw new Error(`Unknown action type: ${action.type}`);
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

