/**
 * Cleanup script: Delete non-demo leads created by Jasper test campaigns.
 * Targets leads with source: 'apollo' (created by scan_leads tool).
 * Leaves all demo data untouched.
 *
 * Usage: node scripts/_cleanup-test-leads.js
 */

const admin = require('firebase-admin');
const path = require('path');

// Initialize Firebase Admin using serviceAccountKey.json (same as admin.ts Strategy 3)
const serviceAccountPath = path.resolve(__dirname, '../serviceAccountKey.json');
const serviceAccount = JSON.parse(require('fs').readFileSync(serviceAccountPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  projectId: 'rapid-compliance-65f87',
});

const db = admin.firestore();
const LEADS_COLLECTION = 'organizations/rapid-compliance-root/leads';

async function main() {
  console.log('Querying non-demo leads (source: apollo)...\n');

  // Get all apollo-sourced leads (from scan_leads tool)
  const snapshot = await db.collection(LEADS_COLLECTION)
    .where('source', '==', 'apollo')
    .get();

  if (snapshot.empty) {
    console.log('No apollo-sourced leads found. Nothing to delete.');
    return;
  }

  console.log(`Found ${snapshot.size} apollo-sourced leads to delete:\n`);

  const ids = [];
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const name = data.name || data.company || data.email || doc.id;
    console.log(`  - ${name} (${doc.id})`);
    ids.push(doc.id);
  }

  console.log(`\nDeleting ${ids.length} leads...`);

  // Batch delete (Firestore allows 500 per batch)
  const batchSize = 500;
  for (let i = 0; i < ids.length; i += batchSize) {
    const batch = db.batch();
    const chunk = ids.slice(i, i + batchSize);
    for (const id of chunk) {
      batch.delete(db.collection(LEADS_COLLECTION).doc(id));
    }
    await batch.commit();
    console.log(`  Deleted batch ${Math.floor(i / batchSize) + 1} (${chunk.length} leads)`);
  }

  console.log(`\nDone. ${ids.length} test leads deleted. Demo data untouched.`);
}

main().catch(console.error).finally(() => process.exit(0));
