/**
 * Playwright Global Teardown
 *
 * Runs AFTER all E2E tests complete. ONLY deletes documents that were
 * created by E2E tests (identified by the E2E_TEMP_ prefix).
 *
 * SAFETY RULE: This teardown NEVER deletes documents unless their ID
 * starts with "E2E_TEMP_". Production data, demo data, API keys, and
 * all user-created content are left untouched.
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const PLATFORM_ID = 'rapid-compliance-root';
const ORG_DOC = `organizations/${PLATFORM_ID}`;

/** Prefix that ALL E2E test data must use */
const E2E_PREFIX = 'E2E_TEMP_';

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

async function deleteDocRecursively(db: admin.firestore.Firestore, docRef: admin.firestore.DocumentReference): Promise<number> {
  let deleted = 0;
  const subcollections = await docRef.listCollections();
  for (const sub of subcollections) {
    const snapshot = await sub.get();
    for (const doc of snapshot.docs) {
      deleted += await deleteDocRecursively(db, doc.ref);
    }
  }
  await docRef.delete();
  deleted++;
  return deleted;
}

async function globalTeardown() {
  console.info('\n[Global Teardown] Cleaning E2E_TEMP_ test data from Firestore...');

  let app: admin.app.App;
  try {
    app = initAdmin();
  } catch {
    console.info('[Global Teardown] Skipped (no service account key)');
    return;
  }

  const db = admin.firestore(app);
  let totalDeleted = 0;

  // Scan all subcollections under the platform org
  const orgRef = db.doc(ORG_DOC);
  const subcollections = await orgRef.listCollections();

  for (const sub of subcollections) {
    const snapshot = await sub.get();

    for (const doc of snapshot.docs) {
      // ONLY delete documents with the E2E_TEMP_ prefix
      if (!doc.id.startsWith(E2E_PREFIX)) {
        continue;
      }

      const count = await deleteDocRecursively(db, doc.ref);
      totalDeleted += count;
      console.info(`  [DELETED] ${sub.id}/${doc.id} (${count} docs)`);
    }
  }

  // Also clean up E2E_TEMP_ organizations (top-level)
  const orgsSnapshot = await db.collection('organizations')
    .where('__name__', '>=', E2E_PREFIX)
    .where('__name__', '<', `${E2E_PREFIX}\uf8ff`)
    .get();

  for (const doc of orgsSnapshot.docs) {
    const count = await deleteDocRecursively(db, doc.ref);
    totalDeleted += count;
    console.info(`  [DELETED] organizations/${doc.id} (${count} docs)`);
  }

  // Clean up E2E_TEMP_ users
  const usersSnapshot = await db.collection('users').get();
  const batch = db.batch();
  let batchCount = 0;

  for (const doc of usersSnapshot.docs) {
    if (doc.id.startsWith(E2E_PREFIX)) {
      batch.delete(doc.ref);
      batchCount++;
      totalDeleted++;
    }
  }

  if (batchCount > 0) {
    await batch.commit();
    console.info(`  [DELETED] ${batchCount} E2E_TEMP_ users`);
  }

  if (totalDeleted > 0) {
    console.info(`[Global Teardown] Cleaned ${totalDeleted} test documents`);
  } else {
    console.info('[Global Teardown] No test data to clean');
  }
}

export default globalTeardown;
