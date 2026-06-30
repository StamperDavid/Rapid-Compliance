/**
 * Composer Specialist Helper (shared)
 *
 * Shared specialist-resolution + result-extraction plumbing for the composer's
 * "quick win" AI controls (URL → post, occasion post, hashtag generator,
 * multi-variant generation). Every control runs the operator's request through
 * the REAL per-platform marketing specialist, whose Golden Master already has
 * Brand DNA baked in at seed time (Standing Rule #1 — no runtime Brand DNA
 * merge here, no hardcoded output). Standing Rule #2: nothing in this module
 * touches a Golden Master document.
 *
 * This mirrors the resolution + extraction approach in
 * `composer-assist-service.ts` (the inline rewrite control). It is split into
 * its own module so the four new composer features share one implementation
 * instead of each copying the switch + extractor.
 *
 * @module lib/social/composer-specialist
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger/logger';
import type { AgentMessage, AgentReport } from '@/lib/agents/types';
import type { SocialPlatform } from '@/types/social';

const FILE = 'lib/social/composer-specialist.ts';

/**
 * Minimal shape every marketing specialist factory produces. We only call
 * `initialize` + `execute`, so we deliberately keep this surface narrow.
 */
interface ExecutableSpecialist {
  initialize: () => Promise<void>;
  execute: (message: AgentMessage) => Promise<AgentReport>;
}

/**
 * Resolve the platform specialist factory. Dynamic imports mirror the
 * composer-assist service + social-post orchestrator so the whole specialist
 * barrel isn't pulled into every request's cold start. Returns null when the
 * platform has no specialist (the caller turns that into an honest error).
 */
async function resolveSpecialist(platform: SocialPlatform): Promise<ExecutableSpecialist | null> {
  switch (platform) {
    case 'twitter': {
      const { getTwitterExpert } = await import('@/lib/agents/marketing/twitter/specialist');
      return getTwitterExpert();
    }
    case 'linkedin': {
      const { getLinkedInExpert } = await import('@/lib/agents/marketing/linkedin/specialist');
      return getLinkedInExpert();
    }
    case 'facebook': {
      const { getFacebookAdsExpert } = await import('@/lib/agents/marketing/facebook/specialist');
      return getFacebookAdsExpert();
    }
    case 'instagram': {
      const { getInstagramExpert } = await import('@/lib/agents/marketing/instagram/specialist');
      return getInstagramExpert();
    }
    case 'youtube': {
      const { getYouTubeExpert } = await import('@/lib/agents/marketing/youtube/specialist');
      return getYouTubeExpert();
    }
    case 'tiktok': {
      const { getTikTokExpert } = await import('@/lib/agents/marketing/tiktok/specialist');
      return getTikTokExpert();
    }
    case 'bluesky': {
      const { getBlueskyExpert } = await import('@/lib/agents/marketing/bluesky/specialist');
      return getBlueskyExpert();
    }
    case 'threads': {
      const { getThreadsExpert } = await import('@/lib/agents/marketing/threads/specialist');
      return getThreadsExpert();
    }
    case 'mastodon': {
      const { getMastodonExpert } = await import('@/lib/agents/marketing/mastodon/specialist');
      return getMastodonExpert();
    }
    case 'pinterest': {
      const { getPinterestExpert } = await import('@/lib/agents/marketing/pinterest/specialist');
      return getPinterestExpert();
    }
    case 'whatsapp_business': {
      const { getWhatsAppBusinessExpert } = await import('@/lib/agents/marketing/whatsapp-business/specialist');
      return getWhatsAppBusinessExpert();
    }
    case 'google_business': {
      const { getGoogleBusinessExpert } = await import('@/lib/agents/marketing/google-business/specialist');
      return getGoogleBusinessExpert();
    }
    case 'discord': {
      const { getDiscordExpert } = await import('@/lib/agents/marketing/discord/specialist');
      return getDiscordExpert();
    }
    case 'twitch': {
      const { getTwitchExpert } = await import('@/lib/agents/marketing/twitch/specialist');
      return getTwitchExpert();
    }
    default:
      return null;
  }
}

// ─── Result extraction ──────────────────────────────────────────────────────

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function getNestedContent(value: unknown): string | null {
  if (value && typeof value === 'object') {
    const content = (value as Record<string, unknown>).content;
    return asString(content);
  }
  return null;
}

/**
 * Pull the single post body out of a specialist's platform-shaped result.
 * Covers every social specialist's primary-copy field. Mirrors the extraction
 * in `composer-assist-service.ts`.
 */
