/**
 * Read-only check: where does the REAL brand logo live, and will it composite?
 *
 * Checks BOTH brand-identity sources the generation path now uses:
 *   1. organizations/{PLATFORM_ID}/settings/brand-kit         (logo set here?)
 *   2. organizations/{PLATFORM_ID}/platform/website-editor-config (branding.logoUrl — the bridge)
 *
 * Mirrors getBrandKit()'s new fallback: if the brand kit has no logo, the website
 * editor logo is borrowed (only if it's an absolute https URL). Prints the final
 * verdict so we know a generated image will carry the REAL logo, not a fake one.
 *
 * Usage: npx tsx scripts/check-brand-logo-sources.ts
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
    admin.initializeApp({ credential: admin.credential.cert({ projectId, clientEmail, privateKey }) });
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

function isAbs(url: string | undefined | null): boolean {
  return typeof url === 'string' && /^https?:\/\//i.test(url);
}

async function main(): Promise<void> {
  initAdmin();
  const db = admin.firestore();
  const PLATFORM_ID = 'rapid-compliance-root';

  // 1. Brand kit
  const bkPath = `organizations/${PLATFORM_ID}/settings/brand-kit`;
  const bk = await db.doc(bkPath).get();
  const bkLogo = (bk.exists ? bk.data()?.logo : null) as { url?: string } | null | undefined;
  console.log(`\n1. Brand kit (${bkPath})`);
  console.log(`   exists: ${bk.exists}`);
  console.log(`   logo.url: ${bkLogo?.url ?? '(none)'}  absolute? ${isAbs(bkLogo?.url) ? 'YES' : 'no'}`);

  // 2. Website editor branding (the bridge source)
  const webPath = `organizations/${PLATFORM_ID}/platform/website-editor-config`;
  const web = await db.doc(webPath).get();
  const branding = (web.exists ? web.data()?.branding : null) as
    | { logoUrl?: string; colors?: { primary?: string; secondary?: string; accent?: string } }
    | null
    | undefined;
  console.log(`\n2. Website editor (${webPath})`);
  console.log(`   exists: ${web.exists}`);
  console.log(`   branding.logoUrl: ${branding?.logoUrl ?? '(none)'}  absolute? ${isAbs(branding?.logoUrl) ? 'YES' : 'no'}`);
  console.log(`   branding.colors: ${branding?.colors ? JSON.stringify(branding.colors) : '(none)'}`);

  // 3. Static logo shipped with the app (final fallback the compositor reads from disk).
  const staticLogoPath = path.resolve(process.cwd(), 'public', 'logo.png');
  const staticLogoExists = fs.existsSync(staticLogoPath);
  console.log(`\n3. Static app logo (public/logo.png)`);
  console.log(`   exists on disk: ${staticLogoExists ? 'YES' : 'no'}`);

  // Verdict — mirrors getBrandKit() resolution order: brand-kit → website → static.
  const resolved = isAbs(bkLogo?.url)
    ? { source: 'brand-kit', url: bkLogo?.url }
    : isAbs(branding?.logoUrl)
      ? { source: 'website-editor', url: branding?.logoUrl }
      : staticLogoExists
        ? { source: 'static public/logo.png', url: '/logo.png (read from disk)' }
        : null;

  console.log('\n   ──────────────────────────────────────────');
  if (resolved) {
    console.log(`   ✅ REAL LOGO WILL COMPOSITE — source: ${resolved.source}`);
    console.log(`      ${resolved.url}`);
  } else {
    console.log('   ❌ NO real logo found in either source — generated images would carry no logo.');
    console.log('      (With the no-fake-branding rule, they also will NOT carry a fake one.)');
    console.log('      Fix: ensure your real logo is uploaded in the website editor or /settings/brand-kit.');
  }
  console.log();
  process.exit(0);
}

main().catch((err) => { console.error(err); process.exit(1); });
