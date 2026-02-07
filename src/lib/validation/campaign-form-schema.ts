import { z } from 'zod';

export const campaignFormSchema = z.object({
  name: z.string().min(1, 'Campaign name is required'),
  subject: z.string().min(1, 'Subject line is required'),
  body: z.string().min(1, 'Email body is required'),
  scheduledFor: z.string().optional().default(''),
});

export type CampaignFormValues = z.infer<typeof campaignFormSchema>;
