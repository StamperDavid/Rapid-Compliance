/**
 * API Route: Process Discovery Queue
 *
 * Endpoint to trigger the discovery dispatcher.
 * Can be called manually or via Vercel Cron.
 *
 * POST /api/discovery/queue/process
 */

export const dynamic = 'force-dynamic';

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { processDiscoveryQueue } from '@/lib/services/discovery-dispatcher';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

const ProcessQueueSchema = z.object({
  batchSize: z.number().int().positive().optional(),
  concurrency: z.number().int().positive().optional(),
  maxRetries: z.number().int().nonnegative().optional(),
  delayMs: z.number().int().nonnegative().optional(),
});

export async function POST(request: NextRequest) {
  try {
    // Authentication
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    logger.info('[API] Discovery queue processing started');

    // Parse request body for config options — body is optional for this endpoint
    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = ProcessQueueSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const config = {
      batchSize: parsed.data.batchSize ?? 10,
      concurrency: parsed.data.concurrency ?? 3,
      maxRetries: parsed.data.maxRetries ?? 3,
      delayMs: parsed.data.delayMs ?? 2000,
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
    logger.error('[API] Discovery queue processing failed', error instanceof Error ? error : new Error(String(error)));

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
