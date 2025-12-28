/**
 * Check Golden Master configuration in DEV
 */

const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-dev',
});

const db = admin.firestore();

async function checkConfig() {
  try {
    console.log('\n=== Checking platform-admin Golden Masters ===\n');
    
    const gmSnapshot = await db.collection('organizations')
      .doc('platform-admin')
      .collection('goldenMasters')
      .where('status', '==', 'active')
      .get();
    
    if (gmSnapshot.empty) {
      console.log('❌ No active Golden Masters found');
      process.exit(1);
    }
    
    console.log(`Found ${gmSnapshot.size} active Golden Master(s)\n`);
    
    gmSnapshot.forEach(doc => {
      const data = doc.data();
      
      console.log(`\n--- Golden Master: ${doc.id} ---`);
      console.log('Name:', data.name);
      console.log('isActive:', data.isActive);
      console.log('Model:', data.modelId || data.baseModelId);
      console.log('\nSystem Instructions:', data.systemInstructions ? `✅ SET (${data.systemInstructions.length} chars)` : '❌ NOT SET');
      if (data.systemInstructions) {
        console.log('\nFirst 500 chars:');
        console.log(data.systemInstructions.substring(0, 500));
      }
      
      console.log('\n\nKnowledge Base:', data.knowledgeBase ? `✅ SET (${data.knowledgeBase.length} chars)` : '❌ NOT SET');
      if (data.knowledgeBase) {
        console.log('\nFirst 500 chars:');
        console.log(data.knowledgeBase.substring(0, 500));
      }
      
      console.log('\n\nConfiguration:', data.configuration ? '✅ SET' : '❌ NOT SET');
      if (data.configuration) {
        console.log(JSON.stringify(data.configuration, null, 2));
      }
    });
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkConfig();


