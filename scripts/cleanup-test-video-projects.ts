/**
 * One-off cleanup: list all VideoProjects and DELETE only the automated-TEST artifacts
 * (title exactly "E2E No-Stitch Trace" — created by scripts/verify-video-e2e-no-stitch.ts).
 * Real user projects are listed but NEVER deleted.
 *
 * Run:        npx tsx scripts/cleanup-test-video-projects.ts          (dry run — lists only)
 * Delete:     npx tsx scripts/cleanup-test-video-projects.ts --delete
 */

/* eslint-disable no-console */

import { adminDb } from '../src/lib/firebase/admin';
import { getSubCollection } from '../src/lib/firebase/collections';

const COLLECTION = getSubCollection('videoProjects');
const TEST_TITLES = new Set(['E2E No-Stitch Trace']);

async function main(): Promise<void> {
  const doDelete = process.argv.includes('--delete');
  const snap = await adminDb.collection(COLLECTION).get();

  console.log(`\n${snap.size} video project(s) in ${COLLECTION}:\n`);
  const toDelete: Array<{ id: string; title: string }> = [];
  for (const doc of snap.docs) {
    const d = doc.data() as { title?: string; docs?: unknown[]; updatedAt?: string };
    const title = d.title ?? '(untitled)';
    const docs = Array.isArray(d.docs) ? d.docs.length : 0;
    const isTest = TEST_TITLES.has(title.trim());
    console.log(`  ${isTest ? '🗑️ TEST ' : '✅ KEEP '} ${doc.id}  [${docs} docs]  "${title}"`);
    if (isTest) toDelete.push({ id: doc.id, title });
  }

  console.log(`\n${toDelete.length} test project(s) flagged for deletion.`);
  if (!doDelete) {
    console.log('Dry run — pass --delete to actually remove them.');
    return;
  }
  for (const t of toDelete) {
    await adminDb.collection(COLLECTION).doc(t.id).delete();
    console.log(`  deleted ${t.id} ("${t.title}")`);
  }
  console.log(`\nDone — removed ${toDelete.length} test project(s). Your real projects were untouched.`);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
