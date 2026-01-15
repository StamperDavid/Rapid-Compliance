/**
 * API Route: Process Discovery Queue
 *
 * Endpoint to trigger the discovery dispatcher.
 * Can be called manually or via Vercel Cron.
 *
 * POST /api/discovery/queue/process
 */

import { type NextRequest, NextResponse } from 'next/server';
import { processDiscoveryQueue } from '@/lib/services/discovery-dispatcher';
import { logger } from '@/lib/logger/logger';

interface RequestPayload {
  batchSize?: number;
  concurrency?: number;
  maxRetries?: number;
  delayMs?: number;
  organizationId?: string;
}

export async function POST(request: NextRequest) {
  try {
    logger.info('[API] Discovery queue processing started');

    // Parse request body for config options
    const body = await request.json().catch(() => ({})) as RequestPayload;

    const config = {
      batchSize: body.batchSize ?? 10,
      concurrency: body.concurrency ?? 3,
      maxRetries: body.maxRetries ?? 3,
      delayMs: body.delayMs ?? 2000,
      organizationId: body.organizationId,
    };

    // Process the queue
    const result = await processDiscoveryQueue(config);

    logger.info('[API] Discovery queue processing complete', {
      total: result.stats.total,
      succeeded: result.stats.succeeded,
      failed: result.stats.failed,
      totalCost: result.totalUsage.cost,
    });

    return NextResponse.json({
      success: true,
      message: 'Discovery queue processed',
      stats: result.stats,
      usage: {
        totalCost: result.totalUsage.cost,
        totalTokens: result.totalUsage.tokens,
        durationMs: result.totalUsage.durationMs,
      },
      results: result.results.map(r => ({
        success: r.success,
        error: r.error ? {
          code: r.error.code,
          message: r.error.message,
        } : undefined,
        usage: r.usage,
      })),
    });
  } catch (error) {
    logger.error('[API] Discovery queue processing failed', error);

    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    );
  }
}

// Support GET for Vercel Cron (Cron jobs use GET by default)
export async function GET(request: NextRequest) {
  // Verify cron secret to prevent unauthorized access
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json(
      { error: 'Unauthorized' },
      { status: 401 }
    );
  }

  // Forward to POST handler
  return POST(request);
}
