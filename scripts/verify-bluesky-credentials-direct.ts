/**
 * CREDENTIAL SMOKE TEST — direct service call, NOT product-path verification.
 *
 * What this DOES test:
 *   - Bluesky's AT Protocol endpoint accepts our saved credentials from
 *     apiKeys/social.bluesky (saved via save-bluesky-config.ts)
 *   - A raw createRecord call posts successfully and returns a uri + cid
 *
 * What this does NOT test:
 *   - The product path through Jasper → SocialMediaManager → BlueskyExpert
 *     → social_post tool → Mission Control
 *   - Whether BlueskyExpert.execute() (the function the orchestrator actually
 *     calls) handles the response correctly. This script bypasses it entirely.
 *
 * Renamed Apr 29 2026 from `verify-bluesky-post-live.ts` because the old name
 * implied end-to-end coverage. The actual end-to-end product-path verify
 * lives at `scripts/verify-bluesky-orchestrated-post-live.ts`.
 *
 * Real product path: see `scripts/verify-bluesky-orchestrated-post-live.ts`
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

interface BlueskyCreds {
  identifier?: string;
  password?: string;
  accessJwt?: string;
  refreshJwt?: string;
  did?: string;
  handle?: string;
  pdsUrl?: string;
}

async function loadCreds(): Promise<BlueskyCreds> {
  const PLATFORM_ID = 'rapid-compliance-root';
  const snap = await admin.firestore().collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const social = ((snap.data()?.social as Record<string, unknown> | undefined) ?? {}) as Record<string, unknown>;
  const bluesky = (social.bluesky ?? {}) as BlueskyCreds;
  if (!bluesky.identifier) {
    throw new Error('apiKeys/social.bluesky not configured — run scripts/save-bluesky-config.ts first');
  }
  return bluesky;
}

async function ensureSession(creds: BlueskyCreds): Promise<{ accessJwt: string; did: string; handle: string }> {
  const pdsUrl = creds.pdsUrl ?? 'https://bsky.social';
  // Always re-create a session for the verify run — the cached one in apiKeys
  // may be stale or have been revoked. App passwords keep working until the
  // operator revokes them.
  if (!creds.identifier || !creds.password) {
    throw new Error('identifier + password required to create a fresh session');
  }
  const resp = await fetch(`${pdsUrl}/xrpc/com.atproto.server.createSession`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: creds.identifier, password: creds.password }),
  });
  if (!resp.ok) {
    throw new Error(`createSession failed: HTTP ${resp.status} ${(await resp.text()).slice(0, 300)}`);
  }
  const data = await resp.json() as { accessJwt?: string; did?: string; handle?: string };
  if (!data.accessJwt || !data.did || !data.handle) {
    throw new Error('createSession response missing required fields');
  }
  return { accessJwt: data.accessJwt, did: data.did, handle: data.handle };
}

async function main(): Promise<void> {
  const argText = (() => {
    const i = process.argv.indexOf('--text');
    if (i > 0 && process.argv[i + 1]) { return process.argv[i + 1]; }
    return `[SalesVelocity.ai pipeline test ${new Date().toISOString()}] If you can read this, the Bluesky posting path is wired end-to-end.`;
  })();

  const creds = await loadCreds();
  const pdsUrl = creds.pdsUrl ?? 'https://bsky.social';
  console.log(`Posting test record to ${pdsUrl} as ${creds.identifier}...`);
  console.log(`  text: ${argText}`);

  const session = await ensureSession(creds);

  const record = {
    $type: 'app.bsky.feed.post',
    text: argText,
    langs: ['en'],
    createdAt: new Date().toISOString(),
  };

  const resp = await fetch(`${pdsUrl}/xrpc/com.atproto.repo.createRecord`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.accessJwt}` },
    body: JSON.stringify({ repo: session.did, collection: 'app.bsky.feed.post', record }),
  });
  const text = await resp.text();
  console.log(`HTTP ${resp.status}`);
  console.log(text);
  if (!resp.ok) {
    console.error('FAIL — post rejected by Bluesky');
    process.exit(2);
  }
  const parsed = JSON.parse(text) as { uri?: string; cid?: string };
  // AT URI looks like at://did:plc:.../app.bsky.feed.post/<rkey>
  const rkey = parsed.uri?.split('/').pop();
  const publicUrl = rkey ? `https://bsky.app/profile/${session.handle}/post/${rkey}` : '(no URL)';
  console.log(`PASS — post created`);
  console.log(`  uri:        ${parsed.uri}`);
  console.log(`  cid:        ${parsed.cid}`);
  console.log(`  public url: ${publicUrl}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
