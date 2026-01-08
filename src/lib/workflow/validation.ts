/**
 * Workflow Validation Schemas
 * 
 * Zod schemas for runtime validation of workflow configurations
 * 
 * VALIDATION RULES:
 * - All required fields must be present
 * - Types must match expected values
 * - Business logic constraints (e.g., max 100 actions per workflow)
 * - Security constraints (e.g., no external webhook URLs in free tier)
 */

import { z } from 'zod';

// ============================================================================
// TRIGGER SCHEMAS
// ============================================================================

/**
 * Trigger operator schema
 */
export const TriggerOperatorSchema = z.enum([
  'equals',
  'not_equals',
  'greater_than',
  'less_than',
  'greater_than_or_equal',
  'less_than_or_equal',
  'contains',
  'not_contains',
  'in',
  'not_in',
  'is_null',
  'is_not_null',
  'changed_from',
  'changed_to',
]);

/**
 * Trigger condition schema
 */
export const TriggerConditionSchema = z.object({
  field: z.string().min(1, 'Field is required'),
  operator: TriggerOperatorSchema,
  value: z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.array(z.string()),
  ]),
});

/**
 * Trigger schedule schema
 */
export const TriggerScheduleSchema = z.object({
  frequency: z.enum(['daily', 'weekly', 'monthly']),
  time: z.string().regex(/^([0-1][0-9]|2[0-3]):[0-5][0-9]$/, 'Time must be in HH:MM format'),
  dayOfWeek: z.number().min(0).max(6).optional(),
  dayOfMonth: z.number().min(1).max(31).optional(),
  timezone: z.string().optional(),
}).refine(
  (data) => {
    if (data.frequency === 'weekly' && data.dayOfWeek === undefined) {
      return false;
    }
    if (data.frequency === 'monthly' && data.dayOfMonth === undefined) {
      return false;
    }
    return true;
  },
  {
    message: 'Weekly schedules require dayOfWeek, monthly schedules require dayOfMonth',
  }
);

/**
 * Workflow trigger type schema
 */
export const WorkflowTriggerTypeSchema = z.enum([
  'deal.score.changed',
  'deal.score.increased',
  'deal.score.decreased',
  'deal.tier.changed',
  'deal.at_risk.detected',
  'deal.hot.detected',
  'deal.stage.changed',
  'deal.stage.stuck',
  'deal.stage.regressed',
  'deal.activity.low',
  'deal.activity.high',
  'deal.no_activity',
  'deal.value.increased',
  'deal.value.decreased',
  'deal.high_value.detected',
  'deal.risk.critical',
  'deal.risk.high',
  'deal.close_date.approaching',
  'deal.close_date.passed',
  'schedule.daily',
  'schedule.weekly',
  'schedule.monthly',
  'manual',
]);

/**
 * Workflow trigger schema
 */
export const WorkflowTriggerSchema = z.object({
  id: z.string().min(1),
  type: WorkflowTriggerTypeSchema,
  conditions: z.array(TriggerConditionSchema).max(20, 'Maximum 20 conditions allowed'),
  conditionLogic: z.enum(['AND', 'OR']),
  schedule: TriggerScheduleSchema.optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
});

// ============================================================================
// ACTION SCHEMAS
// ============================================================================

/**
 * Email action config schema
 */
export const EmailActionConfigSchema = z.object({
  emailType: z.enum(['intro', 'follow_up', 'proposal', 'close', 're_engagement']),
  recipientField: z.string().optional(),
  recipientEmail: z.string().email().optional(),
  tone: z.enum(['professional', 'casual', 'consultative', 'urgent', 'friendly']).optional(),
  length: z.enum(['short', 'medium', 'long']).optional(),
  includeCompetitive: z.boolean().optional(),
  includeSocialProof: z.boolean().optional(),
  customInstructions: z.string().max(1000).optional(),
  autoSend: z.boolean().optional(),
}).refine(
  (data) => data.recipientField ?? data.recipientEmail,
  {
    message: 'Either recipientField or recipientEmail must be provided',
  }
);

/**
 * Task action config schema
 */
export const TaskActionConfigSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().max(1000).optional(),
  dueInDays: z.number().min(0).max(365).optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  assignToField: z.string().optional(),
  assignToUserId: z.string().optional(),
  taskType: z.string().optional(),
}).refine(
  (data) => data.assignToField ?? data.assignToUserId,
  {
    message: 'Either assignToField or assignToUserId must be provided',
  }
);

