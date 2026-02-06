/**
 * API Route: Start Competitive Monitoring
 * 
 * POST /api/battlecard/monitor/start
 * 
 * Start monitoring competitors for changes
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getCompetitiveMonitor, type CompetitorMonitorConfig } from '@/lib/battlecard';
import { logger } from '@/lib/logger/logger';

/** Request body interface for starting competitive monitoring */
interface StartMonitorRequestBody {
  organizationId: string;
  competitors: CompetitorMonitorConfig[];
}

/** Type guard for validating request body */
function isValidRequestBody(body: unknown): body is StartMonitorRequestBody {
  if (typeof body !== 'object' || body === null) {
    return false;
  }
  const b = body as Record<string, unknown>;
  return (
    typeof b.organizationId === 'string' &&
    Array.isArray(b.competitors)
  );
}

export async function POST(request: NextRequest) {
  try {
    const body: unknown = await request.json();

    if (!isValidRequestBody(body)) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: organizationId, competitors (array)' },
        { status: 400 }
      );
    }

    const { organizationId, competitors } = body;

    logger.info('API: Start competitive monitoring', {
      organizationId,
      competitorCount: competitors.length,
    });

    const monitor = getCompetitiveMonitor();

    // Add competitors to monitoring
    for (const config of competitors) {
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
    logger.error('API: Failed to start competitive monitoring', error instanceof Error ? error : new Error(String(error)));

    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
