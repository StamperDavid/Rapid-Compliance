/**
 * Publish to Social Media — immediate posting endpoint
 *
 * POST /api/social/post
 *
 * Takes platform + content, publishes it to the platform via the
 * per-platform service, saves the result to Firestore. This is
 * what the per-platform composer's "Post" button calls.
 *
 * Different from /api/social/posts (plural) which creates drafts.
 * This endpoint publishes immediately.
 *
 * Body: {
 *   platform: SocialPlatform,
 *   contentType: string,
 *   content: string,
 *   metadata?: Record<string, string>
 * }
 *
 * Gated by requireAuth.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { SOCIAL_PLATFORMS } from '@/types/social';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

const PublishSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS),
  contentType: z.string().min(1).max(50),
  content: z.string().min(1).max(50000),
  metadata: z.record(z.string()).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const body: unknown = await request.json();
    const parsed = PublishSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { platform, contentType, content, metadata } = parsed.data;

    // Dynamic import to avoid loading all platform services at module level
    const { AutonomousPostingAgent } = await import('@/lib/social/autonomous-posting-agent');
    const agent = AutonomousPostingAgent.getInstance();

    // Pass content verbatim. Each per-platform handler in autonomous-posting-agent
    // reads metadata.title separately and decides how to combine title + body
    // (e.g. Reddit's submitPost, Pinterest's createPin). Prepending the title
    // here would cause it to appear both in the body AND in the platform's
    // native title field — visible duplication for readers.
    const result = await agent.publishNow(platform, content, {
      contentType,
      ...metadata,
    });

    // Save the post record to Firestore for history
    const postId = `post_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const postsPath = getSubCollection('social_posts');
    await AdminFirestoreService.set(postsPath, postId, {
      id: postId,
      platform,
      contentType,
      content,
      metadata: metadata ?? {},
      status: result.success ? 'published' : 'failed',
      platformPostId: result.postId ?? null,
      error: result.error ?? null,
      publishedAt: result.success ? new Date().toISOString() : null,
      createdAt: new Date().toISOString(),
      createdBy: authResult.user.uid,
    }, false);

    if (result.success) {
      return NextResponse.json({
        success: true,
        postId,
        platformPostId: result.postId,
        platform,
      });
    }

    return NextResponse.json({
      success: false,
      error: result.error ?? `Failed to post to ${platform}`,
      postId,
    }, { status: 422 });
  } catch (err) {
    logger.error('[SocialPost] Publish failed', err instanceof Error ? err : undefined);
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to publish' },
      { status: 500 },
    );
  }
}
