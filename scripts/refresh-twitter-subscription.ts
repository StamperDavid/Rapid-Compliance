/**
 * Refresh the X Account Activity subscription for the brand account
 * after rotating the OAuth 1.0a access token. DELETE then POST so X
 * picks up the new authorization and clears any silent flag on the
 * prior subscription.
 *
 * Usage: npx tsx scripts/refresh-twitter-subscription.ts
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
    throw new Error('No serviceAccountKey.json');
  }
}

initAdmin();

interface Creds { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string }

function pe(s: string): string {
  return encodeURIComponent(s).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function buildOAuth1(method: string, url: string, c: Creds): string {
  const o: Record<string, string> = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.accessToken,
    oauth_version: '1.0',
  };
  const ps = Object.keys(o).sort().map(k => `${pe(k)}=${pe(o[k])}`).join('&');
  const base = [method.toUpperCase(), pe(url), pe(ps)].join('&');
  o.oauth_signature = crypto.createHmac('sha1', `${pe(c.consumerSecret)}&${pe(c.accessTokenSecret)}`).update(base).digest('base64');
  return `OAuth ${Object.keys(o).sort().map(k => `${pe(k)}="${pe(o[k])}"`).join(', ')}`;
}

const WEBHOOK_ID = '2048240842830401536';

async function main(): Promise<void> {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const snap = await db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const tw = ((snap.data()?.social as Record<string, unknown> | undefined)?.twitter ?? {}) as Record<string, unknown>;
  const c: Creds = {
    consumerKey: String(tw.consumerKey ?? ''),
    consumerSecret: String(tw.consumerSecret ?? ''),
    accessToken: String(tw.accessToken ?? ''),
    accessTokenSecret: String(tw.accessTokenSecret ?? ''),
  };

  const subUrl = `https://api.x.com/2/account_activity/webhooks/${WEBHOOK_ID}/subscriptions/all`;

  // 1. DELETE existing subscription (no-op if none)
  console.log(`DELETE ${subUrl}`);
  const delResp = await fetch(subUrl, { method: 'DELETE', headers: { Authorization: buildOAuth1('DELETE', subUrl, c) } });
  console.log(`  HTTP ${delResp.status} — ${(await delResp.text()).slice(0, 200)}`);

  // 2. POST to re-create
  console.log(`POST ${subUrl}`);
  const postResp = await fetch(subUrl, { method: 'POST', headers: { Authorization: buildOAuth1('POST', subUrl, c), 'Content-Type': 'application/json' } });
  const postText = await postResp.text();
  console.log(`  HTTP ${postResp.status} — ${postText.slice(0, 200)}`);

  if (!postResp.ok) {
    console.error('Subscription re-create failed.');
    process.exit(1);
  }

  // 3. Verify subscription via list
  const listUrl = `https://api.x.com/2/account_activity/webhooks/${WEBHOOK_ID}/subscriptions/all/list`;
  const listResp = await fetch(listUrl, { headers: { Authorization: buildOAuth1('GET', listUrl, c) } });
  // The list endpoint sometimes wants a Bearer token; if 401, fall back.
  let listText = await listResp.text();
  if (listResp.status === 401) {
    const credB64 = Buffer.from(`${pe(c.consumerKey)}:${pe(c.consumerSecret)}`).toString('base64');
    const tokResp = await fetch('https://api.twitter.com/oauth2/token', { method: 'POST', headers: { Authorization: `Basic ${credB64}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' }, body: 'grant_type=client_credentials' });
    const tj = await tokResp.json() as { access_token?: string };
    if (tj.access_token) {
      const r2 = await fetch(listUrl, { headers: { Authorization: `Bearer ${tj.access_token}` } });
      listText = await r2.text();
    }
  }
  console.log(`\nSubscription state:`);
  console.log(listText);

  console.log('\n✓ Subscription refreshed. Send a fresh DM and watch inboundSocialEvents.');
}

main().catch((err) => { console.error(err); process.exit(1); });
