/**
 * Set passwords for test accounts in dev Firebase
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Dev Firebase
const devServiceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
admin.initializeApp({
  credential: admin.credential.cert(devServiceAccount),
});
const auth = admin.auth();

// Accounts and passwords to set
const accounts = [
  { email: 'dstamper@rapidcompliance.us', password: 'Idoc74058!23' },
  { email: 'demo-auraflow@test.com', password: 'Test123!' },
  { email: 'demo-summitwm@test.com', password: 'Test123!' },
  { email: 'demo-pixelperfect@test.com', password: 'Test123!' },
  { email: 'demo-greenthumb@test.com', password: 'Test123!' },
  { email: 'demo-adventuregear@test.com', password: 'Test123!' },
  { email: '10@1010.com', password: 'Test123!' },
  { email: '123@test.com', password: 'Test123!' },
  { email: 'jamesstamper72@gmail.com', password: 'Test123!' },
  { email: 'dstamper@bliss.com', password: 'Test123!' },
];

async function setPasswords() {
  console.log('🔐 Setting passwords for test accounts...\n');
  
  let successCount = 0;
  let failedCount = 0;
  
  for (const account of accounts) {
    try {
      // Get user by email
      const user = await auth.getUserByEmail(account.email);
      
      // Update password
      await auth.updateUser(user.uid, {
        password: account.password
      });
      
      console.log(`✅ Password set for: ${account.email}`);
      successCount++;
      
    } catch (error) {
      console.error(`❌ Failed to set password for ${account.email}:`, error.message);
      failedCount++;
    }
  }
  
  console.log(`\n${'='.repeat(50)}`);
  console.log('🎉 Password Setup Complete!');
  console.log(`${'='.repeat(50)}`);
  console.log(`✅ Success: ${successCount} accounts`);
  console.log(`❌ Failed: ${failedCount} accounts`);
  console.log(`\n📝 Account Credentials:`);
  console.log(`   Admin: dstamper@rapidcompliance.us / Idoc74058!23`);
  console.log(`   Test accounts: Test123!`);
}

setPasswords()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });






