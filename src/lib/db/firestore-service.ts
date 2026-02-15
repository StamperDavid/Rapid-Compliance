/**
 * Firestore Service Layer
 * Centralized data access layer for all Firestore operations
 * Replaces localStorage usage throughout the application
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  query,
  limit,
  startAfter,
  onSnapshot,
  serverTimestamp,
  writeBatch,
  type QueryConstraint,
  type DocumentData,
  type QueryDocumentSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/config'
import { logger } from '../logger/logger';
import { PLATFORM_ID } from '../constants/platform';
import { getSubCollection, COLLECTIONS } from '../firebase/collections';

// Re-export for backward compatibility — all collection names come from firebase/collections.ts
export { COLLECTIONS };

// Helper to check if Firestore is available
function ensureFirestore() {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase first.');
  }
  return db;
}

/**
 * Generic CRUD operations
 */
export class FirestoreService {
  /**
   * Get a single document
   */
  static async get<T = DocumentData>(
    collectionPath: string,
    docId: string
  ): Promise<T | null> {
    if (!db) {
      logger.warn('Firestore is not initialized. Cannot get document.', { file: 'firestore-service.ts' });
      return null;
    }

    try {
      const docRef = doc(db, collectionPath, docId);
      const docSnap = await getDoc(docRef);
      
      if (docSnap.exists()) {
        return { id: docSnap.id, ...docSnap.data() } as T;
      }
      return null;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error getting document ${docId} from ${collectionPath}: ${message}`, error instanceof Error ? error : undefined, { file: 'firestore-service.ts' });
      return null; // Return null instead of throwing to prevent crashes
    }
  }

  /**
   * Get all documents from a collection
   * WARNING: This fetches ALL documents. Use getAllPaginated() for large collections.
   */
  static async getAll<T = DocumentData>(
    collectionPath: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    if (!db) {
      logger.warn('Firestore is not initialized. Cannot get documents.', { file: 'firestore-service.ts' });
      return [];
    }

    try {
      const q = query(collection(db, collectionPath), ...constraints);
      const querySnapshot = await getDocs(q);
      
      return querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error getting all documents from ${collectionPath}: ${message}`, error instanceof Error ? error : undefined, { file: 'firestore-service.ts' });
      return []; // Return empty array instead of throwing
    }
  }

  /**
   * Get documents with pagination
   */
  static async getAllPaginated<T = DocumentData>(
    collectionPath: string,
    constraints: QueryConstraint[] = [],
    pageSize: number = 50,
    lastDoc?: QueryDocumentSnapshot
  ): Promise<{
    data: T[];
    lastDoc: QueryDocumentSnapshot | null;
    hasMore: boolean;
  }> {
    if (!db) {
      logger.warn('Firestore is not initialized. Cannot get documents.', { file: 'firestore-service.ts' });
      return { data: [], lastDoc: null, hasMore: false };
    }

    try {
      // Add limit to constraints
      const paginatedConstraints = [
        ...constraints,
        limit(pageSize + 1), // Fetch one extra to check if there are more
      ];

      // Add startAfter if we have a lastDoc
      if (lastDoc) {
        paginatedConstraints.push(startAfter(lastDoc));
      }

      const q = query(collection(db, collectionPath), ...paginatedConstraints);
      const querySnapshot = await getDocs(q);
      
      const docs = querySnapshot.docs;
      const hasMore = docs.length > pageSize;
      
      // Remove the extra document if we have more
      const data = (hasMore ? docs.slice(0, pageSize) : docs).map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as T[];
      
      const newLastDoc = hasMore ? docs[pageSize - 1] : (docs.length > 0 ? docs[docs.length - 1] : null);

      return {
        data,
        lastDoc: newLastDoc,
        hasMore,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error getting paginated documents from ${collectionPath}: ${message}`, error instanceof Error ? error : undefined, { file: 'firestore-service.ts' });
      return { data: [], lastDoc: null, hasMore: false };
    }
  }

  /**
   * Create or update a document
   */
  static async set<T = DocumentData>(
    collectionPath: string,
    docId: string,
    data: Partial<T>,
    merge: boolean = true
  ): Promise<void> {
    const firestoreDb = ensureFirestore();

    try {
      const docRef = doc(firestoreDb, collectionPath, docId);
      const docSnap = merge ? await getDoc(docRef) : null;
      const isNewDoc = !docSnap?.exists();
      const dataWithTimestamps = {
        ...data,
        updatedAt: serverTimestamp(),
        ...(isNewDoc ? { createdAt: serverTimestamp() } : {}),
      };
      await setDoc(docRef, dataWithTimestamps, { merge });
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error setting document ${docId} in ${collectionPath}: ${message}`, error instanceof Error ? error : undefined, { file: 'firestore-service.ts' });
      throw error;
    }
  }

  /**
   * Update a document
   */
  static async update<T = DocumentData>(
    collectionPath: string,
    docId: string,
    data: Partial<T>
  ): Promise<void> {
    const firestoreDb = ensureFirestore();
    
    try {
      const docRef = doc(firestoreDb, collectionPath, docId);
      await updateDoc(docRef, {
        ...data,
        updatedAt: serverTimestamp(),
      } as Record<string, unknown>);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error updating document ${docId} in ${collectionPath}: ${message}`, error instanceof Error ? error : undefined, { file: 'firestore-service.ts' });
      throw error;
    }
  }

  /**
   * Delete a document
   */
  static async delete(collectionPath: string, docId: string): Promise<void> {
    const firestoreDb = ensureFirestore();
    
    try {
      const docRef = doc(firestoreDb, collectionPath, docId);
      await deleteDoc(docRef);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      logger.error(`Error deleting document ${docId} from ${collectionPath}: ${message}`, error instanceof Error ? error : undefined, { file: 'firestore-service.ts' });
      throw error;
    }
  }

  /**
   * Subscribe to a document (real-time updates)
   */
  static subscribe<T = DocumentData>(
    collectionPath: string,
    docId: string,
    callback: (data: T | null) => void
  ): () => void {
    if (!db) {
      logger.warn('Firestore is not initialized. Cannot subscribe to document.', { file: 'firestore-service.ts' });
      callback(null);
      return () => {}; // Return no-op unsubscribe
    }

    const docRef = doc(db, collectionPath, docId);
    
    return onSnapshot(
      docRef,
      (docSnap) => {
        if (docSnap.exists()) {
          callback({ id: docSnap.id, ...docSnap.data() } as T);
        } else {
          callback(null);
        }
      },
      (error) => {
        logger.error(`Error in subscription for ${docId} in ${collectionPath}:`, error, { file: 'firestore-service.ts' });
        callback(null);
      }
    );
  }

  /**
   * Subscribe to a collection query (real-time updates)
   */
  static subscribeToCollection<T = DocumentData>(
    collectionPath: string,
    constraints: QueryConstraint[],
    callback: (data: T[]) => void
  ): () => void {
    if (!db) {
      logger.warn('Firestore is not initialized. Cannot subscribe to collection.', { file: 'firestore-service.ts' });
      callback([]);
      return () => {}; // Return no-op unsubscribe
    }

    const q = query(collection(db, collectionPath), ...constraints);
    
    return onSnapshot(
      q,
      (querySnapshot) => {
        const data = querySnapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        })) as T[];
        callback(data);
      },
      (error) => {
        logger.error(`Error in collection subscription for ${collectionPath}:`, error, { file: 'firestore-service.ts' });
        callback([]);
      }
    );
  }

  /**
   * Batch write operations
   */
  static async batchWrite(operations: Array<{
    type: 'set' | 'update' | 'delete';
    collectionPath: string;
    docId: string;
    data?: Record<string, unknown>;
  }>): Promise<void> {
    const firestoreDb = ensureFirestore();
    const batch = writeBatch(firestoreDb);
    
    operations.forEach((op) => {
      const docRef = doc(firestoreDb, op.collectionPath, op.docId);
      
      if (op.type === 'set') {
        batch.set(docRef, {
          ...op.data,
          updatedAt: serverTimestamp(),
        });
      } else if (op.type === 'update') {
        batch.update(docRef, {
          ...op.data,
          updatedAt: serverTimestamp(),
        });
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    });
    
    await batch.commit();
  }
}

/**
 * Platform data operations (single-tenant root document)
 */
export class PlatformService {
  static async get() {
    return FirestoreService.get(
      COLLECTIONS.ORGANIZATIONS,
      PLATFORM_ID
    );
  }

  static async update(data: Record<string, unknown>) {
    return FirestoreService.update(
      COLLECTIONS.ORGANIZATIONS,
      PLATFORM_ID,
      data
    );
  }

  static subscribe(callback: (data: DocumentData | null) => void) {
    return FirestoreService.subscribe(
      COLLECTIONS.ORGANIZATIONS,
      PLATFORM_ID,
      callback
    );
  }
}

/**
 * Schema-specific operations
 */
export class SchemaService {
  static async get(schemaId: string) {
    return FirestoreService.get(
      getSubCollection('schemas'),
      schemaId
    );
  }

  static async getAll() {
    return FirestoreService.getAll(
      getSubCollection('schemas')
    );
  }

  static async set(schemaId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      getSubCollection('schemas'),
      schemaId,
      data,
      false
    );
  }

  static subscribe(schemaId: string, callback: (data: Record<string, unknown> | null) => void) {
    return FirestoreService.subscribe(
      getSubCollection('schemas'),
      schemaId,
      callback
    );
  }
}

/**
 * Record-specific operations (dynamic entities)
 * Path: organizations/{PLATFORM_ID}/{entityName}
 */
export class RecordService {
  static async get(entityName: string, recordId: string) {
    return FirestoreService.get(
      getSubCollection(entityName),
      recordId
    );
  }

  static async getAll(entityName: string, filters: QueryConstraint[] = []) {
    return FirestoreService.getAll(
      getSubCollection(entityName),
      filters
    );
  }

  /**
   * Get records with pagination
   * @param pageSize - Number of records per page (default 50, max 100)
   * @param lastDoc - Document snapshot to start after (for cursor pagination)
   */
  static async getAllPaginated(
    entityName: string,
    filters: QueryConstraint[] = [],
    pageSize: number = 50,
    lastDoc?: QueryDocumentSnapshot
  ) {
    return FirestoreService.getAllPaginated(
      getSubCollection(entityName),
      filters,
      Math.min(pageSize, 100),
      lastDoc
    );
  }

  static async set(entityName: string, recordId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      getSubCollection(entityName),
      recordId,
      data,
      false
    );
  }

  static async update(entityName: string, recordId: string, data: Record<string, unknown>) {
    return FirestoreService.update(
      getSubCollection(entityName),
      recordId,
      data
    );
  }

  static async delete(entityName: string, recordId: string) {
    return FirestoreService.delete(
      getSubCollection(entityName),
      recordId
    );
  }

  static subscribe(entityName: string, filters: QueryConstraint[], callback: (data: Record<string, unknown>[]) => void) {
    return FirestoreService.subscribeToCollection(
      getSubCollection(entityName),
      filters,
      callback
    );
  }
}

/**
 * Workflow-specific operations
 */
export class WorkflowService {
  static async get(workflowId: string) {
    return FirestoreService.get(
      getSubCollection('workflows'),
      workflowId
    );
  }

  static async getAll() {
    return FirestoreService.getAll(
      getSubCollection('workflows')
    );
  }

  /**
   * Get workflows with pagination
   */
  static async getAllPaginated(
    constraints: QueryConstraint[] = [],
    pageSize: number = 50,
    lastDoc?: QueryDocumentSnapshot
  ) {
    return FirestoreService.getAllPaginated(
      getSubCollection('workflows'),
      constraints,
      Math.min(pageSize, 100),
      lastDoc
    );
  }

  static async set(workflowId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      getSubCollection('workflows'),
      workflowId,
      data,
      false
    );
  }
}

/**
 * Email Campaign operations
 */
export class EmailCampaignService {
  static async get(campaignId: string) {
    return FirestoreService.get(
      getSubCollection('emailCampaigns'),
      campaignId
    );
  }

  static async getAll() {
    return FirestoreService.getAll(
      getSubCollection('emailCampaigns')
    );
  }

  /**
   * Get campaigns with pagination
   */
  static async getAllPaginated(
    constraints: QueryConstraint[] = [],
    pageSize: number = 50,
    lastDoc?: QueryDocumentSnapshot
  ) {
    return FirestoreService.getAllPaginated(
      getSubCollection('emailCampaigns'),
      constraints,
      Math.min(pageSize, 100),
      lastDoc
    );
  }

  static async set(campaignId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      getSubCollection('emailCampaigns'),
      campaignId,
      data,
      false
    );
  }
}

/**
 * Lead Nurturing operations
 */
export class LeadNurturingService {
  static async getSequence(sequenceId: string) {
    return FirestoreService.get(
      getSubCollection('nurtureSequences'),
      sequenceId
    );
  }

  static async getAllSequences() {
    return FirestoreService.getAll(
      getSubCollection('nurtureSequences')
    );
  }

  static async setSequence(sequenceId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      getSubCollection('nurtureSequences'),
      sequenceId,
      data,
      false
    );
  }

  static async getEnrichment(leadId: string) {
    return FirestoreService.get(
      getSubCollection('leadEnrichments'),
      leadId
    );
  }

  static async setEnrichment(leadId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      getSubCollection('leadEnrichments'),
      leadId,
      data,
      false
    );
  }
}
