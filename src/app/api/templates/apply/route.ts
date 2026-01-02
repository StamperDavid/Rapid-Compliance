/**
 * Apply Template API
 * POST /api/templates/apply - Apply an industry template to an organization
 */

import { NextRequest, NextResponse } from 'next/server';
import { applyTemplate } from '@/lib/templates';
import { ApplyTemplateSchema, validateRequestBody } from '@/lib/templates/validation';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * POST /api/templates/apply
 * Apply an industry template to an organization
 * 
 * Body:
 * {
 *   organizationId: string;
 *   workspaceId?: string;
 *   templateId: string;
 *   merge?: boolean;
 *   applyWorkflows?: boolean;
 *   applyBestPractices?: boolean;
 * }
 */
export async function POST(request: NextRequest) {
  // Rate limiting: 30 requests per minute (mutation operation)
  const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.MUTATIONS);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    const body = await request.json();
    
    // Validate request body with Zod schema
    const validation = validateRequestBody(ApplyTemplateSchema, body);
    
    if (validation.success === false) {
      return NextResponse.json({
        success: false,
        error: 'Validation failed',
        message: validation.error,
        details: validation.details?.errors
      }, { status: 400 });
    }
    
    const {
      organizationId,
      workspaceId,
      templateId,
      merge,
      applyWorkflows,
      applyBestPractices
    } = validation.data;
    
    logger.info('Applying industry template', {
      orgId: organizationId,
      templateId,
      merge
    });
    
    const result = await applyTemplate({
      organizationId,
      workspaceId,
      templateId,
      merge,
      applyWorkflows,
      applyBestPractices
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
    logger.error('Failed to apply template', error as Error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to apply template',
      message: (error as Error).message
    }, { status: 500 });
  }
}
