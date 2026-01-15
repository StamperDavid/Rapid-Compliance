/**
 * API Route: Get Monitoring Stats
 * 
 * GET /api/battlecard/monitor/stats?organizationId=xxx
 * 
 * Get competitive monitoring statistics
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCompetitiveMonitor } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';

export function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Missing required parameter: organizationId' },
        { status: 400 }
      );
    }

    logger.info('API: Get monitoring stats', {
      organizationId,
    });

    const monitor = getCompetitiveMonitor(organizationId);
    const stats = monitor.getStats();

    return NextResponse.json({
      success: true,
      stats,
    });
  } catch (error) {
    logger.error('API: Failed to get monitoring stats', error);

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
