/**
 * Persist TikTok credentials to apiKeys/social.tiktok.
 *
 * The TikTokService (src/lib/integrations/tiktok-service.ts) accepts EITHER:
 *
 *   A) An OAuth refresh-token quartet (recommended — auto-refreshes):
 *        $env:TIKTOK_CLIENT_KEY="aw..."           # NOTE: client_KEY (TikTok terminology)
 *        $env:TIKTOK_CLIENT_SECRET="..."
 *        $env:TIKTOK_REFRESH_TOKEN="rft..."
 *        $env:TIKTOK_OPEN_ID="..."                # optional but recommended
 *
 *   B) A short-lived access token (24-hour validity, for testing):
 *        $env:TIKTOK_ACCESS_TOKEN="act..."
 *
 * How to obtain OAuth credentials:
 *   1. Go to https://developers.tiktok.com → register as developer.
 *   2. Create an app, request access to the Content Posting API (approval required —
 *      can take days to weeks; specify your business use case clearly).
 *   3. Note the client_key and client_secret from your app's Login Kit settings.
 *   4. Configure redirect URI in TikTok dev console (e.g.
 *      https://www.salesvelocity.ai/api/integrations/oauth/tiktok/callback).
 *   5. Send the brand operator to the TikTok auth URL with scopes:
 *        user.info.basic, video.publish, video.upload
 *   6. Exchange the auth code for refresh_token + access_token + open_id at:
 *        POST https://open.tiktokapis.com/v2/oauth/token/
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
  const accessToken = process.env.TIKTOK_ACCESS_TOKEN;
  const clientKey = process.env.TIKTOK_CLIENT_KEY;
  const clientSecret = process.env.TIKTOK_CLIENT_SECRET;
  const refreshToken = process.env.TIKTOK_REFRESH_TOKEN;
  const openId = process.env.TIKTOK_OPEN_ID;

  const oauthReady = Boolean(clientKey && clientSecret && refreshToken);
  const tokenReady = Boolean(accessToken);

  if (!oauthReady && !tokenReady) {
    console.error('TikTok credentials missing. Set ONE of these env-var groups:');
    console.error('  OAuth (recommended): TIKTOK_CLIENT_KEY + TIKTOK_CLIENT_SECRET + TIKTOK_REFRESH_TOKEN');
    console.error('  Short-lived token:   TIKTOK_ACCESS_TOKEN');
    process.exit(1);
  }

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const existingTiktok = (existingSocial.tiktok && typeof existingSocial.tiktok === 'object'
    ? (existingSocial.tiktok as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const tiktokPayload: Record<string, unknown> = {
    ...existingTiktok,
    ...(accessToken ? { accessToken } : {}),
    ...(clientKey ? { clientKey } : {}),
    ...(clientSecret ? { clientSecret } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(openId ? { openId } : {}),
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        tiktok: tiktokPayload,
      },
      updatedAt: now,
      updatedBy: 'save-tiktok-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyTiktok = (verifySocial.tiktok ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved TikTok credentials at apiKeys/${PLATFORM_ID}.social.tiktok`);
  console.log('  fields:');
  if (typeof verifyTiktok.clientKey === 'string' && verifyTiktok.clientKey.length > 0) {
    console.log(`    clientKey: ${redact(verifyTiktok.clientKey)}`);
  }
  if (typeof verifyTiktok.clientSecret === 'string' && verifyTiktok.clientSecret.length > 0) {
    console.log(`    clientSecret: ${redact(verifyTiktok.clientSecret)}`);
  }
  if (typeof verifyTiktok.refreshToken === 'string' && verifyTiktok.refreshToken.length > 0) {
    console.log(`    refreshToken: ${redact(verifyTiktok.refreshToken)}`);
  }
  if (typeof verifyTiktok.accessToken === 'string' && verifyTiktok.accessToken.length > 0) {
    console.log(`    accessToken: ${redact(verifyTiktok.accessToken)}`);
  }
  if (typeof verifyTiktok.openId === 'string' && verifyTiktok.openId.length > 0) {
    console.log(`    openId: ${redact(verifyTiktok.openId)}`);
  }
  console.log(`  savedAt: ${String(verifyTiktok.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-tiktok-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
