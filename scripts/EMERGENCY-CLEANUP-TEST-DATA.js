/**
 * EMERGENCY: Clean up ALL test data from production database
 * DO NOT RUN THIS IF YOU HAVE LEGITIMATE ORGANIZATIONS/USERS WITH "TEST" IN THE NAME
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function cleanupTestData() {
  try {
    console.log('\n🚨 EMERGENCY CLEANUP: Removing ALL test data\n');
    console.log('='.repeat(80));
    
    let deletedUsers = 0;
    let deletedOrgs = 0;
    
    // 1. Delete test/demo USERS
    console.log('\n1️⃣ Cleaning up test users...\n');
    const usersSnapshot = await db.collection('users').get();
    
    for (const doc of usersSnapshot.docs) {
      const data = doc.data();
      const email = data.email || '';
      const name = data.name || '';
      const uid = doc.id;
      
      // DO NOT DELETE PRODUCTION USER
      if (email === 'dstamper@rapidcompliance.us') {
        console.log(`   ✅ KEEPING production user: ${email}`);
        continue;
      }
      
      // Check if it's test data
      const isTest = 
        email.includes('test') ||
        email.includes('demo') ||
        email.includes('example') ||
        email.includes('@bliss.com') || // Based on investigation
        email === '123@test.com' ||
        name.toLowerCase().includes('test') ||
        name.toLowerCase().includes('demo');
      
      if (isTest) {
        console.log(`   🗑️ Deleting test user: ${email} (${uid})`);
        
        // Delete from Firestore
        await db.collection('users').doc(uid).delete();
        
        // Delete from Firebase Auth
        try {
          await auth.deleteUser(uid);
        } catch (authError) {
          // User might not exist in Auth, that's okay
        }
        
        deletedUsers++;
      }
    }
    
    // 2. Delete test/demo ORGANIZATIONS
    console.log(`\n2️⃣ Cleaning up test organizations...\n`);
    const orgsSnapshot = await db.collection('organizations').get();
    
    for (const doc of orgsSnapshot.docs) {
      const data = doc.data();
      const name = data.name || '';
      const email = data.contactEmail || '';
      const orgId = doc.id;
      
      // Check if it's test data
      const isTest = 
        name.toLowerCase().includes('test') ||
        name.toLowerCase().includes('demo') ||
        name.toLowerCase().includes('example') ||
        name.toLowerCase().includes('sample') ||
        email.includes('test') ||
        email.includes('demo') ||
        email.includes('example') ||
        orgId.includes('test') ||
        orgId.includes('demo') ||
        orgId === 'platform'; // Platform org used for admin
      
      if (isTest && orgId !== 'platform') {
        console.log(`   🗑️ Deleting test org: ${name} (${orgId})`);
        
        // Delete the organization document
        await db.collection('organizations').doc(orgId).delete();
        
        // Delete any subcollections (members, etc.)
        // Note: Firestore doesn't auto-delete subcollections, but for cleanup purposes
        // we'll delete the main doc and orphaned subcollections will be cleaned up later
        
        deletedOrgs++;
      } else if (orgId === 'platform') {
        console.log(`   ✅ KEEPING platform org (needed for super_admin)`);
      } else {
        console.log(`   ✅ KEEPING production org: ${name} (${orgId})`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ CLEANUP COMPLETE\n');
    console.log(`Deleted ${deletedUsers} test user(s)`);
    console.log(`Deleted ${deletedOrgs} test organization(s)`);
    
    // Final verification
    console.log('\n📊 Final verification...\n');
    const remainingUsers = await db.collection('users').get();
    const remainingOrgs = await db.collection('organizations').get();
    
    console.log(`Remaining users: ${remainingUsers.size}`);
    console.log(`Remaining organizations: ${remainingOrgs.size}`);
    
    console.log('\nRemaining users:');
    remainingUsers.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.email} (${data.role || 'no role'})`);
    });
    
    console.log('\nRemaining organizations:');
    remainingOrgs.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.name || doc.id}`);
    });
    
    console.log('\n✅ Your production database is now clean!');
    
  } catch (error) {
    console.error(`\n❌ Error during cleanup:`, error.message);
    console.error(error);
  }
}

cleanupTestData()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
