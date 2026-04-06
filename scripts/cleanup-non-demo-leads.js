/**
 * DELETE NON-DEMO LEADS
 *
 * Deletes all leads that do NOT have "(Demo)" in their company name.
 * This cleans up test/Jasper-generated leads while preserving demo seed data.
 *
 * Usage:
 *   node scripts/cleanup-non-demo-leads.js              # Dry run (list only)
 *   node scripts/cleanup-non-demo-leads.js --confirm     # Execute deletions
 */

const admin = require('firebase-admin');
const path = require('path');

require('dotenv').config({ path: path.join(__dirname, '../.env.local') });

const DRY_RUN = !process.argv.includes('--confirm');
const PLATFORM_ID = 'rapid-compliance-root';

// Initialize Firebase Admin — same strategy as src/lib/firebase/admin.ts
if (!admin.apps.length) {
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID
    || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
    || 'rapid-compliance-65f87';

  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY
    ? process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n')
    : undefined;

  if (!clientEmail || !privateKey) {
    console.error('Missing FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY in .env.local');
    process.exit(1);
  }

  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    projectId,
  });
  console.log('Firebase initialized for project:', projectId);
}

const db = admin.firestore();

async function main() {
  console.log(`\n${'='.repeat(60)}`);
  console.log(`  DELETE NON-DEMO LEADS`);
  console.log(`  Mode: ${DRY_RUN ? 'DRY RUN (no deletions)' : 'LIVE — WILL DELETE'}`);
  console.log(`${'='.repeat(60)}\n`);

  const leadsRef = db.collection(`organizations/${PLATFORM_ID}/leads`);
  const snapshot = await leadsRef.get();

  console.log(`Total leads in collection: ${snapshot.size}\n`);

  const toDelete = [];
  const toKeep = [];

  for (const doc of snapshot.docs) {
    const data = doc.data();
    const company = data.company || data.companyName || '';
    const name = `${data.firstName || ''} ${data.lastName || ''}`.trim();
    const isDemoCompany = company.includes('(Demo)');
    const isDemoFlag = data.isDemo === true;

    if (isDemoCompany || isDemoFlag) {
      toKeep.push({ id: doc.id, name, company });
    } else {
      toDelete.push({ id: doc.id, name, company, source: data.source || data.acquisitionMethod || 'unknown' });
    }
  }

  console.log(`Keeping (Demo): ${toKeep.length}`);
  toKeep.forEach(l => console.log(`  ✓ ${l.id} — ${l.name} @ ${l.company}`));

  console.log(`\nDeleting (non-demo): ${toDelete.length}`);
  toDelete.forEach(l => console.log(`  ✗ ${l.id} — ${l.name} @ ${l.company} [${l.source}]`));

  if (toDelete.length === 0) {
    console.log('\nNothing to delete. All leads are demo data.');
    return;
  }

  if (DRY_RUN) {
    console.log(`\n⚠️  DRY RUN — ${toDelete.length} leads would be deleted.`);
    console.log('Run with --confirm to execute deletions.');
    return;
  }

  // Delete in batches of 500 (Firestore limit)
  const batchSize = 500;
  let deleted = 0;

  for (let i = 0; i < toDelete.length; i += batchSize) {
    const batch = db.batch();
    const chunk = toDelete.slice(i, i + batchSize);

    for (const lead of chunk) {
      batch.delete(leadsRef.doc(lead.id));
    }

    await batch.commit();
    deleted += chunk.length;
    console.log(`  Deleted batch: ${deleted}/${toDelete.length}`);
  }

  console.log(`\n✅ Done. Deleted ${deleted} non-demo leads. ${toKeep.length} demo leads preserved.`);
}

main().catch(err => {
  console.error('Script failed:', err);
  process.exit(1);
});
