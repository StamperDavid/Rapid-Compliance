/**
 * Persist YouTube credentials to apiKeys/social.youtube.
 *
 * The YouTubeService (src/lib/integrations/youtube-service.ts) accepts EITHER:
 *
 *   A) An OAuth refresh-token quartet (recommended — auto-refreshes):
 *        $env:YOUTUBE_CLIENT_ID="...apps.googleusercontent.com"
 *        $env:YOUTUBE_CLIENT_SECRET="..."
 *        $env:YOUTUBE_REFRESH_TOKEN="1//..."
 *        $env:YOUTUBE_CHANNEL_ID="UC..."   # optional but recommended
 *
 *   B) A short-lived access token (1-hour validity, for testing):
 *        $env:YOUTUBE_ACCESS_TOKEN="ya29..."
 *
 * How to obtain OAuth credentials:
 *   1. Go to https://console.cloud.google.com → create/select a project.
 *   2. Enable the YouTube Data API v3.
 *   3. Set up the OAuth consent screen (External, Testing mode is fine for dev).
 *   4. Create OAuth client ID credentials (Type: Desktop or Web app). Note clientId
 *      and clientSecret.
 *   5. Use Google's OAuth Playground (https://developers.google.com/oauthplayground)
 *      OR your own auth flow with these scopes:
 *        https://www.googleapis.com/auth/youtube.upload
 *        https://www.googleapis.com/auth/youtube.force-ssl
 *      Authorize with the brand's Google account (NOT your personal account if you're
 *      managing on behalf of a client).
 *   6. Exchange the auth code for a refresh token. The refresh token does NOT expire
 *      unless explicitly revoked.
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
  const accessToken = process.env.YOUTUBE_ACCESS_TOKEN;
  const clientId = process.env.YOUTUBE_CLIENT_ID;
  const clientSecret = process.env.YOUTUBE_CLIENT_SECRET;
  const refreshToken = process.env.YOUTUBE_REFRESH_TOKEN;
  const channelId = process.env.YOUTUBE_CHANNEL_ID;

  const oauthReady = Boolean(clientId && clientSecret && refreshToken);
  const tokenReady = Boolean(accessToken);

  if (!oauthReady && !tokenReady) {
    console.error('YouTube credentials missing. Set ONE of these env-var groups:');
    console.error('  OAuth (recommended): YOUTUBE_CLIENT_ID + YOUTUBE_CLIENT_SECRET + YOUTUBE_REFRESH_TOKEN');
    console.error('  Short-lived token:   YOUTUBE_ACCESS_TOKEN');
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
  const existingYoutube = (existingSocial.youtube && typeof existingSocial.youtube === 'object'
    ? (existingSocial.youtube as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const youtubePayload: Record<string, unknown> = {
    ...existingYoutube,
    ...(accessToken ? { accessToken } : {}),
    ...(clientId ? { clientId } : {}),
    ...(clientSecret ? { clientSecret } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(channelId ? { channelId } : {}),
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        youtube: youtubePayload,
      },
      updatedAt: now,
      updatedBy: 'save-youtube-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyYoutube = (verifySocial.youtube ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved YouTube credentials at apiKeys/${PLATFORM_ID}.social.youtube`);
  console.log('  fields:');
  if (typeof verifyYoutube.clientId === 'string' && verifyYoutube.clientId.length > 0) {
    console.log(`    clientId: ${redact(verifyYoutube.clientId)}`);
  }
  if (typeof verifyYoutube.clientSecret === 'string' && verifyYoutube.clientSecret.length > 0) {
    console.log(`    clientSecret: ${redact(verifyYoutube.clientSecret)}`);
  }
  if (typeof verifyYoutube.refreshToken === 'string' && verifyYoutube.refreshToken.length > 0) {
    console.log(`    refreshToken: ${redact(verifyYoutube.refreshToken)}`);
  }
  if (typeof verifyYoutube.accessToken === 'string' && verifyYoutube.accessToken.length > 0) {
    console.log(`    accessToken: ${redact(verifyYoutube.accessToken)}`);
  }
  if (typeof verifyYoutube.channelId === 'string' && verifyYoutube.channelId.length > 0) {
    console.log(`    channelId: ${verifyYoutube.channelId}`);
  }
  console.log(`  savedAt: ${String(verifyYoutube.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-youtube-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
