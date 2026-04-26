/**
 * Rotate just the OAuth 1.0a Access Token + Secret for the X / Twitter
 * integration. Used after regenerating the access token in the X dev
 * portal. Consumer key/secret stay unchanged.
 *
 * Usage:
 *   $env:TWITTER_ACCESS_TOKEN="..."
 *   $env:TWITTER_ACCESS_TOKEN_SECRET="..."
 *   npx tsx scripts/rotate-twitter-access-token.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';
import * as crypto from 'crypto';

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

function pe(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function buildOAuth1(method: string, url: string, c: { consumerKey: string; consumerSecret: string; accessToken: string; accessTokenSecret: string }): string {
  const o: Record<string, string> = {
    oauth_consumer_key: c.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: c.accessToken,
    oauth_version: '1.0',
  };
  const ps = Object.keys(o).sort().map(k => `${pe(k)}=${pe(o[k])}`).join('&');
  const base = [method.toUpperCase(), pe(url), pe(ps)].join('&');
  o.oauth_signature = crypto.createHmac('sha1', `${pe(c.consumerSecret)}&${pe(c.accessTokenSecret)}`).update(base).digest('base64');
  return `OAuth ${Object.keys(o).sort().map(k => `${pe(k)}="${pe(o[k])}"`).join(', ')}`;
}

async function main(): Promise<void> {
  const accessToken = process.env.TWITTER_ACCESS_TOKEN;
  const accessTokenSecret = process.env.TWITTER_ACCESS_TOKEN_SECRET;
  if (!accessToken || !accessTokenSecret) {
    console.error('TWITTER_ACCESS_TOKEN and TWITTER_ACCESS_TOKEN_SECRET env vars required');
    process.exit(1);
  }

  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const twitter = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const consumerKey = String(twitter.consumerKey ?? '');
  const consumerSecret = String(twitter.consumerSecret ?? '');
  if (!consumerKey || !consumerSecret) {
    console.error('consumerKey/consumerSecret missing from existing apiKeys — cannot continue');
    process.exit(2);
  }

  // 1. Verify the new tokens auth correctly BEFORE writing them to Firestore.
  console.log('Verifying new tokens via /1.1/account/verify_credentials...');
  const verifyUrl = 'https://api.twitter.com/1.1/account/verify_credentials.json';
  const verifyResp = await fetch(verifyUrl, {
    headers: { Authorization: buildOAuth1('GET', verifyUrl, { consumerKey, consumerSecret, accessToken, accessTokenSecret }) },
  });
  const verifyText = await verifyResp.text();
  if (!verifyResp.ok) {
    console.error(`verify_credentials returned HTTP ${verifyResp.status}:`);
    console.error(verifyText);
    process.exit(3);
  }
  const verified = JSON.parse(verifyText) as { id_str?: string; screen_name?: string; name?: string };
  console.log(`✓ Tokens authenticate as @${verified.screen_name} (id ${verified.id_str}, name "${verified.name}")`);

  // 2. Write to Firestore via merge (only the two fields we're rotating).
  await docRef.set(
    {
      social: {
        ...social,
        twitter: {
          ...twitter,
          accessToken,
          accessTokenSecret,
        },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'rotate-twitter-access-token-script',
    },
    { merge: true },
  );

  console.log('✓ Wrote new tokens to apiKeys/social.twitter');
  console.log(`  accessToken:       ${accessToken.slice(0, 8)}...${accessToken.slice(-4)}`);
  console.log(`  accessTokenSecret: ${accessTokenSecret.slice(0, 6)}...${accessTokenSecret.slice(-4)}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
