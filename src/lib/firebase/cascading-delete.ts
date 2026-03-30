/**
 * Cascading Delete Utility
 *
 * Recursively deletes Firestore subcollections when a parent document is deleted.
 * Uses the Admin SDK — server-side only (API routes).
 *
 * Firestore does not automatically delete subcollections when a parent document
 * is deleted. Without explicit cleanup, subcollection documents become orphaned
 * and continue consuming storage and appearing in queries.
 */

import { adminDb } from '@/lib/firebase/admin';
import { logger } from '@/lib/logger/logger';

/** Maximum documents per Firestore batch write (Firestore limit: 500). */
const BATCH_LIMIT = 400;

/**
 * Delete a Firestore document and all documents in the specified subcollections.
 *
 * @param documentPath - Full path to the parent document (e.g. "organizations/root/forms/abc123")
 * @param subcollectionNames - Names of subcollections to cascade-delete (e.g. ["fields", "submissions"])
 *
 * @example
 * ```ts
 * await deleteWithSubcollections(
 *   `${getFormsCollection()}/form123`,
 *   ['fields', 'submissions', 'analytics', 'views']
 * );
 * ```
 */
export async function deleteWithSubcollections(
  documentPath: string,
  subcollectionNames: string[]
): Promise<{ deletedParent: boolean; deletedSubDocs: number }> {
  if (!adminDb) {
    throw new Error('Firebase Admin is not initialized — cannot perform cascading delete');
  }

  const parentRef = adminDb.doc(documentPath);
  let deletedSubDocs = 0;

  // Delete subcollection documents in batches
  for (const subName of subcollectionNames) {
    const subCollectionRef = parentRef.collection(subName);
    let hasMore = true;

    while (hasMore) {
      const snapshot = await subCollectionRef.limit(BATCH_LIMIT).get();

      if (snapshot.empty) {
        hasMore = false;
        break;
      }

      const batch = adminDb.batch();
      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
      }
      await batch.commit();
      deletedSubDocs += snapshot.size;

      // If we got fewer than the limit, we're done with this subcollection
      if (snapshot.size < BATCH_LIMIT) {
        hasMore = false;
      }
    }
  }

  // Delete the parent document
  await parentRef.delete();

  logger.info('Cascading delete completed', {
    documentPath,
    subcollections: subcollectionNames,
    deletedSubDocs,
  });

  return { deletedParent: true, deletedSubDocs };
}
