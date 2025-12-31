/**
 * PRODUCTION Demo Account Seeder
 * Creates demo accounts directly in Firebase (no emulators needed)
 * Run this to create real working demo accounts for presentations
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
if (!admin.apps.length) {
  // Try to load service account from local file
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
    // Use project ID from environment
    admin.initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-ai-sales-platform',
    });
  }
}

const db = admin.firestore();
const auth = admin.auth();

const DEMO_ACCOUNTS = [
  {
    email: 'demo-auraflow@test.com',
    password: 'Testing123!',
    companyName: 'AuraFlow Analytics (TEST)',
    industry: 'B2B Software as a Service (SaaS)',
    plan: 'starter',
  },
  {
    email: 'demo-greenthumb@test.com',
    password: 'Testing123!',
    companyName: 'GreenThumb Landscaping (TEST)',
    industry: 'Home Services (Landscaping & Lawn Care)',
    plan: 'starter',
  },
  {
    email: 'demo-adventuregear@test.com',
    password: 'Testing123!',
    companyName: 'The Adventure Gear Shop (TEST)',
    industry: 'E-commerce (Outdoor Apparel and Gear)',
    plan: 'professional',
  },
  {
    email: 'demo-summitwm@test.com',
    password: 'Testing123!',
    companyName: 'Summit Wealth Management (TEST)',
    industry: 'Financial Services (Investment Advisory)',
    plan: 'professional',
  },
  {
    email: 'demo-pixelperfect@test.com',
    password: 'Testing123!',
    companyName: 'PixelPerfect Design Co. (TEST)',
    industry: 'Creative Services (Web Design & Branding)',
    plan: 'starter',
  },
];

async function createDemoAccount(accountData) {
  try {
    console.log(`\n📝 Creating: ${accountData.companyName}...`);
    
    // Check if user already exists
    let userRecord;
    try {
      userRecord = await auth.getUserByEmail(accountData.email);
      console.log(`✅ User already exists: ${accountData.email}`);
    } catch (error) {
      // Create new user
      userRecord = await auth.createUser({
        email: accountData.email,
        password: accountData.password,
        displayName: accountData.companyName,
        emailVerified: true,
      });
      console.log(`✅ Created user: ${accountData.email}`);
    }
    
    // Generate organization ID
    const orgId = `org_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    // Check if organization already exists for this user
    const userDoc = await db.collection('users').doc(userRecord.uid).get();
    if (userDoc.exists && userDoc.data().organizationId) {
      console.log(`✅ Organization already exists for this user`);
      return { success: true, orgId: userDoc.data().organizationId, userId: userRecord.uid };
    }
    
    // Create organization
    await db.collection('organizations').doc(orgId).set({
      name: accountData.companyName,
      industry: accountData.industry,
      plan: accountData.plan,
      status: 'active',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
      createdBy: userRecord.uid,
      settings: {
        timezone: 'America/New_York',
        currency: 'USD'
      }
    });
    
    console.log(`✅ Created organization: ${orgId}`);
    
    // Create user document
    await db.collection('users').doc(userRecord.uid).set({
      email: accountData.email,
      name: 'Demo Admin',
      role: 'owner',
      organizationId: orgId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`✅ Created user document`);
    
    // Add to organization members
    await db.collection('organizations').doc(orgId).collection('members').doc(userRecord.uid).set({
      userId: userRecord.uid,
      email: accountData.email,
      role: 'owner',
      addedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    
    console.log(`✅ Added to organization members`);
    console.log(`🎉 SUCCESS: ${accountData.companyName}`);
    
    return { success: true, orgId, userId: userRecord.uid };
    
  } catch (error) {
    console.error(`❌ Error creating ${accountData.companyName}:`, error.message);
    return { success: false, error: error.message };
  }
}

async function seedDemoAccounts() {
  console.log('🚀 Creating PRODUCTION Demo Accounts...\n');
  console.log(`Creating ${DEMO_ACCOUNTS.length} demo accounts...\n`);
  
  const results = [];
  
  for (const account of DEMO_ACCOUNTS) {
    const result = await createDemoAccount(account);
    results.push({ ...account, ...result });
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  console.log('\n\n📊 SUMMARY');
  console.log('='.repeat(60));
  const successful = results.filter(r => r.success).length;
  const failed = results.filter(r => !r.success).length;
  
  console.log(`✅ Successful: ${successful}/${DEMO_ACCOUNTS.length}`);
  console.log(`❌ Failed: ${failed}/${DEMO_ACCOUNTS.length}`);
  
  if (successful > 0) {
    console.log('\n✅ DEMO ACCOUNTS READY:');
    console.log('='.repeat(60));
    results.filter(r => r.success).forEach(r => {
      console.log(`\n${r.companyName}`);
      console.log(`   Email: ${r.email}`);
      console.log(`   Password: ${r.password}`);
      console.log(`   Industry: ${r.industry}`);
    });
    
    console.log('\n\n🎯 FOR YOUR VC MEETING:');
    console.log('='.repeat(60));
    console.log('1. Go to: http://localhost:3000/admin/demo-accounts');
    console.log('2. Click any demo account to auto-login');
    console.log('3. Show different industries to demonstrate versatility');
    console.log('\nAll passwords: Testing123!');
  }
  
  if (failed > 0) {
    console.log('\n❌ Failed accounts:');
    results.filter(r => !r.success).forEach(r => {
      console.log(`   - ${r.companyName}: ${r.error}`);
    });
  }
}

seedDemoAccounts()
  .then(() => {
    console.log('\n✅ Demo accounts ready!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Failed:', error);
    process.exit(1);
  });






