/**
 * One-shot: park Truth Social. Marks the Truth Social Expert GM as
 * inactive in Firestore and renames the pending OAuth slot so it
 * can't accidentally be consumed. The code is intact for a future
 * un-parking; only the live state is changed.
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
  if (!fs.existsSync(sakPath)) { throw new Error('No serviceAccountKey.json'); }
  const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

initAdmin();

async function main(): Promise<void> {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();

  // 1. Mark Truth Social Expert GM inactive
  const gmCollection = `organizations/${PLATFORM_ID}/specialistGoldenMasters`;
  const gmSnap = await db.collection(gmCollection)
    .where('specialistId', '==', 'TRUTH_SOCIAL_EXPERT')
    .get();

  if (gmSnap.empty) {
    console.log('  No Truth Social Expert GM docs found in Firestore.');
  } else {
    const batch = db.batch();
    for (const doc of gmSnap.docs) {
      batch.update(doc.ref, {
        isActive: false,
        parkedAt: new Date().toISOString(),
        parkedReason: 'Truth Social blocks server-side Node fetch at Cloudflare TLS layer; no official API or partner program exists. See CONTINUATION_PROMPT.md status matrix.',
      });
    }
    await batch.commit();
    console.log(`  ✓ Marked ${gmSnap.docs.length} Truth Social Expert GM doc(s) inactive`);
  }

  // 2. Move pending OAuth creds out of the way so they can't be consumed
  const apiKeysRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await apiKeysRef.get();
  if (!snap.exists) {
    console.log('  No apiKeys doc — nothing to move');
    return;
  }
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social ?? {}) as Record<string, unknown>;

  const pending = social.truth_social_pending;
  if (pending) {
    const cleanedSocial = { ...social };
    delete cleanedSocial.truth_social_pending;
    cleanedSocial.truth_social_parked = {
      ...(pending as Record<string, unknown>),
      parkedAt: new Date().toISOString(),
      parkedReason: 'Truth Social blocks server-side Node fetch at Cloudflare TLS layer.',
    };
    await apiKeysRef.set({ social: cleanedSocial, updatedAt: new Date().toISOString(), updatedBy: 'park-truth-social' }, { merge: true });
    console.log('  ✓ Moved truth_social_pending → truth_social_parked');
  } else {
    console.log('  No truth_social_pending — nothing to move');
  }

  // 3. Same with the live truth_social slot if it exists (defensive)
  const live = social.truth_social;
  if (live) {
    const cleanedSocial = { ...social };
    delete cleanedSocial.truth_social;
    cleanedSocial.truth_social_parked_live = {
      ...(live as Record<string, unknown>),
      parkedAt: new Date().toISOString(),
    };
    await apiKeysRef.set({ social: cleanedSocial, updatedAt: new Date().toISOString(), updatedBy: 'park-truth-social' }, { merge: true });
    console.log('  ✓ Moved truth_social (live) → truth_social_parked_live');
  }

  console.log('\nDone. Truth Social is parked. Code is preserved; cron is removed; Firestore state is inert.');
}

main().catch((err) => { console.error(err); process.exit(1); });
