/**
 * One-shot: authorize the X brand account via OAuth 2.0 PKCE, save the
 * user-context tokens (with `dm.read offline.access` scope), and create
 * the X Activity API subscription for `dm.received` events on our
 * existing webhook.
 *
 * Why this exists: X's Account Activity API v1.1 / v2 webhook + classic
 * subscription endpoints accept OAuth 1.0a, but the new X Activity API
 * subscription product (the one the dev portal "Event subscriptions"
 * page manages) requires OAuth 2.0 user-context tokens with `dm.read`
 * scope. The dev portal form has no place to paste a token; X expects
 * you to call POST /2/account_activity/subscriptions with a Bearer
 * token in the Authorization header.
 *
 * Flow:
 *   1. Read clientId / clientSecret from Firestore apiKeys.
 *   2. Generate PKCE verifier + challenge.
 *   3. Print the X authorize URL — user clicks, logs in as the brand
 *      account, clicks Authorize.
 *   4. Local HTTP server on 127.0.0.1:53682 catches the redirect with
 *      ?code=… in the query.
 *   5. Exchange code for access_token + refresh_token.
 *   6. Save tokens to apiKeys/social.twitter.oauth2User.{accessToken,
 *      refreshToken, expiresAt}.
 *   7. Call POST /2/account_activity/subscriptions with the new
 *      access_token to create the dm.received subscription tied to the
 *      existing webhook id 2048240842830401536.
 *   8. Print the subscription id for audit.
 *
 * Prerequisite: in the X dev portal → your app → User authentication
 * settings → Callback URIs, add `http://127.0.0.1:53682/cb` and save.
 *
 * Usage:
 *   npx tsx scripts/authorize-x-and-subscribe-dm.ts
 */

/* eslint-disable no-console */

import * as admin from 'firebase-admin';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as path from 'path';
import * as http from 'http';
import { URL } from 'url';
import { exec } from 'child_process';

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
const REDIRECT_URI = 'http://127.0.0.1:53682/cb';
const CALLBACK_PORT = 53682;
const WEBHOOK_ID = '2048240842830401536';
const SCOPES = ['dm.read', 'tweet.read', 'users.read', 'offline.access'].join(' ');

