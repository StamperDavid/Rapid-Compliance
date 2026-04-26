import * as crypto from 'crypto';
import * as admin from 'firebase-admin';
import * as fs from 'fs';
import * as path from 'path';
const envPath = path.resolve('D:/Future Rapid Compliance/.env.local');
for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
  const m = /^([A-Z_][A-Z0-9_]*)=(.*)$/.exec(line.trim());
  if (m) { const v = m[2].replace(/^["']|["']$/g, ''); if (!process.env[m[1]]) process.env[m[1]] = v; }
}
const sa = JSON.parse(fs.readFileSync('D:/Future Rapid Compliance/serviceAccountKey.json', 'utf-8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
function pe(s: string) { return encodeURIComponent(s).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29'); }
function oauth1(method: string, url: string, c: any, q: Record<string,string> = {}) {
  const o: Record<string,string> = { oauth_consumer_key: c.consumerKey, oauth_nonce: crypto.randomBytes(16).toString('hex'), oauth_signature_method: 'HMAC-SHA1', oauth_timestamp: Math.floor(Date.now()/1000).toString(), oauth_token: c.accessToken, oauth_version: '1.0' };
  const all = { ...o, ...q };
  const ps = Object.keys(all).sort().map(k => `${pe(k)}=${pe(all[k])}`).join('&');
  const base = [method.toUpperCase(), pe(url), pe(ps)].join('&');
  o.oauth_signature = crypto.createHmac('sha1', `${pe(c.consumerSecret)}&${pe(c.accessTokenSecret)}`).update(base).digest('base64');
  return `OAuth ${Object.keys(o).sort().map(k => `${pe(k)}="${pe(o[k])}"`).join(', ')}`;
}
(async () => {
  const PLATFORM_ID = 'rapid-compliance-root';
  const snap = await admin.firestore().collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const tw = (snap.data()?.social as any)?.twitter ?? {};
  const c = { consumerKey: String(tw.consumerKey), consumerSecret: String(tw.consumerSecret), accessToken: String(tw.accessToken), accessTokenSecret: String(tw.accessTokenSecret) };
  // Probe — read own tweets (works without DM scope)
  const tweetUrl = 'https://api.x.com/2/users/2048199442067755008/tweets?max_results=5';
  const r1 = await fetch(tweetUrl, { headers: { Authorization: oauth1('GET', tweetUrl, c, { max_results: '5' }) }});
  console.log(`GET /2/users/.../tweets HTTP ${r1.status}`); console.log((await r1.text()).slice(0, 400));
  // Probe — verify_credentials (legacy v1.1, returns full account info)
  const vcUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json';
  const r2 = await fetch(vcUrl, { headers: { Authorization: oauth1('GET', vcUrl, c) }});
  console.log(`\nGET /1.1/account/verify_credentials HTTP ${r2.status}`); console.log((await r2.text()).slice(0, 800));
  // Probe — try to send a DM to a known invalid recipient — if we get 401 vs 403, we know if DM SCOPE is gone (401) or just bad recipient (403)
  const dmUrl = 'https://api.twitter.com/2/dm_conversations/with/999999999999999999/messages';
  const r3 = await fetch(dmUrl, { method: 'POST', headers: { Authorization: oauth1('POST', dmUrl, c), 'Content-Type': 'application/json' }, body: JSON.stringify({ text: 'probe' }) });
  console.log(`\nPOST DM to fake recipient HTTP ${r3.status}`); console.log((await r3.text()).slice(0, 400));
  process.exit(0);
})();
