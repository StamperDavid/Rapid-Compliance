/**
 * Copy platformConfig from production to dev
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Production Firebase
const prodServiceAccount = require(path.join(__dirname, '..', 'serviceAccountKey-prod.json'));
const prodApp = admin.initializeApp({
  credential: admin.credential.cert(prodServiceAccount),
}, 'prod');
const prodDb = prodApp.firestore();

// Initialize Dev Firebase
const devServiceAccount = require(path.join(__dirname, '..', 'serviceAccountKey.json'));
const devApp = admin.initializeApp({
  credential: admin.credential.cert(devServiceAccount),
}, 'dev');
const devDb = devApp.firestore();

async function copyPlatformConfig() {
  console.log('🔄 Copying platformConfig from production to dev...\n');
  
  try {
    const snapshot = await prodDb.collection('platformConfig').get();
    
    if (snapshot.empty) {
      console.log('⚠️  platformConfig collection is empty in production');
      console.log('   This is normal if you haven\'t configured website theme yet.');
      return;
    }
    
    console.log(`📥 Found ${snapshot.size} documents in platformConfig\n`);
    
    for (const doc of snapshot.docs) {
      await devDb.collection('platformConfig').doc(doc.id).set(doc.data());
      console.log(`✅ Copied: platformConfig/${doc.id}`);
    }
    
    console.log('\n✅ platformConfig copied successfully!');
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

copyPlatformConfig()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error('Fatal error:', error);
    process.exit(1);
  });







