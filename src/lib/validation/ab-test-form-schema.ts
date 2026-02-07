import { z } from 'zod';

export const abTestFormSchema = z.object({
  name: z.string().min(1, 'Test name is required'),
  description: z.string().optional().default(''),
});

export type ABTestFormValues = z.infer<typeof abTestFormSchema>;
