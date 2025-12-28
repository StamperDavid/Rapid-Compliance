/**
 * Check Golden Master configuration in production
 */

const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function checkConfig() {
  try {
    const gmDoc = await db.collection('organizations')
      .doc('platform')
      .collection('goldenMasters')
      .doc('gm-platform-1')
      .get();
    
    if (!gmDoc.exists) {
      console.log('❌ Golden Master not found');
      process.exit(1);
    }
    
    const data = gmDoc.data();
    
    console.log('\n📋 Golden Master Configuration:\n');
    console.log('Name:', data.name);
    console.log('Status:', data.status);
    console.log('isActive:', data.isActive);
    console.log('Model:', data.modelId);
    console.log('\nSystem Instructions:');
    console.log(data.systemInstructions ? `✅ SET (${data.systemInstructions.length} chars)` : '❌ NOT SET');
    if (data.systemInstructions) {
      console.log('\nFirst 500 chars:');
      console.log(data.systemInstructions.substring(0, 500));
    }
    
    console.log('\n\nKnowledge Base:');
    console.log(data.knowledgeBase ? `✅ SET (${data.knowledgeBase.length} chars)` : '❌ NOT SET');
    if (data.knowledgeBase) {
      console.log('\nFirst 500 chars:');
      console.log(data.knowledgeBase.substring(0, 500));
    }
    
    console.log('\n\nTraining Data:');
    console.log(data.trainingData ? `✅ SET` : '❌ NOT SET');
    
    console.log('\n\nFull Golden Master data keys:');
    console.log(Object.keys(data));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkConfig();


