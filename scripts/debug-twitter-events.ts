/* eslint-disable no-console */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

const sa = JSON.parse(fs.readFileSync(path.resolve('serviceAccountKey.json'), 'utf-8'));
if (admin.apps.length === 0) {
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

async function main(): Promise<void> {
  const db = admin.firestore();
  const snap = await db
    .collection('organizations/rapid-compliance-root/inboundSocialEvents')
    .where('provider', '==', 'twitter')
    .get();
  for (const d of snap.docs) {
    const data = d.data();
    console.log(JSON.stringify({
      id: data.id,
      kind: data.kind,
      processed: data.processed,
      processedAt: data.processedAt,
      reply: data.reply,
      error: data.error,
      skippedReason: data.skippedReason,
    }, null, 2));
  }
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
