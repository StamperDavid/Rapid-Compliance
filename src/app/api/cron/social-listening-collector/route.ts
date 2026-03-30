/**
 * Cron Endpoint: Social Listening Collector
 *
 * GET /api/cron/social-listening-collector
 *
 * Runs ListeningService.collectMentions() to fetch new mentions
 * from all enabled platforms. Designed to be called by a cron scheduler.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { ListeningService } from '@/lib/social/listening-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/cron/social-listening-collector');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authError = verifyCronAuth(request, '/api/cron/social-listening-collector');
    if (authError) { return authError; }

    logger.info('Cron: Social listening collector starting');

    const result = await ListeningService.collectMentions();

    logger.info('Cron: Social listening collector complete', {
      collected: result.collected,
      errors: result.errors.length,
    });

    return NextResponse.json({
      success: true,
      collected: result.collected,
      errors: result.errors,
    });
  } catch (error: unknown) {
    logger.error('Cron: Social listening collector failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Collector failed' },
      { status: 500 }
    );
  }
}
