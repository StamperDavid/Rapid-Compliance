/**
 * Make Clips — platform / format catalogue.
 *
 * Each entry maps an operator-facing target (TikTok, Reels, Shorts, …) onto:
 *   - the render route's `aspect` ('9:16' vertical for shorts, '16:9' landscape),
 *   - the social scheduler's platform identifier (`SocialPlatform` from
 *     `@/types/social`, which the real POST /api/social/schedule route validates).
 *
 * Several targets share one scheduler platform (Reels + Feed both schedule to
 * 'instagram'); they differ only in the aspect we render. The scheduler does not
 * have a "Reels vs Feed" switch, so we surface the FORMAT to the operator and
 * post to the underlying platform.
 */

import type { SocialPlatform } from '@/types/social';

/** The render route accepts exactly these two aspect ratios. */
export type ClipAspect = '9:16' | '16:9';

export interface ClipFormat {
  /** Stable id used as the selection key. */
  id: string;
  /** Operator-facing label shown on the toggle. */
  label: string;
  /** The platform string the scheduler route validates against. */
  platform: SocialPlatform;
  /** The aspect the render route should produce for this format. */
  aspect: ClipAspect;
  /** One-line "what this is" helper, plain English. */
  hint: string;
}

/**
 * The formats offered for clips. Vertical-first (that is what shorts are), with
 * a couple of landscape options for completeness. Every `platform` here is a
 * member of SOCIAL_PLATFORMS, so the scheduler route accepts it as-is.
 */
export const CLIP_FORMATS: readonly ClipFormat[] = [
  { id: 'tiktok', label: 'TikTok', platform: 'tiktok', aspect: '9:16', hint: 'Vertical short' },
  { id: 'reels', label: 'Instagram Reels', platform: 'instagram', aspect: '9:16', hint: 'Vertical short' },
  { id: 'shorts', label: 'YouTube Shorts', platform: 'youtube', aspect: '9:16', hint: 'Vertical short' },
  { id: 'facebook-reels', label: 'Facebook Reels', platform: 'facebook', aspect: '9:16', hint: 'Vertical short' },
  { id: 'youtube-wide', label: 'YouTube (landscape)', platform: 'youtube', aspect: '16:9', hint: 'Widescreen' },
  { id: 'linkedin', label: 'LinkedIn', platform: 'linkedin', aspect: '16:9', hint: 'Widescreen' },
] as const;

export function getClipFormat(id: string): ClipFormat | undefined {
  return CLIP_FORMATS.find((f) => f.id === id);
}
