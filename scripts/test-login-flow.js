/**
 * Test Login Flow
 * Simulates what happens when you try to log in
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  console.log('Connecting to Firebase Project: ' + projectId + '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();
const auth = admin.auth();

async function testLoginFlow() {
  const adminEmail = 'dstamper@rapidcompliance.us';
  
  console.log('Testing Login Flow for: ' + adminEmail);
  console.log('═══════════════════════════════════════════════════════════════\n');
  
  try {
    // Step 1: Check Firebase Auth
    console.log('Step 1: Checking Firebase Authentication...');
    const authUser = await auth.getUserByEmail(adminEmail);
    console.log('✅ Found in Auth');
    console.log('   UID: ' + authUser.uid);
    console.log('   Email Verified: ' + authUser.emailVerified);
    console.log('   Disabled: ' + authUser.disabled);
    
    if (authUser.disabled) {
      console.log('❌ PROBLEM: Account is disabled!\n');
      return;
    }
    
    if (!authUser.emailVerified) {
      console.log('⚠️  Warning: Email not verified\n');
    }
    
    console.log('');
    
    // Step 2: Check Firestore user document
    console.log('Step 2: Checking Firestore user document...');
    const userDoc = await db.collection('users').doc(authUser.uid).get();
    
    if (!userDoc.exists) {
      console.log('❌ PROBLEM: User document missing in Firestore!');
      console.log('   This will cause login to fail.\n');
      return;
    }
    
    const userData = userDoc.data();
    console.log('✅ Found user document');
    console.log('   Email: ' + userData.email);
    console.log('   Role: ' + userData.role);
    console.log('   Display Name: ' + userData.displayName);
    console.log('   Organization ID: ' + userData.organizationId);
    console.log('   Status: ' + (userData.status || 'active'));
    console.log('');
    
    // Step 3: Check organization
    console.log('Step 3: Checking organization...');
    
    if (userData.organizationId === 'platform') {
      console.log('✅ Super admin - no organization check needed\n');
    } else if (userData.organizationId) {
      const orgDoc = await db.collection('organizations').doc(userData.organizationId).get();
      
      if (!orgDoc.exists) {
        console.log('❌ PROBLEM: Organization not found!');
        console.log('   Missing org: ' + userData.organizationId + '\n');
        return;
      }
      
      const orgData = orgDoc.data();
      console.log('✅ Found organization');
      console.log('   Name: ' + orgData.name);
      console.log('   Status: ' + (orgData.status || 'active') + '\n');
    } else {
      console.log('⚠️  Warning: No organization ID set\n');
    }
    
    // Step 4: Check for any blocking conditions
    console.log('Step 4: Checking for login blockers...');
    
    const blockers = [];
    
    if (authUser.disabled) blockers.push('Account disabled in Auth');
    if (userData.status === 'inactive') blockers.push('User status is inactive');
    if (userData.status === 'suspended') blockers.push('User is suspended');
    
    if (blockers.length > 0) {
      console.log('❌ FOUND BLOCKERS:');
      blockers.forEach(b => console.log('   - ' + b));
      console.log('');
    } else {
      console.log('✅ No blockers found\n');
    }
    
    // Summary
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('📊 SUMMARY:\n');
    
    if (blockers.length === 0 && userDoc.exists && authUser.emailVerified && !authUser.disabled) {
      console.log('✅ Account looks good! Should be able to log in.');
      console.log('\nIf you still cannot log in, the issue might be:');
      console.log('1. Wrong password');
      console.log('2. Frontend/API connection issue');
      console.log('3. Browser cache/cookies');
      console.log('4. Environment variable mismatch\n');
      
      console.log('Try these steps:');
      console.log('1. Clear browser cache and cookies');
      console.log('2. Use incognito/private window');
      console.log('3. Check browser console for errors');
      console.log('4. Verify .env.local has correct Firebase config\n');
    } else {
      console.log('❌ Found issues that may prevent login (see above)\n');
    }
    
  } catch (error) {
    console.error('❌ Error during test:', error.message);
    console.error('\nFull error:', error);
  }
}

testLoginFlow().then(() => process.exit(0));
