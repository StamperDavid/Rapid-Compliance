/**
 * Brand Identity Bridges
 *
 * The canonical Brand Identity page (`/settings/brand`) is the single source of
 * truth the operator edits. This module fans a saved `BrandIdentity` out to the
 * three legacy stores the rest of the app already reads, so the operator only
 * ever edits ONE page:
 *
 *   1. VOICE     → org `brandDNA` field        (read by `getBrandDNA()` at GM bake)
 *   2. BRAND KIT → `settings/brand-kit` doc    (read by `getBrandKit()` for video)
 *   3. THEME     → `platform_settings/theme`   (read by `useOrgTheme` → CSS vars)
 *
 * This module ONLY writes — it never re-points or modifies the readers. The
 * agent re-bake stays a deliberate operator button and is NOT triggered here.
 *
 * The transforms are exported pure functions so they can be unit-tested in
 * isolation; `syncBrandIdentityToLegacyStores` is the orchestrator the PUT route
 * calls.
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';
import { updateBrandDNA } from '@/lib/brand/brand-dna-service';
import { getBrandKit, saveBrandKit } from '@/lib/video/brand-kit-service';
import type { BrandIdentity, BrandExampleAsset } from '@/types/brand-identity';
import type { BrandKit } from '@/types/brand-kit';

const FILE = 'brand-identity-bridges.ts';

// ============================================================================
// Color helpers (ported from settings/theme/page.tsx — pure)
// ============================================================================

/**
 * Lighten (positive percent) or darken (negative percent) a #RRGGBB hex color.
 * Ported verbatim from `settings/theme/page.tsx` so the theme overlay produces
 * the SAME light/dark shades the theme editor would.
 */
export function adjustColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const amt = Math.round(2.55 * percent);
  const R = (num >> 16) + amt;
  const G = ((num >> 8) & 0x00ff) + amt;
  const B = (num & 0x0000ff) + amt;
  return `#${(
    0x1000000 +
    (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
    (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
    (B < 255 ? (B < 1 ? 0 : B) : 255)
  )
    .toString(16)
    .slice(1)}`;
}

/**
 * Pick a readable contrast color (#000000 or #ffffff) for a given background hex
 * using relative luminance. Used to fill the theme's `contrast` slot.
 */
export function contrastFor(hex: string): string {
  const num = parseInt(hex.replace('#', ''), 16);
  const r = ((num >> 16) & 0xff) / 255;
  const g = ((num >> 8) & 0xff) / 255;
  const b = (num & 0xff) / 255;
  // Perceptual luminance (sRGB coefficients).
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.5 ? '#000000' : '#ffffff';
}

/** A semantic theme color slot with a four-shade variant. */
interface ThemeColorScale {
  main: string;
  light: string;
  dark: string;
  contrast: string;
}

/** Build a full {main,light,dark,contrast} scale from a single brand hex. */
function scaleFromHex(hex: string): ThemeColorScale {
  return {
    main: hex,
    light: adjustColor(hex, 20),
    dark: adjustColor(hex, -20),
    contrast: contrastFor(hex),
  };
}

// ============================================================================
// Brand reference examples → baked text block
// ============================================================================

/**
 * Assemble the operator's uploaded reference materials into a concise text block
 * that gets baked into every agent's Brand DNA (so all agents study real on-brand
 * examples — Standing Rule #1). Each line is the operator's own description +
 * purpose for one asset, plus — when present — the AI-extracted content summary
 * (`aiSummary`): a vision read of an image, the summarized transcript of a video,
 * or the summarized text of a PDF, produced by the asset/analyze route. Returns
 * '' when there are no assets, which produces NO subsection in the baked block.
 */
export function assembleBrandReferenceText(assets: BrandExampleAsset[]): string {
  if (!Array.isArray(assets) || assets.length === 0) {
    return '';
  }
  const MAX_ASSETS = 25;
  const clip = (s: string, n: number): string =>
    s.length > n ? `${s.slice(0, n - 1).trimEnd()}…` : s;

  const shown = assets.slice(0, MAX_ASSETS);
  const lines = shown.map((a) => {
    const what = clip((a.description || a.fileName || 'reference').trim(), 200);
    const why = a.purpose.trim().length > 0
      ? ` — why it matters: ${clip(a.purpose.trim(), 200)}`
      : '';
    // The AI-extracted content summary (vision read / video transcript / PDF
    // text) — the real, file-level signal the operator's one-line description
    // can't capture. Appended when present so agents study what's actually IN
    // the asset, not just what it's called.
    const inIt = (a.aiSummary ?? '').trim().length > 0
      ? ` — what's in it: ${clip((a.aiSummary ?? '').trim(), 400)}`
      : '';
    return `- (${a.kind}) ${what}${why}${inIt}`;
  });
  if (assets.length > MAX_ASSETS) {
    // Never silently truncate — say how many were left out.
    lines.push(`- …and ${assets.length - MAX_ASSETS} more reference(s) not listed here.`);
  }
  return lines.join('\n');
}

// ============================================================================
// Brand Kit bridge
// ============================================================================

