/**
 * Mention Inbox API (force-recompile bump 2026-05-03 evening)
 *
 * GET /api/social/platforms/{platform}/mention-inbox
 *
 * Returns the current set of mentions / replies / quote-posts that the
 * brand account has received on the given platform. Live-fetched from the
 * platform API on every call — there is no Firestore caching layer for
 * mentions (unlike inbound DMs, which the dispatcher cron promotes into
 * `inboundSocialEvents` so the AI can compose drafts).
 *
 * Why live-fetch and not poll-then-store?
 *   The AI inbound-DM pipeline (DM → Jasper → specialist → draft → Mission
 *   Control) was built first. There is currently NO equivalent inbound-
 *   mention pipeline. This UI closes the OPERATOR-side parity gap: an
 *   operator can read and reply to mentions manually right now, without
 *   requiring the full AI loop to be built first. When the AI mention
 *   pipeline ships later, this endpoint can be augmented with `aiDraft`
 *   per item; until then the operator types every reply themselves.
 *
 * Supported platforms (returns empty array for unsupported):
 *   - twitter  → GET /2/users/{me}/mentions (Twitter API v2)
 *   - bluesky  → app.bsky.notification.listNotifications (mention/reply/quote)
 *   - mastodon → /api/v1/notifications?types[]=mention
 *
 * Auth + Rate-limit: matches the dm-inbox route pattern.
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

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

/**
 * Normalized inbox item. The component sees this same shape for every
 * platform so it doesn't have to branch on platform-specific vocabulary.
 *
 *   id           — stable platform-side id used for skip / reply
 *   platformPostId — the post/status/notification id used to thread a reply
 *   author       — display string starting with @ (no leading @ stripped)
 *   text         — plain-text body of the mention/reply/quote
 *   url          — link to the original post on the platform (for "View on …")
 *   reason       — human-readable kind: "mention", "reply", "quote"
 *   receivedAt   — ISO string
 *   threadCid    — Bluesky-only: the post CID needed alongside URI to reply
 */
export interface MentionInboxItem {
  id: string;
  platformPostId: string;
  author: string;
  authorDisplay?: string;
  text: string;
  url: string;
  reason: 'mention' | 'reply' | 'quote';
  receivedAt: string;
  threadCid?: string;
}

interface MentionInboxResponse {
  pending: MentionInboxItem[];
  /** Set when the platform call failed for an actionable, surfaced reason. */
  warning?: string;
}

// ─── Per-platform fetchers ───────────────────────────────────────────────────

async function fetchTwitterMentions(): Promise<MentionInboxResponse> {
  const service = await createTwitterService();
  if (!service) {
    return { pending: [], warning: 'Twitter not configured' };
  }
  const me = await service.getMe();
  if (!me.user) {
    return { pending: [], warning: me.error ?? 'Could not load Twitter profile' };
  }
  const meUserId = me.user.id;
  const meHandle = me.user.username;

  const mentions = await service.getMentions(meUserId, { maxResults: 25 });
  if (mentions.error) {
    return { pending: [], warning: mentions.error };
  }

  const items: MentionInboxItem[] = mentions.tweets.map((t) => ({
    id: t.id,
    platformPostId: t.id,
    // Twitter mentions API v2 returns the tweet but not the author
    // username on the basic tier — we fall back to the author id.
    // Operators can click through to the URL to see the actual handle.
    author: `@${t.authorId ?? 'unknown'}`,
    text: t.text,
    url: `https://x.com/${meHandle}/status/${t.id}`,
    reason: 'mention',
    receivedAt: t.createdAt ?? new Date().toISOString(),
  }));

  return { pending: items };
}

async function fetchBlueskyMentions(): Promise<MentionInboxResponse> {
  const service = await createBlueskyService();
  if (!service) {
    return { pending: [], warning: 'Bluesky not configured' };
  }
  const result = await service.pollMentions({ limit: 25 });
  if (!result.success) {
    return { pending: [], warning: result.error ?? 'Bluesky mention fetch failed' };
  }

  const items: MentionInboxItem[] = result.items.map((n) => {
    // The post URI looks like "at://did:plc:xxx/app.bsky.feed.post/3kxyz"
    // The web URL on bsky.app uses handle + post rkey. The rkey is the last
    // path segment of the URI. We construct a best-effort link; if it 404s
    // the operator can still reply via the inbox.
    const rkey = n.uri.split('/').pop() ?? '';
    const url = `https://bsky.app/profile/${n.authorHandle}/post/${rkey}`;
    return {
      id: n.uri,
      platformPostId: n.uri,
      author: `@${n.authorHandle}`,
      authorDisplay: n.authorDisplayName,
      text: n.text,
      url,
      reason: n.reason,
      receivedAt: n.indexedAt,
      threadCid: n.cid,
    };
  });

  return { pending: items };
}

async function fetchMastodonMentions(): Promise<MentionInboxResponse> {
  const service = await createMastodonService();
  if (!service) {
    return { pending: [], warning: 'Mastodon not configured' };
  }
  const result = await service.pollMentions({ limit: 25 });
  if (!result.success) {
    return { pending: [], warning: result.error ?? 'Mastodon mention fetch failed' };
  }

  const items: MentionInboxItem[] = result.items.map((m) => ({
    id: m.notificationId,
    platformPostId: m.statusId,
    author: `@${m.authorAcct}`,
    authorDisplay: m.authorDisplayName,
    text: m.text,
    url: m.statusUrl || m.authorProfileUrl,
    reason: 'mention',
    receivedAt: m.createdAt,
  }));

  return { pending: items };
}

// ─── Route handler ───────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  try {
    const rl = await rateLimitMiddleware(request, '/api/social/platforms/mention-inbox');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const platform = parsed.data.platform;

    let response: MentionInboxResponse;
    switch (platform) {
      case 'twitter':
        response = await fetchTwitterMentions();
        break;
      case 'bluesky':
        response = await fetchBlueskyMentions();
        break;
      case 'mastodon':
        response = await fetchMastodonMentions();
        break;
      default:
        // Other platforms have no mention-inbox implementation yet — return
        // an empty pending list rather than a 4xx so the UI degrades to the
        // "No mentions waiting" thin bar, matching the dm-inbox pattern.
        response = { pending: [] };
        break;
    }

    // Filter out mentions the operator has already replied to or skipped.
    // The platform APIs themselves (X / Bluesky) do NOT have a "mark
    // notification dismissed" call we can rely on (Mastodon does, but we
    // still want a uniform across-platform record), so we keep our own
    // dismissed-log in Firestore at `handledMentions`. Doc id =
    // `${platform}__${base64url(mentionId)}` so we never collide across
    // platforms and never break Firestore's id charset rules.
    if (adminDb && response.pending.length > 0) {
      try {
        const handledColl = adminDb.collection(getSubCollection('handledMentions'));
        const checks = await Promise.all(
          response.pending.map(async (item) => {
            const docId = mentionDocId(platform, item.id);
            const snap = await handledColl.doc(docId).get();
            return snap.exists ? item.id : null;
          }),
        );
        const handledIds = new Set(checks.filter((id): id is string => id !== null));
        if (handledIds.size > 0) {
          response = {
            ...response,
            pending: response.pending.filter((i) => !handledIds.has(i.id)),
          };
        }
      } catch (err) {
        logger.warn('[mention-inbox] handledMentions filter failed — returning unfiltered', {
          platform,
          error: err instanceof Error ? err.message : String(err),
        });
        // Fail-open: if the filter call dies the operator just sees rows
        // they already actioned and can re-skip them. Never block the
        // primary read on the secondary filter.
      }
    }

    logger.debug('[mention-inbox] GET complete', {
      platform,
      pendingCount: response.pending.length,
      hasWarning: Boolean(response.warning),
    });

    return NextResponse.json(response);
  } catch (error: unknown) {
    logger.error(
      '[mention-inbox] GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load mention inbox',
        pending: [],
      },
      { status: 500 },
    );
  }
}
