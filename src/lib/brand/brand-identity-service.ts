/**
 * Brand Identity Service
 *
 * CRUD for the canonical, unified brand identity stored in Firestore.
 * Collection path: organizations/{PLATFORM_ID}/settings/brand-identity
 *
 * This is ADDITIVE — it does not modify or re-point any existing reader. It mirrors
 * the merge-with-defaults pattern of `getBrandKit()` and replicates the SAME logo
 * fallback chain: own logo → website-editor branding.logoUrl (absolute http(s)) →
 * static `/logo.png`.
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getBrandDNA } from './brand-dna-service';
import {
  DEFAULT_BRAND_IDENTITY,
  type BrandIdentity,
  type BrandPalette,
  type DashboardTheme,
} from '@/types/brand-identity';

const BRAND_IDENTITY_DOC_PATH = `${getSubCollection('settings')}/brand-identity`;
/** The website editor doc, where the tenant's real logo + colors already live. */
const WEBSITE_CONFIG_DOC_PATH = `${getSubCollection('platform')}/website-editor-config`;
/** The live CRM theme doc — read by `useOrgTheme` → CSS vars. */
const THEME_DOC_PATH = 'platform_settings/theme';

/**
 * Deep-merge a (possibly partial) saved `dashboardTheme` over the defaults so every
 * nested key is always present even on older / partial saves. No `any`: each branch
 * is spread over its typed default.
 */
function mergeDashboardTheme(
  saved: Partial<DashboardTheme> | undefined,
): DashboardTheme {
  const d = DEFAULT_BRAND_IDENTITY.dashboardTheme;
  return {
    favicon: saved?.favicon ?? d.favicon,
    showPoweredBy: saved?.showPoweredBy ?? d.showPoweredBy,
    borderRadius: { ...d.borderRadius, ...saved?.borderRadius },
    spacing: { ...d.spacing, ...saved?.spacing },
    shadow: { ...d.shadow, ...saved?.shadow },
    fontSize: { ...d.fontSize, ...saved?.fontSize },
    fontWeight: { ...d.fontWeight, ...saved?.fontWeight },
    monoFont: saved?.monoFont ?? d.monoFont,
  };
}

/**
 * Structured (partial) view of the live theme doc's branches this read-bridge reads.
 * Typed so no `any` is needed; every access is guarded with a per-field fallback.
 */
interface LiveThemePartial {
  branding?: { favicon?: string; showPoweredBy?: boolean };
  layout?: {
    borderRadius?: Partial<DashboardTheme['borderRadius']>;
    spacing?: Partial<DashboardTheme['spacing']>;
    shadow?: Partial<DashboardTheme['shadow']>;
  };
  typography?: {
    fontSize?: Partial<DashboardTheme['fontSize']>;
    fontWeight?: Partial<DashboardTheme['fontWeight']>;
    fontFamily?: { mono?: string };
  };
}

/**
 * Read-bridge: when the brand-identity doc has no `dashboardTheme` yet (not migrated),
 * populate it FROM the operator's ACTUAL live theme doc so the page shows real values,
 * not defaults — otherwise the first save would overwrite their live theme. Maps
 * theme→dashboardTheme 1:1; every access is guarded and falls back per-field to the
 * default value.
 */
async function getDashboardThemeFromLiveTheme(): Promise<DashboardTheme> {
  const d = DEFAULT_BRAND_IDENTITY.dashboardTheme;
  if (!adminDb) {
    return { ...d };
  }
  try {
    const doc = await adminDb.doc(THEME_DOC_PATH).get();
    if (!doc.exists) {
      return { ...d };
    }
    const t = (doc.data() ?? {}) as LiveThemePartial;
    return {
      favicon: t.branding?.favicon ?? d.favicon,
      showPoweredBy: t.branding?.showPoweredBy ?? d.showPoweredBy,
      borderRadius: { ...d.borderRadius, ...t.layout?.borderRadius },
      spacing: { ...d.spacing, ...t.layout?.spacing },
      shadow: { ...d.shadow, ...t.layout?.shadow },
      fontSize: { ...d.fontSize, ...t.typography?.fontSize },
      fontWeight: { ...d.fontWeight, ...t.typography?.fontWeight },
      monoFont: t.typography?.fontFamily?.mono ?? d.monoFont,
    };
  } catch {
    return { ...d };
  }
}

