/**
 * Repost or quote-repost a social post.
 *
 * POST /api/social/posts/{postId}/repost
 * Body: { text?: string }     — when text is present, performs a quote-repost;
 *                                when omitted, performs a pure repost/boost.
 *
 * Reads the Firestore post doc, finds its `platformPostId`, then calls the
 * platform-appropriate repost or quote-repost endpoint.
 *
 * Three-platform branch:
 *   - twitter   → POST /2/users/{me}/retweets (pure)
 *                 OR postTweet({ text, quoteTweetId }) (quote)
 *   - bluesky   → app.bsky.feed.repost record (pure)
 *                 OR app.bsky.feed.post with embed.record (quote)
 *   - mastodon  → POST /api/v1/statuses/{id}/reblog (pure)
 *                 — Mastodon has no first-class quote-post; if `text` is
 *                   provided we surface a 400 explaining the limitation
 *                   rather than silently dropping the operator's commentary.
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
  text: z.string().min(1).max(500).optional(),
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

    let parsedBody: { text?: string } = {};
    try {
      const raw: unknown = await request.json();
      const parsed = bodySchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid input' },
          { status: 400 },
        );
      }
      parsedBody = parsed.data;
    } catch {
      // Empty body is fine for pure repost.
      parsedBody = {};
    }
    const quoteText = parsedBody.text?.trim() ?? '';
    const isQuoteRepost = quoteText.length > 0;

    const collectionPath = getSocialPostsCollection();
    const postDoc = await AdminFirestoreService.get<SocialPostDoc>(collectionPath, postId);
    if (!postDoc) {
      return NextResponse.json({ success: false, error: 'Post not found' }, { status: 404 });
    }

    const platform = postDoc.platform;
    const platformPostId = postDoc.platformPostId;
    if (!platformPostId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Post has no platformPostId — cannot repost an unpublished post',
        },
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
      if (isQuoteRepost) {
        const result = await service.postTweet({ text: quoteText, quoteTweetId: platformPostId });
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error ?? 'Twitter quote-tweet failed' },
            { status: 502 },
          );
        }
        logger.info('Social post quote-reposted (twitter)', {
          postId,
          quoteTweetId: platformPostId,
          newTweetId: result.tweetId,
        });
        return NextResponse.json({
          success: true,
          platform,
          mode: 'quote',
          newId: result.tweetId,
        });
      }
      const result = await service.retweet(platformPostId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error ?? 'Twitter retweet failed' },
          { status: 502 },
        );
      }
      logger.info('Social post retweeted (twitter)', { postId, tweetId: platformPostId });
      return NextResponse.json({
        success: true,
        platform,
        mode: 'repost',
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
      const cidResult = await service.getRecordCid(platformPostId);
      if (!cidResult.cid) {
        return NextResponse.json(
          {
            success: false,
            error: cidResult.error ?? 'Could not resolve Bluesky post CID for repost',
          },
          { status: 502 },
        );
      }
      if (isQuoteRepost) {
        const result = await service.quotePost({
          text: quoteText,
          subjectUri: platformPostId,
          subjectCid: cidResult.cid,
        });
        if (!result.success) {
          return NextResponse.json(
            { success: false, error: result.error ?? 'Bluesky quote-post failed' },
            { status: 502 },
          );
        }
        logger.info('Social post quote-reposted (bluesky)', {
          postId,
          subjectUri: platformPostId,
          newUri: result.uri,
        });
        return NextResponse.json({
          success: true,
          platform,
          mode: 'quote',
          newId: result.uri,
        });
      }
      const result = await service.repost({
        subjectUri: platformPostId,
        subjectCid: cidResult.cid,
      });
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error ?? 'Bluesky repost failed' },
          { status: 502 },
        );
      }
      logger.info('Social post reposted (bluesky)', {
        postId,
        subjectUri: platformPostId,
        repostUri: result.uri,
      });
      return NextResponse.json({
        success: true,
        platform,
        mode: 'repost',
        newId: result.uri,
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
      if (isQuoteRepost) {
        // Mastodon has no native quote-post primitive. Surfacing this
        // explicitly so the operator knows the commentary would have
        // been silently dropped — we'd rather they paste the source
        // URL into a new post than have the platform "succeed" while
        // erasing their words.
        return NextResponse.json(
          {
            success: false,
            error: 'Mastodon does not support quote-reposts. Either reblog without commentary, or compose a new post that links to the original.',
          },
          { status: 400 },
        );
      }
      const result = await service.reblogStatus(platformPostId);
      if (!result.success) {
        return NextResponse.json(
          { success: false, error: result.error ?? 'Mastodon reblog failed' },
          { status: 502 },
        );
      }
      logger.info('Social post reblogged (mastodon)', {
        postId,
        statusId: platformPostId,
        reblogId: result.postId,
      });
      return NextResponse.json({
        success: true,
        platform,
        mode: 'repost',
        newId: result.postId,
      });
    }

    return NextResponse.json(
      { success: false, error: `Manual repost not supported for ${platform}` },
      { status: 400 },
    );
  } catch (error: unknown) {
    logger.error(
      'Failed to repost social post',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 },
    );
  }
}
