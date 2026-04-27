/**
 * API Route: Social Engagement Metrics
 *
 * GET /api/social/engagement → Get engagement metrics for published posts
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SocialMediaPost, PostMetrics } from '@/types/social';

export const dynamic = 'force-dynamic';

const SOCIAL_POSTS_COLLECTION = getSubCollection('social_posts');

interface PostWithEngagement {
  id: string;
  platform: string;
  content: string;
  publishedAt: string | null;
  metrics: PostMetrics;
}

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/engagement');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { where } = await import('firebase/firestore');

    // Fetch all published posts via single-field where (no composite
    // orderBy — the composite index isn't deployed and was spamming
    // FAILED_PRECONDITION errors every poll). Sort/slice in JS.
    // Result sets are tiny (~100s max for any tenant we care about),
    // so the perf delta is negligible. firestore.indexes.json carries
    // the matching composite for the day someone wants to push the
    // orderBy back into Firestore.
    const allPublished = (await AdminFirestoreService.getAll(
      SOCIAL_POSTS_COLLECTION,
      [where('status', '==', 'published')]
    ).catch(() => [])) as SocialMediaPost[];
    const publishedPosts = [...allPublished]
      .sort((a, b) => {
        const aTime = a.publishedAt ? new Date(a.publishedAt).getTime() : 0;
        const bTime = b.publishedAt ? new Date(b.publishedAt).getTime() : 0;
        return bTime - aTime; // descending
      })
      .slice(0, 100);

    // Filter to posts that have metrics data
    const postsWithMetrics = publishedPosts.filter(
      (p): p is SocialMediaPost & { metrics: PostMetrics } => !!p.metrics
    );

    // Calculate aggregate metrics
    let totalImpressions = 0;
    let totalEngagements = 0;
    let totalLikes = 0;
    let totalComments = 0;
    let totalShares = 0;

    const perPostData: PostWithEngagement[] = postsWithMetrics.map((post) => {
      const m = post.metrics;
      totalImpressions += m.impressions ?? 0;
      totalEngagements += m.engagements ?? 0;
      totalLikes += m.likes ?? 0;
      totalComments += m.comments ?? 0;
      totalShares += m.shares ?? 0;

      return {
        id: post.id,
        platform: post.platform,
        content: post.content.substring(0, 150),
        publishedAt: post.publishedAt ? new Date(post.publishedAt).toISOString() : null,
        metrics: {
          impressions: m.impressions ?? 0,
          engagements: m.engagements ?? 0,
          likes: m.likes ?? 0,
          comments: m.comments ?? 0,
          shares: m.shares ?? 0,
          clicks: m.clicks ?? 0,
          reach: m.reach ?? 0,
        },
      };
    });

    const engagementRate = totalImpressions > 0
      ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
      : 0;

    return NextResponse.json({
      success: true,
      aggregate: {
        totalPublished: publishedPosts.length,
        postsWithMetrics: postsWithMetrics.length,
        totalImpressions,
        totalEngagements,
        totalLikes,
        totalComments,
        totalShares,
        engagementRate,
      },
      posts: perPostData,
    });
  } catch (error: unknown) {
    logger.error('Engagement API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to load engagement metrics' },
      { status: 500 }
    );
  }
}
