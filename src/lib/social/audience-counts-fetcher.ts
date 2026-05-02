/**
 * Audience Counts Fetcher
 *
 * Pulls live followers / following / posts counts from each live platform
 * for the brand's connected account. Used by:
 *   - the OAuth-connect callback to capture the baseline at connect time
 *   - the daily snapshot cron to record audience growth
 *   - the per-platform metrics endpoint for "current vs baseline"
 *
 * Coverage today: Twitter, Bluesky, Mastodon (the three live platforms).
 * Coming-soon platforms return `null` — the caller should treat that as
 * "no audience data yet" and not display improvement metrics.
 *
 * Per-platform mapping:
 *   - Twitter:   GET /2/users/me with user.fields=public_metrics
 *   - Bluesky:   app.bsky.actor.getProfile (followersCount, followsCount, postsCount)
 *   - Mastodon:  /api/v1/accounts/verify_credentials (followers_count, ...)
 */

import { logger } from '@/lib/logger/logger';
import { createTwitterService } from '@/lib/integrations/twitter-service';
import { createBlueskyService } from '@/lib/integrations/bluesky-service';
import { createMastodonService } from '@/lib/integrations/mastodon-service';
import type { SocialPlatform } from '@/types/social';
import type { AudienceCounts } from '@/lib/social/audience-baseline-service';

const FILE = 'social/audience-counts-fetcher.ts';

export async function fetchAudienceCounts(
  platform: SocialPlatform,
): Promise<AudienceCounts | null> {
  try {
    switch (platform) {
      case 'twitter':
        return await fetchTwitterCounts();
      case 'bluesky':
        return await fetchBlueskyCounts();
      case 'mastodon':
        return await fetchMastodonCounts();
      default:
        return null;
    }
  } catch (error) {
    logger.warn('audience-counts-fetcher: fetch failed, returning null', {
      file: FILE,
      platform,
      error: error instanceof Error ? error.message : String(error),
    });
    return null;
  }
}

async function fetchTwitterCounts(): Promise<AudienceCounts | null> {
  const svc = await createTwitterService();
  if (!svc) { return null; }
  const { user, error } = await svc.getMe();
  if (error || !user?.publicMetrics) { return null; }
  return {
    followersCount: user.publicMetrics.followersCount,
    followingCount: user.publicMetrics.followingCount,
    postsCount: user.publicMetrics.tweetCount,
  };
}

async function fetchBlueskyCounts(): Promise<AudienceCounts | null> {
  const svc = await createBlueskyService();
  if (!svc) { return null; }
  const profile = await svc.getProfile();
  if (!profile) { return null; }
  return {
    followersCount: profile.followersCount ?? 0,
    followingCount: profile.followsCount ?? 0,
    postsCount: profile.postsCount ?? 0,
  };
}

async function fetchMastodonCounts(): Promise<AudienceCounts | null> {
  const svc = await createMastodonService();
  if (!svc) { return null; }
  const profile = await svc.getProfile();
  if (!profile) { return null; }
  return {
    followersCount: profile.followers_count,
    followingCount: profile.following_count,
    postsCount: profile.statuses_count,
  };
}
