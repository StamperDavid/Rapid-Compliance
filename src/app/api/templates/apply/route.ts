/**
 * Apply Template API
 * POST /api/templates/apply - Apply an industry template to an organization
 */

import { type NextRequest, NextResponse } from 'next/server';
import { applyTemplate } from '@/lib/templates';
import { ApplyTemplateSchema, validateRequestBody } from '@/lib/templates/validation';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/apply
 * Apply an industry template to an organization
 *
 * Body:
 * {
 *   workspaceId?: string;
 *   templateId: string;
 *   merge?: boolean;
 *   applyWorkflows?: boolean;
 *   applyBestPractices?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Rate limiting: 30 requests per minute (mutation operation)
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.MUTATIONS);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    const body: unknown = await request.json();
    
    // Validate request body with Zod schema
    const validation = validateRequestBody(ApplyTemplateSchema, body);
    
    if (validation.success === false) {
      const { error, details } = validation;
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        message: error,
        details: details?.errors
      }, { status: 400 });
    }
    
    const {
      workspaceId,
      templateId,
      merge,
      applyWorkflows,
      applyBestPractices
    } = validation.data;
    
    logger.info('Applying industry template', {
      templateId,
      merge
    });
    
    const result = await applyTemplate({
      workspaceId,
      templateId,
      merge: merge ?? false,
      applyWorkflows: applyWorkflows ?? true,
      applyBestPractices: applyBestPractices ?? true
    });
    
    if (!result.success) {
      return NextResponse.json({
        success: false,
        error: 'Template application failed',
        errors: result.errors
      }, { status: 400 });
    }
    
    return NextResponse.json({
      success: true,
      result
    });
    
  } catch (error) {
    logger.error('Failed to apply template', error instanceof Error ? error : new Error(String(error)), { route: '/api/templates/apply' });

    return NextResponse.json({
      success: false,
      error: 'Failed to apply template',
      message: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
