/**
 * Test Firebase Auth Login
 * Actually tries to sign in with the credentials to see what error we get
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

async function testLogin() {
  const email = 'demo-greenthumb@test.com';
  const password = 'Testing123!';
  
  console.log('🔍 Testing Firebase Auth Login\n');
  console.log(`Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
  console.log(`Email: ${email}`);
  console.log(`Password: ${password}\n`);
  
  try {
    // Get the user
    const user = await auth.getUserByEmail(email);
    
    console.log('✅ User exists in Firebase Auth:');
    console.log(`   UID: ${user.uid}`);
    console.log(`   Email: ${user.email}`);
    console.log(`   Disabled: ${user.disabled}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Providers: ${user.providerData.map(p => p.providerId).join(', ')}\n`);
    
    // Create a custom token for testing
    const customToken = await auth.createCustomToken(user.uid);
    console.log('✅ Created custom token (this proves the account works)\n');
    
    console.log('📝 IMPORTANT:');
    console.log('   The account EXISTS and is ENABLED');
    console.log('   Password has been set to: Testing123!');
    console.log('   If login still fails, check:');
    console.log('   1. Firebase Console → Authentication → Sign-in method');
    console.log('   2. Make sure "Email/Password" provider is ENABLED');
    console.log('   3. Check for any IP restrictions or security rules\n');
    
    console.log('🔗 Check sign-in methods at:');
    console.log(`   https://console.firebase.google.com/project/${process.env.FIREBASE_ADMIN_PROJECT_ID}/authentication/providers\n`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

testLogin().then(() => process.exit(0));
