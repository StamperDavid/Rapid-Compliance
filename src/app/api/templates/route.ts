/**
 * Templates API
 * GET /api/templates - List all available industry templates
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { listTemplates } from '@/lib/templates';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware, RateLimitPresets } from '@/lib/middleware/rate-limiter';

export const dynamic = 'force-dynamic';

/**
 * GET /api/templates
 * List all available industry templates with metadata
 */
export async function GET(request: NextRequest) {
  // Rate limiting: 120 requests per minute (read operation)
  const rateLimitResponse = await rateLimitMiddleware(request, RateLimitPresets.READS);
  if (rateLimitResponse) {
    return rateLimitResponse;
  }
  
  try {
    logger.info('Listing industry templates');
    
    const templates = listTemplates();
    
    return NextResponse.json({
      success: true,
      templates,
      count: templates.length
    });
    
  } catch (error) {
    logger.error('Failed to list templates', error as Error);
    
    return NextResponse.json({
      success: false,
      error: 'Failed to list templates',
      message: (error as Error).message
    }, { status: 500 });
  }
}
