/**
 * Social Metrics Collector Cron Endpoint
 *
 * Fetches engagement metrics for published social media posts and
 * triggers processing of scheduled posts.
 *
 * Recommended schedule: every 2-4 hours
 * Authentication: Bearer token via CRON_SECRET
 *
 * GET /api/cron/social-metrics-collector
 */

import { type NextRequest, NextResponse } from 'next/server';
import { collectEngagementMetrics } from '@/lib/social/engagement-metrics-collector';
import { logger } from '@/lib/logger/logger';
import { emitBusinessEvent } from '@/lib/orchestration/event-router';

export const dynamic = 'force-dynamic';
export const maxDuration = 120; // 2 minutes max — metrics collection can be slow

/**
 * GET /api/cron/social-metrics-collector
 * Collect engagement metrics and process scheduled posts
 */
export async function GET(request: NextRequest) {
  try {
    // Verify this is a legitimate cron request
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Fail closed: require CRON_SECRET
    if (!cronSecret) {
      logger.error('CRON_SECRET not configured - rejecting request', new Error('Missing CRON_SECRET'), {
        route: '/api/cron/social-metrics-collector',
      });
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
    }

    if (!authHeader || authHeader !== `Bearer ${cronSecret}`) {
      logger.error('Unauthorized cron access attempt', new Error('Invalid cron secret'), {
        route: '/api/cron/social-metrics-collector',
        method: 'GET',
      });
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    logger.info('Starting social metrics collection', {
      route: '/api/cron/social-metrics-collector',
      method: 'GET',
    });

    // 1. Collect engagement metrics from platform APIs
    const metricsResult = await collectEngagementMetrics();

    // Emit events for each updated post
    if (metricsResult.updates && metricsResult.updates.length > 0) {
      for (const update of metricsResult.updates) {
        const avgEngagement = (update.previousMetrics?.engagements ?? 0);
        const currentEngagement = update.currentMetrics.engagements ?? 0;
        const engagementMultiplier = avgEngagement > 0 ? currentEngagement / avgEngagement : 1.0;
        const impressions = update.currentMetrics.impressions ?? 0;
        const engagementRate = impressions > 0 ? (currentEngagement / impressions) * 100 : 0;

        void emitBusinessEvent('post.metrics.updated', 'cron/social-metrics-collector', {
          postId: update.postId,
          platform: update.platform,
          platformPostId: update.platformPostId,
          metrics: {
            impressions: update.currentMetrics.impressions,
            engagements: update.currentMetrics.engagements,
            likes: update.currentMetrics.likes,
            comments: update.currentMetrics.comments,
            shares: update.currentMetrics.shares,
            clicks: update.currentMetrics.clicks,
          },
          engagementRate: Math.round(engagementRate * 100) / 100,
          engagementMultiplier: Math.round(engagementMultiplier * 100) / 100,
          delta: update.delta,
        });
      }
    }

    // 2. Process scheduled posts that are due
    let scheduledResult: { processed: number; errors: string[] } = {
      processed: 0,
      errors: [],
    };

    try {
      const { createPostingAgent } = await import('@/lib/social/autonomous-posting-agent');
      const agent = await createPostingAgent();
      const batchResult = await agent.processScheduledPosts();

      scheduledResult = {
        processed: batchResult.successCount + batchResult.failureCount,
        errors: batchResult.results
          .filter(r => !r.success && r.error)
          .map(r => r.error as string),
      };
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      scheduledResult.errors.push(`Scheduled post processing error: ${errorMsg}`);
      logger.error('Failed to process scheduled posts',
        error instanceof Error ? error : new Error(errorMsg), {
          route: '/api/cron/social-metrics-collector',
        });
    }

    return NextResponse.json({
      success: metricsResult.success && scheduledResult.errors.length === 0,
      metrics: {
        postsScanned: metricsResult.postsScanned,
        postsUpdated: metricsResult.postsUpdated,
        errors: metricsResult.errors,
        durationMs: metricsResult.durationMs,
      },
      scheduledPosts: {
        processed: scheduledResult.processed,
        errors: scheduledResult.errors,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    logger.error('Social metrics collector error',
      error instanceof Error ? error : new Error(String(error)), {
        route: '/api/cron/social-metrics-collector',
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
