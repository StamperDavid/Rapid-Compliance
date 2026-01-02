/**
 * Template API Validation Schemas
 * Zod schemas for input validation across all template endpoints
 */

import { z } from 'zod';

/**
 * Schema for applying a template to an organization
 */
export const ApplyTemplateSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1).optional(),
  templateId: z.string().min(1, 'Template ID is required'),
  merge: z.boolean().optional().default(false),
  applyWorkflows: z.boolean().optional().default(true),
  applyBestPractices: z.boolean().optional().default(true)
});

export type ApplyTemplateInput = z.infer<typeof ApplyTemplateSchema>;

/**
 * Schema for deal scoring request
 */
export const ScoreDealSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  dealId: z.string().min(1, 'Deal ID is required'),
  templateId: z.string().min(1).optional()
});

export type ScoreDealInput = z.infer<typeof ScoreDealSchema>;

/**
 * Forecast period enum
 */
export const ForecastPeriodSchema = z.enum([
  '30-day',
  '60-day',
  '90-day',
  'quarter',
  'annual'
]);

/**
 * Schema for revenue forecasting request
 */
export const RevenueForecastSchema = z.object({
  organizationId: z.string().min(1, 'Organization ID is required'),
  workspaceId: z.string().min(1, 'Workspace ID is required'),
  period: ForecastPeriodSchema.default('90-day'),
  quota: z.number().positive('Quota must be positive').optional(),
  templateId: z.string().min(1).optional(),
  includeQuotaPerformance: z.boolean().optional().default(true)
});

export type RevenueForecastInput = z.infer<typeof RevenueForecastSchema>;

/**
 * Helper function to validate request body with Zod schema
 * Returns { success: true, data } or { success: false, error }
 */
export function validateRequestBody<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { success: true; data: T } | { success: false; error: string; details?: z.ZodError } {
  try {
    const data = schema.parse(body);
    return { success: true, data };
  } catch (error) {
    if (error instanceof z.ZodError) {
      // Format Zod errors into readable message
      const errorMessages = error.errors.map(err => {
        const path = err.path.join('.');
        return `${path ? path + ': ' : ''}${err.message}`;
      });
      
      return {
        success: false,
        error: errorMessages.join(', '),
        details: error
      };
    }
    
    return {
      success: false,
      error: 'Invalid request body'
    };
  }
}

/**
 * Helper function to validate request body and return formatted error response
 * Returns null if validation succeeds, NextResponse if validation fails
 */
export function validateOrReturnError<T>(
  schema: z.ZodSchema<T>,
  body: unknown
): { data: T } | { error: Response } {
  const validation = validateRequestBody(schema, body);
  
  if (!validation.success) {
    return {
      error: new Response(
        JSON.stringify({
          success: false,
          error: 'Validation failed',
          message: validation.error,
          details: validation.details?.errors
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    };
  }
  
  return { data: validation.data };
}
