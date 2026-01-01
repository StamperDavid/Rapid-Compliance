/**
 * COMPREHENSIVE CLEANUP SCRIPT
 * Removes ALL test data from DEV database
 * 
 * This fixes:
 * - Test data pollution
 * - Duplicate user entries preventing login
 * - Orphaned records
 * 
 * Usage:
 *   npm run cleanup:all              (with confirmation)
 *   AUTO_CONFIRM=true npm run cleanup:all   (no confirmation)
 */

const admin = require('firebase-admin');
const { requireProductionProtection } = require('./PRODUCTION_PROTECTION');

if (!admin.apps.length) {
  try {
    const serviceAccount = require('../serviceAccountKey.json');
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✓ Firebase Admin initialized');
  } catch (error) {
    console.error('Failed to initialize Firebase Admin:', error);
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

// Test organization patterns
const TEST_ORG_PATTERNS = [
  /^test-org-/,
  /^e2e-test-org-/,
  /^backward-compat-test-org/,
  'org_change_this',
  'platform-admin',
  'org_test_a',
  'org_test_b',
];

// Test collection patterns
const TEST_COLLECTION_PATTERNS = [
  /^test_/,  // Collections with test_ prefix
];

async function cleanupAllTestData() {
  // PRODUCTION PROTECTION
  await requireProductionProtection(admin.app().options.projectId, 'cleanup-all-test-data.js');
  
  console.log('\n🧹 ========================================');
  console.log('🧹 COMPREHENSIVE TEST DATA CLEANUP');
  console.log('🧹 ========================================\n');

  try {
    let deletedOrgs = 0;
    let deletedUsers = 0;
    let deletedCollections = 0;
    let deletedDocs = 0;

    // ========================================
    // 1. DELETE TEST ORGANIZATIONS
    // ========================================
    console.log('📋 Step 1: Scanning organizations...\n');
    const orgsSnapshot = await db.collection('organizations').get();
    console.log(`   Found ${orgsSnapshot.size} organizations\n`);
    
    const testOrgs = [];
    const realOrgs = [];
    
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
        testOrgs.push({ id: orgId, name: orgName, data: orgData });
      } else {
        realOrgs.push({ id: orgId, name: orgName });
      }
    }
    
    console.log(`   Test organizations: ${testOrgs.length}`);
    console.log(`   Real organizations: ${realOrgs.length}\n`);
    
    if (testOrgs.length > 0) {
      console.log('   Test organizations to delete:');
      testOrgs.forEach(org => {
        console.log(`     - ${org.name} (${org.id})`);
      });
      console.log();
    }

    // ========================================
    // 2. FIND ALL USERS (including duplicates)
    // ========================================
    console.log('📋 Step 2: Scanning users...\n');
    const allUsers = await db.collection('users').get();
    console.log(`   Found ${allUsers.size} users\n`);
    
    // Group users by email to find duplicates
    const usersByEmail = {};
    const orphanedUsers = [];
    const testOrgUsers = [];
    
    for (const userDoc of allUsers.docs) {
      const userData = userDoc.data();
      const email = userData.email;
      const orgId = userData.organizationId;
      
      // Track users by email to find duplicates
      if (email) {
        if (!usersByEmail[email]) {
          usersByEmail[email] = [];
        }
        usersByEmail[email].push({ id: userDoc.id, data: userData });
      }
      
      // Check if user belongs to test org
      const belongsToTestOrg = testOrgs.some(org => org.id === orgId);
      if (belongsToTestOrg) {
        testOrgUsers.push({ id: userDoc.id, email, orgId });
      }
      
      // Check if organization exists
      if (orgId && !testOrgs.some(org => org.id === orgId)) {
        const orgExists = await db.collection('organizations').doc(orgId).get();
        if (!orgExists.exists) {
          orphanedUsers.push({ id: userDoc.id, email, orgId });
        }
      }
    }
    
    // Find duplicate users
    const duplicateEmails = Object.entries(usersByEmail)
      .filter(([email, users]) => users.length > 1)
      .map(([email, users]) => ({ email, count: users.length, users }));
    
    console.log(`   Duplicate emails: ${duplicateEmails.length}`);
    console.log(`   Test org users: ${testOrgUsers.length}`);
    console.log(`   Orphaned users: ${orphanedUsers.length}\n`);
    
    if (duplicateEmails.length > 0) {
      console.log('   ⚠️  DUPLICATE USERS FOUND (causes login issues):');
      duplicateEmails.forEach(({ email, count, users }) => {
        console.log(`     - ${email} (${count} copies)`);
        users.forEach(user => {
          console.log(`       • ${user.id} → org: ${user.data.organizationId || 'none'}`);
        });
      });
      console.log();
    }

    // ========================================
    // 3. DELETE TEST COLLECTIONS
    // ========================================
    console.log('📋 Step 3: Scanning for test collections...\n');
    const collections = await db.listCollections();
    const testCollections = [];
    
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
        const snapshot = await collection.get();
        testCollections.push({ name: collectionName, docCount: snapshot.size });
      }
    }
    
    console.log(`   Test collections: ${testCollections.length}\n`);
    if (testCollections.length > 0) {
      console.log('   Test collections to delete:');
      testCollections.forEach(coll => {
        console.log(`     - ${coll.name} (${coll.docCount} documents)`);
      });
      console.log();
    }

    // ========================================
    // CONFIRMATION
    // ========================================
    const totalToDelete = testOrgs.length + testOrgUsers.length + orphanedUsers.length + testCollections.length;
    
    if (totalToDelete === 0) {
      console.log('✨ No test data found. Database is clean!\n');
      return;
    }
    
    console.log('⚠️  ========================================');
    console.log('⚠️  WARNING: ABOUT TO DELETE:');
    console.log('⚠️  ========================================');
    console.log(`   ${testOrgs.length} test organizations`);
    console.log(`   ${testOrgUsers.length} users from test orgs`);
    console.log(`   ${orphanedUsers.length} orphaned users`);
    console.log(`   ${testCollections.length} test collections`);
    console.log(`   ${duplicateEmails.length} duplicate emails will be deduplicated`);
    console.log();
    
    if (process.env.AUTO_CONFIRM !== 'true') {
      console.log('⚠️  Press Ctrl+C to cancel...');
      console.log('⚠️  Proceeding in 5 seconds...\n');
      await new Promise(resolve => setTimeout(resolve, 5000));
    }

    // ========================================
    // EXECUTE DELETION
    // ========================================
    console.log('🗑️  Starting deletion...\n');

    // Delete test organizations
    for (const org of testOrgs) {
      console.log(`   Deleting org: ${org.name} (${org.id})`);
      await db.collection('organizations').doc(org.id).delete();
      deletedOrgs++;
    }

    // Delete users from test organizations
    for (const user of testOrgUsers) {
      console.log(`   Deleting test org user: ${user.email}`);
      await db.collection('users').doc(user.id).delete();
      try {
        await auth.deleteUser(user.id);
      } catch (e) {
        // User might not exist in Auth
      }
      deletedUsers++;
    }

    // Delete orphaned users
    for (const user of orphanedUsers) {
      console.log(`   Deleting orphaned user: ${user.email}`);
      await db.collection('users').doc(user.id).delete();
      try {
        await auth.deleteUser(user.id);
      } catch (e) {
        // User might not exist in Auth
      }
      deletedUsers++;
    }

    // Delete duplicate users (keep newest, delete older copies)
    for (const { email, users } of duplicateEmails) {
      // Sort by creation date, keep newest
      const sortedUsers = users.sort((a, b) => {
        const dateA = a.data.createdAt?.toDate?.() || new Date(0);
        const dateB = b.data.createdAt?.toDate?.() || new Date(0);
        return dateB - dateA;
      });
      
      // Keep first (newest), delete rest
      const toKeep = sortedUsers[0];
      const toDelete = sortedUsers.slice(1);
      
      console.log(`   Deduplicating ${email}:`);
      console.log(`     Keeping: ${toKeep.id}`);
      
      for (const user of toDelete) {
        console.log(`     Deleting: ${user.id}`);
        await db.collection('users').doc(user.id).delete();
        try {
          await auth.deleteUser(user.id);
        } catch (e) {
          // User might not exist in Auth
        }
        deletedUsers++;
      }
    }

    // Delete test collections
    for (const coll of testCollections) {
      console.log(`   Deleting collection: ${coll.name}`);
      const collection = db.collection(coll.name);
      const snapshot = await collection.get();
      
      // Delete in batches of 500
      const batchSize = 500;
      for (let i = 0; i < snapshot.docs.length; i += batchSize) {
        const batch = db.batch();
        const docs = snapshot.docs.slice(i, i + batchSize);
        
        docs.forEach(doc => {
          batch.delete(doc.ref);
        });
        
        await batch.commit();
        deletedDocs += docs.length;
      }
      
      deletedCollections++;
    }

    // ========================================
    // SUMMARY
    // ========================================
    console.log('\n✅ ========================================');
    console.log('✅ CLEANUP COMPLETE');
    console.log('✅ ========================================');
    console.log(`   Organizations deleted: ${deletedOrgs}`);
    console.log(`   Users deleted: ${deletedUsers}`);
    console.log(`   Collections deleted: ${deletedCollections}`);
    console.log(`   Documents deleted: ${deletedDocs}`);
    console.log();

    // Show final state
    const finalOrgs = await db.collection('organizations').get();
    const finalUsers = await db.collection('users').get();
    
    // Check for remaining duplicates
    const finalUsersByEmail = {};
    for (const userDoc of finalUsers.docs) {
      const email = userDoc.data().email;
      if (email) {
        finalUsersByEmail[email] = (finalUsersByEmail[email] || 0) + 1;
      }
    }
    const remainingDuplicates = Object.entries(finalUsersByEmail).filter(([_, count]) => count > 1).length;
    
    console.log('📊 FINAL DATABASE STATE:');
    console.log(`   Organizations: ${finalOrgs.size}`);
    console.log(`   Users: ${finalUsers.size}`);
    console.log(`   Duplicate emails: ${remainingDuplicates}`);
    console.log();
    
    if (remainingDuplicates === 0) {
      console.log('✅ Login should work now - no duplicate users!\n');
    } else {
      console.log('⚠️  Warning: Some duplicate users still exist\n');
    }

  } catch (error) {
    console.error('\n❌ Cleanup failed:', error);
    process.exit(1);
  }
}

cleanupAllTestData()
  .then(() => {
    console.log('✅ Script complete!\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('❌ Script failed:', error);
    process.exit(1);
  });
