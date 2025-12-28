/**
 * Check if platform org has a Golden Master deployed
 */

const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function checkGoldenMaster() {
  try {
    const orgId = 'platform';
    
    console.log('🔍 Checking platform org Golden Master...\n');
    
    // Check for Golden Masters
    const gmSnapshot = await db.collection('organizations')
      .doc(orgId)
      .collection('goldenMasters')
      .where('status', '==', 'active')
      .get();
    
    console.log(`Active Golden Masters: ${gmSnapshot.size}\n`);
    
    if (gmSnapshot.empty) {
      console.log('❌ No active Golden Master found');
      
      // Check for ANY golden masters
      const allGMSnapshot = await db.collection('organizations')
        .doc(orgId)
        .collection('goldenMasters')
        .get();
      
      console.log(`\nTotal Golden Masters (any status): ${allGMSnapshot.size}`);
      
      if (!allGMSnapshot.empty) {
        allGMSnapshot.forEach(doc => {
          const data = doc.data();
          console.log(`\n- ${doc.id}`);
          console.log(`  Status: ${data.status || 'unknown'}`);
          console.log(`  Created: ${data.createdAt?.toDate() || 'unknown'}`);
        });
      }
    } else {
      console.log('✅ Active Golden Masters found:');
      gmSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n- ${doc.id}`);
        console.log(`  Status: ${data.status}`);
        console.log(`  Model: ${data.modelConfig?.provider || 'unknown'} ${data.modelConfig?.model || ''}`);
        console.log(`  Created: ${data.createdAt?.toDate()}`);
      });
    }
    
    // Check API keys
    console.log('\n---\n');
    console.log('🔑 Checking API keys...\n');
    
    const apiKeysSnapshot = await db.collection('organizations')
      .doc(orgId)
      .collection('apiKeys')
      .get();
    
    console.log(`API Keys configured: ${apiKeysSnapshot.size}`);
    
    if (!apiKeysSnapshot.empty) {
      apiKeysSnapshot.forEach(doc => {
        const data = doc.data();
        console.log(`\n- ${data.provider || doc.id}`);
        console.log(`  Has key: ${data.apiKey ? 'Yes' : 'No'}`);
        console.log(`  Enabled: ${data.enabled !== false ? 'Yes' : 'No'}`);
      });
    }
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkGoldenMaster();


