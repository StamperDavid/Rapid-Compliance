/**
 * Check Account Status
 * Verify if accounts are enabled/disabled
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

async function checkAccount(email) {
  try {
    const user = await auth.getUserByEmail(email);
    
    console.log(`\n📧 ${email}`);
    console.log(`   UID: ${user.uid}`);
    console.log(`   Disabled: ${user.disabled}`);
    console.log(`   Email Verified: ${user.emailVerified}`);
    console.log(`   Created: ${user.metadata.creationTime}`);
    console.log(`   Last Sign In: ${user.metadata.lastSignInTime || 'Never'}`);
    console.log(`   Provider: ${user.providerData.map(p => p.providerId).join(', ')}`);
    
  } catch (error) {
    console.log(`\n📧 ${email}`);
    console.log(`   ❌ Error: ${error.message}`);
  }
}

async function main() {
  console.log('🔍 Checking Test Account Status\n');
  console.log(`Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}\n`);
  
  const emails = [
    'demo-auraflow@test.com',
    'demo-greenthumb@test.com',
    'demo-adventuregear@test.com',
    'demo-summitwm@test.com',
    'demo-pixelperfect@test.com',
    'dstamper@rapidcompliance.us',
  ];
  
  for (const email of emails) {
    await checkAccount(email);
  }
}

main().then(() => process.exit(0));
