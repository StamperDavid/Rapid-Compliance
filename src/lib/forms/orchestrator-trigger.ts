/**
 * Form Submission Orchestrator Trigger
 *
 * Integrates form submissions with the Signal Bus orchestration system.
 * Emits signals, triggers workflows, and coordinates downstream actions.
 *
 * TRIGGER TYPES:
 * - emit_signal: Emit a signal to the orchestration bus
 * - trigger_sequence: Start an email sequence
 * - route_lead: Route lead to appropriate sales rep
 * - notify_slack: Send notification to Slack
 * - send_webhook: Call external webhook
 * - execute_workflow: Run automation workflow
 * - update_score: Update lead score
 *
 * @module forms/orchestrator-trigger
 * @version 1.0.0
 */

import { Timestamp } from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';
import type { FormSubmission, FormDefinition, OrchestratorAction } from './types';
import { evaluateConditions as _evaluateConditions, createResponsesMap } from './conditional-logic';
import { syncSubmissionToCRM } from './crm-mapping';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Action execution result
 */
export interface ActionExecutionResult {
  actionId: string;
  actionType: OrchestratorAction['type'];
  success: boolean;
  executedAt: Timestamp;
  result?: unknown;
  error?: string;
}

/**
 * Complete trigger result for a submission
 */
export interface TriggerResult {
  submissionId: string;
  formId: string;
  success: boolean;
  actionsExecuted: ActionExecutionResult[];
  errors: string[];
  triggeredAt: Timestamp;
}

/**
 * Signal to emit to the orchestration bus
 */
export interface OrchestratorSignal {
  type: string;
  priority: 'High' | 'Medium' | 'Low';
  orgId: string;
  workspaceId: string;
  leadId?: string;
  formId: string;
  submissionId: string;
  confidence: number;
  metadata: Record<string, unknown>;
  ttl: Timestamp;
  createdAt: Timestamp;
  processed: boolean;
  processedAt: null;
}

/**
 * Webhook payload
 */
export interface WebhookPayload {
  event: 'form.submitted';
  formId: string;
  submissionId: string;
  confirmationNumber: string;
  submittedAt: string;
  data: Record<string, unknown>;
  metadata: Record<string, unknown>;
}

// ============================================================================
// SIGNAL EMISSION
// ============================================================================

/**
 * Emit a signal to the orchestration bus
 */
async function emitSignal(
  signal: Omit<OrchestratorSignal, 'id'>
): Promise<string> {
  // Import signal coordinator factory dynamically to avoid circular deps
  const { getClientSignalCoordinator } = await import('@/lib/orchestration/coordinator-factory-client');
  const coordinator = getClientSignalCoordinator();

  const result = await coordinator.emitSignal({
    type: signal.type as Parameters<typeof coordinator.emitSignal>[0]['type'],
    priority: signal.priority,
    orgId: signal.orgId,
    workspaceId: signal.workspaceId,
    leadId: signal.leadId,
    confidence: signal.confidence,
    metadata: signal.metadata,
  });

  if (!result.success) {
    throw new Error(result.error || 'Failed to emit signal');
  }

  return result.signalId!;
}

/**
 * Create default form submission signal
 */
function createSubmissionSignal(
  submission: FormSubmission,
  form: FormDefinition
): Omit<OrchestratorSignal, 'id'> {
  return {
    type: 'lead.discovered',
    priority: 'Medium',
    orgId: submission.organizationId,
    workspaceId: submission.workspaceId,
    formId: submission.formId,
    submissionId: submission.id,
    confidence: 0.8,
    metadata: {
      source: 'form_submission',
      formName: form.name,
      confirmationNumber: submission.confirmationNumber,
      submittedAt: submission.submittedAt.toDate().toISOString(),
      email: submission.indexedEmail,
      phone: submission.indexedPhone,
      name: submission.indexedName,
      company: submission.indexedCompany,
    },
    ttl: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
    createdAt: Timestamp.now(),
    processed: false,
    processedAt: null,
  };
}

// ============================================================================
// ACTION EXECUTORS
// ============================================================================

/**
 * Execute emit_signal action
 */
