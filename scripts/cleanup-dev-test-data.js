/**
 * Cleanup Test Data from DEV Database
 * Removes all test-org-* organizations that tests created
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function cleanupDevTestData() {
  console.log('\n🧹 CLEANING UP TEST DATA FROM DEV DATABASE\n');
  console.log('='.repeat(80));
  
  let deletedOrgs = 0;
  let deletedUsers = 0;
  
  // Get ALL organizations
  const orgsSnapshot = await db.collection('organizations').get();
  console.log(`Found ${orgsSnapshot.size} total organizations\n`);
  
  // Delete test organizations (test-org-* pattern)
  for (const orgDoc of orgsSnapshot.docs) {
    const orgId = orgDoc.id;
    const orgData = orgDoc.data();
    const orgName = orgData.name || orgId;
    
    // Check if it's a test organization
    const isTestOrg = 
      orgId.startsWith('test-org-') ||
      orgId.startsWith('e2e-test-org-') ||
      orgId.startsWith('backward-compat-test-org') ||
      orgId === 'org_change_this' ||
      orgId === 'platform-admin';
    
    if (isTestOrg) {
      console.log(`   🗑️ Deleting: ${orgName} (${orgId})`);
      
      // Delete organization
      await db.collection('organizations').doc(orgId).delete();
      deletedOrgs++;
      
      // Find and delete users belonging to this org
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
        
        // Delete from Auth
        try {
          await auth.deleteUser(uid);
        } catch (e) {
          // Might not exist in Auth
        }
        
        deletedUsers++;
      }
    }
  }
  
  console.log('\n' + '='.repeat(80));
  console.log('🧹 CLEANUP COMPLETE');
  console.log('='.repeat(80));
  console.log(`\nDeleted ${deletedOrgs} test organizations`);
  console.log(`Deleted ${deletedUsers} test users\n`);
  
  // Show remaining
  const finalOrgs = await db.collection('organizations').get();
  const finalUsers = await db.collection('users').get();
  
  console.log('📊 DEV DATABASE STATE:');
  console.log(`   Organizations: ${finalOrgs.size}`);
  console.log(`   Users: ${finalUsers.size}\n`);
}

cleanupDevTestData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
