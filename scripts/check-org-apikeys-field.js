/**
 * Check apiKeys field in organization document
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
    
    const devOrgDoc = await devDb.collection('organizations').doc('platform-admin').get();
    if (devOrgDoc.exists) {
      const data = devOrgDoc.data();
      console.log('apiKeys field:', data.apiKeys ? 'EXISTS' : 'DOES NOT EXIST');
      if (data.apiKeys) {
        console.log(JSON.stringify(data.apiKeys, null, 2));
      }
    } else {
      console.log('Organization does not exist');
    }
    
    console.log('\n=== PROD: platform org ===\n');
    
    const prodOrgDoc = await prodDb.collection('organizations').doc('platform').get();
    if (prodOrgDoc.exists) {
      const data = prodOrgDoc.data();
      console.log('apiKeys field:', data.apiKeys ? 'EXISTS' : 'DOES NOT EXIST');
      if (data.apiKeys) {
        console.log(JSON.stringify(data.apiKeys, null, 2));
      }
    } else {
      console.log('Organization does not exist');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkKeys();


