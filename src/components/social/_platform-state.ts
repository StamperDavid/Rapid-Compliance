/**
 * Per-platform state map for the Social Hub redesign.
 *
 * Owns the SoT for which platforms have a live specialist, which DM
 * capabilities are gated externally, and which are parked entirely. The
 * unified `<PlatformDashboard>` component renders state-aware UI driven by
 * the values returned from `getPlatformConfig(platform)`.
 *
 * Per the Phase 5 spec the data here is pulled directly from the
 * continuation prompt's integration matrix — keep this file in sync when
 * a platform's gate clears or a new specialist is built.
 */

import type { SocialPlatform } from '@/types/social';

// ─── Public types ────────────────────────────────────────────────────────────

/**
 * High-level per-platform state used to choose which dashboard sections to
 * render and which header pill to show.
 */
export type PlatformState =
  | 'live_full'         // compose + generate + inbound DM + outbound all live
  | 'live_dm_blocked'   // outbound + AI generate live, inbound DM externally blocked
  | 'live_no_dm'        // outbound + AI generate live, platform has no DM concept
  | 'no_specialist'     // outbound posting works, no AI specialist yet
  | 'coming_soon'       // specialist being built, gate clearing soon
  | 'parked';           // platform indefinitely blocked

/**
 * Granular DM posture so the right-column DM card can render the correct
 * dot color + reason without re-deriving from `state` everywhere.
 */
export type DmCapability =
  | 'live'      // inbound DM auto-reply active
  | 'blocked'   // externally blocked (verification, multi-day approval, etc.)
  | 'pending'   // platform has DM but our specialist isn't built yet
  | 'deferred'  // platform has DM but it's a low-priority integration
  | 'na';       // platform has no DM concept, hide the card

export interface PlatformConfig {
  state: PlatformState;
  /** Specialist ID for `/api/agents/specialist/[id]`. Null when no specialist. */
  specialistId: string | null;
  /** Display name for the specialist. Null when no specialist. */
  specialistName: string | null;
  dmCapability: DmCapability;
  /** Human-readable explanation when blocked / parked / coming-soon. */
  blockReason?: string;
  /** What unblocks this platform — paired with blockReason in the UI. */
  unblockAction?: string;
}

// ─── Per-platform mapping ────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<SocialPlatform, PlatformConfig> = {
  twitter: {
    state: 'live_full',
    specialistId: 'TWITTER_X_EXPERT',
    specialistName: 'Twitter/X Expert',
    dmCapability: 'live',
  },
  bluesky: {
    state: 'live_full',
    specialistId: 'BLUESKY_EXPERT',
    specialistName: 'Bluesky Expert',
    dmCapability: 'live',
  },
  mastodon: {
    state: 'live_full',
    specialistId: 'MASTODON_EXPERT',
    specialistName: 'Mastodon Expert',
    dmCapability: 'live',
  },
  linkedin: {
    state: 'live_dm_blocked',
    specialistId: 'LINKEDIN_EXPERT',
    specialistName: 'LinkedIn Expert',
    dmCapability: 'blocked',
    blockReason:
      'LinkedIn DM send requires Marketing Developer Platform approval (multi-day external process)',
    unblockAction: 'Apply for LinkedIn Marketing Developer Platform',
  },
  facebook: {
    state: 'live_dm_blocked',
    specialistId: 'FACEBOOK_ADS_EXPERT',
    specialistName: 'Facebook Ads Expert',
    dmCapability: 'blocked',
    blockReason:
      'Meta Business Verification required for pages_messaging in production',
    unblockAction:
      'Start Meta Business Verification (bundled with Instagram OAuth when verified)',
  },
  instagram: {
    state: 'live_dm_blocked',
    specialistId: 'INSTAGRAM_EXPERT',
    specialistName: 'Instagram Expert',
    dmCapability: 'blocked',
    blockReason:
      'Same Meta Business Verification gate (instagram_manage_messages)',
    unblockAction:
      'Start Meta Business Verification (bundled with Facebook OAuth when verified)',
  },
  pinterest: {
    state: 'live_dm_blocked',
    specialistId: 'PINTEREST_EXPERT',
    specialistName: 'Pinterest Expert',
    dmCapability: 'deferred',
    blockReason:
      'Pinterest is discovery-focused, not conversational — DM integration low priority',
  },
  tiktok: {
    state: 'live_no_dm',
    specialistId: 'TIKTOK_EXPERT',
    specialistName: 'TikTok Expert',
    dmCapability: 'na',
  },
  youtube: {
    state: 'live_no_dm',
    specialistId: 'YOUTUBE_EXPERT',
    specialistName: 'YouTube Expert',
    dmCapability: 'na',
  },
  threads: {
    state: 'no_specialist',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
  },
  telegram: {
    state: 'no_specialist',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
  },
  whatsapp_business: {
    state: 'no_specialist',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
  },
  google_business: {
    state: 'no_specialist',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
  },
  reddit: {
    state: 'coming_soon',
    specialistId: null,
    specialistName: 'Reddit Expert',
    dmCapability: 'pending',
    blockReason:
      'Reddit dev account on 24h account-age gate + REDDIT_EXPERT specialist not yet built',
    unblockAction: 'Wait for account age + build REDDIT_EXPERT specialist',
  },
  truth_social: {
    state: 'parked',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
    blockReason:
      'Cloudflare TLS-fingerprint wall blocks server-side posts. No path without browser-class TLS infra.',
  },
};

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Resolve the per-platform config used by `<PlatformDashboard>`.
 *
 * Always returns a valid PlatformConfig — we own a row for every member of
 * `SocialPlatform`, so the type system guarantees this is total.
 */
export function getPlatformConfig(platform: SocialPlatform): PlatformConfig {
  return PLATFORM_CONFIG[platform];
}
