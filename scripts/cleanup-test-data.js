/**
 * Cleanup Test Data — Deletes everything that is NOT demo data
 *
 * Safe to run anytime after testing. Preserves all demo-* seeded data.
 * Targets collections where Jasper's tools write during QA testing.
 *
 * Usage: node scripts/cleanup-test-data.js
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Firebase init (same pattern as seed scripts)
const keyPath = path.join(__dirname, '..', 'serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('Missing serviceAccountKey.json in project root');
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert(require(keyPath)),
  });
}

const db = admin.firestore();
const ORG_PATH = 'organizations/rapid-compliance-root';

// Collections where Jasper tools write test data
// NOTE: missions are intentionally excluded — those are testing history, not junk data
const COLLECTIONS_TO_CLEAN = [
  'leads',           // scan_leads writes here
  'posts',           // delegate_to_content writes here
  'social_posts',    // delegate_to_marketing writes here
  'sequences',       // delegate_to_outreach writes here
  'campaigns',       // create_campaign writes here
  'video_pipeline_projects',  // produce_video writes here
  'pages',           // delegate_to_builder/architect writes here (nested under website)
  'media',           // media library
];

// Also check nested pages path
const NESTED_PAGES_PATH = `${ORG_PATH}/website/pages/items`;

function isDemoDocument(docId, data) {
  // Layer 1: ID prefix
  if (docId.startsWith('demo-')) return true;

  // Layer 2: isDemo flag
  if (data.isDemo === true) return true;

  // Layer 3: (Demo) in names
  const nameFields = [
    data.name, data.title, data.firstName, data.lastName,
    data.company, data.label, data.companyName,
  ];
  for (const field of nameFields) {
    if (typeof field === 'string' && field.includes('(Demo)')) return true;
  }

  return false;
}

async function cleanCollection(collectionPath, label) {
  const snapshot = await db.collection(collectionPath).get();

  if (snapshot.empty) {
    console.log(`  ${label}: empty (nothing to clean)`);
    return 0;
  }

  let deleted = 0;
  let preserved = 0;
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of snapshot.docs) {
    const data = doc.data();

    if (isDemoDocument(doc.id, data)) {
      preserved++;
      continue;
    }

    // This is test data — delete it
    batch.delete(doc.ref);
    batchCount++;
    deleted++;

    // Firestore batches max out at 500
    if (batchCount >= 450) {
      await batch.commit();
      batchCount = 0;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
  }

  console.log(`  ${label}: deleted ${deleted}, preserved ${preserved} demo docs`);
  return deleted;
}

async function main() {
  console.log('\n🧹 Cleaning up test data (preserving demo data)...\n');

  let totalDeleted = 0;

  for (const collection of COLLECTIONS_TO_CLEAN) {
    const fullPath = `${ORG_PATH}/${collection}`;
    totalDeleted += await cleanCollection(fullPath, collection);
  }

  // Also clean nested pages
  totalDeleted += await cleanCollection(NESTED_PAGES_PATH, 'website/pages/items');

  console.log(`\n✅ Done. Deleted ${totalDeleted} test documents total.\n`);
  console.log('Demo data preserved. Run seed scripts to restore if needed.');
  process.exit(0);
}

main().catch(err => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
