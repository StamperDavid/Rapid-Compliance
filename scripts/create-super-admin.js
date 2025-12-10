/**
 * Create Super Admin Account
 * Run this ONCE to create your platform super admin account
 * This user will have full access to ALL organizations for IT support
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');
const readline = require('readline');

// Initialize Firebase Admin
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('✅ Using local serviceAccountKey.json');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
  } else {
    console.error('❌ No Firebase credentials found!');
    console.error('Please ensure serviceAccountKey.json exists in the project root.');
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

// Super Admin Configuration
const SUPER_ADMIN = {
  email: 'admin@your-platform.com', // Change this
  password: 'SuperSecurePassword123!', // Change this - use a strong password
  displayName: 'Platform Super Admin',
};

async function promptForCredentials() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    console.log('\n🔐 CREATE SUPER ADMIN ACCOUNT');
    console.log('='.repeat(50));
    console.log('This account will have FULL access to ALL organizations.\n');
    
    rl.question('Enter admin email: ', (email) => {
      rl.question('Enter admin password (min 8 chars): ', (password) => {
        rl.question('Enter display name: ', (displayName) => {
          rl.close();
          resolve({ email, password, displayName });
        });
      });
    });
  });
}

async function createSuperAdmin(credentials) {
  try {
    console.log(`\n📝 Creating super admin: ${credentials.email}...`);
    
    // Check if user already exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(credentials.email);
      console.log(`⚠️ User already exists: ${credentials.email}`);
      console.log('Updating to super_admin role...');
    } catch (error) {
      // Create new user
      userRecord = await auth.createUser({
        email: credentials.email,
        password: credentials.password,
        displayName: credentials.displayName,
        emailVerified: true,
      });
      console.log(`✅ Created Firebase Auth user: ${credentials.email}`);
    }
    
    // Create/update user document with super_admin role
    await db.collection('users').doc(userRecord.uid).set({
      email: credentials.email,
      name: credentials.displayName,
      role: 'super_admin', // THE KEY - this grants full access
      organizationId: 'platform', // Special platform org ID
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      isSuperAdmin: true,
    }, { merge: true });
    
    console.log(`✅ Created/updated user document with super_admin role`);
    
    // Create platform organization if it doesn't exist
    const platformOrgRef = db.collection('organizations').doc('platform');
    const platformOrg = await platformOrgRef.get();
    
    if (!platformOrg.exists) {
      await platformOrgRef.set({
        name: 'Platform Administration',
        type: 'platform',
        status: 'active',
        plan: 'enterprise',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: userRecord.uid,
        settings: {
          isSystemOrg: true,
        }
      });
      console.log(`✅ Created platform organization`);
    }
    
    // Add super admin to platform org members
    await platformOrgRef.collection('members').doc(userRecord.uid).set({
      userId: userRecord.uid,
      email: credentials.email,
      role: 'super_admin',
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`✅ Added to platform organization members`);
    
    return { success: true, userId: userRecord.uid };
    
  } catch (error) {
    console.error(`❌ Error creating super admin:`, error.message);
    return { success: false, error: error.message };
  }
}

async function main() {
  // Check if running with arguments
  const args = process.argv.slice(2);
  let credentials;
  
  if (args.length >= 2) {
    // Use command line arguments: node create-super-admin.js email password [name]
    credentials = {
      email: args[0],
      password: args[1],
      displayName: args[2] || 'Platform Super Admin'
    };
  } else {
    // Interactive mode
    credentials = await promptForCredentials();
  }
  
  if (!credentials.email || !credentials.password) {
    console.error('❌ Email and password are required!');
    process.exit(1);
  }
  
  if (credentials.password.length < 8) {
    console.error('❌ Password must be at least 8 characters!');
    process.exit(1);
  }
  
  const result = await createSuperAdmin(credentials);
  
  if (result.success) {
    console.log('\n' + '='.repeat(50));
    console.log('🎉 SUPER ADMIN CREATED SUCCESSFULLY!');
    console.log('='.repeat(50));
    console.log(`\nEmail: ${credentials.email}`);
    console.log(`Password: ${credentials.password}`);
    console.log(`User ID: ${result.userId}`);
    console.log('\n⚠️ IMPORTANT:');
    console.log('1. Save these credentials securely');
    console.log('2. This account has FULL access to ALL data');
    console.log('3. Use for IT support and platform administration only');
    console.log('\nLogin at: http://localhost:3000/admin/login');
  } else {
    console.error('\n❌ Failed to create super admin:', result.error);
    process.exit(1);
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });


