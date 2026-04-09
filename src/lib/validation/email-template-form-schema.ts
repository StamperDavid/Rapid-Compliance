import { z } from 'zod';

const templateVariableSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  defaultValue: z.string().optional().default(''),
  description: z.string().optional().default(''),
});

export const emailTemplateFormSchema = z.object({
  name: z.string().min(1, 'Template name is required'),
  subject: z.string().min(1, 'Subject line is required'),
  body: z.string().min(1, 'Email body is required'),
  preheaderText: z.string().optional().default(''),
  category: z.enum([
    'sales', 'marketing', 'transactional', 'nurture',
    'onboarding', 'follow_up', 'announcement', 'newsletter', 'custom',
  ]).default('custom'),
  variables: z.array(templateVariableSchema).optional().default([]),
  isActive: z.boolean().default(true),
});

export type EmailTemplateFormValues = z.infer<typeof emailTemplateFormSchema>;
