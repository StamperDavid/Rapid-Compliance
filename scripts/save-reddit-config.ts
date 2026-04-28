/**
 * Persist Reddit credentials to apiKeys/social.reddit.
 *
 * The RedditService (src/lib/integrations/reddit-service.ts) accepts EITHER:
 *
 *   A) An OAuth refresh-token quartet (recommended — auto-refreshes):
 *        $env:REDDIT_CLIENT_ID="..."          # 14-char string from script app
 *        $env:REDDIT_CLIENT_SECRET="..."      # 27-char string
 *        $env:REDDIT_REFRESH_TOKEN="..."      # from OAuth code exchange
 *        $env:REDDIT_USERNAME="..."           # optional but recommended for context
 *
 *   B) A short-lived access token (1-hour validity, for testing):
 *        $env:REDDIT_ACCESS_TOKEN="..."
 *
 * How to obtain OAuth credentials:
 *   1. Log into the brand's Reddit account.
 *   2. Go to https://www.reddit.com/prefs/apps → "Create another app".
 *   3. Choose app type:
 *        - "script" — for a single account (simplest, no user OAuth flow needed,
 *          but current RedditService expects refresh token from authorization_code flow).
 *        - "web app" — for OAuth on behalf of users.
 *      Pick "web app" for the standard refresh-token flow.
 *   4. Set redirect URI (e.g. https://www.salesvelocity.ai/api/integrations/oauth/reddit/callback).
 *   5. Note client_id (under the app name) and client_secret.
 *   6. Send the brand operator to:
 *        https://www.reddit.com/api/v1/authorize?client_id={id}
 *          &response_type=code&state={random}&redirect_uri={uri}
 *          &duration=permanent&scope=identity submit read
 *   7. Exchange the auth code at:
 *        POST https://www.reddit.com/api/v1/access_token
 *        Authorization: Basic base64(client_id:client_secret)
 *        grant_type=authorization_code&code={code}&redirect_uri={uri}
 *      Response includes refresh_token and access_token. Use refresh_token here.
 *
 * NOTE: The script-app username/password flow is NOT supported by the current
 * RedditService implementation — only OAuth refresh-token flow is wired in.
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
  const accessToken = process.env.REDDIT_ACCESS_TOKEN;
  const clientId = process.env.REDDIT_CLIENT_ID;
  const clientSecret = process.env.REDDIT_CLIENT_SECRET;
  const refreshToken = process.env.REDDIT_REFRESH_TOKEN;
  const username = process.env.REDDIT_USERNAME;

  const oauthReady = Boolean(clientId && clientSecret && refreshToken);
  const tokenReady = Boolean(accessToken);

  if (!oauthReady && !tokenReady) {
    console.error('Reddit credentials missing. Set ONE of these env-var groups:');
    console.error('  OAuth (recommended): REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET + REDDIT_REFRESH_TOKEN');
    console.error('  Short-lived token:   REDDIT_ACCESS_TOKEN');
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
  const existingReddit = (existingSocial.reddit && typeof existingSocial.reddit === 'object'
    ? (existingSocial.reddit as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const redditPayload: Record<string, unknown> = {
    ...existingReddit,
    ...(accessToken ? { accessToken } : {}),
    ...(clientId ? { clientId } : {}),
    ...(clientSecret ? { clientSecret } : {}),
    ...(refreshToken ? { refreshToken } : {}),
    ...(username ? { username } : {}),
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        reddit: redditPayload,
      },
      updatedAt: now,
      updatedBy: 'save-reddit-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyReddit = (verifySocial.reddit ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved Reddit credentials at apiKeys/${PLATFORM_ID}.social.reddit`);
  console.log('  fields:');
  if (typeof verifyReddit.clientId === 'string' && verifyReddit.clientId.length > 0) {
    console.log(`    clientId: ${redact(verifyReddit.clientId)}`);
  }
  if (typeof verifyReddit.clientSecret === 'string' && verifyReddit.clientSecret.length > 0) {
    console.log(`    clientSecret: ${redact(verifyReddit.clientSecret)}`);
  }
  if (typeof verifyReddit.refreshToken === 'string' && verifyReddit.refreshToken.length > 0) {
    console.log(`    refreshToken: ${redact(verifyReddit.refreshToken)}`);
  }
  if (typeof verifyReddit.accessToken === 'string' && verifyReddit.accessToken.length > 0) {
    console.log(`    accessToken: ${redact(verifyReddit.accessToken)}`);
  }
  if (typeof verifyReddit.username === 'string' && verifyReddit.username.length > 0) {
    console.log(`    username: u/${verifyReddit.username}`);
  }
  console.log(`  savedAt: ${String(verifyReddit.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-reddit-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
