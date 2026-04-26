/**
 * Create the X Activity API subscription for dm.received events using
 * the OAuth 2.0 user token previously saved by
 * `authorize-x-and-subscribe-dm.ts`. Idempotent — safe to re-run.
 *
 * Usage: npx tsx scripts/create-x-dm-subscription.ts
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
  if (fs.existsSync(sakPath)) {
    const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
    admin.initializeApp({ credential: admin.credential.cert(sa) });
  } else {
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const WEBHOOK_ID = '2048240842830401536';
const ENDPOINT = 'https://api.x.com/2/activity/subscriptions';

interface SavedOAuth2 { accessToken?: string; refreshToken?: string; expiresAt?: string; scope?: string }

async function loadAccessToken(): Promise<string> {
  const db = admin.firestore();
  const snap = await db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const tw = ((snap.data()?.social as Record<string, unknown> | undefined)?.twitter ?? {}) as Record<string, unknown>;
  const o = (tw.oauth2User ?? {}) as SavedOAuth2;
  if (!o.accessToken) {
    throw new Error('oauth2User.accessToken missing — run authorize-x-and-subscribe-dm.ts first');
  }
  if (o.expiresAt && new Date(o.expiresAt).getTime() < Date.now()) {
    throw new Error(`oauth2User.accessToken expired at ${o.expiresAt} — re-authorize`);
  }
  return o.accessToken;
}

async function tryCreate(token: string, body: Record<string, unknown>, label: string): Promise<{ status: number; body: string }> {
  const resp = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  console.log(`\n[${label}] POST ${ENDPOINT}`);
  console.log(`  body: ${JSON.stringify(body)}`);
  console.log(`  HTTP ${resp.status}`);
  console.log(`  ${text.slice(0, 600)}`);
  return { status: resp.status, body: text };
}

async function main(): Promise<void> {
  const accessToken = await loadAccessToken();
  console.log(`Loaded oauth2User.accessToken (length ${accessToken.length})`);

  const BRAND_USER_ID = '2048199442067755008';

  // X requires exactly one of userId or keyword in filter. We want events
  // for DMs received BY the brand account, so subscribe with the brand
  // user id as the filter key. Different field-name variants tried since
  // the doc string ("userId") doesn't match every X endpoint convention.
  let result = await tryCreate(accessToken, {
    event_type: 'dm.received',
    filter: { userId: BRAND_USER_ID },
    webhook_id: WEBHOOK_ID,
  }, 'attempt 1: filter.userId (camelCase)');
  if (result.status >= 200 && result.status < 300) { process.exit(0); }

  result = await tryCreate(accessToken, {
    event_type: 'dm.received',
    filter: { user_id: BRAND_USER_ID },
    webhook_id: WEBHOOK_ID,
  }, 'attempt 2: filter.user_id (snake_case)');
  if (result.status >= 200 && result.status < 300) { process.exit(0); }

  // Try without webhook_id (X may auto-bind to the only registered webhook).
  result = await tryCreate(accessToken, {
    event_type: 'dm.received',
    filter: { userId: BRAND_USER_ID },
  }, 'attempt 3: filter.userId, no webhook_id');
  if (result.status >= 200 && result.status < 300) { process.exit(0); }

  console.error('\nAll three attempts failed. See HTTP responses above for the actual error.');
  process.exit(1);
}

main().catch((err) => { console.error(err); process.exit(1); });