/**
 * Build a `BrandKit` (minus updatedAt/updatedBy) from the canonical identity,
 * overlaying onto the existing kit so `enabled` is preserved.
 */
export function brandKitFromIdentity(
  identity: BrandIdentity,
  existingBrandKit: BrandKit,
): Omit<BrandKit, 'updatedAt' | 'updatedBy'> {
  return {
    enabled: existingBrandKit.enabled,
    logo: identity.logo,
    colors: {
      primary: identity.colors.primary,
      secondary: identity.colors.secondary,
      accent: identity.colors.accent,
    },
    typography: identity.typography,
    introOutro: identity.introOutro,
  };
}

// ============================================================================
// Theme bridge
// ============================================================================

/**
 * Structured (partial) view of the `platform_settings/theme` doc — only the
 * branches this bridge reads or preserves. Typed so no `any` is needed; the
 * full doc is preserved via spreads at each level.
 */
interface ThemeColorsPartial {
  primary?: Partial<ThemeColorScale>;
  secondary?: Partial<ThemeColorScale>;
  accent?: Partial<ThemeColorScale>;
  success?: Partial<ThemeColorScale>;
  warning?: Partial<ThemeColorScale>;
  error?: Partial<ThemeColorScale>;
  info?: unknown;
  neutral?: unknown;
  background?: unknown;
  text?: unknown;
  border?: unknown;
  [key: string]: unknown;
}

interface ThemeTypographyFontFamilyPartial {
  heading?: string;
  body?: string;
  mono?: string;
  [key: string]: unknown;
}

