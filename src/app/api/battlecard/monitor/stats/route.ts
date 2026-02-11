/**
 * API Route: Get Monitoring Stats
 *
 * GET /api/battlecard/monitor/stats
 *
 * Get competitive monitoring statistics
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCompetitiveMonitor } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    logger.info('API: Get monitoring stats');

    const monitor = getCompetitiveMonitor();
    const stats = monitor.getStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('API: Failed to get monitoring stats', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
