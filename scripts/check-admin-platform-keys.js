/**
 * Check admin/platform-api-keys document
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
    console.log('\n=== DEV: admin/platform-api-keys ===\n');
    
    const devKeys = await devDb.collection('admin').doc('platform-api-keys').get();
    if (devKeys.exists) {
      const data = devKeys.data();
      console.log('Document exists');
      console.log('Keys found:');
      Object.keys(data || {}).forEach(key => {
        console.log(`  - ${key}: ${typeof data[key] === 'object' ? 'OBJECT' : 'SET'}`);
      });
      
      // Check for AI keys specifically
      if (data.openrouter) {
        console.log('\nOpenRouter config:', data.openrouter.apiKey ? '✅ API key SET' : '❌ No API key');
      }
      if (data.openai) {
        console.log('OpenAI config:', data.openai.apiKey ? '✅ API key SET' : '❌ No API key');
      }
      if (data.anthropic) {
        console.log('Anthropic config:', data.anthropic.apiKey ? '✅ API key SET' : '❌ No API key');
      }
    } else {
      console.log('Document does NOT exist');
    }
    
    console.log('\n=== PROD: admin/platform-api-keys ===\n');
    
    const prodKeys = await prodDb.collection('admin').doc('platform-api-keys').get();
    if (prodKeys.exists) {
      const data = prodKeys.data();
      console.log('Document exists');
      console.log('Keys found:');
      Object.keys(data || {}).forEach(key => {
        console.log(`  - ${key}: ${typeof data[key] === 'object' ? 'OBJECT' : 'SET'}`);
      });
      
      // Check for AI keys specifically
      if (data.openrouter) {
        console.log('\nOpenRouter config:', data.openrouter.apiKey ? '✅ API key SET' : '❌ No API key');
      }
      if (data.openai) {
        console.log('OpenAI config:', data.openai.apiKey ? '✅ API key SET' : '❌ No API key');
      }
      if (data.anthropic) {
        console.log('Anthropic config:', data.anthropic.apiKey ? '✅ API key SET' : '❌ No API key');
      }
    } else {
      console.log('Document does NOT exist');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

checkKeys();


