import { z } from 'zod';

export const fineTuningFormSchema = z.object({
  modelName: z.string().min(1, 'Model name is required'),
  baseModel: z.enum(['gpt-3.5-turbo', 'gpt-4', 'claude-3-opus']).default('gpt-3.5-turbo'),
  datasetId: z.string().optional().default(''),
});

export type FineTuningFormValues = z.infer<typeof fineTuningFormSchema>;
