/**
 * Brand Identity API Route
 * GET  /api/settings/brand-identity — returns the canonical unified brand identity
 * PUT  /api/settings/brand-identity — updates the canonical unified brand identity
 *
 * Mirrors the auth gate + Zod-validation pattern of `api/settings/brand-kit/route.ts`.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth, requirePermission } from '@/lib/auth/api-auth';
import { getBrandIdentity, saveBrandIdentity } from '@/lib/brand/brand-identity-service';
import { updateBrandDNA } from '@/lib/brand/brand-dna-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

const FILE = 'api/settings/brand-identity/route.ts';

// ── Zod Schemas ─────────────────────────────────────────────────────────────

const HexColor = z.string().regex(/^#[0-9A-Fa-f]{6}$/, 'Invalid hex color');

const VoiceSchema = z.object({
  companyDescription: z.string(),
  uniqueValue: z.string(),
  targetAudience: z.string(),
  toneOfVoice: z.string(),
  communicationStyle: z.string(),
  keyPhrases: z.array(z.string()),
  avoidPhrases: z.array(z.string()),
  industry: z.string(),
  competitors: z.array(z.string()),
});

const LogoSchema = z.object({
  // Absolute http(s) URL (uploaded logo) OR a root-relative static path like
  // '/logo.png' (the bridge fallback getBrandIdentity returns when none is uploaded).
  // z.string().url() would reject the static path and 400 every save until a logo is uploaded.
  url: z.string().min(1).refine(
    (u) => /^https?:\/\//i.test(u) || (u.startsWith('/') && !u.startsWith('//')),
    'logo url must be an absolute http(s) URL or a /static path',
  ),
  position: z.enum(['top-left', 'top-right', 'bottom-left', 'bottom-right']),
  opacity: z.number().min(0).max(1),
  scale: z.number().min(0.05).max(0.25),
});

const ColorsSchema = z.object({
  primary: HexColor,
  secondary: HexColor,
  accent: HexColor,
  background: HexColor,
  surface: HexColor,
  text: HexColor,
  textMuted: HexColor,
  border: HexColor,
  success: HexColor,
  warning: HexColor,
  error: HexColor,
});

const FontsSchema = z.object({
  heading: z.string(),
  body: z.string(),
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
  introCustomUrl: z.string().nullable(),
  introDuration: z.number().min(2).max(10),
  outroTemplate: z.enum(['fade-logo', 'slide-up', 'zoom-pulse', 'minimal-text', 'custom']).nullable(),
  outroCustomUrl: z.string().nullable(),
  outroDuration: z.number().min(2).max(10),
  outroCta: z.string().max(200),
});

const ExampleAssetSchema = z.object({
  type: z.enum(['social-post', 'ad', 'image']),
  mediaId: z.string().optional(),
  url: z.string().optional(),
  note: z.string().optional(),
});

const BrandIdentitySchema = z.object({
  voice: VoiceSchema,
  companyName: z.string(),
  tagline: z.string(),
  logo: LogoSchema.nullable(),
  colors: ColorsSchema,
  fonts: FontsSchema,
  typography: TypographySchema,
  introOutro: IntroOutroSchema,
  exampleAssets: z.array(ExampleAssetSchema),
});

// ── GET ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const brandIdentity = await getBrandIdentity();
    return NextResponse.json({ success: true, brandIdentity });
  } catch (error) {
    logger.error(
      'Failed to fetch brand identity',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { error: 'Failed to fetch brand identity' },
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
    const parsed = BrandIdentitySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid brand identity data', details: parsed.error.flatten() },
        { status: 400 },
      );
    }

    const brandIdentity = await saveBrandIdentity(parsed.data, permResult.user.uid);

    // Write the saved voice back to the org's `brandDNA` field — the source the
    // Golden-Master bake reads. Without this, the Brand page would edit the
    // canonical identity doc but the "Publish to Agents" re-bake (which reads
    // `getBrandDNA()`) would keep baking the STALE voice. This is the bridge that
    // makes the page the real source of truth. We do NOT trigger the re-bake here —
    // publishing to agents is a deliberate, operator-pressed button (so a 67-agent
    // update never fires by surprise). Failure to mirror must not fail the save
    // itself (the identity doc is already persisted), so it's isolated here.
    try {
      await updateBrandDNA(parsed.data.voice, permResult.user.uid);
    } catch (mirrorError) {
      logger.error(
        'Saved brand identity but failed to mirror voice into org brandDNA',
        mirrorError instanceof Error ? mirrorError : new Error(String(mirrorError)),
        { file: FILE },
      );
    }

    return NextResponse.json({ success: true, brandIdentity });
  } catch (error) {
    logger.error(
      'Failed to save brand identity',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
    return NextResponse.json(
      { error: 'Failed to save brand identity' },
      { status: 500 },
    );
  }
}
