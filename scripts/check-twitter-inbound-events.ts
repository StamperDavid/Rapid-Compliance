/**
 * Read the inboundSocialEvents collection and print the most recent
 * twitter events. Used to verify webhook receipt.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

async function main(): Promise<void> {
  const db = admin.firestore();
  // Single-where query to skip needing a composite index. Sort
  // client-side.
  const snap = await db
    .collection('organizations/rapid-compliance-root/inboundSocialEvents')
    .where('provider', '==', 'twitter')
    .get();
  console.log(`Found ${snap.size} twitter events`);
  const sorted = snap.docs
    .map((d) => d.data() as { id: string; kind: string; receivedAt: string; payload: Record<string, unknown> })
    .sort((a, b) => (b.receivedAt > a.receivedAt ? 1 : -1))
    .slice(0, 10);
  for (const e of sorted) {
    console.log(`  ${e.id}  kind=${e.kind}  at=${e.receivedAt}`);
    const dm = (e.payload.direct_message_events as Array<{ message_create?: { message_data?: { text?: string }; sender_id?: string } }> | undefined);
    if (dm && dm.length > 0) {
      for (const m of dm) {
        const text = m.message_create?.message_data?.text;
        const sender = m.message_create?.sender_id;
        if (text) {
          console.log(`    DM from ${sender}: "${text.slice(0, 100)}"`);
        }
      }
    }
  }
}

main().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
