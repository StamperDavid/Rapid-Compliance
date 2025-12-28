/**
 * Copy admin/platform-api-keys from dev to production
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

async function copyKeys() {
  try {
    console.log('📋 Copying admin platform API keys from DEV to PROD...\n');
    
    // Get dev keys
    const devKeysDoc = await devDb.collection('admin').doc('platform-api-keys').get();
    
    if (!devKeysDoc.exists) {
      console.log('❌ No admin platform keys found in dev');
      process.exit(1);
    }
    
    const keysData = devKeysDoc.data();
    
    console.log('✅ Found keys in dev:');
    Object.keys(keysData).forEach(key => {
      if (key !== 'updatedAt' && key !== 'updatedBy') {
        console.log(`  - ${key}`);
      }
    });
    
    // Copy to production
    await prodDb.collection('admin').doc('platform-api-keys').set(keysData);
    
    console.log('\n✅ Successfully copied admin platform API keys to production!\n');
    console.log('🌐 www.salesvelocity.ai AI agent should work now.\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

copyKeys();


