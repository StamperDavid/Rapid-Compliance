/**
 * Admin Firestore Service
 * Server-side only - uses Firebase Admin SDK to bypass security rules
 * Use this for privileged operations in API routes
 */

import { adminDb } from '@/lib/firebase/admin'
import { logger } from '@/lib/logger/logger';;
import type { 
  QueryConstraint, 
  DocumentData, 
  WhereFilterOp,
  OrderByDirection,
} from 'firebase/firestore';

export class AdminFirestoreService {
  /**
   * Get a single document by ID
   */
  static async get(collectionPath: string, docId: string): Promise<any | null> {
    try {
      const docRef = adminDb.collection(collectionPath).doc(docId);
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
  ): Promise<any[]> {
    try {
      let query: FirebaseFirestore.Query = adminDb.collection(collectionPath);
      
      // Apply constraints (where, orderBy, limit)
      for (const constraint of constraints) {
        const constraintData = constraint as any;
        
        if (constraintData.type === 'where') {
          query = query.where(
            constraintData.fieldPath,
            constraintData.opStr as FirebaseFirestore.WhereFilterOp,
            constraintData.value
          );
        } else if (constraintData.type === 'orderBy') {
          query = query.orderBy(
            constraintData.fieldPath,
            constraintData.directionStr as FirebaseFirestore.OrderByDirection
          );
        } else if (constraintData.type === 'limit') {
          query = query.limit(constraintData.limit);
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
   * Set/create a document (creates if doesn't exist)
   */
  static async set(
    collectionPath: string,
    docId: string,
    data: any,
    merge: boolean = false
  ): Promise<void> {
    try {
      const docRef = adminDb.collection(collectionPath).doc(docId);
      
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
  static async add(collectionPath: string, data: any): Promise<string> {
    try {
      const docRef = await adminDb.collection(collectionPath).add(data);
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
    data: any
  ): Promise<void> {
    try {
      const docRef = adminDb.collection(collectionPath).doc(docId);
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
      const docRef = adminDb.collection(collectionPath).doc(docId);
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
    return adminDb.batch();
  }

  /**
   * Run a transaction
   */
  static async runTransaction<T>(
    updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>
  ): Promise<T> {
    return adminDb.runTransaction(updateFunction);
  }

  /**
   * Get a collection reference (for advanced queries)
   */
  static collection(path: string) {
    return adminDb.collection(path);
  }

  /**
   * Get a document reference
   */
  static doc(collectionPath: string, docId: string) {
    return adminDb.collection(collectionPath).doc(docId);
  }
}

// Export singleton instance
export default AdminFirestoreService;






