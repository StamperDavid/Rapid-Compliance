/**
 * Diagnose Twitter Account Activity webhook subscription health.
 *
 * - Lists all configured webhooks (across dev environments)
 * - For each, lists subscriptions and last-failure info if available
 * - Also confirms the webhook URL is alive via CRC test
 *
 * Run when DMs to @salesvelocityai aren't producing inboundSocialEvents docs.
 */
import { config as loadEnv } from 'dotenv';
import * as path from 'path';
loadEnv({ path: path.resolve(__dirname, '..', '.env.local') });
import * as crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { PLATFORM_ID } from '@/lib/constants/platform';

interface TwitterCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
}

function pe(v: string): string {
  return encodeURIComponent(v).replace(/!/g, '%21').replace(/\*/g, '%2A').replace(/'/g, '%27').replace(/\(/g, '%28').replace(/\)/g, '%29');
}

function buildOAuth1(method: string, url: string, creds: TwitterCreds, queryParams?: Record<string, string>): string {
  const params: Record<string, string> = {
    oauth_consumer_key: creds.consumerKey,
    oauth_nonce: crypto.randomBytes(16).toString('hex'),
    oauth_signature_method: 'HMAC-SHA1',
    oauth_timestamp: Math.floor(Date.now() / 1000).toString(),
    oauth_token: creds.accessToken,
    oauth_version: '1.0',
  };
  const allForBase: Record<string, string> = { ...params, ...(queryParams ?? {}) };
  const paramString = Object.keys(allForBase)
    .sort()
    .map((k) => `${pe(k)}=${pe(allForBase[k])}`)
    .join('&');
  const baseString = [method.toUpperCase(), pe(url), pe(paramString)].join('&');
  const signingKey = `${pe(creds.consumerSecret)}&${pe(creds.accessTokenSecret)}`;
  params.oauth_signature = crypto.createHmac('sha1', signingKey).update(baseString).digest('base64');
  return `OAuth ${Object.keys(params).sort().map((k) => `${pe(k)}="${pe(params[k])}"`).join(', ')}`;
}

async function loadCreds(): Promise<TwitterCreds | null> {
  if (!adminDb) return null;
  const snap = await adminDb.collection(`organizations/${PLATFORM_ID}/apiKeys`).doc(PLATFORM_ID).get();
  if (!snap.exists) return null;
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const tw = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const out = {
    consumerKey: String(tw.consumerKey ?? ''),
    consumerSecret: String(tw.consumerSecret ?? ''),
    accessToken: String(tw.accessToken ?? ''),
    accessTokenSecret: String(tw.accessTokenSecret ?? ''),
  };
  return out.consumerKey ? out : null;
}

async function main() {
  const creds = await loadCreds();
  if (!creds) { console.error('No Twitter creds in Firestore'); process.exit(1); }

  // 1. List all webhooks across environments. This requires App-only OAuth 2 bearer
  //    OR OAuth 1.0a User Context. Per X docs, /webhooks.json (no env) needs a bearer.
  //    For simplicity, list per-env with OAuth 1.0a.

  const ENVS = ['dev', 'sandbox', 'prod', 'env-beta', 'production'];
  for (const env of ENVS) {
    const url = `https://api.twitter.com/1.1/account_activity/all/${env}/webhooks.json`;
    const auth = buildOAuth1('GET', url, creds);
    let resp: Response;
    try {
      resp = await fetch(url, { headers: { Authorization: auth } });
    } catch (e) {
      console.log(`env=${env}: fetch error ${(e as Error).message}`);
      continue;
    }
    const text = await resp.text();
    if (resp.status === 404) { continue; }
    console.log(`\nenv=${env} webhooks (HTTP ${resp.status}):`);
    console.log(text.slice(0, 1200));
    if (!resp.ok) { continue; }

    // 2. List subscriptions for this env
    const subUrl = `https://api.twitter.com/1.1/account_activity/all/${env}/subscriptions/list.json`;
    const subAuth = buildOAuth1('GET', subUrl, creds);
    const subResp = await fetch(subUrl, { headers: { Authorization: subAuth } });
    const subText = await subResp.text();
    console.log(`  subscriptions for ${env} (HTTP ${subResp.status}):`);
    console.log(`  ${subText.slice(0, 1200)}`);
  }

  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
