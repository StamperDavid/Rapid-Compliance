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
  // v1.1 users/show by screen name — works with OAuth1, no v2 scope needed
  for (const handle of ['salesvelocityai', 'salesveloc42339', 'SalesVelocityAi']) {
    const url = `https://api.twitter.com/1.1/users/show.json?screen_name=${handle}`;
    const r = await fetch(url, { headers: { Authorization: oauth1('GET', url, c, { screen_name: handle }) } });
    const t = await r.text();
    console.log(`\n@${handle} → HTTP ${r.status}`);
    if (r.ok) {
      const j = JSON.parse(t);
      console.log(`  id_str: ${j.id_str}`);
      console.log(`  screen_name: ${j.screen_name}`);
      console.log(`  name: ${j.name}`);
      console.log(`  created_at: ${j.created_at}`);
      console.log(`  followers_count: ${j.followers_count}`);
    } else {
      console.log(`  ${t.slice(0, 250)}`);
    }
  }
  // Also call verify_credentials again to confirm the brand account this token controls
  const vcUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json';
  const r = await fetch(vcUrl, { headers: { Authorization: oauth1('GET', vcUrl, c) } });
  const j = await r.json() as any;
  console.log(`\n=== This access token authenticates as: ===`);
  console.log(`  id_str: ${j.id_str}`);
  console.log(`  screen_name: @${j.screen_name}`);
  console.log(`  name: "${j.name}"`);
  process.exit(0);
})();
