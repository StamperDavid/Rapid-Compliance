/**
 * Delay Action Executor
 * Executes delay actions in workflows
 */

import type { DelayAction, WorkflowTriggerData } from '@/types/workflow';

/**
 * Execute delay action
 */
export async function executeDelayAction(
  action: DelayAction,
  triggerData: WorkflowTriggerData
): Promise<unknown> {
  let duration: number;
  
  if (action.until) {
    // Delay until specific time
    if (action.until.type === 'specific_time' && action.until.time) {
      const targetTime = new Date(action.until.time).getTime();
      const now = Date.now();
      duration = Math.max(0, targetTime - now);
    } else if (action.until.type === 'field_value' && action.until.field) {
      const fieldValue = getNestedValue(triggerData, action.until.field);
      const targetTime = new Date(fieldValue).getTime();
      const now = Date.now();
      duration = Math.max(0, targetTime - now);
    } else {
      throw new Error('Invalid delay until configuration');
    }
  } else {
    // Delay for duration
    duration = action.duration.value;
    
    // Convert to milliseconds
    switch (action.duration.unit) {
      case 'seconds':
        duration *= 1000;
        break;
      case 'minutes':
        duration *= 60 * 1000;
        break;
      case 'hours':
        duration *= 60 * 60 * 1000;
        break;
      case 'days':
        duration *= 24 * 60 * 60 * 1000;
        break;
    }
  }
  
  // Wait for specified duration
  await new Promise(resolve => setTimeout(resolve, duration));
  
  return {
    delayed: true,
    duration,
    completedAt: new Date().toISOString(),
  };
}

/**
 * Resolve variables in config
 */
function resolveVariables(config: unknown, triggerData: WorkflowTriggerData): unknown {
  if (typeof config === 'string') {
    return config.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = getNestedValue(triggerData, path.trim());
      return value !== undefined ? String(value) : match;
    });
  } else if (Array.isArray(config)) {
    return config.map(item => resolveVariables(item, triggerData));
  } else if (config && typeof config === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const key in config) {
      resolved[key] = resolveVariables((config as Record<string, unknown>)[key], triggerData);
    }
    return resolved;
  }
  return config;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: WorkflowTriggerData, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => 
    (current as Record<string, unknown>)?.[key], obj);
}

