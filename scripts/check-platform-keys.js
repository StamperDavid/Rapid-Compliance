/**
 * Check Platform API Keys
 * Verifies what keys are stored in Firestore
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
if (!admin.apps.length) {
  admin.initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'demo-ai-sales-platform',
  });
}

const db = admin.firestore();

async function checkKeys() {
  console.log('\n🔍 Checking Platform API Keys...\n');
  
  try {
    const doc = await db.collection('admin').doc('platform-api-keys').get();
    
    if (!doc.exists) {
      console.log('❌ NO KEYS FOUND at admin/platform-api-keys');
      console.log('\nYou need to configure keys at: /admin/system/api-keys\n');
      return;
    }
    
    const data = doc.data();
    console.log('✅ Keys document EXISTS\n');
    console.log('📋 Structure:');
    console.log(JSON.stringify(data, (key, value) => {
      // Mask API keys for security
      if (key === 'apiKey' || key === 'secretKey' && typeof value === 'string') {
        return value.substring(0, 10) + '...' + value.substring(value.length - 4);
      }
      return value;
    }, 2));
    
    console.log('\n✅ Key Status:');
    if (data.openrouter?.apiKey) {
      console.log(`   OpenRouter: ✅ SET (${data.openrouter.apiKey.substring(0, 10)}...)`);
    } else {
      console.log('   OpenRouter: ❌ NOT SET');
    }
    
    if (data.openai?.apiKey) {
      console.log(`   OpenAI: ✅ SET (${data.openai.apiKey.substring(0, 10)}...)`);
    } else {
      console.log('   OpenAI: ❌ NOT SET');
    }
    
    if (data.anthropic?.apiKey) {
      console.log(`   Anthropic: ✅ SET (${data.anthropic.apiKey.substring(0, 10)}...)`);
    } else {
      console.log('   Anthropic: ❌ NOT SET');
    }
    
    console.log('');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkKeys()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Failed:', error);
    process.exit(1);
  });



