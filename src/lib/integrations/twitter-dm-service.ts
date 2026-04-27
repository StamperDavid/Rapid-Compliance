/**
 * X (Twitter) Direct Message send service.
 *
 * Owns the OAuth 1.0a User Context handshake and the DM POST endpoint
 * for the brand account. Used by:
 *   - The Jasper `send_social_reply` tool (plan-driven send)
 *   - `/api/orchestrator/missions/[id]/send-dm-reply` (operator-clicked send
 *     after the X Expert specialist composed a draft in Mission Control)
 *   - `scripts/verify-jasper-dm-reply-live.ts` (E2E verification)
 *
 * Replaces the inline DM-send code that lived in
 * `src/app/api/cron/inbound-social-dispatcher/route.ts` (now disabled
 * because that cron called OpenRouter directly, bypassing Jasper). The
 * OAuth 1.0a header builder + DM endpoint are unchanged from that file
 * — only the auto-reply orchestration is gone.
 */

import * as crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';

const DM_API_HOST = 'https://api.twitter.com';

export interface TwitterCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  brandUserId?: string;
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

/**
 * Load Twitter OAuth 1.0a credentials from Firestore. Returns null when
 * any required field is missing — callers must handle this and surface
 * a clear "Twitter not configured" error to the operator.
 */
export async function loadTwitterCreds(): Promise<TwitterCreds | null> {
  if (!adminDb) { return null; }
  const snap = await adminDb
    .collection(`organizations/${PLATFORM_ID}/apiKeys`)
    .doc(PLATFORM_ID)
    .get();
  if (!snap.exists) { return null; }
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const tw = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const out: TwitterCreds = {
    consumerKey: String(tw.consumerKey ?? ''),
    consumerSecret: String(tw.consumerSecret ?? ''),
    accessToken: String(tw.accessToken ?? ''),
    accessTokenSecret: String(tw.accessTokenSecret ?? ''),
  };
  if (typeof tw.brandUserId === 'string') { out.brandUserId = tw.brandUserId; }
  return out.consumerKey && out.consumerSecret && out.accessToken && out.accessTokenSecret ? out : null;
}

export interface SendDmResult {
  success: boolean;
  messageId?: string;
  error?: string;
  httpStatus?: number;
}

/**
 * Send a direct message from the brand account to a recipient X user.
 *
 * Hard limit: X enforces a 10,000-character cap per DM, but we cap at
 * 500 here — DMs from the brand should be short and conversational. The
 * X Expert's `compose_dm_reply` action enforces ≤240 chars at the schema
 * level; the 500 ceiling is a defense-in-depth backstop for direct
 * callers that bypass the specialist.
 */
export async function sendXDirectMessage(input: {
  recipientUserId: string;
  text: string;
  creds?: TwitterCreds;
}): Promise<SendDmResult> {
  const text = input.text.trim();
  if (!input.recipientUserId) {
    return { success: false, error: 'recipientUserId is required' };
  }
  if (!text) {
    return { success: false, error: 'reply text is empty' };
  }
  if (text.length > 500) {
    return { success: false, error: `reply text is ${text.length} chars; cap is 500` };
  }

  const creds = input.creds ?? await loadTwitterCreds();
  if (!creds) {
    return { success: false, error: 'Twitter credentials missing in apiKeys' };
  }

  const url = `${DM_API_HOST}/2/dm_conversations/with/${encodeURIComponent(input.recipientUserId)}/messages`;
  const auth = buildOAuth1Header('POST', url, creds);

  let response: Response;
  try {
    response = await fetch(url, {
      method: 'POST',
      cache: 'no-store',
      headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { success: false, error: `network error: ${msg}` };
  }

  const responseText = await response.text();
  if (!response.ok) {
    return {
      success: false,
      httpStatus: response.status,
      error: `HTTP ${response.status} ${responseText.slice(0, 300)}`,
    };
  }

  let parsedBody: { data?: { dm_event_id?: string } } | null = null;
  try {
    parsedBody = JSON.parse(responseText) as { data?: { dm_event_id?: string } };
  } catch {
    // X returned 200 but body wasn't JSON — still treat as success since
    // the HTTP layer accepted it. The operator can verify in Mission
    // Control by checking the inboundSocialEvents record below.
    parsedBody = null;
  }

  return {
    success: true,
    httpStatus: response.status,
    messageId: parsedBody?.data?.dm_event_id,
  };
}

/**
 * Mark an inbound DM event as replied. Records the reply text + send
 * messageId on the source `inboundSocialEvents` document so future
 * audits + dashboards see the full conversation thread.
 *
 * Idempotent: a second call for the same eventId overwrites the reply
 * fields with the latest values. The dispatcher cron prevents double
 * dispatch via the `mission_initiated` flag, so this should not happen
 * in normal operation.
 */
export async function markInboundEventReplied(input: {
  eventId: string;
  replyText: string;
  messageId?: string;
  missionId?: string;
}): Promise<boolean> {
  if (!adminDb) {
    logger.warn('[twitter-dm-service] adminDb not available — markInboundEventReplied skipped', {
      eventId: input.eventId,
    });
    return false;
  }

  try {
    const ref = adminDb
      .collection(getSubCollection('inboundSocialEvents'))
      .doc(input.eventId);
    const now = new Date().toISOString();
    await ref.update({
      processed: true,
      processedAt: now,
      reply: {
        text: input.replyText,
        sentAt: now,
        ...(input.messageId ? { messageId: input.messageId } : {}),
        ...(input.missionId ? { missionId: input.missionId } : {}),
      },
    });
    return true;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error(
      '[twitter-dm-service] markInboundEventReplied failed',
      err instanceof Error ? err : new Error(msg),
      { eventId: input.eventId },
    );
    return false;
  }
}

export const __internalTwitterDm = {
  buildOAuth1Header,
  percentEncode,
};
