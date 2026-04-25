/**
 * Recursive test-data cleanup.
 *
 * Deletes docs created by today's (and prior) test runs, preserving:
 *   - Anything tagged `isDemo: true`
 *   - Anything whose document ID starts with `demo-` (legacy demo data
 *     seeded by Part 1/2/3 scripts that lacks the isDemo flag)
 *
 * Standing rules respected:
 *   - Demo data is NEVER deleted (CLAUDE.md memory: stays permanently
 *     until pre-launch).
 *   - Golden Masters, Brand DNA, organizations, users, apiKeys are
 *     NEVER touched.
 *   - Missions in IN_PROGRESS or AWAITING_APPROVAL state are NEVER
 *     deleted (live work).
 *
 * Default mode is DRY-RUN. Run with --confirm to execute.
 *
 * Usage:
 *   npx tsx scripts/cleanup-test-data-recursive.ts             # dry run
 *   npx tsx scripts/cleanup-test-data-recursive.ts --confirm   # execute
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function loadEnvLocal(): void {
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (!fs.existsSync(envPath)) { return; }
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
    if (m) {
      const v = m[2].replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
      if (!process.env[m[1]]) { process.env[m[1]] = v; }
    }
  }
}

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  loadEnvLocal();
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const BASE = `organizations/${PLATFORM_ID}`;

// Mission statuses that are SAFE to delete (no live work in progress).
// IN_PROGRESS and AWAITING_APPROVAL are excluded — they may be active runs
// the operator is currently reviewing.
const TERMINAL_MISSION_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'PLAN_PENDING_APPROVAL',
]);

interface CleanupTarget {
  /** Subcollection name relative to organizations/{PLATFORM_ID}/ */
  name: string;
  /** Predicate that returns true when a doc is SAFE to delete. */
  shouldDelete: (id: string, data: FirebaseFirestore.DocumentData) => boolean;
  /** Human-readable reason for the protection rule, shown in dry-run report. */
  preserves: string;
}

function isDemoDoc(id: string, data: FirebaseFirestore.DocumentData): boolean {
  if (data.isDemo === true) { return true; }
  if (id.startsWith('demo-')) { return true; }
  return false;
}

const TARGETS: CleanupTarget[] = [
  {
    name: 'missions',
    preserves: 'demo-* IDs, isDemo=true, IN_PROGRESS / AWAITING_APPROVAL missions',
    shouldDelete: (id, data) => {
      if (isDemoDoc(id, data)) { return false; }
      const status = typeof data.status === 'string' ? data.status : '';
      if (!TERMINAL_MISSION_STATUSES.has(status)) { return false; }
      return true;
    },
  },
  {
    name: 'orchestratorMissions',
    preserves: 'demo-* IDs, isDemo=true (legacy collection — likely all stale)',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'workflowSequenceJobs',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'workflows',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'workflowExecutions',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'workflowEvents',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'scheduleTriggers',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'campaigns',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'sequences',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'sequenceEnrollments',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'blogPosts',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'socialPosts',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'emailCampaigns',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'video_pipeline_projects',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'scene_previews',
    preserves: 'demo-* IDs, isDemo=true (auto-generated previews from test runs)',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'missionGrades',
    preserves: 'demo-* IDs, isDemo=true (grades referencing deleted test missions)',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'trainingFeedback',
    preserves: 'demo-* IDs, isDemo=true (feedback from test runs)',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'conversations',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  {
    name: 'contentPackages',
    preserves: 'demo-* IDs, isDemo=true',
    shouldDelete: (id, data) => !isDemoDoc(id, data),
  },
  // Leads are protected by isDemo only (the 7 seeded demo leads are tagged).
  // No `demo-` ID convention here — Apollo / scan_leads docs use opaque IDs.
  {
    name: 'leads',
    preserves: 'isDemo=true (the 7 seeded demo leads)',
    shouldDelete: (_id, data) => data.isDemo !== true,
  },
];

interface PerCollectionResult {
  name: string;
  preserves: string;
  total: number;
  toDelete: number;
  preserved: number;
  sampleDelete: string[];
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const confirm = args.includes('--confirm');
  const dryRun = !confirm;

  const db = admin.firestore();

  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  Recursive test-data cleanup ${dryRun ? '[DRY RUN]' : '[EXECUTING]'}`);
  console.log('═══════════════════════════════════════════════════════════════════');
  console.log(`  base: ${BASE}\n`);

  const results: PerCollectionResult[] = [];
  let grandToDelete = 0;
  let grandPreserved = 0;

  for (const target of TARGETS) {
    const colRef = db.collection(`${BASE}/${target.name}`);
    const snap = await colRef.get();
    let toDelete = 0;
    let preserved = 0;
    const sampleDelete: string[] = [];
    const docsToDelete: FirebaseFirestore.QueryDocumentSnapshot[] = [];

    for (const doc of snap.docs) {
      const data = doc.data();
      if (target.shouldDelete(doc.id, data)) {
        toDelete++;
        docsToDelete.push(doc);
        if (sampleDelete.length < 4) { sampleDelete.push(doc.id); }
      } else {
        preserved++;
      }
    }

    results.push({
      name: target.name,
      preserves: target.preserves,
      total: snap.size,
      toDelete,
      preserved,
      sampleDelete,
    });
    grandToDelete += toDelete;
    grandPreserved += preserved;

    if (!dryRun && docsToDelete.length > 0) {
      // Batched delete (Firestore limit is 500 ops per batch).
      const BATCH_SIZE = 400;
      for (let i = 0; i < docsToDelete.length; i += BATCH_SIZE) {
        const batch = db.batch();
        for (const doc of docsToDelete.slice(i, i + BATCH_SIZE)) {
          batch.delete(doc.ref);
        }
        await batch.commit();
      }
    }
  }

  // ── Report ────────────────────────────────────────────────────────────────
  const colWidth = 28;
  for (const r of results) {
    const sample = r.sampleDelete.length > 0 ? `  e.g. ${r.sampleDelete.slice(0, 3).join(', ')}` : '';
    console.log(
      `  ${r.name.padEnd(colWidth)}  total=${String(r.total).padStart(5)}  ${dryRun ? 'wouldDelete' : 'deleted'}=${String(r.toDelete).padStart(5)}  preserved=${String(r.preserved).padStart(5)}${sample}`,
    );
  }

  console.log('');
  console.log(`  ${dryRun ? 'Would delete' : 'Deleted'}: ${grandToDelete} doc(s)`);
  console.log(`  Preserved: ${grandPreserved} doc(s) (demo data + live work)`);
  console.log('');

  if (dryRun) {
    console.log('[dry-run] No changes made. Re-run with --confirm to execute.');
  } else {
    console.log('Cleanup complete.');
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error('cleanup failed:', err);
  process.exit(1);
});
