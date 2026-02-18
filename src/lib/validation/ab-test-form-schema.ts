import { z } from 'zod';

export const abTestFormSchema = z.object({
  name: z.string().min(1, 'Test name is required').max(100, 'Name must be under 100 characters'),
  description: z.string().max(500, 'Description must be under 500 characters').optional().default(''),
  testType: z.enum(['page', 'email', 'checkout', 'pricing', 'cta', 'custom']).default('page'),
  targetMetric: z.string().min(1, 'Target metric is required'),
  trafficAllocation: z.coerce.number().min(1, 'Must be at least 1%').max(100, 'Maximum 100%').default(100),
});

export type ABTestFormValues = z.infer<typeof abTestFormSchema>;
