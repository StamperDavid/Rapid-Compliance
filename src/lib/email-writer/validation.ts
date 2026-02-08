/**
 * Email Writer Validation Schemas
 * 
 * Zod schemas for validating email generation API requests.
 * Provides type-safe validation with detailed error messages.
 * 
 * SCHEMAS:
 * - GenerateEmailSchema - Validate email generation requests
 * - GenerateEmailVariantsSchema - Validate A/B testing variant generation
 * 
 * USAGE:
 * ```typescript
 * const result = GenerateEmailSchema.safeParse(requestBody);
 * if (!result.success) {
 *   return NextResponse.json({ error: result.error }, { status: 400 });
 * }
 * const validData = result.data;
 * ```
 */

import { z } from 'zod';

// ============================================================================
// BASE SCHEMAS
// ============================================================================

/**
 * Email Type Schema
 */
const EmailTypeSchema = z.enum(['intro', 'follow-up', 'proposal', 'close', 're-engagement'], {
  errorMap: () => ({
    message: 'Email type must be one of: intro, follow-up, proposal, close, re-engagement',
  }),
});

/**
 * Tone Schema
 */
const ToneSchema = z.enum(['professional', 'casual', 'consultative', 'urgent', 'friendly'], {
  errorMap: () => ({
    message: 'Tone must be one of: professional, casual, consultative, urgent, friendly',
  }),
});

/**
 * Length Schema
 */
const LengthSchema = z.enum(['short', 'medium', 'long'], {
  errorMap: () => ({
    message: 'Length must be one of: short, medium, long',
  }),
});

// ============================================================================
// GENERATE EMAIL SCHEMA
// ============================================================================

/**
 * Schema for generating a single sales email
 */
export const GenerateEmailSchema = z.object({
  // Required fields
  workspaceId: z
    .string()
    .min(1, 'Workspace ID is required')
    .max(100, 'Workspace ID is too long'),
  
  userId: z
    .string()
    .min(1, 'User ID is required')
    .max(100, 'User ID is too long'),
  
  emailType: EmailTypeSchema,
  
  dealId: z
    .string()
    .min(1, 'Deal ID is required')
    .max(100, 'Deal ID is too long'),
  
  // Optional recipient context
  recipientName: z
    .string()
    .min(1, 'Recipient name cannot be empty')
    .max(200, 'Recipient name is too long')
    .optional(),
  
  recipientEmail: z
    .string()
    .email('Invalid email address')
    .optional(),
  
  recipientTitle: z
    .string()
    .max(200, 'Recipient title is too long')
    .optional(),
  
  companyName: z
    .string()
    .max(200, 'Company name is too long')
    .optional(),
  
  // Optional competitive context
  competitorDomain: z
    .string()
    .url('Invalid competitor domain URL')
    .optional()
    .or(z.literal('')),
  
  // Optional template context
  templateId: z
    .string()
    .max(100, 'Template ID is too long')
    .optional(),
  
  // Optional customization
  tone: ToneSchema.optional(),
  
  length: LengthSchema.optional(),
  
  includeCompetitive: z
    .boolean()
    .default(false),
  
  includeSocialProof: z
    .boolean()
    .default(true),
  
  customInstructions: z
    .string()
    .max(1000, 'Custom instructions are too long (max 1000 characters)')
    .optional(),
}).strict(); // Reject unknown fields

/**
 * Infer TypeScript type from Zod schema
 */
export type GenerateEmailRequest = z.infer<typeof GenerateEmailSchema>;

// ============================================================================
// GENERATE EMAIL VARIANTS SCHEMA
// ============================================================================

/**
 * Schema for generating multiple email variants (A/B testing)
 */
export const GenerateEmailVariantsSchema = GenerateEmailSchema.extend({
  variantCount: z
    .number()
    .int('Variant count must be an integer')
    .min(2, 'Must generate at least 2 variants')
    .max(5, 'Cannot generate more than 5 variants')
    .default(3),
}).strict();

/**
 * Infer TypeScript type from Zod schema
 */
export type GenerateEmailVariantsRequest = z.infer<typeof GenerateEmailVariantsSchema>;

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Validate request body and return parsed data or error
 * 
 * @param body - Request body to validate
 * @param schema - Zod schema to validate against
 * @returns Validation result with data or error
 */
export function validateRequestBody<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): { success: true; data: T } | { success: false; error: string; details: unknown } {
  const result = schema.safeParse(body);
  
  if (!result.success) {
    const errorDetails = result.error.format();
    const firstError = result.error.errors[0];
    
    return {
      success: false,
      error: firstError?.message || 'Validation failed',
      details: errorDetails,
    };
  }
  
  return {
    success: true,
    data: result.data,
  };
}

/**
 * Validate request body and return NextResponse with error if invalid
 * 
 * Helper for API routes to validate and return error response in one call.
 * 
 * @param body - Request body to validate
 * @param schema - Zod schema to validate against
 * @returns Validated data if successful, null if validation failed (response already sent)
 */
export function validateOrReturnError<T>(
  body: unknown,
  schema: z.ZodSchema<T>
): T | null {
  const result = validateRequestBody(body, schema);
  
  if (!result.success) {
    // Return null to indicate validation failed
    // The API route should handle returning the error response
    return null;
  }
  
  return result.data;
}

// ============================================================================
// EXPORTS
// ============================================================================

export {
  EmailTypeSchema,
  ToneSchema,
  LengthSchema,
};
