/**
 * Keep ONLY the 9 legitimate test organizations
 * Delete everything else
 */

const admin = require('firebase-admin');
const path = require('path');

// EXACT organizations to KEEP
const KEEP_THESE = [
  'PixelPerfect Design Co. (TEST)',
  'Summit Wealth Management (TEST)',
  'The Adventure Gear Shop (TEST)',
  'GreenThumb Landscaping (TEST)',
  'AuraFlow Analytics (TEST)',
  'Executive Edge Coaching (TEST)',
  'Metro Property Group (TEST)',
  'Midwest Plastics Supply (TEST)',
  'CodeMaster Academy (TEST)',
];

async function cleanup() {
  // Initialize Firebase
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount)
  });
  const adminDb = admin.firestore();
  
  console.log('\n🗑️  Deleting ALL organizations except the 9 you specified\n');
  
  // Fetch all organizations
  const orgsSnapshot = await adminDb.collection('organizations').get();
  console.log(`Total organizations: ${orgsSnapshot.size}\n`);
  
  const toDelete = [];
  const toKeep = [];
  
  // Check each organization
  orgsSnapshot.forEach(doc => {
    const data = doc.data();
    const name = data.name || '';
    
    // Keep ONLY if in the whitelist
    if (KEEP_THESE.includes(name)) {
      toKeep.push({ id: doc.id, name });
    } else {
      toDelete.push({ id: doc.id, name });
    }
  });
  
  console.log(`✅ KEEPING: ${toKeep.length}`);
  toKeep.forEach(org => console.log(`   - ${org.name}`));
  
  console.log(`\n🗑️  DELETING: ${toDelete.length}`);
  
  if (toDelete.length === 0) {
    console.log('Nothing to delete!');
    process.exit(0);
  }
  
  // Delete everything not in whitelist
  const batch = adminDb.batch();
  let count = 0;
  
  for (const org of toDelete) {
    const orgRef = adminDb.collection('organizations').doc(org.id);
    batch.delete(orgRef);
    count++;
    
    if (count % 100 === 0) {
      console.log(`   Deleted ${count}/${toDelete.length}...`);
    }
    
    if (count % 500 === 0) {
      await batch.commit();
    }
  }
  
  if (count % 500 !== 0) {
    await batch.commit();
  }
  
  console.log(`\n✅ DONE! Deleted ${count} organizations`);
  console.log(`✅ Remaining: ${toKeep.length} organizations\n`);
  
  process.exit(0);
}

cleanup().catch(console.error);
