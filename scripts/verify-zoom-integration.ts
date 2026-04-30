/**
 * Verify Zoom integration is wired in dev Firestore.
 *
 * Checks:
 *   1. ZOOM_CLIENT_ID + ZOOM_CLIENT_SECRET env vars are set (needed for OAuth flow)
 *   2. organizations/{PLATFORM_ID}/integrations/zoom doc has accessToken + refreshToken
 *   3. Token expiry — flag if expired (refresh flow handles this at runtime, but stale
 *      tokens beyond the refresh window will block meeting creation)
 *   4. End-to-end: GET https://api.zoom.us/v2/users/me with the stored access token —
 *      proves the token actually works against Zoom's API, not just that bytes exist
 *      in Firestore. Reports the connected email + name on success, the actual Zoom
 *      error body on failure.
 *
 * Reads Firestore + makes ONE Zoom API call. Run with:
 *   npx tsx scripts/verify-zoom-integration.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

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

function decryptIfNeeded(value: string): string {
  // Mirrors src/lib/security/token-encryption.ts decryptToken contract.
  // Format on disk when encrypted: ivHex:authTagHex:cipherHex
  const parts = value.split(':');
  if (parts.length !== 3) { return value; } // legacy plaintext

  const secret = process.env.TOKEN_ENCRYPTION_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (!secret) {
    throw new Error('TOKEN_ENCRYPTION_SECRET or NEXTAUTH_SECRET must be set to decrypt');
  }

  const [ivHex, authTagHex, encrypted] = parts;
  if (!ivHex || !authTagHex || !encrypted) {
    throw new Error('Invalid encrypted token format');
  }

  const key = crypto.scryptSync(secret, 'oauth-token-salt', 32);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);
  let out = decipher.update(encrypted, 'hex', 'utf8');
  out += decipher.final('utf8');
  return out;
}

interface ZoomMeResponse {
  email?: string;
  display_name?: string;
  first_name?: string;
  last_name?: string;
  account_id?: string;
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

  let accessTokenStr: string | null = null;

  if (!doc.exists) {
    console.log('   FAIL — integrations/zoom doc does not exist');
    console.log('   Connect Zoom at /settings/integrations to populate it');
    pass = false;
  } else {
    const data = doc.data() as Record<string, unknown>;
    const accessToken = data.accessToken;
    const refreshToken = data.refreshToken;
    const expiresAtRaw = data.expiresAt;
    const encrypted = data.encrypted === true;
    console.log(`   accessToken:  ${preview(accessToken)}`);
    console.log(`   refreshToken: ${preview(refreshToken)}`);
    console.log(`   encrypted:    ${encrypted}`);

    let expiresAtIso: string | null = null;
    if (typeof expiresAtRaw === 'string') {
      expiresAtIso = expiresAtRaw;
    } else if (expiresAtRaw && typeof expiresAtRaw === 'object' && 'toDate' in expiresAtRaw) {
      const ts = expiresAtRaw as admin.firestore.Timestamp;
      expiresAtIso = ts.toDate().toISOString();
    }
    console.log(`   expiresAt:    ${expiresAtIso ?? '<not set>'}`);

    if (typeof accessToken !== 'string' || accessToken.length === 0
        || typeof refreshToken !== 'string' || refreshToken.length === 0) {
      console.log('   FAIL — tokens missing');
      pass = false;
    } else {
      if (expiresAtIso) {
        const expiry = new Date(expiresAtIso).getTime();
        if (!Number.isFinite(expiry)) {
          console.log('   WARN — expiresAt is not a valid date');
        } else if (expiry < Date.now()) {
          console.log('   WARN — access token is past expiry; refresh path will fire on next createMeeting call');
        } else {
          console.log(`   OK — access token valid for ~${Math.round((expiry - Date.now()) / 1000 / 60)} more minutes`);
        }
      }

      try {
        accessTokenStr = encrypted ? decryptIfNeeded(accessToken) : accessToken;
      } catch (decErr) {
        console.log(`   FAIL — could not decrypt accessToken: ${decErr instanceof Error ? decErr.message : String(decErr)}`);
        pass = false;
      }
    }
  }

  console.log('\n3. Live Zoom API call (GET https://api.zoom.us/v2/users/me):');
  if (!accessTokenStr) {
    console.log('   SKIP — no usable access token from Section 2');
    pass = false;
  } else {
    try {
      const res = await fetch('https://api.zoom.us/v2/users/me', {
        headers: { Authorization: `Bearer ${accessTokenStr}` },
      });

      if (res.ok) {
        const me = (await res.json()) as ZoomMeResponse;
        const composedName = [me.first_name, me.last_name].filter((p) => p && p.length > 0).join(' ').trim();
        const displayName = (me.display_name && me.display_name.length > 0)
          ? me.display_name
          : (composedName.length > 0 ? composedName : '<no name>');
        console.log('   OK — Zoom recognized the access token');
        console.log(`   connectedEmail: ${me.email ?? '<no email>'}`);
        console.log(`   connectedName:  ${displayName}`);
        console.log(`   accountId:      ${me.account_id ?? '<no account id>'}`);
      } else {
        const bodyText = await res.text().catch(() => '');
        console.log(`   FAIL — Zoom API returned ${res.status} ${res.statusText}`);
        if (res.status === 401) {
          console.log('   401 = bad/expired access token. Try disconnecting and reconnecting Zoom,');
          console.log('   or wait for the next createMeeting call to trigger the refresh path.');
        }
        if (bodyText) {
          console.log(`   Zoom response body: ${bodyText.slice(0, 500)}`);
        }
        pass = false;
      }
    } catch (apiErr) {
      const apiMsg = apiErr instanceof Error ? apiErr.message : String(apiErr);
      console.log(`   FAIL — Zoom API call threw: ${apiMsg}`);
      pass = false;
    }
  }

  console.log(`\n=== ${pass ? 'PASS' : 'FAIL'} ===`);
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
