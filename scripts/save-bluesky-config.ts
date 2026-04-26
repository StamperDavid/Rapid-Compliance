/**
 * Persist Bluesky account credentials to apiKeys/social.bluesky.
 *
 * Reads from env so secrets don't appear in shell history:
 *   $env:BLUESKY_IDENTIFIER="yourhandle.bsky.social"
 *   $env:BLUESKY_PASSWORD="xxxx-xxxx-xxxx-xxxx"   # app password, NOT your account password
 *
 * The app password is created at https://bsky.app → Settings → App Passwords.
 * Use a dedicated app password per integration so it can be revoked.
 *
 * After saving, validate by running scripts/verify-bluesky-post-live.ts
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

async function main(): Promise<void> {
  const identifier = process.env.BLUESKY_IDENTIFIER;
  const password = process.env.BLUESKY_PASSWORD;
  if (!identifier || !password) {
    console.error('BLUESKY_IDENTIFIER and BLUESKY_PASSWORD env vars required');
    process.exit(1);
  }

  // Validate the credentials against the AT Protocol BEFORE writing them.
  console.log(`Validating ${identifier} against bsky.social...`);
  const sessionResp = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier, password }),
  });
  if (!sessionResp.ok) {
    const errText = await sessionResp.text();
    console.error(`Bluesky auth failed: HTTP ${sessionResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const session = await sessionResp.json() as { accessJwt?: string; refreshJwt?: string; did?: string; handle?: string };
  if (!session.accessJwt || !session.did) {
    console.error('Bluesky session missing accessJwt or did');
    process.exit(3);
  }
  console.log(`✓ Authenticated as ${session.handle ?? identifier} (did=${session.did})`);

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
        bluesky: {
          identifier,
          password,
          accessJwt: session.accessJwt,
          refreshJwt: session.refreshJwt ?? null,
          did: session.did,
          handle: session.handle ?? identifier,
          pdsUrl: 'https://bsky.social',
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'save-bluesky-config-script',
    },
    { merge: true },
  );

  console.log('✓ Saved apiKeys/social.bluesky');
  console.log(`  identifier: ${identifier}`);
  console.log(`  did:        ${session.did}`);
  console.log(`  handle:     ${session.handle ?? identifier}`);
  console.log(`  password:   ${password.slice(0, 4)}...${password.slice(-4)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
