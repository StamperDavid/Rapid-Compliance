import { z } from 'zod';
import { emailSchema, phoneSchema, urlSchema } from './schemas';

export const contactFormSchema = z.object({
  firstName: z.string().min(1, 'First name is required'),
  lastName: z.string().min(1, 'Last name is required'),
  email: emailSchema,
  phone: z.union([phoneSchema, z.literal('')]).optional().default(''),
  company: z.string().optional().default(''),
  title: z.string().optional().default(''),
  linkedIn: z.union([urlSchema, z.literal('')]).optional().default(''),
});

export type ContactFormValues = z.infer<typeof contactFormSchema>;
