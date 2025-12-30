/**
 * Nuclear option - delete test orgs one by one with confirmation
 */

const admin = require('firebase-admin');
const path = require('path');

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

async function nuke() {
  // Force new instance
  admin.apps.forEach(app => app.delete());
  
  const serviceAccount = require(path.join(__dirname, '../serviceAccountKey.json'));
  const app = admin.initializeApp({ 
    credential: admin.credential.cert(serviceAccount)
  }, 'nuke-app');
  
  const db = app.firestore();
  
  console.log('\n💣 NUCLEAR DELETION\n');
  console.log(`Project: ${serviceAccount.project_id}\n`);
  
  const snapshot = await db.collection('organizations').get();
  console.log(`Found ${snapshot.size} total documents\n`);
  
  let deleted = 0;
  let kept = 0;
  
  // Delete ONE AT A TIME (no batching)
  for (const doc of snapshot.docs) {
    if (KEEP_IDS.includes(doc.id)) {
      console.log(`✅ KEEP: ${doc.id} - ${doc.data().name}`);
      kept++;
    } else {
      try {
        await doc.ref.delete();
        console.log(`🗑️  DELETED: ${doc.id} - ${doc.data().name || 'UNNAMED'}`);
        deleted++;
      } catch (e) {
        console.error(`❌ FAILED: ${doc.id} - ${e.message}`);
      }
    }
  }
  
  console.log(`\n✅ Complete: Deleted ${deleted}, Kept ${kept}\n`);
  await app.delete();
  process.exit(0);
}

nuke().catch(console.error);
