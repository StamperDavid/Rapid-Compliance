import { z } from 'zod';

export const datasetFormSchema = z.object({
  name: z.string().min(1, 'Dataset name is required').max(100, 'Name must be under 100 characters'),
  description: z.string().max(500, 'Description must be under 500 characters').optional().default(''),
  format: z.enum(['jsonl', 'csv', 'text']).default('jsonl'),
});

export type DatasetFormValues = z.infer<typeof datasetFormSchema>;
