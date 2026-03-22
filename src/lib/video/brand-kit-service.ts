/**
 * Brand Kit Service
 *
 * CRUD for the brand kit stored in Firestore.
 * Collection path: organizations/{PLATFORM_ID}/settings/brand-kit
 */

import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { DEFAULT_BRAND_KIT, type BrandKit } from '@/types/brand-kit';

const BRAND_KIT_DOC_PATH = `organizations/${PLATFORM_ID}/settings/brand-kit`;

/**
 * Get the brand kit configuration. Returns default if none exists.
 */
export async function getBrandKit(): Promise<BrandKit> {
  if (!adminDb) {
    return { ...DEFAULT_BRAND_KIT };
  }

  const doc = await adminDb.doc(BRAND_KIT_DOC_PATH).get();

  if (!doc.exists) {
    return { ...DEFAULT_BRAND_KIT };
  }

  const data = doc.data() as Partial<BrandKit>;

  // Merge with defaults to fill any missing fields from older saves
  return {
    enabled: data.enabled ?? DEFAULT_BRAND_KIT.enabled,
    logo: data.logo ?? DEFAULT_BRAND_KIT.logo,
    colors: {
      ...DEFAULT_BRAND_KIT.colors,
      ...data.colors,
    },
    typography: {
      ...DEFAULT_BRAND_KIT.typography,
      ...data.typography,
    },
    introOutro: {
      ...DEFAULT_BRAND_KIT.introOutro,
      ...data.introOutro,
    },
    updatedAt: data.updatedAt ?? DEFAULT_BRAND_KIT.updatedAt,
    updatedBy: data.updatedBy ?? '',
  };
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
