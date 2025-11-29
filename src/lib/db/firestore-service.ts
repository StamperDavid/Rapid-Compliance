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
  where,
  orderBy,
  limit,
  startAfter,
  onSnapshot,
  Timestamp,
  serverTimestamp,
  writeBatch,
  QueryConstraint,
  DocumentData,
  QueryDocumentSnapshot,
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';

// Helper to check if Firestore is available
function ensureFirestore() {
  if (!db) {
    throw new Error('Firestore is not initialized. Please configure Firebase first.');
  }
  return db;
}

// Collection names following multi-tenant structure
const COLLECTIONS = {
  ORGANIZATIONS: 'organizations',
  WORKSPACES: 'workspaces',
  USERS: 'users',
  SCHEMAS: 'schemas',
  RECORDS: 'records',
  GOLDEN_MASTERS: 'goldenMasters',
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
      console.warn('Firestore is not initialized. Cannot get document.');
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
      console.error(`Error getting document ${docId} from ${collectionPath}:`, error);
      return null; // Return null instead of throwing to prevent crashes
    }
  }

  /**
   * Get all documents from a collection
   */
  static async getAll<T = DocumentData>(
    collectionPath: string,
    constraints: QueryConstraint[] = []
  ): Promise<T[]> {
    if (!db) {
      console.warn('Firestore is not initialized. Cannot get documents.');
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
      console.error(`Error getting all documents from ${collectionPath}:`, error);
      return []; // Return empty array instead of throwing
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
      const dataWithTimestamps = {
        ...data,
        updatedAt: serverTimestamp(),
        ...(merge ? {} : { createdAt: serverTimestamp() }),
      };
      await setDoc(docRef, dataWithTimestamps, { merge });
    } catch (error) {
      console.error(`Error setting document ${docId} in ${collectionPath}:`, error);
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
      } as any);
    } catch (error) {
      console.error(`Error updating document ${docId} in ${collectionPath}:`, error);
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
      console.error(`Error deleting document ${docId} from ${collectionPath}:`, error);
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
      console.warn('Firestore is not initialized. Cannot subscribe to document.');
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
        console.error(`Error in subscription for ${docId} in ${collectionPath}:`, error);
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
      console.warn('Firestore is not initialized. Cannot subscribe to collection.');
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
        console.error(`Error in collection subscription for ${collectionPath}:`, error);
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
    data?: any;
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
 * Organization-specific operations
 */
export class OrganizationService {
  static async get(orgId: string) {
    return FirestoreService.get(
      COLLECTIONS.ORGANIZATIONS,
      orgId
    );
  }

  static async getAll() {
    return FirestoreService.getAll(COLLECTIONS.ORGANIZATIONS);
  }

  static async set(orgId: string, data: any) {
    return FirestoreService.set(
      COLLECTIONS.ORGANIZATIONS,
      orgId,
      data,
      false
    );
  }

  static async update(orgId: string, data: any) {
    return FirestoreService.update(
      COLLECTIONS.ORGANIZATIONS,
      orgId,
      data
    );
  }

  static subscribe(orgId: string, callback: (data: any) => void) {
    return FirestoreService.subscribe(
      COLLECTIONS.ORGANIZATIONS,
      orgId,
      callback
    );
  }
}

/**
 * Workspace-specific operations
 */
export class WorkspaceService {
  static async get(orgId: string, workspaceId: string) {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}`,
      workspaceId
    );
  }

  static async getAll(orgId: string) {
    return FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}`
    );
  }

  static async set(orgId: string, workspaceId: string, data: any) {
    return FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}`,
      workspaceId,
      data,
      false
    );
  }

  static subscribe(orgId: string, workspaceId: string, callback: (data: any) => void) {
    return FirestoreService.subscribe(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}`,
      workspaceId,
      callback
    );
  }
}

/**
 * Schema-specific operations
 */
export class SchemaService {
  static async get(orgId: string, workspaceId: string, schemaId: string) {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
      schemaId
    );
  }

  static async getAll(orgId: string, workspaceId: string) {
    return FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`
    );
  }

  static async set(orgId: string, workspaceId: string, schemaId: string, data: any) {
    return FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
      schemaId,
      data,
      false
    );
  }

  static subscribe(orgId: string, workspaceId: string, schemaId: string, callback: (data: any) => void) {
    return FirestoreService.subscribe(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.SCHEMAS}`,
      schemaId,
      callback
    );
  }
}

/**
 * Record-specific operations (dynamic entities)
 */
export class RecordService {
  static async get(orgId: string, workspaceId: string, entityName: string, recordId: string) {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.RECORDS}/${entityName}`,
      recordId
    );
  }

  static async getAll(orgId: string, workspaceId: string, entityName: string, filters: QueryConstraint[] = []) {
    return FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.RECORDS}/${entityName}`,
      filters
    );
  }

  static async set(orgId: string, workspaceId: string, entityName: string, recordId: string, data: any) {
    return FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.RECORDS}/${entityName}`,
      recordId,
      data,
      false
    );
  }

  static async update(orgId: string, workspaceId: string, entityName: string, recordId: string, data: any) {
    return FirestoreService.update(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.RECORDS}/${entityName}`,
      recordId,
      data
    );
  }

  static async delete(orgId: string, workspaceId: string, entityName: string, recordId: string) {
    return FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.RECORDS}/${entityName}`,
      recordId
    );
  }

  static subscribe(orgId: string, workspaceId: string, entityName: string, filters: QueryConstraint[], callback: (data: any[]) => void) {
    return FirestoreService.subscribeToCollection(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.RECORDS}/${entityName}`,
      filters,
      callback
    );
  }
}

/**
 * Workflow-specific operations
 */
export class WorkflowService {
  static async get(orgId: string, workspaceId: string, workflowId: string) {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.WORKFLOWS}`,
      workflowId
    );
  }

  static async getAll(orgId: string, workspaceId: string) {
    return FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.WORKFLOWS}`
    );
  }

  static async set(orgId: string, workspaceId: string, workflowId: string, data: any) {
    return FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.WORKSPACES}/${workspaceId}/${COLLECTIONS.WORKFLOWS}`,
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
  static async get(orgId: string, campaignId: string) {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.EMAIL_CAMPAIGNS}`,
      campaignId
    );
  }

  static async getAll(orgId: string) {
    return FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.EMAIL_CAMPAIGNS}`
    );
  }

  static async set(orgId: string, campaignId: string, data: any) {
    return FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.EMAIL_CAMPAIGNS}`,
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
  static async getSequence(orgId: string, sequenceId: string) {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.NURTURE_SEQUENCES}`,
      sequenceId
    );
  }

  static async getAllSequences(orgId: string) {
    return FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.NURTURE_SEQUENCES}`
    );
  }

  static async setSequence(orgId: string, sequenceId: string, data: any) {
    return FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.NURTURE_SEQUENCES}`,
      sequenceId,
      data,
      false
    );
  }

  static async getEnrichment(orgId: string, leadId: string) {
    return FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.LEAD_ENRICHMENTS}`,
      leadId
    );
  }

  static async setEnrichment(orgId: string, leadId: string, data: any) {
    return FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${orgId}/${COLLECTIONS.LEAD_ENRICHMENTS}`,
      leadId,
      data,
      false
    );
  }
}

// Export collection names for use in other files
export { COLLECTIONS };

