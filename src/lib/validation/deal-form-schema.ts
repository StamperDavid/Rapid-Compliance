import { z } from 'zod';

export const dealFormSchema = z.object({
  name: z.string().min(1, 'Deal name is required'),
  company: z.string().min(1, 'Company is required'),
  value: z.coerce.number().min(0, 'Value must be non-negative'),
  probability: z.coerce.number().min(0, 'Min 0%').max(100, 'Max 100%').default(50),
  stage: z.enum(['prospecting', 'qualification', 'proposal', 'negotiation', 'closed_won', 'closed_lost']).default('prospecting'),
  expectedCloseDate: z.string().optional().default(''),
  notes: z.string().optional().default(''),
});

export type DealFormValues = z.infer<typeof dealFormSchema>;