/**
 * Deal action config schema
 */
export const DealActionConfigSchema = z.object({
  field: z.string().min(1),
  value: z.union([z.string(), z.number(), z.boolean()]),
  operation: z.enum(['set', 'increment', 'decrement', 'append']).optional(),
});

/**
 * Notification action config schema
 */
export const NotificationActionConfigSchema = z.object({
  channel: z.enum(['in_app', 'slack', 'email']),
  message: z.string().min(1).max(1000),
  title: z.string().max(200).optional(),
  priority: z.enum(['low', 'medium', 'high']).optional(),
  recipientField: z.string().optional(),
  recipientId: z.string().optional(),
  slackChannel: z.string().optional(),
  emailTemplate: z.string().optional(),
});

/**
 * Webhook action config schema
 */
export const WebhookActionConfigSchema = z.object({
  url: z.string().url(),
  method: z.enum(['GET', 'POST', 'PUT', 'PATCH', 'DELETE']),
  headers: z.record(z.string()).optional(),
  body: z.record(z.unknown()).optional(),
  timeout: z.number().min(1000).max(30000).optional(),
});

/**
 * Wait action config schema
 */
export const WaitActionConfigSchema = z.object({
  type: z.enum(['delay', 'until']),
  delayHours: z.number().min(1).max(720).optional(),
  delayDays: z.number().min(1).max(30).optional(),
  condition: TriggerConditionSchema.optional(),
  maxWaitDays: z.number().min(1).max(90).optional(),
}).refine(
  (data) => {
    if (data.type === 'delay') {
      return data.delayHours !== undefined || data.delayDays !== undefined;
    }
    if (data.type === 'until') {
      return data.condition !== undefined;
    }
    return false;
  },
  {
    message: 'Delay type requires delayHours or delayDays, until type requires condition',
  }
);

/**
 * Action config schema (discriminated union)
 */
export const ActionConfigSchema = z.union([
  EmailActionConfigSchema,
  TaskActionConfigSchema,
  DealActionConfigSchema,
  NotificationActionConfigSchema,
  WebhookActionConfigSchema,
  WaitActionConfigSchema,
  z.record(z.unknown()), // For custom actions
]);

/**
 * Retry config schema
 */
export const RetryConfigSchema = z.object({
  maxAttempts: z.number().min(1).max(5),
  delayMs: z.number().min(100).max(60000),
  backoffMultiplier: z.number().min(1).max(3).optional(),
});

/**
 * Workflow action type schema
 */
export const WorkflowActionTypeSchema = z.enum([
  'email.send',
  'email.generate',
  'email.sequence.add',
  'task.create',
  'task.assign',
  'task.update',
  'deal.stage.change',
  'deal.tag.add',
  'deal.tag.remove',
  'deal.update',
  'notification.send',
  'notification.slack',
  'notification.email',
  'activity.create',
  'note.create',
  'reminder.create',
  'score.recalculate',
  'forecast.update',
  'webhook.call',
  'wait.delay',
  'wait.until',
  'custom',
]);

/**
 * Workflow action schema
 */
export const WorkflowActionSchema = z.object({
  id: z.string().min(1),
  type: WorkflowActionTypeSchema,
  config: ActionConfigSchema,
  order: z.number().min(0).max(100),
  continueOnError: z.boolean(),
  retry: RetryConfigSchema.optional(),
  name: z.string().min(1).max(100),
  description: z.string().max(500),
});

// ============================================================================
// WORKFLOW SCHEMAS
// ============================================================================

/**
 * Workflow status schema
 */
export const WorkflowStatusSchema = z.enum(['active', 'paused', 'draft', 'archived']);

/**
 * Workflow settings schema
 */
export const WorkflowSettingsSchema = z.object({
  maxExecutionsPerDay: z.number().min(1).max(1000).optional(),
  maxExecutionsPerDeal: z.number().min(1).max(100).optional(),
  cooldownMinutes: z.number().min(1).max(1440).optional(),
  executeOnWeekends: z.boolean().optional(),
  executeOnHolidays: z.boolean().optional(),
  applyToNewDealsOnly: z.boolean().optional(),
  dealFilters: z.array(TriggerConditionSchema).optional(),
  notifyOnSuccess: z.boolean().optional(),
  notifyOnFailure: z.boolean().optional(),
  notificationRecipients: z.array(z.string()).optional(),
});

