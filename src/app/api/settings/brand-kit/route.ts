/**
 * Brand Kit API Route
 * GET  /api/settings/brand-kit — returns current brand kit
 * PUT  /api/settings/brand-kit — updates brand kit
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/api-auth';
import { getBrandKit, saveBrandKit } from '@/lib/video/brand-kit-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/settings/brand-kit/route.ts';

// ── Helpers ─────────────────────────────────────────────────────────────────

/** Converts empty strings to null for optional URL fields */
function emptyToNull(v: string | null | undefined): string | null {
  if (!v) { return null; }
  return v;
}

// ── Zod Schemas ─────────────────────────────────────────────────────────────

const LogoSchema = z.object({
  url: z.string().url(),
  position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
  opacity: z.number().min(0).max(1),
  scale: z.number().min(0.05).max(0.25),
});

const ColorsSchema = z.object({
  primary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  secondary: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
  accent: z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color'),
});

const TypographySchema = z.object({
  fontFamily: z.enum([
    'Inter', 'Roboto', 'Open Sans', 'Montserrat', 'Poppins',
    'Lato', 'Oswald', 'Raleway', 'Playfair Display', 'Source Code Pro',
  ]),
  captionColor: z.string(),
  captionBackground: z.string(),
});

const IntroOutroSchema = z.object({
  introTemplate: z.enum(['fade-logo', 'slide-up', 'zoom-pulse', 'minimal-text', 'custom']).nullable(),
  introCustomUrl: z.string().url().or(z.literal('')).nullable().transform(emptyToNull),
  introDuration: z.number().min(2).max(10),
  outroTemplate: z.enum(['fade-logo', 'slide-up', 'zoom-pulse', 'minimal-text', 'custom']).nullable(),
  outroCustomUrl: z.string().url().or(z.literal('')).nullable().transform(emptyToNull),
  outroDuration: z.number().min(2).max(10),
  outroCta: z.string().max(200),
});

const BrandKitSchema = z.object({
  enabled: z.boolean(),
  logo: LogoSchema.nullable(),
  colors: ColorsSchema,
  typography: TypographySchema,
  introOutro: IntroOutroSchema,
});

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const brandKit = await getBrandKit();
    return NextResponse.json({ success: true, brandKit });
  } catch (error) {
    logger.error(
      'Failed to fetch brand kit',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { error: 'Failed to fetch brand kit' },
      { status: 500 },
    );
  }
}

// ── PUT ─────────────────────────────────────────────────────────────────────

export async function PUT(request: NextRequest): Promise<NextResponse> {
  try {
    const permResult = await requirePermission(request, 'canManageTheme');
    if (permResult instanceof NextResponse) {
      return permResult;
    }

    const body: unknown = await request.json();
    const parsed = BrandKitSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid brand kit data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const saved = await saveBrandKit(parsed.data, permResult.user.uid);
    return NextResponse.json({ success: true, brandKit: saved });
  } catch (error) {
    logger.error(
      'Failed to save brand kit',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { error: 'Failed to save brand kit' },
      { status: 500 },
    );
  }
}
