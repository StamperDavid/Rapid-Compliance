/**
 * Comprehensive diagnostic for "DMs to @salesvelocityai not arriving on
 * our webhook even though webhook + subscription show valid".
 *
 * Tries every X API endpoint that can produce ground-truth on:
 *   - whether the brand's inbox has the DMs at all (proves delivery to X)
 *   - what event_type X tagged them with
 *   - whether the webhook can be re-validated
 *   - what tier/access the app currently has
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
const BRAND_USER_ID = '2048199442067755008';

async function logCall(label: string, doFetch: () => Promise<Response>): Promise<{ status: number; bodyPreview: string }> {
  try {
    const r = await doFetch();
    const t = await r.text();
    console.log(`\n=== ${label} ===`);
    console.log(`HTTP ${r.status}`);
    console.log(t.slice(0, 1500));
    return { status: r.status, bodyPreview: t.slice(0, 200) };
  } catch (err) {
    console.log(`\n=== ${label} ===`);
    console.log(`fetch error: ${(err as Error).message}`);
    return { status: 0, bodyPreview: '' };
  }
}

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
  console.log(`Bearer obtained. Brand user_id: ${BRAND_USER_ID}, webhook_id: ${WEBHOOK_ID}\n`);

  // 1. Authenticated user (sanity check that the OAuth1 token is the brand)
  await logCall('GET /2/users/me (OAuth1 — confirms which account our access token authenticates as)', () => {
    const url = 'https://api.x.com/2/users/me';
    return fetch(url, { headers: { Authorization: buildOAuth1('GET', url, c) } });
  });

  // 2. List DM events the brand received recently. This tells us if X has
  //    the DM in the brand's inbox at all. Tries v2 first, v1.1 fallback.
  await logCall('GET /2/dm_events?max_results=20 (OAuth1 — recent DM events for the brand)', () => {
    const url = 'https://api.x.com/2/dm_events?max_results=20&dm_event_fields=id,event_type,text,sender_id,dm_conversation_id,created_at';
    return fetch(url, { headers: { Authorization: buildOAuth1('GET', url, c, { max_results: '20', dm_event_fields: 'id,event_type,text,sender_id,dm_conversation_id,created_at' }) } });
  });

  await logCall('GET /1.1/direct_messages/events/list.json?count=20 (OAuth1 — legacy DM events)', () => {
    const url = 'https://api.twitter.com/1.1/direct_messages/events/list.json?count=20';
    return fetch(url, { headers: { Authorization: buildOAuth1('GET', url, c, { count: '20' }) } });
  });

  // 3. List DM conversations
  await logCall('GET /2/dm_conversations (OAuth1)', () => {
    const url = 'https://api.x.com/2/dm_conversations';
    return fetch(url, { headers: { Authorization: buildOAuth1('GET', url, c) } });
  });

  // 4. Webhook detail (some endpoints expose lastDelivery info)
  await logCall(`GET /2/webhooks/${WEBHOOK_ID} (Bearer)`, () => {
    const url = `https://api.x.com/2/webhooks/${WEBHOOK_ID}`;
    return fetch(url, { headers: { Authorization: `Bearer ${bearer}` } });
  });

  // 5. Trigger a fresh CRC on the webhook (validates X can still reach our URL).
  //    PUT /2/webhooks/{id} forces X to re-CRC.
  await logCall(`PUT /2/webhooks/${WEBHOOK_ID} (Bearer — re-validate with fresh CRC)`, () => {
    const url = `https://api.x.com/2/webhooks/${WEBHOOK_ID}`;
    return fetch(url, { method: 'PUT', headers: { Authorization: `Bearer ${bearer}` } });
  });

  // 6. Replay endpoint — fetches buffered events that didn't deliver
  await logCall(`POST /2/account_activity/webhooks/${WEBHOOK_ID}/subscriptions/all/replay/job (OAuth1 — request replay of last 24h)`, () => {
    const fromDate = new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString().replace(/\.\d+Z$/, 'Z');
    const toDate = new Date(Date.now() - 60_000).toISOString().replace(/\.\d+Z$/, 'Z');
    const url = `https://api.x.com/2/account_activity/webhooks/${WEBHOOK_ID}/subscriptions/all/replay/job`;
    return fetch(`${url}?from_date=${encodeURIComponent(fromDate)}&to_date=${encodeURIComponent(toDate)}`, {
      method: 'POST',
      headers: { Authorization: buildOAuth1('POST', url, c, { from_date: fromDate, to_date: toDate }) },
    });
  });

  console.log('\n=== Summary ===');
  console.log('If /2/dm_events returns the user\'s test DM, the DM is in the brand inbox but X is not delivering the webhook event.');
  console.log('If /2/dm_events returns no DMs from today, the DM never reached the brand inbox (filter or block).');
  console.log('If the replay job returns a job_id, X will deliver buffered events to our webhook within minutes.');
}

main().catch(e => { console.error(e); process.exit(1); });
