/**
 * Admin Firestore Service
 * Server-side only - uses Firebase Admin SDK to bypass security rules
 * Use this for privileged operations in API routes
 */

import { adminDb } from '@/lib/firebase/admin'
import { logger } from '@/lib/logger/logger';
import type {
  QueryConstraint,
} from 'firebase/firestore';

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
   * Get a single document by ID
   */
  static async get(collectionPath: string, docId: string): Promise<FirestoreDocument | null> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);
      const doc = await docRef.get();
      
      if (!doc.exists) {
        return null;
      }
      
      return {
        id: doc.id,
        ...doc.data(),
      };
    } catch (error) {
      logger.error('[Admin Firestore] Error getting document ${collectionPath}/${docId}:', error, { file: 'admin-firestore-service.ts' });
      throw error;
    }
  }

  /**
   * Get all documents in a collection with optional filters
   */
  static async getAll(
    collectionPath: string,
    constraints: QueryConstraint[] = []
  ): Promise<FirestoreDocument[]> {
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
      }));
    } catch (error) {
      logger.error('[Admin Firestore] Error getting documents from ${collectionPath}:', error, { file: 'admin-firestore-service.ts' });
      throw error;
    }
  }

  /**
   * Get documents with pagination
   */
  static async getAllPaginated(
    collectionPath: string,
    constraints: QueryConstraint[] = [],
    pageSize: number = 50,
    lastDoc?: FirebaseFirestore.QueryDocumentSnapshot
  ): Promise<{
    data: FirestoreDocument[];
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
      }));
      
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
      logger.error('[Admin Firestore] Error getting paginated documents from ${collectionPath}:', error, { file: 'admin-firestore-service.ts' });
      throw error;
    }
  }

  /**
   * Set/create a document (creates if doesn't exist)
   */
  static async set(
    collectionPath: string,
    docId: string,
    data: Record<string, unknown>,
    merge: boolean = false
  ): Promise<void> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);
      
      if (merge) {
        await docRef.set(data, { merge: true });
      } else {
        await docRef.set(data);
      }
    } catch (error) {
      logger.error('[Admin Firestore] Error setting document ${collectionPath}/${docId}:', error, { file: 'admin-firestore-service.ts' });
      throw error;
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
      logger.error('[Admin Firestore] Error adding document to ${collectionPath}:', error, { file: 'admin-firestore-service.ts' });
      throw error;
    }
  }

  /**
   * Update an existing document
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
      logger.error('[Admin Firestore] Error updating document ${collectionPath}/${docId}:', error, { file: 'admin-firestore-service.ts' });
      throw error;
    }
  }

  /**
   * Delete a document
   */
  static async delete(collectionPath: string, docId: string): Promise<void> {
    try {
      const docRef = ensureAdminDb().collection(collectionPath).doc(docId);
      await docRef.delete();
    } catch (error) {
      logger.error('[Admin Firestore] Error deleting document ${collectionPath}/${docId}:', error, { file: 'admin-firestore-service.ts' });
      throw error;
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








