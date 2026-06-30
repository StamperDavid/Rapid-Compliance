/**
 * Composer Assist Service
 *
 * Powers the inline "AI assist" control in the per-platform post composer
 * (rephrase / shorten / expand / change tone). Each transform is run through
 * the REAL per-platform marketing specialist whose Golden Master already has
 * Brand DNA baked in at seed time (Standing Rule #1 — no runtime Brand DNA
 * merge here, and no hardcoded transformations).
 *
 * The specialists expose a `generate_content` action. There is no dedicated
 * "rewrite" action, so — exactly as the sibling generate-post flow does — we
 * hand the specialist a transform brief as the `topic`: the operator's current
 * draft plus the requested transformation. The specialist returns its normal
 * platform-shaped JSON; we extract the primary post text from it (the same
 * extraction MarketingManager and the social-post orchestrator use) and return
 * just the rewritten copy.
 *
 * Standing Rule #2: this module does NOT touch any Golden Master document.
 *
 * @module lib/social/composer-assist-service
 */

import { v4 as uuidv4 } from 'uuid';
import { logger } from '@/lib/logger/logger';
import type { AgentMessage, AgentReport } from '@/lib/agents/types';
import type { SocialPlatform } from '@/types/social';

const FILE = 'lib/social/composer-assist-service.ts';

// ─── Public contract ──────────────────────────────────────────────────────────

/** The four inline transforms the composer offers. */
export const COMPOSER_ASSIST_ACTIONS = ['rephrase', 'shorten', 'expand', 'tone'] as const;
export type ComposerAssistAction = (typeof COMPOSER_ASSIST_ACTIONS)[number];

/** Tone targets for the "change tone" action. */
export const COMPOSER_ASSIST_TONES = ['professional', 'casual', 'bold', 'friendly'] as const;
export type ComposerAssistTone = (typeof COMPOSER_ASSIST_TONES)[number];

export interface ComposerAssistInput {
  platform: SocialPlatform;
  /** The operator's current draft copy. */
  text: string;
  action: ComposerAssistAction;
  /** Required when action === 'tone'. Ignored otherwise. */
  tone?: ComposerAssistTone;
}

export interface ComposerAssistResult {
  /** The rewritten copy, Brand-DNA-voiced by the platform specialist. */
  text: string;
}

// ─── Specialist resolution ────────────────────────────────────────────────────

/**
 * Minimal shape every marketing specialist factory produces. We only call
 * `initialize` + `execute` here, so we deliberately keep this surface narrow.
 */
interface ExecutableSpecialist {
  initialize: () => Promise<void>;
  execute: (message: AgentMessage) => Promise<AgentReport>;
}

/**
 * Resolve the platform specialist factory. Dynamic imports mirror the
 * social-post orchestrator so the whole specialist barrel isn't pulled into
 * every request's cold start. Returns null when the platform has no specialist
 * (the caller turns that into an honest "not available" response).
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

// ─── Transform brief ──────────────────────────────────────────────────────────

/** Plain-English instruction for each transform, embedded as the specialist topic. */
function transformInstruction(action: ComposerAssistAction, tone?: ComposerAssistTone): string {
  switch (action) {
    case 'rephrase':
      return 'Rephrase this post. Keep the same meaning and roughly the same length, but use fresh wording and a stronger flow.';
    case 'shorten':
      return 'Make this post noticeably shorter and punchier. Keep the core message and any key facts, links, or numbers; cut filler and repetition.';
    case 'expand':
      return 'Expand this post with more useful detail, context, and value. Keep it on-message and natural — do not pad with fluff.';
    case 'tone':
      return `Rewrite this post in a ${tone ?? 'professional'} tone, while keeping the same core message and any key facts, links, or numbers.`;
    default:
      return 'Rephrase this post while keeping the same meaning.';
  }
}

/**
 * Build the `topic` we hand the specialist's generate_content action. It frames
 * the work as an edit of existing copy rather than net-new content, so the
 * specialist rewrites the operator's draft instead of inventing a fresh post.
 */
function buildTransformTopic(input: ComposerAssistInput): string {
  return [
    'You are editing an existing social post draft, not writing a new one from scratch.',
    transformInstruction(input.action, input.tone),
    'Stay in the brand voice. Keep it as a single post. Do not add hashtags unless they read naturally. Return the rewritten post as the primary post text.',
    '',
    'EXISTING DRAFT (verbatim):',
    '"""',
    input.text,
    '"""',
  ].join('\n');
}

// ─── Primary-text extraction ──────────────────────────────────────────────────

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
 * in MarketingManager.executeSinglePlatformPost and the social-post
 * orchestrator, extended to the per-platform field names.
 */
function extractPrimaryText(data: unknown): string {
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

// ─── Public entry point ───────────────────────────────────────────────────────

/**
 * Run an inline composer transform through the real platform specialist and
 * return the rewritten copy. Throws on any honest failure (no specialist for
 * the platform, specialist FAILED, or no extractable text) so the API route
 * can surface a plain-English error — never a silent or faked result.
 */
export async function runComposerAssist(input: ComposerAssistInput): Promise<ComposerAssistResult> {
  const specialist = await resolveSpecialist(input.platform);
  if (!specialist) {
    throw new Error(`No AI specialist is available for ${input.platform}, so inline AI assist can't run here yet.`);
  }

  await specialist.initialize();

  const msgId = `assist_${uuidv4()}`;
  const message: AgentMessage = {
    id: msgId,
    timestamp: new Date(),
    from: 'COMPOSER_ASSIST',
    to: input.platform,
    type: 'COMMAND',
    priority: 'NORMAL',
    payload: {
      action: 'generate_content',
      topic: buildTransformTopic(input),
      contentType: 'post',
    },
    requiresResponse: true,
    traceId: `assist-${msgId}`,
  };

  const report = await specialist.execute(message);

  if (report.status !== 'COMPLETED') {
    const reason = report.errors?.join('; ') ?? 'the specialist returned a non-completed status';
    logger.warn('[ComposerAssist] Specialist did not complete', {
      file: FILE,
      platform: input.platform,
      action: input.action,
      reason,
    });
    throw new Error(`The ${input.platform} specialist couldn't rewrite that: ${reason}`);
  }

  const text = extractPrimaryText(report.data).trim();
  if (!text) {
    logger.warn('[ComposerAssist] No extractable text from specialist result', {
      file: FILE,
      platform: input.platform,
      action: input.action,
    });
    throw new Error('The specialist returned a response we could not turn into post text. Please try again.');
  }

  return { text };
}
