/**
 * Remove today's chat-uploaded REFERENCE materials so a content test can re-run clean.
 *
 * Targets ONLY media-library records tagged `reference-material` created in the
 * last 24h (the chat upload route at src/app/api/settings/brand-identity/asset/route.ts
 * tags every upload `reference-material`, source `user-upload`). Deletes only the
 * Firestore record — Storage files are NEVER deleted, the rest of the library is
 * NEVER touched (owner stopped prior over-deletion twice).
 *
 *   List only (default):  npx tsx scripts/cleanup-today-reference-uploads.ts
 *   Actually delete:      npx tsx scripts/cleanup-today-reference-uploads.ts --delete
 *   Wider window (hours): WINDOW_HOURS=48 npx tsx scripts/cleanup-today-reference-uploads.ts
 */

/* eslint-disable no-console */

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
  if (!fs.existsSync(sakPath)) {
    throw new Error('No serviceAccountKey.json — required for Firestore Admin access');
  }
  const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
// Which media tag to target. Default = the operator's chat-uploaded references;
// override with TARGET_TAG=ai-generated to clear today's generated storyboard images.
const TAG = process.env.TARGET_TAG ?? 'reference-material';
const WINDOW_HOURS = process.env.WINDOW_HOURS ? Number(process.env.WINDOW_HOURS) : 24;
const DO_DELETE = process.argv.includes('--delete');

const db = admin.firestore();
const mediaCollection = db.collection(`organizations/${PLATFORM_ID}/media`);

function toMillis(v: unknown): number {
  if (v && typeof v === 'object' && 'toDate' in v && typeof (v as { toDate: unknown }).toDate === 'function') {
    return (v as { toDate(): Date }).toDate().getTime();
  }
  if (typeof v === 'string') { const t = Date.parse(v); return Number.isNaN(t) ? 0 : t; }
  if (v instanceof Date) { return v.getTime(); }
  return 0;
}

async function main(): Promise<void> {
  const cutoff = Date.now() - WINDOW_HOURS * 60 * 60 * 1000;

  const snap = await mediaCollection.where('tags', 'array-contains', TAG).get();
  const recent = snap.docs
    .map((d) => ({ id: d.id, data: d.data() }))
    .filter((r) => toMillis(r.data.createdAt) >= cutoff)
    .sort((a, b) => toMillis(b.data.createdAt) - toMillis(a.data.createdAt));

  console.log(`\nReference-material uploads in the last ${WINDOW_HOURS}h: ${recent.length}\n`);
  for (const r of recent) {
    const created = new Date(toMillis(r.data.createdAt)).toISOString();
    console.log(`  • ${r.id}`);
    console.log(`      name:    ${String(r.data.name ?? '(none)')}`);
    console.log(`      type:    ${String(r.data.type ?? '?')} / ${String(r.data.category ?? '?')}`);
    console.log(`      source:  ${String(r.data.source ?? '?')}`);
    console.log(`      created: ${created}`);
  }

  if (recent.length === 0) {
    console.log('Nothing to remove.\n');
    return;
  }

  if (!DO_DELETE) {
    console.log(`\n(DRY RUN — nothing deleted. Re-run with --delete to remove these ${recent.length} records.)\n`);
    return;
  }

  let deleted = 0;
  for (const r of recent) {
    await mediaCollection.doc(r.id).delete();
    deleted += 1;
  }
  console.log(`\n✅ Deleted ${deleted} reference-material record(s) from the media library.`);
  console.log(`   Storage files were NOT touched. Nothing else in the library was changed.\n`);
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('Fatal:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
