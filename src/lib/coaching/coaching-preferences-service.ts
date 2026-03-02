/**
 * Coaching Preferences Service
 *
 * Server-side (adminDb) and client-side (FirestoreService) access
 * for the selected coaching AI model preference.
 *
 * Firestore path: organizations/{PLATFORM_ID}/settings/coaching_preferences
 */

import { PLATFORM_ID } from '@/lib/constants/platform';
import { COLLECTIONS } from '@/lib/firebase/collections';
import { DEFAULT_COACHING_MODEL, type CoachingPreferences } from './coaching-models';

const SETTINGS_COLLECTION = `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/settings`;
const DOC_ID = 'coaching_preferences';

// ============================================================================
// SERVER-SIDE (API routes — uses admin SDK)
// ============================================================================

/**
 * Get coaching preferences from Firestore (server-side).
 * Returns null if no preferences have been saved yet.
 */
export async function getCoachingPreferences(): Promise<CoachingPreferences | null> {
  const { adminDb } = await import('@/lib/firebase/admin');
  if (!adminDb) {
    return null;
  }
  const snap = await adminDb.collection(SETTINGS_COLLECTION).doc(DOC_ID).get();
  if (!snap.exists) {
    return null;
  }
  const data = snap.data() as Record<string, unknown>;
  return {
    selectedModel: (typeof data.selectedModel === 'string' && data.selectedModel !== '')
      ? data.selectedModel
      : DEFAULT_COACHING_MODEL,
    updatedBy: typeof data.updatedBy === 'string' ? data.updatedBy : '',
    updatedAt: data.updatedAt instanceof Date
      ? data.updatedAt
      : (data.updatedAt && typeof (data.updatedAt as { toDate?: () => Date }).toDate === 'function'
        ? (data.updatedAt as { toDate: () => Date }).toDate()
        : new Date()),
  };
}

/**
 * Save coaching preferences to Firestore (server-side).
 */
export async function saveCoachingPreferences(
  selectedModel: string,
  userId: string
): Promise<void> {
  const { adminDb } = await import('@/lib/firebase/admin');
  if (!adminDb) {
    throw new Error('Admin DB not initialized');
  }
  await adminDb.collection(SETTINGS_COLLECTION).doc(DOC_ID).set(
    {
      selectedModel,
      updatedBy: userId,
      updatedAt: new Date(),
    },
    { merge: true }
  );
}

// ============================================================================
// CLIENT-SIDE (coaching page — uses FirestoreService)
// ============================================================================

/**
 * Get coaching preferences from Firestore (client-side).
 */
export async function getCoachingPreferencesClient(): Promise<CoachingPreferences | null> {
  const { FirestoreService } = await import('@/lib/db/firestore-service');
  return FirestoreService.get<CoachingPreferences>(SETTINGS_COLLECTION, DOC_ID);
}

/**
 * Save coaching preferences from client-side.
 */
export async function saveCoachingPreferencesClient(
  selectedModel: string,
  userId: string
): Promise<void> {
  const { FirestoreService } = await import('@/lib/db/firestore-service');
  await FirestoreService.set(SETTINGS_COLLECTION, DOC_ID, {
    selectedModel,
    updatedBy: userId,
    updatedAt: new Date(),
  }, true);
}
