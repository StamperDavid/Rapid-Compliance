/**
 * Composer Assist — inline AI rewrite for the post composer
 *
 * POST /api/social/composer-assist
 *
 * Backs the composer's inline "AI assist" control (Rephrase / Shorten /
 * Expand / Change tone). Runs the operator's current draft through the REAL
 * per-platform marketing specialist, whose Golden Master already has Brand DNA
 * baked in (Standing Rule #1). Returns just the rewritten copy so the UI can
 * drop it back into the post box.
 *
 * Body:
 *   {
 *     platform: SocialPlatform,
 *     text: string,                                   // current draft, 1-50000
 *     action: 'rephrase'|'shorten'|'expand'|'tone',
 *     tone?: 'professional'|'casual'|'bold'|'friendly' // required when action==='tone'
 *   }
 *
 * Response on success: { success: true, text: string }
 * Response on error:   { success: false, error: string }
 *
 * Auth-gated. No faked output — an honest error is returned if the specialist
 * fails or none is registered for the platform.
 *
 * Standing Rule #2: this route does NOT mutate any Golden Master document.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getPlatformConfig } from '@/components/social/_platform-state';
import { SOCIAL_PLATFORMS } from '@/types/social';
import {
  runComposerAssist,
  COMPOSER_ASSIST_ACTIONS,
  COMPOSER_ASSIST_TONES,
} from '@/lib/social/composer-assist-service';

export const dynamic = 'force-dynamic';

const ComposerAssistBodySchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    text: z.string().min(1).max(50000),
    action: z.enum(COMPOSER_ASSIST_ACTIONS),
    tone: z.enum(COMPOSER_ASSIST_TONES).optional(),
  })
  .refine((data) => data.action !== 'tone' || data.tone !== undefined, {
    message: "A tone must be provided when action is 'tone'.",
    path: ['tone'],
  });

export async function POST(request: NextRequest) {
  // Rate limit
  const rl = await rateLimitMiddleware(request, '/api/social/composer-assist');
  if (rl) { return rl; }

  // Auth
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const rawBody: unknown = await request.json();
    const parsed = ComposerAssistBodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { platform, text, action, tone } = parsed.data;

    // Gate on the product source-of-truth for "has a specialist" — mirrors the
    // sibling generate-post route so AI assist is only offered where a real
    // specialist exists.
    const config = getPlatformConfig(platform);
    if (!config.specialistId) {
      return NextResponse.json(
        {
          success: false,
          error: `No AI specialist is registered for ${platform}, so inline AI assist isn't available here yet.`,
        },
        { status: 409 },
      );
    }

    const result = await runComposerAssist({
      platform,
      text,
      action,
      ...(tone ? { tone } : {}),
    });

    return NextResponse.json({ success: true, text: result.text });
  } catch (err) {
    logger.error(
      '[ComposerAssist] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to run AI assist' },
      { status: 500 },
    );
  }
}
