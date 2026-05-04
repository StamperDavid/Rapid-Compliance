/**
 * Delete a social post on the platform AND in Firestore.
 *
 * POST /api/social/posts/{postId}/delete
 *
 * Reads the Firestore post doc, finds its `platformPostId` (X tweet id,
 * Bluesky AT URI, or Mastodon status id), calls the platform's delete
 * endpoint, then marks the local Firestore doc as `deleted` (status field).
 *
 * Why POST instead of DELETE? Next.js App Router supports DELETE, but
 * making this POST keeps the URL pattern uniform with `/reply` and
 * `/repost` and lets the operator browse to it for debugging without
 * a custom HTTP method.
 *
 * Three-platform branch:
 *   - twitter  → TwitterService.deleteTweet(tweetId)
 *   - bluesky  → BlueskyService.deletePost(atUri)
 *   - mastodon → MastodonService.deleteStatus(statusId)
 *
 * Auth: requireAuth (operator-only).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSocialPostsCollection } from '@/lib/firebase/collections';
import { createTwitterService } from '@/lib/integrations/twitter-service';
import { createBlueskyService } from '@/lib/integrations/bluesky-service';
import { createMastodonService } from '@/lib/integrations/mastodon-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

interface SocialPostDoc {
  id: string;
  platform: string;
  platformPostId?: string;
  status?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ postId: string }> },
) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { postId } = await params;
    if (!postId || typeof postId !== 'string') {
      return NextResponse.json({ success: false, error: 'postId is required' }, { status: 400 });
    }

    const collectionPath = getSocialPostsCollection();
    const postDoc = await AdminFirestoreService.get<SocialPostDoc>(collectionPath, postId);
    if (!postDoc) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    const platform = postDoc.platform;
    const platformPostId = postDoc.platformPostId;

    // For posts that were never published (drafts/scheduled with no
    // platformPostId yet), there's nothing to delete on the platform —
    // we just delete the local doc.
    let platformDeleteResult: { success: boolean; error?: string } = { success: true };
    if (platformPostId) {
      if (platform === 'twitter') {
        const service = await createTwitterService();
        if (!service) {
          return NextResponse.json(
            { success: false, error: 'Twitter is not configured' },
            { status: 400 },
          );
        }
        platformDeleteResult = await service.deleteTweet(platformPostId);
      } else if (platform === 'bluesky') {
        const service = await createBlueskyService();
        if (!service) {
          return NextResponse.json(
            { success: false, error: 'Bluesky is not configured' },
            { status: 400 },
          );
        }
        platformDeleteResult = await service.deletePost(platformPostId);
      } else if (platform === 'mastodon') {
        const service = await createMastodonService();
        if (!service) {
          return NextResponse.json(
            { success: false, error: 'Mastodon is not configured' },
            { status: 400 },
          );
        }
        platformDeleteResult = await service.deleteStatus(platformPostId);
      } else {
        return NextResponse.json(
          { success: false, error: `Manual delete not supported for ${platform}` },
          { status: 400 },
        );
      }

      if (!platformDeleteResult.success) {
        return NextResponse.json(
          {
            success: false,
            error: platformDeleteResult.error ?? `Platform delete failed for ${platform}`,
          },
          { status: 502 },
        );
      }
    }

    // Mark the Firestore post as cancelled — we don't HARD delete because
    // analytics/audit history references it. The dashboard's recent-posts
    // query already filters out cancelled.
    await AdminFirestoreService.update(collectionPath, postId, {
      status: 'cancelled',
      deletedAt: new Date(),
      deletedBy: authResult.user.uid,
      updatedAt: new Date(),
    });

    logger.info('Social post deleted', {
      postId,
      platform,
      platformPostId,
      deletedFromPlatform: Boolean(platformPostId),
    });

    return NextResponse.json({
      success: true,
      deletedFromPlatform: Boolean(platformPostId),
    });
  } catch (error: unknown) {
    logger.error(
      'Failed to delete social post',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
