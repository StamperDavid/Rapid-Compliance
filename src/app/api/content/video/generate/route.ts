/**
 * AI Video Generation API (Magic Studio video tool)
 * POST /api/content/video/generate
 *
 * Auth-gated. Validates the request via Zod, kicks off the appropriate
 * Hedra video generation (prompt-only via Kling O3, or talking-head avatar
 * via Character 3), writes a placeholder `UnifiedMediaAsset` doc with
 * `processingState: 'pending'` so the Studio's Recent sidebar can render
 * a "rendering" tile immediately, and returns the provider's generationId.
 *
 * IMPORTANT: this route DOES NOT poll. Hedra video generation is async by
 * design — generations take 30-60+ seconds. The Studio UI is responsible
 * for polling `/api/video/poll-scenes` (or the per-generation status route)
 * to flip `processingState` to `ready` and attach the final URL.
 *
 * Note on type choice: same as the asset-generator route — we write
 * `UnifiedMediaAsset` (the canonical shape that `/api/media` GET returns)
 * rather than the legacy `MediaItem` projection, so the placeholder shows
 * up in the Recent sidebar through the same path as image and music
 * assets.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { requireAuth } from '@/lib/auth/api-auth';
import {
  generateHedraPromptVideo,
  generateHedraAvatarVideo,
  type HedraGenerationResult,
} from '@/lib/video/hedra-service';
import AdminFirestoreService from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';
import type { UnifiedMediaAsset } from '@/types/media-library';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/video/generate/route.ts';

// ────────────────────────────────────────────────────────────────────────────
// Request validation
// ────────────────────────────────────────────────────────────────────────────

const ASPECT_RATIO_PATTERN = /^\d+:\d+$/;

const VideoGenerateSchema = z
  .object({
    mode: z.enum(['prompt', 'avatar']),
    prompt: z.string().trim().min(1, 'prompt is required').max(1000),
    aspectRatio: z
      .string()
      .trim()
      .regex(ASPECT_RATIO_PATTERN, 'aspectRatio must look like "W:H" (e.g. "16:9")')
      .max(20)
      .optional()
      .default('16:9'),
    durationMs: z.number().int().min(3000).max(15000).optional().default(5000),
    portraitUrl: z.string().url().optional(),
    hedraVoiceId: z.string().trim().min(1).max(120).optional(),
    speechText: z.string().trim().min(1).max(2000).optional(),
    brandDnaApplied: z.boolean().optional().default(true),
    name: z.string().trim().max(120).optional(),
  })
  .superRefine((value, ctx) => {
    if (value.mode === 'avatar' && (!value.portraitUrl || value.portraitUrl.length === 0)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['portraitUrl'],
        message: 'portraitUrl is required when mode is "avatar"',
      });
    }
    if (value.hedraVoiceId && !value.speechText) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['speechText'],
        message: 'speechText is required when hedraVoiceId is set',
      });
    }
  });

type VideoGenerateRequest = z.infer<typeof VideoGenerateSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function buildAssetName(req: VideoGenerateRequest): string {
  if (req.name && req.name.length > 0) {
    return req.name;
  }
  const trimmed = req.prompt.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

function buildTags(req: VideoGenerateRequest): string[] {
  const tags: string[] = ['ai-generated', 'video', 'studio', `mode:${req.mode}`];
  tags.push(`aspect:${req.aspectRatio}`);
  tags.push(`duration-ms:${req.durationMs}`);
  if (req.brandDnaApplied) {
    tags.push('brand-applied');
  }
  return tags;
}

function inferDimensionsFromAspectRatio(aspect: string): { width: number; height: number } | null {
  const match = ASPECT_RATIO_PATTERN.exec(aspect);
  if (!match) {
    return null;
  }
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return null;
  }
  // Hedra's default video resolution is 720p — long side = 1280.
  const longSide = 1280;
  if (w >= h) {
    return { width: longSide, height: Math.round((longSide * h) / w) };
  }
  return { width: Math.round((longSide * w) / h), height: longSide };
}

async function dispatchHedra(
  body: VideoGenerateRequest,
): Promise<HedraGenerationResult> {
  if (body.mode === 'prompt') {
    return generateHedraPromptVideo({
      textPrompt: body.prompt,
      aspectRatio: body.aspectRatio,
      durationMs: body.durationMs,
      ...(body.hedraVoiceId ? { hedraVoiceId: body.hedraVoiceId } : {}),
      ...(body.speechText ? { speechText: body.speechText } : {}),
    });
  }
  // mode === 'avatar' — superRefine guarantees portraitUrl is present.
  if (!body.portraitUrl) {
    throw new Error('portraitUrl missing for avatar mode (validation gap)');
  }
  return generateHedraAvatarVideo(body.portraitUrl, null, {
    textPrompt: body.prompt,
    aspectRatio: body.aspectRatio,
    durationMs: body.durationMs,
    ...(body.hedraVoiceId ? { hedraVoiceId: body.hedraVoiceId } : {}),
    ...(body.speechText ? { speechText: body.speechText } : {}),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// Route handler
// ────────────────────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    // 1. Auth
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }
    const { user } = authResult;

    // 2. Validate body
    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = VideoGenerateSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: parsed.error.errors[0]?.message ?? 'Invalid request body',
          details: parsed.error.errors.map((e) => ({
            path: e.path.join('.'),
            message: e.message,
          })),
        },
        { status: 400 },
      );
    }
    const body = parsed.data;

    // 3. Submit to Hedra (returns immediately with a generationId — does NOT
    //    poll; the Studio polls the status endpoint separately).
    const generation = await dispatchHedra(body);

    // 4. Build the placeholder media asset.
    const assetId = randomUUID();
    const now = new Date().toISOString();
    const dimensions = inferDimensionsFromAspectRatio(body.aspectRatio);
    const asset: UnifiedMediaAsset = {
      id: assetId,
      type: 'video',
      category: 'video-clip',
      tags: buildTags(body),
      name: buildAssetName(body),
      // No url yet — Hedra is still rendering. The poll endpoint will patch
      // this in once status flips to complete.
      url: '',
      mimeType: 'video/mp4',
      fileSize: 0,
      duration: body.durationMs / 1000,
      ...(dimensions ? { dimensions } : {}),
      source: 'ai-generated',
      aiProvider: 'hedra',
      aiPrompt: body.prompt,
      aiGenerationId: generation.generationId,
      processingState: 'pending',
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid,
      brandDnaApplied: body.brandDnaApplied,
    };

    // 5. Write the placeholder doc.
    const mediaCollectionPath = getSubCollection('media');
    await AdminFirestoreService.set<UnifiedMediaAsset>(
      mediaCollectionPath,
      assetId,
      asset,
    );

    logger.info('[video-generate] Placeholder asset saved (pending render)', {
      assetId,
      mode: body.mode,
      generationId: generation.generationId,
      modelId: generation.modelId,
      brandDnaApplied: asset.brandDnaApplied,
      file: FILE,
    });

    // 6. Respond. The UI now polls `/api/video/poll-scenes` (or a future
    //    per-generation status route) using `providerVideoId` to flip
    //    processingState from "pending" → "ready" once Hedra finishes.
    return NextResponse.json({
      success: true,
      mediaId: assetId,
      providerVideoId: generation.generationId,
      kind: 'video' as const,
      processingState: 'pending' as const,
      asset,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Video generation failed';
    logger.error(
      '[video-generate] Unhandled failure',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );

    // Surface configuration errors as 400 so the UI can show the operator
    // a "go fix your API key" message. Hedra throws "API key not configured"
    // referencing /settings/api-keys when the key is missing.
    const isConfigError =
      message.includes('not configured') ||
      message.includes('API key is invalid');
    return NextResponse.json(
      { success: false, error: message },
      { status: isConfigError ? 400 : 500 },
    );
  }
}
