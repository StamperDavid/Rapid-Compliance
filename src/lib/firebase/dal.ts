/**
 * Data Access Layer (DAL)
 * Safe wrapper for all Firestore operations with environment awareness
 *
 * CRITICAL FEATURES:
 * - Automatic environment-aware collection naming
 * - Dry-run mode for testing
 * - Audit logging for compliance
 * - Production delete protection
 * - Organization-scoped access verification (coming soon)
 */

import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  getDoc,
  getDocs,
  query,
  type DocumentReference,
  type CollectionReference,
  type Firestore,
  type QueryConstraint,
  type SetOptions,
  type WithFieldValue,
  type DocumentData,
  type UpdateData
} from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { COLLECTIONS, getOrgSubCollection } from './collections';
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

export class FirestoreDAL {
  private db: Firestore;

  constructor(firestoreInstance: Firestore) {
    this.db = firestoreInstance;
  }

  // ========================================
  // COLLECTION REFERENCES
  // ========================================

  /**
   * Get a collection reference with environment-aware naming
   * Usage: dal.getCollection('ORGANIZATIONS')
   */
  getCollection(collectionName: keyof typeof COLLECTIONS): CollectionReference {
    const name = COLLECTIONS[collectionName];
    return collection(this.db, name);
  }

  /**
   * Get an organization sub-collection reference
   * Usage: dal.getOrgCollection('records')
   *
   * PENTHOUSE MODEL: Uses DEFAULT_ORG_ID
   */
  getOrgCollection(subCollection: string): CollectionReference {
    const path = getOrgSubCollection(subCollection);
    return collection(this.db, path);
  }

  // ========================================
  // SAFE WRITE OPERATIONS
  // ========================================

