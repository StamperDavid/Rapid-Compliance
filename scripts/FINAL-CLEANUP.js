const admin = require('firebase-admin');
const path = require('path');

// EXACT IDs to KEEP (from verification script)
const KEEP_IDS = [
  'org_1766859253825_epcq5c6yt',
  'org_1766859255234_8z91thofk',
  'org_1766859256708_yekaddkze',
  'org_1766859258149_pvhwajuge',
  'org_1766859737904_7myrohq4q',
  'org_1766859739458_55o6inw4a',
  'org_1766859740564_3bkemsbi3',
  'org_1766859741599_nwpugeelo',
  'org_1766859742765_653p3xuyh',
];

async function finalCleanup() {
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
  const db = admin.firestore();
  
  console.log('\n🗑️ FINAL CLEANUP - Keep only 9 specific IDs\n');
  
  const snapshot = await db.collection('organizations').get();
  console.log(`Total: ${snapshot.size}\n`);
  
  const batch = db.batch();
  let deleted = 0;
  
  snapshot.forEach(doc => {
    if (!KEEP_IDS.includes(doc.id)) {
      batch.delete(doc.ref);
      deleted++;
      console.log(`Delete: ${doc.id} - ${doc.data().name || 'UNNAMED'}`);
    }
  });
  
  if (deleted > 0) {
    await batch.commit();
    console.log(`\n✅ Deleted ${deleted} organizations`);
  } else {
    console.log('Already clean!');
  }
  
  process.exit(0);
}

finalCleanup().catch(console.error);
