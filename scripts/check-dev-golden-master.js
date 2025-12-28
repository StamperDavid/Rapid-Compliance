/**
 * Check dev environment for Golden Master
 */

const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-dev',
});

const db = admin.firestore();

async function checkDev() {
  try {
    console.log('🔍 Checking DEV environment...\n');
    
    // Check both platform-admin and platform orgs
    for (const orgId of ['platform-admin', 'platform']) {
      console.log(`\n=== Org: ${orgId} ===`);
      
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      if (!orgDoc.exists) {
        console.log('❌ Org does not exist\n');
        continue;
      }
      
      console.log('✅ Org exists');
      
      // Check Golden Masters
      const gmSnapshot = await db.collection('organizations')
        .doc(orgId)
        .collection('goldenMasters')
        .where('status', '==', 'active')
        .get();
      
      console.log(`Active Golden Masters: ${gmSnapshot.size}`);
      
      if (!gmSnapshot.empty) {
        gmSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`  - ${doc.id} (${data.modelConfig?.provider} ${data.modelConfig?.model})`);
        });
      }
      
      // Check API keys
      const apiKeysSnapshot = await db.collection('organizations')
        .doc(orgId)
        .collection('apiKeys')
        .get();
      
      console.log(`API Keys: ${apiKeysSnapshot.size}`);
      
      if (!apiKeysSnapshot.empty) {
        apiKeysSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`  - ${data.provider}: ${data.apiKey ? 'Configured' : 'Missing'}`);
        });
      }
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkDev();


