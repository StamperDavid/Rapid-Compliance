/**
 * Persist Twitch account credentials to apiKeys/social.twitch and
 * mirror them to a social_accounts row for dashboard visibility.
 *
 * Reads from env so secrets don't appear in shell history:
 *   $env:TWITCH_CLIENT_ID="abc..."
 *   $env:TWITCH_CLIENT_SECRET="xyz..."
 *   $env:TWITCH_ACCESS_TOKEN="oauth:..."
 *   $env:TWITCH_REFRESH_TOKEN="..."           # optional; recommended
 *   $env:TWITCH_USER_ID="123456789"
 *   $env:TWITCH_LOGIN="salesvelocityai"
 *
 * Validates the access token by calling Helix `GET /users` BEFORE
 * writing, so we don't persist a stale or wrong-account credential.
 *
 * Apr 28 2026 dual-store rule: writes BOTH apiKeys (creds) AND
 * social_accounts (handle/display) so the Social Hub renders the
 * connection and posting can read the creds.
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

interface HelixUserResponse {
  data?: Array<{
    id?: string;
    login?: string;
    display_name?: string;
    profile_image_url?: string;
  }>;
}

initAdmin();

async function main(): Promise<void> {
  const clientId = process.env.TWITCH_CLIENT_ID;
  const clientSecret = process.env.TWITCH_CLIENT_SECRET;
  const accessToken = process.env.TWITCH_ACCESS_TOKEN;
  const refreshToken = process.env.TWITCH_REFRESH_TOKEN;
  const userId = process.env.TWITCH_USER_ID;
  const login = process.env.TWITCH_LOGIN;

  if (!clientId || !clientSecret || !accessToken || !userId || !login) {
    console.error(
      'Missing required env vars. Need: TWITCH_CLIENT_ID, TWITCH_CLIENT_SECRET, ' +
      'TWITCH_ACCESS_TOKEN, TWITCH_USER_ID, TWITCH_LOGIN. (TWITCH_REFRESH_TOKEN optional.)',
    );
    process.exit(1);
  }

  // Validate the access token + client_id pair by hitting Helix GET /users.
  // If the token is dead or doesn't match the login/userId we were given,
  // refuse to write. Helix requires BOTH Authorization: Bearer AND Client-Id.
  console.log(`Validating Twitch access token for login=${login}…`);
  const validateResp = await fetch('https://api.twitch.tv/helix/users', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Client-Id': clientId,
    },
  });

  if (!validateResp.ok) {
    const errText = await validateResp.text();
    console.error(`Twitch token validation failed: HTTP ${validateResp.status}`);
    console.error(errText.slice(0, 400));
    process.exit(2);
  }

  const validated = (await validateResp.json()) as HelixUserResponse;
  const user = validated.data?.[0];
  if (!user || !user.id || !user.login) {
    console.error('Helix /users returned no usable data — token may be wrong scope.');
    process.exit(3);
  }

  if (user.id !== userId) {
    console.error(
      `Helix returned user id=${user.id} but env TWITCH_USER_ID=${userId}. ` +
      `Refusing to write — fix the env value to match the token's actual broadcaster.`,
    );
    process.exit(4);
  }
  if (user.login.toLowerCase() !== login.toLowerCase()) {
    console.error(
      `Helix returned login=${user.login} but env TWITCH_LOGIN=${login}. ` +
      `Refusing to write — the access token does not match the supplied login.`,
    );
    process.exit(5);
  }

  console.log(`✓ Authenticated as ${user.login} (id=${user.id}, display=${user.display_name ?? user.login})`);

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();

  // --- 1) Write creds to apiKeys/social.twitch ----------------------------
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
        twitch: {
          clientId,
          clientSecret,
          accessToken,
          refreshToken: refreshToken ?? null,
          userId: user.id,
          login: user.login,
          displayName: user.display_name ?? user.login,
          profileImageUrl: user.profile_image_url ?? null,
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'save-twitch-config-script',
    },
    { merge: true },
  );

  console.log('✓ Saved apiKeys/social.twitch');
  console.log(`  client_id:    ${clientId.slice(0, 6)}...${clientId.slice(-4)}`);
  console.log(`  user_id:      ${user.id}`);
  console.log(`  login:        ${user.login}`);
  console.log(`  display:      ${user.display_name ?? user.login}`);
  console.log(`  access_token: ${accessToken.slice(0, 6)}...${accessToken.slice(-4)}`);

  // --- 2) Mirror to social_accounts row for dashboard ---------------------
  // Per project_social_accounts_dual_store_apr28.md: dashboard reads
  // social_accounts; posting reads apiKeys. Both must be present or the
  // hub shows "Not connected" even though posting works.
  const accountsRef = db.collection(`organizations/${PLATFORM_ID}/social_accounts`);
  const existingActive = await accountsRef
    .where('platform', '==', 'twitch')
    .where('status', '==', 'active')
    .limit(1)
    .get();

  if (existingActive.empty) {
    const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    await accountsRef.doc(accountId).set({
      id: accountId,
      platform: 'twitch',
      accountName: user.display_name ?? user.login,
      handle: user.login,
      profileImageUrl: user.profile_image_url ?? null,
      isDefault: true,
      status: 'active',
      credentials: { storedIn: 'apiKeys.social.twitch' },
      addedAt: new Date().toISOString(),
    });
    console.log(`✓ Created social_accounts/${accountId} for dashboard visibility`);
  } else {
    const existingId = existingActive.docs[0].id;
    await accountsRef.doc(existingId).set({
      accountName: user.display_name ?? user.login,
      handle: user.login,
      profileImageUrl: user.profile_image_url ?? null,
      lastUsedAt: new Date().toISOString(),
    }, { merge: true });
    console.log(`✓ Updated existing social_accounts/${existingId}`);
  }
}

main().catch((err) => { console.error(err); process.exit(1); });
