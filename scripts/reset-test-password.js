/**
 * Reset Password for Test Account
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const auth = admin.auth();

async function resetPassword() {
  const email = 'demo-greenthumb@test.com';
  const newPassword = 'Testing123!';
  
  try {
    console.log(`🔑 Resetting password for: ${email}\n`);
    
    // Get user by email
    const user = await auth.getUserByEmail(email);
    
    // Update password
    await auth.updateUser(user.uid, {
      password: newPassword,
    });
    
    console.log(`✅ Password reset successfully!`);
    console.log(`\nLogin credentials:`);
    console.log(`   Email: ${email}`);
    console.log(`   Password: ${newPassword}\n`);
    console.log(`Try logging in at: http://localhost:3000/admin-login\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetPassword().then(() => process.exit(0));
