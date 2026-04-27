/**
 * Interactive one-shot connector for Mastodon (or any Mastodon-
 * compatible instance).
 *
 * Walks the brand operator through the three steps that are normally
 * a developer-portal click-fest on every other social platform:
 *
 *   Step A — Register the brand's developer app
 *     POST /api/v1/apps  → returns client_id + client_secret
 *     No review queue, no email verification, no waiting period. The
 *     Mastodon API is open by design.
 *
 *   Step B — OAuth authorize
 *     Opens the browser to the instance's /oauth/authorize page. The
 *     operator clicks "Authorize" while logged in to the brand
 *     account; the page then displays an auth code (because we use
 *     redirect_uri='urn:ietf:wg:oauth:2.0:oob', the "out of band"
 *     code flow). Operator pastes the code back into this terminal.
 *
 *   Step C — Token exchange + save
 *     POST /oauth/token with the code → returns a long-lived
 *     access_token. Validates the token via /api/v1/accounts/verify_credentials,
 *     then saves to apiKeys/social.mastodon via the same Firestore
 *     write that scripts/save-mastodon-config.ts uses.
 *
 * After this script completes, the brand DM auto-reply pipeline is
 * live: the cron `/api/cron/jasper-mastodon-dm-dispatcher` will
 * pick up real inbound DMs every minute.
 *
 * Usage:
 *   npx tsx scripts/connect-mastodon.ts
 *   npx tsx scripts/connect-mastodon.ts --instance=https://mastodon.social
 *
 * The default instance is https://mastodon.social. Pass --instance to
 * connect a different Mastodon-family server.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
import * as readline from 'readline';

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
    throw new Error('No serviceAccountKey.json — cannot save token to Firestore');
  }
  const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

initAdmin();

function getInstanceUrl(): string {
  const arg = process.argv.find((a) => a.startsWith('--instance='));
  if (arg) {
    const url = arg.slice('--instance='.length).replace(/\/$/, '');
    return url.startsWith('http') ? url : `https://${url}`;
  }
  return 'https://mastodon.social';
}

function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}

interface AppRegistrationResponse {
  id?: string;
  name?: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
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

const APP_NAME = 'SalesVelocity.ai DM Auto-Reply';
const APP_WEBSITE = 'https://www.salesvelocity.ai';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPES = 'read write';

async function main(): Promise<void> {
  const instanceUrl = getInstanceUrl();
  console.log(`\n=== Connect Mastodon / Mastodon-family DM pipeline ===`);
  console.log(`Instance: ${instanceUrl}`);
  console.log(`Brand:    SalesVelocity.ai\n`);

  // ─── STEP A — Register the developer app ───────────────────────────────────
  console.log('Step A — Registering the brand\'s developer app via /api/v1/apps...');
  const appResp = await fetch(`${instanceUrl}/api/v1/apps`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: APP_NAME,
      redirect_uris: REDIRECT_URI,
      scopes: SCOPES,
      website: APP_WEBSITE,
    }),
  });
  if (!appResp.ok) {
    const errText = await appResp.text();
    console.error(`✗ App registration failed: HTTP ${appResp.status}`);
    console.error(errText.slice(0, 500));
    process.exit(2);
  }
  const appData = await appResp.json() as AppRegistrationResponse;
  if (!appData.client_id || !appData.client_secret) {
    console.error('✗ App registration response missing client_id/client_secret');
    console.error(JSON.stringify(appData, null, 2));
    process.exit(3);
  }
  console.log(`✓ App registered`);
  console.log(`  client_id:     ${appData.client_id.slice(0, 8)}...${appData.client_id.slice(-4)}`);
  console.log(`  client_secret: ${appData.client_secret.slice(0, 8)}...${appData.client_secret.slice(-4)}\n`);

  // ─── STEP B — Operator does OAuth authorize ────────────────────────────────
  const authorizeUrl = `${instanceUrl}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(appData.client_id)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;
  console.log('Step B — Authorize the app on the brand account.');
  console.log('');
  console.log('  1. Open this URL in your browser (or paste it into the address bar):');
  console.log('');
  console.log(`     ${authorizeUrl}`);
  console.log('');
  console.log('  2. You should already be logged in as @SalesVelocity_Ai. If not, log in first.');
  console.log('  3. Click "Authorize".');
  console.log('  4. Mastodon will display an authorization code on the next page.');
  console.log('  5. Copy that code and paste it below.');
  console.log('');

  const authCode = await prompt('Paste the authorization code: ');
  if (!authCode) {
    console.error('✗ No authorization code provided');
    process.exit(4);
  }

  // ─── STEP C — Exchange code for access token ───────────────────────────────
  console.log('\nStep C — Exchanging authorization code for access token...');
  const tokenResp = await fetch(`${instanceUrl}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: appData.client_id,
      client_secret: appData.client_secret,
      redirect_uri: REDIRECT_URI,
      grant_type: 'authorization_code',
      code: authCode,
      scope: SCOPES,
    }),
  });
  if (!tokenResp.ok) {
    const errText = await tokenResp.text();
    console.error(`✗ Token exchange failed: HTTP ${tokenResp.status}`);
    console.error(errText.slice(0, 500));
    process.exit(5);
  }
  const tokenData = await tokenResp.json() as TokenResponse;
  if (!tokenData.access_token) {
    console.error(`✗ Token response missing access_token: ${tokenData.error_description ?? tokenData.error ?? 'unknown'}`);
    console.error(JSON.stringify(tokenData, null, 2));
    process.exit(6);
  }
  const accessToken = tokenData.access_token;
  console.log(`✓ Got access token (scope=${tokenData.scope ?? 'n/a'})`);

  // Validate token by hitting verify_credentials
  console.log('\nValidating token against /api/v1/accounts/verify_credentials...');
  const verifyResp = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`✗ Token validation failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 500));
    process.exit(7);
  }
  const profile = await verifyResp.json() as VerifyCredentialsResponse;
  if (!profile.id) {
    console.error('✗ verify_credentials response missing id field');
    process.exit(8);
  }
  console.log(`✓ Authenticated as @${profile.acct ?? profile.username} (id=${profile.id})`);
  console.log(`  display_name:    ${profile.display_name ?? '(none)'}`);
  console.log(`  followers_count: ${profile.followers_count ?? 0}`);
  console.log(`  profile url:     ${profile.url ?? '(none)'}`);

  // Save to Firestore
  console.log('\nSaving credentials to apiKeys/social.mastodon...');
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  await docRef.set(
    {
      social: {
        ...existingSocial,
        mastodon: {
          accessToken,
          instanceUrl,
          accountId: profile.id,
          acct: profile.acct ?? profile.username ?? null,
          clientId: appData.client_id,
          clientSecret: appData.client_secret,
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'connect-mastodon-script',
    },
    { merge: true },
  );

  console.log('\n=== ✓ Mastodon connected ===');
  console.log(`Brand handle:   @${profile.acct ?? profile.username}`);
  console.log(`Account id:     ${profile.id}`);
  console.log(`Instance:       ${instanceUrl}`);
  console.log('');
  console.log('Next: send a DM to the brand account from a second Mastodon account.');
  console.log('Within ~60 seconds the cron `/api/cron/jasper-mastodon-dm-dispatcher`');
  console.log('should pick it up, compose a reply, and the mission will appear in Mission Control.');
}

main().catch((err) => { console.error(err); process.exit(1); });
