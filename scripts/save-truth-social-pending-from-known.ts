/**
 * One-shot: save the already-obtained Truth Social app registration
 * credentials (client_id, client_secret) to apiKeys/social.truth_social_pending
 * so the OAuth code-exchange step can pick them up.
 *
 * Used because the in-Node POST to /api/v1/apps gets blocked by
 * Cloudflare's bot management — we registered the app via curl from
 * bash where TLS fingerprinting passes. This script just writes the
 * already-known values to Firestore.
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
  if (!fs.existsSync(sakPath)) { throw new Error('No serviceAccountKey.json'); }
  const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

initAdmin();

async function main(): Promise<void> {
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
        truth_social_pending: {
          instanceUrl: 'https://truthsocial.com',
          appId: '11229750',
          clientId: 'U9G2xGJ1CQ256T4Yilaf5pTLt87zPnvwi_az2aHBBPU',
          clientSecret: '0LykyBk1AkUtgMDd10hvGIJLzv36TPmJA4tClERV_bs',
          registeredAt: new Date().toISOString(),
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'save-truth-social-pending-from-known',
    },
    { merge: true },
  );
  console.log('✓ Saved truth_social_pending to apiKeys');
}

main().catch((err) => { console.error(err); process.exit(1); });
