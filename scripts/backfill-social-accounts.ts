/**
 * Backfill `social_accounts` rows from existing `apiKeys.social.*` data.
 *
 * Background: credentials for Bluesky / Mastodon / X were saved to
 * `apiKeys.social.{platform}` via the save-*-config.ts scripts. The
 * dashboard reads connection status from the separate `social_accounts`
 * collection — those rows were never created, so the Social Hub shows
 * every brand-connected platform as "Not connected" even though posting
 * works end-to-end.
 *
 * This script reads the current apiKeys doc, derives what handle / acct
 * each platform is bound to, and writes one `social_accounts` row per
 * connected platform. Idempotent: skips platforms that already have an
 * active row.
 *
 * Posting code keeps reading from apiKeys (no migration). The
 * social_accounts row's `credentials` field stores a marker so the
 * canonical creds aren't duplicated.
 *
 * Run once after credentials are saved. The save-*-config.ts scripts
 * have been patched to also write social_accounts going forward, so
 * this backfill is only needed for already-saved credentials.
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';

// -----------------------------------------------------------------------------
// Setup
// -----------------------------------------------------------------------------

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
  if (!fs.existsSync(sakPath)) { throw new Error('No serviceAccountKey.json'); }
  const sa = JSON.parse(fs.readFileSync(sakPath, 'utf-8')) as admin.ServiceAccount;
  admin.initializeApp({ credential: admin.credential.cert(sa) });
}

initAdmin();

const PLATFORM_ID = 'rapid-compliance-root';
const db = admin.firestore();
const apiKeysRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
const socialAccountsCollection = db.collection(`organizations/${PLATFORM_ID}/social_accounts`);

// -----------------------------------------------------------------------------
// Twitter OAuth 1.0a — minimal verify_credentials helper
// -----------------------------------------------------------------------------

interface TwitterCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function percentEncode(value: string): string {
  return encodeURIComponent(value)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function buildOAuth1Header(method: string, url: string, creds: TwitterCreds): string {
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

interface TwitterProfile {
  screenName: string;
  name: string;
  profileImageUrlHttps?: string;
  userId: string;
}

async function fetchTwitterProfile(creds: TwitterCreds): Promise<TwitterProfile | null> {
  const url = 'https://api.twitter.com/1.1/account/verify_credentials.json';
  const auth = buildOAuth1Header('GET', url, creds);
  const resp = await fetch(url, { headers: { Authorization: auth } });
  if (!resp.ok) {
    console.error(`  Twitter verify_credentials failed: HTTP ${resp.status}`);
    console.error(`  ${(await resp.text()).slice(0, 300)}`);
    return null;
  }
  const data = await resp.json() as {
    id_str?: string;
    screen_name?: string;
    name?: string;
    profile_image_url_https?: string;
  };
  if (!data.id_str || !data.screen_name) { return null; }
  return {
    userId: data.id_str,
    screenName: data.screen_name,
    name: data.name ?? data.screen_name,
    profileImageUrlHttps: data.profile_image_url_https,
  };
}

// -----------------------------------------------------------------------------
// Backfill helpers
// -----------------------------------------------------------------------------

type SocialPlatformId = 'bluesky' | 'mastodon' | 'twitter';

interface BackfillRow {
  platform: SocialPlatformId;
  accountName: string;
  handle: string;
  profileImageUrl?: string;
}

async function existingActiveAccountId(platform: SocialPlatformId): Promise<string | null> {
  const snap = await socialAccountsCollection
    .where('platform', '==', platform)
    .where('status', '==', 'active')
    .limit(1)
    .get();
  return snap.empty ? null : snap.docs[0].id;
}

async function writeSocialAccount(row: BackfillRow): Promise<void> {
  const accountId = `social-acct-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
  const doc = {
    id: accountId,
    platform: row.platform,
    accountName: row.accountName,
    handle: row.handle,
    ...(row.profileImageUrl ? { profileImageUrl: row.profileImageUrl } : {}),
    isDefault: true,
    status: 'active' as const,
    // Canonical credentials live in apiKeys.social.{platform} — referenced
    // here as a pointer so the dashboard knows the account is connected
    // without duplicating secrets.
    credentials: { storedIn: `apiKeys.social.${row.platform}` },
    addedAt: new Date().toISOString(),
  };
  await socialAccountsCollection.doc(accountId).set(doc);
  console.log(`  ✓ Wrote social_accounts/${accountId} for ${row.platform} (${row.handle})`);
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main(): Promise<void> {
  console.log('Reading apiKeys for platform credentials...');
  const snap = await apiKeysRef.get();
  if (!snap.exists) {
    console.error(`apiKeys doc does not exist at organizations/${PLATFORM_ID}/apiKeys/${PLATFORM_ID}`);
    process.exit(1);
  }
  const data = snap.data() ?? {};
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;

  let backfilled = 0;
  let skipped = 0;

  // ---------- Bluesky ----------
  const bluesky = (social.bluesky && typeof social.bluesky === 'object'
    ? social.bluesky
    : null) as Record<string, unknown> | null;
  if (bluesky?.handle || bluesky?.identifier) {
    const handle = String(bluesky.handle ?? bluesky.identifier);
    const existing = await existingActiveAccountId('bluesky');
    if (existing) {
      console.log(`Bluesky already has active social_accounts row (${existing}) — skipping`);
      skipped++;
    } else {
      console.log(`Bluesky: backfilling for handle "${handle}"`);
      await writeSocialAccount({ platform: 'bluesky', accountName: handle, handle });
      backfilled++;
    }
  } else {
    console.log('Bluesky: no credentials in apiKeys.social.bluesky — skipping');
  }

  // ---------- Mastodon ----------
  const mastodon = (social.mastodon && typeof social.mastodon === 'object'
    ? social.mastodon
    : null) as Record<string, unknown> | null;
  if (mastodon?.acct) {
    const acct = String(mastodon.acct);
    const instanceUrl = String(mastodon.instanceUrl ?? 'https://mastodon.social');
    const instanceHost = (() => {
      try { return new URL(instanceUrl).host; } catch { return 'mastodon.social'; }
    })();
    // Fully-qualified handle includes the instance — matches what users see in DMs/mentions.
    const handle = acct.includes('@') ? acct : `${acct}@${instanceHost}`;
    const existing = await existingActiveAccountId('mastodon');
    if (existing) {
      console.log(`Mastodon already has active social_accounts row (${existing}) — skipping`);
      skipped++;
    } else {
      console.log(`Mastodon: backfilling for handle "${handle}"`);
      await writeSocialAccount({ platform: 'mastodon', accountName: handle, handle });
      backfilled++;
    }
  } else {
    console.log('Mastodon: no credentials in apiKeys.social.mastodon — skipping');
  }

  // ---------- Twitter / X ----------
  const twitter = (social.twitter && typeof social.twitter === 'object'
    ? social.twitter
    : null) as Record<string, unknown> | null;
  if (twitter?.consumerKey && twitter?.consumerSecret && twitter?.accessToken && twitter?.accessTokenSecret) {
    const existing = await existingActiveAccountId('twitter');
    if (existing) {
      console.log(`Twitter already has active social_accounts row (${existing}) — skipping`);
      skipped++;
    } else {
      const creds: TwitterCreds = {
        consumerKey: String(twitter.consumerKey),
        consumerSecret: String(twitter.consumerSecret),
        accessToken: String(twitter.accessToken),
        accessTokenSecret: String(twitter.accessTokenSecret),
      };
      console.log('Twitter: fetching profile via /1.1/account/verify_credentials.json...');
      const profile = await fetchTwitterProfile(creds);
      if (!profile) {
        console.error('Twitter: profile fetch failed — skipping (creds invalid?)');
      } else {
        console.log(`Twitter: backfilling for @${profile.screenName} (id=${profile.userId})`);
        await writeSocialAccount({
          platform: 'twitter',
          accountName: profile.name,
          handle: `@${profile.screenName}`,
          profileImageUrl: profile.profileImageUrlHttps,
        });
        backfilled++;

        // Stash the resolved userId back into apiKeys.social.twitter.brandUserId
        // for downstream uses (DM service, webhook routing). Idempotent.
        if (typeof twitter.brandUserId !== 'string' || twitter.brandUserId !== profile.userId) {
          await apiKeysRef.set({
            social: {
              ...social,
              twitter: { ...twitter, brandUserId: profile.userId },
            },
            updatedAt: new Date().toISOString(),
            updatedBy: 'backfill-social-accounts-script',
          }, { merge: true });
          console.log(`  ✓ Stamped brandUserId=${profile.userId} on apiKeys.social.twitter`);
        }
      }
    }
  } else {
    console.log('Twitter: no OAuth 1.0a credentials in apiKeys.social.twitter — skipping');
  }

  console.log('');
  console.log(`Done. Backfilled: ${backfilled}. Already-present (skipped): ${skipped}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
