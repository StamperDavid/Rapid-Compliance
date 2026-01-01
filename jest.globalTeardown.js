/**
 * Jest Global Teardown
 * Runs AFTER all tests to clean up test data from DEV database
 * This prevents test data pollution and duplicate user issues
 */

const admin = require('firebase-admin');
const { config } = require('dotenv');

// Load environment variables
config({ path: '.env.local' });

module.exports = async () => {
  console.log('\n🧹 ========================================');
  console.log('🧹 GLOBAL CLEANUP: Removing test data...');
  console.log('🧹 ========================================\n');

  try {
    // Initialize Firebase Admin if not already initialized
    if (!admin.apps.length) {
      const serviceAccount = require('./serviceAccountKey.json');
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
    }

    const db = admin.firestore();
    const auth = admin.auth();

    let deletedOrgs = 0;
    let deletedUsers = 0;
    let deletedCollections = 0;

    // Test organization patterns to clean up
    const TEST_ORG_PATTERNS = [
      /^test-org-/,
      /^e2e-test-org-/,
      /^backward-compat-test-org/,
      'org_change_this',
      'platform-admin',
      'org_test_a',
      'org_test_b',
    ];

    const TEST_COLLECTION_PATTERNS = [
      /^test_/,  // Collections with test_ prefix
    ];

    // 1. Delete test organizations and their users
    console.log('📋 Scanning organizations...');
    const orgsSnapshot = await db.collection('organizations').get();
    
    for (const orgDoc of orgsSnapshot.docs) {
      const orgId = orgDoc.id;
      const orgData = orgDoc.data();
      const orgName = orgData.name || orgId;
      
      // Check if it's a test organization
      const isTestOrg = TEST_ORG_PATTERNS.some(pattern => {
        if (typeof pattern === 'string') {
          return orgId === pattern;
        } else {
          return pattern.test(orgId) || pattern.test(orgName);
        }
      });
      
      if (isTestOrg) {
        console.log(`   🗑️  Deleting org: ${orgName} (${orgId})`);
        
        // Delete users belonging to this org
        const usersSnapshot = await db.collection('users')
          .where('organizationId', '==', orgId)
          .get();
        
        for (const userDoc of usersSnapshot.docs) {
          const uid = userDoc.id;
          const userData = userDoc.data();
          const email = userData.email;
          
          console.log(`      - Deleting user: ${email}`);
          
          // Delete from Firestore
          await db.collection('users').doc(uid).delete();
          deletedUsers++;
          
          // Delete from Auth
          try {
            await auth.deleteUser(uid);
          } catch (e) {
            // User might not exist in Auth, that's ok
          }
        }
        
        // Delete the organization
        await db.collection('organizations').doc(orgId).delete();
        deletedOrgs++;
      }
    }

    // 2. Clean up test collections (collections with test_ prefix)
    console.log('\n📋 Scanning for test collections...');
    const collections = await db.listCollections();
    
    for (const collection of collections) {
      const collectionName = collection.id;
      
      const isTestCollection = TEST_COLLECTION_PATTERNS.some(pattern => {
        if (typeof pattern === 'string') {
          return collectionName === pattern;
        } else {
          return pattern.test(collectionName);
        }
      });
      
      if (isTestCollection) {
        console.log(`   🗑️  Deleting collection: ${collectionName}`);
        const snapshot = await collection.get();
        
        // Delete in batches of 500 (Firestore limit)
        const batchSize = 500;
        for (let i = 0; i < snapshot.docs.length; i += batchSize) {
          const batch = db.batch();
          const docs = snapshot.docs.slice(i, i + batchSize);
          
          docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          
          await batch.commit();
        }
        
        deletedCollections++;
      }
    }

    // 3. Clean up orphaned users (users with no organization)
    console.log('\n📋 Scanning for orphaned users...');
    const allUsers = await db.collection('users').get();
    
    for (const userDoc of allUsers.docs) {
      const userData = userDoc.data();
      const orgId = userData.organizationId;
      
      if (orgId) {
        // Check if org still exists
        const orgExists = await db.collection('organizations').doc(orgId).get();
        
        if (!orgExists.exists) {
          console.log(`   🗑️  Deleting orphaned user: ${userData.email} (org: ${orgId})`);
          
          // Delete from Firestore
          await db.collection('users').doc(userDoc.id).delete();
          deletedUsers++;
          
          // Delete from Auth
          try {
            await auth.deleteUser(userDoc.id);
          } catch (e) {
            // User might not exist in Auth
          }
        }
      }
    }

    console.log('\n✅ ========================================');
    console.log('✅ CLEANUP COMPLETE');
    console.log('✅ ========================================');
    console.log(`   Organizations deleted: ${deletedOrgs}`);
    console.log(`   Users deleted: ${deletedUsers}`);
    console.log(`   Collections deleted: ${deletedCollections}`);
    
    // Show final database state
    const finalOrgs = await db.collection('organizations').get();
    const finalUsers = await db.collection('users').get();
    
    console.log('\n📊 FINAL DATABASE STATE:');
    console.log(`   Organizations: ${finalOrgs.size}`);
    console.log(`   Users: ${finalUsers.size}`);
    console.log('');

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    // Don't fail the tests if cleanup fails
  }
};
