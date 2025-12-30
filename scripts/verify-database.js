/**
 * Verify which database we're actually connecting to
 */

const admin = require('firebase-admin');
const path = require('path');

async function verify() {
  // Clear any existing instances
  admin.apps.forEach(app => {
    try {
      app.delete();
    } catch (e) {}
  });
  
  console.log('\n🔍 DATABASE CONNECTION VERIFICATION\n');
  console.log('Environment variables:');
  console.log(`  FIRESTORE_EMULATOR_HOST: ${process.env.FIRESTORE_EMULATOR_HOST || 'NOT SET'}`);
  console.log(`  FIREBASE_AUTH_EMULATOR_HOST: ${process.env.FIREBASE_AUTH_EMULATOR_HOST || 'NOT SET'}\n`);
  
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  
  console.log('Service account info:');
  console.log(`  Project ID: ${serviceAccount.project_id}`);
  console.log(`  Client Email: ${serviceAccount.client_email}\n`);
  
  const app = admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  const adminDb = admin.firestore();
  
  console.log('Firestore instance info:');
  console.log(`  Project ID: ${adminDb.projectId || 'unknown'}\n`);
  
  // Count documents
  const orgsSnapshot = await adminDb.collection('organizations').get();
  
  console.log(`📊 Total organizations: ${orgsSnapshot.size}\n`);
  console.log('Organizations found:');
  
  orgsSnapshot.forEach((doc, index) => {
    const data = doc.data();
    console.log(`  ${index + 1}. ${doc.id} - "${data.name || 'UNNAMED'}"`);
  });
  
  process.exit(0);
}

verify().catch(console.error);
