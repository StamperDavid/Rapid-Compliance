/**
 * GET /api/cron/growth-competitor-monitor
 *
 * Weekly cron: Re-scan all active competitors for metric changes.
 * Schedule: 0 3 * * 1 (Mondays at 3AM UTC)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger/logger';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { getCompetitorMonitorService } from '@/lib/growth/competitor-monitor';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(request: NextRequest) {
  try {
    const authError = verifyCronAuth(request, '/api/cron/growth-competitor-monitor');
    if (authError) { return authError; }

    logger.info('Starting weekly competitor scan', {
      route: '/api/cron/growth-competitor-monitor',
    });

    const startTime = Date.now();
    const service = getCompetitorMonitorService();
    const result = await service.scanAllCompetitors();
    const durationMs = Date.now() - startTime;

    logger.info('Weekly competitor scan complete', {
      route: '/api/cron/growth-competitor-monitor',
      scanned: result.scanned,
      errors: result.errors.length,
      durationMs,
    });

    return NextResponse.json({
      success: true,
      scanned: result.scanned,
      errors: result.errors,
      durationMs,
    });
  } catch (err) {
    logger.error(
      'Growth competitor monitor cron failed',
      err instanceof Error ? err : new Error(String(err))
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
