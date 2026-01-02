/**
 * Check for a specific organization ID
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

async function checkOrg() {
  const orgId = 'org_1767293849738_0a49xsl59'; // BIG TEST COMPANY
  
  console.log(`\n🔍 Checking for organization: ${orgId}\n`);
  
  try {
    const orgDoc = await db.collection('organizations').doc(orgId).get();
    
    if (orgDoc.exists) {
      console.log('✅ Organization EXISTS in Firestore!');
      console.log('\nData:');
      console.log(JSON.stringify(orgDoc.data(), null, 2));
    } else {
      console.log('❌ Organization DOES NOT EXIST in Firestore!');
      console.log('\nThis means:');
      console.log('- The UI is showing cached/stale data');
      console.log('- OR the organization was deleted after creation');
      console.log('- OR there\'s a collection name mismatch');
    }
    console.log('');
    
    // Also check all organizations
    console.log('📊 Current organizations in database:');
    const allOrgs = await db.collection('organizations').get();
    console.log(`Total: ${allOrgs.size}`);
    allOrgs.forEach(doc => {
      console.log(`  - ${doc.id}: ${doc.data().name}`);
    });
    console.log('');
    
  } catch (error) {
    console.error('Error:', error.message);
  }
}

checkOrg()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
