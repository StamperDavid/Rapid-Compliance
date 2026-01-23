/**
 * SMS Action Executor
 * Executes SMS actions in workflows
 */

import { sendSMS } from '@/lib/sms/sms-service';
import type { SendSMSAction, WorkflowTriggerData } from '@/types/workflow';

/**
 * Execute SMS action
 */
export async function executeSMSAction(
  action: SendSMSAction,
  triggerData: WorkflowTriggerData,
  organizationId: string
): Promise<unknown> {
  // Resolve variables
  const to = resolveVariables(action.to, triggerData);
  const message = resolveVariables(action.message, triggerData);
  
  // Send SMS
  const result = await sendSMS({
    to,
    message,
    organizationId,
  });
  
  if (!result.success) {
    throw new Error(`Failed to send SMS: ${result.error}`);
  }
  
  return {
    messageId: result.messageId,
    provider: result.provider,
    success: true,
  };
}

/**
 * Resolve variables in string template
 */
function resolveVariables(config: string, triggerData: WorkflowTriggerData): string;
function resolveVariables(config: string[], triggerData: WorkflowTriggerData): string[];
function resolveVariables(config: string | string[], triggerData: WorkflowTriggerData): string | string[] {
  if (typeof config === 'string') {
    return config.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
      const value = getNestedValue(triggerData, path.trim());
      return value !== undefined ? String(value) : match;
    });
  } else if (Array.isArray(config)) {
    return config.map(item => {
      if (typeof item !== 'string') {
        throw new Error('SMS action: array elements must be strings');
      }
      return resolveVariables(item, triggerData);
    });
  }
  throw new Error('SMS action: config must be string or string[]');
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: WorkflowTriggerData, path: string): unknown {
  return path.split('.').reduce((current: unknown, key: string) => 
    (current as Record<string, unknown>)?.[key], obj);
}

