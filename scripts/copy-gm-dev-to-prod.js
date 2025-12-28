/**
 * Copy Golden Master from dev platform-admin to prod platform
 */

const admin = require('firebase-admin');

// Initialize DEV
const devApp = admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccountKey.json')),
  projectId: 'ai-sales-platform-dev',
}, 'dev');

const devDb = devApp.firestore();

// Initialize PROD
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(require('../serviceAccountKey-prod.json')),
  projectId: 'ai-sales-platform-4f5e4',
}, 'prod');

const prodDb = prodApp.firestore();

async function copyGoldenMaster() {
  try {
    console.log('📋 Copying Golden Master from DEV to PROD...\n');
    
    // Get active Golden Master from dev platform-admin
    const devGMSnapshot = await devDb.collection('organizations')
      .doc('platform-admin')
      .collection('goldenMasters')
      .where('status', '==', 'active')
      .limit(1)
      .get();
    
    if (devGMSnapshot.empty) {
      console.log('❌ No active Golden Master in dev platform-admin');
      process.exit(1);
    }
    
    const devGMDoc = devGMSnapshot.docs[0];
    const gmData = devGMDoc.data();
    
    console.log(`✅ Found Golden Master: ${devGMDoc.id}`);
    console.log(`   Model: ${gmData.modelConfig?.provider} ${gmData.modelConfig?.model}\n`);
    
    // Copy to production platform org
    console.log('📝 Copying to production platform org...');
    
    await prodDb.collection('organizations')
      .doc('platform')
      .collection('goldenMasters')
      .doc(devGMDoc.id)
      .set({
        ...gmData,
        copiedFromDev: true,
        copiedAt: new Date(),
      });
    
    console.log('✅ Golden Master copied to production\n');
    
    // Also check if dev has API keys and copy those
    const devApiKeysSnapshot = await devDb.collection('organizations')
      .doc('platform-admin')
      .collection('apiKeys')
      .get();
    
    if (!devApiKeysSnapshot.empty) {
      console.log('🔑 Copying API keys...');
      
      for (const doc of devApiKeysSnapshot.docs) {
        const keyData = doc.data();
        await prodDb.collection('organizations')
          .doc('platform')
          .collection('apiKeys')
          .doc(doc.id)
          .set(keyData);
        
        console.log(`   ✅ Copied ${keyData.provider} key`);
      }
    }
    
    console.log('\n✨ Done! AI agent should work now in production.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

copyGoldenMaster();


