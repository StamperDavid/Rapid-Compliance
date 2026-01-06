/**
 * Loop Workflow Action
 * Iterates over arrays and executes actions for each item
 */

import type { BaseAction, WorkflowAction, Workflow } from '@/types/workflow';

export interface LoopActionConfig extends BaseAction {
  type: 'loop';
  config: {
    arrayField: string;           // Dot-notation path to array in triggerData
    itemVariable?: string;        // Variable name for current item (default: 'item')
    indexVariable?: string;       // Variable name for current index (default: 'index')
    maxIterations?: number;       // Safety limit (default: 100)
    continueOnError?: boolean;    // Continue if action fails (default: true)
    actions: WorkflowAction[];    // Actions to execute for each item
    batchSize?: number;           // Process items in batches (default: 1)
    delayBetweenItems?: number;   // Delay in ms between items (default: 0)
  };
}

export interface LoopResult {
  success: boolean;
  totalItems: number;
  processed: number;
  successful: number;
  failed: number;
  results: Array<{
    index: number;
    item: any;
    success: boolean;
    result?: any;
    error?: string;
  }>;
}

export async function executeLoopAction(
  action: LoopActionConfig,
  triggerData: any,
  workflow: Workflow,
  organizationId: string
): Promise<LoopResult> {
  const {
    arrayField,
    itemVariable = 'item',
    indexVariable = 'index',
    maxIterations = 100,
    continueOnError = true,
    actions,
    batchSize = 1,
    delayBetweenItems = 0,
  } = action.config;

  // Get the array from trigger data
  const array = getNestedValue(triggerData, arrayField);

  if (!Array.isArray(array)) {
    throw new Error(`Loop action: '${arrayField}' is not an array or does not exist`);
  }

  // Apply max iterations limit
  const itemsToProcess = array.slice(0, maxIterations);
  
  const result: LoopResult = {
    success: true,
    totalItems: array.length,
    processed: 0,
    successful: 0,
    failed: 0,
    results: [],
  };

  // Process items
  for (let i = 0; i < itemsToProcess.length; i += batchSize) {
    const batch = itemsToProcess.slice(i, i + batchSize);
    
    // Process batch in parallel
    const batchPromises = batch.map(async (item, batchIndex) => {
      const itemIndex = i + batchIndex;
      
      // Create item context
      const itemContext = {
        ...triggerData,
        [itemVariable]: item,
        [indexVariable]: itemIndex,
        _loop: {
          item,
          index: itemIndex,
          total: itemsToProcess.length,
          isFirst: itemIndex === 0,
          isLast: itemIndex === itemsToProcess.length - 1,
        },
      };

      try {
        // Execute all actions for this item
        const actionResults = await executeWorkflowActions(
          actions,
          itemContext,
          workflow,
          organizationId
        );

        const itemSuccess = actionResults.every(r => r.status === 'success');
        
        result.processed++;
        if (itemSuccess) {
          result.successful++;
        } else {
          result.failed++;
          if (!continueOnError) {
            result.success = false;
          }
        }

        return {
          index: itemIndex,
          item,
          success: itemSuccess,
          result: actionResults,
        };
      } catch (error: any) {
        result.processed++;
        result.failed++;
        
        if (!continueOnError) {
          result.success = false;
          throw error;
        }

        return {
          index: itemIndex,
          item,
          success: false,
          error: error.message,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    result.results.push(...batchResults);

    // Add delay between batches (not after last batch)
    if (delayBetweenItems > 0 && i + batchSize < itemsToProcess.length) {
      await new Promise(resolve => setTimeout(resolve, delayBetweenItems));
    }
  }

  // Mark as failed if any items failed and continueOnError is false
  if (result.failed > 0 && !continueOnError) {
    result.success = false;
  }

  return result;
}

/**
 * Execute workflow actions (helper for loop)
 */
async function executeWorkflowActions(
  actions: WorkflowAction[],
  triggerData: any,
  workflow: Workflow,
  organizationId: string
): Promise<Array<{ actionId: string; status: string; result?: any; error?: string }>> {
  // Import action executors
  const { executeEmailAction } = await import('./email-action');
  const { executeSMSAction } = await import('./sms-action');
  const { executeEntityAction } = await import('./entity-action');
  const { executeHTTPAction } = await import('./http-action');
  const { executeDelayAction } = await import('./delay-action');
  const { executeConditionalAction } = await import('./conditional-action');
  const { executeAIAgentAction } = await import('./ai-agent-action');
  const { executeSlackAction } = await import('./slack-action');

  const results: Array<{ actionId: string; status: string; result?: any; error?: string }> = [];

  for (const action of actions) {
    try {
      let result: any;

      switch (action.type) {
        case 'send_email':
          result = await executeEmailAction(action as any, triggerData, organizationId);
          break;
        case 'send_sms':
          result = await executeSMSAction(action as any, triggerData, organizationId);
          break;
        case 'create_entity':
        case 'update_entity':
        case 'delete_entity':
          result = await executeEntityAction(action as any, triggerData, organizationId);
          break;
        case 'http_request':
          result = await executeHTTPAction(action as any, triggerData);
          break;
        case 'delay':
          result = await executeDelayAction(action as any, triggerData);
          break;
        case 'conditional_branch':
          result = await executeConditionalAction(action as any, triggerData, workflow, organizationId);
          break;
        case 'ai_agent':
          result = await executeAIAgentAction(action as any, triggerData, organizationId);
          break;
        case 'send_slack':
          result = await executeSlackAction(action as any, triggerData, organizationId);
          break;
        default:
          throw new Error(`Unknown action type: ${action.type}`);
      }

      results.push({
        actionId: action.id,
        status: 'success',
        result,
      });
    } catch (error: any) {
      results.push({
        actionId: action.id,
        status: 'failed',
        error: error.message,
      });
      throw error; // Re-throw to be caught by loop
    }
  }

  return results;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}


