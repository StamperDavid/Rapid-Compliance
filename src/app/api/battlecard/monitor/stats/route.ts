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
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

export function GET(_request: NextRequest) {
  try {
    logger.info('API: Get monitoring stats', {
      organizationId: DEFAULT_ORG_ID,
    });

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
