/**
 * Read-only check: does the brand kit have a real logo uploaded?
 *
 * Reads organizations/{PLATFORM_ID}/settings/brand-kit and prints the
 * enabled flag, logo url/position/opacity/scale, and the brand colors.
 * Logo compositing on generated images no-ops unless logo.url is an
 * absolute https URL AND enabled === true.
 *
 * Usage: npx tsx scripts/check-brand-kit-logo.ts
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

  if (projectId && clientEmail && privateKey) {
    admin.initializeApp({
      credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
  } else {
    const sakPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
    if (fs.existsSync(sakPath)) {
      const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
      admin.initializeApp({ credential: admin.credential.cert(sa) });
    } else {
      throw new Error('Missing FIREBASE_ADMIN_* env vars and no serviceAccountKey.json');
    }
  }
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();
  const PLATFORM_ID = 'rapid-compliance-root';

  const docPath = `organizations/${PLATFORM_ID}/settings/brand-kit`;
  const doc = await db.doc(docPath).get();

  console.log(`\nBrand kit doc: ${docPath}`);
  if (!doc.exists) {
    console.log('  ❌ Document does NOT exist — no brand kit saved yet.');
    console.log('  → Logo compositing will NO-OP. Owner must upload a logo at /settings/brand-kit.');
    process.exit(0);
  }

  const data = doc.data() ?? {};
  console.log(`  enabled: ${data.enabled}`);
  console.log(`  updatedAt: ${data.updatedAt ?? '(none)'}  updatedBy: ${data.updatedBy ?? '(none)'}`);

  const logo = data.logo as { url?: string; position?: string; opacity?: number; scale?: number } | null | undefined;
  console.log('\n  LOGO:');
  if (!logo) {
    console.log('    ❌ logo is null — NO logo uploaded.');
  } else {
    const url = logo.url ?? '';
    const isAbs = /^https?:\/\//i.test(url);
    console.log(`    url: ${url || '(empty)'}`);
    console.log(`    absolute https? ${isAbs ? '✅ YES' : '❌ NO'}`);
    console.log(`    position: ${logo.position}  opacity: ${logo.opacity}  scale: ${logo.scale}`);
  }

  const colors = data.colors as { primary?: string; secondary?: string; accent?: string } | undefined;
  console.log('\n  COLORS:');
  console.log(`    primary: ${colors?.primary}  secondary: ${colors?.secondary}  accent: ${colors?.accent}`);

  // Verdict
  const willComposite =
    data.enabled === true &&
    !!logo?.url &&
    /^https?:\/\//i.test(logo.url ?? '');
  console.log('\n  ──────────────────────────────────────────');
  console.log(`  WILL LOGO COMPOSITE ONTO GENERATED IMAGES? ${willComposite ? '✅ YES' : '❌ NO'}`);
  if (!willComposite) {
    console.log('  Reason:');
    if (data.enabled !== true) console.log('    - brand kit is NOT enabled (enabled !== true)');
    if (!logo?.url) console.log('    - no logo url set');
    else if (!/^https?:\/\//i.test(logo.url)) console.log('    - logo url is not an absolute https URL');
  }
  console.log();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
