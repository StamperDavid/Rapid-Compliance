/**
 * Live test: post one real tweet from @salesvelocityai using OAuth 1.0a
 * User Context credentials saved in apiKeys/{PLATFORM_ID}/social.twitter.
 *
 * No mocks. Hits api.twitter.com/2/tweets directly.
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

const PLATFORM_ID = 'rapid-compliance-root';

interface OAuth1Creds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function percentEncode(s: string): string {
  return encodeURIComponent(s)
    .replace(/!/g, '%21')
    .replace(/\*/g, '%2A')
    .replace(/'/g, '%27')
    .replace(/\(/g, '%28')
    .replace(/\)/g, '%29');
}

function buildOAuthHeader(method: string, url: string, creds: OAuth1Creds): string {
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

  const baseString = [
    method.toUpperCase(),
    percentEncode(url),
    percentEncode(paramString),
  ].join('&');

  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessTokenSecret)}`;
  const signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  oauthParams.oauth_signature = signature;

  const headerParams = Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ');

  return `OAuth ${headerParams}`;
}

async function main(): Promise<void> {
  const db = admin.firestore();
  const apiKeysSnap = await db
    .collection(`organizations/${PLATFORM_ID}/apiKeys`)
    .doc(PLATFORM_ID)
    .get();
  if (!apiKeysSnap.exists) {
    console.error('apiKeys doc not found');
    process.exit(1);
  }
  const data = apiKeysSnap.data() as Record<string, unknown>;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const tw = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;

  const creds: OAuth1Creds = {
    consumerKey: String(tw.consumerKey ?? ''),
    consumerSecret: String(tw.consumerSecret ?? ''),
    accessToken: String(tw.accessToken ?? ''),
    accessTokenSecret: String(tw.accessTokenSecret ?? ''),
  };

  if (!creds.consumerKey || !creds.consumerSecret || !creds.accessToken || !creds.accessTokenSecret) {
    console.error('Missing OAuth 1.0a credentials in apiKeys/social.twitter');
    process.exit(2);
  }

  const tweetText = `[SalesVelocity.ai pipeline test ${new Date().toISOString()}] If you can read this, the X posting path is wired end-to-end.`;
  const url = 'https://api.twitter.com/2/tweets';
  const authHeader = buildOAuthHeader('POST', url, creds);

  console.log(`Posting test tweet via OAuth 1.0a User Context...`);
  console.log(`  text: ${tweetText}`);

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': authHeader,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: tweetText }),
  });

  const responseText = await response.text();
  console.log(`HTTP ${response.status}`);

  if (!response.ok) {
    console.error('FAIL — response body:');
    console.error(responseText);
    process.exit(3);
  }

  const result = JSON.parse(responseText) as { data?: { id?: string; text?: string } };
  if (result.data?.id) {
    console.log(`PASS — tweet id ${result.data.id}`);
    console.log(`https://x.com/salesvelocityai/status/${result.data.id}`);
    process.exit(0);
  }
  console.error('Unexpected response shape:', responseText);
  process.exit(4);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
