/**
 * List X Activity API subscriptions for the brand's OAuth2 user token.
 * Shows status / health if X exposes it.
 */
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
  }
}

initAdmin();

(async () => {
  const PLATFORM_ID = 'rapid-compliance-root';
  const snap = await admin.firestore().collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const tw = ((snap.data()?.social as Record<string, unknown> | undefined)?.twitter ?? {}) as Record<string, unknown>;
  const o = (tw.oauth2User ?? {}) as { accessToken?: string };
  if (!o.accessToken) { console.error('no accessToken'); process.exit(1); }
  const r = await fetch('https://api.x.com/2/activity/subscriptions', {
    headers: { Authorization: `Bearer ${o.accessToken}` },
  });
  console.log(`GET /2/activity/subscriptions → HTTP ${r.status}`);
  console.log(await r.text());
  process.exit(0);
})();
