/**
 * List all organizations in production Firebase
 */

const admin = require('firebase-admin');

// Use PRODUCTION credentials
const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function listOrgs() {
  try {
    console.log('📋 Organizations in PRODUCTION Firebase:\n');
    
    const orgsSnapshot = await db.collection('organizations').get();
    
    if (orgsSnapshot.empty) {
      console.log('❌ No organizations found in production\n');
      process.exit(0);
    }
    
    console.log(`Found ${orgsSnapshot.size} organization(s):\n`);
    
    for (const doc of orgsSnapshot.docs) {
      const data = doc.data();
      console.log(`ID: ${doc.id}`);
      console.log(`Name: ${data.name || 'N/A'}`);
      console.log(`Plan: ${data.plan || 'N/A'}`);
      console.log(`Status: ${data.status || 'N/A'}`);
      console.log(`---`);
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

listOrgs();

