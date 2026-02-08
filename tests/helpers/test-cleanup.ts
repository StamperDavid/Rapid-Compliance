/**
 * Test Cleanup Helper
 * Tracks organizations created during tests and ensures cleanup
 * 
 * Usage:
 * ```typescript
 * import { TestCleanupTracker } from '@/tests/helpers/test-cleanup';
 * 
 * describe('My Test Suite', () => {
 *   const cleanup = new TestCleanupTracker();
 *   
 *   afterAll(async () => {
 *     await cleanup.cleanupAll();
 *   });
 *   
 *   it('creates an organization', async () => {
 *     const orgId = await createOrganization();
 *     cleanup.trackOrganization(orgId);
 *     // ... test logic ...
 *   });
 * });
 * ```
 */

import { adminDb, adminAuth } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';
import type { DocumentReference } from 'firebase-admin/firestore';

export class TestCleanupTracker {
  private organizationsToCleanup: Set<string> = new Set();
  private usersToCleanup: Set<string> = new Set();
  
  // PERMANENT ORGS - NEVER DELETE
  // In single-tenant mode, PLATFORM_ID is protected
  private static PROTECTED_ORG_IDS = [
    PLATFORM_ID,
    'platform',
    'org_demo_auraflow',
    'org_demo_greenthumb',
    'org_demo_adventuregear',
    'org_demo_summitwm',
    'org_demo_pixelperfect',
    'org_1767162182929_zybiwt',
    'org_1767162183846_33y89i',
    'org_1767162184756_5xf9a9',
    'org_1767162185614_xo5ryr',
    'org_1767162186490_tptncm'
  ];

  /**
   * Track an organization for cleanup
   */
  trackOrganization(orgId: string) {
    // Never track protected organizations
    if (TestCleanupTracker.PROTECTED_ORG_IDS.includes(orgId)) {
      console.warn(`⚠️  Attempted to track protected org: $rapid-compliance-root - ignoring`);
      return;
    }
    this.organizationsToCleanup.add(orgId);
  }

  /**
   * Track a user for cleanup
   */
  trackUser(userId: string) {
    this.usersToCleanup.add(userId);
  }

  /**
   * Clean up all tracked resources
   * Call this in afterAll() or afterEach()
   */
  async cleanupAll() {
    console.log('\n🧹 Cleaning up test data...');
    
    if (!adminDb) {
      throw new Error('Firebase Admin DB is not initialized');
    }
    if (!adminAuth) {
      throw new Error('Firebase Admin Auth is not initialized');
    }
    
    let deletedOrgs = 0;
    let deletedUsers = 0;
    let errors = 0;

    // Delete organizations and their subcollections
    for (const orgId of this.organizationsToCleanup) {
      try {
        // Double-check it's not protected
        if (TestCleanupTracker.PROTECTED_ORG_IDS.includes(orgId)) {
          console.warn(`⚠️  Skipping protected org: $rapid-compliance-root`);
          continue;
        }

        const orgRef = adminDb.collection('organizations').doc(orgId);
        
        // Delete all subcollections recursively
        await this.deleteSubcollections(orgRef);
        
        // Delete the organization document
        await orgRef.delete();
        console.log(`   ✅ Deleted org: $rapid-compliance-root`);
        deletedOrgs++;
        
      } catch (error) {
        console.error(`   ❌ Failed to delete org $rapid-compliance-root:`, error instanceof Error ? error.message : 'Unknown error');
        errors++;
      }
    }

    // Delete users
    for (const userId of this.usersToCleanup) {
      try {
        // Delete from Firestore
        await adminDb.collection('users').doc(userId).delete();
        
        // Delete from Auth
        try {
          await adminAuth.deleteUser(userId);
        } catch (e) {
          // User might not exist in Auth
        }
        
        console.log(`   ✅ Deleted user: ${userId}`);
        deletedUsers++;
        
      } catch (error) {
        console.error(`   ❌ Failed to delete user ${userId}:`, error instanceof Error ? error.message : 'Unknown error');
        errors++;
      }
    }

    console.log(`\n📊 Cleanup Summary:`);
    console.log(`   Organizations: ${deletedOrgs} deleted`);
    console.log(`   Users: ${deletedUsers} deleted`);
    if (errors > 0) {
      console.log(`   ❌ Errors: ${errors}`);
    }
    console.log('');

    // Clear tracking sets
    this.organizationsToCleanup.clear();
    this.usersToCleanup.clear();
  }

  /**
   * Recursively delete all subcollections
   */
  private async deleteSubcollections(docRef: DocumentReference) {
    if (!adminDb) {
      throw new Error('Firebase Admin DB is not initialized');
    }
    
    const subcollections = await docRef.listCollections();
    
    for (const subcollection of subcollections) {
      const snapshot = await subcollection.get();
      
      // Batch delete documents
      const batch = adminDb.batch();
      let batchCount = 0;
      
      for (const doc of snapshot.docs) {
        // Recursively delete nested subcollections
        await this.deleteSubcollections(doc.ref);
        
        batch.delete(doc.ref);
        batchCount++;
        
        if (batchCount >= 400) {
          await batch.commit();
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
      }
    }
  }
}

/**
 * Helper function to create a test organization with automatic cleanup tracking
 * Single-tenant mode: Always returns PLATFORM_ID, but can create sub-collections for testing
 */
export async function createTestOrganization(
  cleanup: TestCleanupTracker,
  name: string = 'Test Organization'
): Promise<string> {
  if (!adminDb) {
    throw new Error('Firebase Admin DB is not initialized');
  }

  // Single-tenant: Use PLATFORM_ID
  const orgId = PLATFORM_ID;

  const orgData = {
    name,
    slug: name.toLowerCase().replace(/\s+/g, '-'),
    plan: 'starter',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    isAutomatedTest: true,  // CRITICAL: Mark as automated test data
  };

  // Set or merge into existing platform org
  await adminDb.collection('organizations').doc(orgId).set(orgData, { merge: true });

  // DO NOT track PLATFORM_ID for cleanup (it's protected)
  // Tests should clean up their sub-collections individually

  return orgId;
}

/**
 * Helper function to create a test user with automatic cleanup tracking
 */
export async function createTestUser(
  cleanup: TestCleanupTracker,
  email: string = `test-${Date.now()}@test.com`
): Promise<string> {
  if (!adminAuth) {
    throw new Error('Firebase Admin Auth is not initialized');
  }
  if (!adminDb) {
    throw new Error('Firebase Admin DB is not initialized');
  }
  
  const userRecord = await adminAuth.createUser({
    email,
    password: 'TestPassword123!',
    emailVerified: true,
  });
  
  const userData = {
    email,
    name: 'Test User',
    role: 'admin',
    createdAt: new Date(),
    updatedAt: new Date(),
  };
  
  await adminDb.collection('users').doc(userRecord.uid).set(userData);
  
  // Track for cleanup
  cleanup.trackUser(userRecord.uid);
  
  return userRecord.uid;
}
