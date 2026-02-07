import { z } from 'zod';

const workflowActionSchema = z.object({
  id: z.string(),
  type: z.enum([
    'delay',
    'send_email',
    'send_sms',
    'http_request',
    'create_entity',
    'update_entity',
    'ai_agent',
  ]),
  duration: z.coerce.number().optional(),
  onError: z.enum(['stop', 'continue']).default('stop'),
});

export type WorkflowActionValues = z.infer<typeof workflowActionSchema>;

const triggerSchema = z.object({
  type: z.enum([
    'manual',
    'entity.created',
    'entity.updated',
    'schedule',
    'webhook',
  ]).default('manual'),
  config: z.record(z.unknown()).default({}),
  requireConfirmation: z.boolean().default(false),
});

export const workflowFormSchema = z.object({
  name: z.string().min(1, 'Workflow name is required'),
  description: z.string().optional().default(''),
  trigger: triggerSchema.default({ type: 'manual', config: {}, requireConfirmation: false }),
  actions: z.array(workflowActionSchema).default([]),
  status: z.enum(['draft', 'active', 'paused']).default('draft'),
});

export type WorkflowFormValues = z.infer<typeof workflowFormSchema>;
