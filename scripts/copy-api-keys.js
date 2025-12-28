/**
 * Copy API keys from dev platform-admin to prod platform
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
    console.log('🔑 Checking for API keys in dev...\n');
    
    // First check if there are API keys in environment or system
    const devApiKeysSnapshot = await devDb.collection('organizations')
      .doc('platform-admin')
      .collection('apiKeys')
      .get();
    
    if (devApiKeysSnapshot.empty) {
      console.log('❌ No API keys found in dev platform-admin');
      console.log('\nℹ️  API keys might be configured as environment variables.');
      console.log('   Check OPENAI_API_KEY, ANTHROPIC_API_KEY, etc. in Vercel env vars\n');
      process.exit(1);
    }
    
    console.log(`✅ Found ${devApiKeysSnapshot.size} API key(s) in dev\n`);
    
    for (const doc of devApiKeysSnapshot.docs) {
      const keyData = doc.data();
      console.log(`📝 Copying ${keyData.provider || doc.id}...`);
      
      await prodDb.collection('organizations')
        .doc('platform')
        .collection('apiKeys')
        .doc(doc.id)
        .set(keyData);
      
      console.log(`   ✅ Copied`);
    }
    
    console.log('\n✨ API keys copied to production!\n');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

copyKeys();


