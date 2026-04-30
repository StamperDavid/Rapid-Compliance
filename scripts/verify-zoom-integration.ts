/**
 * Verify Zoom integration is wired in dev Firestore.
 *
 * Checks:
 *   1. ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET env vars are set (needed for OAuth flow)
 *   2. organizations/{PLATFORM_ID}/integrations/zoom doc has accessToken + refreshToken
 *   3. Token expiry — flag if expired (refresh flow handles this at runtime, but stale
 *      tokens beyond the refresh window will block meeting creation)
 *
 * Read-only against Firestore. No Zoom API calls. Run with:
 *   npx tsx scripts/verify-zoom-integration.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json — drop the dev service-account file at the repo root');
  }
}

initAdmin();

function preview(value: unknown): string {
  if (typeof value !== 'string' || value.length === 0) { return '<missing>'; }
  if (value.length < 12) { return `<short: ${value.length} chars>`; }
  return `${value.slice(0, 6)}...${value.slice(-4)}  (len=${value.length})`;
}

async function main(): Promise<void> {
  let pass = true;

  console.log('=== Zoom integration verification ===\n');

  console.log('1. Env vars:');
  const clientId = process.env.ZOOM_CLIENT_ID;
  const clientSecret = process.env.ZOOM_CLIENT_SECRET;
  console.log(`   ZOOM_CLIENT_ID:     ${preview(clientId)}`);
  console.log(`   ZOOM_CLIENT_SECRET: ${preview(clientSecret)}`);
  if (!clientId || !clientSecret) {
    console.log('   FAIL — missing env vars; OAuth flow cannot start');
    pass = false;
  } else {
    console.log('   OK');
  }

  console.log('\n2. Firestore OAuth tokens (organizations/rapid-compliance-root/integrations/zoom):');
  const db = admin.firestore();
  const PLATFORM_ID = 'rapid-compliance-root';
  const doc = await db.collection(`organizations/${PLATFORM_ID}/integrations`).doc('zoom').get();

  if (!doc.exists) {
    console.log('   FAIL — integrations/zoom doc does not exist');
    console.log('   Connect Zoom at /settings/integrations to populate it');
    pass = false;
  } else {
    const data = doc.data() as Record<string, unknown>;
    const accessToken = data.accessToken;
    const refreshToken = data.refreshToken;
    const expiresAt = data.expiresAt;
    console.log(`   accessToken:  ${preview(accessToken)}`);
    console.log(`   refreshToken: ${preview(refreshToken)}`);
    console.log(`   expiresAt:    ${typeof expiresAt === 'string' ? expiresAt : '<not set>'}`);

    if (!accessToken || !refreshToken) {
      console.log('   FAIL — tokens missing');
      pass = false;
    } else {
      // Stale-token check: Zoom refresh tokens themselves expire after ~15 months
      // of inactivity; if expiresAt is way in the past, the access token is stale
      // but refresh should still work. If expiresAt is missing entirely, that's
      // a wiring bug.
      if (typeof expiresAt === 'string') {
        const expiry = new Date(expiresAt).getTime();
        if (!Number.isFinite(expiry)) {
          console.log('   WARN — expiresAt is not a valid date');
        } else if (expiry < Date.now()) {
          console.log('   WARN — access token is past expiry; refresh path will fire on next createMeeting call');
        } else {
          console.log(`   OK — access token valid for ~${Math.round((expiry - Date.now()) / 1000 / 60)} more minutes`);
        }
      }
    }
  }

  console.log(`\n=== ${pass ? 'PASS' : 'FAIL'} ===`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
