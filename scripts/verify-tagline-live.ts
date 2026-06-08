/**
 * VERIFY the tagline is live in EVERY active Golden Master across all collections.
 * Read-only. Confirms the swarm-wide brand re-bake + Jasper reseed actually landed.
 *
 * Usage: npx tsx scripts/verify-tagline-live.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) { return; }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) {
        const [, k, raw] = m;
        const v = raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[k]) { process.env[k] = v; }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    const sak = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (!fs.existsSync(sak)) { throw new Error('No admin creds'); }
    admin.initializeApp({ credential: admin.credential.cert(JSON.parse(fs.readFileSync(sak, 'utf-8')) as admin.ServiceAccount) });
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const TAGLINE = 'Accelerate your growth';

function promptOf(data: Record<string, unknown>): string {
  const cfg = data.config as { systemPrompt?: unknown } | undefined;
  if (cfg && typeof cfg.systemPrompt === 'string') { return cfg.systemPrompt; }
  return typeof data.systemPromptSnapshot === 'string' ? data.systemPromptSnapshot : '';
}

async function main(): Promise<void> {
  const db = admin.firestore();
  let total = 0;
  let withTagline = 0;
  const missing: string[] = [];

  async function check(collection: string, idField: string, onlyActive: boolean): Promise<void> {
    let q: admin.firestore.Query = db.collection(`organizations/${PLATFORM_ID}/${collection}`);
    if (onlyActive) { q = q.where('isActive', '==', true); }
    const snap = await q.get();
    for (const doc of snap.docs) {
      const data = doc.data();
      if (onlyActive === false && data.isActive !== true) { continue; }
      const label = `${collection}/${(data[idField] as string) ?? doc.id}`;
      total += 1;
      if (promptOf(data).includes(TAGLINE)) { withTagline += 1; }
      else { missing.push(label); }
    }
  }

  await check('specialistGoldenMasters', 'specialistId', true);
  await check('managerGoldenMasters', 'managerId', true);
  // Jasper / orchestrator lives in goldenMasters keyed by agentType; check active ones.
  await check('goldenMasters', 'id', false);

  console.log(`\n=== Tagline "${TAGLINE}" coverage across ACTIVE Golden Masters ===`);
  console.log(`  total active GMs checked : ${total}`);
  console.log(`  contain the tagline      : ${withTagline}`);
  console.log(`  MISSING the tagline      : ${missing.length}`);
  if (missing.length > 0) {
    console.log(`\n  Missing:`);
    for (const m of missing) { console.log(`    ❌ ${m}`); }
  } else {
    console.log(`\n  ✅ EVERY active Golden Master carries the tagline.`);
  }
  console.log();
  process.exit(missing.length > 0 ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
