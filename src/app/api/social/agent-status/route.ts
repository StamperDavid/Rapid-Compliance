/**
 * API Route: Social Agent Status
 *
 * GET /api/social/agent-status → Get agent health, velocity usage, queue depth, next post
 * POST /api/social/agent-status → Toggle agent enabled/disabled (kill switch)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { AgentConfigService } from '@/lib/social/agent-config-service';
import { SocialAccountService } from '@/lib/social/social-account-service';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type { SocialMediaPost, QueuedPost, ApprovalItem, SocialAccount } from '@/types/social';

export const dynamic = 'force-dynamic';

const SOCIAL_POSTS_COLLECTION = getSubCollection('social_posts');
const SOCIAL_QUEUE_COLLECTION = getSubCollection('social_queue');
const SOCIAL_APPROVALS_COLLECTION = getSubCollection('social_approvals');

const toggleSchema = z.object({
  agentEnabled: z.boolean(),
});

/**
 * GET /api/social/agent-status
 * Returns comprehensive agent status for the Command Center
 */
export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/agent-status');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const { where, orderBy, limit } = await import('firebase/firestore');

    // Parallel fetch: config, queue, scheduled posts, recent published, accounts, pending approvals
    const [config, queuedPosts, scheduledPosts, recentPublished, accounts, pendingApprovals] = await Promise.all([
      AgentConfigService.getConfig(),
      AdminFirestoreService.getAll(
        SOCIAL_QUEUE_COLLECTION,
        [orderBy('queuePosition', 'asc')]
      ).catch(() => []).then(r => r as QueuedPost[]),
      AdminFirestoreService.getAll(
        SOCIAL_POSTS_COLLECTION,
        [where('status', '==', 'scheduled'), orderBy('scheduledAt', 'asc'), limit(5)]
      ).catch(() => []).then(r => r as SocialMediaPost[]),
      AdminFirestoreService.getAll(
        SOCIAL_POSTS_COLLECTION,
        [where('status', '==', 'published'), orderBy('publishedAt', 'desc'), limit(10)]
      ).catch(() => []).then(r => r as SocialMediaPost[]),
      SocialAccountService.listAccounts().catch(() => [] as SocialAccount[]),
      AdminFirestoreService.getAll(
        SOCIAL_APPROVALS_COLLECTION,
        [where('status', '==', 'pending_review')]
      ).catch(() => []).then(r => r as ApprovalItem[]),
    ]);

    // Compute next scheduled post time
    const nextScheduledPost = scheduledPosts[0] ?? null;
    const nextPostTime = nextScheduledPost?.scheduledAt
      ? new Date(nextScheduledPost.scheduledAt).toISOString()
      : null;

    // Count today's published posts
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const todayPublished = recentPublished.filter(
      (p) => p.publishedAt && new Date(p.publishedAt) >= todayStart
    ).length;

    // Build platform connection summary (strip credentials)
    const platformStatus = accounts.map((acct) => ({
      platform: acct.platform,
      accountName: acct.accountName,
      handle: acct.handle,
      status: acct.status,
      isDefault: acct.isDefault,
    }));

    // Velocity usage summary (today's posts vs limits)
    const velocityUsage = {
      postsToday: todayPublished,
      maxDailyPosts: config.maxDailyPosts,
      postVelocityLimit: config.velocityLimits.POST ?? 10,
      replyVelocityLimit: config.velocityLimits.REPLY ?? 10,
      likeVelocityLimit: config.velocityLimits.LIKE ?? 30,
    };

    return NextResponse.json({
      success: true,
      status: {
        agentEnabled: config.agentEnabled,
        pauseOnWeekends: config.pauseOnWeekends,
        autoApprovalEnabled: config.autoApprovalEnabled,
        queueDepth: queuedPosts.length,
        scheduledCount: scheduledPosts.length,
        pendingApprovalCount: pendingApprovals.length,
        nextPostTime,
        velocityUsage,
        platformStatus,
        todayPublished,
        recentPublished: recentPublished.slice(0, 5).map((p) => ({
          id: p.id,
          platform: p.platform,
          content: p.content.substring(0, 120),
          publishedAt: p.publishedAt,
          status: p.status,
        })),
      },
    });
  } catch (error: unknown) {
    logger.error('Agent Status API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to load agent status' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/social/agent-status
 * Toggle the kill switch (agentEnabled)
 */
export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/agent-status');
    if (rateLimitResponse) { return rateLimitResponse; }

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) { return authResult; }

    const body: unknown = await request.json();
    const validation = toggleSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const updated = await AgentConfigService.saveConfig(
      { agentEnabled: validation.data.agentEnabled },
      authResult.user.uid
    );

    const action = validation.data.agentEnabled ? 'ENABLED' : 'DISABLED';
    logger.info(`Agent Status API: Agent ${action}`, { userId: authResult.user.uid });

    return NextResponse.json({
      success: true,
      agentEnabled: updated.agentEnabled,
      message: `Agent ${action.toLowerCase()} successfully`,
    });
  } catch (error: unknown) {
    logger.error('Agent Status API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to toggle agent' },
      { status: 500 }
    );
  }
}
