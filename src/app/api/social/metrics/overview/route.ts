/**
 * API Route: Social Metrics Overview
 *
 * GET /api/social/metrics/overview
 *
 * Cross-platform aggregates for the Social Hub. Reads `social_posts`
 * (status='published'), computes totals, by-platform breakdown, and a
 * 30-day trend in JS to avoid composite-index requirements (matches the
 * existing `/api/social/engagement` defensive pattern).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getSocialMetricsOverview } from '@/lib/social/metrics-service';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(
      request,
      '/api/social/metrics/overview',
    );
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const overview = await getSocialMetricsOverview();

    return NextResponse.json({
      success: true,
      totals: overview.totals,
      byPlatform: overview.byPlatform,
      trend: overview.trend,
    });
  } catch (error: unknown) {
    logger.error(
      'Social Metrics Overview API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: 'Failed to load social metrics overview' },
      { status: 500 },
    );
  }
}
