/**
 * Nuclear reset of the X webhook + subscription. Used when token rotation
 * has likely orphaned the Account Activity subscription's auth context
 * and X has stopped delivering events.
 *
 * Sequence:
 *   1. DELETE /2/webhooks/{old_id}            — removes the webhook (cascades subscriptions)
 *   2. POST /2/webhooks { url }                — registers a fresh webhook (X re-CRCs our endpoint)
 *   3. POST /2/account_activity/webhooks/{new_id}/subscriptions/all  — subscribes brand with CURRENT OAuth1 tokens
 *   4. Saves new webhook_id to apiKeys/social.twitter.webhookId
 *
 * Idempotent — safe to re-run. Logs every X response so we can see
 * exactly what X says at each step.
 *
 * Usage: npx tsx scripts/reset-twitter-webhook.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
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

interface Creds { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string }

function pe(s: string): string {
  return encodeURIComponent(s).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function buildOAuth1(method: string, url: string, c: Creds, q: Record<string, string> = {}): string {
  const o: Record<string, string> = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.accessToken,
    oauth_version: '1.0',
  };
  const all = { ...o, ...q };
  const ps = Object.keys(all).sort().map(k => `${pe(k)}=${pe(all[k])}`).join('&');
  const base = [method.toUpperCase(), pe(url), pe(ps)].join('&');
  o.oauth_signature = crypto.createHmac('sha1', `${pe(c.consumerSecret)}&${pe(c.accessTokenSecret)}`).update(base).digest('base64');
  return `OAuth ${Object.keys(o).sort().map(k => `${pe(k)}="${pe(o[k])}"`).join(', ')}`;
}

async function getBearer(c: Creds): Promise<string> {
  const cred = Buffer.from(`${pe(c.consumerKey)}:${pe(c.consumerSecret)}`).toString('base64');
  const r = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${cred}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'grant_type=client_credentials',
  });
  if (!r.ok) { throw new Error(`bearer failed: ${r.status} ${await r.text()}`); }
  const j = await r.json() as { access_token?: string };
  if (!j.access_token) { throw new Error('no access_token'); }
  return j.access_token;
}

const PLATFORM_ID = 'rapid-compliance-root';
const OLD_WEBHOOK_ID = '2048240842830401536';
const WEBHOOK_URL = 'https://rapidcompliance.us/api/webhooks/twitter';

async function main(): Promise<void> {
  const db = admin.firestore();
  const apiKeysRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await apiKeysRef.get();
  const tw = ((snap.data()?.social as Record<string, unknown> | undefined)?.twitter ?? {}) as Record<string, unknown>;
  const c: Creds = {
    consumerKey: String(tw.consumerKey ?? ''),
    consumerSecret: String(tw.consumerSecret ?? ''),
    accessToken: String(tw.accessToken ?? ''),
    accessTokenSecret: String(tw.accessTokenSecret ?? ''),
  };
  if (!c.consumerKey || !c.consumerSecret || !c.accessToken || !c.accessTokenSecret) {
    throw new Error('missing twitter creds in apiKeys');
  }

  const bearer = await getBearer(c);
  console.log('Bearer obtained.');

  // 1. DELETE old webhook
  console.log(`\nStep 1: DELETE /2/webhooks/${OLD_WEBHOOK_ID}`);
  const delResp = await fetch(`https://api.x.com/2/webhooks/${OLD_WEBHOOK_ID}`, {
    method: 'DELETE',
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const delText = await delResp.text();
  console.log(`  HTTP ${delResp.status} — ${delText.slice(0, 300)}`);
  if (!delResp.ok && delResp.status !== 404) {
    throw new Error(`DELETE webhook failed unexpectedly: HTTP ${delResp.status} ${delText.slice(0, 300)}`);
  }
  // 404 is fine — webhook was already gone

  // 2. POST register fresh webhook
  console.log(`\nStep 2: POST /2/webhooks { url=${WEBHOOK_URL} }`);
  const regResp = await fetch('https://api.x.com/2/webhooks', {
    method: 'POST',
    headers: { Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ url: WEBHOOK_URL }),
  });
  const regText = await regResp.text();
  console.log(`  HTTP ${regResp.status} — ${regText.slice(0, 600)}`);
  if (!regResp.ok) { throw new Error(`Register failed: ${regText.slice(0, 300)}`); }
  const regData = JSON.parse(regText) as { data?: { id?: string; valid?: boolean } };
  const newWebhookId = regData.data?.id;
  if (!newWebhookId) { throw new Error(`Register response missing id: ${regText.slice(0, 300)}`); }
  console.log(`  ✓ New webhook id: ${newWebhookId}`);

  // 3. Subscribe brand account with CURRENT OAuth1 tokens
  console.log(`\nStep 3: POST /2/account_activity/webhooks/${newWebhookId}/subscriptions/all (OAuth1 user-context)`);
  const subUrl = `https://api.x.com/2/account_activity/webhooks/${newWebhookId}/subscriptions/all`;
  const subResp = await fetch(subUrl, {
    method: 'POST',
    headers: { Authorization: buildOAuth1('POST', subUrl, c), 'Content-Type': 'application/json' },
  });
  const subText = await subResp.text();
  console.log(`  HTTP ${subResp.status} — ${subText.slice(0, 400)}`);
  if (!subResp.ok) { throw new Error(`Subscribe failed: ${subText.slice(0, 300)}`); }
  console.log(`  ✓ Brand account subscribed.`);

  // 4. Save new webhook_id to Firestore
  await apiKeysRef.set(
    {
      social: {
        ...((snap.data()?.social as Record<string, unknown> | undefined) ?? {}),
        twitter: { ...tw, webhookId: newWebhookId },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'reset-twitter-webhook-script',
    },
    { merge: true },
  );
  console.log(`\n✓ Saved webhookId=${newWebhookId} to apiKeys/social.twitter.webhookId`);
  console.log(`\nDone. Reset complete. Send a fresh DM to @salesveloc42339 — events should fire within seconds.`);
  console.log(`(You will need to re-create the X Activity API OAuth2 subscription separately if you want that path active too. Run scripts/create-x-dm-subscription.ts.)`);
}

main().catch((err) => { console.error('reset-twitter-webhook failed:', err); process.exit(1); });