function base64UrlEncode(buf: Buffer): string {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

function generatePkcePair(): { verifier: string; challenge: string } {
  const verifier = base64UrlEncode(crypto.randomBytes(48));
  const challenge = base64UrlEncode(crypto.createHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

interface ClientCreds { clientId: string; clientSecret: string }

async function loadClient(): Promise<ClientCreds> {
  const db = admin.firestore();
  const snap = await db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  const tw = ((snap.data()?.social as Record<string, unknown> | undefined)?.twitter ?? {}) as Record<string, unknown>;
  const clientId = String(tw.clientId ?? '');
  const clientSecret = String(tw.clientSecret ?? '');
  if (!clientId || !clientSecret) { throw new Error('clientId / clientSecret missing in apiKeys/social.twitter'); }
  return { clientId, clientSecret };
}

interface TokenResponse {
  token_type: string;
  expires_in: number;
  access_token: string;
  refresh_token?: string;
  scope: string;
}

async function exchangeCodeForTokens(code: string, verifier: string, client: ClientCreds): Promise<TokenResponse> {
  const tokenUrl = 'https://api.x.com/2/oauth2/token';
  const basic = Buffer.from(`${client.clientId}:${client.clientSecret}`).toString('base64');
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: REDIRECT_URI,
    code_verifier: verifier,
    client_id: client.clientId,
  });
  const resp = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  const text = await resp.text();
  if (!resp.ok) {
    throw new Error(`Token exchange failed: HTTP ${resp.status} — ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as TokenResponse;
}

async function saveTokens(tokens: TokenResponse): Promise<void> {
  const db = admin.firestore();
  const docRef = db.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID);
  const snap = await docRef.get();
  const data = snap.exists ? (snap.data() as Record<string, unknown>) : {};
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const twitter = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();
  const oauth2User = {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    scope: tokens.scope,
    expiresAt,
    issuedAt: new Date().toISOString(),
  };
  await docRef.set(
    {
      social: {
        ...social,
        twitter: { ...twitter, oauth2User },
      },
      updatedAt: new Date().toISOString(),
      updatedBy: 'authorize-x-and-subscribe-dm-script',
    },
    { merge: true },
  );
  console.log(`✓ Saved oauth2User tokens. expiresAt=${expiresAt}, refreshable=${tokens.refresh_token ? 'yes' : 'no'}`);
}

interface SubscriptionResponse {
  data?: { id?: string; event_type?: string; webhook_id?: string };
  errors?: Array<{ message: string; title?: string }>;
}

async function createDmReceivedSubscription(accessToken: string): Promise<SubscriptionResponse> {
  const url = 'https://api.x.com/2/account_activity/subscriptions';
  const body = {
    event_type: 'dm.received',
    filter: { direction: 'inbound' },
    webhook_id: WEBHOOK_ID,
  };
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  const text = await resp.text();
  console.log(`POST ${url} → HTTP ${resp.status}`);
  console.log(text);
  if (!resp.ok) {
    throw new Error(`Create subscription failed: ${text.slice(0, 500)}`);
  }
  return JSON.parse(text) as SubscriptionResponse;
}

async function main(): Promise<void> {
  const client = await loadClient();
  const { verifier, challenge } = generatePkcePair();
  const state = base64UrlEncode(crypto.randomBytes(16));

  const authUrl = new URL('https://x.com/i/oauth2/authorize');
  authUrl.searchParams.set('response_type', 'code');
  authUrl.searchParams.set('client_id', client.clientId);
  authUrl.searchParams.set('redirect_uri', REDIRECT_URI);
  authUrl.searchParams.set('scope', SCOPES);
  authUrl.searchParams.set('state', state);
  authUrl.searchParams.set('code_challenge', challenge);
  authUrl.searchParams.set('code_challenge_method', 'S256');

  console.log('\n===========================================================');
  console.log('1. Make sure http://127.0.0.1:53682/cb is in your X app\'s Callback URI list.');
  console.log('2. Open the URL below in a browser logged in as @salesveloc42339:');
  console.log('');
  console.log(authUrl.toString());
  console.log('===========================================================\n');

  // Try to auto-open the URL on Windows / macOS / Linux. Best effort.
  const opener = process.platform === 'win32' ? 'start ""'
    : process.platform === 'darwin' ? 'open'
    : 'xdg-open';
  exec(`${opener} "${authUrl.toString()}"`, () => { /* no-op */ });

  // Wait for callback
  const code = await new Promise<string>((resolve, reject) => {
    const server = http.createServer((req, res) => {
      try {
        const reqUrl = new URL(req.url ?? '/', `http://127.0.0.1:${CALLBACK_PORT}`);
        if (reqUrl.pathname !== '/cb') {
          res.writeHead(404).end();
          return;
        }
        const errorParam = reqUrl.searchParams.get('error');
        if (errorParam) {
          const desc = reqUrl.searchParams.get('error_description') ?? '';
          res.writeHead(400, { 'Content-Type': 'text/html' }).end(`<h1>OAuth error</h1><p>${errorParam}: ${desc}</p>`);
          server.close();
          reject(new Error(`OAuth error: ${errorParam} ${desc}`));
          return;
        }
        const returnedState = reqUrl.searchParams.get('state');
        if (returnedState !== state) {
          res.writeHead(400, { 'Content-Type': 'text/html' }).end('<h1>State mismatch</h1>');
          server.close();
          reject(new Error('OAuth state mismatch'));
          return;
        }
        const codeParam = reqUrl.searchParams.get('code');
        if (!codeParam) {
          res.writeHead(400, { 'Content-Type': 'text/html' }).end('<h1>No code returned</h1>');
          server.close();
          reject(new Error('No code in callback'));
          return;
        }
        res.writeHead(200, { 'Content-Type': 'text/html' }).end(
          '<h1>Authorized.</h1><p>You can close this tab. The script is finishing the rest.</p>',
        );
        server.close();
        resolve(codeParam);
      } catch (err) {
        try { res.writeHead(500).end(); } catch { /* noop */ }
        server.close();
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
    server.listen(CALLBACK_PORT, '127.0.0.1', () => {
      console.log(`Listening on ${REDIRECT_URI} for the OAuth callback...`);
    });
    setTimeout(() => {
      server.close();
      reject(new Error('Timed out waiting for OAuth callback (5 min)'));
    }, 5 * 60 * 1000);
  });

  console.log('\n✓ Got authorization code. Exchanging for tokens...');
  const tokens = await exchangeCodeForTokens(code, verifier, client);
  console.log(`✓ Tokens received. scope="${tokens.scope}", expires_in=${tokens.expires_in}s`);
  await saveTokens(tokens);

  console.log('\nCreating dm.received subscription tied to webhook ' + WEBHOOK_ID + '...');
  const sub = await createDmReceivedSubscription(tokens.access_token);
  if (sub.data?.id) {
    console.log(`✓ Subscription created. id=${sub.data.id} event_type=${sub.data.event_type ?? 'dm.received'}`);
  } else {
    console.log('Subscription response (no id field — review above output):', sub);
  }

  console.log('\nDone. Send a fresh DM to @salesveloc42339 — events should fire within seconds.');
  process.exit(0);
}

main().catch((err) => { console.error('authorize-x-and-subscribe-dm failed:', err); process.exit(1); });
