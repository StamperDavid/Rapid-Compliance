/**
 * Create the missing "platform" organization for admin users
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

async function createPlatformOrg() {
  console.log('\n🏗️  Creating "platform" organization...\n');
  
  const platformData = {
    name: 'Platform Admin',
    slug: 'platform',
    plan: 'enterprise',
    status: 'active',
    createdAt: new Date(),
    updatedAt: new Date(),
    description: 'System administration organization',
    // This is NOT test data, so no isAutomatedTest flag
  };
  
  await db.collection('organizations').doc('platform').set(platformData);
  
  console.log('✅ Created "platform" organization');
  console.log('   ID: platform');
  console.log('   Name: Platform Admin');
  console.log('');
  console.log('Your admin account should now work correctly!');
  console.log('');
}

createPlatformOrg()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Error:', error);
    process.exit(1);
  });
