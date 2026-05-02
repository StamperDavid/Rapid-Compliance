/**
 * AI Generate Post — Mission Kickoff
 *
 * POST /api/social/platforms/{platform}/generate-post
 *
 * Creates a Mission Control mission that runs the three-step social post
 * generation pipeline:
 *
 *   Step 1 — {PLATFORM}_EXPERT generates a post brief (Brand DNA baked
 *             into the specialist's GM at seed time, Standing Rule #1).
 *   Step 2 — Magic Studio materialises the brief into final assets.
 *   Step 3 — AWAITING_APPROVAL — operator reviews via InlineReviewCard.
 *
 * This endpoint is called from two UI surfaces:
 *   a) "AI Generate" button on the per-platform PlatformComposer
 *   b) "Use this" on a Suggested Content card in the insights panel
 *
 * The manual-typing path in PlatformComposer.handlePost is NOT touched by
 * this route — that path bypasses Mission Control as per the spec.
 *
 * Body (at least one of brief | hook+body | suggestionId must resolve to text):
 *   {
 *     brief?: string;        // free-form operator prompt
 *     hook?: string;         // suggestion-card hook line
 *     body?: string;         // suggestion-card body copy
 *     format?: string;       // e.g. 'post', 'thread', 'image-post'. Default 'post'
 *     suggestionId?: string; // integer index into the saved suggestedContent array
 *   }
 *
 * Response on success: { success: true, missionId: string }
 * Response on error:   { success: false, error: string }
 *
 * Standing Rule #2: this route does NOT mutate any Golden Master document.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { getPlatformConfig } from '@/components/social/_platform-state';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import {
  initSocialPostMission,
  runSocialPostMission,
} from '@/lib/orchestrator/social-post-orchestrator';

export const dynamic = 'force-dynamic';

// ── Validation schemas ────────────────────────────────────────────────────────

const PlatformParamSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const GeneratePostBodySchema = z.object({
  brief: z.string().min(1).max(2000).optional(),
  hook: z.string().min(1).max(400).optional(),
  body: z.string().min(1).max(2000).optional(),
  format: z.string().min(1).max(80).optional(),
  suggestionId: z.string().max(20).optional(),
});

// At least one usable text source must be present. Checked after parsing.
function hasTextSource(data: z.infer<typeof GeneratePostBodySchema>): boolean {
  return (
    (typeof data.brief === 'string' && data.brief.trim().length > 0) ||
    (typeof data.hook === 'string' && data.hook.trim().length > 0) ||
    (typeof data.body === 'string' && data.body.trim().length > 0) ||
    (typeof data.suggestionId === 'string' && data.suggestionId.trim().length > 0)
  );
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  // Rate limit
  const rl = await rateLimitMiddleware(request, '/api/social/platforms/generate-post');
  if (rl) { return rl; }

  // Auth
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    // Platform param
    const rawParams = await params;
    const parsedPlatform = PlatformParamSchema.safeParse(rawParams);
    if (!parsedPlatform.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform', details: parsedPlatform.error.flatten() },
        { status: 422 },
      );
    }
    const platform = parsedPlatform.data.platform;

    // Platform gating — only platforms with a specialist can generate posts.
    const config = getPlatformConfig(platform);
    if (!config.specialistId) {
      return NextResponse.json(
        {
          success: false,
          error: `No AI specialist is registered for ${platform}. AI post generation requires a specialist.`,
        },
        { status: 409 },
      );
    }
    if (config.state === 'parked') {
      return NextResponse.json(
        { success: false, error: `${platform} is parked — AI post generation is disabled.` },
        { status: 409 },
      );
    }

    // Body
    const rawBody: unknown = await request.json();
    const parsedBody = GeneratePostBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsedBody.error.flatten() },
        { status: 422 },
      );
    }

    if (!hasTextSource(parsedBody.data)) {
      return NextResponse.json(
        {
          success: false,
          error:
            'At least one of brief, hook, body, or suggestionId must be provided to generate a post.',
        },
        { status: 422 },
      );
    }

    // Create the mission skeleton synchronously — return the missionId so the
    // UI can start polling Mission Control immediately.
    const { missionId } = await initSocialPostMission({
      platform,
      brief: parsedBody.data.brief,
      hook: parsedBody.data.hook,
      body: parsedBody.data.body,
      format: parsedBody.data.format,
      suggestionId: parsedBody.data.suggestionId,
      createdByUid: authResult.user.uid,
    });

    logger.info('[GeneratePost] Mission created, firing orchestrator', {
      missionId,
      platform,
      uid: authResult.user.uid,
    });

    // Run the orchestrator fire-and-forget so the HTTP response is not held
    // while steps 1-3 execute (can take 5-30 seconds depending on the LLM).
    // Errors inside runSocialPostMission are caught there and written onto
    // the mission doc — the client polls and sees FAILED if something broke.
    void runSocialPostMission(missionId);

    return NextResponse.json({ success: true, missionId });
  } catch (err) {
    logger.error(
      '[GeneratePost] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : 'Failed to generate post' },
      { status: 500 },
    );
  }
}
