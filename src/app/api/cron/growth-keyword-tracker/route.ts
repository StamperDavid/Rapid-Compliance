/**
 * GET /api/cron/growth-keyword-tracker
 *
 * Daily cron: Check SERP rankings for all tracked keywords.
 * Schedule: 0 5 * * * (Daily at 5AM UTC)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { getKeywordTrackerService } from '@/lib/growth/keyword-tracker';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (!cronSecret) {
      logger.error('CRON_SECRET not configured', new Error('Missing CRON_SECRET'), {
        route: '/api/cron/growth-keyword-tracker',
      });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
        route: '/api/cron/growth-keyword-tracker',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting daily keyword ranking check', {
      route: '/api/cron/growth-keyword-tracker',
    });

    const startTime = Date.now();
    const service = getKeywordTrackerService();
    const result = await service.checkAllRankings();
    const durationMs = Date.now() - startTime;

    logger.info('Daily keyword ranking check complete', {
      route: '/api/cron/growth-keyword-tracker',
      checked: result.checked,
      improved: result.improved,
      declined: result.declined,
      errors: result.errors.length,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      checked: result.checked,
      improved: result.improved,
      declined: result.declined,
      errors: result.errors,
      durationMs,
    });
  } catch (err) {
    logger.error(
      'Growth keyword tracker cron failed',
      err instanceof Error ? err : new Error(String(err))
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
