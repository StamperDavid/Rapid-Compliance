/**
 * Complete Test Account Fix
 * 
 * 1. Ensures all 5 test accounts exist in Firebase Auth with correct passwords
 * 2. Ensures corresponding Firestore user documents exist
 * 3. Ensures organizations exist and are linked
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

const db = admin.firestore();
const auth = admin.auth();

const TEST_ACCOUNTS = [
  {
    email: 'demo-auraflow@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - AuraFlow',
    orgId: 'org_1767162182929_zybiwt',
    orgName: 'AuraFlow Analytics (TEST)',
  },
  {
    email: 'demo-greenthumb@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - GreenThumb',
    orgId: 'org_1767162183846_33y89i',
    orgName: 'GreenThumb Landscaping (TEST)',
  },
  {
    email: 'demo-adventuregear@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - Adventure Gear',
    orgId: 'org_1767162184756_5xf9a9',
    orgName: 'The Adventure Gear Shop (TEST)',
  },
  {
    email: 'demo-summitwm@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - Summit',
    orgId: 'org_1767162185614_xo5ryr',
    orgName: 'Summit Wealth Management (TEST)',
  },
  {
    email: 'demo-pixelperfect@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - PixelPerfect',
    orgId: 'org_1767162186490_tptncm',
    orgName: 'PixelPerfect Design Co. (TEST)',
  },
];

async function fixTestAccounts() {
  console.log('🔧 Fixing Test Accounts...\n');
  
  for (const account of TEST_ACCOUNTS) {
    console.log(`\n📧 Processing: ${account.email}`);
    
    try {
      // Step 1: Get or create Firebase Auth user
      let user;
      try {
        user = await auth.getUserByEmail(account.email);
        console.log(`   ✅ Auth user exists: ${user.uid}`);
        
        // Reset password to ensure it's correct
        await auth.updateUser(user.uid, {
          password: account.password,
          displayName: account.displayName,
        });
        console.log(`   ✅ Password reset to: ${account.password}`);
        
      } catch (error) {
        // User doesn't exist, create it
        user = await auth.createUser({
          email: account.email,
          password: account.password,
          displayName: account.displayName,
        });
        console.log(`   ✅ Created Auth user: ${user.uid}`);
      }
      
      // Step 2: Ensure Firestore user document exists
      const userDocRef = db.collection('users').doc(user.uid);
      const userDoc = await userDocRef.get();
      
      if (!userDoc.exists) {
        await userDocRef.set({
          email: account.email,
          displayName: account.displayName,
          name: account.displayName,
          organizationId: account.orgId,
          role: 'admin',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`   ✅ Created Firestore user doc`);
      } else {
        // Update to ensure correct orgId and role
        await userDocRef.update({
          organizationId: account.orgId,
          role: 'admin',
        });
        console.log(`   ✅ Updated Firestore user doc`);
      }
      
      // Step 3: Ensure organization exists
      const orgDocRef = db.collection('organizations').doc(account.orgId);
      const orgDoc = await orgDocRef.get();
      
      if (!orgDoc.exists) {
        await orgDocRef.set({
          name: account.orgName,
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        console.log(`   ✅ Created organization: ${account.orgName}`);
      } else {
        console.log(`   ✅ Organization exists: ${account.orgName}`);
      }
      
      console.log(`   🎉 ${account.email} is ready!`);
      
    } catch (error) {
      console.error(`   ❌ Error fixing ${account.email}:`, error.message);
    }
  }
  
  console.log('\n\n🎉 All test accounts fixed!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('LOGIN CREDENTIALS (use any of these):\n');
  TEST_ACCOUNTS.forEach(acc => {
    console.log(`📧 ${acc.email}`);
    console.log(`🔑 ${acc.password}`);
    console.log(`🏢 ${acc.orgName}`);
    console.log(`🔗 http://localhost:3000/workspace/${acc.orgId}/living-ledger`);
    console.log('');
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
}

fixTestAccounts().then(() => process.exit(0));
