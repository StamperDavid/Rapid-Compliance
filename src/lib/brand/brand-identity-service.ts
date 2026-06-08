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
} from '@/types/brand-identity';

const BRAND_IDENTITY_DOC_PATH = `${getSubCollection('settings')}/brand-identity`;
/** The website editor doc, where the tenant's real logo + colors already live. */
const WEBSITE_CONFIG_DOC_PATH = `${getSubCollection('platform')}/website-editor-config`;

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

  // No own logo set → borrow the real one (and palette) from the website editor,
  // and failing that, fall back to the static logo the app ships with.
  if (!identity.logo?.url) {
    const web = await getWebsiteBranding();
    if (web.logoUrl) {
      identity.logo = { url: web.logoUrl, position: 'bottom-right', opacity: 0.85, scale: 0.1 };
      if (web.colors && !data.colors) {
        identity.colors = { ...identity.colors, ...web.colors };
      }
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
