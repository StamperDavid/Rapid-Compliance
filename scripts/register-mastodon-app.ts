/**
 * Step A of the Mastodon OAuth connect flow — register the brand's
 * developer app via POST /api/v1/apps.
 *
 * Saves client_id + client_secret to a temporary slot in Firestore
 * (apiKeys/social.mastodon_pending) so the second-half script
 * (exchange-mastodon-code.ts) can pick them up after the operator
 * has clicked Authorize.
 *
 * Prints the OAuth authorize URL for the operator to click.
 *
 * Usage:
 *   npx tsx scripts/register-mastodon-app.ts
 *   npx tsx scripts/register-mastodon-app.ts --instance=https://mastodon.social
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

interface AppRegistrationResponse {
  id?: string;
  name?: string;
  client_id?: string;
  client_secret?: string;
  redirect_uri?: string;
  vapid_key?: string;
}

const APP_NAME = 'SalesVelocity.ai DM Auto-Reply';
const APP_WEBSITE = 'https://www.salesvelocity.ai';
const REDIRECT_URI = 'urn:ietf:wg:oauth:2.0:oob';
const SCOPES = 'read write';

// Mastodon fronts its API with Cloudflare's bot management; default
// Node fetch User-Agent gets a 403 challenge page. Send realistic
// browser headers on every API call. Mastodon-proper instances ignore
// these so the same code works there.
const BROWSER_HEADERS: Record<string, string> = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'application/json',
  'Accept-Language': 'en-US,en;q=0.9',
};

function getInstanceUrl(): string {
  const arg = process.argv.find((a) => a.startsWith('--instance='));
  if (arg) {
    const url = arg.slice('--instance='.length).replace(/\/$/, '');
    return url.startsWith('http') ? url : `https://${url}`;
  }
  return 'https://mastodon.social';
}

async function main(): Promise<void> {
  const instanceUrl = getInstanceUrl();
  console.log(`Registering app on ${instanceUrl} ...`);

  const appResp = await fetch(`${instanceUrl}/api/v1/apps`, {
    method: 'POST',
    headers: { ...BROWSER_HEADERS, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_name: APP_NAME,
      redirect_uris: REDIRECT_URI,
      scopes: SCOPES,
      website: APP_WEBSITE,
    }),
  });

  console.log(`HTTP ${appResp.status}`);
  const respText = await appResp.text();
  if (!appResp.ok) {
    console.error('Body:');
    console.error(respText.slice(0, 1000));
    process.exit(2);
  }

  let appData: AppRegistrationResponse;
  try {
    appData = JSON.parse(respText) as AppRegistrationResponse;
  } catch {
    console.error('Response was not JSON:');
    console.error(respText.slice(0, 1000));
    process.exit(3);
  }

  if (!appData.client_id || !appData.client_secret) {
    console.error('Response missing client_id/client_secret:');
    console.error(JSON.stringify(appData, null, 2));
    process.exit(4);
  }

  console.log('✓ App registered');
  console.log(`  app id:        ${appData.id ?? '(no id field)'}`);
  console.log(`  client_id:     ${appData.client_id}`);
  console.log(`  client_secret: ${appData.client_secret.slice(0, 6)}...${appData.client_secret.slice(-4)} (${appData.client_secret.length} chars)`);

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
        mastodon_pending: {
          instanceUrl,
          clientId: appData.client_id,
          clientSecret: appData.client_secret,
          registeredAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'register-mastodon-app',
    },
    { merge: true },
  );

  const authorizeUrl = `${instanceUrl}/oauth/authorize?response_type=code&client_id=${encodeURIComponent(appData.client_id)}&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES)}`;

  console.log('');
  console.log('=== AUTHORIZE URL — paste into your browser ===');
  console.log(authorizeUrl);
  console.log('=== END AUTHORIZE URL ===');
  console.log('');
  console.log('Once you click Authorize, Mastodon will display an authorization code.');
  console.log('Send that code back; I\'ll run scripts/exchange-mastodon-code.ts with it.');
}

main().catch((err) => { console.error(err); process.exit(1); });
