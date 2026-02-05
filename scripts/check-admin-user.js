/**
 * Check admin user's role and org status
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function checkAdmin() {
  console.log('\n🔍 Checking admin user: dstamper@rapidcompliance.us\n');
  
  try {
    // Find user by email in Auth
    const authUser = await auth.getUserByEmail('dstamper@rapidcompliance.us');
    console.log('✅ Found in Firebase Auth:');
    console.log(`   UID: ${authUser.uid}`);
    console.log(`   Email: ${authUser.email}`);
    console.log(`   Email Verified: ${authUser.emailVerified}`);
    console.log('');
    
    // Get user document from Firestore
    const userDoc = await db.collection('users').doc(authUser.uid).get();
    
    if (userDoc.exists) {
      const userData = userDoc.data();
      console.log('✅ Found in Firestore:');
      console.log(`   Email: ${userData.email}`);
      console.log(`   Role: ${userData.role || 'NOT SET'}`);
      console.log(`   Organization ID: ${userData.organizationId || 'NOT SET'}`);
      console.log('');
      
      // Check if org exists
      if (userData.organizationId) {
        const orgDoc = await db.collection('organizations').doc(userData.organizationId).get();
        if (orgDoc.exists) {
          console.log(`✅ Organization "${userData.organizationId}" EXISTS`);
          console.log(`   Name: ${orgDoc.data().name}`);
        } else {
          console.log(`❌ Organization "${userData.organizationId}" DOES NOT EXIST`);
          console.log('   This is the problem - user is orphaned!');
        }
        console.log('');
      }
      
      // Check permissions
      console.log('🔐 PERMISSION CHECK:');
      if (userData.role === 'admin') {
        console.log('   ✅ Has admin role - should be able to create orgs');
      } else if (userData.role === 'user') {
        console.log(`   ⚠️  Has user role - limited access`);
      } else {
        console.log(`   ❌ Has ${userData.role || 'NO'} role - CANNOT create orgs`);
      }
      console.log('');

      // Recommendation
      console.log('💡 SOLUTION:');
      if (!userData.organizationId || userData.organizationId === 'platform') {
        console.log('   1. Create the "platform" organization');
        console.log('      Run: node scripts/create-platform-org.js');
        console.log('');
        console.log('   2. Ensure user has admin role');
        if (userData.role !== 'admin') {
          console.log('      Need to update user role to "admin"');
        }
      }
      console.log('');
      
    } else {
      console.log('❌ User document does NOT exist in Firestore');
      console.log('   User exists in Auth but has no Firestore profile!');
      console.log('');
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkAdmin()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
