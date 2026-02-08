/**
 * Input Validation Schemas
 * Using Zod for runtime type validation and sanitization
 */

import { z } from 'zod';

// Common validation patterns
const phoneRegex = /^\+?[\d\s()-]+$/;

/**
 * Email validation schema
 */
export const emailSchema = z.string().email('Invalid email format').max(255);

/**
 * URL validation schema
 */
export const urlSchema = z.string().url('Invalid URL format').max(2048);

/**
 * Phone number validation schema
 */
export const phoneSchema = z.string().regex(phoneRegex, 'Invalid phone number format').max(20);

/**
 * User ID validation
 */
export const userIdSchema = z.string().min(1).max(100);

/**
 * Email send request schema
 */
export const emailSendSchema = z.object({
  to: z.union([emailSchema, z.array(emailSchema)]),
  subject: z.string().min(1).max(255),
  html: z.string().optional(),
  text: z.string().optional(),
  from: emailSchema.optional(),
  fromName: z.string().max(100).optional(),
  cc: z.union([emailSchema, z.array(emailSchema)]).optional(),
  bcc: z.union([emailSchema, z.array(emailSchema)]).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    contentType: z.string().optional(),
  })).optional(),
  tracking: z.object({
    opens: z.boolean().optional(),
    clicks: z.boolean().optional(),
  }).optional(),
  metadata: z.record(z.any()).optional(),
}).refine((data) => !!data.html || !!data.text, {
  message: 'Either html or text is required',
  path: ['html'],
});

/**
 * SMS send request schema
 */
export const smsSendSchema = z.object({
  to: phoneSchema,
  message: z.string().min(1).max(1600), // SMS character limit
  from: phoneSchema.optional(),
  metadata: z.record(z.any()).optional(),
});

/**
 * Payment intent creation schema
 */
export const paymentIntentSchema = z.object({
  amount: z.number().positive().max(999999.99),
  currency: z.string().length(3).default('usd'),
  metadata: z.record(z.string()).optional(),
});

/**
 * Lead scoring request schema
 */
export const leadScoringSchema = z.union([
  z.object({
    action: z.enum(['score', 'batch-score', 'insights']),
    data: z.object({
      factors: z.object({
        email: z.string().email().optional(),
        company: z.string().optional(),
        title: z.string().optional(),
        industry: z.string().optional(),
        companySize: z.string().optional(),
        website: z.string().url().optional(),
        engagementScore: z.number().min(0).max(100).optional(),
        recencyScore: z.number().min(0).max(100).optional(),
        fitScore: z.number().min(0).max(100).optional(),
      }).optional(),
      leads: z.array(z.any()).optional(),
    }),
    }),
  // Lightweight payload used in tests and simple flows
  z.object({
    leadId: z.string().min(1),
    }),
]);

/**
 * Workflow execution schema
 */
export const workflowExecuteSchema = z.union([
  z.object({
    workflow: z.object({
      id: z.string(),
      name: z.string(),
      trigger: z.any(),
      actions: z.array(z.any()),
    }),
    triggerData: z.record(z.any()),
    }),
  // Simpler form used by tests
  z.object({
    workflowId: z.string(),
    triggerData: z.record(z.any()),
    }),
]);

/**
 * Campaign creation schema
 */
export const campaignCreateSchema = z.object({
  name: z.string().min(1).max(255),
  subject: z.string().min(1).max(255),
  html: z.string().min(1).optional(),
  text: z.string().optional(),
  templateId: z.string().optional(),
  recipientList: z.array(emailSchema),
  scheduleAt: z.string().datetime().optional(),
}).refine((data) => !!data.html || !!data.text || !!data.templateId, {
  message: 'Provide html, text, or templateId',
  path: ['html'],
});

/**
 * Checkout complete schema
 */
export const checkoutCompleteSchema = z.object({
  paymentIntentId: z.string().min(1),
  orderData: z.record(z.any()).optional(),
});

/**
 * Campaign action schema
 */
export const campaignActionSchema = z.object({
  action: z.enum(['create', 'send']),
  campaign: z.object({
    name: z.string().min(1).max(255),
    subject: z.string().min(1).max(255),
    html: z.string().min(1),
    text: z.string().optional(),
    recipientList: z.array(emailSchema),
      scheduleAt: z.string().datetime().optional(),
  }).optional(),
  campaignId: z.string().optional(),
});

/**
 * Lead nurture action schema
 */
export const leadNurtureSchema = z.object({
  action: z.enum(['create-sequence', 'enroll-lead', 'analyze-lifecycle', 'get-attribution']),
  data: z.object({
    sequence: z.any().optional(),
    leadId: z.string().optional(),
    sequenceId: z.string().optional(),
    model: z.string().optional(),
  }),
});

/**
 * Lead enrichment schema
 */
export const leadEnrichSchema = z.object({
  leadId: z.string().min(1),
  sources: z.record(z.any()).optional(),
});

/**
 * Agent chat schema
 */
export const agentChatSchema = z.object({
  customerId: z.string().min(1),
  message: z.string().min(1).max(10000),
  stream: z.boolean().optional().default(false),
});

/**
 * Search query schema
 */
export const searchQuerySchema = z.object({
  q: z.string().min(1).max(500),
  workspaceId: z.string().min(1),
  limit: z.number().int().min(1).max(100).optional().default(50),
});

/**
 * Subscription creation schema
 */
export const subscriptionCreateSchema = z.object({
  email: emailSchema,
  name: z.string().min(1).max(255).optional(),
  planId: z.string().min(1),
  trialDays: z.number().int().min(0).max(365).optional().default(14),
});

/**
 * Generic validation helper
 */
export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): {
  success: true;
  data: T;
} | {
  success: false;
  errors: z.ZodError;
} {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  } else {
    return { success: false, errors: result.error };
  }
}

/**
 * Sanitize string input (basic XSS prevention)
 */
export function sanitizeString(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .trim()
    .slice(0, 10000); // Max length
}

/**
 * Sanitize HTML (for rich text fields)
 */
export function sanitizeHTML(html: string): string {
  // Basic HTML sanitization - in production, use a library like DOMPurify
  return html
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    .replace(/on\w+="[^"]*"/gi, '') // Remove event handlers
    .replace(/javascript:/gi, ''); // Remove javascript: protocol
}

