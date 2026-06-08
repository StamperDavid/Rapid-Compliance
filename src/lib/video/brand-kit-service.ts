/**
 * Brand Kit Service
 *
 * CRUD for the brand kit stored in Firestore.
 * Collection path: organizations/{PLATFORM_ID}/settings/brand-kit
 */

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { DEFAULT_BRAND_KIT, type BrandColors, type BrandKit } from '@/types/brand-kit';

const BRAND_KIT_DOC_PATH = `${getSubCollection('settings')}/brand-kit`;
/** The website editor doc, where the tenant's real logo + colors already live. */
const WEBSITE_CONFIG_DOC_PATH = `${getSubCollection('platform')}/website-editor-config`;

/**
 * Borrow the real brand logo + colors from the website editor (where the tenant
 * already set them up). Returns only an absolute logo URL — a relative default like
 * '/logo.png' can't be composited and is treated as "none".
 */
async function getWebsiteBranding(): Promise<{ logoUrl: string | null; colors: BrandColors | null }> {
  if (!adminDb) {
    return { logoUrl: null, colors: null };
  }
  try {
    const doc = await adminDb.doc(WEBSITE_CONFIG_DOC_PATH).get();
    if (!doc.exists) {
      return { logoUrl: null, colors: null };
    }
    const branding = (doc.data() as { branding?: { logoUrl?: string; colors?: Partial<BrandColors> } }).branding;
    const logoUrl =
      typeof branding?.logoUrl === 'string' && /^https?:\/\//i.test(branding.logoUrl)
        ? branding.logoUrl
        : null;
    const c = branding?.colors;
    const colors =
      c?.primary && c.secondary && c.accent
        ? { primary: c.primary, secondary: c.secondary, accent: c.accent }
        : null;
    return { logoUrl, colors };
  } catch {
    return { logoUrl: null, colors: null };
  }
}

/**
 * Get the brand kit configuration. Returns default if none exists.
 *
 * Bridge until brand identity is unified: when the brand kit has no logo of its own,
 * borrow the REAL logo + colors from the website editor so generated images composite
 * the actual brand logo instead of a hallucinated one — no re-upload required.
 */
export async function getBrandKit(): Promise<BrandKit> {
  if (!adminDb) {
    return { ...DEFAULT_BRAND_KIT };
  }

  const doc = await adminDb.doc(BRAND_KIT_DOC_PATH).get();
  const data: Partial<BrandKit> = doc.exists ? (doc.data() as Partial<BrandKit>) : {};

  // Merge with defaults to fill any missing fields from older saves
  const kit: BrandKit = {
    enabled: data.enabled ?? DEFAULT_BRAND_KIT.enabled,
    logo: data.logo ?? DEFAULT_BRAND_KIT.logo,
    colors: { ...DEFAULT_BRAND_KIT.colors, ...data.colors },
    typography: { ...DEFAULT_BRAND_KIT.typography, ...data.typography },
    introOutro: { ...DEFAULT_BRAND_KIT.introOutro, ...data.introOutro },
    updatedAt: data.updatedAt ?? DEFAULT_BRAND_KIT.updatedAt,
    updatedBy: data.updatedBy ?? '',
  };

  // No brand-kit logo set → borrow the real one (and colors) from the website editor,
  // and failing that, from the static logo the app ships with. Either way generated
  // images composite the REAL logo, never a hallucinated one.
  if (!kit.logo?.url) {
    const web = await getWebsiteBranding();
    if (web.logoUrl) {
      kit.enabled = true;
      kit.logo = { url: web.logoUrl, position: 'bottom-right', opacity: 0.85, scale: 0.1 };
      if (web.colors && !data.colors) {
        kit.colors = web.colors;
      }
    } else {
      // Final bridge: the tenant's real logo ships as a static asset (public/logo.png).
      // The compositor reads local '/...' paths from disk, so this composites the REAL
      // logo until a proper uploaded brand asset replaces it.
      kit.enabled = true;
      kit.logo = { url: '/logo.png', position: 'bottom-right', opacity: 0.85, scale: 0.1 };
    }
  }

  return kit;
}

/**
 * Save the brand kit configuration.
 */
export async function saveBrandKit(
  brandKit: Omit<BrandKit, 'updatedAt' | 'updatedBy'>,
  userId: string,
): Promise<BrandKit> {
  const now = new Date().toISOString();

  const doc: BrandKit = {
    ...brandKit,
    updatedAt: now,
    updatedBy: userId,
  };

  if (!adminDb) {
    throw new Error('Firebase Admin not initialized');
  }

  await adminDb.doc(BRAND_KIT_DOC_PATH).set(doc, { merge: true });
  return doc;
}
