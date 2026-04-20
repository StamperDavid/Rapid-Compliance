/**
 * Delete all leads whose name/firstName/company does not contain "(Demo)".
 *
 * Default: dry-run — counts, lists the first 20, and exits without deleting.
 * Pass --delete to actually delete. Pass --yes to skip the count preview.
 *
 * Usage:
 *   npx tsx scripts/delete-non-demo-leads.ts              # dry-run
 *   npx tsx scripts/delete-non-demo-leads.ts --delete     # actually delete
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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

  if (!projectId || !clientEmail || !privateKey) {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
  admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
  });
}

initAdmin();

const DEFAULT_ORG_ID = 'rapid-compliance-root';
const LEADS_PATH = `organizations/${DEFAULT_ORG_ID}/leads`;
const DEMO_MARKER = '(Demo)';

function isDemoLead(data: Record<string, unknown>): boolean {
  // Any of these fields containing "(Demo)" qualifies it as a demo lead.
  const fields: Array<unknown> = [
    data.firstName,
    data.lastName,
    data.name,
    data.company,
    data.companyName,
    data.email,
  ];
  for (const f of fields) {
    if (typeof f === 'string' && f.includes(DEMO_MARKER)) { return true; }
  }
  // Also respect explicit isDemo flag if present (seeded data uses this).
  if (data.isDemo === true) { return true; }
  return false;
}

async function main(): Promise<void> {
  const db = admin.firestore();
  const doDelete = process.argv.includes('--delete');

  console.log('');
  console.log('═'.repeat(80));
  console.log(`  Leads cleanup — ${doDelete ? 'DELETE MODE' : 'dry-run (no changes)'}`);
  console.log(`  Path: ${LEADS_PATH}`);
  console.log(`  Rule: keep leads with "${DEMO_MARKER}" in name/company/email OR isDemo=true`);
  console.log('═'.repeat(80));
  console.log('');

  const snap = await db.collection(LEADS_PATH).get();
  const total = snap.size;
  const toDelete: Array<{ id: string; label: string }> = [];
  let demoKept = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (isDemoLead(data)) {
      demoKept += 1;
      continue;
    }
    const label = [
      typeof data.name === 'string' ? data.name : null,
      typeof data.company === 'string' ? data.company : null,
      typeof data.email === 'string' ? data.email : null,
    ].filter(Boolean).join(' · ') || doc.id;
    toDelete.push({ id: doc.id, label });
  }

  console.log(`  Total leads:       ${total}`);
  console.log(`  Demo leads (kept): ${demoKept}`);
  console.log(`  Non-demo (target): ${toDelete.length}`);
  console.log('');

  if (toDelete.length === 0) {
    console.log('  Nothing to delete. Done.');
    return;
  }

  console.log('  Sample of leads that would be deleted:');
  for (const lead of toDelete.slice(0, 20)) {
    console.log(`    - ${lead.id}  ${lead.label}`);
  }
  if (toDelete.length > 20) {
    console.log(`    ... and ${toDelete.length - 20} more`);
  }
  console.log('');

  if (!doDelete) {
    console.log(`  Dry-run complete. Re-run with --delete to actually remove ${toDelete.length} leads.`);
    return;
  }

  console.log(`  Deleting ${toDelete.length} leads in batches of 500...`);
  let deleted = 0;
  const batchSize = 500;
  for (let i = 0; i < toDelete.length; i += batchSize) {
    const chunk = toDelete.slice(i, i + batchSize);
    const batch = db.batch();
    for (const lead of chunk) {
      batch.delete(db.collection(LEADS_PATH).doc(lead.id));
    }
    await batch.commit();
    deleted += chunk.length;
    console.log(`    ... ${deleted}/${toDelete.length}`);
  }
  console.log('');
  console.log(`  ✓ Deleted ${deleted} leads. ${demoKept} demo leads preserved.`);
}

main().catch((err: unknown) => {
  console.error('Fatal:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
