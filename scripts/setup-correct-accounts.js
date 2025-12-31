/**
 * Setup Correct Production Accounts
 * 1. Remove unwanted accounts
 * 2. Create the 5 approved demo accounts
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  const serviceAccount = require('../serviceAccountKey.json');
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
  });
}

const db = admin.firestore();
const auth = admin.auth();

// Accounts to REMOVE (unwanted)
const ACCOUNTS_TO_REMOVE = [
  'jamesstamper72@gmail.com',
  '10@1010.com'
];

// Accounts to CREATE (approved demo accounts)
const APPROVED_DEMO_ACCOUNTS = [
  {
    email: 'demo-auraflow@test.com',
    password: 'Testing123!',
    companyName: 'AuraFlow Analytics (TEST)',
    industry: 'B2B Software as a Service (SaaS)',
    plan: 'tier1',
  },
  {
    email: 'demo-greenthumb@test.com',
    password: 'Testing123!',
    companyName: 'GreenThumb Landscaping (TEST)',
    industry: 'Home Services (Landscaping & Lawn Care)',
    plan: 'tier1',
  },
  {
    email: 'demo-adventuregear@test.com',
    password: 'Testing123!',
    companyName: 'The Adventure Gear Shop (TEST)',
    industry: 'E-commerce (Outdoor Apparel and Gear)',
    plan: 'tier2',
  },
  {
    email: 'demo-summitwm@test.com',
    password: 'Testing123!',
    companyName: 'Summit Wealth Management (TEST)',
    industry: 'Financial Services (Investment Advisory)',
    plan: 'tier2',
  },
  {
    email: 'demo-pixelperfect@test.com',
    password: 'Testing123!',
    companyName: 'PixelPerfect Design Co. (TEST)',
    industry: 'Creative Services (Web Design & Branding)',
    plan: 'tier1',
  },
];

async function setupCorrectAccounts() {
  console.log('\n🔧 SETTING UP CORRECT PRODUCTION ACCOUNTS\n');
  console.log('='.repeat(80));
  
  // STEP 1: Remove unwanted accounts
  console.log('\n1️⃣ Removing unwanted accounts...\n');
  
  for (const email of ACCOUNTS_TO_REMOVE) {
    try {
      // Get user from Auth
      const userRecord = await auth.getUserByEmail(email);
      const uid = userRecord.uid;
      
      console.log(`   🗑️ Removing: ${email} (${uid})`);
      
      // Delete from Firestore
      const userDoc = await db.collection('users').doc(uid).get();
      if (userDoc.exists) {
        const userData = userDoc.data();
        const orgId = userData.organizationId;
        
        // Delete user document
        await db.collection('users').doc(uid).delete();
        
        // Delete organization if it exists
        if (orgId && orgId !== 'platform') {
          const orgDoc = await db.collection('organizations').doc(orgId).get();
          if (orgDoc.exists) {
            await db.collection('organizations').doc(orgId).delete();
            console.log(`      - Deleted organization: ${orgId}`);
          }
        }
      }
      
      // Delete from Firebase Auth
      await auth.deleteUser(uid);
      console.log(`      ✅ Deleted ${email}`);
      
    } catch (error) {
      console.log(`      ⚠️ Could not delete ${email}: ${error.message}`);
    }
  }
  
  // STEP 2: Create approved demo accounts
  console.log('\n2️⃣ Creating approved demo accounts...\n');
  
  for (const account of APPROVED_DEMO_ACCOUNTS) {
    try {
      // Check if account already exists
      let userRecord;
      try {
        userRecord = await auth.getUserByEmail(account.email);
        console.log(`   ✅ Account already exists: ${account.email}`);
        continue;
      } catch (error) {
        // Account doesn't exist, create it
      }
      
      console.log(`   🆕 Creating: ${account.email}`);
      
      // Create Firebase Auth user
      userRecord = await auth.createUser({
        email: account.email,
        password: account.password,
        displayName: account.companyName,
        emailVerified: true,
      });
      
      const uid = userRecord.uid;
      const orgId = `org_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      
      // Create organization
      await db.collection('organizations').doc(orgId).set({
        id: orgId,
        name: account.companyName,
        status: 'trial',
        plan: account.plan,
        trialStartDate: admin.firestore.FieldValue.serverTimestamp(),
        trialEndDate: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000), // 14 days
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: uid,
        industry: account.industry,
        isDemoAccount: true, // Mark as demo
      });
      
      // Create user document
      await db.collection('users').doc(uid).set({
        email: account.email,
        name: account.companyName,
        displayName: account.companyName,
        role: 'admin',
        organizationId: orgId,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        isDemoAccount: true, // Mark as demo
      });
      
      console.log(`      ✅ Created ${account.email}`);
      console.log(`         Organization: ${orgId}`);
      
    } catch (error) {
      console.log(`      ❌ Failed to create ${account.email}: ${error.message}`);
    }
  }
  
  // STEP 3: Verify final state
  console.log('\n3️⃣ Verifying final database state...\n');
  
  const usersSnapshot = await db.collection('users').get();
  const orgsSnapshot = await db.collection('organizations').get();
  
  console.log(`\n📊 FINAL STATE:`);
  console.log(`   Total Users: ${usersSnapshot.size}`);
  console.log(`   Total Organizations: ${orgsSnapshot.size}\n`);
  
  console.log('   Users:');
  usersSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`      - ${data.email} (${data.role})`);
  });
  
  console.log('\n   Organizations:');
  orgsSnapshot.forEach(doc => {
    const data = doc.data();
    console.log(`      - ${data.name || doc.id}`);
  });
  
  console.log('\n' + '='.repeat(80));
  console.log('✅ SETUP COMPLETE');
  console.log('='.repeat(80));
}

setupCorrectAccounts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Error:', error);
    process.exit(1);
  });
