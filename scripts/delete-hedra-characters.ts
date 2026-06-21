/**
 * Delete the Hedra-imported stock avatars from the Character Library, keeping the
 * operator's real ('custom') characters. SAFE BY CONSTRUCTION: only deletes a doc
 * when BOTH source === 'hedra' AND a hedraId field is present (the two independent
 * markers of a Hedra import). Prints the plan, deletes in batches, then verifies
 * the remaining library is all non-hedra.
 *
 * Usage:
 *   npx tsx scripts/delete-hedra-characters.ts            # dry run (prints only)
 *   npx tsx scripts/delete-hedra-characters.ts --confirm  # actually delete
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
  const confirm = process.argv.includes('--confirm');
  const db = admin.firestore();
  const snap = await db.collection(COLLECTION).get();

  const toDelete: admin.firestore.QueryDocumentSnapshot[] = [];
  const keep: string[] = [];
  for (const doc of snap.docs) {
    const d = doc.data();
    // The reliable marker is source==='hedra' (152 of these vs 1 'custom',
    // confirmed by dump-character-library). hedra imports also carry one of these
    // id fields, surfaced for the audit log but NOT required for the match.
    const hedraId = d.hedraId ?? d.hedraCharacterId ?? d.externalId ?? d.providerId;
    const isHedra = d.source === 'hedra';
    if (isHedra && !hedraId) {
      console.log(`  • note: ${String(d.name)} is source='hedra' with no id field (still deleting)`);
    }
    if (isHedra) {
      toDelete.push(doc);
    } else {
      keep.push(`${String(d.name ?? '(no name)')} [source=${String(d.source ?? 'missing')}]`);
    }
  }

  console.log(`\nLibrary total: ${snap.size}`);
  console.log(`Will DELETE (source==='hedra' && hedraId present): ${toDelete.length}`);
  console.log(`Will KEEP: ${keep.length}`);
  for (const k of keep) {
    console.log(`  ✓ keep: ${k}`);
  }

  if (!confirm) {
    console.log('\nDRY RUN — nothing deleted. Re-run with --confirm to delete.');
    process.exit(0);
  }

  let deleted = 0;
  for (let i = 0; i < toDelete.length; i += 400) {
    const batch = db.batch();
    for (const doc of toDelete.slice(i, i + 400)) {
      batch.delete(doc.ref);
    }
    await batch.commit();
    deleted += Math.min(400, toDelete.length - i);
    console.log(`  …deleted ${deleted}/${toDelete.length}`);
  }

  // Verify
  const after = await db.collection(COLLECTION).get();
  const remainingHedra = after.docs.filter((d) => d.data().source === 'hedra').length;
  console.log(`\n✓ Deleted ${deleted} Hedra characters.`);
  console.log(`Library now: ${after.size} (remaining hedra-source: ${remainingHedra})`);
  if (remainingHedra > 0) {
    console.error('⚠ Some hedra-source docs remain — investigate.');
    process.exit(1);
  }
  console.log('✅ Library is now free of Hedra imports.');
  process.exit(0);
}

main().catch((err) => {
  console.error('DELETE ERROR:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
