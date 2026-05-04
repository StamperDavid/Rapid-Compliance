/**
 * Reply to a social post (threaded reply / comment).
 *
 * POST /api/social/posts/{postId}/reply
 * Body: { text: string }
 *
 * Reads the Firestore post doc, finds its `platformPostId`, then calls the
 * platform-appropriate reply endpoint. The result is a NEW post on the
 * platform that threads under the target.
 *
 * Three-platform branch:
 *   - twitter  → POST /2/tweets with reply.in_reply_to_tweet_id
 *   - bluesky  → app.bsky.feed.post with reply.parent + reply.root
 *               (cid is resolved server-side via getRecordCid)
 *   - mastodon → POST /api/v1/statuses with in_reply_to_id
 *
 * Auth: requireAuth (operator-only).
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSocialPostsCollection } from '@/lib/firebase/collections';
import { createTwitterService } from '@/lib/integrations/twitter-service';
import { createBlueskyService } from '@/lib/integrations/bluesky-service';
import { createMastodonService } from '@/lib/integrations/mastodon-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const bodySchema = z.object({
  text: z.string().min(1, 'Reply text is required').max(500),
});

interface SocialPostDoc {
  id: string;
  platform: string;
  platformPostId?: string;
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

    const body: unknown = await request.json();
    const parsed = bodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
        { status: 400 },
      );
    }
    const { text } = parsed.data;

    const collectionPath = getSocialPostsCollection();
    const postDoc = await AdminFirestoreService.get<SocialPostDoc>(collectionPath, postId);
    if (!postDoc) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    const platform = postDoc.platform;
    const platformPostId = postDoc.platformPostId;
    if (!platformPostId) {
      return NextResponse.json(
        { success: false, error: 'Post has no platformPostId — cannot reply to an unpublished post' },
        { status: 400 },
      );
    }

    if (platform === 'twitter') {
      const service = await createTwitterService();
      if (!service) {
        return NextResponse.json(
          { success: false, error: 'Twitter is not configured' },
          { status: 400 },
        );
      }
      const result = await service.postTweet({ text, replyToTweetId: platformPostId });
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error ?? 'Twitter reply failed' },
          { status: 502 },
        );
      }
      logger.info('Social post reply sent (twitter)', {
        postId,
        parentTweetId: platformPostId,
        replyTweetId: result.tweetId,
      });
      return NextResponse.json({
        success: true,
        platform,
        replyId: result.tweetId,
      });
    }

    if (platform === 'bluesky') {
      const service = await createBlueskyService();
      if (!service) {
        return NextResponse.json(
          { success: false, error: 'Bluesky is not configured' },
          { status: 400 },
        );
      }
      // Bluesky needs both URI (= platformPostId) and CID. The original
      // post doc may not have stored the CID — resolve it on demand.
      const cidResult = await service.getRecordCid(platformPostId);
      if (!cidResult.cid) {
        return NextResponse.json(
          {
            success: false,
            error: cidResult.error ?? 'Could not resolve Bluesky post CID for reply',
          },
          { status: 502 },
        );
      }
      const result = await service.replyToPost({
        text,
        parentUri: platformPostId,
        parentCid: cidResult.cid,
      });
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error ?? 'Bluesky reply failed' },
          { status: 502 },
        );
      }
      logger.info('Social post reply sent (bluesky)', {
        postId,
        parentUri: platformPostId,
        replyUri: result.uri,
      });
      return NextResponse.json({
        success: true,
        platform,
        replyId: result.uri,
      });
    }

    if (platform === 'mastodon') {
      const service = await createMastodonService();
      if (!service) {
        return NextResponse.json(
          { success: false, error: 'Mastodon is not configured' },
          { status: 400 },
        );
      }
      // Replying to the operator's OWN post — no @mention prefix
      // needed because the author is themselves.
      const result = await service.replyToStatus({
        inReplyToStatusId: platformPostId,
        text,
        visibility: 'public',
      });
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error ?? 'Mastodon reply failed' },
          { status: 502 },
        );
      }
      logger.info('Social post reply sent (mastodon)', {
        postId,
        parentStatusId: platformPostId,
        replyStatusId: result.postId,
      });
      return NextResponse.json({
        success: true,
        platform,
        replyId: result.postId,
      });
    }

    return NextResponse.json(
      { success: false, error: `Manual reply not supported for ${platform}` },
      { status: 400 },
    );
  } catch (error: unknown) {
    logger.error(
      'Failed to reply to social post',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
