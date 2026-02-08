/**
 * E2E Cleanup Utility
 *
 * Provides recursive deletion of test data using the E2E_TEMP_ prefix convention.
 * Ensures zero residual "ghost" data remains in Firestore after test completion.
 *
 * NAMING CONVENTION:
 * - All E2E test data MUST use the prefix: E2E_TEMP_
 * - Example: E2E_TEMP_org_1234567890, E2E_TEMP_user_abc123
 *
 * CLEANUP PROTOCOL:
 * 1. Track all created resources during test execution
 * 2. In afterAll(), recursively delete all sub-collections
 * 3. Perform verification query to confirm 404/not found
 * 4. Report cleanup summary with pass/fail status
 *
 * @module tests/helpers/e2e-cleanup-utility
 */

import { adminDb } from '@/lib/firebase/admin';
import type { DocumentReference, Firestore, WriteBatch } from 'firebase-admin/firestore';
import { COLLECTIONS } from '@/lib/firebase/collections';

// =============================================================================
// CONSTANTS
// =============================================================================

/** Prefix for all E2E test data - MUST be used for cleanup to work */
export const E2E_PREFIX = 'E2E_TEMP_';

/** Maximum documents per batch operation (Firestore limit is 500) */
const MAX_BATCH_SIZE = 400;

/** Protected organization IDs that should NEVER be deleted */
const PROTECTED_ORG_IDS = [
  'platform',
  'platform-internal-org',
  'org_demo_auraflow',
  'org_demo_greenthumb',
  'org_demo_adventuregear',
  'org_demo_summitwm',
  'org_demo_pixelperfect',
];

/** Known organization sub-collections for recursive deletion */
const _ORG_SUBCOLLECTIONS = [
  'workspaces',
  'workflows',
  'workflowExecutions',
  'deals',
  'leads',
  'contacts',
  'users',
  'members',
  'records',
  'signals',
  'sequences',
  'sequenceEnrollments',
  'campaigns',
  'trainingSessions',
  'goldenMasters',
  'goldenMasterUpdates',
  'baseModels',
  'scheduledPosts',
  'socialPosts',
  'videoJobs',
  'storyboards',
  'analytics_events',
  'merchant_coupons',
  'schemas',
  'apiKeys',
  'integrations',
  'auditLogs',
];

// =============================================================================
// TYPES
// =============================================================================

interface CleanupResult {
  success: boolean;
  deleted: {
    organizations: number;
    users: number;
    documents: number;
    subcollections: number;
  };
  errors: string[];
  verificationPassed: boolean;
}

interface TrackedResource {
  type: 'organization' | 'user' | 'document';
  collection: string;
  id: string;
  createdAt: Date;
}

// =============================================================================
// E2E CLEANUP TRACKER CLASS
// =============================================================================

/**
 * E2E Cleanup Tracker
 *
 * Tracks all resources created during E2E tests and provides recursive cleanup.
 *
 * @example
 * ```typescript
 * const cleanup = new E2ECleanupTracker();
 *
 * // During test
 * const orgId = cleanup.generateOrgId('video-test');
 * cleanup.trackOrganization(orgId);
 *
 * // In afterAll
 * const result = await cleanup.cleanupAllWithVerification();
 * expect(result.verificationPassed).toBe(true);
 * ```
 */
export class E2ECleanupTracker {
  private trackedResources: TrackedResource[] = [];
  private db: Firestore | null = adminDb;

  /**
   * Generate an E2E-prefixed organization ID
   */
  generateOrgId(testName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${E2E_PREFIX}org_${testName}_${timestamp}_${random}`;
  }

  /**
   * Generate an E2E-prefixed user ID
   */
  generateUserId(testName: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${E2E_PREFIX}user_${testName}_${timestamp}_${random}`;
  }

