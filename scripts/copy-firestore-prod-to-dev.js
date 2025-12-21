/**
 * Copy Firestore Data from Production to Development
 * This will copy ALL collections and documents
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

// Collections to copy (add more as needed)
const COLLECTIONS_TO_COPY = [
  'users',
  'organizations',
  'contacts',
  'deals',
  'products',
  'services',
  'leads',
  'campaigns',
  'templates',
  'workflows',
  'integrations',
  'settings',
  'admin',
  'platform-api-keys',
];

async function copyCollection(collectionName) {
  console.log(`\n📦 Copying collection: ${collectionName}`);
  
  try {
    const snapshot = await prodDb.collection(collectionName).get();
    
    if (snapshot.empty) {
      console.log(`  ⏭️  Collection '${collectionName}' is empty, skipping`);
      return { success: 0, failed: 0 };
    }
    
    console.log(`  📥 Found ${snapshot.size} documents`);
    
    const batch = devDb.batch();
    let batchCount = 0;
    let successCount = 0;
    let failedCount = 0;
    
    for (const doc of snapshot.docs) {
      try {
        const docRef = devDb.collection(collectionName).doc(doc.id);
        batch.set(docRef, doc.data(), { merge: true });
        batchCount++;
        
        // Firestore batch limit is 500, commit when we reach it
        if (batchCount >= 500) {
          await batch.commit();
          successCount += batchCount;
          console.log(`  ✅ Committed ${batchCount} documents`);
          batchCount = 0;
        }
      } catch (error) {
        console.error(`  ❌ Error preparing doc ${doc.id}:`, error.message);
        failedCount++;
      }
    }
    
    // Commit remaining documents
    if (batchCount > 0) {
      await batch.commit();
      successCount += batchCount;
      console.log(`  ✅ Committed ${batchCount} documents`);
    }
    
    console.log(`  ✅ Collection '${collectionName}' copied: ${successCount} docs`);
    
    // Copy subcollections recursively
    for (const doc of snapshot.docs) {
      await copySubcollections(collectionName, doc.id);
    }
    
    return { success: successCount, failed: failedCount };
    
  } catch (error) {
    console.error(`  ❌ Failed to copy collection '${collectionName}':`, error.message);
    return { success: 0, failed: 0 };
  }
}

async function copySubcollections(parentCollection, docId) {
  try {
    const docRef = prodDb.collection(parentCollection).doc(docId);
    const collections = await docRef.listCollections();
    
    for (const subcollection of collections) {
      console.log(`  📂 Copying subcollection: ${parentCollection}/${docId}/${subcollection.id}`);
      
      const snapshot = await subcollection.get();
      
      if (snapshot.empty) {
        continue;
      }
      
      const batch = devDb.batch();
      let batchCount = 0;
      
      for (const subdoc of snapshot.docs) {
        const subdocRef = devDb.collection(parentCollection).doc(docId).collection(subcollection.id).doc(subdoc.id);
        batch.set(subdocRef, subdoc.data(), { merge: true });
        batchCount++;
        
        if (batchCount >= 500) {
          await batch.commit();
          console.log(`    ✅ Committed ${batchCount} subdocuments`);
          batchCount = 0;
        }
      }
      
      if (batchCount > 0) {
        await batch.commit();
        console.log(`    ✅ Committed ${batchCount} subdocuments`);
      }
    }
  } catch (error) {
    console.error(`  ⚠️  Error copying subcollections for ${parentCollection}/${docId}:`, error.message);
  }
}

async function copyAllData() {
  console.log('🔄 Starting Firestore data migration from PRODUCTION to DEV...\n');
  console.log(`Collections to copy: ${COLLECTIONS_TO_COPY.length}\n`);
  
  let totalSuccess = 0;
  let totalFailed = 0;
  
  for (const collectionName of COLLECTIONS_TO_COPY) {
    const result = await copyCollection(collectionName);
    totalSuccess += result.success;
    totalFailed += result.failed;
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log('🎉 Firestore Migration Complete!');
  console.log(`${'='.repeat(60)}`);
  console.log(`✅ Total documents copied: ${totalSuccess}`);
  console.log(`❌ Total failures: ${totalFailed}`);
  console.log(`\n⚠️  Note: Subcollections and nested data have also been copied`);
}

copyAllData()
  .then(() => {
    console.log('\n✅ Migration successful!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });



