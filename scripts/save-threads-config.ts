/**
 * Persist Threads credentials to apiKeys/social.threads.
 *
 * The ThreadsService (src/lib/integrations/threads-service.ts) needs:
 *   $env:THREADS_ACCESS_TOKEN="..."   # long-lived Threads/IG-linked token
 *   $env:THREADS_USER_ID="..."        # Threads user ID (NOT the @handle)
 *
 * IMPORTANT: Threads piggybacks on the Instagram + Facebook Graph API system.
 * The Threads account must be linked to an Instagram Business/Creator account
 * (which itself must be linked to a Facebook Page). It is a separate token system
 * from raw Instagram — uses graph.threads.net not graph.facebook.com.
 *
 * How to obtain the credentials:
 *   1. Ensure the Threads account exists and is linked to an IG Business/Creator account.
 *   2. Go to https://developers.facebook.com → your app.
 *   3. Add the "Threads API" product to your app (in Meta dev console).
 *   4. Configure OAuth with redirect URI:
 *        https://www.salesvelocity.ai/api/integrations/oauth/threads/callback
 *   5. Send the brand operator to:
 *        https://threads.net/oauth/authorize?client_id={app-id}
 *          &redirect_uri={uri}
 *          &scope=threads_basic,threads_content_publish
 *          &response_type=code
 *   6. Exchange the auth code at:
 *        POST https://graph.threads.net/oauth/access_token
 *        client_id, client_secret, grant_type=authorization_code, redirect_uri, code
 *      Response includes a short-lived access_token + user_id.
 *   7. Exchange for long-lived token (60-day TTL, refreshable):
 *        GET https://graph.threads.net/access_token?
 *          grant_type=th_exchange_token&client_secret={secret}&access_token={short-token}
 *
 * After saving, validate by running scripts/audit-social-credentials.ts
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

function redact(value: string): string {
  if (value.length <= 10) { return '***'; }
  return `set, length: ${value.length}`;
}

async function main(): Promise<void> {
  const accessToken = process.env.THREADS_ACCESS_TOKEN;
  const userId = process.env.THREADS_USER_ID;

  if (!accessToken || !userId) {
    console.error('THREADS_ACCESS_TOKEN and THREADS_USER_ID env vars required');
    console.error('See script header for the OAuth flow that produces these.');
    process.exit(1);
  }

  // Validate the token against the Threads API BEFORE writing it.
  console.log(`Validating Threads token for user ${userId}...`);
  const verifyResp = await fetch(
    `https://graph.threads.net/v1.0/${encodeURIComponent(userId)}?fields=id,username,name&access_token=${encodeURIComponent(accessToken)}`,
  );
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`Threads auth failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const profile = await verifyResp.json() as { id?: string; username?: string; name?: string };
  if (!profile.id || profile.id !== userId) {
    console.error(`Threads user ID mismatch: expected ${userId}, got ${String(profile.id)}`);
    process.exit(3);
  }
  console.log(`✓ Authenticated as @${profile.username ?? '(unknown)'} (${profile.name ?? '(no display name)'}) — id=${profile.id}`);

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const threadsPayload = {
    accessToken,
    userId,
    username: profile.username ?? null,
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        threads: threadsPayload,
      },
      updatedAt: now,
      updatedBy: 'save-threads-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyThreads = (verifySocial.threads ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved Threads credentials at apiKeys/${PLATFORM_ID}.social.threads`);
  console.log('  fields:');
  console.log(`    accessToken: ${redact(String(verifyThreads.accessToken ?? ''))}`);
  console.log(`    userId: ${String(verifyThreads.userId ?? '(missing)')}`);
  console.log(`    username: ${String(verifyThreads.username ?? '(none)')}`);
  console.log(`  savedAt: ${String(verifyThreads.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-threads-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
