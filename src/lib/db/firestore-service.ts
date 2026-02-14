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

// ============================================================================
// Path Builders — single-tenant platform paths
// ============================================================================

/** Platform root path for sub-collections */
function platformPath(subPath: string): string {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${subPath}`;
}

/** Workspace-scoped collection path */
function workspacePath(workspaceId: string, subPath: string): string {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${subPath}`;
}

/** Entity records collection path */
function entityRecordsPath(workspaceId: string, entityName: string): string {
  return `${COLLECTIONS.ORGANIZATIONS}/${PLATFORM_ID}/${COLLECTIONS.WORKSPACES}/${workspaceId}/entities/${entityName}/${COLLECTIONS.RECORDS}`;
}

// Helper to check if Firestore is available
function ensureFirestore() {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase first.');
  }
  return db;
}

// Collection names following penthouse structure
export const COLLECTIONS = {
  ORGANIZATIONS: 'organizations',
  WORKSPACES: 'workspaces',
  USERS: 'users',
  SCHEMAS: 'schemas',
  RECORDS: 'records',
  BASE_MODELS: 'baseModels', // AI agent base configuration (editable, before Golden Master)
  GOLDEN_MASTERS: 'goldenMasters', // Versioned snapshots of trained Base Models
  CUSTOMER_MEMORIES: 'customerMemories',
  WORKFLOWS: 'workflows',
  EMAIL_CAMPAIGNS: 'emailCampaigns',
  NURTURE_SEQUENCES: 'nurtureSequences',
  LEAD_ENRICHMENTS: 'leadEnrichments',
  LEAD_ACTIVITIES: 'leadActivities',
  LEAD_SEGMENTS: 'leadSegments',
  API_KEYS: 'apiKeys',
  THEMES: 'themes',
  INTEGRATIONS: 'integrations',
  SUBSCRIPTION_PLANS: 'subscriptionPlans',
  CUSTOMER_SUBSCRIPTIONS: 'customerSubscriptions',
  GOLDEN_PLAYBOOKS: 'goldenPlaybooks',
  SOCIAL_CORRECTIONS: 'socialCorrections',
} as const;

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
 * Workspace-specific operations
 */
export class WorkspaceService {
  static async get(workspaceId: string) {
    return FirestoreService.get(
      platformPath(COLLECTIONS.WORKSPACES),
      workspaceId
    );
  }

  static async getAll() {
    return FirestoreService.getAll(
      platformPath(COLLECTIONS.WORKSPACES)
    );
  }

  static async set(workspaceId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      platformPath(COLLECTIONS.WORKSPACES),
      workspaceId,
      data,
      false
    );
  }

  static subscribe(workspaceId: string, callback: (data: Record<string, unknown> | null) => void) {
    return FirestoreService.subscribe(
      platformPath(COLLECTIONS.WORKSPACES),
      workspaceId,
      callback
    );
  }
}

/**
 * Schema-specific operations
 */
export class SchemaService {
  static async get(workspaceId: string, schemaId: string) {
    return FirestoreService.get(
      workspacePath(workspaceId, COLLECTIONS.SCHEMAS),
      schemaId
    );
  }

  static async getAll(workspaceId: string) {
    return FirestoreService.getAll(
      workspacePath(workspaceId, COLLECTIONS.SCHEMAS)
    );
  }

  static async set(workspaceId: string, schemaId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      workspacePath(workspaceId, COLLECTIONS.SCHEMAS),
      schemaId,
      data,
      false
    );
  }

  static subscribe(workspaceId: string, schemaId: string, callback: (data: Record<string, unknown> | null) => void) {
    return FirestoreService.subscribe(
      workspacePath(workspaceId, COLLECTIONS.SCHEMAS),
      schemaId,
      callback
    );
  }
}

/**
 * Record-specific operations (dynamic entities)
 * Path: organizations/{PLATFORM_ID}/workspaces/{workspaceId}/entities/{entityName}/records
 */
export class RecordService {
  private static getCollectionPath(workspaceId: string, entityName: string): string {
    return entityRecordsPath(workspaceId, entityName);
  }

