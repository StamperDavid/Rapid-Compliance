/**
 * Capture the official brand tagline into Brand DNA (the source the agents bake from)
 * and the canonical Brand Identity store, plus a hard rule that agents must use the
 * real tagline verbatim and NEVER invent a slogan/tagline.
 *
 * Default = DRY RUN (prints before/after, writes nothing). Pass --apply to write.
 *
 * Usage:
 *   npx tsx scripts/set-brand-tagline.ts            # preview
 *   npx tsx scripts/set-brand-tagline.ts --apply    # write
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

const TAGLINE = 'Accelerate your growth';
const TAGLINE_RULE =
  `Our official tagline is "${TAGLINE}" — use it verbatim whenever a tagline, slogan, or sign-off is needed, ` +
  `and NEVER invent a different tagline, slogan, or wordmark.`;

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

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();
  const ORG = 'rapid-compliance-root';
  const apply = process.argv.includes('--apply');

  const orgRef = db.doc(`organizations/${ORG}`);
  const snap = await orgRef.get();
  const brandDNA = (snap.data()?.brandDNA ?? {}) as {
    keyPhrases?: string[];
    communicationStyle?: string;
    [k: string]: unknown;
  };

  const currentKeyPhrases = Array.isArray(brandDNA.keyPhrases) ? brandDNA.keyPhrases : [];
  const currentCommStyle = typeof brandDNA.communicationStyle === 'string' ? brandDNA.communicationStyle : '';

  // 1. Ensure the tagline is a key phrase (idempotent, case-insensitive).
  const hasTagline = currentKeyPhrases.some((p) => p.trim().toLowerCase() === TAGLINE.toLowerCase());
  const newKeyPhrases = hasTagline ? currentKeyPhrases : [...currentKeyPhrases, TAGLINE];

  // 2. Ensure the "use real tagline, never invent" rule is in communicationStyle.
  const hasRule = currentCommStyle.toLowerCase().includes('official tagline');
  const newCommStyle = hasRule
    ? currentCommStyle
    : (currentCommStyle ? `${currentCommStyle.trim()} ${TAGLINE_RULE}` : TAGLINE_RULE);

  console.log('\n=== Brand DNA tagline correction ===');
  console.log('keyPhrases BEFORE:', JSON.stringify(currentKeyPhrases));
  console.log('keyPhrases AFTER: ', JSON.stringify(newKeyPhrases));
  console.log('\ncommunicationStyle BEFORE:', JSON.stringify(currentCommStyle));
  console.log('communicationStyle AFTER: ', JSON.stringify(newCommStyle));

  // 3. Also set the canonical Brand Identity tagline (proper long-term home).
  const biRef = db.doc(`organizations/${ORG}/settings/brand-identity`);

  if (!apply) {
    console.log('\n--- DRY RUN: nothing written. Re-run with --apply to write. ---\n');
    process.exit(0);
  }

  await orgRef.set({ brandDNA: { ...brandDNA, keyPhrases: newKeyPhrases, communicationStyle: newCommStyle } }, { merge: true });
  await biRef.set({ tagline: TAGLINE, updatedAt: new Date().toISOString(), updatedBy: 'set-brand-tagline' }, { merge: true });
  console.log('\n✅ Written. NOTE: agents only USE this once their Golden Masters are re-baked from Brand DNA.');
  console.log();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