/** One nested theme color slot ({ main, ... }) as stored in platform_settings/theme. */
interface ThemeColorSlot {
  main?: string;
  paper?: string;
  elevated?: string;
  primary?: string;
  secondary?: string;
}

interface LiveThemeColorsPartial {
  primary?: ThemeColorSlot;
  secondary?: ThemeColorSlot;
  accent?: ThemeColorSlot;
  success?: ThemeColorSlot;
  warning?: ThemeColorSlot;
  error?: ThemeColorSlot;
  background?: ThemeColorSlot;
  text?: ThemeColorSlot;
  border?: ThemeColorSlot;
}

/**
 * Read-bridge: pull the operator's REAL brand palette from the live CRM theme doc
 * (`platform_settings/theme` — the store the old "Theme & Branding" page wrote, and
 * what drives the dashboard) and map its nested `{ main }` colors onto the flat
 * 11-color BrandPalette. This is why the Brand page shows the tenant's ACTUAL colors
 * instead of generic defaults when `brand-identity.colors` hasn't been saved yet.
 * Every field falls back to the palette default. Returns null only if the theme doc
 * has no colors at all (so the caller keeps the defaults).
 */
async function getPaletteFromLiveTheme(): Promise<BrandPalette | null> {
  if (!adminDb) {
    return null;
  }
  try {
    const doc = await adminDb.doc(THEME_DOC_PATH).get();
    if (!doc.exists) {
      return null;
    }
    const c = (doc.data() as { colors?: LiveThemeColorsPartial }).colors;
    if (!c) {
      return null;
    }
    const d = DEFAULT_BRAND_IDENTITY.colors;
    return {
      primary: c.primary?.main ?? d.primary,
      secondary: c.secondary?.main ?? d.secondary,
      accent: c.accent?.main ?? d.accent,
      background: c.background?.main ?? d.background,
      surface: c.background?.paper ?? c.background?.elevated ?? d.surface,
      text: c.text?.primary ?? d.text,
      textMuted: c.text?.secondary ?? d.textMuted,
      border: c.border?.main ?? d.border,
      success: c.success?.main ?? d.success,
      warning: c.warning?.main ?? d.warning,
      error: c.error?.main ?? d.error,
    };
  } catch {
    return null;
  }
}

/**
 * Borrow the real brand logo + palette from the website editor (where the tenant
 * already set them up). Returns only an absolute logo URL — a relative default like
 * '/logo.png' can't be composited and is treated as "none" here.
 */
async function getWebsiteBranding(): Promise<{
  logoUrl: string | null;
  colors: Partial<BrandPalette> | null;
}> {
  if (!adminDb) {
    return { logoUrl: null, colors: null };
  }
  try {
    const doc = await adminDb.doc(WEBSITE_CONFIG_DOC_PATH).get();
    if (!doc.exists) {
      return { logoUrl: null, colors: null };
    }
    const branding = (
      doc.data() as { branding?: { logoUrl?: string; colors?: Partial<BrandPalette> } }
    ).branding;
    const logoUrl =
      typeof branding?.logoUrl === 'string' && /^https?:\/\//i.test(branding.logoUrl)
        ? branding.logoUrl
        : null;
    const colors = branding?.colors ?? null;
    return { logoUrl, colors };
  } catch {
    return { logoUrl: null, colors: null };
  }
}

/**
 * Get the canonical brand identity. Returns default if none exists.
 *
 * Mirrors `getBrandKit()`: per-field `?? DEFAULT` / spread merge to fill missing
 * fields from older saves, then the SAME logo fallback chain so downstream consumers
 * always composite the REAL logo, never a hallucinated one.
 */
