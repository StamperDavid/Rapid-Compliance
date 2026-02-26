/**
 * Playwright Global Teardown
 *
 * Runs AFTER all E2E tests complete. Recursively deletes test data
 * from production Firestore subcollections under the platform org.
 *
 * This prevents test data pollution when NEXT_PUBLIC_APP_ENV=production
 * causes the dev server to write to production Firestore paths.
 *
 * Safe-listed collections/docs are preserved:
 *   - toolTraining/voice
 *   - orchestratorConversations/*
 *   - settings/booking, settings/api-keys, settings/brand-dna
 *   - integrations/* (real config)
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const PLATFORM_ID = 'rapid-compliance-root';
const ORG_DOC = `organizations/${PLATFORM_ID}`;

/** Collections that should be fully wiped after every test run */
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
  'memoryVault',
] as const;

/** Documents to always keep (collection → list of safe doc IDs; empty = keep all) */
const SAFE_DOCS: Record<string, string[]> = {
  toolTraining: ['voice'],
  orchestratorConversations: [], // keep all
  settings: ['booking', 'api-keys', 'brand-dna'],
  integrations: [], // keep all
};

function initAdmin(): admin.app.App {
  const existing = admin.apps[0];
  if (existing) {return existing;}

  const keyPath = path.join(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    console.warn('[Global Teardown] serviceAccountKey.json not found — skipping cleanup');
    throw new Error('No service account key');
  }

  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8')) as admin.ServiceAccount;
  return admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
    projectId: 'rapid-compliance-65f87',
  });
}

async function deleteCollection(db: admin.firestore.Firestore, collectionPath: string): Promise<number> {
  const collRef = db.collection(collectionPath);
  let deleted = 0;
  const batchSize = 400;

  while (true) {
    const snapshot = await collRef.limit(batchSize).get();
    if (snapshot.empty) {break;}

    const batch = db.batch();
    for (const doc of snapshot.docs) {
      const subcollections = await doc.ref.listCollections();
      for (const sub of subcollections) {
        await deleteCollection(db, sub.path);
      }
      batch.delete(doc.ref);
      deleted++;
    }
    await batch.commit();
  }

  return deleted;
}

async function deleteDoc(db: admin.firestore.Firestore, docPath: string): Promise<void> {
  const docRef = db.doc(docPath);
  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    await deleteCollection(db, sub.path);
  }
  await docRef.delete();
}

async function globalTeardown() {
  console.info('\n[Global Teardown] Cleaning test data from Firestore...');

  let app: admin.app.App;
  try {
    app = initAdmin();
  } catch {
    console.info('[Global Teardown] Skipped (no service account key)');
    return;
  }

  const db = admin.firestore(app);
  let totalDeleted = 0;

  // 1. Wipe known test-data collections
  for (const col of WIPE_COLLECTIONS) {
    const count = await deleteCollection(db, `${ORG_DOC}/${col}`);
    if (count > 0) {
      console.info(`  [WIPED] ${col}: ${count} docs`);
      totalDeleted += count;
    }
  }

  // 2. Scan remaining subcollections — delete anything not safe-listed
  const orgRef = db.doc(ORG_DOC);
  const subcollections = await orgRef.listCollections();

  for (const sub of subcollections) {
    const colName = sub.id;
    if ((WIPE_COLLECTIONS as readonly string[]).includes(colName)) {continue;}

    const safeList = SAFE_DOCS[colName];

    // Keep all docs in fully safe-listed collections
    if (safeList?.length === 0) {continue;}

    const snap = await sub.get();
    for (const doc of snap.docs) {
      if (safeList?.includes(doc.id)) {continue;}

      await deleteDoc(db, `${ORG_DOC}/${colName}/${doc.id}`);
      totalDeleted++;
    }
  }

  if (totalDeleted > 0) {
    console.info(`[Global Teardown] Cleaned ${totalDeleted} test documents`);
  } else {
    console.info('[Global Teardown] No test data to clean');
  }
}

export default globalTeardown;
