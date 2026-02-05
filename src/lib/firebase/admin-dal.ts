/**
 * Admin Data Access Layer (Admin DAL)
 * Safe wrapper for all Firebase Admin SDK Firestore operations
 *
 * CRITICAL FEATURES:
 * - Automatic environment-aware collection naming
 * - Dry-run mode for testing
 * - Audit logging for compliance
 * - Production delete protection
 * - Organization-scoped access verification (coming soon)
 *
 * IMPORTANT: This is for server-side (API routes) only!
 * For client-side operations, use @/lib/firebase/dal
 */

import type {
  Firestore,
  CollectionReference,
  DocumentReference,
  DocumentData,
  WriteResult,
  DocumentSnapshot,
  QuerySnapshot} from 'firebase-admin/firestore';
import { adminDb } from '@/lib/firebase/admin';
import { COLLECTIONS, getOrgSubCollection, getPrefix } from './collections';
import { logger } from '@/lib/logger/logger';

interface WriteOptions {
  /** If true, logs the operation but doesn't execute it */
  dryRun?: boolean;
  /** If true, creates an audit log entry */
  audit?: boolean;
  /** User ID performing the operation (for audit trail) */
  userId?: string;
  /** Organization ID context (for access control) */
  organizationId?: string;
}

export class FirestoreAdminDAL {
  private db: Firestore;

  constructor(firestoreInstance: Firestore) {
    if (!firestoreInstance) {
      throw new Error('FirestoreAdminDAL requires a valid Firestore instance. Make sure Firebase Admin is initialized.');
    }
    this.db = firestoreInstance;
  }

  // ========================================
  // COLLECTION REFERENCES
  // ========================================

  /**
   * Get a collection reference with environment-aware naming
   * Usage: adminDal.getCollection('ORGANIZATIONS')
   */
  getCollection(collectionName: keyof typeof COLLECTIONS): CollectionReference {
    const name = COLLECTIONS[collectionName];
    return this.db.collection(name);
  }

  /**
   * Get an organization sub-collection reference
   * Usage: adminDal.getOrgCollection('records')
   *
   * PENTHOUSE MODEL: Uses DEFAULT_ORG_ID
   */
  getOrgCollection(subCollection: string): CollectionReference {
    const path = getOrgSubCollection(subCollection);
    return this.db.collection(path);
  }