export async function getBrandIdentity(): Promise<BrandIdentity> {
  if (!adminDb) {
    return { ...DEFAULT_BRAND_IDENTITY };
  }

  const doc = await adminDb.doc(BRAND_IDENTITY_DOC_PATH).get();
  const data: Partial<BrandIdentity> = doc.exists
    ? (doc.data() as Partial<BrandIdentity>)
    : {};

  // Merge with defaults to fill any missing fields from older / partial saves.
  const identity: BrandIdentity = {
    voice: { ...DEFAULT_BRAND_IDENTITY.voice, ...data.voice },
    companyName: data.companyName ?? DEFAULT_BRAND_IDENTITY.companyName,
    tagline: data.tagline ?? DEFAULT_BRAND_IDENTITY.tagline,
    logo: data.logo ?? DEFAULT_BRAND_IDENTITY.logo,
    colors: { ...DEFAULT_BRAND_IDENTITY.colors, ...data.colors },
    fonts: { ...DEFAULT_BRAND_IDENTITY.fonts, ...data.fonts },
    typography: { ...DEFAULT_BRAND_IDENTITY.typography, ...data.typography },
    introOutro: { ...DEFAULT_BRAND_IDENTITY.introOutro, ...data.introOutro },
    exampleAssets: data.exampleAssets ?? DEFAULT_BRAND_IDENTITY.exampleAssets,
    dashboardTheme: mergeDashboardTheme(data.dashboardTheme),
    updatedAt: data.updatedAt ?? DEFAULT_BRAND_IDENTITY.updatedAt,
    updatedBy: data.updatedBy ?? DEFAULT_BRAND_IDENTITY.updatedBy,
  };

  // Voice bridge: until this doc's `voice` is populated (migration), pull the real
  // voice from Brand DNA (the source the agents still bake from) so the Brand page
  // shows the tenant's ACTUAL voice — company description, key phrases incl. the
  // tagline — instead of empty defaults.
  if (!data.voice) {
    const dna = await getBrandDNA();
    if (dna) {
      identity.voice = {
        companyDescription: dna.companyDescription ?? '',
        uniqueValue: dna.uniqueValue ?? '',
        targetAudience: dna.targetAudience ?? '',
        toneOfVoice: dna.toneOfVoice ?? '',
        communicationStyle: dna.communicationStyle ?? '',
        keyPhrases: Array.isArray(dna.keyPhrases) ? dna.keyPhrases : [],
        avoidPhrases: Array.isArray(dna.avoidPhrases) ? dna.avoidPhrases : [],
        industry: dna.industry ?? '',
        competitors: Array.isArray(dna.competitors) ? dna.competitors : [],
      };
    }
  }

  // Dashboard-theme bridge: until this doc's `dashboardTheme` is populated
  // (migration), pull the real radius/spacing/shadow/font-size/weight/mono/favicon/
  // powered-by from the LIVE theme doc so the page shows the operator's ACTUAL theme.
  // Without this the first save would overwrite their live theme with defaults.
  if (!data.dashboardTheme) {
    identity.dashboardTheme = await getDashboardThemeFromLiveTheme();
  }

  // Colors bridge: until this doc's `colors` is saved (migration), pull the operator's
  // REAL palette from the live CRM theme doc — the colors that were in the old
  // "Theme & Branding" page and drive the dashboard — instead of generic defaults.
  if (!data.colors) {
    // Prefer the live CRM theme palette; if that has no colors, fall back to the
    // website editor's branding colors. Either way the operator sees their REAL
    // brand colors, regardless of whether a logo is set.
    const themePalette = await getPaletteFromLiveTheme();
    if (themePalette) {
      identity.colors = themePalette;
    } else {
      const web = await getWebsiteBranding();
      if (web.colors) {
        identity.colors = { ...identity.colors, ...web.colors };
      }
    }
  }

  // No own logo set → borrow the real one from the website editor, and failing
  // that, fall back to the static logo the app ships with.
  if (!identity.logo?.url) {
    const web = await getWebsiteBranding();
    if (web.logoUrl) {
      identity.logo = { url: web.logoUrl, position: 'bottom-right', opacity: 0.85, scale: 0.1 };
    } else {
      // Final bridge: the tenant's real logo ships as a static asset (public/logo.png).
      identity.logo = { url: '/logo.png', position: 'bottom-right', opacity: 0.85, scale: 0.1 };
    }
  }

  return identity;
}

/**
 * Save the canonical brand identity.
 */
export async function saveBrandIdentity(
  identity: Omit<BrandIdentity, 'updatedAt' | 'updatedBy'>,
  userId: string,
): Promise<BrandIdentity> {
  const now = new Date().toISOString();

  const doc: BrandIdentity = {
    ...identity,
    updatedAt: now,
    updatedBy: userId,
  };

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  await adminDb.doc(BRAND_IDENTITY_DOC_PATH).set(doc, { merge: true });
  return doc;
}
