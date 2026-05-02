/**
 * format-normalizer — maps free-form AI format strings and per-platform
 * contentType values to a stable canonical enum used by the
 * generate-post endpoint.
 *
 * Canonical values deliberately mirror the contentType variants that the
 * per-platform composers already produce so callers can pass either.
 */

export type CanonicalFormat =
  | 'single-post'
  | 'thread'
  | 'carousel'
  | 'image-post'
  | 'short-form-video'
  | 'long-form-video'
  | 'audio-clip';

/**
 * Maps the AI specialist's free-form format label (e.g. "Carousel post") or
 * the composer's contentType (e.g. "carousel") to a CanonicalFormat.
 *
 * Matching is case-insensitive and falls back to 'single-post' for any
 * unrecognised value — the generate-post endpoint treats 'single-post' as
 * the safe default.
 *
 * Full mapping table:
 *
 * | Input substring (case-insensitive)   | CanonicalFormat      |
 * |--------------------------------------|----------------------|
 * | thread, tweet thread                 | thread               |
 * | carousel                             | carousel             |
 * | image, photo, single image           | image-post           |
 * | short video, reel, short, tiktok…   | short-form-video     |
 * | long video, youtube, video (generic) | long-form-video      |
 * | audio, podcast, clip, sound          | audio-clip           |
 * | anything else                        | single-post          |
 */
export function normalizeFormat(
  suggestionFormat?: string,
  contentType?: string,
): CanonicalFormat {
  // Prefer the AI-provided format string; fall through to the composer's
  // contentType when the format is absent or empty.
  const raw = (suggestionFormat?.trim() ?? contentType?.trim() ?? '').toLowerCase();

  if (!raw) {
    return 'single-post';
  }

  // Thread / tweet-thread variants
  if (raw.includes('thread')) {
    return 'thread';
  }

  // Carousel
  if (raw.includes('carousel')) {
    return 'carousel';
  }

  // Image-only post (must come before generic "post" checks)
  if (
    raw.includes('image') ||
    raw.includes('photo') ||
    raw === 'pin' ||
    raw.includes('single image')
  ) {
    return 'image-post';
  }

  // Short-form video: reels, shorts, TikTok-style, explicit "short video"
  if (
    raw.includes('reel') ||
    raw.includes('short') || // "short", "shorts", "short video", "short-form"
    raw.includes('tiktok') ||
    raw === 'story' ||
    raw.includes('stories')
  ) {
    return 'short-form-video';
  }

  // Long-form video: YouTube, explainer, long video
  if (
    raw === 'video' ||
    raw.includes('long video') ||
    raw.includes('long-form video') ||
    raw.includes('youtube') ||
    raw.includes('webinar') ||
    raw.includes('explainer')
  ) {
    return 'long-form-video';
  }

  // Audio
  if (
    raw.includes('audio') ||
    raw.includes('podcast') ||
    raw.includes('sound') ||
    raw.includes('clip')
  ) {
    return 'audio-clip';
  }

  // Explicit single-post synonyms and anything that falls through
  return 'single-post';
}