  /**
   * Get a nested collection reference with a custom path
   * Usage: adminDal.getNestedCollection('organizations/{orgId}/ai-agents/default/config/persona', { orgId: 'org123' })
   * This is useful for deep nested collections that don't fit standard patterns
   */
  getNestedCollection(pathTemplate: string, params?: Record<string, string>): CollectionReference {
    let path = pathTemplate;

    // Replace parameters in path
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        path = path.replace(`{${key}}`, value);
      }
    }

    return this.db.collection(path);
  }

  /**
   * Get a nested document reference with a custom path
   * Usage: adminDal.getNestedDocRef('organizations/{orgId}/ai-agents/default/config/persona', { orgId: 'org123' })
   */
  getNestedDocRef(pathTemplate: string, params?: Record<string, string>): DocumentReference {
    let path = pathTemplate;

    // Replace parameters in path
    if (params) {
      for (const [key, value] of Object.entries(params)) {
        path = path.replace(`{${key}}`, value);
      }
    }

    return this.db.doc(path);
  }

  /**
   * Get a collection group reference (queries across all organizations)
   * Usage: adminDal.getCollectionGroup('website')
   * This queries all 'website' subcollections across all organizations
   */
  getCollectionGroup(collectionId: string) {
    return this.db.collectionGroup(collectionId);
  }

  /**
   * Get an environment-aware subcollection name
   * Helper method to apply prefix to any subcollection
   *
   * @param subCollectionName - Base subcollection name
   * @returns Prefixed subcollection name based on environment
   *
   * @example
   * adminDal.getSubColPath('website') // 'test_website' in dev, 'website' in prod
   */
  getSubColPath(subCollectionName: string): string {
    const prefix = getPrefix();
    return `${prefix}${subCollectionName}`;
  }

  // ========================================
  // SAFE WRITE OPERATIONS
  // ========================================

  /**
   * Safe setDoc with environment awareness and audit logging
   *
   * @example
   * await adminDal.safeSetDoc('ORGANIZATIONS', 'org123', {
   *   name: 'Acme Inc',
   *   createdAt: FieldValue.serverTimestamp()
   * }, { audit: true, userId: 'user123' });
   */
  async safeSetDoc<T extends DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    docId: string,
    data: T,
    options?: WriteOptions & { merge?: boolean }
  ): Promise<WriteResult | void> {
    const collectionRef = COLLECTIONS[collectionName];

    // Dry run mode - log without executing
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would write to Firestore (Admin)', {
        collection: collectionRef,
        docId,
        dataKeys: Object.keys(data as Record<string, unknown>).join(', '),
        merge: options?.merge,
        file: 'admin-dal.ts'
      });
      return;
    }

    // TODO: Add organization-scoped access check
    // if (options?.organizationId) {
    //   await this.verifyOrgAccess(options.userId, options.organizationId);
    // }

    const docRef = this.db.collection(collectionRef).doc(docId);

    logger.info('✍️ Writing to Firestore (Admin)', {
      collection: collectionRef,
      docId,
      env: process.env.NODE_ENV,
      userId: options?.userId,
      file: 'admin-dal.ts'
    });

    const writeResult = options?.merge
      ? await docRef.set(data, { merge: true })
      : await docRef.set(data);

    if (options?.audit) {
      this.logAudit('CREATE', collectionRef, docId, data as Record<string, unknown>, options?.userId);
    }

    return writeResult;
  }

  /**
   * Safe updateDoc with environment awareness and audit logging
   *
   * @example
   * await adminDal.safeUpdateDoc('ORGANIZATIONS', 'org123', {
   *   name: 'Updated Name',
   *   updatedAt: FieldValue.serverTimestamp()
   * }, { audit: true, userId: 'user123' });
   */
  async safeUpdateDoc<T extends DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    docId: string,
    data: Partial<T>,
    options?: WriteOptions
  ): Promise<WriteResult | void> {
    const collectionRef = COLLECTIONS[collectionName];

    // Dry run mode
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would update Firestore (Admin)', {
        collection: collectionRef,
        docId,
        dataKeys: Object.keys(data as Record<string, unknown>).join(', '),
        file: 'admin-dal.ts'
      });
      return;
    }

    const docRef = this.db.collection(collectionRef).doc(docId);

    logger.info('📝 Updating Firestore (Admin)', {
      collection: collectionRef,
      docId,
      env: process.env.NODE_ENV,
      userId: options?.userId,
      file: 'admin-dal.ts'
    });

    const writeResult = await docRef.update(data);

    if (options?.audit) {
      this.logAudit('UPDATE', collectionRef, docId, data as Record<string, unknown>, options?.userId);
    }

    return writeResult;
  }

  /**
   * Safe deleteDoc with environment awareness and production protection
   *
   * @example
   * await adminDal.safeDeleteDoc('ORGANIZATIONS', 'org123', {
   *   audit: true,
   *   userId: 'user123'
   * });
   */
  async safeDeleteDoc(
    collectionName: keyof typeof COLLECTIONS,
    docId: string,
    options?: WriteOptions
  ): Promise<WriteResult | void> {
    const collectionRef = COLLECTIONS[collectionName];

    // Dry run mode
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would delete from Firestore (Admin)', {
        collection: collectionRef,
        docId,
        file: 'admin-dal.ts'
      });
      return;
    }

    // CRITICAL: Production delete protection
    if (process.env.NODE_ENV === 'production' && !process.env.ALLOW_PROD_DELETES) {
      throw new Error(
        '🚨 Production deletes require ALLOW_PROD_DELETES=true environment variable. ' +
        'This is a safety measure to prevent accidental data loss.'
      );
    }

    const docRef = this.db.collection(collectionRef).doc(docId);

    logger.warn('🗑️ Deleting from Firestore (Admin)', {
      collection: collectionRef,
      docId,
      env: process.env.NODE_ENV,
      userId: options?.userId,
      file: 'admin-dal.ts'
    });

    const writeResult = await docRef.delete();

    if (options?.audit) {
      this.logAudit('DELETE', collectionRef, docId, {}, options?.userId);
    }

    return writeResult;
  }

  /**
   * Safe addDoc (auto-generated ID)
   *
   * @example
   * const docRef = await adminDal.safeAddDoc('LEADS', {
   *   email: 'john@example.com',
   *   createdAt: FieldValue.serverTimestamp()
   * }, { audit: true, userId: 'user123' });
   */
  async safeAddDoc<T extends DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    data: T,
    options?: WriteOptions
  ): Promise<DocumentReference> {
    const collectionRef = COLLECTIONS[collectionName];

    // Dry run mode
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would add to Firestore (Admin)', {
        collection: collectionRef,
        dataKeys: Object.keys(data as Record<string, unknown>).join(', '),
        file: 'admin-dal.ts'
      });
      // Return a fake doc ref in dry run mode
      return this.db.collection(collectionRef).doc('dry-run-doc-id');
    }

    const colRef = this.db.collection(collectionRef);

    logger.info('➕ Adding to Firestore (Admin)', {
      collection: collectionRef,
      env: process.env.NODE_ENV,
      userId: options?.userId,
      file: 'admin-dal.ts'
    });

    const docRef = await colRef.add(data);

    if (options?.audit) {
      this.logAudit('CREATE', collectionRef, docRef.id, data as Record<string, unknown>, options?.userId);
    }

    return docRef;
  }

  // ========================================
  // SAFE READ OPERATIONS
  // ========================================

  /**
   * Safe getDoc with logging
   */
  async safeGetDoc<T extends DocumentData = DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    docId: string
  ): Promise<DocumentSnapshot<T>> {
    const collectionRef = COLLECTIONS[collectionName];
    const docRef = this.db.collection(collectionRef).doc(docId);

    logger.debug('📖 Reading from Firestore (Admin)', {
      collection: collectionRef,
      docId,
      file: 'admin-dal.ts'
    });

    return await docRef.get() as DocumentSnapshot<T>;
  }

  /**
   * Safe getDocs with query support
   *
   * @example
   * const snapshot = await adminDal.safeGetDocs('ORGANIZATIONS');
   *
   * @example with query
   * const snapshot = await adminDal.safeGetDocs('ORGANIZATIONS', (ref) =>
   *   ref.where('status', '==', 'active').limit(10)
   * );
   */
  async safeGetDocs<T extends DocumentData = DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    queryFn?: (ref: CollectionReference) => FirebaseFirestore.Query
  ): Promise<QuerySnapshot<T>> {
    const collectionRef = COLLECTIONS[collectionName];
    const colRef = this.db.collection(collectionRef);

    logger.debug('📚 Querying Firestore (Admin)', {
      collection: collectionRef,
      hasQuery: !!queryFn,
      file: 'admin-dal.ts'
    });

    const query = queryFn ? queryFn(colRef) : colRef;
    return await query.get() as QuerySnapshot<T>;
  }

  /**
   * Safe query with direct query builder
   * Use this when you need more control over the query
   *
   * @example
   * const snapshot = await adminDal.safeQuery('ORGANIZATIONS', (ref) =>
   *   ref.where('tier', '==', 'tier1')
   *      .where('status', '==', 'active')
   *      .orderBy('createdAt', 'desc')
   *      .limit(10)
   * );
   */
  async safeQuery<T extends DocumentData = DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    queryFn: (ref: CollectionReference) => FirebaseFirestore.Query
  ): Promise<QuerySnapshot<T>> {
    return this.safeGetDocs<T>(collectionName, queryFn);
  }

  // ========================================
  // BATCH OPERATIONS
  // ========================================

  /**
   * Get a batch writer for multiple operations
   *
   * @example
   * const batch = adminDal.batch();
   * batch.set(adminDal.getCollection('ORGANIZATIONS').doc('org1'), { name: 'Org 1' });
   * batch.update(adminDal.getCollection('USERS').doc('user1'), { status: 'active' });
   * await batch.commit();
   */
  batch() {
    return this.db.batch();
  }

  /**
   * Run a transaction
   *
   * @example
   * await adminDal.runTransaction(async (transaction) => {
   *   const orgRef = adminDal.getCollection('ORGANIZATIONS').doc('org123');
   *   const orgDoc = await transaction.get(orgRef);
   *
   *   if (orgDoc.exists) {
   *     transaction.update(orgRef, { count: orgDoc.data().count + 1 });
   *   }
   * });
   */
  runTransaction<T>(
    updateFunction: (transaction: FirebaseFirestore.Transaction) => Promise<T>
  ) {
    return this.db.runTransaction(updateFunction);
  }

  // ========================================
  // AUDIT LOGGING
  // ========================================

  /**
   * Log an audit trail entry
   * In a production system, this would write to an audit log collection
   */
  private logAudit(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    collection: string,
    docId: string,
    data: Record<string, unknown>,
    userId?: string
  ): void {
    const auditEntry = {
      action,
      collection,
      docId,
      userId:(userId !== '' && userId != null) ? userId : 'system',
      timestamp: new Date().toISOString(),
      environment: process.env.NODE_ENV,
      // Only log data preview for sensitive operations
      dataPreview: action === 'DELETE' ? null : Object.keys(data).join(', ')
    };

    logger.info('📋 Audit Log (Admin)', auditEntry);

    // TODO: Implement actual audit log storage
    // await this.db.collection(COLLECTIONS.AUDIT_LOGS).add(auditEntry);
  }

  // ========================================
  // ACCESS CONTROL (Coming Soon)
  // ========================================

  /**
   * Verify that a user has access to an organization
   * This will be implemented as part of the security enhancement
   */
  private verifyOrgAccess(
    _userId: string | undefined,
    _organizationId: string
  ): void {
    // TODO: Implement organization-scoped access control
    // For now, just log the check
    logger.debug('🔒 Verifying org access (Admin)', {
      userId: _userId,
      organizationId: _organizationId,
      file: 'admin-dal.ts'
    });
  }

  // ========================================
  // ANALYTICS QUERY METHODS
  // ========================================

  /**
   * Get all workflows
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getAllWorkflows(_organizationId?: string): Promise<Array<Record<string, unknown>>> {
    const colRef = this.getOrgCollection('workflows');
    const snapshot = await colRef.get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get workflow executions in a date range
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getWorkflowExecutions(
    _organizationId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<Array<Record<string, unknown>>> {
    const colRef = this.getOrgCollection('workflowExecutions');
    const snapshot = await colRef
      .where('startedAt', '>=', startDate)
      .where('startedAt', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get email generations in a date range
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  getEmailGenerations(
    _organizationId: string | undefined,
    _startDate: Date,
    _endDate: Date
  ): Array<Record<string, unknown>> {
    // TODO: Query from email generation logs or Signal Bus events
    // For now, return empty array
    return [];
  }

  /**
   * Get all active deals
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getActiveDeals(_organizationId?: string): Promise<Array<Record<string, unknown>>> {
    const colRef = this.getOrgCollection('deals');
    const snapshot = await colRef
      .where('status', 'in', ['active', 'open', 'in_progress'])
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get deals snapshot at a specific date (for trend comparison)
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getDealsSnapshot(
    _organizationId: string | undefined,
    _snapshotDate: Date
  ): Promise<Array<Record<string, unknown>>> {
    // This would require historical snapshots
    // For now, return current active deals
    return this.getActiveDeals();
  }

  /**
   * Get closed deals in a date range
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getClosedDeals(
    _organizationId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<Array<Record<string, unknown>>> {
    const colRef = this.getOrgCollection('deals');
    const snapshot = await colRef
      .where('status', 'in', ['won', 'lost', 'closed'])
      .where('closedAt', '>=', startDate)
      .where('closedAt', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get won deals in a date range
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getWonDeals(
    _organizationId: string | undefined,
    startDate: Date,
    endDate: Date
  ): Promise<Array<Record<string, unknown>>> {
    const colRef = this.getOrgCollection('deals');
    const snapshot = await colRef
      .where('status', '==', 'won')
      .where('closedAt', '>=', startDate)
      .where('closedAt', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get revenue forecast
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getRevenueForecast(_organizationId?: string): Promise<Record<string, unknown> | null> {
    const docRef = this.getOrgCollection('forecasts').doc('current');
    const snapshot = await docRef.get();
    return snapshot.exists ? (snapshot.data() as Record<string, unknown>) : null;
  }

  /**
   * Get sales reps
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getSalesReps(_organizationId?: string): Promise<Array<Record<string, unknown>>> {
    const colRef = this.getOrgCollection('users');
    const snapshot = await colRef
      .where('role', '==', 'sales')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }

  /**
   * Get deals for a specific rep in a date range
   *
   * PENTHOUSE MODEL: organizationId parameter retained for API compatibility
   * but is ignored (uses DEFAULT_ORG_ID internally)
   */
  async getRepDeals(
    _organizationId: string | undefined,
    repId: string,
    startDate: Date,
    endDate: Date
  ): Promise<Array<Record<string, unknown>>> {
    const colRef = this.getOrgCollection('deals');
    const snapshot = await colRef
      .where('ownerId', '==', repId)
      .where('createdAt', '>=', startDate)
      .where('createdAt', '<=', endDate)
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

/**
 * Singleton Admin DAL instance
 * Import this in your API routes: import { adminDal } from '@/lib/firebase/admin-dal'
 *
 * IMPORTANT: Only use this on the server-side (API routes, server actions)
 * For client-side operations, use @/lib/firebase/dal
 */
export const adminDal = adminDb ? new FirestoreAdminDAL(adminDb) : null;

/**
 * Export the class for custom instances if needed
 */
export default FirestoreAdminDAL;
