/**
 * Editor B-Roll text-to-VIDEO API (Generative VFX mode, Video option)
 * POST /api/video/editor/broll
 *
 * Auth-gated. Generates ONE short B-roll VIDEO clip from a text prompt on the
 * REAL fal / Seedance text-to-video engine — the SAME provider the Shot Plan
 * generator drives (`getVideoEngineProvider('fal').generateTextToVideo`). It
 * submits the generation, polls fal's queue to completion, downloads the clip off
 * fal's temporary CDN, and persists it to OUR Firebase Storage with a permanent
 * download-token URL (`persistUrlToStorage` — the same helper the Studio image
 * route uses). It then returns the permanent URL + duration.
 *
 * NOTHING IS FAKED. On any failure — most commonly a missing fal API key — the
 * route returns `{ success: false, error }` with the real reason and NO url. A
 * clip URL is returned ONLY when fal actually produced a video and it was
 * persisted. The fal key lives in Firestore (resolved inside the provider via
 * `apiKeyService`), never in env.
 *
 * Note vs. the image B-roll path: text-to-video is real generation that takes
 * meaningfully longer than a still, so the route polls up to a generous ceiling.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { requireAuth } from '@/lib/auth/api-auth';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { persistUrlToStorage } from '@/lib/firebase/storage-utils';
import {
  getVideoEngineProvider,
  type TenantContext,
  type VideoGenerateRequest,
} from '@/lib/video/providers';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/video/editor/broll/route.ts';

// ────────────────────────────────────────────────────────────────────────────
// Request validation
// ────────────────────────────────────────────────────────────────────────────

/**
 * Seedance accepts a clip duration of 4–15 seconds. We clamp the operator's
 * request into that range with a sensible 5s default for a B-roll cutaway.
 */
const MIN_DURATION_SECONDS = 4;
const MAX_DURATION_SECONDS = 15;
const DEFAULT_DURATION_SECONDS = 5;

const BrollVideoSchema = z.object({
  prompt: z.string().trim().min(1, 'prompt is required').max(1000),
  aspectRatio: z.enum(['16:9', '9:16', '1:1']),
  durationSeconds: z
    .number()
    .int('durationSeconds must be a whole number of seconds')
    .min(MIN_DURATION_SECONDS, `durationSeconds must be at least ${MIN_DURATION_SECONDS}`)
    .max(MAX_DURATION_SECONDS, `durationSeconds must be at most ${MAX_DURATION_SECONDS}`)
    .optional()
    .default(DEFAULT_DURATION_SECONDS),
});

// ────────────────────────────────────────────────────────────────────────────
// Polling (mirrors the Shot Plan generator's proven poll loop)
// ────────────────────────────────────────────────────────────────────────────

/** 5s cadence, ~15 min ceiling — generous for a single short B-roll clip. */
const POLL_INTERVAL_MS = 5_000;
const POLL_MAX_ATTEMPTS = 180;

const sleep = (ms: number): Promise<void> =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/**
 * Poll a submitted generation to completion via the engine-agnostic provider,
 * returning the (temporary) fal video URL. Throws a clear error on failure /
 * timeout — never returns a placeholder.
 */
async function pollToCompletion(
  generationId: string,
  ctx: TenantContext,
): Promise<string> {
  const provider = getVideoEngineProvider('fal');
  for (let i = 0; i < POLL_MAX_ATTEMPTS; i += 1) {
    await sleep(POLL_INTERVAL_MS);
    const status = await provider.getStatus(generationId, ctx);
    if (status.status === 'completed') {
      if (!status.videoUrl) {
        throw new Error('Generation completed but returned no video URL.');
      }
      return status.videoUrl;
    }
    if (status.status === 'failed') {
      throw new Error(status.error ?? 'Video generation failed.');
    }
  }
  throw new Error(
    `Video generation timed out after ~${Math.round(
      (POLL_INTERVAL_MS * POLL_MAX_ATTEMPTS) / 60000,
    )} minutes.`,
  );
}

// ────────────────────────────────────────────────────────────────────────────
// Route handler
// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth.
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    // 2. Validate body.
    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = BrollVideoSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }
    const { prompt, aspectRatio, durationSeconds } = parsed.data;

    const ctx: TenantContext = { tenantId: PLATFORM_ID };
    const provider = getVideoEngineProvider('fal');

    // 3. Submit a REAL text-to-video generation on fal / Seedance. The provider
    //    resolves the fal key from Firestore; a missing key throws here and is
    //    surfaced to the operator below (no fake clip is ever produced).
    const req: VideoGenerateRequest = {
      prompt,
      aspectRatio,
      durationSeconds,
      resolution: '1080p',
      // B-roll is silent supporting footage — no engine-generated voice track.
      generateAudio: false,
    };
    const submitted = await provider.generateTextToVideo(req, ctx);

    logger.info('[editor-broll] text-to-video submitted', {
      file: FILE,
      generationId: submitted.generationId,
      aspectRatio,
      durationSeconds,
    });

    // 4. Poll fal to completion → temporary CDN URL of the real clip.
    const falVideoUrl = await pollToCompletion(submitted.generationId, ctx);

    // 5. Persist the real clip to OUR Firebase Storage (permanent download-token
    //    URL). The clip URL we return never points at fal's temporary CDN.
    const storagePath = `organizations/${PLATFORM_ID}/media/videos/${randomUUID()}.mp4`;
    const permanentUrl = await persistUrlToStorage(falVideoUrl, storagePath, 'video/mp4');

    logger.info('[editor-broll] clip generated + persisted', {
      file: FILE,
      url: permanentUrl,
      durationSeconds,
    });

    // 6. Respond with the real clip URL + its duration.
    return NextResponse.json({
      success: true,
      url: permanentUrl,
      durationSeconds,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'B-roll video generation failed';
    logger.error(
      '[editor-broll] generation failed',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );

    // Surface missing-key / config errors as 400 so the UI can tell the operator
    // to add the fal key, instead of a generic 500.
    const isConfigError =
      message.includes('not configured') ||
      message.includes('no fal API key') ||
      message.includes('API key is invalid') ||
      message.includes('credentials');
    return NextResponse.json(
      { success: false, error: message },
      { status: isConfigError ? 400 : 500 },
    );
  }
}
