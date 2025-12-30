/**
 * Delete test organizations from PRODUCTION
 * Deletes "Test Organization" and "Unconfigured Org" duplicates
 */

const admin = require('firebase-admin');
const path = require('path');

async function deleteProductionTestOrgs() {
  console.log('\n🗑️  PRODUCTION CLEANUP\n');
  console.log('⚠️  Cleaning PRODUCTION database: ai-sales-platform-4f5e4\n');
  
  // Initialize with PRODUCTION credentials
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey-prod.json'));
  
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  
  const adminDb = admin.firestore();
  console.log('✅ Connected to PRODUCTION database\n');
  
  try {
    // Fetch all organizations
    const orgsSnapshot = await adminDb.collection('organizations').get();
    console.log(`📊 Total organizations in PROD: ${orgsSnapshot.size}\n`);
    
    const toDelete = [];
    const toKeep = [];
    
    // Identify test pollution
    orgsSnapshot.forEach(doc => {
      const data = doc.data();
      const name = data.name || '';
      
      // Delete test pollution patterns
      if (
        name === 'Test Organization' ||
        name === 'Unconfigured Org' ||
        name === 'Test Payment Org' ||
        name === 'Pagination Test Org'
      ) {
        toDelete.push({ id: doc.id, name });
      } else {
        toKeep.push({ id: doc.id, name });
      }
    });
    
    console.log('═══════════════════════════════════════════════════════════');
    console.log(`🗑️  Will DELETE: ${toDelete.length} organizations`);
    console.log('═══════════════════════════════════════════════════════════');
    const deleteSummary = {};
    toDelete.forEach(org => {
      deleteSummary[org.name] = (deleteSummary[org.name] || 0) + 1;
    });
    Object.entries(deleteSummary).forEach(([name, count]) => {
      console.log(`   - ${name}: ${count} duplicates`);
    });
    
    console.log('\n═══════════════════════════════════════════════════════════');
    console.log(`✅ Will KEEP: ${toKeep.length} organizations`);
    console.log('═══════════════════════════════════════════════════════════');
    toKeep.forEach(org => {
      console.log(`   - ${org.name}`);
    });
    
    console.log('\n⏳ Starting deletion in 3 seconds...\n');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Delete in batches
    const batch = adminDb.batch();
    let count = 0;
    
    for (const org of toDelete) {
      const orgRef = adminDb.collection('organizations').doc(org.id);
      batch.delete(orgRef);
      count++;
      
      if (count % 50 === 0) {
        console.log(`   Deleted ${count}/${toDelete.length}...`);
      }
      
      // Commit in batches of 500 (Firestore limit)
      if (count % 500 === 0) {
        await batch.commit();
      }
    }
    
    // Commit remaining
    if (count % 500 !== 0) {
      await batch.commit();
    }
    
    console.log(`\n✅ SUCCESS! PRODUCTION cleanup complete`);
    console.log(`   - Deleted: ${count} test organizations`);
    console.log(`   - Remaining: ${toKeep.length} organizations\n`);
    
    process.exit(0);
    
  } catch (error) {
    console.error('\n❌ ERROR:', error.message);
    console.error(error);
    process.exit(1);
  }
}

deleteProductionTestOrgs();