async function _executeEmitSignal(
  action: OrchestratorAction,
  submission: FormSubmission,
  form: FormDefinition
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {
    actionId: action.type,
    actionType: action.type,
    success: false,
    executedAt: Timestamp.now(),
  };

  try {
    const signalType = action.details?.signalType ?? 'lead.discovered';
    const signalPriority = action.details?.signalPriority ?? 'Medium';
    const signalMetadata = (action.details?.signalMetadata ?? {}) as Record<string, unknown>;

    const signalId = await emitSignal({
      type: signalType as string,
      priority: signalPriority as 'High' | 'Medium' | 'Low',
      orgId: submission.organizationId,
      workspaceId: submission.workspaceId,
      formId: submission.formId,
      submissionId: submission.id,
      confidence: 0.85,
      metadata: {
        source: 'form_submission',
        formName: form.name,
        ...signalMetadata,
        responses: submission.responses.reduce((acc, r) => {
          acc[r.fieldName] = r.value;
          return acc;
        }, {} as Record<string, unknown>),
      },
      ttl: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      createdAt: Timestamp.now(),
      processed: false,
      processedAt: null,
    });

    result.success = true;
    result.result = { signalId };
  } catch (error) {
    result.error = String(error);
    logger.error('Failed to emit signal', error instanceof Error ? error : new Error(String(error)));
  }

  return result;
}

/**
 * Execute trigger_sequence action
 */
async function executeTriggerSequence(
  action: OrchestratorAction,
  submission: FormSubmission
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {
    actionId: action.type,
    actionType: action.type,
    success: false,
    executedAt: Timestamp.now(),
  };

  try {
    const sequenceId = action.details?.sequenceId as string | undefined;
    if (!sequenceId) {
      throw new Error('Sequence ID not specified');
    }

    // Get email from submission
    const email = submission.indexedEmail;
    if (!email) {
      throw new Error('No email found in submission');
    }

    // Import sequence service dynamically
    const { enrollInSequence } = await import('@/lib/sequences/sequence-service');

    const enrollmentId = String(await enrollInSequence({
      sequenceId,
      leadId: submission.linkedLeadId ?? submission.id,
      email,
      orgId: submission.organizationId,
      workspaceId: submission.workspaceId,
      source: 'form_submission',
      sourceId: submission.id,
    }));

    result.success = true;
    result.result = { enrollmentId, sequenceId };
  } catch (error) {
    result.error = String(error);
    logger.error('Failed to trigger sequence', error instanceof Error ? error : new Error(String(error)));
  }

  return result;
}

/**
 * Execute route_lead action
 */
async function _executeRouteLead(
  action: OrchestratorAction,
  submission: FormSubmission
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {
    actionId: action.type,
    actionType: action.type,
    success: false,
    executedAt: Timestamp.now(),
  };

  try {
    // Emit lead routing signal
    await emitSignal({
      type: 'lead.routed',
      priority: 'High',
      orgId: submission.organizationId,
      workspaceId: submission.workspaceId,
      leadId: submission.linkedLeadId,
      formId: submission.formId,
      submissionId: submission.id,
      confidence: 0.9,
      metadata: {
        source: 'form_submission',
        routingRuleId: action.details?.routingRuleId,
        assignToUserId: action.details?.assignToUserId,
        email: submission.indexedEmail,
        company: submission.indexedCompany,
      },
      ttl: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      createdAt: Timestamp.now(),
      processed: false,
      processedAt: null,
    });

    result.success = true;
    result.result = { routed: true };
  } catch (error) {
    result.error = String(error);
    logger.error('Failed to route lead', error instanceof Error ? error : new Error(String(error)));
  }

  return result;
}

/**
 * Execute notify_slack action
 */
async function executeNotifySlack(
  action: OrchestratorAction,
  submission: FormSubmission,
  form: FormDefinition
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {
    actionId: action.type,
    actionType: action.type,
    success: false,
    executedAt: Timestamp.now(),
  };

  try {
    const channelId = action.details?.slackChannelId as string | undefined;
    if (!channelId) {
      throw new Error('Slack channel ID not specified');
    }

    // Build message with placeholders
    const slackMessage = action.details?.slackMessage as string | undefined;
    let message = slackMessage ||
      `New form submission: ${form.name}\n` +
      `Confirmation: ${submission.confirmationNumber}\n` +
      `Email: ${submission.indexedEmail || 'N/A'}\n` +
      `Name: ${submission.indexedName || 'N/A'}`;

    // Replace placeholders
    message = replacePlaceholders(message, submission);

    // Import Slack service dynamically
    const { sendSlackMessage } = await import('@/lib/integrations/slack-service');

    await sendSlackMessage({
      orgId: submission.organizationId,
      channelId,
      message,
      metadata: {
        formId: submission.formId,
        submissionId: submission.id,
      },
    });

    result.success = true;
    result.result = { channelId, messageSent: true };
  } catch (error) {
    result.error = String(error);
    logger.error('Failed to notify Slack', error instanceof Error ? error : new Error(String(error)));
  }

  return result;
}

/**
 * Execute send_webhook action
 */
async function _executeSendWebhook(
  action: OrchestratorAction,
  submission: FormSubmission,
  _form: FormDefinition
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {
    actionId: action.type,
    actionType: action.type,
    success: false,
    executedAt: Timestamp.now(),
  };

  try {
    const webhookUrl = action.details?.webhookUrl as string | undefined;
    if (!webhookUrl) {
      throw new Error('Webhook URL not specified');
    }

    const method = (action.details?.webhookMethod as string | undefined) || 'POST';
    const headers = (action.details?.webhookHeaders as Record<string, string> | undefined) || {};

    // Build payload
    let payload: WebhookPayload | Record<string, unknown>;

    if (action.details?.webhookPayload) {
      // Custom payload template
      payload = JSON.parse(
        replacePlaceholders(action.details.webhookPayload as string, submission)
      ) as Record<string, unknown>;
    } else {
      // Default payload
      payload = {
        event: 'form.submitted',
        formId: submission.formId,
        submissionId: submission.id,
        confirmationNumber: submission.confirmationNumber,
        submittedAt: submission.submittedAt.toDate().toISOString(),
        data: submission.responses.reduce((acc, r) => {
          acc[r.fieldName] = r.value;
          return acc;
        }, {} as Record<string, unknown>),
        metadata: submission.metadata as Record<string, unknown>,
      };
    }

    // Send webhook
    const response = await fetch(webhookUrl, {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`Webhook failed: ${response.status} ${response.statusText}`);
    }

    result.success = true;
    result.result = {
      status: response.status,
      webhookUrl,
    };
  } catch (error) {
    result.error = String(error);
    logger.error('Failed to send webhook', error instanceof Error ? error : new Error(String(error)));
  }

  return result;
}

/**
 * Execute execute_workflow action
 */
async function executeWorkflow(
  action: OrchestratorAction,
  submission: FormSubmission
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {
    actionId: action.type,
    actionType: action.type,
    success: false,
    executedAt: Timestamp.now(),
  };

  try {
    const workflowId = action.details?.workflowId;
    if (!workflowId) {
      throw new Error('Workflow ID not specified');
    }

    // Build workflow inputs from mapping
    const inputs: Record<string, unknown> = {};
    const inputMappings = action.details?.workflowInputs as Record<string, string> | undefined;

    if (inputMappings) {
      for (const [inputName, fieldName] of Object.entries(inputMappings)) {
        const response = submission.responses.find((r) => r.fieldName === fieldName);
        if (response) {
          inputs[inputName] = response.value;
        }
      }
    }

    // Emit workflow execution signal
    await emitSignal({
      type: 'workflow.executed',
      priority: 'Medium',
      orgId: submission.organizationId,
      workspaceId: submission.workspaceId,
      formId: submission.formId,
      submissionId: submission.id,
      confidence: 0.9,
      metadata: {
        workflowId,
        inputs,
        source: 'form_submission',
      },
      ttl: Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)),
      createdAt: Timestamp.now(),
      processed: false,
      processedAt: null,
    });

    result.success = true;
    result.result = { workflowId, inputs };
  } catch (error) {
    result.error = String(error);
    logger.error('Failed to execute workflow', error instanceof Error ? error : new Error(String(error)));
  }

  return result;
}

/**
 * Execute crm_update action
 */
async function executeCRMUpdate(
  action: OrchestratorAction,
  submission: FormSubmission,
  form: FormDefinition
): Promise<ActionExecutionResult> {
  const result: ActionExecutionResult = {
    actionId: action.type,
    actionType: action.type,
    success: false,
    executedAt: Timestamp.now(),
  };

  try {
    // Use CRM mapping from form definition
    const syncResult = await syncSubmissionToCRM(submission, form.crmMapping);

    if (!syncResult.success) {
      throw new Error(syncResult.errors.join(', '));
    }

    result.success = true;
    result.result = syncResult;
  } catch (error) {
    result.error = error instanceof Error ? error.message : String(error);
    logger.error('Failed to update CRM', error instanceof Error ? error : new Error(String(error)));
  }

  return result;
}

// ============================================================================
// PLACEHOLDER REPLACEMENT
// ============================================================================

/**
 * Replace {{field}} placeholders with actual values
 */
