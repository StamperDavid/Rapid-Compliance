/**
 * Occasion / Holiday Post Service
 *
 * Powers the composer's one-click "themed post for an occasion" control. The
 * operator picks an upcoming occasion (from the curated list in
 * `occasions.ts`); the REAL per-platform marketing specialist (Brand DNA baked
 * into its Golden Master, Standing Rule #1) drafts a themed post tying the
 * occasion to the brand.
 *
 * Standing Rule #2: nothing here touches a Golden Master document.
 *
 * @module lib/social/occasion-post-service
 */

import type { SocialPlatform } from '@/types/social';
import { extractPrimaryText, runSpecialistGenerate } from './composer-specialist';

export interface OccasionPostInput {
  platform: SocialPlatform;
  contentType: string;
  /** Occasion display name, e.g. "Black Friday". */
  occasionName: string;
  /** Next occurrence date (ISO YYYY-MM-DD) for context — optional. */
  occasionDateIso?: string;
}

export interface OccasionPostResult {
  text: string;
}

function buildTopic(input: OccasionPostInput): string {
  const lines: string[] = [
    `Write a single, on-brand social post themed around ${input.occasionName}.`,
    'Make it feel timely and genuine for our audience — tie the occasion naturally to what our brand offers, without sounding like a generic stock greeting.',
  ];
  if (input.occasionDateIso) {
    lines.push(`The occasion falls on ${input.occasionDateIso}.`);
  }
  lines.push('Keep it as a single post for this platform. Return the post as the primary post text.');
  return lines.join('\n');
}

export async function runOccasionPost(input: OccasionPostInput): Promise<OccasionPostResult> {
  const data = await runSpecialistGenerate({
    platform: input.platform,
    contentType: input.contentType,
    from: 'COMPOSER_OCCASION',
    topic: buildTopic(input),
  });

  const text = extractPrimaryText(data).trim();
  if (!text) {
    throw new Error('The specialist returned a response we could not turn into post text. Please try again.');
  }

  return { text };
}
