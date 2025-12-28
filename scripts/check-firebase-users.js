/**
 * Quick script to check what users exist in Firebase Auth
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  let credential;
  try {
    const serviceAccount = require('../serviceAccountKey.json');
    credential = admin.credential.cert(serviceAccount);
  } catch (err) {
    console.error('❌ Could not load serviceAccountKey.json');
    process.exit(1);
  }

  admin.initializeApp({ credential });
}

const auth = admin.auth();
const db = admin.firestore();

async function checkUsers() {
  console.log('🔍 Checking Firebase Auth Users...\n');
  
  try {
    const listUsersResult = await auth.listUsers(1000);
    
    if (listUsersResult.users.length === 0) {
      console.log('⚠️  NO USERS FOUND IN FIREBASE AUTH\n');
      console.log('You need to create test accounts first!');
      console.log('Run: node scripts/seed-test-accounts.js\n');
      return;
    }
    
    console.log(`Found ${listUsersResult.users.length} users:\n`);
    console.log('='.repeat(80));
    
    for (const user of listUsersResult.users) {
      console.log(`\n📧 Email: ${user.email}`);
      console.log(`   UID: ${user.uid}`);
      console.log(`   Verified: ${user.emailVerified}`);
      
      // Check if user document exists in Firestore
      try {
        const userDoc = await db.collection('users').doc(user.uid).get();
        if (userDoc.exists) {
          const userData = userDoc.data();
          console.log(`   ✅ Firestore document exists`);
          console.log(`   Organization ID: ${userData.organizationId || 'MISSING!'}`);
          console.log(`   Role: ${userData.role || 'MISSING!'}`);
        } else {
          console.log(`   ❌ NO FIRESTORE DOCUMENT (This will cause login to fail!)`);
        }
      } catch (err) {
        console.log(`   ❌ Error checking Firestore: ${err.message}`);
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log('\n✅ Check complete!\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkUsers()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });


