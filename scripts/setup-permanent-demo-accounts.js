/**
 * Setup Permanent Demo Accounts
 * These are NOT test data - these are permanent demo accounts for manual testing
 */

const admin = require('firebase-admin');
const serviceAccount = require('../firebase-prod-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: serviceAccount.project_id
});

const auth = admin.auth();
const db = admin.firestore();

// PERMANENT DEMO ACCOUNTS - For manual testing
const DEMO_ACCOUNTS = [
  {
    email: 'demo-auraflow@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - AuraFlow',
    orgName: 'AuraFlow Analytics (TEST)',
    orgId: 'org_demo_auraflow'
  },
  {
    email: 'demo-greenthumb@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - GreenThumb',
    orgName: 'GreenThumb Landscaping (TEST)',
    orgId: 'org_demo_greenthumb'
  },
  {
    email: 'demo-adventuregear@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - Adventure Gear',
    orgName: 'The Adventure Gear Shop (TEST)',
    orgId: 'org_demo_adventuregear'
  },
  {
    email: 'demo-summitwm@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - Summit',
    orgName: 'Summit Wealth Management (TEST)',
    orgId: 'org_demo_summitwm'
  },
  {
    email: 'demo-pixelperfect@test.com',
    password: 'Testing123!',
    displayName: 'Demo User - PixelPerfect',
    orgName: 'PixelPerfect Design Co. (TEST)',
    orgId: 'org_demo_pixelperfect'
  }
];

async function setupDemoAccounts() {
  console.log('🎭 Setting up PERMANENT demo accounts in: ' + serviceAccount.project_id);
  console.log('These are for manual testing - NOT automated test data\n');
  
  for (const demo of DEMO_ACCOUNTS) {
    console.log('Setting up: ' + demo.email + '...');
    
    try {
      let userRecord;
      
      // Try to get existing user
      try {
        userRecord = await auth.getUserByEmail(demo.email);
        console.log('  ✅ User exists, updating password...');
        
        // Update password
        await auth.updateUser(userRecord.uid, {
          password: demo.password,
          emailVerified: true,
          displayName: demo.displayName
        });
        
      } catch (error) {
        // User doesn't exist, create it
        console.log('  Creating new user...');
        
        userRecord = await auth.createUser({
          email: demo.email,
          password: demo.password,
          emailVerified: true,
          displayName: demo.displayName
        });
      }
      
      // Create or update organization
      const orgData = {
        name: demo.orgName,
        slug: demo.orgId.replace('org_demo_', ''),
        plan: 'pro',
        status: 'active',
        billingEmail: demo.email,
        isDemoAccount: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await db.collection('organizations').doc(demo.orgId).set(orgData, { merge: true });
      console.log('  ✅ Organization created/updated: ' + demo.orgId);
      
      // Create or update user document
      const userData = {
        email: demo.email,
        displayName: demo.orgName,
        name: demo.orgName,
        role: 'admin',
        organizationId: demo.orgId,
        isDemoAccount: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      };
      
      await db.collection('users').doc(userRecord.uid).set(userData, { merge: true });
      console.log('  ✅ User document created/updated\n');
      
    } catch (error) {
      console.error('  ❌ Error setting up ' + demo.email + ':', error.message);
    }
  }
  
  console.log('═══════════════════════════════════════════════════════════');
  console.log('🎉 Demo accounts setup complete!\n');
  console.log('You can now log in to these accounts:');
  DEMO_ACCOUNTS.forEach(demo => {
    console.log('  - ' + demo.email + ' / ' + demo.password);
  });
  console.log('');
}

setupDemoAccounts()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('❌ Fatal error:', error);
    process.exit(1);
  });
