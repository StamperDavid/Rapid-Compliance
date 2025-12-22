/**
 * Import users from Firebase auth export to dev
 * Creates users without passwords - they'll need to reset
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Dev Firebase
const devServiceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
const devApp = admin.initializeApp({
  credential: admin.credential.cert(devServiceAccount),
});
const devAuth = devApp.auth();
const devDb = admin.firestore();

async function importUsers() {
  console.log('🔄 Importing users to DEV from backup...\n');
  
  // Read the exported users file
  const usersBackup = JSON.parse(
    fs.readFileSync(path.join(__dirname, '..', 'users-backup.json'), 'utf8')
  );
  
  console.log(`📥 Found ${usersBackup.users.length} users in backup\n`);
  
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  
  for (const user of usersBackup.users) {
    try {
      // Check if user already exists
      try {
        await devAuth.getUser(user.localId);
        console.log(`⏭️  User already exists: ${user.email || user.localId}`);
        skippedCount++;
        continue;
      } catch (error) {
        // User doesn't exist, proceed
      }
      
      // Create user in dev (without password - they'll need to reset)
      const userRecord = {
        uid: user.localId,
        email: user.email,
        emailVerified: user.emailVerified || false,
        displayName: user.displayName,
        photoURL: user.photoUrl,
        disabled: user.disabled || false,
      };
      
      await devAuth.createUser(userRecord);
      console.log(`✅ Created user: ${user.email || user.localId}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Failed to create user ${user.email}:`, error.message);
      failedCount++;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log('🎉 User Import Complete!');
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Successfully created: ${successCount} users`);
  console.log(`⏭️  Skipped (already exist): ${skippedCount} users`);
  console.log(`❌ Failed: ${failedCount} users`);
  console.log(`\n⚠️  Important:`);
  console.log('   - Users created WITHOUT passwords');
  console.log('   - Known passwords:');
  console.log('     • Admin: dstamper@rapidcompliance.us - Idoc74058!23');
  console.log('     • Test accounts: Test123!');
  console.log('   - Set these manually in Firebase Console > Authentication');
}

importUsers()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });




