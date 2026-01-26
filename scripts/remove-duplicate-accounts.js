/**
 * Remove Duplicate User Accounts
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

async function removeDuplicates() {
  try {
    const email = 'dstamper@rapidcompliance.us';
    
    console.log('\n🔍 Checking Firebase Auth...\n');
    
    // Get the REAL Firebase Auth user
    const authUser = await auth.getUserByEmail(email);
    console.log(`✅ Firebase Auth user ID: ${authUser.uid}`);
    
    // Find all Firestore documents with this email
    console.log(`\n🔍 Checking Firestore documents...\n`);
    const usersSnapshot = await db.collection('users')
      .where('email', '==', email)
      .get();
    
    console.log(`Found ${usersSnapshot.size} Firestore document(s) with email ${email}:`);
    
    const toDelete = [];
    usersSnapshot.forEach(doc => {
      console.log(`   - ${doc.id} (${doc.id === authUser.uid ? 'CORRECT - matches Auth' : 'DUPLICATE - should be deleted'})`);
      if (doc.id !== authUser.uid) {
        toDelete.push(doc.id);
      }
    });
    
    // Delete duplicates
    if (toDelete.length > 0) {
      console.log(`\n🗑️ Deleting ${toDelete.length} duplicate document(s)...`);
      for (const uid of toDelete) {
        await db.collection('users').doc(uid).delete();
        console.log(`   ✅ Deleted ${uid}`);
      }
    } else {
      console.log(`\n✅ No duplicates found - all clean!`);
    }
    
    // Ensure the correct document has platform_admin role
    console.log(`\n🔧 Ensuring correct document has platform_admin role...`);
    await db.collection('users').doc(authUser.uid).set({
      email: email,
      name: 'David Stamper',
      displayName: 'David Stamper',
      role: 'platform_admin',
      organizationId: 'platform',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isPlatformAdmin: true,
      status: 'active',
    }, { merge: true });
    
    // Final verification
    const finalDoc = await db.collection('users').doc(authUser.uid).get();
    const finalData = finalDoc.data();
    
    console.log(`\n✅ CLEANUP COMPLETE`);
    console.log(`\n📄 Your account:`);
    console.log(`   UID: ${authUser.uid}`);
    console.log(`   Email: ${finalData.email}`);
    console.log(`   Role: ${finalData.role}`);
    console.log(`   Is Platform Admin: ${finalData.isPlatformAdmin}`);
    
    console.log(`\n✅ Try logging in again at http://localhost:3000/admin/login`);
    
  } catch (error) {
    console.error(`\n❌ Error:`, error.message);
    console.error(error);
  }
}

removeDuplicates()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
