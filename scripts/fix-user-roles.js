/**
 * Fix user roles in dev Firestore
 * The users collection needs to have proper role data
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Dev Firebase
const devServiceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(devServiceAccount),
});
const db = admin.firestore();

async function fixUserRoles() {
  console.log('🔧 Fixing user roles in Firestore...\n');
  
  try {
    // Get all users from Firestore
    const usersSnapshot = await db.collection('users').get();
    
    if (usersSnapshot.empty) {
      console.log('⚠️  No users found in Firestore users collection');
      return;
    }
    
    console.log(`📥 Found ${usersSnapshot.size} users in Firestore\n`);
    
    let successCount = 0;
    let failedCount = 0;
    
    for (const doc of usersSnapshot.docs) {
      try {
        const userData = doc.data();
        const userId = doc.id;
        
        // Determine the correct role
        let role = userData.role;

        // If no role or invalid role, assign based on email
        if (!role || !['admin', 'user'].includes(role)) {
          if (userData.email === 'dstamper@rapidcompliance.us') {
            role = 'admin';
          } else {
            role = 'user';
          }
        }
        
        // Update user document with proper structure
        await db.collection('users').doc(userId).update({
          role: role,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        
        console.log(`✅ Fixed role for ${userData.email || userId}: ${role}`);
        successCount++;
        
      } catch (error) {
        console.error(`❌ Failed to fix user ${doc.id}:`, error.message);
        failedCount++;
      }
    }
    
    console.log(`\n${'='.repeat(50)}`);
    console.log('🎉 User Role Fix Complete!');
    console.log(`${'='.repeat(50)}`);
    console.log(`✅ Success: ${successCount} users`);
    console.log(`❌ Failed: ${failedCount} users`);
    
  } catch (error) {
    console.error('❌ Fatal error:', error);
    throw error;
  }
}

fixUserRoles()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });







