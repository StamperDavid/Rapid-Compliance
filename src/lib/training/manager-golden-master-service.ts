/**
 * Manager Golden Master Service
 *
 * Manages versioned Golden Master snapshots for the 10 manager agents
 * (Content, Marketing, Outreach, Intelligence, Revenue, Reputation,
 * Commerce, Builder, Architect, Master Orchestrator).
 *
 * Parallel to `specialist-golden-master-service.ts` but for the manager
 * review layer. Each manager's GM doc holds the review criteria prompt
 * that the LLM uses to grade specialist output before it leaves the
 * department. Brand DNA is baked into the prompt at seed time per the
 * standing rule — no runtime merge.
 *
 * Collection: `managerGoldenMasters` (sub-collection of the platform org)
 * Doc IDs:    `mgm_{managerId}_{industryKey}_v{version}`
 *
 * @module training/manager-golden-master-service
 */

import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import type { ManagerGoldenMaster } from '@/types/training';

// ============================================================================
// CONSTANTS
// ============================================================================

const MANAGER_GM_COLLECTION = 'managerGoldenMasters';
const GM_CACHE_TTL_MS = 60_000;

function getGMCollectionPath(): string {
  return getSubCollection(MANAGER_GM_COLLECTION);
}

// ============================================================================
// IN-MEMORY CACHE (60-second TTL, matches specialist service)
// ============================================================================

interface GMCacheEntry {
  data: ManagerGoldenMaster;
  timestamp: number;
}

const industryGMCache = new Map<string, GMCacheEntry>();

function gmCacheKey(managerId: string, industryKey: string): string {
  return `${managerId}:${industryKey}`;
}

// ============================================================================
// PUBLIC API — GETTERS
// ============================================================================

/**
 * Get the currently active Golden Master for a manager scoped to a specific
 * industry template. Used by `BaseManager.reviewOutput()` at runtime.
 *
 * Returns `null` if no active GM exists for this manager yet — callers must
 * treat this as "pass-through review, no LLM gate active" so the system
 * continues to work before managers have been seeded.
 *
 * 60-second in-memory cache keyed by `${managerId}:${industryKey}`.
 */
export async function getActiveManagerGMByIndustry(
  managerId: string,
  industryKey: string,
): Promise<ManagerGoldenMaster | null> {
  const cacheKey = gmCacheKey(managerId, industryKey);
  const cached = industryGMCache.get(cacheKey);

  if (cached && (Date.now() - cached.timestamp) < GM_CACHE_TTL_MS) {
    return cached.data;
  }

  if (!adminDb) { return null; }

  const collection = adminDb.collection(getGMCollectionPath());
  const snapshot = await collection
    .where('managerId', '==', managerId)
    .where('industryKey', '==', industryKey)
    .where('isActive', '==', true)
    .limit(1)
    .get();

  if (snapshot.empty) {
    industryGMCache.delete(cacheKey);
    return null;
  }

  const data = snapshot.docs[0].data() as ManagerGoldenMaster;
  industryGMCache.set(cacheKey, { data, timestamp: Date.now() });
  return data;
}

/**
 * List all active Manager Golden Masters across all managers/industries.
 * Used by Training Lab UI and by the `verify-manager-gm-injection.ts` audit.
 */
export async function listActiveManagerGMs(): Promise<ManagerGoldenMaster[]> {
  if (!adminDb) { return []; }

  const snapshot = await adminDb
    .collection(getGMCollectionPath())
    .where('isActive', '==', true)
    .orderBy('managerId')
    .get();

  return snapshot.docs.map((doc) => doc.data() as ManagerGoldenMaster);
}

/**
 * Get a specific Manager Golden Master by its doc ID. Used by version
 * history and rollback flows in the Training Lab.
 */
export async function getManagerGMById(
  docId: string,
): Promise<ManagerGoldenMaster | null> {
  if (!adminDb) { return null; }

  const doc = await adminDb.collection(getGMCollectionPath()).doc(docId).get();
  if (!doc.exists) { return null; }
  return doc.data() as ManagerGoldenMaster;
}

// ============================================================================
// PUBLIC API — CACHE INVALIDATION
// ============================================================================

/**
 * Invalidate the industry-scoped GM cache for a given manager+industry pair.
 * Called after a new GM version is deployed (Phase 3 grading pipeline) so
 * the next request reloads from Firestore.
 */
export function invalidateManagerGMCache(managerId: string, industryKey: string): void {
  industryGMCache.delete(gmCacheKey(managerId, industryKey));
}

/**
 * Clear the entire Manager GM cache. Used by tests and by operator-triggered
 * full reload from the Training Lab.
 */
export function clearManagerGMCache(): void {
  industryGMCache.clear();
}

// ============================================================================
// PUBLIC API — DEPLOY (Phase 3 grading pipeline)
// ============================================================================

/**
 * Deactivate every currently-active GM for a given manager+industry pair,
 * then activate the new doc. Used when Phase 3 grading produces a new
 * approved version. Matches the deploy semantics of the specialist service.
 *
 * Runs in a Firestore batch so the swap is atomic.
 */
export async function deployManagerGMVersion(
  managerId: string,
  industryKey: string,
  newDocId: string,
): Promise<void> {
  if (!adminDb) {
    throw new Error('[ManagerGMService] adminDb not initialized');
  }

  const collection = adminDb.collection(getGMCollectionPath());

  // Find all currently-active docs for this manager+industry and deactivate them
  const activeSnap = await collection
    .where('managerId', '==', managerId)
    .where('industryKey', '==', industryKey)
    .where('isActive', '==', true)
    .get();

  const batch = adminDb.batch();
  const now = new Date().toISOString();

  for (const doc of activeSnap.docs) {
    if (doc.id === newDocId) { continue; }
    batch.update(doc.ref, {
      isActive: false,
      deactivatedAt: now,
      deactivatedReason: `superseded by ${newDocId}`,
    });
  }

  batch.update(collection.doc(newDocId), {
    isActive: true,
    deployedAt: now,
  });

  await batch.commit();
  invalidateManagerGMCache(managerId, industryKey);

  logger.info(
    `[ManagerGMService] Deployed ${newDocId} for ${managerId}:${industryKey} (deactivated ${activeSnap.docs.length - (activeSnap.docs.some((d) => d.id === newDocId) ? 1 : 0)} prior)`,
    { managerId, industryKey },
  );
}
