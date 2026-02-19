/**
 * API Route: Social Activity Feed
 *
 * GET /api/social/activity → Recent agent actions, decisions, and events
 *
 * Returns a chronological feed of:
 * - Posts published (with platform and time)
 * - Posts skipped (with reason — velocity limit, sentiment block, etc.)
 * - Approvals triggered (with flag reason)
 * - Scheduled posts created
 * - Errors/failures
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { FirestoreService } from '@/lib/db/firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SocialMediaPost, ApprovalItem, QueuedPost } from '@/types/social';

export const dynamic = 'force-dynamic';

const SOCIAL_POSTS_COLLECTION = getSubCollection('social_posts');
const SOCIAL_QUEUE_COLLECTION = getSubCollection('social_queue');
const SOCIAL_APPROVALS_COLLECTION = getSubCollection('social_approvals');

interface ActivityEvent {
  id: string;
  type: 'published' | 'scheduled' | 'queued' | 'approval_triggered' | 'failed' | 'cancelled';
  platform: string;
  content: string;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

/**
 * GET /api/social/activity
 * Returns recent activity feed sorted by timestamp descending
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/activity');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const url = new URL(request.url);
    const limitParam = parseInt(url.searchParams.get('limit') ?? '30', 10);
    const safeLimit = Math.min(Math.max(limitParam, 1), 100);

    const { orderBy, limit } = await import('firebase/firestore');

    // Fetch recent posts (published, failed, cancelled, scheduled), recent approvals, and recent queued
    const [allPosts, approvals, queuedPosts] = await Promise.all([
      FirestoreService.getAll<SocialMediaPost>(
        SOCIAL_POSTS_COLLECTION,
        [orderBy('updatedAt', 'desc'), limit(safeLimit)]
      ).catch(() => [] as SocialMediaPost[]),
      FirestoreService.getAll<ApprovalItem>(
        SOCIAL_APPROVALS_COLLECTION,
        [orderBy('flaggedAt', 'desc'), limit(safeLimit)]
      ).catch(() => [] as ApprovalItem[]),
      FirestoreService.getAll<QueuedPost>(
        SOCIAL_QUEUE_COLLECTION,
        [orderBy('createdAt', 'desc'), limit(10)]
      ).catch(() => [] as QueuedPost[]),
    ]);

    const events: ActivityEvent[] = [];

    // Map posts → events
    for (const post of allPosts) {
      const timestamp = post.publishedAt ?? post.updatedAt ?? post.createdAt;
      const tsString = timestamp instanceof Date ? timestamp.toISOString() : String(timestamp);

      if (post.status === 'published') {
        events.push({
          id: post.id,
          type: 'published',
          platform: post.platform,
          content: post.content.substring(0, 140),
          timestamp: tsString,
        });
      } else if (post.status === 'failed') {
        events.push({
          id: post.id,
          type: 'failed',
          platform: post.platform,
          content: post.content.substring(0, 140),
          reason: post.error ?? 'Unknown error',
          timestamp: tsString,
        });
      } else if (post.status === 'scheduled') {
        events.push({
          id: post.id,
          type: 'scheduled',
          platform: post.platform,
          content: post.content.substring(0, 140),
          timestamp: tsString,
          metadata: { scheduledAt: post.scheduledAt ? new Date(post.scheduledAt).toISOString() : undefined },
        });
      } else if (post.status === 'cancelled') {
        events.push({
          id: post.id,
          type: 'cancelled',
          platform: post.platform,
          content: post.content.substring(0, 140),
          reason: 'Post cancelled',
          timestamp: tsString,
        });
      }
    }

    // Map approvals → events
    for (const approval of approvals) {
      events.push({
        id: `approval-${approval.id}`,
        type: 'approval_triggered',
        platform: approval.platform,
        content: approval.content.substring(0, 140),
        reason: approval.flagReason,
        timestamp: approval.flaggedAt,
        metadata: {
          status: approval.status,
          flaggedBy: approval.flaggedBy,
        },
      });
    }

    // Map queued posts → events
    for (const qp of queuedPosts) {
      const ts = qp.createdAt instanceof Date ? qp.createdAt.toISOString() : String(qp.createdAt);
      events.push({
        id: `queued-${qp.id}`,
        type: 'queued',
        platform: qp.platform,
        content: qp.content.substring(0, 140),
        timestamp: ts,
        metadata: { queuePosition: qp.queuePosition },
      });
    }

    // Sort by timestamp descending, then take limit
    events.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    const trimmed = events.slice(0, safeLimit);

    return NextResponse.json({
      success: true,
      events: trimmed,
      total: events.length,
    });
  } catch (error: unknown) {
    logger.error('Activity Feed API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to load activity feed' },
      { status: 500 }
    );
  }
}
