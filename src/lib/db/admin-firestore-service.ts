/**
 * Admin Firestore Service
 * Server-side only - uses Firebase Admin SDK to bypass security rules
 * Use this for privileged operations in API routes
 */

import * as admin from 'firebase-admin';
import { adminDb } from '@/lib/firebase/admin'
import { logger } from '@/lib/logger/logger';
import type {
  QueryConstraint,
} from 'firebase/firestore';

const FieldValue = admin.firestore.FieldValue;

// Type definitions for constraint data extraction
interface ConstraintFieldPath {
  segments?: string[];
  join?: (separator: string) => string;
}

interface WhereConstraintData {
  type: 'where';
  _field?: ConstraintFieldPath;
  fieldPath?: string;
  _op?: string;
  opStr?: string;
  _value?: unknown;
  value?: unknown;
}

interface OrderByConstraintData {
  type: 'orderBy';
  _field?: ConstraintFieldPath;
  fieldPath?: string;
  _direction?: string;
  directionStr?: string;
}

interface LimitConstraintData {
  type: 'limit';
  _limit?: number;
  limit?: number;
}

type ConstraintData = WhereConstraintData | OrderByConstraintData | LimitConstraintData | { type?: string };

// Type for Firestore document data
interface FirestoreDocument {
  id: string;
  [key: string]: unknown;
}

/**
 * Ensure adminDb is initialized, throw if not
 */
function ensureAdminDb() {
  if (!adminDb) {
    throw new Error('Admin Firestore DB not initialized. Check Firebase Admin SDK configuration.');
  }
  return adminDb;
}

