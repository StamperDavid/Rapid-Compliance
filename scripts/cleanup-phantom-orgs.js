/**
 * CLEANUP PHANTOM ORGANIZATIONS
 * 
 * Deletes subcollections under organization IDs that no longer have parent documents.
 * These "phantom" paths show in Firebase Console but the parent org was deleted.
 * 
 * This is the final cleanup to remove those 130+ ghost entries from your console.
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const DRY_RUN = !process.argv.includes('--confirm');

// Known phantom org IDs (parent document deleted, but subcollections remain)
const PHANTOM_ORG_IDS = [
  // From your first list (org_1765... and org_1766...)
  'backward-compat-test-org',
  'org_1765225213873_oxevq90gb',
  'org_1765225217069_lr5qgxvdx',
  'org_1765225219699_r6k96p7ah',
  'org_1765225222185_hbueo0raq',
  'org_1765225224420_0cdyhhx9s',
  'org_1765414518315_08meemywo',
  'org_1765768895262_vvy32u9zt',
  'org_1765831349042_llxnf9b1s',
  'org_1765831656808_o428sqby9',
  'org_1766859245788_t7vm8oqpo',
  'org_1766859247799_wv14kpz0k',
  'org_1766859249386_zql0tegpl',
  'org_1766859250886_apptoomot',
  'org_1766859252340_rwvicfzif',
  'org_1766859253825_epcq5c6yt',
  'org_1766859255234_8z91thofk',
  'org_1766859256708_yekaddkze',
  'org_1766859258149_pvhwajuge',
  'org_1766859737904_7myrohq4q',
  'org_1766859739458_55o6inw4a',
  'org_1766859740564_3bkemsbi3',
  'org_1766859741599_nwpugeelo',
  'org_1766859742765_653p3xuyh',
  // test-org-* pattern IDs (the 130+ from earlier)
  'test-org-1767056931936', 'test-org-1767056932040', 'test-org-1767056932041',
  'test-org-1767056932042', 'test-org-1767056932170', 'test-org-1767056932222',
  'test-org-1767056935162', 'test-org-1767056936016', 'test-org-1767058285576',
  'test-org-1767058285702', 'test-org-1767058285710', 'test-org-1767058285711',
  'test-org-1767058285712', 'test-org-1767058285723', 'test-org-1767058288609',
  'test-org-1767058290585', 'test-org-1767060767624', 'test-org-1767060767625',
  'test-org-1767060767627', 'test-org-1767060767645', 'test-org-1767060767646',
  'test-org-1767060767647', 'test-org-1767060770438', 'test-org-1767060770815',
  'test-org-1767062333333', 'test-org-1767062333405', 'test-org-1767062333504',
  'test-org-1767062333537', 'test-org-1767062333545', 'test-org-1767062333547',
  'test-org-1767062336537', 'test-org-1767062337447', 'test-org-1767064007314',
  'test-org-1767064007460', 'test-org-1767064007461', 'test-org-1767064007532',
  'test-org-1767064007570', 'test-org-1767064010510', 'test-org-1767064011300',
  'test-org-1767069659450', 'test-org-1767069659524', 'test-org-1767069659550',
  'test-org-1767069659575', 'test-org-1767069659576', 'test-org-1767069659577',
  'test-org-1767069662894', 'test-org-1767069663466', 'test-org-1767079894958',
  'test-org-1767079894982', 'test-org-1767079894983', 'test-org-1767079894993',
  'test-org-1767079895009', 'test-org-1767079897794', 'test-org-1767079900081',
  'test-org-1767079922841', 'test-org-1767079922905', 'test-org-1767079922920',
  'test-org-1767079922921', 'test-org-1767079922934', 'test-org-1767079925752',
  'test-org-1767079927852', 'test-org-1767211084795', 'test-org-1767211084797',
  'test-org-1767211084826', 'test-org-1767211084827', 'test-org-1767211087954',
  'test-org-1767211089271', 'test-org-1767221709226', 'test-org-1767221709229',
  'test-org-1767221709238', 'test-org-1767221709239', 'test-org-1767221709418',
  'test-org-1767221712850', 'test-org-1767221713127', 'test-org-1767232644435',
  'test-org-1767232644440', 'test-org-1767232644513', 'test-org-1767232644577',
  'test-org-1767232644578', 'test-org-1767232644579', 'test-org-1767232648790',
  'test-org-1767232648879', 'test-org-1767232899586', 'test-org-1767232899838',
  'test-org-1767232899839', 'test-org-1767232899855', 'test-org-1767232899856',
  'test-org-1767232903727', 'test-org-1767232904102', 'test-org-1767233128627',
  'test-org-1767233128704', 'test-org-1767233128705', 'test-org-1767233128903',
  'test-org-1767233128980', 'test-org-1767233131826', 'test-org-1767233132004',
  'test-org-1767233545632', 'test-org-1767233545633', 'test-org-1767233545634',
  'test-org-1767233545762', 'test-org-1767233545768', 'test-org-1767233545816',
  'test-org-1767233548953', 'test-org-1767233549886', 'test-org-distillation',
  'test-product-1'
];

console.log('\n╔═══════════════════════════════════════════════════════════════════════════╗');
console.log('║                                                                           ║');
console.log('║                    PHANTOM ORGANIZATION CLEANUP                           ║');
console.log('║                                                                           ║');
console.log('╚═══════════════════════════════════════════════════════════════════════════╝\n');
console.log(`Mode: ${DRY_RUN ? '🔍 DRY RUN' : '⚠️  LIVE MODE'}`);
console.log(`Project: ${process.env.FIREBASE_ADMIN_PROJECT_ID}`);
console.log(`Phantom Org IDs to check: ${PHANTOM_ORG_IDS.length}`);
console.log('');

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    })
  });
}

const db = admin.firestore();

/**
 * Recursively delete all documents in a collection
 */
