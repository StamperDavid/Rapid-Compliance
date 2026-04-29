/**
 * Runtime context: which social platforms Jasper is allowed to plan posts for.
 *
 * Source of truth: `src/components/social/_platform-state.ts` PLATFORM_CONFIG.
 * A platform is "connected" (postable) when its state is live_full,
 * live_dm_blocked, or live_no_dm — anything posting-capable. Coming-soon /
 * parked / no-specialist platforms are excluded.
 *
 * Why inject at runtime instead of baking into the GM:
 *   - Platform connection state changes when an operator finishes an OAuth
 *     flow or when an external approval clears. Hardcoding the list in the
 *     GM would go stale on every connection change and require a re-deploy.
 *   - Standing Rule #1 says Brand DNA stays baked in; transient runtime
 *     state like connection status is exactly the kind of thing that should
 *     NOT be baked into the GM.
 */

import { getPlatformConfig } from '@/components/social/_platform-state';
import type { SocialPlatform } from '@/types/social';

// All known social platforms — keep in sync with the SocialPlatform union.
const ALL_SOCIAL_PLATFORMS: SocialPlatform[] = [
  'twitter',
  'bluesky',
  'mastodon',
  'linkedin',
  'facebook',
  'instagram',
  'pinterest',
  'tiktok',
  'youtube',
  'threads',
  'telegram',
  'whatsapp_business',
  'google_business',
  'reddit',
  'truth_social',
  'discord',
  'twitch',
];

// States that mean "the platform is wired up and Jasper may plan a post for it".
const POSTABLE_STATES = new Set(['live_full', 'live_dm_blocked', 'live_no_dm']);

interface PlatformBuckets {
  connected: SocialPlatform[];
  notConnected: Array<{ platform: SocialPlatform; reason: string | undefined }>;
}

function bucketPlatforms(): PlatformBuckets {
  const connected: SocialPlatform[] = [];
  const notConnected: Array<{ platform: SocialPlatform; reason: string | undefined }> = [];

  for (const platform of ALL_SOCIAL_PLATFORMS) {
    const cfg = getPlatformConfig(platform);
    if (POSTABLE_STATES.has(cfg.state)) {
      connected.push(platform);
    } else {
      notConnected.push({ platform, reason: cfg.blockReason });
    }
  }

  return { connected, notConnected };
}

/**
 * Build a system-prompt suffix that tells Jasper which social platforms are
 * postable RIGHT NOW. Returns an empty string if for any reason the bucketing
 * fails (defensive — never block a chat request on this).
 */
export function buildConnectedPlatformsContext(): string {
  try {
    const { connected, notConnected } = bucketPlatforms();
    if (connected.length === 0) {
      return '';
    }

    const connectedList = connected.map((p) => `- ${p}`).join('\n');
    const notConnectedList = notConnected
      .map(({ platform, reason }) => `- ${platform}${reason ? ` — ${reason}` : ''}`)
      .join('\n');

    return `

## Currently connected social platforms (POSTABLE)

When planning posts via delegate_to_marketing or social_post, the universe of platforms you may target is limited to this list. Posting to anything else will fail at the OAuth/credentials layer and halt the mission.

${connectedList}

## NOT connected — do NOT plan posts for these (explicitly exclude)

When the user says "all platforms" or "every social platform" or similar, that means **only the connected list above**, NEVER the platforms below. Including any of these will cause step failures.

${notConnectedList}
`;
  } catch (_err) {
    // Defensive — never block the chat path on this helper.
    return '';
  }
}
