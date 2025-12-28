/**
 * Check organization API keys in apiKeys subcollection
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

async function checkKeys() {
  try {
    console.log('\n=== DEV: platform-admin org ===\n');
    
    const devKeysSnapshot = await devDb.collection('organizations')
      .doc('platform-admin')
      .collection('apiKeys')
      .get();
    
    console.log(`API Keys found: ${devKeysSnapshot.size}`);
    devKeysSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n- ${doc.id}:`);
      console.log(`  Provider: ${data.provider || 'N/A'}`);
      console.log(`  Name: ${data.name || 'N/A'}`);
      console.log(`  Key: ${data.key ? '✅ SET (hidden)' : '❌ NOT SET'}`);
      console.log(`  Active: ${data.isActive || false}`);
    });
    
    console.log('\n\n=== PROD: platform org ===\n');
    
    const prodKeysSnapshot = await prodDb.collection('organizations')
      .doc('platform')
      .collection('apiKeys')
      .get();
    
    console.log(`API Keys found: ${prodKeysSnapshot.size}`);
    prodKeysSnapshot.forEach(doc => {
      const data = doc.data();
      console.log(`\n- ${doc.id}:`);
      console.log(`  Provider: ${data.provider || 'N/A'}`);
      console.log(`  Name: ${data.name || 'N/A'}`);
      console.log(`  Key: ${data.key ? '✅ SET (hidden)' : '❌ NOT SET'}`);
      console.log(`  Active: ${data.isActive || false}`);
    });
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkKeys();


