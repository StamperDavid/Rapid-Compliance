/**
 * Check whether @salesvelocityai is subscribed to webhook 2048240842830401536.
 * Tries both v2 and v1.1 endpoints since X's API surface for Account
 * Activity is split between them.
 */
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
  }
}

initAdmin();

interface Creds { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string }

function pe(s: string): string {
  return encodeURIComponent(s).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function buildOAuth1(method: string, url: string, c: Creds, q: Record<string, string> = {}): string {
  const oauth: Record<string, string> = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.accessToken,
    oauth_version: '1.0',
  };
  const all = { ...oauth, ...q };
  const ps = Object.keys(all).sort().map(k => `${pe(k)}=${pe(all[k])}`).join('&');
  const base = [method.toUpperCase(), pe(url), pe(ps)].join('&');
  const key = `${pe(c.consumerSecret)}&${pe(c.accessTokenSecret)}`;
  oauth.oauth_signature = crypto.createHmac('sha1', key).update(base).digest('base64');
  return `OAuth ${Object.keys(oauth).sort().map(k => `${pe(k)}="${pe(oauth[k])}"`).join(', ')}`;
}

async function getBearer(c: Creds): Promise<string> {
  const cred = Buffer.from(`${pe(c.consumerKey)}:${pe(c.consumerSecret)}`).toString('base64');
  const r = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${cred}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'grant_type=client_credentials',
  });
  const j = await r.json() as { access_token?: string };
  return j.access_token ?? '';
}

const WEBHOOK_ID = '2048240842830401536';

async function main() {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const snap = await db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const tw = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const c: Creds = {
    consumerKey: String(tw.consumerKey ?? ''),
    consumerSecret: String(tw.consumerSecret ?? ''),
    accessToken: String(tw.accessToken ?? ''),
    accessTokenSecret: String(tw.accessTokenSecret ?? ''),
  };

  const bearer = await getBearer(c);

  // v2 — list subscriptions for the webhook
  const v2List = `https://api.x.com/2/account_activity/webhooks/${WEBHOOK_ID}/subscriptions/all/list`;
  const r1 = await fetch(v2List, { headers: { Authorization: `Bearer ${bearer}` } });
  console.log(`GET ${v2List} → HTTP ${r1.status}`);
  console.log(await r1.text());

  // v2 — check if the access token's user is subscribed (User Context required)
  const v2Check = `https://api.x.com/2/account_activity/webhooks/${WEBHOOK_ID}/subscriptions/all`;
  const r2 = await fetch(v2Check, { method: 'GET', headers: { Authorization: buildOAuth1('GET', v2Check, c) } });
  console.log(`\nGET ${v2Check} (OAuth1) → HTTP ${r2.status}`);
  console.log(await r2.text());

  // legacy v1.1 — count subscriptions
  const v1Count = `https://api.twitter.com/1.1/account_activity/all/dev/subscriptions/count.json`;
  const r3 = await fetch(v1Count, { headers: { Authorization: `Bearer ${bearer}` } });
  console.log(`\nGET ${v1Count} → HTTP ${r3.status}`);
  console.log(await r3.text());
}

main().catch(e => { console.error(e); process.exit(1); });
