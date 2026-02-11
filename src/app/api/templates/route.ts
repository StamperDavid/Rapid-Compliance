/**
 * Templates API
 * GET /api/templates - List all available industry templates
 */

import { type NextRequest, NextResponse } from 'next/server';
import { listTemplates } from '@/lib/templates';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates
 * List all available industry templates with metadata
 */
export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // Rate limiting: 120 requests per minute (read operation)
    const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.READS);
    if (rateLimitResponse) {
      return rateLimitResponse;
    }

    logger.info('Listing industry templates');
    
    const templates = listTemplates();
    
    return NextResponse.json({
      success: true,
      templates,
      count: templates.length
    });
    
  } catch (error) {
    logger.error('Failed to list templates', error instanceof Error ? error : new Error(String(error)));

    return NextResponse.json({
      success: false,
      error: 'Failed to list templates',
      message: (error as Error).message
    }, { status: 500 });
  }
}
