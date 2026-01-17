/**
 * SMS Action Executor
 * Executes SMS actions in workflows
 */

import { sendSMS } from '@/lib/sms/sms-service';
import type { SendSMSAction } from '@/types/workflow';

/**
 * Execute SMS action
 */
export async function executeSMSAction(
  action: SendSMSAction,
  triggerData: Record<string, unknown>,
  organizationId: string
): Promise<Record<string, unknown>> {
  // Resolve variables
  const to = resolveVariables(action.to, triggerData) as string;
  const message = resolveVariables(action.message, triggerData) as string;

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
 * Resolve variables in config
 */
function resolveVariables(config: unknown, triggerData: Record<string, unknown>): unknown {
  if (typeof config === 'string') {
    return config.replace(/\{\{([^}]+)\}\}/g, (match, path: string) => {
      const trimmedPath = typeof path === 'string' ? path.trim() : String(path);
      const value = getNestedValue(triggerData, trimmedPath);
      return value !== undefined ? String(value) : match;
    });
  } else if (Array.isArray(config)) {
    return config.map(item => resolveVariables(item, triggerData));
  } else if (config && typeof config === 'object') {
    const resolved: Record<string, unknown> = {};
    for (const key in config as Record<string, unknown>) {
      resolved[key] = resolveVariables((config as Record<string, unknown>)[key], triggerData);
    }
    return resolved;
  }
  return config;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((current, key) => {
    if (current && typeof current === 'object' && key in current) {
      return (current as Record<string, unknown>)[key];
    }
    return undefined;
  }, obj);
}

