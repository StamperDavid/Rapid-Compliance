/**
 * Reply to a mention manually
 *
 * POST /api/social/platforms/{platform}/mention-inbox/reply
 *
 * Sends an operator-authored reply to a mention / reply / quote-post on the
 * given platform via the existing per-platform service. The reply is a real
 * post on the platform; on success we stamp `handledMentions/{docId}` so the
 * inbox does not surface this mention again.
 *
 * Body schema (Zod-validated):
 *   {
 *     mentionId: string         // platform-side notification/mention id
 *     replyText: string         // operator-authored reply (1..500 chars)
 *
 *     // Bluesky-only — required when platform === 'bluesky':
 *     parentUri?: string        // post URI to reply to (== mentionId)
 *     parentCid?: string        // post CID
 *
 *     // Mastodon-only — required when platform === 'mastodon':
 *     statusId?: string         // status id to reply to
 *     recipientAcct?: string    // @handle to mention in the reply body
 *
 *     // Twitter-only — required when platform === 'twitter':
 *     tweetId?: string          // tweet id to reply to (== mentionId for X)
 *   }
 *
 * Response:
 *   200 { success: true, postId?, postUrl? }
 *   422 invalid body / unsupported platform
 *   409 already handled (idempotent)
 *   500 unexpected
 *
 * Standing rules:
 *   - Auth required (owner/admin only — replying as the brand mutates the
 *     platform-side audience timeline).
 *   - Admin SDK only (server-side Firestore writes).
 *   - No GM edits, no TrainingFeedback writes — manual operator reply is a
 *     workflow action, not a training signal.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { createTwitterService } from '@/lib/integrations/twitter-service';
import { createBlueskyService } from '@/lib/integrations/bluesky-service';
import { createMastodonService } from '@/lib/integrations/mastodon-service';
import { mentionDocId } from '@/lib/social/mention-handled-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const ParamsSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const BodySchema = z.object({
  mentionId: z.string().min(1).max(500),
  replyText: z.string().min(1).max(500),
  parentUri: z.string().min(1).max(500).optional(),
  parentCid: z.string().min(1).max(200).optional(),
  statusId: z.string().min(1).max(100).optional(),
  recipientAcct: z.string().min(1).max(200).optional(),
  tweetId: z.string().min(1).max(100).optional(),
});

interface ReplyOk {
  success: true;
  postId?: string;
  postUrl?: string;
}

interface ReplyErr {
  success: false;
  error: string;
}

type ReplyResult = ReplyOk | ReplyErr;

async function replyOnTwitter(input: { tweetId: string; replyText: string }): Promise<ReplyResult> {
  const service = await createTwitterService();
  if (!service) {
    return { success: false, error: 'Twitter not configured' };
  }
  const result = await service.postTweet({
    text: input.replyText,
    replyToTweetId: input.tweetId,
  });
  if (!result.success) {
    return { success: false, error: result.error ?? 'Twitter reply failed' };
  }
  // We don't have the brand handle here without an extra getMe() call; the
  // operator already has the original mention URL on their inbox row, so we
  // skip URL construction. tweetId is enough to reach the reply later.
  return { success: true, postId: result.tweetId };
}

async function replyOnBluesky(input: { parentUri: string; parentCid: string; replyText: string }): Promise<ReplyResult> {
  const service = await createBlueskyService();
  if (!service) {
    return { success: false, error: 'Bluesky not configured' };
  }
  const result = await service.replyToPost({
    parentUri: input.parentUri,
    parentCid: input.parentCid,
    text: input.replyText,
  });
  if (!result.success) {
    return { success: false, error: result.error ?? 'Bluesky reply failed' };
  }
  return { success: true, postId: result.uri };
}

async function replyOnMastodon(input: { statusId: string; recipientAcct: string; replyText: string }): Promise<ReplyResult> {
  const service = await createMastodonService();
  if (!service) {
    return { success: false, error: 'Mastodon not configured' };
  }
  const result = await service.replyToStatus({
    inReplyToStatusId: input.statusId,
    recipientAcct: input.recipientAcct,
    text: input.replyText,
  });
  if (!result.success) {
    return { success: false, error: result.error ?? 'Mastodon reply failed' };
  }
  return { success: true, postId: result.postId, postUrl: result.url };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  try {
    const rl = await rateLimitMiddleware(request, '/api/social/platforms/mention-inbox/reply');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }
    const { user } = auth;

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const rawParams = await params;
    const parsedParams = ParamsSchema.safeParse(rawParams);
    if (!parsedParams.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform' },
        { status: 422 },
      );
    }
    const platform = parsedParams.data.platform;

    let body: z.infer<typeof BodySchema>;
    try {
      const raw: unknown = await request.json();
      const parsed = BodySchema.safeParse(raw);
      if (!parsed.success) {
        return NextResponse.json(
          { success: false, error: 'Invalid body', details: parsed.error.flatten() },
          { status: 422 },
        );
      }
      body = parsed.data;
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON body' },
        { status: 422 },
      );
    }

    // Idempotency guard — if this mention is already in handledMentions
    // (from an earlier successful reply or skip) refuse to send a second
    // reply. This protects against double-clicks and out-of-order polls.
    const docId = mentionDocId(platform, body.mentionId);
    if (adminDb) {
      const existing = await adminDb
        .collection(getSubCollection('handledMentions'))
        .doc(docId)
        .get();
      if (existing.exists) {
        const data = existing.data() as Record<string, unknown> | undefined;
        return NextResponse.json(
          {
            success: false,
            reason: 'already_handled',
            handledAt: data?.handledAt,
            action: data?.action,
          },
          { status: 409 },
        );
      }
    }

    let result: ReplyResult;
    switch (platform) {
      case 'twitter': {
        const tweetId = body.tweetId ?? body.mentionId;
        if (!tweetId) {
          return NextResponse.json(
            { success: false, error: 'tweetId (or mentionId) required for twitter' },
            { status: 422 },
          );
        }
        result = await replyOnTwitter({ tweetId, replyText: body.replyText });
        break;
      }
      case 'bluesky': {
        if (!body.parentUri || !body.parentCid) {
          return NextResponse.json(
            { success: false, error: 'parentUri and parentCid are required for bluesky' },
            { status: 422 },
          );
        }
        result = await replyOnBluesky({
          parentUri: body.parentUri,
          parentCid: body.parentCid,
          replyText: body.replyText,
        });
        break;
      }
      case 'mastodon': {
        if (!body.statusId || !body.recipientAcct) {
          return NextResponse.json(
            { success: false, error: 'statusId and recipientAcct are required for mastodon' },
            { status: 422 },
          );
        }
        result = await replyOnMastodon({
          statusId: body.statusId,
          recipientAcct: body.recipientAcct,
          replyText: body.replyText,
        });
        break;
      }
      default:
        return NextResponse.json(
          { success: false, error: `Manual mention reply is not implemented for ${platform}` },
          { status: 422 },
        );
    }

    if (!result.success) {
      return NextResponse.json(
        { success: false, error: result.error },
        { status: 502 },
      );
    }

    // Stamp handled so subsequent inbox polls exclude this mention.
    if (adminDb) {
      try {
        await adminDb
          .collection(getSubCollection('handledMentions'))
          .doc(docId)
          .set(
            {
              platform,
              mentionId: body.mentionId,
              action: 'replied',
              handledAt: new Date().toISOString(),
              handledBy: user.uid,
              ...(result.postId ? { replyPostId: result.postId } : {}),
              ...(result.postUrl ? { replyPostUrl: result.postUrl } : {}),
            },
            { merge: true },
          );
      } catch (err) {
        // The reply WAS sent — we just couldn't stamp the dedupe record.
        // Surface this honestly: the operator may see the row again on the
        // next 30s poll. Better to warn than to lie about success.
        logger.warn('[mention-inbox/reply] Reply sent but handledMentions stamp failed', {
          platform,
          mentionId: body.mentionId,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    logger.info('[mention-inbox/reply] Reply sent', {
      platform,
      mentionId: body.mentionId,
      actorUid: user.uid,
      postId: result.postId,
    });

    return NextResponse.json({
      success: true,
      ...(result.postId ? { postId: result.postId } : {}),
      ...(result.postUrl ? { postUrl: result.postUrl } : {}),
    });
  } catch (error: unknown) {
    logger.error(
      '[mention-inbox/reply] POST failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Reply failed' },
      { status: 500 },
    );
  }
}
