/**
 * Set isActive = true on the Golden Master
 */

const admin = require('firebase-admin');

const serviceAccount = require('../serviceAccountKey-prod.json');
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'ai-sales-platform-4f5e4',
});

const db = admin.firestore();

async function activate() {
  try {
    console.log('✏️  Setting isActive = true...\n');
    
    await db.collection('organizations')
      .doc('platform')
      .collection('goldenMasters')
      .doc('gm-platform-1')
      .update({
        isActive: true
      });
    
    console.log('✅ Golden Master activated!\n');
    console.log('🌐 www.salesvelocity.ai AI agent should work now.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

activate();


