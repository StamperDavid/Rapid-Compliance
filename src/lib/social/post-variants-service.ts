/**
 * Post Variants Service
 *
 * Powers the composer's "Give me variations" control. Produces N alternative
 * versions of the operator's current draft via the REAL per-platform marketing
 * specialist (Brand DNA baked into its Golden Master, Standing Rule #1). Each
 * variant is a separate specialist call steered toward a distinct angle, so the
 * operator gets genuinely different takes rather than three near-identical
 * rewrites. The operator picks one and it replaces the draft.
 *
 * Standing Rule #2: nothing here touches a Golden Master document.
 *
 * @module lib/social/post-variants-service
 */

import { logger } from '@/lib/logger/logger';
import type { SocialPlatform } from '@/types/social';
import { extractPrimaryText, runSpecialistGenerate } from './composer-specialist';

const FILE = 'lib/social/post-variants-service.ts';

/** Distinct steers so the variants don't collapse into the same post. */
const VARIANT_ANGLES: readonly string[] = [
  'Lead with a bold, attention-grabbing hook.',
  'Take a warmer, more conversational and personal tone.',
  'Emphasize the concrete benefit / outcome and end with a clear call to action.',
  'Use a curiosity / question-driven opening that pulls the reader in.',
  'Be crisp and punchy — shorter sentences, strong verbs, no filler.',
];

export interface PostVariantsInput {
  platform: SocialPlatform;
  contentType: string;
  /** The operator's current draft to riff on. */
  text: string;
  /** How many variants to produce. Clamped to 2-5. */
  count?: number;
}

export interface PostVariantsResult {
  variants: string[];
}

function buildTopic(text: string, angle: string): string {
  return [
    'Rewrite the social post draft below as a fresh alternative version.',
    'Keep the same core message and any key facts, links, or numbers, but make it a distinctly different take.',
    `Direction for this version: ${angle}`,
    'Stay in the brand voice and keep it as a single post for this platform. Return the rewritten post as the primary post text.',
    '',
    'EXISTING DRAFT:',
    '"""',
    text,
    '"""',
  ].join('\n');
}

export async function runPostVariants(input: PostVariantsInput): Promise<PostVariantsResult> {
  const count = Math.min(5, Math.max(2, input.count ?? 3));
  const angles = VARIANT_ANGLES.slice(0, count);

  const settled = await Promise.allSettled(
    angles.map((angle) =>
      runSpecialistGenerate({
        platform: input.platform,
        contentType: input.contentType,
        from: 'COMPOSER_VARIANTS',
        topic: buildTopic(input.text, angle),
      }),
    ),
  );

  const variants: string[] = [];
  const seen = new Set<string>();
  for (const result of settled) {
    if (result.status !== 'fulfilled') {
      logger.warn('[PostVariants] One variant call failed', {
        file: FILE,
        platform: input.platform,
        reason: result.reason instanceof Error ? result.reason.message : String(result.reason),
      });
      continue;
    }
    const text = extractPrimaryText(result.value).trim();
    if (!text) { continue; }
    const key = text.toLowerCase();
    if (seen.has(key)) { continue; }
    seen.add(key);
    variants.push(text);
  }

  if (variants.length === 0) {
    throw new Error('The specialist couldn\'t produce any variations right now. Please try again.');
  }

  return { variants };
}
