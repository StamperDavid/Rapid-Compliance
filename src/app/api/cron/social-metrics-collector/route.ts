/**
 * Social Metrics Collector Cron Endpoint
 *
 * Fetches engagement metrics for published social media posts.
 *
 * Scheduled-post processing was moved to its own dedicated cron
 * (/api/cron/scheduled-social-publisher, every 5 min) — this endpoint
 * is now metrics-only.
 *
 * Recommended schedule: every 2-4 hours
 * Authentication: Bearer token via CRON_SECRET
 *
 * GET /api/cron/social-metrics-collector
 */

import { type NextRequest, NextResponse } from 'next/server';
import { collectEngagementMetrics } from '@/lib/social/engagement-metrics-collector';
import { logger } from '@/lib/logger/logger';
import { verifyCronAuth } from '@/lib/auth/api-auth';
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
    const authError = verifyCronAuth(request, '/api/cron/social-metrics-collector');
    if (authError) { return authError; }

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

    return NextResponse.json({
      success: metricsResult.success,
      metrics: {
        postsScanned: metricsResult.postsScanned,
        postsUpdated: metricsResult.postsUpdated,
        errors: metricsResult.errors,
        durationMs: metricsResult.durationMs,
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