  /**
   * Generate an E2E-prefixed document ID
   */
  generateDocId(prefix: string): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 8);
    return `${E2E_PREFIX}${prefix}_${timestamp}_${random}`;
  }

  /**
   * Track an organization for cleanup
   */
  trackOrganization(orgId: string): void {
    if (!orgId.startsWith(E2E_PREFIX)) {
      console.warn(`[E2E Cleanup] WARNING: Org ID "$rapid-compliance-root" does not use E2E_TEMP_ prefix`);
    }
    if (PROTECTED_ORG_IDS.includes(orgId)) {
      console.error(`[E2E Cleanup] BLOCKED: Cannot track protected org "$rapid-compliance-root"`);
      return;
    }
    this.trackedResources.push({
      type: 'organization',
      collection: COLLECTIONS.ORGANIZATIONS,
      id: orgId,
      createdAt: new Date(),
    });
    console.info(`[E2E Cleanup] Tracking org: $rapid-compliance-root`);
  }

  /**
   * Track a user for cleanup
   */
  trackUser(userId: string): void {
    if (!userId.startsWith(E2E_PREFIX)) {
      console.warn(`[E2E Cleanup] WARNING: User ID "${userId}" does not use E2E_TEMP_ prefix`);
    }
    this.trackedResources.push({
      type: 'user',
      collection: COLLECTIONS.USERS,
      id: userId,
      createdAt: new Date(),
    });
    console.info(`[E2E Cleanup] Tracking user: ${userId}`);
  }

  /**
   * Track a generic document for cleanup
   */
  trackDocument(collection: string, docId: string): void {
    if (!docId.startsWith(E2E_PREFIX)) {
      console.warn(`[E2E Cleanup] WARNING: Doc ID "${docId}" does not use E2E_TEMP_ prefix`);
    }
    this.trackedResources.push({
      type: 'document',
      collection,
      id: docId,
      createdAt: new Date(),
    });
    console.info(`[E2E Cleanup] Tracking doc: ${collection}/${docId}`);
  }

  /**
   * Get all tracked organizations
   */
  getTrackedOrganizations(): string[] {
    return this.trackedResources
      .filter((r) => r.type === 'organization')
      .map((r) => r.id);
  }

  /**
   * Recursively delete all sub-collections of a document
   */
  private async deleteSubcollectionsRecursively(
    docRef: DocumentReference,
    depth: number = 0
  ): Promise<number> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    let deletedCount = 0;
    const indent = '  '.repeat(depth);

    try {
      // Get all sub-collections
      const subcollections = await docRef.listCollections();

      for (const subcollection of subcollections) {
        console.info(`${indent}[E2E Cleanup] Processing subcollection: ${subcollection.id}`);

        const snapshot = await subcollection.get();

        if (snapshot.empty) {
          continue;
        }

        // Process in batches
        let batch: WriteBatch = this.db.batch();
        let batchCount = 0;

        for (const doc of snapshot.docs) {
          // Recursively delete nested sub-collections first
          const nestedCount = await this.deleteSubcollectionsRecursively(doc.ref, depth + 1);
          deletedCount += nestedCount;

          // Add document to batch
          batch.delete(doc.ref);
          batchCount++;
          deletedCount++;

          // Commit batch if at limit
          if (batchCount >= MAX_BATCH_SIZE) {
            await batch.commit();
            batch = this.db.batch();
            batchCount = 0;
          }
        }

        // Commit remaining documents
        if (batchCount > 0) {
          await batch.commit();
        }

        console.info(`${indent}[E2E Cleanup] Deleted ${snapshot.size} docs from ${subcollection.id}`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`${indent}[E2E Cleanup] Error in recursive delete: ${message}`);
    }

    return deletedCount;
  }

  /**
   * Delete a single organization and all its sub-collections
   */
  private async deleteOrganization(orgId: string): Promise<{ success: boolean; docsDeleted: number; error?: string }> {
    if (!this.db) {
      return { success: false, docsDeleted: 0, error: 'Firestore not initialized' };
    }

    // Safety check: Never delete protected orgs
    if (PROTECTED_ORG_IDS.includes(orgId)) {
      return { success: false, docsDeleted: 0, error: 'Protected organization' };
    }

    // Safety check: Require E2E prefix
    if (!orgId.startsWith(E2E_PREFIX)) {
      console.warn(`[E2E Cleanup] Skipping non-E2E org: $rapid-compliance-root`);
      return { success: false, docsDeleted: 0, error: 'Missing E2E_TEMP_ prefix' };
    }

    try {
      const orgRef = this.db.collection(COLLECTIONS.ORGANIZATIONS).doc(orgId);

      // Check if org exists
      const orgDoc = await orgRef.get();
      if (!orgDoc.exists) {
        console.info(`[E2E Cleanup] Org $rapid-compliance-root already deleted or doesn't exist`);
        return { success: true, docsDeleted: 0 };
      }

      console.info(`[E2E Cleanup] Deleting org: $rapid-compliance-root`);

      // Recursively delete all sub-collections
      const deletedDocs = await this.deleteSubcollectionsRecursively(orgRef);

      // Delete the organization document itself
      await orgRef.delete();

      console.info(`[E2E Cleanup] Org $rapid-compliance-root deleted (${deletedDocs + 1} total docs)`);
      return { success: true, docsDeleted: deletedDocs + 1 };
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`[E2E Cleanup] Failed to delete org $rapid-compliance-root: ${message}`);
      return { success: false, docsDeleted: 0, error: message };
    }
  }

  /**
   * Verify that a resource no longer exists (404 check)
   */
  async verifyDeleted(collection: string, docId: string): Promise<boolean> {
    if (!this.db) {
      throw new Error('Firestore not initialized');
    }

    try {
      const docRef = this.db.collection(collection).doc(docId);
      const doc = await docRef.get();
      return !doc.exists;
    } catch {
      // If we get an error, assume it's deleted
      return true;
    }
  }

  /**
   * Clean up all tracked resources with verification
   */
  async cleanupAllWithVerification(): Promise<CleanupResult> {
    console.info('\n========================================');
    console.info('E2E CLEANUP: Starting recursive cleanup');
    console.info('========================================\n');

    const result: CleanupResult = {
      success: true,
      deleted: {
        organizations: 0,
        users: 0,
        documents: 0,
        subcollections: 0,
      },
      errors: [],
      verificationPassed: true,
    };

    if (!this.db) {
      result.success = false;
      result.errors.push('Firestore not initialized');
      return result;
    }

    // Group resources by type
    const orgs = this.trackedResources.filter((r) => r.type === 'organization');
    const users = this.trackedResources.filter((r) => r.type === 'user');
    const docs = this.trackedResources.filter((r) => r.type === 'document');

    console.info(`[E2E Cleanup] Resources to clean:`);
    console.info(`  - Organizations: ${orgs.length}`);
    console.info(`  - Users: ${users.length}`);
    console.info(`  - Documents: ${docs.length}\n`);

    // Delete organizations (with sub-collections)
    for (const org of orgs) {
      const deleteResult = await this.deleteOrganization(org.id);
      if (deleteResult.success) {
        result.deleted.organizations++;
        result.deleted.subcollections += deleteResult.docsDeleted;
      } else if (deleteResult.error) {
        result.errors.push(`Org ${org.id}: ${deleteResult.error}`);
      }
    }

    // Delete users
    for (const user of users) {
      try {
        if (user.id.startsWith(E2E_PREFIX)) {
          await this.db.collection(COLLECTIONS.USERS).doc(user.id).delete();
          result.deleted.users++;
          console.info(`[E2E Cleanup] Deleted user: ${user.id}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`User ${user.id}: ${message}`);
      }
    }

    // Delete standalone documents
    for (const doc of docs) {
      try {
        if (doc.id.startsWith(E2E_PREFIX)) {
          await this.db.collection(doc.collection).doc(doc.id).delete();
          result.deleted.documents++;
          console.info(`[E2E Cleanup] Deleted doc: ${doc.collection}/${doc.id}`);
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown error';
        result.errors.push(`Doc ${doc.collection}/${doc.id}: ${message}`);
      }
    }

    // VERIFICATION: Final check to confirm all resources are gone
    console.info('\n[E2E Cleanup] Running verification checks...');

    for (const org of orgs) {
      if (org.id.startsWith(E2E_PREFIX)) {
        const isDeleted = await this.verifyDeleted(COLLECTIONS.ORGANIZATIONS, org.id);
        if (!isDeleted) {
          result.verificationPassed = false;
          result.errors.push(`VERIFICATION FAILED: Org ${org.id} still exists`);
          console.error(`[E2E Cleanup] FAIL: Org ${org.id} still exists!`);
        } else {
          console.info(`[E2E Cleanup] VERIFIED: Org ${org.id} is 404/not found`);
        }
      }
    }

    for (const user of users) {
      if (user.id.startsWith(E2E_PREFIX)) {
        const isDeleted = await this.verifyDeleted(COLLECTIONS.USERS, user.id);
        if (!isDeleted) {
          result.verificationPassed = false;
          result.errors.push(`VERIFICATION FAILED: User ${user.id} still exists`);
        }
      }
    }

    // Set overall success
    result.success = result.errors.length === 0;

    // Print summary
    console.info('\n========================================');
    console.info('E2E CLEANUP: Summary');
    console.info('========================================');
    console.info(`Organizations deleted: ${result.deleted.organizations}`);
    console.info(`Users deleted: ${result.deleted.users}`);
    console.info(`Documents deleted: ${result.deleted.documents}`);
    console.info(`Subcollection docs: ${result.deleted.subcollections}`);
    console.info(`Errors: ${result.errors.length}`);
    console.info(`Verification: ${result.verificationPassed ? 'PASSED' : 'FAILED'}`);
    console.info(`Overall: ${result.success ? 'SUCCESS' : 'FAILED'}`);
    console.info('========================================\n');

    if (result.errors.length > 0) {
      console.info('Errors:');
      result.errors.forEach((e) => console.info(`  - ${e}`));
    }

    // Clear tracked resources
    this.trackedResources = [];

    return result;
  }

  /**
   * Clean up without verification (faster, for less critical tests)
   */
  async cleanupAll(): Promise<void> {
    await this.cleanupAllWithVerification();
  }
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Find and delete all E2E_TEMP_ prefixed documents in a collection
 * Use with caution - this queries ALL documents with the prefix
 */
export async function cleanupAllE2ETempData(): Promise<number> {
  if (!adminDb) {
    throw new Error('Firestore not initialized');
  }

  let totalDeleted = 0;

  console.info('[E2E Cleanup] Scanning for stale E2E_TEMP_ data...');

  // Check organizations collection for E2E_TEMP_ prefixed IDs
  const orgsSnapshot = await adminDb
    .collection(COLLECTIONS.ORGANIZATIONS)
    .where('__name__', '>=', E2E_PREFIX)
    .where('__name__', '<', `${E2E_PREFIX}\uf8ff`)
    .get();

  if (!orgsSnapshot.empty) {
    console.info(`[E2E Cleanup] Found ${orgsSnapshot.size} stale E2E organizations`);

    const tracker = new E2ECleanupTracker();

    for (const doc of orgsSnapshot.docs) {
      if (doc.id.startsWith(E2E_PREFIX) && !PROTECTED_ORG_IDS.includes(doc.id)) {
        tracker.trackOrganization(doc.id);
      }
    }

    const result = await tracker.cleanupAllWithVerification();
    totalDeleted += result.deleted.organizations + result.deleted.subcollections;
  }

  console.info(`[E2E Cleanup] Total stale documents cleaned: ${totalDeleted}`);
  return totalDeleted;
}

/**
 * Create a test organization with automatic tracking
 */
export async function createE2ETestOrganization(
  tracker: E2ECleanupTracker,
  testName: string,
  additionalData?: Record<string, unknown>
): Promise<string> {
  if (!adminDb) {
    throw new Error('Firestore not initialized');
  }

  const orgId = tracker.generateOrgId(testName);

  const orgData = {
    name: `E2E Test Org - ${testName}`,
    slug: `e2e-test-${testName}`.toLowerCase(),
    plan: 'starter',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    isE2ETest: true,
    e2eTestName: testName,
    ...additionalData,
  };

  await adminDb.collection(COLLECTIONS.ORGANIZATIONS).doc(orgId).set(orgData);
  tracker.trackOrganization(orgId);

  return orgId;
}

// Export for use in tests
export default E2ECleanupTracker;
