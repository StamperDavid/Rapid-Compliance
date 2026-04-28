/**
 * X (Twitter) Account Activity webhook receiver.
 *
 * Handles two responsibilities:
 *
 *   GET  — CRC (Challenge-Response Check). X periodically GETs this URL
 *          with `?crc_token=...`. We must respond with
 *          `{"response_token":"sha256=BASE64(HMAC-SHA256(consumer_secret,crc_token))"}`
 *          to prove we control the endpoint.
 *
 *   POST — real events. X sends JSON with arrays like
 *          `direct_message_events`, `tweet_create_events`, etc. The
 *          `x-twitter-webhooks-signature` header carries the HMAC-SHA256
 *          of the raw body signed with our consumer secret. We verify
 *          via constant-time compare, then write the event to Firestore
 *          so downstream consumers (agent dispatcher, ops dashboard)
 *          can pick it up.
 *
 * Consumer secret is read from `apiKeys/{PLATFORM_ID}.social.twitter.consumerSecret`
 * which we saved via scripts/save-twitter-config.ts.
 */

import { type NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

async function loadConsumerSecret(): Promise<string | null> {
  if (!adminDb) { return null; }
  const PLATFORM_ID = 'rapid-compliance-root';
  const snap = await adminDb
    .collection(`organizations/${PLATFORM_ID}/apiKeys`)
    .doc(PLATFORM_ID)
    .get();
  if (!snap.exists) { return null; }
  const data = snap.data() as Record<string, unknown>;
  const social = (data.social && typeof data.social === 'object' ? data.social : {}) as Record<string, unknown>;
  const tw = (social.twitter && typeof social.twitter === 'object' ? social.twitter : {}) as Record<string, unknown>;
  const secret = tw.consumerSecret;
  return typeof secret === 'string' && secret.length > 0 ? secret : null;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const crcToken = request.nextUrl.searchParams.get('crc_token');
  if (!crcToken) {
    return NextResponse.json({ error: 'Missing crc_token' }, { status: 400 });
  }

  const consumerSecret = await loadConsumerSecret();
  if (!consumerSecret) {
    logger.error('[twitter-webhook] Consumer secret not found in apiKeys', undefined, {
      route: '/api/webhooks/twitter',
    });
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const hmac = crypto
    .createHmac('sha256', consumerSecret)
    .update(crcToken)
    .digest('base64');

  return NextResponse.json({ response_token: `sha256=${hmac}` });
}

export async function POST(request: NextRequest): Promise<NextResponse> {
  // We need the RAW body for signature verification. Reading the body
  // as text gives us the bytes X actually signed. Parsing as JSON later
  // would be lossy because property ordering / whitespace would change.
  const rawBody = await request.text();
  const signatureHeader = request.headers.get('x-twitter-webhooks-signature');

  if (!signatureHeader) {
    logger.warn('[twitter-webhook] Missing signature header — rejecting', {
      route: '/api/webhooks/twitter',
      bodyLength: rawBody.length,
    });
    return NextResponse.json({ error: 'Missing signature' }, { status: 401 });
  }

  const consumerSecret = await loadConsumerSecret();
  if (!consumerSecret) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const expected = `sha256=${crypto
    .createHmac('sha256', consumerSecret)
    .update(rawBody)
    .digest('base64')}`;

  // Constant-time compare so attackers can't time-guess the signature.
  // crypto.timingSafeEqual requires equal-length buffers; fall back to
  // false if lengths differ.
  let signatureValid = false;
  try {
    const a = Buffer.from(expected);
    const b = Buffer.from(signatureHeader);
    if (a.length === b.length) {
      signatureValid = crypto.timingSafeEqual(a, b);
    }
  } catch {
    signatureValid = false;
  }

  if (!signatureValid) {
    logger.warn('[twitter-webhook] Invalid signature — rejecting', {
      route: '/api/webhooks/twitter',
      bodyLength: rawBody.length,
    });
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const kind = detectEventKind(payload);

  // X DM auto-reply is impractical and operator decided to incur zero cost
  // on it (Apr 27 2026):
  //   1. Real customer DMs use X Chat (E2E encrypted) which X never delivers
  //      to any webhook — confirmed by tay (X Staff) in dev community threads
  //   2. The DMs that DO reach us via Account Activity webhook are exclusively
  //      flagged as low-quality by X's own UI filter (visible at
  //      x.com/settings/direct_messages → "Filter low-quality messages")
  //   3. Processing them costs LLM tokens per DM and produces zero customer value
  // Drop direct_message_events at the receiver so they never land in
  // inboundSocialEvents and never trigger the dispatcher / specialist.
  // Other event types (tweets, follows, mentions) still flow through.
  // To re-enable: delete this guard. Reconsider only if X exposes X Chat to API.
  if (kind === 'direct_message_events') {
    logger.info(
      '[twitter-webhook] Dropping direct_message_events (X Chat unreachable, legacy DMs are spam — see route comment)',
      { route: '/api/webhooks/twitter' },
    );
    return NextResponse.json({ ok: true, dropped: 'direct_message_events' });
  }

  // Persist the raw event for downstream consumers. The agent dispatcher
  // can poll this collection or watch via a Firestore listener and
  // dispatch each unprocessed event to the right handler (DM reply
  // generator, mention-engagement specialist, etc.).
  if (adminDb) {
    const eventId = `twitter_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const eventDoc = {
      id: eventId,
      provider: 'twitter',
      receivedAt: new Date().toISOString(),
      processed: false,
      kind,
      payload,
    };
    try {
      await adminDb
        .collection(getSubCollection('inboundSocialEvents'))
        .doc(eventId)
        .set(eventDoc);
    } catch (err) {
      logger.error(
        '[twitter-webhook] Failed to persist event',
        err instanceof Error ? err : new Error(String(err)),
        { route: '/api/webhooks/twitter' },
      );
      // Fall through — still ack 200 so X doesn't retry forever.
    }
  }

  return NextResponse.json({ ok: true });
}

/**
 * Pick the dominant event type for routing/triage. X webhook payloads
 * carry several arrays (direct_message_events, tweet_create_events,
 * follow_events, etc.) — at least one is non-empty per delivery.
 */
function detectEventKind(payload: Record<string, unknown>): string {
  const keysOfInterest = [
    'direct_message_events',
    'direct_message_indicate_typing_events',
    'direct_message_mark_read_events',
    'tweet_create_events',
    'favorite_events',
    'follow_events',
    'block_events',
    'mute_events',
    'user_event',
  ];
  for (const k of keysOfInterest) {
    const v = payload[k];
    if (Array.isArray(v) && v.length > 0) { return k; }
    if (v && typeof v === 'object') { return k; }
  }
  return 'unknown';
}
