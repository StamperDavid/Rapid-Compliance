import { z } from 'zod';

const nurtureStepSchema = z.object({
  delayDays: z.coerce.number().min(0, 'Delay must be non-negative').default(1),
  subject: z.string().min(1, 'Subject is required'),
  body: z.string().min(1, 'Body is required'),
  type: z.enum(['email', 'sms', 'task']).default('email'),
});

export type NurtureStepValues = z.infer<typeof nurtureStepSchema>;

export const nurtureFormSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  description: z.string().optional().default(''),
  steps: z.array(nurtureStepSchema).default([]),
});

export type NurtureFormValues = z.infer<typeof nurtureFormSchema>;