  static async get(workspaceId: string, entityName: string, recordId: string) {
    return FirestoreService.get(
      entityRecordsPath(workspaceId, entityName),
      recordId
    );
  }

  static async getAll(workspaceId: string, entityName: string, filters: QueryConstraint[] = []) {
    return FirestoreService.getAll(
      entityRecordsPath(workspaceId, entityName),
      filters
    );
  }

  /**
   * Get records with pagination
   * @param pageSize - Number of records per page (default 50, max 100)
   * @param lastDoc - Document snapshot to start after (for cursor pagination)
   */
  static async getAllPaginated(
    workspaceId: string,
    entityName: string,
    filters: QueryConstraint[] = [],
    pageSize: number = 50,
    lastDoc?: QueryDocumentSnapshot
  ) {
    return FirestoreService.getAllPaginated(
      entityRecordsPath(workspaceId, entityName),
      filters,
      Math.min(pageSize, 100), // Enforce max page size
      lastDoc
    );
  }

  static async set(workspaceId: string, entityName: string, recordId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      entityRecordsPath(workspaceId, entityName),
      recordId,
      data,
      false
    );
  }

  static async update(workspaceId: string, entityName: string, recordId: string, data: Record<string, unknown>) {
    return FirestoreService.update(
      entityRecordsPath(workspaceId, entityName),
      recordId,
      data
    );
  }

  static async delete(workspaceId: string, entityName: string, recordId: string) {
    return FirestoreService.delete(
      entityRecordsPath(workspaceId, entityName),
      recordId
    );
  }

  static subscribe(workspaceId: string, entityName: string, filters: QueryConstraint[], callback: (data: Record<string, unknown>[]) => void) {
    return FirestoreService.subscribeToCollection(
      entityRecordsPath(workspaceId, entityName),
      filters,
      callback
    );
  }
}

/**
 * Workflow-specific operations
 */
export class WorkflowService {
  static async get(workspaceId: string, workflowId: string) {
    return FirestoreService.get(
      workspacePath(workspaceId, COLLECTIONS.WORKFLOWS),
      workflowId
    );
  }

  static async getAll(workspaceId: string) {
    return FirestoreService.getAll(
      workspacePath(workspaceId, COLLECTIONS.WORKFLOWS)
    );
  }

  /**
   * Get workflows with pagination
   */
  static async getAllPaginated(
    workspaceId: string,
    constraints: QueryConstraint[] = [],
    pageSize: number = 50,
    lastDoc?: QueryDocumentSnapshot
  ) {
    return FirestoreService.getAllPaginated(
      workspacePath(workspaceId, COLLECTIONS.WORKFLOWS),
      constraints,
      Math.min(pageSize, 100),
      lastDoc
    );
  }

  static async set(workspaceId: string, workflowId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      workspacePath(workspaceId, COLLECTIONS.WORKFLOWS),
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
      platformPath(COLLECTIONS.EMAIL_CAMPAIGNS),
      campaignId
    );
  }

  static async getAll() {
    return FirestoreService.getAll(
      platformPath(COLLECTIONS.EMAIL_CAMPAIGNS)
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
      platformPath(COLLECTIONS.EMAIL_CAMPAIGNS),
      constraints,
      Math.min(pageSize, 100),
      lastDoc
    );
  }

  static async set(campaignId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      platformPath(COLLECTIONS.EMAIL_CAMPAIGNS),
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
      platformPath(COLLECTIONS.NURTURE_SEQUENCES),
      sequenceId
    );
  }

  static async getAllSequences() {
    return FirestoreService.getAll(
      platformPath(COLLECTIONS.NURTURE_SEQUENCES)
    );
  }

  static async setSequence(sequenceId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      platformPath(COLLECTIONS.NURTURE_SEQUENCES),
      sequenceId,
      data,
      false
    );
  }

  static async getEnrichment(leadId: string) {
    return FirestoreService.get(
      platformPath(COLLECTIONS.LEAD_ENRICHMENTS),
      leadId
    );
  }

  static async setEnrichment(leadId: string, data: Record<string, unknown>) {
    return FirestoreService.set(
      platformPath(COLLECTIONS.LEAD_ENRICHMENTS),
      leadId,
      data,
      false
    );
  }
}
