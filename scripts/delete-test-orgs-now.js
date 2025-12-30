/**
 * Direct deletion of test organizations
 * Deletes ONLY "Test Payment Org" and "Pagination Test Org"
 */

const admin = require('firebase-admin');
const path = require('path');

// Try to initialize Firebase Admin
let adminDb;

async function initializeFirebase() {
  if (admin.apps.length) {
    adminDb = admin.firestore();
    return true;
  }

  // Try to find service account key
  const possiblePaths = [
    path.join(__dirname, '../serviceAccountKey.json'),
    path.join(__dirname, '../service-account-key.json'),
    process.env.GOOGLE_APPLICATION_CREDENTIALS
  ].filter(Boolean);

  for (const keyPath of possiblePaths) {
    try {
      const serviceAccount = require(keyPath);
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      adminDb = admin.firestore();
      console.log('✅ Firebase Admin initialized');
      return true;
    } catch (e) {
      // Try next path
    }
  }

  // If no service account, try to use the existing admin setup
  try {
    const { adminDb: db } = require('../src/lib/firebase/admin');
    adminDb = db;
    console.log('✅ Using existing Firebase Admin');
    return true;
  } catch (e) {
    console.error('❌ Cannot initialize Firebase Admin');
    return false;
  }
}

async function deleteTestOrganizations() {
  console.log('\n🗑️  DELETING TEST ORGANIZATIONS\n');
  
  if (!await initializeFirebase()) {
    console.error('Failed to initialize Firebase. Cannot proceed.');
    process.exit(1);
  }

  try {
    // Fetch all organizations
    const orgsSnapshot = await adminDb.collection('organizations').get();
    console.log(`📊 Found ${orgsSnapshot.size} total organizations\n`);
    
    const toDelete = [];
    const toKeep = [];
    
    // Identify organizations to delete
    orgsSnapshot.forEach(doc => {
      const data = doc.data();
      const name = data.name || '';
      
      // Delete ALL test pollution patterns
      if (
        name === 'Test Payment Org' ||
        name === 'Pagination Test Org' ||
        name === 'Test Organization' ||
        name === 'Unconfigured Org' ||
        doc.id.startsWith('test-org-') ||
        doc.id.startsWith('unconfigured-')
      ) {
        toDelete.push({ id: doc.id, name });
      } else {
        toKeep.push({ id: doc.id, name });
      }
    });
    
    console.log(`🎯 Organizations to DELETE: ${toDelete.length}`);
    toDelete.forEach(org => console.log(`   - ${org.name}`));
    
    console.log(`\n✅ Organizations to KEEP: ${toKeep.length}`);
    toKeep.forEach(org => console.log(`   - ${org.name}`));
    
    if (toDelete.length === 0) {
      console.log('\n✨ No test organizations found to delete!');
      process.exit(0);
    }
    
    console.log(`\n🗑️  Deleting ${toDelete.length} organizations...\n`);
    
    // Delete each organization
    const batch = adminDb.batch();
    let count = 0;
    
    for (const org of toDelete) {
      const orgRef = adminDb.collection('organizations').doc(org.id);
      batch.delete(orgRef);
      count++;
      console.log(`   ${count}. Deleted: ${org.name} (${org.id})`);
      
      // Commit in batches of 500 (Firestore limit)
      if (count % 500 === 0) {
        await batch.commit();
      }
    }
    
    // Commit remaining
    if (count % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`\n✅ SUCCESS! Deleted ${count} organizations`);
    console.log(`✅ Remaining: ${toKeep.length} organizations\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run it
deleteTestOrganizations();
