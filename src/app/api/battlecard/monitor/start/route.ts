/**
 * API Route: Start Competitive Monitoring
 * 
 * POST /api/battlecard/monitor/start
 * 
 * Start monitoring competitors for changes
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { getCompetitiveMonitor, type CompetitorMonitorConfig } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { organizationId, competitors } = body;

    if (!organizationId || !competitors || !Array.isArray(competitors)) {
      return NextResponse.json(
        { error: 'Missing required fields: organizationId, competitors (array)' },
        { status: 400 }
      );
    }

    logger.info('API: Start competitive monitoring', {
      organizationId,
      competitorCount: competitors.length,
    });

    const monitor = getCompetitiveMonitor(organizationId);

    // Add competitors to monitoring
    for (const config of competitors as CompetitorMonitorConfig[]) {
      monitor.addCompetitor(config);
    }

    // Start monitoring
    await monitor.start();

    const stats = monitor.getStats();

    return NextResponse.json({
      success: true,
      message: 'Competitive monitoring started',
      stats,
    });
  } catch (error) {
    logger.error('API: Failed to start competitive monitoring', error);
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    );
  }
}
