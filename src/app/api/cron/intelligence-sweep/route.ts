/**
 * Intelligence Sweep Cron Endpoint
 *
 * Runs daily intelligence gathering: competitor monitoring, funding announcements,
 * hiring signals, tech stack changes. Every signal discovered is written to
 * MemoryVault as a SIGNAL entry for consumption by Revenue Director and Marketing Manager.
 *
 * Authentication: Bearer token via CRON_SECRET
 *
 * GET /api/cron/intelligence-sweep?depth=quick|standard|deep
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { logger } from '@/lib/logger/logger';
import { getIntelligenceManager } from '@/lib/agents/intelligence/manager';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for deep intelligence gathering

// ============================================================================
// TYPES & VALIDATION
// ============================================================================

const QueryParamsSchema = z.object({
  depth: z.enum(['quick', 'standard', 'deep']).optional().default('standard'),
});

type QueryParams = z.infer<typeof QueryParamsSchema>;

interface IntelligenceSweepResponse {
  success: boolean;
  sweepId: string;
  depth: string;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  totalSignals: number;
  highUrgencySignals: number;
  sweeps: Array<{
    type: string;
    status: string;
    signalsFound: number;
    executionTimeMs: number;
    error?: string;
  }>;
  summary: string;
}

// ============================================================================
// API ROUTE HANDLER
// ============================================================================

/**
 * GET /api/cron/intelligence-sweep
 * Run daily intelligence sweep across all specialist domains
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret) {
      if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
        logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
          route: '/api/cron/intelligence-sweep',
          method: 'GET',
        });
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    }

    // Parse and validate query parameters
    const { searchParams } = new URL(request.url);
    const depthParam = searchParams.get('depth') ?? 'standard';

    let queryParams: QueryParams;
    try {
      queryParams = QueryParamsSchema.parse({ depth: depthParam });
    } catch (error) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: error instanceof z.ZodError ? error.errors : String(error),
        },
        { status: 400 }
      );
    }

    logger.info('Starting intelligence sweep', {
      route: '/api/cron/intelligence-sweep',
      method: 'GET',
      depth: queryParams.depth,
    });

    const startTime = Date.now();

    // Get Intelligence Manager and initialize
    const manager = getIntelligenceManager();
    await manager.initialize();

    // Run the daily intelligence sweep
    const result = await manager.runDailyIntelligenceSweep();

    const durationMs = Date.now() - startTime;

    logger.info(`Intelligence sweep completed: ${result.totalSignals} signals discovered`, {
      sweepId: result.sweepId,
      highUrgencySignals: result.highUrgencySignals,
      durationMs,
    });

    const response: IntelligenceSweepResponse = {
      success: true,
      sweepId: result.sweepId,
      depth: queryParams.depth,
      startedAt: result.startedAt.toISOString(),
      completedAt: result.completedAt.toISOString(),
      durationMs,
      totalSignals: result.totalSignals,
      highUrgencySignals: result.highUrgencySignals,
      sweeps: result.sweeps.map(sweep => ({
        type: sweep.type,
        status: sweep.status,
        signalsFound: sweep.signalsFound,
        executionTimeMs: sweep.executionTimeMs,
        error: sweep.error,
      })),
      summary: result.summary,
    };

    return NextResponse.json(response);
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    const errorObj = error instanceof Error ? error : new Error(String(error));
    logger.error('Intelligence sweep error', errorObj, {
      route: '/api/cron/intelligence-sweep',
      method: 'GET',
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