export function extractPrimaryText(data: unknown): string {
  if (!data || typeof data !== 'object') { return ''; }
  const d = data as Record<string, unknown>;

  // Bluesky / Mastodon / Threads → primaryPost (string).
  // Google Business → primaryPost (object with .content).
  const primaryPostString = asString(d.primaryPost);
  if (primaryPostString) { return primaryPostString; }
  const primaryPostContent = getNestedContent(d.primaryPost);
  if (primaryPostContent) { return primaryPostContent; }

  // Twitter/X → standaloneTweet.
  const standaloneTweet = asString(d.standaloneTweet);
  if (standaloneTweet) { return standaloneTweet; }

  // Instagram / TikTok → caption.
  const caption = asString(d.caption);
  if (caption) { return caption; }

  // Discord → primaryMessage.
  const primaryMessage = asString(d.primaryMessage);
  if (primaryMessage) { return primaryMessage; }

  // Twitch → primaryContent.
  const primaryContent = asString(d.primaryContent);
  if (primaryContent) { return primaryContent; }

  // LinkedIn → post.content.
  const postContent = getNestedContent(d.post);
  if (postContent) { return postContent; }

  // Facebook Ads → adCreative.primary.primaryText.
  if (d.adCreative && typeof d.adCreative === 'object') {
    const primary = (d.adCreative as Record<string, unknown>).primary;
    if (primary && typeof primary === 'object') {
      const primaryText = asString((primary as Record<string, unknown>).primaryText);
      if (primaryText) { return primaryText; }
    }
  }

  // Pinterest → pinTitle + pinDescription.
  const pinTitle = asString(d.pinTitle);
  const pinDescription = asString(d.pinDescription);
  if (pinTitle && pinDescription) { return `${pinTitle}\n\n${pinDescription}`; }

  // YouTube → description is the closest single "post body".
  const description = asString(d.description);
  if (description) { return description; }

  return '';
}

/**
 * Normalize a single hashtag to a `#word` token (no spaces, single leading #).
 * Returns null if nothing usable remains.
 */
function normalizeHashtag(raw: string): string | null {
  // Keep letters, digits and underscores; drop everything else (spaces,
  // punctuation, stray # in the middle).
  const cleaned = raw.replace(/^#+/, '').replace(/[^\p{L}\p{N}_]/gu, '');
  if (cleaned.length === 0) { return null; }
  return `#${cleaned}`;
}

/**
 * Pull a deduped, normalized hashtag list out of a specialist result. Prefers
 * the structured `hashtags` array every social specialist emits; falls back to
 * regex-scanning the primary post body for `#tags`.
 */
export function extractHashtags(data: unknown): string[] {
  const out: string[] = [];
  const seen = new Set<string>();

  const push = (raw: string): void => {
    const tag = normalizeHashtag(raw);
    if (!tag) { return; }
    const key = tag.toLowerCase();
    if (seen.has(key)) { return; }
    seen.add(key);
    out.push(tag);
  };

  if (data && typeof data === 'object') {
    const d = data as Record<string, unknown>;
    if (Array.isArray(d.hashtags)) {
      for (const h of d.hashtags) {
        if (typeof h === 'string') { push(h); }
      }
    }
  }

  // Fallback: scan the post body for inline #tags.
  if (out.length === 0) {
    const body = extractPrimaryText(data);
    const matches = body.match(/#[\p{L}\p{N}_]+/gu);
    if (matches) {
      for (const m of matches) { push(m); }
    }
  }

  return out;
}

// ─── Generic specialist execution ───────────────────────────────────────────

export interface SpecialistGenerateInput {
  platform: SocialPlatform;
  /** The brief handed to the specialist's `generate_content` action as `topic`. */
  topic: string;
  /** Per-platform content variant (e.g. 'post', 'video', 'pin'). */
  contentType: string;
  /** `from` label on the AgentMessage, for tracing which control fired. */
  from: string;
}

/**
 * Run a specialist's `generate_content` action and return its raw result data
 * (unknown — callers extract the field they need). Throws on any honest
 * failure (no specialist, non-completed status) so the API route can surface a
 * plain-English error rather than a silent or faked result.
 */
export async function runSpecialistGenerate(input: SpecialistGenerateInput): Promise<unknown> {
  const specialist = await resolveSpecialist(input.platform);
  if (!specialist) {
    throw new Error(`No AI specialist is available for ${input.platform} yet.`);
  }

  await specialist.initialize();

  const msgId = `${input.from.toLowerCase()}_${uuidv4()}`;
  const message: AgentMessage = {
    id: msgId,
    timestamp: new Date(),
    from: input.from,
    to: input.platform,
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'generate_content',
      topic: input.topic,
      contentType: input.contentType,
    },
    requiresResponse: true,
    traceId: `${input.from.toLowerCase()}-${msgId}`,
  };

  const report = await specialist.execute(message);

  if (report.status !== 'COMPLETED') {
    const reason = report.errors?.join('; ') ?? 'the specialist returned a non-completed status';
    logger.warn('[ComposerSpecialist] Specialist did not complete', {
      file: FILE,
      platform: input.platform,
      from: input.from,
      reason,
    });
    throw new Error(`The ${input.platform} specialist couldn't finish that: ${reason}`);
  }

  return report.data;
}
