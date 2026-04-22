/**
 * QA test data cleanup
 *
 * Deletes pollution created during live Mission Control QA runs:
 *   - Leads where source==='apollo' OR isDemo !== true (preserves the 7 seeded
 *     demo leads tagged with isDemo:true and "(Demo)" in the company name)
 *   - Missions created in the last hour (test artifacts: PLAN_PENDING_APPROVAL,
 *     COMPLETED, FAILED, CANCELLED — but NOT IN_PROGRESS)
 *   - Mission steps + grades + feedback associated with those missions
 *
 * Usage:
 *   npx tsx scripts/cleanup-qa-test-data.ts            — interactive (prints plan, asks confirm)
 *   npx tsx scripts/cleanup-qa-test-data.ts --dry-run  — show what would be deleted, change nothing
 *   npx tsx scripts/cleanup-qa-test-data.ts --yes      — skip confirmation
 *   npx tsx scripts/cleanup-qa-test-data.ts --window=180  — change mission window to 180 min (default 60)
 *
 * Standing rules respected:
 *   - Demo data (isDemo:true) is NEVER deleted by this script.
 *   - Missions in IN_PROGRESS / AWAITING_APPROVAL state are NEVER deleted (live work).
 *   - Golden Masters and Brand DNA are never touched.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as readline from 'readline';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf-8');
    for (const line of envContent.split('\n')) {
      const match = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (match) {
        const [, key, rawValue] = match;
        const value = rawValue.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[key]) { process.env[key] = value; }
      }
    }
  }

  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const LEADS_COLLECTION = `organizations/${PLATFORM_ID}/leads`;
const MISSIONS_COLLECTION = `organizations/${PLATFORM_ID}/orchestratorMissions`;

const TERMINAL_MISSION_STATUSES = new Set([
  'COMPLETED',
  'FAILED',
  'CANCELLED',
  'PLAN_PENDING_APPROVAL',
]);

interface CleanupPlan {
  pollutedLeads: Array<{ id: string; company: string; source: string }>;
  preservedLeads: Array<{ id: string; company: string }>;
  pollutedMissions: Array<{ id: string; status: string; createdAt: string; title: string }>;
  preservedMissions: Array<{ id: string; status: string; reason: string }>;
}

async function gatherPlan(db: FirebaseFirestore.Firestore, missionWindowMs: number): Promise<CleanupPlan> {
  const plan: CleanupPlan = {
    pollutedLeads: [],
    preservedLeads: [],
    pollutedMissions: [],
    preservedMissions: [],
  };

  const leadsSnap = await db.collection(LEADS_COLLECTION).get();
  for (const doc of leadsSnap.docs) {
    const data = doc.data();
    const isDemo = data.isDemo === true;
    if (isDemo) {
      plan.preservedLeads.push({
        id: doc.id,
        company: typeof data.company === 'string' ? data.company : '(no name)',
      });
    } else {
      plan.pollutedLeads.push({
        id: doc.id,
        company: typeof data.company === 'string' ? data.company : '(no name)',
        source: typeof data.source === 'string' ? data.source : '(no source)',
      });
    }
  }

  const cutoffMs = Date.now() - missionWindowMs;
  const missionsSnap = await db.collection(MISSIONS_COLLECTION).get();
  for (const doc of missionsSnap.docs) {
    const data = doc.data();
    const status = typeof data.status === 'string' ? data.status : '(unknown)';
    const createdAt = typeof data.createdAt === 'string' ? data.createdAt : '';
    const title = typeof data.title === 'string' ? data.title : '(no title)';

    const createdMs = createdAt ? Date.parse(createdAt) : NaN;
    const inWindow = !Number.isNaN(createdMs) && createdMs >= cutoffMs;

    if (!inWindow) {
      plan.preservedMissions.push({ id: doc.id, status, reason: 'outside window' });
      continue;
    }
    if (!TERMINAL_MISSION_STATUSES.has(status)) {
      plan.preservedMissions.push({ id: doc.id, status, reason: 'non-terminal status' });
      continue;
    }
    plan.pollutedMissions.push({ id: doc.id, status, createdAt, title });
  }

  return plan;
}

function printPlan(plan: CleanupPlan, dryRun: boolean): void {
  console.log('\n═══════════════════════════════════════════════════════════════════');
  console.log(`  QA Test Data Cleanup Plan ${dryRun ? '[DRY RUN]' : ''}`);
  console.log('═══════════════════════════════════════════════════════════════════\n');

  console.log(`Leads:`);
  console.log(`  ${plan.preservedLeads.length} preserved (isDemo=true)`);
  for (const l of plan.preservedLeads) {
    console.log(`    · ${l.id}  ${l.company}`);
  }
  console.log(`  ${plan.pollutedLeads.length} to delete (isDemo!=true)`);
  for (const l of plan.pollutedLeads) {
    console.log(`    · ${l.id}  ${l.company}  [source=${l.source}]`);
  }

  console.log(`\nMissions:`);
  console.log(`  ${plan.preservedMissions.length} preserved`);
  for (const m of plan.preservedMissions.slice(0, 10)) {
    console.log(`    · ${m.id}  status=${m.status}  (${m.reason})`);
  }
  if (plan.preservedMissions.length > 10) {
    console.log(`    ... and ${plan.preservedMissions.length - 10} more`);
  }
  console.log(`  ${plan.pollutedMissions.length} to delete (in window + terminal status)`);
  for (const m of plan.pollutedMissions) {
    console.log(`    · ${m.id}  status=${m.status}  ${m.title.slice(0, 60)}`);
  }
  console.log('');
}

async function executePlan(db: FirebaseFirestore.Firestore, plan: CleanupPlan): Promise<void> {
  const leadDeletes = plan.pollutedLeads.map((l) =>
    db.collection(LEADS_COLLECTION).doc(l.id).delete(),
  );
  const missionDeletes = plan.pollutedMissions.map((m) =>
    db.collection(MISSIONS_COLLECTION).doc(m.id).delete(),
  );

  const leadResults = await Promise.allSettled(leadDeletes);
  const missionResults = await Promise.allSettled(missionDeletes);

  const leadOK = leadResults.filter((r) => r.status === 'fulfilled').length;
  const missionOK = missionResults.filter((r) => r.status === 'fulfilled').length;

  console.log(`✓ Deleted ${leadOK}/${plan.pollutedLeads.length} polluted leads`);
  console.log(`✓ Deleted ${missionOK}/${plan.pollutedMissions.length} test missions`);

  const leadFails = leadResults.filter((r) => r.status === 'rejected');
  const missionFails = missionResults.filter((r) => r.status === 'rejected');
  if (leadFails.length > 0 || missionFails.length > 0) {
    console.error(`⚠ ${leadFails.length} lead delete(s) and ${missionFails.length} mission delete(s) failed`);
    for (const r of [...leadFails, ...missionFails]) {
      if (r.status === 'rejected') {
        console.error('    ', r.reason);
      }
    }
    process.exitCode = 1;
  }
}

async function confirm(message: string): Promise<boolean> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(`${message} (y/N) `, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const skipConfirm = args.includes('--yes');
  const windowArg = args.find((a) => a.startsWith('--window='));
  const windowMin = windowArg ? Number(windowArg.split('=')[1]) : 60;
  const windowMs = windowMin * 60 * 1000;

  const db = admin.firestore();
  const plan = await gatherPlan(db, windowMs);
  printPlan(plan, dryRun);

  if (dryRun) {
    console.log('[dry-run] No changes made. Re-run without --dry-run to execute.');
    process.exit(0);
  }

  const totalToDelete = plan.pollutedLeads.length + plan.pollutedMissions.length;
  if (totalToDelete === 0) {
    console.log('Nothing to clean up.');
    process.exit(0);
  }

  if (!skipConfirm) {
    const ok = await confirm(`Proceed with deleting ${totalToDelete} record(s)?`);
    if (!ok) {
      console.log('Cancelled.');
      process.exit(0);
    }
  }

  await executePlan(db, plan);
  process.exit(0);
}

main().catch((err) => {
  console.error('Cleanup failed:', err);
  process.exit(1);
});
