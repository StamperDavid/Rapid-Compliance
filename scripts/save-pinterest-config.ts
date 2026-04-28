/**
 * Persist Pinterest credentials to apiKeys/social.pinterest.
 *
 * The PinterestService (src/lib/integrations/pinterest-service.ts) needs:
 *   $env:PINTEREST_ACCESS_TOKEN="pina_..."         # OAuth 2.0 access token
 *   $env:PINTEREST_REFRESH_TOKEN="pinr_..."        # optional but recommended
 *   $env:PINTEREST_DEFAULT_BOARD_ID="..."          # optional default board for new pins
 *
 * IMPORTANT: Pinterest API requires a Business account (not personal).
 * Convert in Pinterest settings: Account management → Convert to a business account.
 *
 * How to obtain OAuth credentials:
 *   1. Go to https://developers.pinterest.com → Apps → create a new app.
 *   2. Configure redirect URI in your app (e.g.
 *      https://www.salesvelocity.ai/api/integrations/oauth/pinterest/callback).
 *   3. Send the brand operator to:
 *        https://www.pinterest.com/oauth/?
 *          response_type=code
 *          &redirect_uri={your-redirect-uri}
 *          &client_id={app-id}
 *          &scope=boards:read,pins:read,pins:write
 *   4. Exchange the auth code at:
 *        POST https://api.pinterest.com/v5/oauth/token
 *        grant_type=authorization_code, code, redirect_uri, client_id, client_secret
 *      Response includes access_token (60-day TTL) and refresh_token (1-year TTL).
 *   5. Look up the default board ID via:
 *        GET https://api.pinterest.com/v5/boards
 *      and pick the board you want pins to go to by default.
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
  const accessToken = process.env.PINTEREST_ACCESS_TOKEN;
  const refreshToken = process.env.PINTEREST_REFRESH_TOKEN;
  const defaultBoardId = process.env.PINTEREST_DEFAULT_BOARD_ID;

  if (!accessToken) {
    console.error('PINTEREST_ACCESS_TOKEN env var required');
    console.error('See script header for the OAuth flow that produces this.');
    process.exit(1);
  }

  // Validate the token against the Pinterest API BEFORE writing it.
  console.log('Validating Pinterest token...');
  const verifyResp = await fetch('https://api.pinterest.com/v5/user_account', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`Pinterest auth failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const profile = await verifyResp.json() as {
    username?: string;
    account_type?: string;
    follower_count?: number;
    pin_count?: number;
  };
  console.log(`✓ Authenticated as @${profile.username ?? '(unknown)'} (account_type=${profile.account_type ?? '(unknown)'})`);
  console.log(`  follower_count: ${profile.follower_count ?? 0}`);
  console.log(`  pin_count:      ${profile.pin_count ?? 0}`);

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const existing = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const existingSocial = (existing.social && typeof existing.social === 'object'
    ? (existing.social as Record<string, unknown>)
    : {}) as Record<string, unknown>;
  const existingPinterest = (existingSocial.pinterest && typeof existingSocial.pinterest === 'object'
    ? (existingSocial.pinterest as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const pinterestPayload: Record<string, unknown> = {
    ...existingPinterest,
    accessToken,
    ...(refreshToken ? { refreshToken } : {}),
    ...(defaultBoardId ? { defaultBoardId } : {}),
    username: profile.username ?? null,
    savedAt: new Date().toISOString(),
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: {
        ...existingSocial,
        pinterest: pinterestPayload,
      },
      updatedAt: now,
      updatedBy: 'save-pinterest-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  // Read back to confirm.
  const verifySnap = await docRef.get();
  const verifyData = verifySnap.data() as Record<string, unknown>;
  const verifySocial = (verifyData.social ?? {}) as Record<string, unknown>;
  const verifyPinterest = (verifySocial.pinterest ?? {}) as Record<string, unknown>;

  console.log(`✓ Saved Pinterest credentials at apiKeys/${PLATFORM_ID}.social.pinterest`);
  console.log('  fields:');
  console.log(`    accessToken: ${redact(String(verifyPinterest.accessToken ?? ''))}`);
  if (typeof verifyPinterest.refreshToken === 'string' && verifyPinterest.refreshToken.length > 0) {
    console.log(`    refreshToken: ${redact(verifyPinterest.refreshToken)}`);
  }
  if (typeof verifyPinterest.defaultBoardId === 'string' && verifyPinterest.defaultBoardId.length > 0) {
    console.log(`    defaultBoardId: ${verifyPinterest.defaultBoardId}`);
  }
  console.log(`    username: ${String(verifyPinterest.username ?? '(none)')}`);
  console.log(`  savedAt: ${String(verifyPinterest.savedAt ?? '(missing)')}`);
  console.log('');
  console.log('To verify: npx tsx scripts/audit-social-credentials.ts');
  console.log('To test posting: npx tsx scripts/verify-pinterest-post-live.ts');
}

main().catch((err) => { console.error(err); process.exit(1); });