export class AdminFirestoreService {
  /**
   * Get a single document by ID. Generic over the document shape so callers
   * can read into a typed interface without a separate cast — mirrors the
   * client-SDK FirestoreService.get pattern.
   */
  static async get<T extends object = FirestoreDocument>(
    collectionPath: string,
    docId: string,
  ): Promise<T | null> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return {
        id: doc.id,
        ...doc.data(),
      } as T;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error getting document ${collectionPath}/${docId}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Get all documents in a collection with optional filters. Generic over the
   * document shape so callers can read into a typed interface without a
   * separate cast — mirrors the client-SDK FirestoreService.getAll pattern.
   */
  static async getAll<T extends object = FirestoreDocument>(
    collectionPath: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    try {
      let query: FirebaseFirestore.Query = ensureAdminDb().collection(collectionPath);
      
      // Apply constraints (where, orderBy, limit)
      for (const constraint of constraints) {
        const constraintData = constraint as unknown as ConstraintData;

        if (!constraintData?.type) {
          continue;
        }

        if (constraintData.type === 'where') {
          // Client SDK stores these as _field, _op, _value (underscore-prefixed)
          const whereData = constraintData as WhereConstraintData;
          const fieldPath = whereData._field?.segments?.join('.') ?? whereData.fieldPath;
          const op = whereData._op ?? whereData.opStr;
          const value = whereData._value !== undefined ? whereData._value : whereData.value;

          if (!fieldPath || !op) {
            continue;
          }

          query = query.where(
            fieldPath,
            op as FirebaseFirestore.WhereFilterOp,
            value
          );
        } else if (constraintData.type === 'orderBy') {
          // Client SDK stores these as _field, _direction
          const orderData = constraintData as OrderByConstraintData;
          const fieldPath = orderData._field?.segments?.join('.') ?? orderData.fieldPath;
          const direction = orderData._direction ?? orderData.directionStr;

          if (!fieldPath) {
            continue;
          }

          query = query.orderBy(
            fieldPath,
            direction as FirebaseFirestore.OrderByDirection
          );
        } else if (constraintData.type === 'limit') {
          const limitData = constraintData as LimitConstraintData;
          const limitValue = limitData._limit ?? limitData.limit;
          if (limitValue) {
            query = query.limit(limitValue);
          }
        }
      }
      
      const snapshot = await query.get();

      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error getting documents from ${collectionPath}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Get documents with pagination. Generic over the document shape so callers
   * can read into a typed interface without a separate cast — mirrors the
   * client-SDK FirestoreService.getAllPaginated pattern.
   */
  static async getAllPaginated<T extends object = FirestoreDocument>(
    collectionPath: string,
    constraints: QueryConstraint[] = [],
    pageSize: number = 50,
    lastDoc?: FirebaseFirestore.QueryDocumentSnapshot
  ): Promise<{
    data: T[];
    lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null;
    hasMore: boolean;
  }> {
    try {
      let query: FirebaseFirestore.Query = ensureAdminDb().collection(collectionPath);
      

      // Apply constraints (where, orderBy, limit)
      for (const constraint of constraints) {
        const constraintData = constraint as unknown as ConstraintData;

        // Skip invalid constraints
        if (!constraintData?.type) {
          continue;
        }

        if (constraintData.type === 'where') {
          // Client SDK stores these as _field, _op, _value (underscore-prefixed)
          const whereData = constraintData as WhereConstraintData;
          const fieldPath = whereData._field?.segments?.join('.') ?? whereData.fieldPath;
          const op = whereData._op ?? whereData.opStr;
          const value = whereData._value !== undefined ? whereData._value : whereData.value;

          if (!fieldPath || !op) {
            continue;
          }

          query = query.where(
            fieldPath,
            op as FirebaseFirestore.WhereFilterOp,
            value
          );
        } else if (constraintData.type === 'orderBy') {
          // Client SDK stores these as _field, _direction
          const orderData = constraintData as OrderByConstraintData;
          const fieldPath = orderData._field?.segments?.join('.') ?? orderData.fieldPath;
          const direction = orderData._direction ?? orderData.directionStr;

          if (!fieldPath) {
            continue;
          }

          query = query.orderBy(
            fieldPath,
            direction as FirebaseFirestore.OrderByDirection
          );
        } else if (constraintData.type === 'limit') {
          // Skip limit constraint - we'll apply pageSize below
          continue;
        }
      }
      
      // Apply pagination
      if (lastDoc) {
        query = query.startAfter(lastDoc);
      }
      
      // Fetch pageSize + 1 to determine if there are more pages
      query = query.limit(pageSize + 1);
      
      const snapshot = await query.get();
      const docs = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];

      // Determine if there are more pages
      const hasMore = docs.length > pageSize;
      const data = hasMore ? docs.slice(0, pageSize) : docs;
      const newLastDoc = data.length > 0 ? snapshot.docs[data.length - 1] : null;
      
      return {
        data,
        lastDoc: newLastDoc,
        hasMore,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error getting paginated documents from ${collectionPath}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Set/create a document. Raw firebase-admin .set() semantics — default
   * `merge=false` (overwrite), NO auto-timestamps. Existing admin callers
   * rely on this behavior; do not change it.
   *
   * When migrating a client-SDK FirestoreService.set call site, use
   * `setLikeClient()` instead, which matches the client-SDK contract
   * (default `merge=true` + auto-stamped `createdAt`/`updatedAt`).
   */
  static async set<T extends object = Record<string, unknown>>(
    collectionPath: string,
    docId: string,
    data: T,
    merge: boolean = false
  ): Promise<void> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);

      if (merge) {
        await docRef.set(data as Record<string, unknown>, { merge: true });
      } else {
        await docRef.set(data as Record<string, unknown>);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error setting document ${collectionPath}/${docId}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Set a document with client-SDK FirestoreService.set semantics:
   *  - default `merge=true`
   *  - always stamps `updatedAt` (overrides any caller-provided value)
   *  - stamps `createdAt` on new documents (overrides any caller-provided value)
   *
   * Use this when migrating a `FirestoreService.set(...)` call to the
   * admin SDK so behavior stays identical. Existing admin callers should
   * NOT switch to this method unless they want client-SDK semantics —
   * server-stamped `updatedAt` will override any caller-supplied value.
   */
  static async setLikeClient<T extends object = Record<string, unknown>>(
    collectionPath: string,
    docId: string,
    data: T,
    merge: boolean = true
  ): Promise<void> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);

      const docSnap = merge ? await docRef.get() : null;
      const isNewDoc = !docSnap?.exists;
      const dataWithTimestamps = {
        ...(data as Record<string, unknown>),
        updatedAt: FieldValue.serverTimestamp(),
        ...(isNewDoc ? { createdAt: FieldValue.serverTimestamp() } : {}),
      };

      await docRef.set(dataWithTimestamps, { merge });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error setLikeClient ${collectionPath}/${docId}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Add a new document with auto-generated ID
   */
  static async add(collectionPath: string, data: Record<string, unknown>): Promise<string> {
    try {
      const docRef = await ensureAdminDb().collection(collectionPath).add(data);
      return docRef.id;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error adding document to ${collectionPath}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Update an existing document. Raw firebase-admin .update() semantics —
   * NO auto-timestamps. Existing admin callers rely on this behavior.
   *
   * When migrating a client-SDK FirestoreService.update call site, use
   * `updateLikeClient()` instead, which auto-stamps `updatedAt`.
   */
  static async update(
    collectionPath: string,
    docId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);
      await docRef.update(data);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error updating document ${collectionPath}/${docId}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Update with client-SDK FirestoreService.update semantics: auto-stamps
   * `updatedAt`. Use this when migrating a `FirestoreService.update(...)`
   * call to the admin SDK so behavior stays identical.
   */
  static async updateLikeClient(
    collectionPath: string,
    docId: string,
    data: Record<string, unknown>
  ): Promise<void> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);
      await docRef.update({
        ...data,
        updatedAt: FieldValue.serverTimestamp(),
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error updateLikeClient ${collectionPath}/${docId}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Batch write operations. Mirrors the client-SDK FirestoreService.batchWrite
   * shape so server callers can swap with no signature change. Auto-stamps
   * `updatedAt` on set/update entries.
   */
  static async batchWrite(operations: Array<{
    type: 'set' | 'update' | 'delete';
    collectionPath: string;
    docId: string;
    data?: Record<string, unknown>;
  }>): Promise<void> {
    const db = ensureAdminDb();
    const batch = db.batch();

    for (const op of operations) {
      const docRef = db.collection(op.collectionPath).doc(op.docId);

      if (op.type === 'set') {
        batch.set(docRef, {
          ...op.data,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (op.type === 'update') {
        batch.update(docRef, {
          ...op.data,
          updatedAt: FieldValue.serverTimestamp(),
        });
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    }

    await batch.commit();
  }

  /**
   * Delete a document
   */
  static async delete(collectionPath: string, docId: string): Promise<void> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);
      await docRef.delete();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`[Admin Firestore] Error deleting document ${collectionPath}/${docId}:`, error instanceof Error ? error : undefined, { file: 'admin-firestore-service.ts' });
      throw new Error(message);
    }
  }

  /**
   * Batch operations
   */
  static batch() {
    return ensureAdminDb().batch();
  }

  /**
   * Run a transaction
   */
  static async runTransaction<T>(
    updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>
  ): Promise<T> {
    return ensureAdminDb().runTransaction(updateFunction);
  }

  /**
   * Get a collection reference (for advanced queries)
   */
  static collection(path: string) {
    return ensureAdminDb().collection(path);
  }

  /**
   * Get a document reference
   */
  static doc(collectionPath: string, docId: string) {
    return ensureAdminDb().collection(collectionPath).doc(docId);
  }
}

// Export singleton instance
export default AdminFirestoreService;








