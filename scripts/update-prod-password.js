/**
 * Update Admin Password in Production
 */

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-prod-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const auth = admin.auth();

const ADMIN_EMAIL = 'dstamper@rapidcompliance.us';
const ADMIN_PASSWORD = 'Idoc74058!23';

async function updatePassword() {
  console.log('Updating admin password in production...\n');
  
  try {
    // Get user by email
    const user = await auth.getUserByEmail(ADMIN_EMAIL);
    
    // Update password
    await auth.updateUser(user.uid, {
      password: ADMIN_PASSWORD,
      emailVerified: true
    });
    
    console.log('✅ Password updated successfully!\n');
    console.log('You can now log into PRODUCTION with:');
    console.log('Email: ' + ADMIN_EMAIL);
    console.log('Password: ' + ADMIN_PASSWORD);
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

updatePassword().then(() => process.exit(0));
