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
  const actionsToExecute = matchedBranch ? matchedBranch.actions : (action.defaultBranch ?? []);
  const conditionMet = matchedBranch !== null;
  
  if (!actionsToExecute || actionsToExecute.length === 0) {
    return {
      conditionMet,
      executed: false,
      message: `No actions defined for ${conditionMet ? 'matched' : 'default'} branch`,
    };
  }
  
  // Execute actions in sequence
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
    case 'trigger_data': {
      fieldValue = getNestedValue(triggerData, condition.field);
      break;
    }
    case 'entity': {
      // Query entity from trigger data context
      // The entity data should be populated in triggerData.entity or triggerData.entities
      const entityData =triggerData?.entity ?? triggerData?.record ?? triggerData;
      fieldValue = getNestedValue(entityData, condition.field);
      break;
    }
    case 'variable': {
      // Get from workflow variables stored in triggerData._variables
      const variables = (triggerData?._variables ?? triggerData?.variables) ?? {};
      fieldValue = getNestedValue(variables, condition.field);
      break;
    }
    case 'date': {
      // Handle date comparisons
      if (condition.field === 'now') {
        fieldValue = new Date();
      } else if (condition.field === 'today') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        fieldValue = today;
      } else {
        fieldValue = new Date(getNestedValue(triggerData, condition.field));
      }
      break;
    }
    default: {
      fieldValue = null;
    }
  }
  
  // Compare based on operator
  switch (condition.operator) {
    case 'equals':
      // Handle date comparison
      if (fieldValue instanceof Date && condition.value) {
        const compareDate = new Date(condition.value as string);
        return fieldValue.getTime() === compareDate.getTime();
      }
      return fieldValue === condition.value;
    case 'not_equals':
      return fieldValue !== condition.value;
    case 'contains':
      return String(fieldValue ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase());
    case 'not_contains':
      return !String(fieldValue ?? '').toLowerCase().includes(String(condition.value ?? '').toLowerCase());
    case 'greater_than':
      if (fieldValue instanceof Date && condition.value) {
        return fieldValue.getTime() > new Date(condition.value as string).getTime();
      }
      return Number(fieldValue) > Number(condition.value);
    case 'less_than':
      if (fieldValue instanceof Date && condition.value) {
        return fieldValue.getTime() < new Date(condition.value as string).getTime();
      }
      return Number(fieldValue) < Number(condition.value);
    case 'greater_than_or_equal':
      return Number(fieldValue) >= Number(condition.value);
    case 'less_than_or_equal':
      return Number(fieldValue) <= Number(condition.value);
    case 'exists':
      return fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
    case 'not_exists':
      return fieldValue === undefined || fieldValue === null || fieldValue === '';
    case 'starts_with':
      return String(fieldValue ?? '').toLowerCase().startsWith(String(condition.value ?? '').toLowerCase());
    case 'ends_with':
      return String(fieldValue ?? '').toLowerCase().endsWith(String(condition.value ?? '').toLowerCase());
    case 'in': {
      const inArray = Array.isArray(condition.value) ? condition.value : String(condition.value).split(',');
      return inArray.includes(fieldValue);
    }
    case 'not_in': {
      const notInArray = Array.isArray(condition.value) ? condition.value : String(condition.value).split(',');
      return !notInArray.includes(fieldValue);
    }
    case 'is_empty':
      return !fieldValue || (Array.isArray(fieldValue) && fieldValue.length === 0);
    case 'is_not_empty':
      return fieldValue && (!Array.isArray(fieldValue) || fieldValue.length > 0);
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
    case 'send_email': {
      return executeEmailAction(action, triggerData, organizationId);
    }
    case 'send_sms': {
      return executeSMSAction(action, triggerData, organizationId);
    }
    case 'create_entity':
    case 'update_entity':
    case 'delete_entity': {
      return executeEntityAction(action, triggerData, organizationId);
    }
    case 'http_request': {
      return executeHTTPAction(action, triggerData);
    }
    case 'delay': {
      return executeDelayAction(action, triggerData);
    }
    default: {
      throw new Error(`Unknown action type: ${action.type}`);
    }
  }
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

