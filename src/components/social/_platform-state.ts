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
  // Apr 28 2026 — re-stated to reflect actual operator-facing reality.
  // Previously these were `live_dm_blocked` / `live_no_dm` / `no_specialist`,
  // which lumped them into "Available — not connected" and made the dashboard
  // imply they were ready to OAuth into. They aren't — each is gated on an
  // external approval that hasn't started or hasn't cleared. Anything not
  // actually connectable today is `coming_soon` so the renderer puts it in
  // the muted "Coming soon" group with a clear reason.
  linkedin: {
    state: 'coming_soon',
    specialistId: 'LINKEDIN_EXPERT',
    specialistName: 'LinkedIn Expert',
    dmCapability: 'blocked',
    blockReason:
      'LinkedIn requires Marketing Developer Platform approval (1–3 weeks) before client deployments can post.',
    unblockAction: 'Apply for LinkedIn Marketing Developer Platform',
  },
  facebook: {
    state: 'coming_soon',
    specialistId: 'FACEBOOK_ADS_EXPERT',
    specialistName: 'Facebook Ads Expert',
    dmCapability: 'blocked',
    blockReason:
      'Meta Developer App registration paused on device-trust gate (Apr 28). Retry no sooner than May 1–2; Meta Business Verification follows.',
    unblockAction:
      'Resume Meta Developer App registration after the device-trust window clears',
  },
  instagram: {
    state: 'coming_soon',
    specialistId: 'INSTAGRAM_EXPERT',
    specialistName: 'Instagram Expert',
    dmCapability: 'blocked',
    blockReason:
      'Same Meta gate as Facebook (bundled). Unblocks together once Meta Developer App + Business Verification clear.',
    unblockAction:
      'Resume Meta Developer App registration (Instagram OAuth bundles with Facebook)',
  },
  pinterest: {
    state: 'coming_soon',
    specialistId: 'PINTEREST_EXPERT',
    specialistName: 'Pinterest Expert',
    dmCapability: 'deferred',
    blockReason:
      'Pinterest Developer Portal approval (1–3 days). Application not yet submitted.',
    unblockAction: 'Submit Pinterest Developer Portal application',
  },
  tiktok: {
    state: 'coming_soon',
    specialistId: 'TIKTOK_EXPERT',
    specialistName: 'TikTok Expert',
    dmCapability: 'na',
    blockReason:
      'TikTok Content Posting API + Login Kit submission in progress. Pending app icon, demo video, and scope selection (Apr 28).',
    unblockAction: 'Upload icon, record demo video, finalize scopes, click Submit',
  },
  youtube: {
    state: 'coming_soon',
    specialistId: 'YOUTUBE_EXPERT',
    specialistName: 'YouTube Expert',
    dmCapability: 'na',
    blockReason:
      'Google OAuth verification (1–4 weeks). Application not yet submitted.',
    unblockAction: 'Submit Google OAuth verification for the YouTube scope',
  },
  threads: {
    state: 'coming_soon',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
    blockReason:
      'Threads piggybacks on the Meta gate (same as Facebook/Instagram). No specialist yet — public Threads API exposes posts only, no DM.',
    unblockAction: 'Resume Meta Developer App, then build THREADS_EXPERT',
  },
  telegram: {
    state: 'parked',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
    blockReason:
      'US SMB adoption < 10%. Marked for deletion (Apr 27 2026) — no commercial brand-account flow worth the surface area.',
  },
  whatsapp_business: {
    state: 'coming_soon',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
    blockReason:
      'Customer-initiated 24h messaging window only — narrow use case for outbound. Deferred until inbound customer-support automation is on the roadmap.',
    unblockAction: 'Re-evaluate when customer-support automation is in scope',
  },
  google_business: {
    state: 'coming_soon',
    specialistId: 'GOOGLE_BUSINESS_EXPERT',
    specialistName: 'Google Business Expert',
    dmCapability: 'na',
    blockReason:
      'Google Business Profile verification + GCP OAuth approval required (days). Specialist is built; awaiting external approval.',
    unblockAction: 'Verify Google Business Profile and request GCP OAuth scope',
  },
  reddit: {
    state: 'parked',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
    blockReason:
      'Reddit commercial API access is enterprise-only (~$10K+/mo). Per platform viability matrix (Apr 27 2026), Reddit is Tier 3 — no path forward without enterprise budget.',
  },
  truth_social: {
    state: 'parked',
    specialistId: null,
    specialistName: null,
    dmCapability: 'na',
    blockReason:
      'Cloudflare TLS-fingerprint wall blocks server-side posts. No path without browser-class TLS infra.',
  },
  // Creator-track additions (Apr 28 2026). Discord row added separately.
  // DM capability is `pending`: Discord allows bot DMs only when the user
  // shares a guild with the bot OR installed via user-context OAuth. The
  // specialist supports compose_dm_reply but the dispatcher must verify
  // delivery is permitted before sending.
  discord: {
    state: 'coming_soon',
    specialistId: 'DISCORD_EXPERT',
    specialistName: 'Discord Expert',
    dmCapability: 'pending',
    blockReason:
      'Central Discord Developer App not yet registered. Self-service for <100 servers; Bot Verification + Message Content Intent review at scale.',
    unblockAction: 'Register central Discord application at discord.com/developers',
  },
  twitch: {
    state: 'coming_soon',
    specialistId: 'TWITCH_EXPERT',
    specialistName: 'Twitch Expert',
    dmCapability: 'na',
    blockReason:
      'Central Twitch Developer App not yet registered at dev.twitch.tv. Self-service registration, no partner-tier required for Helix posting/metrics.',
    unblockAction: 'Register central Twitch application at dev.twitch.tv',
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
