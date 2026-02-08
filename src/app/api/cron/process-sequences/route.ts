/**
 * Cron Job: Process Email Sequences
 * Runs every hour to process scheduled sequence steps
 *
 * Setup in Vercel:
 * - Add vercel.json with cron configuration
 * - Protect this endpoint with CRON_SECRET
 */

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 minutes max for large sequence batches

import { type NextRequest, NextResponse } from 'next/server';
import { processSequences } from '@/lib/outbound/sequence-scheduler';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';

export async function GET(request: NextRequest) {
  // Rate limiting (strict - internal cron only)
  const rateLimitResponse = await rateLimitMiddleware(request, '/api/cron/process-sequences');
  if (rateLimitResponse) {
    return rateLimitResponse;
  }

  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
      return errors.unauthorized();
    }

    logger.info('Processing sequences (cron)', { route: '/api/cron/process-sequences' });

    // Process all due sequences
    const result = await processSequences();

    logger.info('Cron completed', { route: '/api/cron/process-sequences', processed: result.processed, errors: result.errors });

    return NextResponse.json({
      success: true,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    logger.error('Fatal error processing sequences (cron)', error instanceof Error ? error : new Error(String(error)), { route: '/api/cron/process-sequences' });
    return errors.internal('Failed to process sequences', error instanceof Error ? error : undefined);
  }
}

// Allow both GET and POST (Vercel crons use GET, some systems use POST)
export const POST = GET;
