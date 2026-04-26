/**
 * List all webhooks attached to the X app via the v2 API.
 * Companion to register-twitter-webhook.ts. Used when the dev portal
 * UI shows "No webhooks found" but registration still fails with
 * WebhookLimitExceeded — usually a stale registration that the UI
 * doesn't surface.
 */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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

function pe(s: string): string {
  return encodeURIComponent(s).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

async function getBearer(consumerKey: string, consumerSecret: string): Promise<string> {
  const credentials = Buffer.from(`${pe(consumerKey)}:${pe(consumerSecret)}`).toString('base64');
  const resp = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8' },
    body: 'grant_type=client_credentials',
  });
  if (!resp.ok) { throw new Error(`bearer failed: ${resp.status} ${await resp.text()}`); }
  const j = await resp.json() as { access_token?: string };
  if (!j.access_token) { throw new Error('no access_token'); }
  return j.access_token;
}

async function main() {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const snap = await db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const tw = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const consumerKey = String(tw.consumerKey ?? '');
  const consumerSecret = String(tw.consumerSecret ?? '');
  if (!consumerKey || !consumerSecret) { throw new Error('missing creds'); }

  const bearer = await getBearer(consumerKey, consumerSecret);
  console.log('Bearer token obtained.');

  const resp = await fetch('https://api.x.com/2/webhooks', {
    headers: { Authorization: `Bearer ${bearer}` },
  });
  const text = await resp.text();
  console.log(`GET /2/webhooks → HTTP ${resp.status}`);
  console.log(text);

  // Also try listing per-env (legacy API) via Bearer in case the v2 list is empty.
  const ENVS = ['dev', 'sandbox', 'prod', 'env-beta', 'production', 'Salesvelocity'];
  for (const env of ENVS) {
    const r = await fetch(`https://api.twitter.com/1.1/account_activity/all/${env}/webhooks.json`, {
      headers: { Authorization: `Bearer ${bearer}` },
    });
    if (r.status === 404) continue;
    const t = await r.text();
    console.log(`GET /1.1/account_activity/all/${env}/webhooks.json → HTTP ${r.status}`);
    console.log(t.slice(0, 500));
  }
}

main().catch(e => { console.error('list-webhooks failed:', e); process.exit(1); });