async function deleteCollection(collectionRef, dryRun = true) {
  const snapshot = await collectionRef.get();
  
  if (snapshot.empty) {
    return 0;
  }
  
  let deletedCount = 0;
  const batchSize = 400; // Safe batch size
  
  // Process in batches
  for (let i = 0; i < snapshot.docs.length; i += batchSize) {
    const batch = db.batch();
    const docs = snapshot.docs.slice(i, i + batchSize);
    
    for (const doc of docs) {
      // Recursively delete any subcollections
      const subcollections = await doc.ref.listCollections();
      for (const subcollection of subcollections) {
        const subCount = await deleteCollection(subcollection, dryRun);
        deletedCount += subCount;
      }
      
      if (!dryRun) {
        batch.delete(doc.ref);
      }
      deletedCount++;
    }
    
    if (!dryRun && docs.length > 0) {
      await batch.commit();
    }
  }
  
  return deletedCount;
}

/**
 * Clean up phantom organization subcollections
 */
async function cleanupPhantomOrgs() {
  console.log('🔍 Scanning for phantom organization subcollections...\n');
  
  let totalSubcollections = 0;
  let totalDocuments = 0;
  const phantomsWithData = [];
  const phantomsEmpty = [];
  
  for (const orgId of PHANTOM_ORG_IDS) {
    try {
      // Check if parent document exists
      const orgDoc = await db.collection('organizations').doc(orgId).get();
      
      if (orgDoc.exists) {
        console.log(`⚠️  SKIPPING ${orgId} - Parent document EXISTS (not a phantom)`);
        continue;
      }
      
      // Parent doesn't exist - check for subcollections
      const orgRef = db.collection('organizations').doc(orgId);
      const subcollections = await orgRef.listCollections();
      
      if (subcollections.length === 0) {
        phantomsEmpty.push(orgId);
        continue;
      }
      
      // Found subcollections under phantom org!
      console.log(`\n👻 PHANTOM: ${orgId}`);
      console.log(`   Subcollections found: ${subcollections.length}`);
      
      let orgDocCount = 0;
      
      for (const subcollection of subcollections) {
        const snapshot = await subcollection.get();
        console.log(`      - ${subcollection.id}: ${snapshot.size} documents`);
        
        if (!DRY_RUN) {
          const deleted = await deleteCollection(subcollection, false);
          orgDocCount += deleted;
        } else {
          // In dry run, just count
          const countDocs = async (collRef) => {
            const snap = await collRef.get();
            let count = snap.size;
            for (const doc of snap.docs) {
              const subs = await doc.ref.listCollections();
              for (const sub of subs) {
                count += await countDocs(sub);
              }
            }
            return count;
          };
          orgDocCount += await countDocs(subcollection);
        }
      }
      
      phantomsWithData.push({ orgId, subcollections: subcollections.length, documents: orgDocCount });
      totalSubcollections += subcollections.length;
      totalDocuments += orgDocCount;
      
    } catch (error) {
      console.error(`   ❌ Error processing ${orgId}: ${error.message}`);
    }
  }
  
  // Summary
  console.log('\n═══════════════════════════════════════════════════════════════════════════');
  console.log('📊 SUMMARY');
  console.log('═══════════════════════════════════════════════════════════════════════════\n');
  console.log(`Phantom orgs checked: ${PHANTOM_ORG_IDS.length}`);
  console.log(`Phantoms with subcollections: ${phantomsWithData.length}`);
  console.log(`Phantoms already clean: ${phantomsEmpty.length}`);
  console.log(`Total subcollections found: ${totalSubcollections}`);
  console.log(`Total documents to delete: ${totalDocuments}`);
  console.log('');
  
  if (phantomsWithData.length > 0) {
    console.log('Phantom orgs with data:');
    phantomsWithData.forEach(p => {
      console.log(`  - ${p.orgId}: ${p.subcollections} subcollections, ${p.documents} documents`);
    });
    console.log('');
  }
  
  if (DRY_RUN) {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('🔍 DRY RUN - No changes made');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    console.log('To actually delete these phantom subcollections, run:');
    console.log('   node scripts/cleanup-phantom-orgs.js --confirm\n');
    console.log('This will permanently remove all orphaned data and clear the Firebase Console.\n');
  } else {
    console.log('═══════════════════════════════════════════════════════════════════════════');
    console.log('✅ CLEANUP COMPLETE');
    console.log('═══════════════════════════════════════════════════════════════════════════\n');
    console.log(`Deleted ${totalDocuments} documents from ${totalSubcollections} subcollections`);
    console.log('');
    console.log('🎉 Phantom organizations have been removed!');
    console.log('');
    console.log('To clear them from Firebase Console:');
    console.log('1. Close all Firebase Console tabs');
    console.log('2. Clear browser cache (Ctrl+Shift+Delete)');
    console.log('3. Reopen in incognito mode\n');
  }
}

cleanupPhantomOrgs()
  .then(() => process.exit(0))
  .catch(error => {
    console.error('\n❌ Fatal error:', error);
    process.exit(1);
  });
