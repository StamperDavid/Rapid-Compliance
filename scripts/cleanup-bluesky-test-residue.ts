/**
 * One-shot cleanup of test residue from the Apr 26 Bluesky DM
 * pipeline build session: the 3 trainingFeedback records I submitted
 * to validate the grading loop, and the 2 inboundSocialEvents docs
 * whose mission_initiated flags point at missions that were already
 * deleted by the operator.
 *
 * Idempotent — safe to re-run; only deletes the records by exact id.
 */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

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
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const TRAINING_FEEDBACK_IDS = [
  'tfb_bluesky_expert_1777238534701',
  'tfb_bluesky_expert_1777238757017',
  'tfb_bluesky_expert_1777238866173',
];
const INBOUND_EVENT_IDS = [
  'bluesky_3mkg52kltb32t',
  'bluesky_3mkg7fpqbks24',
];

async function main(): Promise<void> {
  const db = admin.firestore();
  let deleted = 0;
  let missing = 0;

  for (const id of TRAINING_FEEDBACK_IDS) {
    const ref = db.collection(`organizations/${PLATFORM_ID}/trainingFeedback`).doc(id);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`  trainingFeedback/${id} (already gone)`); missing++; continue; }
    await ref.delete();
    console.log(`  ✓ deleted trainingFeedback/${id}`);
    deleted++;
  }

  for (const id of INBOUND_EVENT_IDS) {
    const ref = db.collection(`organizations/${PLATFORM_ID}/inboundSocialEvents`).doc(id);
    const snap = await ref.get();
    if (!snap.exists) { console.log(`  inboundSocialEvents/${id} (already gone)`); missing++; continue; }
    await ref.delete();
    console.log(`  ✓ deleted inboundSocialEvents/${id}`);
    deleted++;
  }

  console.log(`\nDone. Deleted ${deleted} doc(s); ${missing} were already absent.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
