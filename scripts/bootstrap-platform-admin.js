/**
 * Bootstrap Admin Account
 *
 * One-time utility script to set up the admin account.
 * Target User: dstamper@rapidcompliance.us (UID: Op7waMzL6IdY6cFLTNVXqyQVOy92)
 *
 * This script:
 * 1. Looks up the user by email in Firebase Auth
 * 2. Sets custom claims: { role: "admin", admin: true }
 * 3. Updates the Firestore users document with role: "admin"
 * 4. Verifies the claims were applied correctly
 * 
 * Safe to run multiple times (idempotent).
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Target user configuration
const TARGET_EMAIL = 'dstamper@rapidcompliance.us';
const EXPECTED_UID = 'Op7waMzL6IdY6cFLTNVXqyQVOy92';

// Initialize Firebase Admin (check serviceAccountKey.json first, then env vars)
if (!admin.apps.length) {
  const serviceAccountPath = path.join(__dirname, '..', 'serviceAccountKey.json');
  
  if (fs.existsSync(serviceAccountPath)) {
    const serviceAccount = require(serviceAccountPath);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Using local serviceAccountKey.json');
  } else if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount),
    });
    console.log('Using FIREBASE_SERVICE_ACCOUNT_KEY environment variable');
  } else {
    console.error('ERROR: No Firebase credentials found!');
    console.error('Please ensure serviceAccountKey.json exists in the project root');
    console.error('or set the FIREBASE_SERVICE_ACCOUNT_KEY environment variable.');
    process.exit(1);
  }
}

const db = admin.firestore();
const auth = admin.auth();

async function bootstrapAdmin() {
  console.log('\n========================================');
  console.log('   BOOTSTRAP PLATFORM ADMIN ACCOUNT');
  console.log('========================================\n');
  
  try {
    // Step 1: Look up user by email
    console.log('[1/5] Looking up user: ' + TARGET_EMAIL + '...');
    
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(TARGET_EMAIL);
    } catch (error) {
      if (error.code === 'auth/user-not-found') {
        console.error('ERROR: User not found: ' + TARGET_EMAIL);
        console.error('Please ensure the user exists in Firebase Auth before running this script.');
        process.exit(1);
      }
      throw error;
    }
    
    console.log('   Found user: ' + userRecord.email);
    console.log('   UID: ' + userRecord.uid);
    console.log('   Display Name: ' + (userRecord.displayName || '(not set)'));
    
    // Verify UID matches expected
    if (userRecord.uid !== EXPECTED_UID) {
      console.warn('\n   WARNING: UID mismatch!');
      console.warn('   Expected: ' + EXPECTED_UID);
      console.warn('   Actual:   ' + userRecord.uid);
      console.warn('   Proceeding with actual UID...\n');
    }
    
    const uid = userRecord.uid;
    
    // Step 2: Check current custom claims
    console.log('\n[2/5] Checking current custom claims...');
    const currentClaims = userRecord.customClaims || {};
    console.log('   Current claims: ' + JSON.stringify(currentClaims));
    
    // Step 3: Set custom claims
    console.log('\n[3/5] Setting custom claims...');
    const newClaims = {
      role: 'admin',
      admin: true
    };
    
    await auth.setCustomUserClaims(uid, newClaims);
    console.log('   Custom claims set: ' + JSON.stringify(newClaims));
    
    // Step 4: Update Firestore user document
    console.log('\n[4/5] Updating Firestore user document...');
    
    // First, check if document exists
    const userDocRef = db.collection('users').doc(uid);
    const userDocSnapshot = await userDocRef.get();
    
    if (userDocSnapshot.exists) {
      const currentData = userDocSnapshot.data();
      console.log('   Current Firestore role: ' + (currentData.role || '(not set)'));
      console.log('   Current organizationId: ' + (currentData.organizationId || '(not set)'));
    } else {
      console.log('   No existing Firestore document found. Creating new document...');
    }
    
    // Update/create document with admin role
    await userDocRef.set({
      email: TARGET_EMAIL,
      role: 'admin',  // Binary RBAC: admin | user
      organizationId: 'platform',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      status: 'active'
    }, { merge: true });
    
    console.log('   Firestore document updated successfully');
    
    // Step 5: Verify claims were applied
    console.log('\n[5/5] Verifying custom claims were applied...');
    
    // Re-fetch user record to verify claims
    const verifyUserRecord = await auth.getUser(uid);
    const verifiedClaims = verifyUserRecord.customClaims || {};
    
    console.log('   Verified claims: ' + JSON.stringify(verifiedClaims));
    
    // Verify Firestore document
    const verifyDocSnapshot = await userDocRef.get();
    const verifiedData = verifyDocSnapshot.data();
    
    console.log('   Verified Firestore role: ' + verifiedData.role);
    console.log('   Verified organizationId: ' + verifiedData.organizationId);
    
    // Check if verification passed
    const claimsValid = verifiedClaims.role === 'admin' && verifiedClaims.admin === true;
    const firestoreValid = verifiedData.role === 'admin';
    
    console.log('\n========================================');
    console.log('             RESULTS');
    console.log('========================================');
    
    if (claimsValid && firestoreValid) {
      console.log('\nSUCCESS: Admin bootstrap complete!');
      console.log('\nUser Details:');
      console.log('   Email: ' + TARGET_EMAIL);
      console.log('   UID: ' + uid);
      console.log('   Custom Claims: ' + JSON.stringify(verifiedClaims));
      console.log('   Firestore Role: ' + verifiedData.role);
      console.log('\nThe user now has admin privileges.');
      console.log('Note: User must log out and log back in for claims to take effect.');
    } else {
      console.error('\nWARNING: Verification issues detected!');
      if (!claimsValid) {
        console.error('   - Custom claims verification failed');
        console.error('     Expected: { role: "admin", admin: true }');
        console.error('     Got: ' + JSON.stringify(verifiedClaims));
      }
      if (!firestoreValid) {
        console.error('   - Firestore role verification failed');
        console.error('     Expected: admin');
        console.error('     Got: ' + verifiedData.role);
      }
      process.exit(1);
    }
    
  } catch (error) {
    console.error('\nERROR: Bootstrap failed!');
    console.error('   ' + error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the bootstrap
bootstrapAdmin()
  .then(() => {
    console.log('\n');
    process.exit(0);
  })
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