interface ThemeTypographyPartial {
  fontFamily?: ThemeTypographyFontFamilyPartial;
  fontSize?: Record<string, unknown>;
  fontWeight?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ThemeBrandingPartial {
  companyName?: string;
  logoUrl?: string;
  favicon?: string;
  primaryColor?: string;
  showPoweredBy?: boolean;
  [key: string]: unknown;
}

/** Live theme `layout` branch — only the sub-objects this bridge overlays/preserves. */
interface ThemeLayoutPartial {
  borderRadius?: Record<string, unknown>;
  spacing?: Record<string, unknown>;
  shadow?: Record<string, unknown>;
  [key: string]: unknown;
}

interface ThemeDocPartial {
  colors?: ThemeColorsPartial;
  typography?: ThemeTypographyPartial;
  branding?: ThemeBrandingPartial;
  layout?: ThemeLayoutPartial;
  updatedAt?: string;
  [key: string]: unknown;
}

/**
 * `info` + `neutral` are the ONLY color groups the operator can't set on the Brand
 * Identity page (there's no field for them). They mirror the canonical defaults in
 * `useOrgTheme.ts` (DEFAULT_THEME) and are ALWAYS written — existing operator values
 * win — so the saved theme can never be missing a group. Everything else
 * (background / text / border) IS a real operator choice and is derived below.
 */
const DEFAULT_INFO_NEUTRAL = {
  info: { main: '#3b82f6', light: '#60a5fa', dark: '#2563eb' },
  neutral: { 100: '#f3f4f6', 200: '#e5e7eb', 300: '#d1d5db', 400: '#9ca3af', 500: '#6b7280', 600: '#4b5563', 700: '#374151', 800: '#1f2937', 900: '#111827' },
} as const;

/** Coerce an unknown theme-color branch into a spreadable record (drops non-objects). */
function asColorRecord(v: unknown): Record<string, string> {
  return v && typeof v === 'object' ? (v as Record<string, string>) : {};
}

/**
 * Map the operator's flat brand palette onto the theme's nested structural color
 * groups. background / text / border are REAL operator choices on the Brand Identity
 * page — they were previously DROPPED here (the bug that blanked the dashboard when a
 * logo swap re-saved the identity). The light/dark/elevated/disabled sub-shades the
 * operator can't set directly are derived from their chosen colors (modest, clamp-safe
 * deltas) so the palette stays internally consistent for ANY base — light theme or dark.
 */
function structuralColorsFromIdentity(identity: BrandIdentity): {
  background: { main: string; paper: string; elevated: string };
  text: { primary: string; secondary: string; disabled: string };
  border: { main: string; light: string; strong: string };
} {
  const c = identity.colors;
  return {
    background: {
      main: c.background,
      paper: c.surface,
      elevated: adjustColor(c.surface, 12),
    },
    text: {
      primary: c.text,
      secondary: c.textMuted,
      disabled: adjustColor(c.textMuted, -22),
    },
    border: {
      main: c.border,
      light: adjustColor(c.border, -10),
      strong: adjustColor(c.border, 12),
    },
  };
}

/**
 * Deep-merge (by hand, level-by-level) the canonical identity into the existing
 * theme doc. The brand/semantic color mains (+ derived light/dark/contrast),
 * branding name/logo/primaryColor/favicon/showPoweredBy, heading/body/mono fonts,
 * and the dashboard-theme layout (borderRadius / spacing / shadow) + typography
 * (fontSize / fontWeight) are all overlaid from the identity. background / text /
 * border are also derived from the identity (see structuralColorsFromIdentity); only
 * neutral / info (no operator field) and any other layout/typography keys are
 * preserved verbatim via the structured spreads.
 */
export function themeOverlayFromIdentity(
  identity: BrandIdentity,
  existingTheme: ThemeDocPartial,
): Record<string, unknown> {
  const existingColors: ThemeColorsPartial = existingTheme.colors ?? {};
  const existingTypography: ThemeTypographyPartial = existingTheme.typography ?? {};
  const existingFontFamily: ThemeTypographyFontFamilyPartial =
    existingTypography.fontFamily ?? {};
  const existingBranding: ThemeBrandingPartial = existingTheme.branding ?? {};
  const existingLayout: ThemeLayoutPartial = existingTheme.layout ?? {};
  const dt = identity.dashboardTheme;

  return {
    ...existingTheme,
    colors: {
      ...existingColors,
      // Brand colors (derived from the operator's palette)
      primary: scaleFromHex(identity.colors.primary),
      secondary: scaleFromHex(identity.colors.secondary),
      accent: scaleFromHex(identity.colors.accent),
      // Semantic colors
      success: scaleFromHex(identity.colors.success),
      warning: scaleFromHex(identity.colors.warning),
      error: scaleFromHex(identity.colors.error),
      // Structural colors — DERIVED from the operator's own palette (background /
      // surface / text / textMuted / border on the Brand Identity page). Always
      // written in full, so a save can never leave the theme missing a group (the
      // bug that blanked the dashboard on a logo swap).
      ...structuralColorsFromIdentity(identity),
      // info + neutral aren't brand fields → keep the existing value or the default.
      info: { ...DEFAULT_INFO_NEUTRAL.info, ...asColorRecord(existingColors.info) },
      neutral: { ...DEFAULT_INFO_NEUTRAL.neutral, ...asColorRecord(existingColors.neutral) },
    },
    branding: {
      ...existingBranding,
      companyName: identity.companyName,
      logoUrl: identity.logo?.url ?? existingBranding.logoUrl ?? '',
      primaryColor: identity.colors.primary,
      favicon: dt.favicon,
      showPoweredBy: dt.showPoweredBy,
    },
    typography: {
      ...existingTypography,
      fontFamily: {
        ...existingFontFamily,
        heading: identity.fonts.heading,
        body: identity.fonts.body,
        mono: dt.monoFont,
      },
      fontSize: { ...existingTypography.fontSize, ...dt.fontSize },
      fontWeight: { ...existingTypography.fontWeight, ...dt.fontWeight },
    },
    layout: {
      ...existingLayout,
      borderRadius: { ...existingLayout.borderRadius, ...dt.borderRadius },
      spacing: { ...existingLayout.spacing, ...dt.spacing },
      shadow: { ...existingLayout.shadow, ...dt.shadow },
      // any other layout.* keys preserved via spread.
    },
    updatedAt: new Date().toISOString(),
  };
}

// ============================================================================
// Orchestrator
// ============================================================================

const THEME_COLLECTION = 'platform_settings';
const THEME_DOC = 'theme';

/**
 * Fan a saved `BrandIdentity` out to all three legacy stores. Each write-back is
 * INDEPENDENT and isolated in its own try/catch: one failing never blocks the
 * others, and this function never throws — it logs and returns which stores
 * succeeded.
 */
export async function syncBrandIdentityToLegacyStores(
  identity: BrandIdentity,
  userId: string,
): Promise<{ voice: boolean; brandKit: boolean; theme: boolean }> {
  const result = { voice: false, brandKit: false, theme: false };

  // 1. VOICE (+ assembled reference examples) → org brandDNA
  // referenceExamples rides on the brandDNA so the existing surgical re-bake bakes
  // the operator's reference materials into every agent's Brand DNA block. Pushed
  // to agents by the same "Publish to Agents" button as the voice.
  try {
    result.voice = await updateBrandDNA(
      { ...identity.voice, referenceExamples: assembleBrandReferenceText(identity.exampleAssets) },
      userId,
    );
  } catch (error) {
    logger.error(
      'Brand identity sync: failed to mirror voice into org brandDNA',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
  }

  // 2. BRAND KIT → settings/brand-kit
  try {
    const existing = await getBrandKit();
    await saveBrandKit(brandKitFromIdentity(identity, existing), userId);
    result.brandKit = true;
  } catch (error) {
    logger.error(
      'Brand identity sync: failed to write brand kit',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
  }

  // 3. THEME → platform_settings/theme
  try {
    if (!adminDb) {
      throw new Error('Firebase Admin not initialized');
    }
    const ref = adminDb.collection(THEME_COLLECTION).doc(THEME_DOC);
    const doc = await ref.get();
    const existing: ThemeDocPartial = doc.exists
      ? ((doc.data() ?? {}) as ThemeDocPartial)
      : {};
    await ref.set(themeOverlayFromIdentity(identity, existing), { merge: true });
    result.theme = true;
  } catch (error) {
    logger.error(
      'Brand identity sync: failed to write theme overlay',
      error instanceof Error ? error : new Error(String(error)),
      { file: FILE },
    );
  }

  return result;
}
