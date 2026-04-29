/**
 * Persist X / Twitter OAuth 2.0 client credentials to Firestore apiKeys.
 * Reads from env vars so secrets never appear in shell history:
 *   $env:TWITTER_CLIENT_ID="..."
 *   $env:TWITTER_CLIENT_SECRET="..."
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as path from 'path';
import * as fs from 'fs';

// -----------------------------------------------------------------------------
// OAuth 1.0a signing helpers (inlined — same shape as twitter-dm-service.ts)
// -----------------------------------------------------------------------------

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function buildOAuth1Header(method: string, url: string, creds: {
  consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string;
}): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  const paramString = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(oauthParams[k])}`)
    .join('&');
  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessTokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  return `OAuth ${Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ')}`;
}

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
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    console.error('TWITTER_CLIENT_ID and TWITTER_CLIENT_SECRET env vars required');
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

  const consumerKey = process.env.TWITTER_CONSUMER_KEY;
  const consumerSecret = process.env.TWITTER_CONSUMER_SECRET;
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;

  const existingTwitter = (existingSocial.twitter && typeof existingSocial.twitter === 'object'
    ? (existingSocial.twitter as Record<string, unknown>)
    : {}) as Record<string, unknown>;

  const updatedSocial = {
    ...existingSocial,
    twitter: {
      ...existingTwitter,
      clientId,
      clientSecret,
      callbackUrl: 'https://www.salesvelocity.ai/api/integrations/oauth/twitter/callback',
      ...(consumerKey ? { consumerKey } : {}),
      ...(consumerSecret ? { consumerSecret } : {}),
      ...(accessToken ? { accessToken } : {}),
      ...(accessTokenSecret ? { accessTokenSecret } : {}),
    },
  };

  const now = new Date().toISOString();
  await docRef.set(
    {
      social: updatedSocial,
      updatedAt: now,
      updatedBy: 'save-twitter-config-script',
      ...(snap.exists ? {} : { createdAt: now }),
    },
    { merge: true },
  );

  console.log('Twitter OAuth config saved');
  console.log(`  clientId:          ${clientId.slice(0, 6)}...${clientId.slice(-4)}`);
  console.log(`  clientSecret:      ${clientSecret.slice(0, 6)}...${clientSecret.slice(-4)}`);
  if (consumerKey) { console.log(`  consumerKey:       ${consumerKey.slice(0, 6)}...${consumerKey.slice(-4)}`); }
  if (consumerSecret) { console.log(`  consumerSecret:    ${consumerSecret.slice(0, 6)}...${consumerSecret.slice(-4)}`); }
  if (accessToken) { console.log(`  accessToken:       ${accessToken.slice(0, 6)}...${accessToken.slice(-4)}`); }
  if (accessTokenSecret) { console.log(`  accessTokenSecret: ${accessTokenSecret.slice(0, 6)}...${accessTokenSecret.slice(-4)}`); }

  // Also write/update the social_accounts row that the dashboard reads.
  // Without this, the Social Hub shows Twitter/X as "Not connected" even
  // though tweets + OAuth 1.0a DMs work end-to-end. Requires OAuth 1.0a
  // user-context creds to fetch the handle via /1.1/account/verify_credentials.json.
  if (consumerKey && consumerSecret && accessToken && accessTokenSecret) {
    const verifyUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json';
    const auth = buildOAuth1Header('GET', verifyUrl, { consumerKey, consumerSecret, accessToken, accessTokenSecret });
    let profile: { id_str?: string; screen_name?: string; name?: string; profile_image_url_https?: string } | null = null;
    try {
      const resp = await fetch(verifyUrl, { headers: { Authorization: auth } });
      if (resp.ok) {
        profile = await resp.json() as typeof profile;
      } else {
        console.warn(`  Twitter verify_credentials returned HTTP ${resp.status}; skipping social_accounts write`);
      }
    } catch (err) {
      console.warn(`  Twitter verify_credentials failed: ${err instanceof Error ? err.message : String(err)}; skipping social_accounts write`);
    }

    if (profile?.id_str && profile.screen_name) {
      // Stamp brandUserId on apiKeys for downstream uses (DM service, webhook routing)
      await docRef.set({
        social: {
          ...updatedSocial,
          twitter: { ...updatedSocial.twitter, brandUserId: profile.id_str },
        },
        updatedAt: new Date().toISOString(),
        updatedBy: 'save-twitter-config-script',
      }, { merge: true });
      console.log(`  ✓ Stamped brandUserId=${profile.id_str} on apiKeys.social.twitter`);

      const handle = `@${profile.screen_name}`;
      const accountsRef = db.collection(`organizations/${PLATFORM_ID}/social_accounts`);
      const existingActive = await accountsRef
        .where('platform', '==', 'twitter')
        .where('status', '==', 'active')
        .limit(1)
        .get();
      if (existingActive.empty) {
        const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        await accountsRef.doc(accountId).set({
          id: accountId,
          platform: 'twitter',
          accountName: profile.name ?? profile.screen_name,
          handle,
          ...(profile.profile_image_url_https ? { profileImageUrl: profile.profile_image_url_https } : {}),
          isDefault: true,
          status: 'active',
          credentials: { storedIn: 'apiKeys.social.twitter' },
          addedAt: new Date().toISOString(),
        });
        console.log(`✓ Created social_accounts/${accountId} for dashboard visibility (${handle})`);
      } else {
        const existingId = existingActive.docs[0].id;
        await accountsRef.doc(existingId).set({
          accountName: profile.name ?? profile.screen_name,
          handle,
          ...(profile.profile_image_url_https ? { profileImageUrl: profile.profile_image_url_https } : {}),
          lastUsedAt: new Date().toISOString(),
        }, { merge: true });
        console.log(`✓ Updated existing social_accounts/${existingId} (${handle})`);
      }
    }
  } else {
    console.log('  (OAuth 1.0a creds not provided — social_accounts row will be created next time you save with consumer/access tokens)');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
