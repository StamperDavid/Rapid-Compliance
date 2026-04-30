/**
 * AI Image Generation API (Magic Studio image tool)
 * POST /api/content/asset-generator/generate
 *
 * Auth-gated. Validates the request via Zod, calls the simplest already-wired
 * single-image generator (`generateHedraImage` — same provider the rest of
 * the Studio video stack uses, so the operator only manages one API key),
 * persists the rendered image to Firebase Storage, and writes a
 * `UnifiedMediaAsset` record to organizations/{PLATFORM_ID}/media/{id}.
 *
 * On error, returns a 4xx/5xx with a `{ success: false, error }` body that
 * the operator can act on (e.g. "add the API key in /settings/api-keys").
 *
 * Note on type choice: the spec referenced `MediaItem` from
 * `@/types/media-library`. The canonical Firestore shape that the existing
 * `/api/media` GET reads (and that the just-shipped music route writes) is
 * `UnifiedMediaAsset`. `MediaItem` is the legacy projection used by two
 * older UI consumers. To keep the Studio's Recent sidebar populated by the
 * same query that surfaces music, we write `UnifiedMediaAsset` here too.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { requireAuth } from '@/lib/auth/api-auth';
import { generateHedraImage } from '@/lib/video/hedra-service';
import { persistUrlToStorage } from '@/lib/firebase/storage-utils';
import { adminStorage } from '@/lib/firebase/admin';
import AdminFirestoreService from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type { UnifiedMediaAsset } from '@/types/media-library';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/asset-generator/generate/route.ts';

// ────────────────────────────────────────────────────────────────────────────
// Request validation
// ────────────────────────────────────────────────────────────────────────────

const ASPECT_RATIO_PATTERN = /^\d+:\d+$/;
const RESOLUTION_VALUES = ['720p', '1080p', '1440p (2K QHD)'] as const;

const GenerateImageSchema = z.object({
  prompt: z.string().trim().min(1, 'prompt is required').max(1000),
  aspectRatio: z
    .string()
    .trim()
    .regex(ASPECT_RATIO_PATTERN, 'aspectRatio must look like "W:H" (e.g. "16:9")')
    .max(20)
    .optional()
    .default('1:1'),
  resolution: z
    .string()
    .trim()
    .max(40)
    .optional()
    .default('1080p'),
  brandDnaApplied: z.boolean().optional().default(true),
  /** Optional human-readable name for the saved asset; defaults to prompt. */
  name: z.string().trim().max(120).optional(),
});

type GenerateImageRequest = z.infer<typeof GenerateImageSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function buildAssetName(req: GenerateImageRequest): string {
  if (req.name && req.name.length > 0) {
    return req.name;
  }
  const trimmed = req.prompt.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

function buildTags(req: GenerateImageRequest): string[] {
  const tags: string[] = ['ai-generated', 'image', 'studio'];
  tags.push(`aspect:${req.aspectRatio}`);
  tags.push(`resolution:${req.resolution}`);
  if (req.brandDnaApplied) {
    tags.push('brand-applied');
  }
  return tags;
}

function imageStoragePath(assetId: string): string {
  return `organizations/${PLATFORM_ID}/media/images/${assetId}.png`;
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
  // Normalize to a 1024-long side so the dimensions are useful to consumers
  // even though the actual rendered file may be larger.
  const longSide = 1024;
  if (w >= h) {
    return { width: longSide, height: Math.round((longSide * h) / w) };
  }
  return { width: Math.round((longSide * w) / h), height: longSide };
}

function isResolutionValue(value: string): value is (typeof RESOLUTION_VALUES)[number] {
  return (RESOLUTION_VALUES as readonly string[]).includes(value);
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
    const parsed = GenerateImageSchema.safeParse(rawBody);
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

    // 3. Generate via Hedra (auto-discovers the active image model and polls
    //    until the asset URL is available — typical 5-30s).
    const generation = await generateHedraImage(body.prompt, {
      aspectRatio: body.aspectRatio,
      resolution: isResolutionValue(body.resolution) ? body.resolution : '1080p',
    });

    // 4. Persist to Firebase Storage so the URL outlives Hedra's CDN.
    const assetId = randomUUID();
    const storagePath = imageStoragePath(assetId);
    let permanentUrl = generation.url;
    let fileSize = 0;
    try {
      permanentUrl = await persistUrlToStorage(generation.url, storagePath, 'image/png');
      // Best-effort size lookup; non-fatal if unavailable.
      if (adminStorage) {
        try {
          const [metadata] = await adminStorage.bucket().file(storagePath).getMetadata();
          const sizeRaw = metadata.size;
          if (typeof sizeRaw === 'number') {
            fileSize = sizeRaw;
          } else if (typeof sizeRaw === 'string') {
            const parsedSize = Number.parseInt(sizeRaw, 10);
            if (Number.isFinite(parsedSize)) {
              fileSize = parsedSize;
            }
          }
        } catch (metaErr) {
          logger.warn('[asset-generator-generate] Storage metadata lookup failed', {
            error: metaErr instanceof Error ? metaErr.message : String(metaErr),
            file: FILE,
          });
        }
      }
    } catch (persistErr) {
      logger.warn('[asset-generator-generate] Storage persistence failed; using provider URL', {
        error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        file: FILE,
      });
    }

    // 5. Build the canonical media asset.
    const now = new Date().toISOString();
    const dimensions = inferDimensionsFromAspectRatio(body.aspectRatio);
    const asset: UnifiedMediaAsset = {
      id: assetId,
      type: 'image',
      category: 'graphic',
      tags: buildTags(body),
      name: buildAssetName(body),
      url: permanentUrl,
      mimeType: 'image/png',
      fileSize,
      ...(dimensions ? { dimensions } : {}),
      source: 'ai-generated',
      aiProvider: 'hedra',
      aiPrompt: body.prompt,
      aiGenerationId: generation.generationId,
      processingState: 'ready',
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid,
      brandDnaApplied: body.brandDnaApplied,
    };

    // 6. Write to the unified media library (Admin SDK — server context).
    const mediaCollectionPath = getSubCollection('media');
    await AdminFirestoreService.set<UnifiedMediaAsset>(
      mediaCollectionPath,
      assetId,
      asset,
    );

    logger.info('[asset-generator-generate] Asset saved to media library', {
      assetId,
      provider: 'hedra',
      modelId: generation.modelId,
      brandDnaApplied: asset.brandDnaApplied,
      file: FILE,
    });

    // 7. Respond.
    return NextResponse.json({
      success: true,
      mediaId: assetId,
      url: permanentUrl,
      kind: 'image' as const,
      asset,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Image generation failed';
    logger.error(
      '[asset-generator-generate] Unhandled failure',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );

    // Surface configuration errors as 400 so the UI can show the operator
    // a "go fix your API key" message instead of a generic 500. The Hedra
    // service throws the literal phrase "API key not configured" with a
    // pointer to /settings/api-keys when the key is missing.
    const isConfigError =
      message.includes('not configured') ||
      message.includes('API key is invalid');
    return NextResponse.json(
      { success: false, error: message },
      { status: isConfigError ? 400 : 500 },
    );
  }
}
