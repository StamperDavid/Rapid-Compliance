/**
 * Loop Workflow Action
 * Iterates over arrays and executes actions for each item
 */

import type {
  BaseAction,
  WorkflowAction,
  Workflow,
  WorkflowTriggerData,
} from '@/types/workflow';

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
    item: unknown;
    success: boolean;
    result?: unknown;
    error?: string;
  }>;
}

export async function executeLoopAction(
  action: LoopActionConfig,
  triggerData: WorkflowTriggerData,
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
      const itemContext: WorkflowTriggerData = {
        ...triggerData,
        [itemVariable]: item as unknown,
        [indexVariable]: itemIndex as unknown,
        _loop: {
          item: item as unknown,
          index: itemIndex,
          total: itemsToProcess.length,
          isFirst: itemIndex === 0,
          isLast: itemIndex === itemsToProcess.length - 1,
        } as unknown,
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
          item: item as unknown,
          success: itemSuccess,
          result: actionResults as unknown,
        };
      } catch (error: unknown) {
        result.processed++;
        result.failed++;

        if (!continueOnError) {
          result.success = false;
          throw error;
        }

        const errorMessage = error instanceof Error ? error.message : String(error);

        return {
          index: itemIndex,
          item: item as unknown,
          success: false,
          error: errorMessage,
        };
      }
    });

    const batchResults = await Promise.all(batchPromises);
    result.results.push(...batchResults);

    // Add delay between batches (not after last batch)
    if (delayBetweenItems > 0 && i + batchSize < itemsToProcess.length) {
      await new Promise<void>(resolve => {
        setTimeout(() => resolve(), delayBetweenItems);
      });
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
  triggerData: WorkflowTriggerData,
  workflow: Workflow,
  organizationId: string
): Promise<Array<{ actionId: string; status: string; result?: unknown; error?: string }>> {
  // Import action executors
  const { executeEmailAction } = await import('./email-action');
  const { executeSMSAction } = await import('./sms-action');
  const { executeEntityAction } = await import('./entity-action');
  const { executeHTTPAction } = await import('./http-action');
  const { executeDelayAction } = await import('./delay-action');
  const { executeConditionalAction } = await import('./conditional-action');
  const { executeAIAgentAction } = await import('./ai-agent-action');
  const { executeSlackAction } = await import('./slack-action');

  const results: Array<{ actionId: string; status: string; result?: unknown; error?: string }> = [];

  for (const action of actions) {
    try {
      let result: unknown;

      if (action.type === 'send_email') {
        result = await executeEmailAction(action, triggerData, organizationId);
      } else if (action.type === 'send_sms') {
        result = await executeSMSAction(action, triggerData, organizationId);
      } else if (action.type === 'create_entity' || action.type === 'update_entity' || action.type === 'delete_entity') {
        result = await executeEntityAction(action, triggerData, organizationId);
      } else if (action.type === 'http_request') {
        result = await executeHTTPAction(action, triggerData);
      } else if (action.type === 'delay') {
        result = await executeDelayAction(action, triggerData);
      } else if (action.type === 'conditional_branch') {
        result = await executeConditionalAction(action, triggerData, workflow, organizationId);
      } else if (action.type === 'ai_agent') {
        result = await executeAIAgentAction(convertToAIAgentConfig(action), triggerData, organizationId);
      } else if (action.type === 'send_slack') {
        result = await executeSlackAction(convertToSlackConfig(action), triggerData, organizationId);
      } else {
        throw new Error(`Unknown action type: ${action.type}`);
      }

      results.push({
        actionId: action.id,
        status: 'success',
        result,
      });
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);

      results.push({
        actionId: action.id,
        status: 'failed',
        error: errorMessage,
      });
      throw error; // Re-throw to be caught by loop
    }
  }

  return results;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: WorkflowTriggerData | Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) =>
    (current as Record<string, unknown>)?.[key], obj);
}

/**
 * Convert AIAgentAction to AIAgentActionConfig format
 */
function convertToAIAgentConfig(action: WorkflowAction): BaseAction & {
  type: 'ai_agent';
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
  if (action.type !== 'ai_agent') {
    throw new Error('Action is not an AI agent action');
  }

  const agentAction = action as unknown as {
    id: string;
    name: string;
    type: 'ai_agent';
    continueOnError: boolean;
    retry?: {
      enabled: boolean;
      maxAttempts: number;
      backoffMultiplier: number;
    };
    agentId?: string;
    prompt?: string;
    context?: Record<string, unknown>;
    saveResponseAs?: string;
  };

  return {
    type: 'ai_agent',
    id: action.id,
    name: action.name,
    continueOnError: agentAction.continueOnError,
    retry: agentAction.retry,
    config: {
      prompt: agentAction.prompt ?? '',
      resultField: agentAction.saveResponseAs ?? 'aiResponse',
      storeResult: true,
    },
  };
}

/**
 * Convert SendSlackAction to SlackActionConfig format
 */
function convertToSlackConfig(action: WorkflowAction): BaseAction & {
  type: 'send_slack';
  config: {
    channelId?: string;
    channelName?: string;
    userId?: string;
    userEmail?: string;
    message: string;
    blocks?: unknown[];
    threadTs?: string;
    unfurlLinks?: boolean;
    unfurlMedia?: boolean;
    asBot?: boolean;
    botName?: string;
    botIcon?: string;
  };
} {
  if (action.type !== 'send_slack') {
    throw new Error('Action is not a Slack action');
  }

  const slackAction = action as unknown as {
    id: string;
    name: string;
    type: 'send_slack';
    continueOnError: boolean;
    retry?: {
      enabled: boolean;
      maxAttempts: number;
      backoffMultiplier: number;
    };
    channel?: string;
    message?: string;
    blocks?: Record<string, unknown>[];
    mentions?: string[];
  };

  return {
    type: 'send_slack',
    id: action.id,
    name: action.name,
    continueOnError: slackAction.continueOnError,
    retry: slackAction.retry,
    config: {
      channelName: slackAction.channel,
      message: slackAction.message ?? '',
      blocks: slackAction.blocks,
    },
  };
}


