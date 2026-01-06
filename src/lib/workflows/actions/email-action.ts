/**
 * Email Action Executor
 * Executes email actions in workflows
 */

import type { EmailOptions } from '@/lib/email/email-service';
import { sendEmail } from '@/lib/email/email-service';
import type { SendEmailAction } from '@/types/workflow';

/**
 * Execute email action
 */
export async function executeEmailAction(
  action: SendEmailAction,
  triggerData: any,
  organizationId: string
): Promise<any> {
  // Resolve variables in action fields
  const to = resolveVariables(action.to, triggerData);
  const subject = resolveVariables(action.subject, triggerData);
  const body = resolveVariables(action.body, triggerData);
  const cc = action.cc ? resolveVariables(action.cc, triggerData) : undefined;
  const bcc = action.bcc ? resolveVariables(action.bcc, triggerData) : undefined;
  const from = action.from ? resolveVariables(action.from, triggerData) : undefined;
  const replyTo = action.replyTo ? resolveVariables(action.replyTo, triggerData) : undefined;
  
  // Build email options
  const emailOptions: EmailOptions = {
    to: Array.isArray(to) ? to : [to],
    cc: cc ? (Array.isArray(cc) ? cc : [cc]) : undefined,
    bcc: bcc ? (Array.isArray(bcc) ? bcc : [bcc]) : undefined,
    subject,
    html: action.bodyType === 'html' ? body : undefined,
    text: action.bodyType === 'text' ? body : undefined,
    from,
    replyTo,
    tracking: {
      trackOpens: true,
      trackClicks: true,
    },
    metadata: {
      organizationId,
      actionId: action.id,
    },
  };
  
  // Send email
  const result = await sendEmail(emailOptions);
  
  if (!result.success) {
    throw new Error(`Failed to send email: ${result.error}`);
  }
  
  return {
    messageId: result.messageId,
    provider: result.provider,
    success: true,
  };
}

/**
 * Resolve variables in config (e.g., {{triggerData.fieldName}})
 */
function resolveVariables(config: any, triggerData: any): any {
  if (typeof config === 'string') {
    return config.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
      const value = getNestedValue(triggerData, path.trim());
      return value !== undefined ? String(value) : match;
    });
  } else if (Array.isArray(config)) {
    return config.map(item => resolveVariables(item, triggerData));
  } else if (config && typeof config === 'object') {
    const resolved: any = {};
    for (const key in config) {
      resolved[key] = resolveVariables(config[key], triggerData);
    }
    return resolved;
  }
  return config;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: any, path: string): any {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

