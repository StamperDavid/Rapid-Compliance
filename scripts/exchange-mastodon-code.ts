/**
 * Step C of the Mastodon OAuth connect flow — exchange the
 * authorization code for a long-lived access token, validate it, and
 * save final credentials to apiKeys/social.mastodon.
 *
 * Reads the pending client_id/client_secret/instanceUrl from
 * apiKeys/social.mastodon_pending (set by
 * scripts/register-mastodon-app.ts).
 *
 * Usage:
 *   $env:MASTODON_AUTH_CODE="<paste code from /oauth/authorize>"
 *   npx tsx scripts/exchange-mastodon-code.ts
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
    throw new Error('No serviceAccountKey.json');
  }
  const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

initAdmin();

const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPES = 'read write';

// Mastodon fronts its API with Cloudflare bot management. Send
// realistic browser headers on every API call.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

interface PendingMastodon {
  instanceUrl?: string;
  clientId?: string;
  clientSecret?: string;
}

interface TokenResponse {
  access_token?: string;
  token_type?: string;
  scope?: string;
  created_at?: number;
  error?: string;
  error_description?: string;
}

interface VerifyCredentialsResponse {
  id?: string;
  username?: string;
  acct?: string;
  display_name?: string;
  followers_count?: number;
  url?: string;
}

async function main(): Promise<void> {
  const authCode = process.env.MASTODON_AUTH_CODE?.trim();
  if (!authCode) {
    console.error('MASTODON_AUTH_CODE env var required');
    process.exit(1);
  }

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  if (!snap.exists) {
    console.error('apiKeys doc missing — run register-mastodon-app.ts first');
    process.exit(2);
  }
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social ?? {}) as Record<string, unknown>;
  const pending = (social.mastodon_pending ?? {}) as PendingMastodon;
  if (!pending.clientId || !pending.clientSecret || !pending.instanceUrl) {
    console.error('apiKeys/social.mastodon_pending missing client_id/client_secret/instanceUrl');
    console.error('Run scripts/register-mastodon-app.ts first');
    process.exit(3);
  }
  const { instanceUrl, clientId, clientSecret } = pending;

  console.log(`Exchanging auth code at ${instanceUrl}/oauth/token ...`);
  const tokenResp = await fetch(`${instanceUrl}/oauth/token`, {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code: authCode,
      scope: SCOPES,
    }),
  });
  const tokenText = await tokenResp.text();
  if (!tokenResp.ok) {
    console.error(`✗ Token exchange failed: HTTP ${tokenResp.status}`);
    console.error(tokenText.slice(0, 1000));
    process.exit(4);
  }
  let tokenData: TokenResponse;
  try { tokenData = JSON.parse(tokenText) as TokenResponse; } catch {
    console.error('Token response was not JSON:');
    console.error(tokenText.slice(0, 1000));
    process.exit(5);
  }
  if (!tokenData.access_token) {
    console.error(`✗ Token response missing access_token: ${tokenData.error_description ?? tokenData.error ?? 'unknown'}`);
    process.exit(6);
  }
  const accessToken = tokenData.access_token;
  console.log(`✓ Got access token (scope=${tokenData.scope ?? 'n/a'})`);

  console.log(`Validating against ${instanceUrl}/api/v1/accounts/verify_credentials ...`);
  const verifyResp = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
    headers: { ...BROWSER_HEADERS, Authorization: `Bearer ${accessToken}` },
  });
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`✗ Token validation failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 500));
    process.exit(7);
  }
  const profile = await verifyResp.json() as VerifyCredentialsResponse;
  if (!profile.id) {
    console.error('verify_credentials response missing id field');
    process.exit(8);
  }
  console.log(`✓ Authenticated as @${profile.acct ?? profile.username} (id=${profile.id})`);
  console.log(`  display_name:    ${profile.display_name ?? '(none)'}`);
  console.log(`  followers_count: ${profile.followers_count ?? 0}`);
  console.log(`  profile url:     ${profile.url ?? '(none)'}`);

  // Save final config + clear pending slot
  const existingSocial = (data.social && typeof data.social === 'object'
    ? (data.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const cleanedSocial = { ...existingSocial };
  delete cleanedSocial.mastodon_pending;

  await docRef.set(
    {
      social: {
        ...cleanedSocial,
        mastodon: {
          accessToken,
          instanceUrl,
          accountId: profile.id,
          acct: profile.acct ?? profile.username ?? null,
          clientId,
          clientSecret,
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'exchange-mastodon-code',
    },
    { merge: true },
  );

  console.log('\n=== ✓ Mastodon connected ===');
  console.log(`Brand handle: @${profile.acct ?? profile.username}`);
  console.log(`Account id:   ${profile.id}`);
  console.log(`Instance:     ${instanceUrl}`);
  console.log('Saved to apiKeys/social.mastodon — pending slot cleared.');
}

main().catch((err) => { console.error(err); process.exit(1); });
