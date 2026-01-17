/**
 * Scheduled Publisher Cron Endpoint
 * Trigger scheduled publishing of pages and blog posts
 * This should be called by a cron job (e.g., Vercel Cron or external service)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { runScheduledPublisher } from '@/lib/scheduled-publisher';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60; // 60 seconds max execution

/**
 * GET /api/cron/scheduled-publisher
 * Process all scheduled publications
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // If CRON_SECRET is set, require authentication
    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
          route: '/api/cron/scheduled-publisher',
          method: 'GET'
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    logger.info('Starting scheduled publisher', {
      route: '/api/cron/scheduled-publisher',
      method: 'GET'
    });

    const result = await runScheduledPublisher();

    return NextResponse.json({
      success: true,
      ...result,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Scheduled publisher error', error instanceof Error ? error : undefined, {
      route: '/api/cron/scheduled-publisher',
      method: 'GET'
    });
    return NextResponse.json(
      {
        success: false,
        error: errorMessage,
        timestamp: new Date().toISOString(),
      },
      { status: 500 }
    );
  }
}