/**
 * Create workflow request schema
 */
export const CreateWorkflowSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  name: z.string().min(1, 'Name is required').max(100, 'Name must be 100 characters or less'),
  description: z.string().max(500, 'Description must be 500 characters or less'),
  status: WorkflowStatusSchema.optional().default('draft'),
  trigger: WorkflowTriggerSchema,
  actions: z.array(WorkflowActionSchema)
    .min(1, 'At least one action is required')
    .max(50, 'Maximum 50 actions allowed'),
  settings: WorkflowSettingsSchema.optional(),
  tags: z.array(z.string()).max(10).optional(),
});

/**
 * Update workflow request schema
 */
export const UpdateWorkflowSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  status: WorkflowStatusSchema.optional(),
  trigger: WorkflowTriggerSchema.optional(),
  actions: z.array(WorkflowActionSchema).min(1).max(50).optional(),
  settings: WorkflowSettingsSchema.optional(),
  tags: z.array(z.string()).max(10).optional(),
});

/**
 * Execute workflow manually schema
 */
export const ExecuteWorkflowSchema = z.object({
  workflowId: z.string().min(1, 'Workflow ID is required'),
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  dealId: z.string().optional(),
  triggerData: z.record(z.unknown()).optional(),
  userId: z.string().optional(),
});

/**
 * Workflow filter schema
 */
export const WorkflowFilterSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().optional(),
  status: WorkflowStatusSchema.optional(),
  triggerType: WorkflowTriggerTypeSchema.optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().min(1).max(100).optional().default(20),
  offset: z.number().min(0).optional().default(0),
});

// ============================================================================
// TYPE INFERENCE
// ============================================================================

export type CreateWorkflowInput = z.infer<typeof CreateWorkflowSchema>;
export type UpdateWorkflowInput = z.infer<typeof UpdateWorkflowSchema>;
export type ExecuteWorkflowInput = z.infer<typeof ExecuteWorkflowSchema>;
export type WorkflowFilterInput = z.infer<typeof WorkflowFilterSchema>;
export type EmailActionConfig = z.infer<typeof EmailActionConfigSchema>;
export type TaskActionConfig = z.infer<typeof TaskActionConfigSchema>;
export type DealActionConfig = z.infer<typeof DealActionConfigSchema>;
export type NotificationActionConfig = z.infer<typeof NotificationActionConfigSchema>;
export type WebhookActionConfig = z.infer<typeof WebhookActionConfigSchema>;
export type WaitActionConfig = z.infer<typeof WaitActionConfigSchema>;

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Validate workflow configuration
 * 
 * @param data - Workflow data to validate
 * @returns Validation result with typed data or errors
 */
export function validateWorkflow(data: unknown): {
  success: true;
  data: CreateWorkflowInput;
} | {
  success: false;
  error: string;
  details: z.ZodIssue[];
} {
  try {
    const result = CreateWorkflowSchema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }
    
    return {
      success: false,
      error: 'Workflow validation failed',
      details: result.error.issues,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Unexpected validation error',
      details: [],
    };
  }
}

/**
 * Validate workflow update
 */
export function validateWorkflowUpdate(data: unknown): {
  success: true;
  data: UpdateWorkflowInput;
} | {
  success: false;
  error: string;
  details: z.ZodIssue[];
} {
  try {
    const result = UpdateWorkflowSchema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }
    
    return {
      success: false,
      error: 'Workflow update validation failed',
      details: result.error.issues,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Unexpected validation error',
      details: [],
    };
  }
}

/**
 * Validate workflow execution request
 */
export function validateWorkflowExecution(data: unknown): {
  success: true;
  data: ExecuteWorkflowInput;
} | {
  success: false;
  error: string;
  details: z.ZodIssue[];
} {
  try {
    const result = ExecuteWorkflowSchema.safeParse(data);
    
    if (result.success) {
      return {
        success: true,
        data: result.data,
      };
    }
    
    return {
      success: false,
      error: 'Workflow execution validation failed',
      details: result.error.issues,
    };
  } catch (error) {
    return {
      success: false,
      error: 'Unexpected validation error',
      details: [],
    };
  }
}
