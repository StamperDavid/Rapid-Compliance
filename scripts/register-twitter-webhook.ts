/**
 * Register our X webhook URL + subscribe @salesvelocityai to the
 * Account Activity stream. One-shot setup — run once after the webhook
 * endpoint is deployed and reachable on https.
 *
 * Steps:
 *   1. POST https://api.x.com/2/webhooks  → registers the URL,
 *      X immediately fires a CRC GET to confirm we own it. Returns
 *      webhook_id on success.
 *   2. POST https://api.x.com/2/account_activity/webhooks/{webhook_id}/subscriptions/all
 *      → subscribes the brand account so we receive events.
 *
 * Env required:
 *   TWITTER_WEBHOOK_URL = https://www.salesvelocity.ai/api/webhooks/twitter
 *
 * All credentials come from Firestore apiKeys. Bearer Token is
 * generated on demand from consumerKey + consumerSecret.
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

interface TwitterCreds {
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

function buildOAuth1Header(method: string, url: string, creds: TwitterCreds, queryParams: Record<string, string> = {}): string {
  const oauthParams: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };

  const allParams = { ...oauthParams, ...queryParams };
  const paramString = Object.keys(allParams)
    .sort()
    .map((k) => `${percentEncode(k)}=${percentEncode(allParams[k])}`)
    .join('&');
  const baseString = [method.toUpperCase(), percentEncode(url), percentEncode(paramString)].join('&');
  const signingKey = `${percentEncode(creds.consumerSecret)}&${percentEncode(creds.accessTokenSecret)}`;
  oauthParams.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');

  return `OAuth ${Object.keys(oauthParams)
    .sort()
    .map((k) => `${percentEncode(k)}="${percentEncode(oauthParams[k])}"`)
    .join(', ')}`;
}

async function getBearerToken(consumerKey: string, consumerSecret: string): Promise<string> {
  const credentials = Buffer.from(`${percentEncode(consumerKey)}:${percentEncode(consumerSecret)}`).toString('base64');
  const response = await fetch('https://api.twitter.com/oauth2/token', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${credentials}`,
      'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8',
    },
    body: 'grant_type=client_credentials',
  });
  if (!response.ok) {
    throw new Error(`Bearer token request failed: HTTP ${response.status} ${await response.text()}`);
  }
  const data = await response.json() as { access_token?: string; token_type?: string };
  if (!data.access_token) {
    throw new Error('Bearer token response missing access_token');
  }
  return data.access_token;
}

async function loadCreds(): Promise<TwitterCreds> {
  const PLATFORM_ID = 'rapid-compliance-root';
  const db = admin.firestore();
  const snap = await db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  if (!snap.exists) { throw new Error('apiKeys doc not found'); }
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const tw = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const creds: TwitterCreds = {
    consumerKey: String(tw.consumerKey ?? ''),
    consumerSecret: String(tw.consumerSecret ?? ''),
    accessToken: String(tw.accessToken ?? ''),
    accessTokenSecret: String(tw.accessTokenSecret ?? ''),
  };
  for (const k of Object.keys(creds) as Array<keyof TwitterCreds>) {
    if (!creds[k]) { throw new Error(`Missing twitter credential: ${k}`); }
  }
  return creds;
}

async function main(): Promise<void> {
  const webhookUrl = process.env.TWITTER_WEBHOOK_URL;
  if (!webhookUrl || !webhookUrl.startsWith('https://')) {
    console.error('TWITTER_WEBHOOK_URL env var must be set to an https URL');
    process.exit(1);
  }

  const creds = await loadCreds();
  console.log('Loaded credentials');

  // Step 1 — register the webhook URL. X immediately fires a CRC GET
  // to the URL to verify we control it. Our route handles that.
  console.log(`Registering webhook URL: ${webhookUrl}`);
  const bearerToken = await getBearerToken(creds.consumerKey, creds.consumerSecret);
  const registerResp = await fetch('https://api.x.com/2/webhooks', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${bearerToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ url: webhookUrl }),
  });
  const registerText = await registerResp.text();
  console.log(`HTTP ${registerResp.status} from POST /2/webhooks`);
  if (!registerResp.ok) {
    console.error('Webhook registration failed. Response:');
    console.error(registerText);
    process.exit(2);
  }
  const registerData = JSON.parse(registerText) as { data?: { id?: string; valid?: boolean } };
  const webhookId = registerData.data?.id;
  if (!webhookId) {
    console.error('Registration response missing webhook id:', registerText);
    process.exit(3);
  }
  console.log(`Webhook registered. id=${webhookId}`);

  // Step 2 — subscribe the brand account so we receive its events.
  // This call is OAuth 1.0a User Context (the user being subscribed
  // is the access token's owner, i.e. @salesvelocityai).
  const subscribeUrl = `https://api.x.com/2/account_activity/webhooks/${webhookId}/subscriptions/all`;
  console.log(`Subscribing brand account to webhook ${webhookId}...`);
  const subscribeResp = await fetch(subscribeUrl, {
    method: 'POST',
    headers: {
      'Authorization': buildOAuth1Header('POST', subscribeUrl, creds),
      'Content-Type': 'application/json',
    },
  });
  const subscribeText = await subscribeResp.text();
  console.log(`HTTP ${subscribeResp.status} from POST subscriptions/all`);
  if (!subscribeResp.ok) {
    console.error('Subscription failed. Response:');
    console.error(subscribeText);
    process.exit(4);
  }
  console.log('Subscription created.');
  console.log('');
  console.log(`Webhook id ${webhookId} is live and @salesvelocityai is subscribed.`);
  console.log('Test by sending a DM to @salesvelocityai — within ~10s an event should land in the inboundSocialEvents collection.');
}

main().catch((err) => {
  console.error('register-twitter-webhook failed:', err);
  process.exit(1);
});
