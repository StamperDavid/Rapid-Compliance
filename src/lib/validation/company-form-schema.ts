import { z } from 'zod';
import { emailSchema, phoneSchema, urlSchema } from './schemas';

export const companyFormSchema = z.object({
  name: z.string().min(1, 'Company name is required'),
  website: z.union([urlSchema, z.literal('')]).optional().default(''),
  phone: z.union([phoneSchema, z.literal('')]).optional().default(''),
  email: z.union([emailSchema, z.literal('')]).optional().default(''),
  industry: z.string().optional().default(''),
  description: z.string().optional().default(''),
  size: z.enum(['startup', 'small', 'medium', 'enterprise', 'unknown']).optional().default('unknown'),
  employeeCount: z.coerce.number().min(0).optional(),
  annualRevenue: z.coerce.number().min(0).optional(),
  status: z.enum(['prospect', 'active', 'inactive', 'churned']).default('prospect'),
  street: z.string().optional().default(''),
  city: z.string().optional().default(''),
  state: z.string().optional().default(''),
  zip: z.string().optional().default(''),
  country: z.string().optional().default(''),
  linkedInUrl: z.union([urlSchema, z.literal('')]).optional().default(''),
  notes: z.string().optional().default(''),
});

export type CompanyFormValues = z.infer<typeof companyFormSchema>;
