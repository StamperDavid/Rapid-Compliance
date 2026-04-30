/**
 * AI Music Generation API (Unified Media Library)
 * POST /api/content/music/generate
 *
 * Auth-gated. Validates the request via Zod, calls the music generation
 * service (MusicGen via Replicate — see music-generation-service.ts for
 * provider rationale), persists the rendered audio to Firebase Storage,
 * and writes a `UnifiedMediaAsset` record to the canonical media library
 * collection at organizations/{PLATFORM_ID}/media/{id}.
 *
 * On error, returns a 4xx/5xx with a `{ success: false, error }` body that
 * the operator can act on (e.g. "add the API key in /settings/api-keys").
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { requireAuth } from '@/lib/auth/api-auth';
import {
  generateMusic,
  type BrandDNAContext,
} from '@/lib/music/music-generation-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { persistUrlToStorage } from '@/lib/firebase/storage-utils';
import { adminStorage } from '@/lib/firebase/admin';
import AdminFirestoreService from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type { UnifiedMediaAsset } from '@/types/media-library';

export const dynamic = 'force-dynamic';

const FILE = 'api/content/music/generate/route.ts';

// ────────────────────────────────────────────────────────────────────────────
// Request validation
// ────────────────────────────────────────────────────────────────────────────

const GenerateMusicSchema = z.object({
  prompt: z.string().trim().min(1, 'prompt is required').max(1000),
  genre: z.string().trim().max(60).optional(),
  mood: z.string().trim().max(60).optional(),
  durationSeconds: z.number().int().positive().max(30).optional(),
  /** When true, the route fetches the org's Brand DNA snapshot and folds
   *  it into the prompt. Defaults to true to match the standing rule that
   *  every content engine agent operates with brand context. */
  applyBrandDna: z.boolean().optional().default(true),
  /** Optional human-readable name for the saved asset; defaults to prompt. */
  name: z.string().trim().max(120).optional(),
});

type GenerateMusicRequest = z.infer<typeof GenerateMusicSchema>;

// ────────────────────────────────────────────────────────────────────────────
// Helpers
// ────────────────────────────────────────────────────────────────────────────

function buildAssetName(req: GenerateMusicRequest): string {
  if (req.name && req.name.length > 0) {
    return req.name;
  }
  const trimmed = req.prompt.trim();
  return trimmed.length > 80 ? `${trimmed.slice(0, 77)}...` : trimmed;
}

function buildTags(req: GenerateMusicRequest, brandApplied: boolean): string[] {
  const tags: string[] = [];
  if (req.genre) {
    tags.push(`genre:${req.genre.toLowerCase()}`);
  }
  if (req.mood) {
    tags.push(`mood:${req.mood.toLowerCase()}`);
  }
  if (brandApplied) {
    tags.push('brand-applied');
  }
  tags.push('ai-generated', 'music');
  return tags;
}

function musicTrackStoragePath(assetId: string): string {
  return `organizations/${PLATFORM_ID}/media/music/${assetId}.mp3`;
}

async function loadBrandContext(): Promise<BrandDNAContext | null> {
  try {
    const dna = await getBrandDNA();
    if (!dna) {
      return null;
    }
    return {
      companyDescription: dna.companyDescription,
      toneOfVoice: dna.toneOfVoice,
      communicationStyle: dna.communicationStyle,
      industry: dna.industry,
    };
  } catch (error) {
    logger.warn('[music-generate] Brand DNA load failed; generating without it', {
      error: error instanceof Error ? error.message : String(error),
      file: FILE,
    });
    return null;
  }
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
    const parsed = GenerateMusicSchema.safeParse(rawBody);
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

    // 3. Optionally pull Brand DNA
    const brandDna = body.applyBrandDna ? await loadBrandContext() : null;

    // 4. Generate
    const generation = await generateMusic({
      prompt: body.prompt,
      genre: body.genre,
      mood: body.mood,
      durationSeconds: body.durationSeconds,
      brandDna: brandDna ?? undefined,
    });

    // 5. Persist to Firebase Storage so the URL outlives Replicate's CDN
    const assetId = randomUUID();
    const storagePath = musicTrackStoragePath(assetId);
    let permanentUrl = generation.url;
    let fileSize = 0;
    try {
      permanentUrl = await persistUrlToStorage(generation.url, storagePath, 'audio/mpeg');
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
          logger.warn('[music-generate] Storage metadata lookup failed', {
            error: metaErr instanceof Error ? metaErr.message : String(metaErr),
            file: FILE,
          });
        }
      }
    } catch (persistErr) {
      logger.warn('[music-generate] Storage persistence failed; using provider URL', {
        error: persistErr instanceof Error ? persistErr.message : String(persistErr),
        file: FILE,
      });
    }

    // 6. Build the canonical media asset
    const now = new Date().toISOString();
    const asset: UnifiedMediaAsset = {
      id: assetId,
      type: 'audio',
      category: 'music-track',
      tags: buildTags(body, brandDna != null),
      name: buildAssetName(body),
      url: permanentUrl,
      mimeType: 'audio/mpeg',
      fileSize,
      duration: generation.duration,
      source: 'ai-generated',
      aiProvider: generation.provider,
      aiPrompt: body.prompt,
      createdAt: now,
      updatedAt: now,
      createdBy: user.uid,
      brandDnaApplied: brandDna != null,
    };

    // 7. Write to the unified media library (Admin SDK — server context)
    const mediaCollectionPath = getSubCollection('media');
    await AdminFirestoreService.set<UnifiedMediaAsset>(
      mediaCollectionPath,
      assetId,
      asset,
    );

    logger.info('[music-generate] Asset saved to media library', {
      assetId,
      provider: generation.provider,
      duration: generation.duration,
      brandDnaApplied: asset.brandDnaApplied,
      file: FILE,
    });

    // 8. Respond
    return NextResponse.json({
      success: true,
      asset,
      providerMetadata: generation.metadata,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Music generation failed';
    logger.error(
      '[music-generate] Unhandled failure',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );

    // Surface configuration errors as 400 so the UI can show the operator
    // a "go fix your API key" message instead of a generic 500.
    const isConfigError =
      message.includes('not configured') ||
      message.includes('API key is invalid');
    return NextResponse.json(
      { success: false, error: message },
      { status: isConfigError ? 400 : 500 },
    );
  }
}
