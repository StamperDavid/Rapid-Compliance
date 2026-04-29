/**
 * Persist Mastodon / Mastodon-instance credentials to
 * apiKeys/social.mastodon.
 *
 * Reads from env so secrets don't appear in shell history:
 *   $env:MASTODON_ACCESS_TOKEN="<bearer token from /oauth/token>"
 *   $env:MASTODON_INSTANCE_URL="https://mastodon.social"   # optional, defaults
 *
 * Mastodon-family OAuth flow to obtain the token (one-time):
 *   1. POST /api/v1/apps with redirect_uris=urn:ietf:wg:oauth:2.0:oob and
 *      scopes='read write' to register the brand's client app.
 *      The response includes client_id + client_secret.
 *   2. Direct the brand operator to:
 *      `${INSTANCE}/oauth/authorize?response_type=code&client_id=${ID}` +
 *      `&redirect_uri=urn:ietf:wg:oauth:2.0:oob&scope=read+write`
 *      They log in, authorize, and copy back the auth code shown.
 *   3. POST /oauth/token with grant_type=authorization_code, the code,
 *      client_id, client_secret, and redirect_uri. Response includes
 *      access_token. Use that as MASTODON_ACCESS_TOKEN here.
 *
 * The token does NOT expire on Mastodon-family servers (long-lived
 * unless revoked from the brand's account settings), so this is a
 * one-time setup until the brand revokes the app.
 *
 * After saving, validate by running scripts/verify-mastodon-dm-live.ts
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
  const accessToken = process.env.MASTODON_ACCESS_TOKEN;
  const instanceUrl = process.env.MASTODON_INSTANCE_URL ?? 'https://mastodon.social';
  if (!accessToken) {
    console.error('MASTODON_ACCESS_TOKEN env var required');
    console.error('See script header for the OAuth flow that produces this token.');
    process.exit(1);
  }

  // Validate the token against the instance BEFORE writing it.
  console.log(`Validating token against ${instanceUrl}...`);
  const verifyResp = await fetch(`${instanceUrl}/api/v1/accounts/verify_credentials`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!verifyResp.ok) {
    const errText = await verifyResp.text();
    console.error(`Mastodon auth failed: HTTP ${verifyResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }
  const profile = await verifyResp.json() as {
    id?: string;
    username?: string;
    acct?: string;
    display_name?: string;
    followers_count?: number;
  };
  if (!profile.id) {
    console.error('Mastodon profile missing id field');
    process.exit(3);
  }
  console.log(`✓ Authenticated as @${profile.acct ?? profile.username} (id=${profile.id})`);
  console.log(`  display_name:    ${profile.display_name ?? '(none)'}`);
  console.log(`  followers_count: ${profile.followers_count ?? 0}`);

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
        mastodon: {
          accessToken,
          instanceUrl,
          accountId: profile.id,
          acct: profile.acct ?? profile.username ?? null,
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'save-mastodon-config-script',
    },
    { merge: true },
  );

  console.log('✓ Saved apiKeys/social.mastodon');
  console.log(`  instanceUrl: ${instanceUrl}`);
  console.log(`  accountId:   ${profile.id}`);
  console.log(`  acct:        ${profile.acct ?? profile.username}`);
  console.log(`  accessToken: ${accessToken.slice(0, 6)}...${accessToken.slice(-4)}`);

  // Also write/update the social_accounts row that the dashboard reads.
  // Without this the Social Hub shows Mastodon as "Not connected" even
  // though posting + DMs work. Idempotent.
  const acctLocal = profile.acct ?? profile.username ?? '';
  const instanceHost = (() => {
    try { return new URL(instanceUrl).host; } catch { return 'mastodon.social'; }
  })();
  const fullHandle = acctLocal.includes('@') ? acctLocal : `${acctLocal}@${instanceHost}`;
  const displayName = profile.display_name ?? acctLocal;
  const accountsRef = db.collection(`organizations/${PLATFORM_ID}/social_accounts`);
  const existingActive = await accountsRef
    .where('platform', '==', 'mastodon')
    .where('status', '==', 'active')
    .limit(1)
    .get();
  if (existingActive.empty) {
    const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await accountsRef.doc(accountId).set({
      id: accountId,
      platform: 'mastodon',
      accountName: displayName || fullHandle,
      handle: fullHandle,
      isDefault: true,
      status: 'active',
      credentials: { storedIn: 'apiKeys.social.mastodon' },
      addedAt: new Date().toISOString(),
    });
    console.log(`✓ Created social_accounts/${accountId} for dashboard visibility`);
  } else {
    const existingId = existingActive.docs[0].id;
    await accountsRef.doc(existingId).set({
      accountName: displayName || fullHandle,
      handle: fullHandle,
      lastUsedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`✓ Updated existing social_accounts/${existingId}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
