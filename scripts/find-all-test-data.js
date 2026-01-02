/**
 * Comprehensive Test Data Finder
 * Searches ALL collections for test data
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

const db = admin.firestore();

async function findAllCollections() {
  console.log('🔍 Scanning ENTIRE Firestore database for test data...\n');
  
  try {
    // Get all root-level collections
    const collections = await db.listCollections();
    
    console.log(`Found ${collections.length} root-level collections:\n`);
    
    for (const collection of collections) {
      console.log(`\n📂 Collection: ${collection.id}`);
      
      const snapshot = await collection.get();
      console.log(`   Documents: ${snapshot.size}`);
      
      if (snapshot.size > 0 && snapshot.size <= 100) {
        // Show document IDs for small collections
        const docIds = snapshot.docs.map(d => d.id).slice(0, 20);
        console.log(`   Doc IDs: ${docIds.join(', ')}${snapshot.size > 20 ? '...' : ''}`);
      }
    }
    
  } catch (error) {
    console.error('❌ Error:', error);
  }
}

findAllCollections().then(() => process.exit(0));
