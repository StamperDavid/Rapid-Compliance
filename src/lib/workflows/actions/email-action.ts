/**
 * Email Action Executor
 * Executes email actions in workflows
 */

import { sendEmail, type EmailOptions } from '@/lib/email/email-service';
import type { SendEmailAction, WorkflowTriggerData } from '@/types/workflow';

/**
 * Result of email action execution
 */
interface EmailActionResult {
  messageId?: string;
  provider?: string;
  success: boolean;
}

/**
 * Execute email action
 */
export async function executeEmailAction(
  action: SendEmailAction,
  triggerData: WorkflowTriggerData,
  organizationId: string
): Promise<EmailActionResult> {
  // Resolve variables in action fields with proper type narrowing
  const to = resolveVariablesAsStringOrArray(action.to, triggerData);
  const subject = resolveVariablesAsString(action.subject, triggerData);
  const body = resolveVariablesAsString(action.body, triggerData);
  const cc = action.cc ? resolveVariablesAsStringOrArray(action.cc, triggerData) : undefined;
  const bcc = action.bcc ? resolveVariablesAsStringOrArray(action.bcc, triggerData) : undefined;
  const from = action.from ? resolveVariablesAsString(action.from, triggerData) : undefined;
  const replyTo = action.replyTo ? resolveVariablesAsString(action.replyTo, triggerData) : undefined;

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
 * Resolve variables as a string
 */
function resolveVariablesAsString(config: string, triggerData: WorkflowTriggerData): string {
  return config.replace(/\{\{([^}]+)\}\}/g, (_match, path: string) => {
    const value = getNestedValue(triggerData, path.trim());
    return value !== undefined ? String(value) : _match;
  });
}

/**
 * Resolve variables as string or string array
 */
function resolveVariablesAsStringOrArray(
  config: string | string[],
  triggerData: WorkflowTriggerData
): string | string[] {
  if (Array.isArray(config)) {
    return config.map(item => resolveVariablesAsString(item, triggerData));
  }
  return resolveVariablesAsString(config, triggerData);
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj: WorkflowTriggerData, path: string): unknown {
  const keys = path.split('.');
  let current: unknown = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    if (typeof current === 'object' && !Array.isArray(current)) {
      current = (current as Record<string, unknown>)[key];
    } else {
      return undefined;
    }
  }

  return current;
}

