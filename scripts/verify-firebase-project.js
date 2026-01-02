/**
 * Verify which Firebase project we're connected to
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

console.log('🔍 Firebase Project Connection Verification\n');
console.log(`Project ID: ${projectId}`);
console.log(`Client Email: ${clientEmail}\n`);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

async function verify() {
  try {
    // Try to read from organizations
    const orgsSnapshot = await db.collection('organizations').get();
    
    console.log(`✅ Connected to project: ${projectId}`);
    console.log(`✅ Organizations collection: ${orgsSnapshot.size} documents\n`);
    
    if (orgsSnapshot.size > 0) {
      console.log('Organization IDs:');
      orgsSnapshot.docs.forEach(doc => {
        console.log(`   - ${doc.id}: ${doc.data().name || 'Unknown'}`);
      });
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verify().then(() => process.exit(0));
