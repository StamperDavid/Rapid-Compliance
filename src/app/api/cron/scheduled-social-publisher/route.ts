/**
 * Scheduled Social Publisher Cron Endpoint
 *
 * Picks up scheduled social posts whose scheduledAt has passed and publishes
 * them to their platform. Uses adminDb under the hood.
 *
 * Schedule: every 5 minutes (see vercel.json)
 * Auth: Bearer token via CRON_SECRET
 *
 * GET /api/cron/scheduled-social-publisher
 */

import { type NextRequest, NextResponse } from 'next/server';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest): Promise<NextResponse> {
  const route = '/api/cron/scheduled-social-publisher';
  try {
    const authError = verifyCronAuth(request, route);
    if (authError) { return authError; }

    logger.info('Scheduled social publisher starting', { route });

    const { createPostingAgent } = await import('@/lib/social/autonomous-posting-agent');
    const agent = await createPostingAgent();
    const batch = await agent.processScheduledPosts();

    const errors = batch.results
      .filter((r) => !r.success && r.error)
      .map((r) => r.error as string);

    logger.info('Scheduled social publisher finished', {
      route,
      successCount: batch.successCount,
      failureCount: batch.failureCount,
      errorCount: errors.length,
    });

    return NextResponse.json({
      success: errors.length === 0,
      processed: batch.successCount + batch.failureCount,
      successCount: batch.successCount,
      failureCount: batch.failureCount,
      errors,
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Scheduled social publisher failed',
      error instanceof Error ? error : new Error(errorMessage), { route });
    return NextResponse.json(
      { success: false, error: errorMessage, timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }
}