  /**
   * Safe setDoc with environment awareness and audit logging
   *
   * @example
   * await dal.safeSetDoc('ORGANIZATIONS', 'org123', {
   *   name: 'Acme Inc',
   *   createdAt: serverTimestamp()
   * }, { audit: true, userId: 'user123' });
   */
  async safeSetDoc<T extends DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    docId: string,
    data: WithFieldValue<T>,
    options?: WriteOptions & { merge?: boolean }
  ): Promise<void> {
    const collectionRef = COLLECTIONS[collectionName];

    // Dry run mode - log without executing
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would write to Firestore', {
        collection: collectionRef,
        docId,
        dataKeys: Object.keys(data as Record<string, unknown>).join(', '),
        merge: options?.merge,
        file: 'dal.ts'
      });
      return;
    }

    // TODO: Add organization-scoped access check
    // if (options?.organizationId) {
    //   await this.verifyOrgAccess(options.userId, options.organizationId);
    // }

    const docRef = doc(this.db, collectionRef, docId) as DocumentReference<T>;

    logger.info('✍️ Writing to Firestore', {
      collection: collectionRef,
      docId,
      env: process.env.NODE_ENV,
      userId: options?.userId,
      file: 'dal.ts'
    });

    const setOptions: SetOptions = options?.merge ? { merge: true } : {};
    await setDoc(docRef, data, setOptions);

    if (options?.audit) {
      this.logAudit('CREATE', collectionRef, docId, data as Record<string, unknown>, options?.userId);
    }
  }

  /**
   * Safe updateDoc with environment awareness and audit logging
   *
   * @example
   * await dal.safeUpdateDoc('ORGANIZATIONS', 'org123', {
   *   name: 'Updated Name',
   *   updatedAt: serverTimestamp()
   * }, { audit: true, userId: 'user123' });
   */
  async safeUpdateDoc<T extends DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    docId: string,
    data: UpdateData<T>,
    options?: WriteOptions
  ): Promise<void> {
    const collectionRef = COLLECTIONS[collectionName];

    // Dry run mode
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would update Firestore', {
        collection: collectionRef,
        docId,
        dataKeys: Object.keys(data as Record<string, unknown>).join(', '),
        file: 'dal.ts'
      });
      return;
    }

    const docRef = doc(this.db, collectionRef, docId) as DocumentReference<T>;

    logger.info('📝 Updating Firestore', {
      collection: collectionRef,
      docId,
      env: process.env.NODE_ENV,
      userId: options?.userId,
      file: 'dal.ts'
    });

    await updateDoc(docRef, data);

    if (options?.audit) {
      this.logAudit('UPDATE', collectionRef, docId, data as Record<string, unknown>, options?.userId);
    }
  }

  /**
   * Safe deleteDoc with environment awareness and production protection
   *
   * @example
   * await dal.safeDeleteDoc('ORGANIZATIONS', 'org123', {
   *   audit: true,
   *   userId: 'user123'
   * });
   */
  async safeDeleteDoc(
    collectionName: keyof typeof COLLECTIONS,
    docId: string,
    options?: WriteOptions
  ): Promise<void> {
    const collectionRef = COLLECTIONS[collectionName];

    // Dry run mode
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would delete from Firestore', {
        collection: collectionRef,
        docId,
        file: 'dal.ts'
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

    const docRef = doc(this.db, collectionRef, docId);

    logger.warn('🗑️ Deleting from Firestore', {
      collection: collectionRef,
      docId,
      env: process.env.NODE_ENV,
      userId: options?.userId,
      file: 'dal.ts'
    });

    await deleteDoc(docRef);

    if (options?.audit) {
      this.logAudit('DELETE', collectionRef, docId, {}, options?.userId);
    }
  }

  /**
   * Safe addDoc (auto-generated ID)
   *
   * @example
   * const docRef = await dal.safeAddDoc('LEADS', {
   *   email: 'john@example.com',
   *   createdAt: serverTimestamp()
   * }, { audit: true, userId: 'user123' });
   */
  async safeAddDoc<T extends DocumentData>(
    collectionName: keyof typeof COLLECTIONS,
    data: WithFieldValue<T>,
    options?: WriteOptions
  ): Promise<DocumentReference> {
    const collectionRef = COLLECTIONS[collectionName];

    // Dry run mode
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would add to Firestore', {
        collection: collectionRef,
        dataKeys: Object.keys(data as Record<string, unknown>).join(', '),
        file: 'dal.ts'
      });
      // Return a fake doc ref in dry run mode
      return doc(this.db, collectionRef, 'dry-run-doc-id');
    }

    const colRef = collection(this.db, collectionRef);

    logger.info('➕ Adding to Firestore', {
      collection: collectionRef,
      env: process.env.NODE_ENV,
      userId: options?.userId,
      file: 'dal.ts'
    });

    const docRef = await addDoc(colRef, data);

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
  async safeGetDoc(
    collectionName: keyof typeof COLLECTIONS,
    docId: string
  ) {
    const collectionRef = COLLECTIONS[collectionName];
    const docRef = doc(this.db, collectionRef, docId);

    logger.debug('📖 Reading from Firestore', {
      collection: collectionRef,
      docId,
      file: 'dal.ts'
    });

    return getDoc(docRef);
  }

  /**
   * Safe getDocs with query support
   */
  async safeGetDocs(
    collectionName: keyof typeof COLLECTIONS,
    ...queryConstraints: QueryConstraint[]
  ) {
    const collectionRef = COLLECTIONS[collectionName];
    const colRef = collection(this.db, collectionRef);

    logger.debug('📚 Querying Firestore', {
      collection: collectionRef,
      constraints: queryConstraints.length,
      file: 'dal.ts'
    });

    const q = query(colRef, ...queryConstraints);
    return getDocs(q);
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

    logger.info('📋 Audit Log', auditEntry);

    // TODO: Implement actual audit log storage
    // await addDoc(collection(this.db, COLLECTIONS.AUDIT_LOGS), auditEntry);
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
    logger.debug('🔒 Verifying org access', {
      userId: _userId,
      organizationId: _organizationId,
      file: 'dal.ts'
    });
  }
}

// ========================================
// SINGLETON INSTANCE
// ========================================

/**
 * Singleton DAL instance
 * Import this in your services: import { dal } from '@/lib/firebase/dal'
 */
// Type guard to ensure db is not null
if (!db) {
  throw new Error('Firestore instance is not initialized. Check Firebase configuration.');
}
export const dal = new FirestoreDAL(db);

/**
 * Export the class for custom instances if needed
 */
export default FirestoreDAL;
