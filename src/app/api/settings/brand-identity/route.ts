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
import { syncBrandIdentityToLegacyStores } from '@/lib/brand/brand-identity-bridges';
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
  id: z.string(),
  url: z.string().min(1),
  fileName: z.string(),
  contentType: z.string(),
  kind: z.enum(['image', 'video', 'document', 'other']),
  description: z.string(),
  purpose: z.string(),
  uploadedAt: z.string(),
  aiSummary: z.string().optional(),
});

// Keys map 1:1 to the live theme doc (ThemeConfig in src/hooks/useOrgTheme.ts).
const DashboardThemeSchema = z.object({
  favicon: z.string(),
  showPoweredBy: z.boolean(),
  borderRadius: z.object({
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
    full: z.string(),
    card: z.string(),
    button: z.string(),
    input: z.string(),
  }),
  spacing: z.object({
    xs: z.string(),
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
  }),
  shadow: z.object({
    sm: z.string(),
    md: z.string(),
    lg: z.string(),
    xl: z.string(),
    glow: z.string(),
  }),
  fontSize: z.object({
    xs: z.string(),
    sm: z.string(),
    base: z.string(),
    lg: z.string(),
    xl: z.string(),
    '2xl': z.string(),
    '3xl': z.string(),
  }),
  fontWeight: z.object({
    light: z.number(),
    normal: z.number(),
    medium: z.number(),
    semibold: z.number(),
    bold: z.number(),
  }),
  monoFont: z.string(),
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
  dashboardTheme: DashboardThemeSchema,
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

    // Fan the saved identity out to the three legacy stores the rest of the app
    // already reads, so the operator only edits THIS page:
    //   1. voice    → org `brandDNA` (the source the Golden-Master bake reads)
    //   2. brandKit → `settings/brand-kit` (read by the video pipeline)
    //   3. theme    → `platform_settings/theme` (read by `useOrgTheme` → CSS vars)
    // We pass the SAVED `brandIdentity` so every field (incl. the logo bridge
    // fallback) is present. We do NOT trigger the agent re-bake here — publishing
    // to agents stays a deliberate, operator-pressed button. The sync never throws
    // and a partial failure must not fail the save (the identity doc is already
    // persisted), so we log the per-store result and continue.
    try {
      const syncResult = await syncBrandIdentityToLegacyStores(
        brandIdentity,
        permResult.user.uid,
      );
      logger.info('Brand identity synced to legacy stores', {
        ...syncResult,
        file: FILE,
      });
    } catch (syncError) {
      logger.error(
        'Saved brand identity but failed to sync to legacy stores',
        syncError instanceof Error ? syncError : new Error(String(syncError)),
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
