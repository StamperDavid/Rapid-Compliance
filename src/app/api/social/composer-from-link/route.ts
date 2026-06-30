/**
 * Composer — Link / Article → Post
 *
 * POST /api/social/composer-from-link
 *
 * Turns a pasted article URL or pasted article text into a brand-voiced post
 * via the REAL per-platform marketing specialist (Brand DNA baked into its
 * Golden Master, Standing Rule #1). URL fetching is SSRF-guarded in the
 * service.
 *
 * Body:
 *   {
 *     platform: SocialPlatform,
 *     contentType: string,
 *     url?: string,           // an http(s) article URL
 *     articleText?: string,   // OR pasted article text (preferred simple path)
 *     angle?: string          // optional steer
 *   }
 * One of url / articleText is required.
 *
 * Success: { success: true, text: string, source: 'url' | 'pasted' }
 * Error:   { success: false, error: string }
 *
 * Auth-gated. No faked output — honest errors on fetch failure or specialist
 * failure. Standing Rule #2: does NOT mutate any Golden Master.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getPlatformConfig } from '@/components/social/_platform-state';
import { SOCIAL_PLATFORMS } from '@/types/social';
import { LinkFetchError, runLinkToPost } from '@/lib/social/link-to-post-service';

export const dynamic = 'force-dynamic';

const BodySchema = z
  .object({
    platform: z.enum(SOCIAL_PLATFORMS),
    contentType: z.string().min(1).max(50),
    url: z.string().trim().min(1).max(2000).optional(),
    articleText: z.string().trim().min(1).max(50000).optional(),
    angle: z.string().trim().max(500).optional(),
  })
  .refine((d) => Boolean(d.url) || Boolean(d.articleText), {
    message: 'Provide an article URL or paste the article text.',
    path: ['url'],
  });

export async function POST(request: NextRequest) {
  const rl = await rateLimitMiddleware(request, '/api/social/composer-from-link');
  if (rl) { return rl; }

  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const rawBody: unknown = await request.json();
    const parsed = BodySchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const { platform, contentType, url, articleText, angle } = parsed.data;

    const config = getPlatformConfig(platform);
    if (!config.specialistId) {
      return NextResponse.json(
        { success: false, error: `No AI specialist is registered for ${platform} yet.` },
        { status: 409 },
      );
    }

    const result = await runLinkToPost({
      platform,
      contentType,
      ...(url ? { url } : {}),
      ...(articleText ? { articleText } : {}),
      ...(angle ? { angle } : {}),
    });

    return NextResponse.json({ success: true, text: result.text, source: result.source });
  } catch (err) {
    // LinkFetchError carries a plain-English, operator-safe message — surface
    // it as a 422 so the UI can show it directly.
    if (err instanceof LinkFetchError) {
      return NextResponse.json({ success: false, error: err.message }, { status: 422 });
    }
    logger.error(
      '[ComposerFromLink] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to draft from link' },
      { status: 500 },
    );
  }
}
