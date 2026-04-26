/**
 * Persist X / Twitter OAuth 2.0 client credentials to Firestore apiKeys.
 * Reads from env vars so secrets never appear in shell history:
 *   $env:TWITTER_CLIENT_ID="..."
 *   $env:TWITTER_CLIENT_SECRET="..."
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as path from 'path';
import * as fs from 'fs';

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
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
