/**
 * Brand Preference Memory Service
 *
 * Stores learned video style preferences from user feedback during the
 * review/approval workflow. Over time, the Video Production Agent references
 * these preferences when generating Hedra prompts to produce more consistent,
 * on-brand results without repeated user corrections.
 *
 * Collection path: organizations/{PLATFORM_ID}/video_brand_preferences/{docId}
 *
 * Preference types:
 * - approved_prompt: A prompt pattern that was approved (thumbs-up) — reuse this style
 * - rejected_prompt: A prompt pattern that was rejected — avoid this style
 * - style_correction: User-provided revision direction — apply this correction by default
 * - lighting_preference: Specific lighting style that works for the brand
 * - camera_preference: Preferred camera angles for different scene types
 */

import { adminDb } from '@/lib/firebase/admin';
import { FieldValue } from 'firebase-admin/firestore';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

// ============================================================================
// Types
// ============================================================================

export type PreferenceCategory =
  | 'approved_prompt'
  | 'rejected_prompt'
  | 'style_correction'
  | 'lighting_preference'
  | 'camera_preference';

export interface BrandPreference {
  id: string;
  category: PreferenceCategory;
  /** The prompt text or pattern this preference relates to */
  promptPattern: string;
  /** User's feedback or correction direction (from revision feedback) */
  feedback: string | null;
  /** Scene type context (e.g., 'product-demo', 'talking-head', 'action') */
  sceneType: string | null;
  /** Character role context (e.g., 'hero', 'villain', 'presenter') */
  characterRole: string | null;
  /** Character style context (e.g., 'anime', 'real', 'stylized') */
  characterStyle: string | null;
  /** How many times this preference has been reinforced (approved again) */
  reinforcementCount: number;
  /** Project ID where this preference was first recorded */
  sourceProjectId: string | null;
  /** Scene ID where this preference was first recorded */
  sourceSceneId: string | null;
  createdAt: string;
  updatedAt: string;
}

interface FirestorePreferenceDoc {
  category: PreferenceCategory;
  promptPattern: string;
  feedback: string | null;
  sceneType: string | null;
  characterRole: string | null;
  characterStyle: string | null;
  reinforcementCount: number;
  sourceProjectId: string | null;
  sourceSceneId: string | null;
  createdAt: FirebaseFirestore.Timestamp | null;
  updatedAt: FirebaseFirestore.Timestamp | null;
}

// ============================================================================
// Constants
// ============================================================================

const COLLECTION_PATH = getSubCollection('video_brand_preferences');

/** Maximum preferences to return in queries (prevent unbounded reads) */
const MAX_PREFERENCES = 50;

// ============================================================================
// Helpers
// ============================================================================

function timestampToISO(timestamp: unknown): string {
  if (timestamp && typeof timestamp === 'object' && 'toDate' in timestamp) {
    return (timestamp as { toDate: () => Date }).toDate().toISOString();
  }
  return new Date().toISOString();
}

function docToPreference(id: string, raw: FirebaseFirestore.DocumentData): BrandPreference {
  const data = raw as FirestorePreferenceDoc;
  return {
    id,
    category: data.category ?? 'approved_prompt',
    promptPattern: data.promptPattern ?? '',
    feedback: data.feedback ?? null,
    sceneType: data.sceneType ?? null,
    characterRole: data.characterRole ?? null,
    characterStyle: data.characterStyle ?? null,
    reinforcementCount: data.reinforcementCount ?? 1,
    sourceProjectId: data.sourceProjectId ?? null,
    sourceSceneId: data.sourceSceneId ?? null,
    createdAt: timestampToISO(data.createdAt),
    updatedAt: timestampToISO(data.updatedAt),
  };
}

// ============================================================================
// CRUD Operations
// ============================================================================

/**
 * Record a brand preference from user feedback during video review.
 */
export async function recordPreference(params: {
  category: PreferenceCategory;
  promptPattern: string;
  feedback?: string;
  sceneType?: string;
  characterRole?: string;
  characterStyle?: string;
  sourceProjectId?: string;
  sourceSceneId?: string;
}): Promise<{ success: boolean; preferenceId?: string; error?: string }> {
  try {
    if (!adminDb) {
      return { success: false, error: 'Database not available' };
    }

    const docData = {
      category: params.category,
      promptPattern: params.promptPattern,
      feedback: params.feedback ?? null,
      sceneType: params.sceneType ?? null,
      characterRole: params.characterRole ?? null,
      characterStyle: params.characterStyle ?? null,
      reinforcementCount: 1,
      sourceProjectId: params.sourceProjectId ?? null,
      sourceSceneId: params.sourceSceneId ?? null,
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const docRef = await adminDb.collection(COLLECTION_PATH).add(docData);

    logger.info('Brand preference recorded', {
      preferenceId: docRef.id,
      category: params.category,
      file: 'brand-preference-service.ts',
    });

    return { success: true, preferenceId: docRef.id };
  } catch (error) {
    logger.error('Failed to record brand preference', error as Error, {
      file: 'brand-preference-service.ts',
    });
    return { success: false, error: 'Failed to record preference' };
  }
}

/**
 * Reinforce an existing preference (bump its reinforcement count).
 * Called when the same pattern is approved again in a later project.
 */
export async function reinforcePreference(preferenceId: string): Promise<boolean> {
  try {
    if (!adminDb) {
      return false;
    }

    await adminDb.collection(COLLECTION_PATH).doc(preferenceId).update({
      reinforcementCount: FieldValue.increment(1),
      updatedAt: FieldValue.serverTimestamp(),
    });

    return true;
  } catch (error) {
    logger.error('Failed to reinforce preference', error as Error, {
      preferenceId,
      file: 'brand-preference-service.ts',
    });
    return false;
  }
}

/**
 * Get approved prompt patterns for a given scene type and character context.
 * Returns the most reinforced preferences first (strongest brand signals).
 */
export async function getApprovedPatterns(params?: {
  sceneType?: string;
  characterRole?: string;
  characterStyle?: string;
  limit?: number;
}): Promise<BrandPreference[]> {
  try {
    if (!adminDb) {
      return [];
    }

    let q: FirebaseFirestore.Query = adminDb.collection(COLLECTION_PATH)
      .where('category', '==', 'approved_prompt')
      .orderBy('reinforcementCount', 'desc')
      .limit(params?.limit ?? MAX_PREFERENCES);

    if (params?.sceneType) {
      q = q.where('sceneType', '==', params.sceneType);
    }

    const snapshot = await q.get();
    let results = snapshot.docs.map((doc) => docToPreference(doc.id, doc.data()));

    // Client-side filter for character context (Firestore single-field inequality limit)
    if (params?.characterRole) {
      results = results.filter((p) => !p.characterRole || p.characterRole === params.characterRole);
    }
    if (params?.characterStyle) {
      results = results.filter((p) => !p.characterStyle || p.characterStyle === params.characterStyle);
    }

    return results;
  } catch (error) {
    logger.error('Failed to get approved patterns', error as Error, {
      file: 'brand-preference-service.ts',
    });
    return [];
  }
}

/**
 * Get style corrections that should be applied by default.
 * Returns corrections ordered by most reinforced first.
 */
export async function getStyleCorrections(params?: {
  sceneType?: string;
  limit?: number;
}): Promise<BrandPreference[]> {
  try {
    if (!adminDb) {
      return [];
    }

    let q: FirebaseFirestore.Query = adminDb.collection(COLLECTION_PATH)
      .where('category', '==', 'style_correction')
      .orderBy('reinforcementCount', 'desc')
      .limit(params?.limit ?? MAX_PREFERENCES);

    if (params?.sceneType) {
      q = q.where('sceneType', '==', params.sceneType);
    }

    const snapshot = await q.get();
    return snapshot.docs.map((doc) => docToPreference(doc.id, doc.data()));
  } catch (error) {
    logger.error('Failed to get style corrections', error as Error, {
      file: 'brand-preference-service.ts',
    });
    return [];
  }
}

/**
 * Get rejected patterns to avoid when generating prompts.
 */
export async function getRejectedPatterns(params?: {
  limit?: number;
}): Promise<BrandPreference[]> {
  try {
    if (!adminDb) {
      return [];
    }

    const snapshot = await adminDb.collection(COLLECTION_PATH)
      .where('category', '==', 'rejected_prompt')
      .orderBy('reinforcementCount', 'desc')
      .limit(params?.limit ?? MAX_PREFERENCES)
      .get();

    return snapshot.docs.map((doc) => docToPreference(doc.id, doc.data()));
  } catch (error) {
    logger.error('Failed to get rejected patterns', error as Error, {
      file: 'brand-preference-service.ts',
    });
    return [];
  }
}

/**
 * Get all preferences (for admin/debug views).
 */
export async function listPreferences(params?: {
  category?: PreferenceCategory;
  limit?: number;
}): Promise<BrandPreference[]> {
  try {
    if (!adminDb) {
      return [];
    }

    let q: FirebaseFirestore.Query = adminDb.collection(COLLECTION_PATH)
      .orderBy('updatedAt', 'desc')
      .limit(params?.limit ?? MAX_PREFERENCES);

    if (params?.category) {
      q = q.where('category', '==', params.category);
    }

    const snapshot = await q.get();
    return snapshot.docs.map((doc) => docToPreference(doc.id, doc.data()));
  } catch (error) {
    logger.error('Failed to list preferences', error as Error, {
      file: 'brand-preference-service.ts',
    });
    return [];
  }
}

/**
 * Delete a preference by ID.
 */
export async function deletePreference(preferenceId: string): Promise<boolean> {
  try {
    if (!adminDb) {
      return false;
    }

    await adminDb.collection(COLLECTION_PATH).doc(preferenceId).delete();

    logger.info('Brand preference deleted', {
      preferenceId,
      file: 'brand-preference-service.ts',
    });

    return true;
  } catch (error) {
    logger.error('Failed to delete preference', error as Error, {
      preferenceId,
      file: 'brand-preference-service.ts',
    });
    return false;
  }
}

/**
 * Build a style hints string from brand preferences for use in prompt translation.
 * Combines approved patterns and style corrections into a single directive.
 */
export async function buildBrandStyleHints(params?: {
  sceneType?: string;
  characterRole?: string;
  characterStyle?: string;
}): Promise<string> {
  const [approved, corrections, rejected] = await Promise.all([
    getApprovedPatterns({ ...params, limit: 5 }),
    getStyleCorrections({ sceneType: params?.sceneType, limit: 5 }),
    getRejectedPatterns({ limit: 5 }),
  ]);

  const hints: string[] = [];

  if (approved.length > 0) {
    const approvedHints = approved
      .map((p) => p.promptPattern)
      .slice(0, 3)
      .join('; ');
    hints.push(`BRAND APPROVED STYLES: ${approvedHints}`);
  }

  if (corrections.length > 0) {
    const correctionHints = corrections
      .map((p) => p.feedback ?? p.promptPattern)
      .slice(0, 3)
      .join('; ');
    hints.push(`ALWAYS APPLY: ${correctionHints}`);
  }

  if (rejected.length > 0) {
    const rejectedHints = rejected
      .map((p) => p.promptPattern)
      .slice(0, 3)
      .join('; ');
    hints.push(`AVOID: ${rejectedHints}`);
  }

  return hints.join('. ');
}
