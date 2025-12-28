/**
 * Reset all test account passwords to a known value
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

// Standard password for all test accounts
const STANDARD_PASSWORD = 'Testing123!';

async function resetPasswords() {
  console.log('🔐 Resetting ALL test account passwords...\n');
  console.log(`Setting all passwords to: ${STANDARD_PASSWORD}\n`);
  console.log('='.repeat(80));
  
  try {
    const listUsersResult = await auth.listUsers(1000);
    
    let successCount = 0;
    let failCount = 0;
    
    for (const user of listUsersResult.users) {
      try {
        await auth.updateUser(user.uid, {
          password: STANDARD_PASSWORD
        });
        console.log(`✅ ${user.email}`);
        successCount++;
      } catch (err) {
        console.log(`❌ ${user.email} - Error: ${err.message}`);
        failCount++;
      }
    }
    
    console.log('\n' + '='.repeat(80));
    console.log(`\n✅ Success: ${successCount} accounts`);
    console.log(`❌ Failed: ${failCount} accounts`);
    console.log(`\n📝 ALL ACCOUNTS NOW USE PASSWORD: ${STANDARD_PASSWORD}\n`);
    
    console.log('🎯 TEST ACCOUNTS YOU CAN USE:\n');
    console.log('   Email: demo-auraflow@test.com');
    console.log('   Email: demo-greenthumb@test.com');
    console.log('   Email: demo-adventuregear@test.com');
    console.log('   Email: demo-summitwm@test.com');
    console.log('   Email: demo-pixelperfect@test.com');
    console.log('   Email: admin@auraflow.test');
    console.log('   Email: admin@greenthumb.test');
    console.log('   Email: admin@adventuregear.test');
    console.log(`\n   Password for all: ${STANDARD_PASSWORD}\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    throw error;
  }
}

resetPasswords()
  .then(() => {
    console.log('✅ Password reset complete! You can now sign in.\n');
    process.exit(0);
  })
  .catch(err => {
    console.error('❌ Script failed:', err);
    process.exit(1);
  });


