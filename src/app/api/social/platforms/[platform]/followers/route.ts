/**
 * API Route: Per-Platform Follower List
 *
 * GET /api/social/platforms/{platform}/followers?cursor=…&limit=…
 *
 * Returns a paginated page of the brand's followers for the given platform.
 * Read-only — no Firestore writes, no GM mutation.
 *
 * Supported platforms (as of May 3 2026):
 *   - twitter    (X v2 — gated behind Basic tier; surfaces tierRestricted flag)
 *   - bluesky    (AT Protocol — open at consumer tier)
 *   - mastodon   (Standard accounts API — open at consumer tier)
 *
 * Other connected platforms either have no follower-list API at the
 * consumer tier (LinkedIn, TikTok, Instagram limit follower listing
 * to Page-admin / Business APIs not generally available) OR aren't
 * currently live for posting yet. They return a 501 with an explanatory
 * `unsupported` payload so the UI can render a tasteful "follower
 * browsing not available on this platform" empty state.
 *
 * Response shape (success):
 *   {
 *     success: true,
 *     platform,
 *     followers: Array<{
 *       handle, displayName, avatarUrl?, bio?, profileUrl,
 *       followsBack?: boolean
 *     }>,
 *     nextCursor?: string,
 *     tierRestricted?: boolean
 *   }
 *
 * Response shape (platform unsupported):
 *   { success: false, error, unsupported: true }
 *
 * NOTE on `followsBack`: not currently populated. Computing it requires
 * a second pass against the *following* list (also paginated and tier-
 * gated on X). Field is reserved for future enrichment so the modal UI
 * can render a "Follows you" pill once we wire it.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

// ─── Schemas ─────────────────────────────────────────────────────────────────

const PlatformSchema = z.object({
  platform: z.enum(
    SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]],
  ),
});

// `cursor` is opaque per-platform; we only validate that it's a sane
// string (≤ 256 chars, no control characters).
const QuerySchema = z.object({
  cursor: z
    .string()
    .max(256)
    .regex(/^[A-Za-z0-9._\-:=+/@%]+$/, 'cursor contains unsupported characters')
    .optional(),
  limit: z
    .string()
    .regex(/^[0-9]+$/)
    .transform((s) => parseInt(s, 10))
    .pipe(z.number().int().min(1).max(100))
    .optional(),
});

// ─── Output types ────────────────────────────────────────────────────────────

interface FollowerSummary {
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  profileUrl: string;
  followsBack?: boolean;
}

interface FollowerPage {
  followers: FollowerSummary[];
  nextCursor?: string;
  tierRestricted?: boolean;
  error?: string;
}

// ─── Per-platform fetchers ───────────────────────────────────────────────────

async function fetchTwitterFollowers(
  cursor: string | undefined,
  limit: number,
): Promise<FollowerPage> {
  const { createTwitterService } = await import('@/lib/integrations/twitter-service');
  const svc = await createTwitterService();
  if (!svc) {
    return { followers: [], error: 'Twitter not configured for this organization' };
  }
  const res = await svc.listFollowers({ cursor, maxResults: limit });
  return {
    followers: res.followers.map((f) => ({
      handle: f.handle,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      bio: f.bio,
      profileUrl: f.profileUrl,
    })),
    nextCursor: res.nextCursor,
    tierRestricted: res.tierRestricted,
    error: res.error,
  };
}

async function fetchBlueskyFollowers(
  cursor: string | undefined,
  limit: number,
): Promise<FollowerPage> {
  const { createBlueskyService } = await import('@/lib/integrations/bluesky-service');
  const svc = await createBlueskyService();
  if (!svc) {
    return { followers: [], error: 'Bluesky not configured for this organization' };
  }
  const res = await svc.listFollowers({ cursor, limit });
  return {
    followers: res.followers.map((f) => ({
      handle: f.handle,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      bio: f.bio,
      profileUrl: f.profileUrl,
    })),
    nextCursor: res.nextCursor,
    error: res.error,
  };
}

async function fetchMastodonFollowers(
  cursor: string | undefined,
  limit: number,
): Promise<FollowerPage> {
  const { createMastodonService } = await import('@/lib/integrations/mastodon-service');
  const svc = await createMastodonService();
  if (!svc) {
    return { followers: [], error: 'Mastodon not configured for this organization' };
  }
  const res = await svc.listFollowers({ cursor, limit });
  return {
    followers: res.followers.map((f) => ({
      handle: f.handle,
      displayName: f.displayName,
      avatarUrl: f.avatarUrl,
      bio: f.bio,
      profileUrl: f.profileUrl,
    })),
    nextCursor: res.nextCursor,
    error: res.error,
  };
}

const SUPPORTED_PLATFORMS: ReadonlySet<SocialPlatform> = new Set([
  'twitter',
  'bluesky',
  'mastodon',
]);

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  try {
    const rl = await rateLimitMiddleware(request, '/api/social/platforms/followers');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform' },
        { status: 422 },
      );
    }
    const platform = parsed.data.platform;

    const url = new URL(request.url);
    const queryParsed = QuerySchema.safeParse({
      cursor: url.searchParams.get('cursor') ?? undefined,
      limit: url.searchParams.get('limit') ?? undefined,
    });
    if (!queryParsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid query parameters',
          details: queryParsed.error.flatten(),
        },
        { status: 400 },
      );
    }
    const { cursor, limit = 50 } = queryParsed.data;

    if (!SUPPORTED_PLATFORMS.has(platform)) {
      // 501 = "we recognize the platform, but follower browsing isn't
      // wired here". UI renders an explanatory empty state.
      return NextResponse.json(
        {
          success: false,
          unsupported: true,
          error: `Manual follower browsing isn't available for ${platform} at the consumer API tier.`,
        },
        { status: 501 },
      );
    }

    let page: FollowerPage;
    switch (platform) {
      case 'twitter':
        page = await fetchTwitterFollowers(cursor, limit);
        break;
      case 'bluesky':
        page = await fetchBlueskyFollowers(cursor, limit);
        break;
      case 'mastodon':
        page = await fetchMastodonFollowers(cursor, limit);
        break;
      default:
        return NextResponse.json(
          { success: false, unsupported: true, error: 'Platform not handled' },
          { status: 501 },
        );
    }

    if (page.error && page.followers.length === 0) {
      // Distinguish tier-restricted (403 from upstream) from generic
      // failure so the UI can render an upgrade CTA vs a retry.
      logger.warn('Followers API: upstream error', {
        platform,
        error: page.error,
        tierRestricted: page.tierRestricted ?? false,
      });
      return NextResponse.json(
        {
          success: false,
          error: page.error,
          tierRestricted: page.tierRestricted ?? false,
        },
        { status: page.tierRestricted ? 403 : 502 },
      );
    }

    return NextResponse.json({
      success: true,
      platform,
      followers: page.followers,
      nextCursor: page.nextCursor,
      tierRestricted: page.tierRestricted,
    });
  } catch (error: unknown) {
    logger.error(
      'Followers API: GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to load followers',
      },
      { status: 500 },
    );
  }
}
