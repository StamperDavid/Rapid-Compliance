/**
 * Reset Admin Password
 * Generates a password reset link for the admin account
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
  const adminEmail = 'dstamper@rapidcompliance.us';
  
  console.log('🔐 Generating password reset link for:', adminEmail);
  console.log('');
  
  try {
    const link = await auth.generatePasswordResetLink(adminEmail);
    
    console.log('✅ Password reset link generated!\n');
    console.log('Copy and paste this link into your browser:\n');
    console.log(link);
    console.log('');
    console.log('This link will allow you to set a new password.\n');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

resetPassword().then(() => process.exit(0));
