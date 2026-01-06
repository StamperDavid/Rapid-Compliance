/**
 * EXAMPLE: Proper Test Pattern with Automatic Cleanup
 * 
 * This shows the correct way to write tests that create organizations:
 * 1. Create TestCleanupTracker
 * 2. Track all created orgs/users
 * 3. Clean up in afterAll (runs even if tests fail)
 */

import { TestCleanupTracker, createTestOrganization } from './helpers/test-cleanup';
import { adminDb } from '@/lib/firebase/admin';

describe('Example Test Suite with Cleanup', () => {
  // Create cleanup tracker for this test suite
  const cleanup = new TestCleanupTracker();
  
  // CRITICAL: Always cleanup in afterAll
  // This runs even if tests fail
  afterAll(async () => {
    await cleanup.cleanupAll();
  });

  it('creates a test organization', async () => {
    if (!adminDb) {
      throw new Error('Firebase Admin DB is not initialized');
    }
    
    // Create org and automatically track it for cleanup
    const orgId = await createTestOrganization(cleanup, 'Test Company ABC');
    
    // Your test logic here
    const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
    expect(orgDoc.exists).toBe(true);
    expect(orgDoc.data()?.name).toBe('Test Company ABC');
    
    // Cleanup happens automatically in afterAll
  });

  it('creates multiple organizations', async () => {
    // Create multiple orgs - all tracked for cleanup
    const _org1 = await createTestOrganization(cleanup, 'Test Org 1');
    const _org2 = await createTestOrganization(cleanup, 'Test Org 2');
    
    // Your test logic...
    
    // All will be cleaned up automatically
  });

  it('handles test failures gracefully', async () => {
    const orgId = await createTestOrganization(cleanup, 'Test Org That Might Fail');
    
    // Even if this test fails, cleanup STILL runs in afterAll
    // This prevents pollution even when tests break
    expect(orgId).toBeTruthy();
  });
});

// ===================================================================
// ALTERNATIVE PATTERN: Manual try/finally
// ===================================================================

describe('Alternative Pattern: Manual Cleanup', () => {
  it('creates org with manual cleanup', async () => {
    if (!adminDb) {
      throw new Error('Firebase Admin DB is not initialized');
    }
    
    const orgId = `test-org-${Date.now()}`;
    
    try {
      // Create organization
      await adminDb.collection('organizations').doc(orgId).set({
        name: 'Manual Test Org',
        plan: 'starter',
        status: 'active',
        createdAt: new Date(),
      });
      
      // Your test logic here...
      const orgDoc = await adminDb.collection('organizations').doc(orgId).get();
      expect(orgDoc.exists).toBe(true);
      
    } finally {
      // CRITICAL: Cleanup runs even if test fails
      try {
        if (adminDb) {
          await adminDb.collection('organizations').doc(orgId).delete();
          console.log(`✅ Cleaned up: ${orgId}`);
        }
      } catch (error) {
        console.error(`❌ Cleanup failed for ${orgId}:`, error);
      }
    }
  });
});
