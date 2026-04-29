/* eslint-disable no-console */
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';

if (admin.apps.length === 0) {
  const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function main(): Promise<void> {
  const projectId = (admin.app().options as { projectId?: string }).projectId;
  console.log(`Firestore project: ${projectId}`);

  const snap = await db.collection('organizations/rapid-compliance-root/social_accounts').get();
  console.log(`social_accounts count: ${snap.size}`);
  for (const d of snap.docs) {
    const data = d.data();
    console.log(`  ${d.id} → platform=${data.platform} handle=${data.handle} status=${data.status} addedAt=${data.addedAt}`);
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
