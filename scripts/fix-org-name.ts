/**
 * Fix Organization Name in Firestore
 *
 * Updates the organization document's name from "Rapid Compliance"
 * to "SalesVelocity.ai" to match the rebrand.
 *
 * Usage: npx tsx scripts/fix-org-name.ts
 */

import * as admin from 'firebase-admin';
import { resolve } from 'path';
import { config } from 'dotenv';

const PLATFORM_ID = 'rapid-compliance-root';

function initFirebase(): admin.firestore.Firestore {
  if (admin.apps.length > 0) {
    return admin.firestore();
  }

  config({ path: resolve(__dirname, '../.env.local') });

  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const raw = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
    let serviceAccount: admin.ServiceAccount;
    if (raw.startsWith('{')) {
      serviceAccount = JSON.parse(raw) as admin.ServiceAccount;
    } else {
      const decoded = Buffer.from(raw, 'base64').toString('utf-8');
      serviceAccount = JSON.parse(decoded) as admin.ServiceAccount;
    }
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.firestore();
  }

  if (process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY) {
    const serviceAccount = {
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID
        ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        ?? process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    } as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
    return admin.firestore();
  }

  admin.initializeApp();
  return admin.firestore();
}

async function main(): Promise<void> {
  console.log('Fixing organization name...');

  const db = initFirebase();
  const orgRef = db.collection('organizations').doc(PLATFORM_ID);
  const orgDoc = await orgRef.get();

  if (!orgDoc.exists) {
    console.log('Organization document not found — nothing to update');
    return;
  }

  const data = orgDoc.data();
  console.log(`  Current name: "${data?.name}"`);

  if (data?.name === 'SalesVelocity.ai') {
    console.log('  Already correct — no update needed');
    return;
  }

  await orgRef.update({
    name: 'SalesVelocity.ai',
    updatedAt: new Date().toISOString(),
  });

  console.log('  Updated name to: "SalesVelocity.ai"');
  console.log('Done!');
}

main().catch((error) => {
  console.error('Failed:', error);
  process.exit(1);
});
