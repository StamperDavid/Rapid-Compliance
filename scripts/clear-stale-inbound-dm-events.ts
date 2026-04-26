/**
 * Delete stale inboundSocialEvents docs whose missionIds point at
 * already-deleted missions. Used after a Mission Control cleanup so the
 * dispatcher cron re-orchestrates the still-unread Bluesky / X DMs
 * via the current code path.
 *
 * Idempotent — only deletes events whose missionIds resolve to a
 * non-existent mission, so it never wipes valid in-flight events.
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

interface InboundEvent {
  id: string;
  provider?: string;
  kind?: string;
  mission_initiated?: boolean;
  missionId?: string;
}

async function main() {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();

  const eventsCol = db.collection(`organizations/${PLATFORM_ID}/inboundSocialEvents`);
  const missionsCol = db.collection(`organizations/${PLATFORM_ID}/missions`);

  const snap = await eventsCol.get();
  let cleared = 0;
  let kept = 0;

  for (const doc of snap.docs) {
    const ev = doc.data() as InboundEvent;
    if (!ev.mission_initiated || !ev.missionId) {
      kept++;
      continue;
    }
    const missionDoc = await missionsCol.doc(ev.missionId).get();
    if (missionDoc.exists) {
      kept++;
      continue;
    }
    console.log(`Deleting stale event ${ev.id} (mission ${ev.missionId} no longer exists)`);
    await doc.ref.delete();
    cleared++;
  }

  console.log(`\n✓ Cleared ${cleared} stale event(s); kept ${kept}.`);
  console.log('Bluesky\'s unread queue still has the same messages — the next cron run will create fresh inbound events via direct orchestration.');
}

main().catch((err) => { console.error(err); process.exit(1); });
