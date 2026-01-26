/**
 * Fix Super Admin Access for David
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function fixAdminAccess() {
  try {
    const email = 'dstamper@rapidcompliance.us';
    
    console.log('\n🔍 Looking up your account...\n');
    
    // Get Firebase Auth user
    const userRecord = await auth.getUserByEmail(email);
    console.log(`✅ Found Firebase Auth user: ${email}`);
    console.log(`   User ID: ${userRecord.uid}`);
    
    // Get current Firestore document
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    
    if (userDoc.exists) {
      const currentData = userDoc.data();
      console.log(`\n📄 Current Firestore data:`);
      console.log(`   Email: ${currentData.email}`);
      console.log(`   Role: ${currentData.role}`);
      console.log(`   Org ID: ${currentData.organizationId}`);
    } else {
      console.log(`\n⚠️ No Firestore document found - creating one...`);
    }
    
    // Update to platform_admin
    console.log(`\n🔧 Updating to platform_admin...`);
    
    await db.collection('users').doc(userRecord.uid).set({
      email: email,
      name: 'David Stamper',
      displayName: 'David Stamper',
      role: 'platform_admin',
      organizationId: 'platform',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isPlatformAdmin: true,
      status: 'active',
    }, { merge: true });
    
    // Verify the update
    const updatedDoc = await db.collection('users').doc(userRecord.uid).get();
    const updatedData = updatedDoc.data();
    
    console.log(`\n✅ UPDATE COMPLETE`);
    console.log(`\n📄 Updated Firestore data:`);
    console.log(`   Email: ${updatedData.email}`);
    console.log(`   Role: ${updatedData.role}`);
    console.log(`   Org ID: ${updatedData.organizationId}`);
    console.log(`   Is Platform Admin: ${updatedData.isPlatformAdmin}`);
    
    // Check for other super admins
    console.log(`\n🔍 Checking for other platform_admin accounts...`);
    const superAdminsSnapshot = await db.collection('users')
      .where('role', '==', 'platform_admin')
      .get();
    
    console.log(`\nFound ${superAdminsSnapshot.size} platform_admin account(s):`);
    superAdminsSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`   - ${data.email} (${doc.id})`);
    });
    
    if (superAdminsSnapshot.size > 1) {
      console.log(`\n⚠️ WARNING: Multiple platform_admin accounts exist!`);
      console.log(`   Only you should have platform_admin access.`);
    }
    
    console.log(`\n✅ You can now login at http://localhost:3000/admin/login`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: (your existing password)`);
    
  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error);
  }
}

fixAdminAccess()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
