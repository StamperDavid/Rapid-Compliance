/**
 * Hashtag Suggestion Service
 *
 * Powers the composer's "Suggest hashtags" control. Asks the REAL per-platform
 * marketing specialist (Brand DNA baked into its Golden Master, Standing Rule
 * #1) for the best hashtags for the operator's current draft, respecting that
 * platform's hashtag conventions. We read the specialist's structured
 * `hashtags` field (falling back to scanning its post body).
 *
 * Standing Rule #2: nothing here touches a Golden Master document.
 *
 * @module lib/social/hashtag-suggest-service
 */

import type { SocialPlatform } from '@/types/social';
import { extractHashtags, runSpecialistGenerate } from './composer-specialist';

/** How many hashtags we cap the suggestion list at, regardless of platform. */
const MAX_HASHTAGS = 12;

export interface HashtagSuggestInput {
  platform: SocialPlatform;
  contentType: string;
  /** The operator's current draft. */
  text: string;
}

export interface HashtagSuggestResult {
  hashtags: string[];
}

function buildTopic(input: HashtagSuggestInput): string {
  return [
    'Suggest the best hashtags for the draft post below, for THIS platform.',
    'Follow this platform\'s hashtag conventions (count, style, casing). Choose hashtags that are relevant and discoverable, not generic filler.',
    'Return a post that keeps the same message, and put your recommended hashtags in the hashtags field of your response.',
    '',
    'DRAFT POST:',
    '"""',
    input.text,
    '"""',
  ].join('\n');
}

export async function runHashtagSuggest(input: HashtagSuggestInput): Promise<HashtagSuggestResult> {
  const data = await runSpecialistGenerate({
    platform: input.platform,
    contentType: input.contentType,
    from: 'COMPOSER_HASHTAGS',
    topic: buildTopic(input),
  });

  const hashtags = extractHashtags(data).slice(0, MAX_HASHTAGS);
  if (hashtags.length === 0) {
    throw new Error("The specialist didn't return any usable hashtags. Please try again.");
  }

  return { hashtags };
}