function replacePlaceholders(template: string, submission: FormSubmission): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, fieldName) => {
    // Check indexed fields first
    if (fieldName === 'email') {return submission.indexedEmail ?? '';}
    if (fieldName === 'phone') {return submission.indexedPhone ?? '';}
    if (fieldName === 'name') {return submission.indexedName ?? '';}
    if (fieldName === 'company') {return submission.indexedCompany ?? '';}
    if (fieldName === 'confirmationNumber') {return submission.confirmationNumber;}
    if (fieldName === 'submissionId') {return submission.id;}
    if (fieldName === 'formId') {return submission.formId;}

    // Check responses
    const response = submission.responses.find((r) => r.fieldName === fieldName);
    if (response) {
      return response.displayValue ?? String(response.value ?? '');
    }

    return match; // Keep placeholder if not found
  });
}

// ============================================================================
// MAIN TRIGGER FUNCTION
// ============================================================================

/**
 * Process all orchestrator actions for a form submission
 */
export async function triggerOrchestratorActions(
  submission: FormSubmission,
  form: FormDefinition
): Promise<TriggerResult> {
  const result: TriggerResult = {
    submissionId: submission.id,
    formId: form.id,
    success: true,
    actionsExecuted: [],
    errors: [],
    triggeredAt: Timestamp.now(),
  };

  // Always emit default form submission signal
  try {
    const defaultSignal = createSubmissionSignal(submission, form);
    await emitSignal(defaultSignal);
    logger.info('Default submission signal emitted', {
      submissionId: submission.id,
      formId: form.id,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    result.errors.push(`Failed to emit default signal: ${errorMessage}`);
    logger.error('Failed to emit default submission signal', error instanceof Error ? error : new Error(String(error)));
  }

  // Get configured actions (if any)
  const actions = submission.orchestratorActions ?? [];

  // Create responses map for condition evaluation
  const _responsesMap = createResponsesMap(submission.responses);

  // Execute each action
  for (const action of actions) {
    // Skip if action is disabled or already completed
    if (action.status !== 'pending') {continue;}

    // Execute action based on type
    let actionResult: ActionExecutionResult;

    try {
      switch (action.type) {
        case 'email':
          // Email actions handled via trigger_sequence
          actionResult = await executeTriggerSequence(
            { ...action, details: action.details },
            submission
          );
          break;

        case 'sms':
          // SMS not implemented yet
          actionResult = {
            actionId: action.type,
            actionType: action.type,
            success: false,
            executedAt: Timestamp.now(),
            error: 'SMS action not implemented',
          };
          break;

        case 'workflow':
          actionResult = await executeWorkflow(action, submission);
          break;

        case 'notification':
          actionResult = await executeNotifySlack(action, submission, form);
          break;

        case 'crm_update':
          actionResult = await executeCRMUpdate(action, submission, form);
          break;

        default:
          actionResult = {
            actionId: action.type,
            actionType: action.type,
            success: false,
            executedAt: Timestamp.now(),
            error: `Unknown action type: ${action.type}`,
          };
      }
    } catch (error) {
      actionResult = {
        actionId: action.type,
        actionType: action.type,
        success: false,
        executedAt: Timestamp.now(),
        error: String(error),
      };
    }

    result.actionsExecuted.push(actionResult);

    if (!actionResult.success) {
      result.errors.push(`Action ${action.type} failed: ${actionResult.error}`);
    }
  }

  // Set overall success based on critical failures
  result.success = result.errors.length === 0 || result.actionsExecuted.some((a) => a.success);

  logger.info('Orchestrator actions completed', {
    submissionId: submission.id,
    formId: form.id,
    actionsExecuted: result.actionsExecuted.length,
    success: result.success,
    errors: result.errors.length,
  });

  return result;
}

/**
 * Hook to call after form submission is created
 * This should be called from form-service.ts after createSubmission
 */
export async function onFormSubmit(
  submission: FormSubmission,
  form: FormDefinition
): Promise<TriggerResult> {
  logger.info('Form submission received, triggering orchestrator', {
    submissionId: submission.id,
    formId: form.id,
    email: submission.indexedEmail,
  });

  // Skip partial submissions
  if (submission.isPartial) {
    return {
      submissionId: submission.id,
      formId: form.id,
      success: true,
      actionsExecuted: [],
      errors: [],
      triggeredAt: Timestamp.now(),
    };
  }

  return triggerOrchestratorActions(submission, form);
}

/**
 * Register form submission handler with signal coordinator
 */
export async function registerFormSubmissionHandler(
  orgId: string,
  workspaceId: string
): Promise<void> {
  // This can be called during workspace initialization
  // to set up signal handlers for form-related events
  logger.info('Form submission handler registered', { orgId, workspaceId });
  return Promise.resolve();
}
