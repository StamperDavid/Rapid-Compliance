/**
 * Setup Admin User in Production
 */

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-prod-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const auth = admin.auth();
const db = admin.firestore();

const ADMIN_EMAIL = 'dstamper@rapidcompliance.us';
const ADMIN_PASSWORD = 'Idoc74058!23';
const ADMIN_UID = 'Op7waMzL6IdY6cFLTNVXqyQVOy92';

async function setupAdmin() {
  console.log('Setting up admin user in production...\n');
  
  try {
    // Try to update existing user
    await auth.updateUser(ADMIN_UID, {
      password: ADMIN_PASSWORD
    });
    console.log('✅ Updated existing admin user password\n');
  } catch (error) {
    // User doesn't exist, create it
    console.log('Creating new admin user...\n');
    
    await auth.createUser({
      uid: ADMIN_UID,
      email: ADMIN_EMAIL,
      password: ADMIN_PASSWORD,
      emailVerified: true,
      displayName: 'David Stamper'
    });
    
    await db.collection('users').doc(ADMIN_UID).set({
      email: ADMIN_EMAIL,
      role: 'platform_admin',
      displayName: 'David Stamper',
      name: 'David Stamper',
      organizationId: 'platform',
      currentOrganizationId: 'platform',
      isPlatformAdmin: true,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp()
    });
    
    console.log('✅ Created new admin user\n');
  }
  
  console.log('Admin credentials for PRODUCTION:');
  console.log('Email: ' + ADMIN_EMAIL);
  console.log('Password: ' + ADMIN_PASSWORD);
  console.log('');
}

setupAdmin()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Error:', error);
    process.exit(1);
  });
