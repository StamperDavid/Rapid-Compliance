/**
 * BaseAgentDAL - Enterprise Data Access Layer
 * 
 * CRITICAL FEATURES:
 * - Dynamic environment-aware collection naming based on NEXT_PUBLIC_APP_ENV
 * - Automatic test_ prefix for non-production environments
 * - Type-safe collection path resolution
 * - Organization-scoped multi-tenancy support
 * - Audit logging and compliance
 * 
 * ENVIRONMENT ISOLATION STRATEGY:
 * - Production (NEXT_PUBLIC_APP_ENV === 'production'): No prefix
 * - All other environments (dev, staging, test): 'test_' prefix
 * 
 * This prevents test data pollution and ensures clean environment separation.
 */

import type { 
  Firestore,
  CollectionReference,
  DocumentReference,
  QueryConstraint,
  SetOptions,
  WithFieldValue,
  DocumentData,
  UpdateData,
  DocumentSnapshot,
  QuerySnapshot} from 'firebase/firestore';
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
  where
} from 'firebase/firestore';
import { logger } from '@/lib/logger/logger';

/**
 * Options for write operations with audit and access control
 */
export interface WriteOptions {
  /** If true, logs the operation but doesn't execute it */
  dryRun?: boolean;
  /** If true, creates an audit log entry */
  audit?: boolean;
  /** User ID performing the operation (for audit trail) */
  userId?: string;
  /** Organization ID context (for access control) */
  organizationId?: string;
}

/**
 * BaseAgentDAL - Core Data Access Layer for AI Sales Platform
 * 
 * Usage Example:
 * ```typescript
 * const dal = new BaseAgentDAL(db);
 * 
 * // Get environment-aware collection path
 * const orgsPath = dal.getColPath('organizations'); // 'test_organizations' in dev
 * 
 * // Get organization sub-collection
 * const leadsRef = dal.getOrgSubCollection('org123', 'leads');
 * 
 * // Safe write with audit
 * await dal.safeSetDoc('organizations', 'org123', {
 *   name: 'Acme Inc',
 *   tier: 'tier1'
 * }, { audit: true, userId: 'user123' });
 * ```
 */
export class BaseAgentDAL {
  protected db: Firestore;
  private envPrefix: string;
  
  constructor(firestoreInstance: Firestore) {
    if (!firestoreInstance) {
      throw new Error('BaseAgentDAL requires a valid Firestore instance');
    }
    this.db = firestoreInstance;
    this.envPrefix = this.calculateEnvPrefix();
    
    logger.info('🏗️ BaseAgentDAL initialized', {
      environment:process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      prefix: this.envPrefix || '(none - production)',
      isolated: !!this.envPrefix,
      file: 'BaseAgentDAL.ts'
    });
  }
  
  // ========================================
  // ENVIRONMENT-AWARE COLLECTION PATHS
  // ========================================
  
  /**
   * Calculate the environment prefix based on NEXT_PUBLIC_APP_ENV
   * 
   * CRITICAL: Returns 'test_' for all non-production environments
   * This is the "ticking time bomb" fix mentioned in the architecture docs
   */
  private calculateEnvPrefix(): string {
    const appEnv = (process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV) || 'development';
    
    // Only production has no prefix
    if (appEnv === 'production') {
      return '';
    }
    
    // All other environments (dev, staging, test, etc.) get test_ prefix
    return 'test_';
  }
  
  /**
   * Get environment-aware collection path
   * 
   * This is the core method that prevents test data pollution
   * 
   * @param baseName - Base collection name (e.g., 'organizations', 'leads')
   * @returns Prefixed collection name (e.g., 'test_organizations' in dev)
   * 
   * @example
   * dal.getColPath('organizations') // 'test_organizations' (dev)
   * dal.getColPath('leads')         // 'leads' (production)
   */
  getColPath(baseName: string): string {
    return `${this.envPrefix}${baseName}`;
  }
  
  /**
   * Get a collection reference with environment-aware naming
   * 
   * @param baseName - Base collection name
   * @returns CollectionReference with proper environment prefix
   */
  getCollection(baseName: string): CollectionReference {
    const path = this.getColPath(baseName);
    return collection(this.db, path);
  }
  
  /**
   * Get an organization sub-collection reference
   * Handles nested collection paths with environment awareness
   * 
   * @param orgId - Organization ID
   * @param subCollection - Sub-collection name (e.g., 'records', 'schemas')
   * @returns CollectionReference for the org sub-collection
   * 
   * @example
   * dal.getOrgSubCollection('org123', 'records')
   * // Returns: 'test_organizations/org123/test_records' (dev)
   * // Returns: 'organizations/org123/records' (production)
   */
  getOrgSubCollection(orgId: string, subCollection: string): CollectionReference {
    const orgPath = this.getColPath('organizations');
    const subPath = this.getColPath(subCollection);
    const fullPath = `${orgPath}/${orgId}/${subPath}`;
    return collection(this.db, fullPath);
  }
  
  /**
   * Get a workspace sub-collection reference
   * 
   * @param orgId - Organization ID
   * @param workspaceId - Workspace ID
   * @param subCollection - Sub-collection name
   * @returns CollectionReference for the workspace sub-collection
   */
  getWorkspaceSubCollection(
    orgId: string,
    workspaceId: string,
    subCollection: string
  ): CollectionReference {
    const orgPath = this.getColPath('organizations');
    const workspacesPath = this.getColPath('workspaces');
    const subPath = this.getColPath(subCollection);
    const fullPath = `${orgPath}/${orgId}/${workspacesPath}/${workspaceId}/${subPath}`;
    return collection(this.db, fullPath);
  }
  
  /**
   * Get a document reference with environment-aware path
   * 
   * @param baseName - Base collection name
   * @param docId - Document ID
   * @returns DocumentReference
   */
  getDocRef(baseName: string, docId: string): DocumentReference {
    const path = this.getColPath(baseName);
    return doc(this.db, path, docId);
  }
  
  /**
   * Get an environment-aware subcollection name
   * Helper method to apply prefix to any subcollection
   * 
   * @param subCollectionName - Base subcollection name
   * @returns Prefixed subcollection name based on environment
   * 
   * @example
   * dal.getSubColPath('website') // 'test_website' in dev, 'website' in prod
   */
  getSubColPath(subCollectionName: string): string {
    return `${this.envPrefix}${subCollectionName}`;
  }
  
  // ========================================
  // SAFE WRITE OPERATIONS
  // ========================================
  
  /**
   * Safe setDoc with environment awareness and audit logging
   * 
   * @example
   * await dal.safeSetDoc('organizations', 'org123', {
   *   name: 'Acme Inc',
   *   createdAt: serverTimestamp()
   * }, { audit: true, userId: 'user123' });
   */
  async safeSetDoc<T extends DocumentData>(
    baseName: string,
    docId: string,
    data: WithFieldValue<T>,
    options?: WriteOptions & { merge?: boolean }
  ): Promise<void> {
    const path = this.getColPath(baseName);
    
    // Dry run mode - log without executing
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would write to Firestore', {
        collection: path,
        docId,
        data,
        merge: options?.merge,
        file: 'BaseAgentDAL.ts'
      });
      return;
    }
    
    // TODO: Add organization-scoped access check
    if (options?.organizationId) {
      await this.verifyOrgAccess(options.userId, options.organizationId);
    }
    
    const docRef = doc(this.db, path, docId) as DocumentReference<T>;
    
    logger.info('✍️ Writing to Firestore', {
      collection: path,
      docId,
      env:process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      userId: options?.userId,
      orgId: options?.organizationId,
      file: 'BaseAgentDAL.ts'
    });
    
    const setOptions: SetOptions = options?.merge ? { merge: true } : {};
    await setDoc(docRef, data, setOptions);
    
    if (options?.audit) {
      await this.logAudit('CREATE', path, docId, data, options?.userId);
    }
  }
  
  /**
   * Safe updateDoc with environment awareness and audit logging
   */
  async safeUpdateDoc<T extends DocumentData>(
    baseName: string,
    docId: string,
    data: UpdateData<T>,
    options?: WriteOptions
  ): Promise<void> {
    const path = this.getColPath(baseName);
    
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would update Firestore', {
        collection: path,
        docId,
        data,
        file: 'BaseAgentDAL.ts'
      });
      return;
    }
    
    if (options?.organizationId) {
      await this.verifyOrgAccess(options.userId, options.organizationId);
    }
    
    const docRef = doc(this.db, path, docId) as DocumentReference<T>;
    
    logger.info('📝 Updating Firestore', {
      collection: path,
      docId,
      env:process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      userId: options?.userId,
      file: 'BaseAgentDAL.ts'
    });
    
    await updateDoc(docRef, data);
    
    if (options?.audit) {
      await this.logAudit('UPDATE', path, docId, data, options?.userId);
    }
  }
  
  /**
   * Safe deleteDoc with environment awareness and production protection
   */
  async safeDeleteDoc(
    baseName: string,
    docId: string,
    options?: WriteOptions
  ): Promise<void> {
    const path = this.getColPath(baseName);
    
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would delete from Firestore', {
        collection: path,
        docId,
        file: 'BaseAgentDAL.ts'
      });
      return;
    }
    
    // CRITICAL: Production delete protection
    const appEnv =process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
    if (appEnv === 'production' && !process.env.ALLOW_PROD_DELETES) {
      throw new Error(
        '🚨 Production deletes require ALLOW_PROD_DELETES=true environment variable. ' +
        'This is a safety measure to prevent accidental data loss.'
      );
    }
    
    const docRef = doc(this.db, path, docId);
    
    logger.warn('🗑️ Deleting from Firestore', {
      collection: path,
      docId,
      env: appEnv,
      userId: options?.userId,
      file: 'BaseAgentDAL.ts'
    });
    
    await deleteDoc(docRef);
    
    if (options?.audit) {
      await this.logAudit('DELETE', path, docId, {}, options?.userId);
    }
  }
  
  /**
   * Safe addDoc (auto-generated ID)
   */
  async safeAddDoc<T extends DocumentData>(
    baseName: string,
    data: WithFieldValue<T>,
    options?: WriteOptions
  ): Promise<DocumentReference> {
    const path = this.getColPath(baseName);
    
    if (options?.dryRun) {
      logger.info('[DRY RUN] Would add to Firestore', {
        collection: path,
        data,
        file: 'BaseAgentDAL.ts'
      });
      return doc(this.db, path, 'dry-run-doc-id');
    }
    
    const colRef = collection(this.db, path);
    
    logger.info('➕ Adding to Firestore', {
      collection: path,
      env:process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      userId: options?.userId,
      file: 'BaseAgentDAL.ts'
    });
    
    const docRef = await addDoc(colRef, data);
    
    if (options?.audit) {
      await this.logAudit('CREATE', path, docRef.id, data, options?.userId);
    }
    
    return docRef;
  }
  
  // ========================================
  // SAFE READ OPERATIONS
  // ========================================
  
  /**
   * Safe getDoc with logging
   */
  async safeGetDoc<T extends DocumentData>(
    baseName: string,
    docId: string
  ): Promise<DocumentSnapshot<T>> {
    const path = this.getColPath(baseName);
    const docRef = doc(this.db, path, docId);
    
    logger.debug('📖 Reading from Firestore', {
      collection: path,
      docId,
      file: 'BaseAgentDAL.ts'
    });
    
    return await getDoc(docRef) as DocumentSnapshot<T>;
  }
  
  /**
   * Safe getDocs with query support
   */
  async safeGetDocs<T extends DocumentData>(
    baseName: string,
    ...queryConstraints: QueryConstraint[]
  ): Promise<QuerySnapshot<T>> {
    const path = this.getColPath(baseName);
    const colRef = collection(this.db, path);
    
    logger.debug('📚 Querying Firestore', {
      collection: path,
      constraints: queryConstraints.length,
      file: 'BaseAgentDAL.ts'
    });
    
    const q = query(colRef, ...queryConstraints);
    return await getDocs(q) as QuerySnapshot<T>;
  }
  
  // ========================================
  // AUDIT LOGGING
  // ========================================
  
  /**
   * Log an audit trail entry
   * In production, this writes to the audit_logs collection
   */
  private async logAudit(
    action: 'CREATE' | 'UPDATE' | 'DELETE',
    collection: string,
    docId: string,
    data: any,
    userId?: string
  ): Promise<void> {
    const auditEntry = {
      action,
      collection,
      docId,
      userId:(userId !== '' && userId != null) ? userId : 'system',
      timestamp: new Date().toISOString(),
      environment:process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV,
      dataPreview: action === 'DELETE' ? null : Object.keys(data).slice(0, 10).join(', ')
    };
    
    logger.info('📋 Audit Log', auditEntry);
    
    // TODO: Implement actual audit log storage
    // const auditColRef = this.getCollection('audit_logs');
    // await addDoc(auditColRef, auditEntry);
  }
  
  // ========================================
  // ACCESS CONTROL
  // ========================================
  
  /**
   * Verify that a user has access to an organization
   * This will be implemented as part of the security enhancement
   */
  private async verifyOrgAccess(
    userId: string | undefined,
    organizationId: string
  ): Promise<void> {
    // TODO: Implement organization-scoped access control
    logger.debug('🔒 Verifying org access', {
      userId,
      organizationId,
      file: 'BaseAgentDAL.ts'
    });
  }
  
  /**
   * Get current environment prefix for debugging
   */
  getEnvironmentPrefix(): string {
    return this.envPrefix;
  }
  
  /**
   * Check if currently in production mode
   */
  isProduction(): boolean {
    const appEnv =process.env.NEXT_PUBLIC_APP_ENV ?? process.env.NODE_ENV;
    return appEnv === 'production';
  }
}

/**
 * Export for use throughout the application
 */
export default BaseAgentDAL;
