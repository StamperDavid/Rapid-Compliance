/**
 * Check exact fields in the Golden Master
 */

const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function checkFields() {
  try {
    const gmSnapshot = await db.collection('organizations')
      .doc('platform')
      .collection('goldenMasters')
      .doc('gm-platform-1')
      .get();
    
    if (!gmSnapshot.exists) {
      console.log('❌ Golden Master not found');
      process.exit(1);
    }
    
    const data = gmSnapshot.data();
    
    console.log('\n📋 Golden Master Fields:\n');
    console.log(`isActive: ${data.isActive}`);
    console.log(`status: ${data.status}`);
    console.log('\n Full data:');
    console.log(JSON.stringify(data, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkFields();


