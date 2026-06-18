/**
 * READ-ONLY — dump the Character Library (avatar_profiles) so we can identify the
 * Hedra-imported characters before deleting anything. Prints per character:
 * id, name, userId, source, tier, createdAt, #greenScreenClips, #looks, and any
 * legacy/hedra-ish fields. Groups by userId and by createdAt-date so a bulk import
 * stands out. NOTHING is modified.
 *
 * Usage: npx tsx scripts/dump-character-library.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

function initAdmin(): void {
  if (admin.apps.length > 0) {
    return;
  }
  const envPath = path.resolve(process.cwd(), '.env.local');
  if (fs.existsSync(envPath)) {
    for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
      const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
      if (m) {
        const [, k, raw] = m;
        const v = raw.replace(/^["']|["']$/g, '').replace(/\\n/g, '\n');
        if (!process.env[k]) {
          process.env[k] = v;
        }
      }
    }
  }
  const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
  } else {
    throw new Error('Missing FIREBASE_ADMIN_* env vars in .env.local');
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const COLLECTION = `organizations/${PLATFORM_ID}/avatar_profiles`;

async function main(): Promise<void> {
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).get();
  console.log(`\nCharacter Library: ${snap.size} total documents in ${COLLECTION}\n`);

  const byUser = new Map<string, number>();
  const bySource = new Map<string, number>();
  const byDate = new Map<string, number>();
  const rows: Array<Record<string, unknown>> = [];

  for (const doc of snap.docs) {
    const d = doc.data();
    const userId = String(d.userId ?? '(none)');
    const source = String(d.source ?? '(missing)');
    const createdAt = String(d.createdAt ?? '');
    const date = createdAt.slice(0, 10) || '(no date)';
    byUser.set(userId, (byUser.get(userId) ?? 0) + 1);
    bySource.set(source, (bySource.get(source) ?? 0) + 1);
    byDate.set(date, (byDate.get(date) ?? 0) + 1);
    rows.push({
      id: doc.id,
      name: d.name ?? '(no name)',
      userId,
      source,
      tier: d.tier ?? '',
      date,
      clips: Array.isArray(d.greenScreenClips) ? d.greenScreenClips.length : 0,
      looks: Array.isArray(d.looks) ? d.looks.length : 0,
      // surface any legacy/provider-ish fields that might mark a Hedra import
      hedraId: d.hedraId ?? d.hedraCharacterId ?? d.externalId ?? d.providerId ?? undefined,
      provider: d.provider ?? d.engine ?? undefined,
    });
  }

  console.log('── Counts by userId ──');
  for (const [k, v] of [...byUser.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }
  console.log('\n── Counts by source ──');
  for (const [k, v] of [...bySource.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }
  console.log('\n── Counts by createdAt date (a bulk import = one big day) ──');
  for (const [k, v] of [...byDate.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${v.toString().padStart(4)}  ${k}`);
  }

  console.log('\n── All characters (name · source · tier · date · clips · looks · hedra/provider markers) ──');
  for (const r of rows.sort((a, b) => String(a.date).localeCompare(String(b.date)))) {
    const markers = [r.hedraId ? `hedraId=${String(r.hedraId)}` : '', r.provider ? `provider=${String(r.provider)}` : '']
      .filter(Boolean)
      .join(' ');
    console.log(
      `  ${String(r.name).slice(0, 36).padEnd(36)} | ${String(r.source).padEnd(10)} | ${String(r.tier).padEnd(9)} | ${r.date} | clips:${r.clips} looks:${r.looks} ${markers}`,
    );
  }
  console.log('');
  process.exit(0);
}

main().catch((err) => {
  console.error('DUMP ERROR:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
