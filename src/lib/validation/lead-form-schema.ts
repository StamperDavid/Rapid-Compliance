import { z } from 'zod';
import { emailSchema, phoneSchema } from './schemas';

export const leadFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: emailSchema,
  phone: z.union([phoneSchema, z.literal('')]).optional().default(''),
  company: z.string().optional().default(''),
  title: z.string().optional().default(''),
  source: z.string().optional().default(''),
  status: z.enum(['new', 'contacted', 'qualified', 'converted', 'lost']).default('new'),
});

export type LeadFormValues = z.infer<typeof leadFormSchema>;
