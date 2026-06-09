/**
 * Deterministic brand OUTRO render API.
 * POST /api/video/brand-outro
 *
 * Auth-gated. Renders the closing "Brand Close / CTA / outro" storyboard scene as
 * a clean, pixel-accurate branded card — solid brand-colored background + the REAL
 * logo centered + the official tagline below it — with NO AI generation. This is
 * the reliable path for the brand-close scene; the normal storyboard-thumbnail flow
 * strips all branding language from the image prompt (to stop fake-logo paints),
 * which leaves the outro scene with no brand mark, so the model invents a text card.
 *
 * Tagline source: Brand DNA (the source agents bake from — `keyPhrases` carries the
 * official "Accelerate your growth"), then the canonical Brand Identity tagline,
 * then a hardcoded fallback. Logo + colors: the brand kit (which already resolves
 * the REAL logo via the website-editor → static `/logo.png` fallback chain).
 *
 * Persists the rendered PNG to Firebase Storage and returns `{ success, url }` so
 * the storyboard builder can set it as the scene preview.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { randomUUID } from 'crypto';

import { requireAuth } from '@/lib/auth/api-auth';
import { renderBrandOutro } from '@/lib/video/brand-outro';
import { getBrandKit } from '@/lib/video/brand-kit-service';
import { getBrandIdentity } from '@/lib/brand/brand-identity-service';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { DEFAULT_BRAND_KIT } from '@/types/brand-kit';
import { persistBufferToStorage } from '@/lib/firebase/storage-utils';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/video/brand-outro/route.ts';

const ASPECT_RATIO_PATTERN = /^\d+:\d+$/;
const DEFAULT_TAGLINE = 'Accelerate your growth';

const BrandOutroSchema = z.object({
  aspectRatio: z
    .string()
    .trim()
    .regex(ASPECT_RATIO_PATTERN, 'aspectRatio must look like "W:H" (e.g. "16:9")')
    .max(20)
    .optional()
    .default('16:9'),
  /** Optional human-readable name for logging / future asset persistence. */
  name: z.string().trim().max(120).optional(),
});

/** Resolve the outro frame dimensions from an aspect ratio (1024-long side). */
function dimensionsFromAspectRatio(aspect: string): { width: number; height: number } {
  const [w, h] = aspect.split(':').map(Number);
  if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
    return { width: 1024, height: 576 };
  }
  const longSide = 1024;
  return w >= h
    ? { width: longSide, height: Math.round((longSide * h) / w) }
    : { width: Math.round((longSide * w) / h), height: longSide };
}

/**
 * The official tagline, from the source agents bake from. Brand DNA `keyPhrases`
 * carries it (set by `set-brand-tagline`); fall back to the canonical Brand
 * Identity tagline, then the hardcoded official tagline.
 */
async function resolveTagline(): Promise<string> {
  try {
    const dna = await getBrandDNA();
    const phrases = Array.isArray(dna?.keyPhrases) ? dna.keyPhrases : [];
    const match = phrases.find((p) => p.trim().toLowerCase() === DEFAULT_TAGLINE.toLowerCase());
    if (match) {
      return match.trim();
    }
  } catch (err) {
    logger.warn('[brand-outro] Brand DNA tagline lookup failed; trying brand identity', {
      error: err instanceof Error ? err.message : String(err),
      file: FILE,
    });
  }
  try {
    const identity = await getBrandIdentity();
    if (identity.tagline && identity.tagline.trim().length > 0) {
      return identity.tagline.trim();
    }
  } catch {
    // fall through to the hardcoded official tagline
  }
  return DEFAULT_TAGLINE;
}

/** A dark, brand-colored background hex for the outro card. */
async function resolveBackgroundColor(): Promise<string> {
  // The canonical brand identity carries a real `background` color; prefer it.
  try {
    const identity = await getBrandIdentity();
    const bg = identity.colors?.background;
    if (typeof bg === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(bg.trim())) {
      return bg.trim();
    }
  } catch {
    // fall through
  }
  return '#000000';
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const rawBody: unknown = await request.json().catch(() => ({}));
    const parsed = BrandOutroSchema.safeParse(rawBody);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.errors[0]?.message ?? 'Invalid request body' },
        { status: 400 },
      );
    }
    const body = parsed.data;

    // Resolve the deterministic branded inputs.
    const [tagline, bgColor, brandKit] = await Promise.all([
      resolveTagline(),
      resolveBackgroundColor(),
      getBrandKit(),
    ]);

    // The brand kit resolves the REAL logo (website-editor → static /logo.png fallback).
    const logoUrl =
      brandKit.logo?.url && brandKit.logo.url.length > 0 ? brandKit.logo.url : '/logo.png';

    // Accent for the tagline — the brand's accent color if it isn't the placeholder palette.
    const accent =
      brandKit.colors &&
      brandKit.colors.accent !== DEFAULT_BRAND_KIT.colors.accent
        ? brandKit.colors.accent
        : '#FFFFFF';

    const { width, height } = dimensionsFromAspectRatio(body.aspectRatio);

    const outroBuffer = await renderBrandOutro({
      tagline,
      logoUrl,
      bgColor,
      accentColor: accent,
      width,
      height,
    });

    // Persist to Storage so the URL outlives the request.
    const assetId = randomUUID();
    const storagePath = `organizations/${PLATFORM_ID}/media/images/${assetId}.png`;
    const url = await persistBufferToStorage(outroBuffer, storagePath, 'image/png');
    if (!url) {
      return NextResponse.json(
        { success: false, error: 'Failed to persist the brand outro image' },
        { status: 500 },
      );
    }

    logger.info('[brand-outro] Rendered deterministic brand outro', {
      assetId,
      tagline,
      logoUrl,
      file: FILE,
    });

    return NextResponse.json({ success: true, url });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Brand outro render failed';
    logger.error(
      '[brand-outro] Unhandled failure',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
