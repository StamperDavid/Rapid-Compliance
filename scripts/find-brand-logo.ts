/**
 * Read-only: find where the tenant's brand logo ACTUALLY lives in Firestore.
 * Enumerates the likely branding docs/subcollections and prints any logo-ish field.
 *
 * Usage: npx tsx scripts/find-brand-logo.ts
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

/** Recursively collect any key containing "logo" (case-insensitive) → value. */
function findLogoFields(obj: unknown, prefix: string, out: string[]): void {
  if (!obj || typeof obj !== 'object') { return; }
  for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
    const keyPath = prefix ? `${prefix}.${k}` : k;
    if (/logo/i.test(k) && (typeof v === 'string' || v === null)) {
      out.push(`${keyPath} = ${v ?? '(null)'}`);
    } else if (v && typeof v === 'object') {
      findLogoFields(v, keyPath, out);
    }
  }
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();
  const ORG = 'rapid-compliance-root';

  const subcollections = ['platform', 'settings', 'themes', 'config'];
  for (const sub of subcollections) {
    const snap = await db.collection(`organizations/${ORG}/${sub}`).get();
    console.log(`\n=== organizations/${ORG}/${sub}  (${snap.size} docs) ===`);
    for (const doc of snap.docs) {
      const found: string[] = [];
      findLogoFields(doc.data(), '', found);
      console.log(`  • ${doc.id}${found.length ? '' : '  (no logo field)'}`);
      for (const f of found) { console.log(`      ${f}`); }
    }
  }

  // Org root doc
  const root = await db.doc(`organizations/${ORG}`).get();
  const rootFound: string[] = [];
  if (root.exists) { findLogoFields(root.data(), '', rootFound); }
  console.log(`\n=== organizations/${ORG} (root doc) ===`);
  console.log(rootFound.length ? rootFound.map((f) => `      ${f}`).join('\n') : '  (no logo field)');
  console.log();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
