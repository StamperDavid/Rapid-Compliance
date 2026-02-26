/**
 * Clean Test Data from Production Firestore
 *
 * This script removes test data that leaked into production collections
 * when NEXT_PUBLIC_APP_ENV=production was set during E2E test runs.
 *
 * Usage:  npx tsx scripts/clean-test-data.ts
 *
 * Safe-listed docs (will NOT be deleted):
 *   - toolTraining/voice  (legitimate training data)
 *   - orchestratorConversations/jasper_admin, jasper_merchant  (real conversations)
 *   - settings/booking  (legitimate config)
 *   - integrations/*  (legitimate integration configs)
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

// ---------------------------------------------------------------------------
// Firebase Admin Init (standalone — no Next.js runtime)
// ---------------------------------------------------------------------------

function initAdmin(): admin.app.App {
  if (admin.apps.length > 0) return admin.apps[0]!;

  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error(`serviceAccountKey.json not found at ${keyPath}`);
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;

  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'rapid-compliance-65f87',
  });
}

const app = initAdmin();
const db = admin.firestore(app);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ORG_DOC = 'organizations/rapid-compliance-root';

/** Collections under the org doc that should be fully wiped */
const WIPE_COLLECTIONS = [
  'products',
  'leads',
  'bookings',
  'deals',
  'carts',
  'workflows',
  'emailCampaigns',
  'workflowExecutions',
  'workflowWaits',
  'tasks',
  'missions',
  'eventLog',
] as const;

/** Docs to delete individually from settings */
const SETTINGS_DOCS_TO_DELETE = ['swarm_control'] as const;

/** Docs to KEEP (safe-listed) — everything not listed will be inspected */
const SAFE_DOCS: Record<string, string[]> = {
  toolTraining: ['voice'],
  orchestratorConversations: ['jasper_admin', 'jasper_merchant'],
  settings: ['booking', 'api-keys', 'brand-dna'],
  integrations: [], // keep all — these are real config
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function deleteCollection(collectionPath: string): Promise<number> {
  const collRef = db.collection(collectionPath);
  let deleted = 0;

  // Delete in batches of 400
  const batchSize = 400;
  let query = collRef.limit(batchSize);

  while (true) {
    const snapshot = await query.get();
    if (snapshot.empty) break;

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      // Recursively delete subcollections first
      const subcollections = await doc.ref.listCollections();
      for (const sub of subcollections) {
        await deleteCollection(sub.path);
      }
      batch.delete(doc.ref);
      deleted++;
    }
    await batch.commit();
  }

  return deleted;
}

async function deleteDoc(docPath: string): Promise<void> {
  const docRef = db.doc(docPath);

  // Recursively delete subcollections first
  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    await deleteCollection(sub.path);
  }

  await docRef.delete();
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== Firestore Test Data Cleanup ===\n');
  console.log(`Target: ${ORG_DOC}\n`);

  let totalDeleted = 0;

  // 1. Wipe full collections
  for (const col of WIPE_COLLECTIONS) {
    const colPath = `${ORG_DOC}/${col}`;
    const count = await deleteCollection(colPath);
    console.log(`  [WIPED] ${col}: ${count} documents deleted`);
    totalDeleted += count;
  }

  // 2. Delete specific settings docs
  for (const docId of SETTINGS_DOCS_TO_DELETE) {
    const docPath = `${ORG_DOC}/settings/${docId}`;
    const docSnap = await db.doc(docPath).get();
    if (docSnap.exists) {
      await deleteDoc(docPath);
      console.log(`  [DELETED] settings/${docId}`);
      totalDeleted++;
    } else {
      console.log(`  [SKIP] settings/${docId} — not found`);
    }
  }

  // 3. Scan remaining subcollections for any other test data
  console.log('\n--- Scanning remaining subcollections ---');
  const orgRef = db.doc(ORG_DOC);
  const subcollections = await orgRef.listCollections();

  for (const sub of subcollections) {
    const colName = sub.id;

    // Already wiped above
    if ((WIPE_COLLECTIONS as readonly string[]).includes(colName)) continue;

    const safeList = SAFE_DOCS[colName];

    if (safeList !== undefined && safeList.length === 0) {
      // Keep everything in this collection (e.g., integrations)
      const snap = await sub.get();
      console.log(`  [KEEP] ${colName}: ${snap.size} docs (safe-listed)`);
      continue;
    }

    // Check each doc — keep safe-listed, delete everything else
    const snap = await sub.get();
    for (const doc of snap.docs) {
      if (safeList && safeList.includes(doc.id)) {
        console.log(`  [KEEP] ${colName}/${doc.id} (safe-listed)`);
      } else {
        // Not safe-listed — this is test data, delete it
        await deleteDoc(`${ORG_DOC}/${colName}/${doc.id}`);
        console.log(`  [DELETED] ${colName}/${doc.id}`);
        totalDeleted++;
      }
    }
  }

  console.log(`\n=== Cleanup Complete: ${totalDeleted} documents deleted ===`);

  // 4. Verify — re-scan and report
  console.log('\n--- Post-cleanup verification ---');
  const postSubcollections = await orgRef.listCollections();
  for (const sub of postSubcollections) {
    const snap = await sub.get();
    if (snap.size > 0) {
      console.log(`  ${sub.id}: ${snap.size} docs remaining`);
      for (const doc of snap.docs) {
        console.log(`    - ${doc.id}`);
      }
    }
  }

  console.log('\nDone.');
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
