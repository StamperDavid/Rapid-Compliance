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
import { AgentConfigService } from '@/lib/social/agent-config-service';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

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

    // Evergreen queue drip. The position-ordered `social_queue` previously never
    // published — no worker drained it. It now drips here, SAFELY: opt-in
    // (config.autoQueueEnabled, default false, so it never auto-posts to real
    // audiences unannounced) and rate-limited to `maxDailyPosts`/day via a
    // marker, so this 5-minute cron publishes at most one queued post per
    // (24h / maxDailyPosts). A failure here never affects scheduled posts.
    let queueDrained = 0;
    try {
      const config = await AgentConfigService.getConfig();
      if (config.autoQueueEnabled === true) {
        const MARKER_ID = 'social_queue_marker';
        const markerPath = getSubCollection('settings');
        const marker = await AdminFirestoreService.get<{ lastQueueDrainAt?: string }>(markerPath, MARKER_ID);
        const lastAt = marker?.lastQueueDrainAt ? Date.parse(marker.lastQueueDrainAt) : 0;
        const perDay = Math.max(1, config.maxDailyPosts);
        const intervalMs = Math.floor(86_400_000 / perDay);
        const now = Date.now();
        if (now - lastAt >= intervalMs) {
          const queueBatch = await agent.processQueue(1);
          queueDrained = queueBatch.successCount;
          await AdminFirestoreService.set(markerPath, MARKER_ID, { lastQueueDrainAt: new Date(now).toISOString() }, true);
          logger.info('Evergreen queue drip published', { route, queueDrained, intervalMs });
        }
      }
    } catch (queueErr) {
      logger.error('Evergreen queue drip failed (scheduled posts unaffected)',
        queueErr instanceof Error ? queueErr : new Error(String(queueErr)), { route });
    }

    const errors = batch.results
      .filter((r) => !r.success && r.error)
      .map((r) => r.error as string);

    logger.info('Scheduled social publisher finished', {
      route,
      successCount: batch.successCount,
      failureCount: batch.failureCount,
      errorCount: errors.length,
      queueDrained,
    });

    return NextResponse.json({
      success: errors.length === 0,
      processed: batch.successCount + batch.failureCount,
      successCount: batch.successCount,
      failureCount: batch.failureCount,
      queueDrained,
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
