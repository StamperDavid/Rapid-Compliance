/**
 * Inbound social-event dispatcher.
 *
 * Polls the inboundSocialEvents Firestore collection for unprocessed
 * Twitter direct-message events. For each, generates a reply via the
 * LLM (OpenRouter / Sonnet 4.6 with Brand DNA injected), sends the
 * reply through X's DM API using our OAuth 1.0a User Context creds,
 * and marks the event processed with the response details.
 *
 * Tonight's scope: DMs only. Mentions / follows / etc. are persisted
 * but not auto-responded — operator decides what to do with them.
 *
 * Triggered every minute by Vercel Cron (configured in vercel.json).
 *
 * NOT a long-term home for DM-reply intelligence — when the
 * SocialDMSpecialist gets built with its own Golden Master, this
 * dispatcher should hand off to it via OutreachManager.execute() or a
 * dedicated SocialEngagementManager. For now, a direct LLM call gets
 * us auto-reply behavior without spinning up a full specialist.
 */

import { type NextRequest, NextResponse } from 'next/server';
import * as crypto from 'crypto';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getBrandDNA } from '@/lib/brand/brand-dna-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

interface TwitterCreds {
  consumerKey: string;
  consumerSecret: string;
  accessToken: string;
  accessTokenSecret: string;
  brandUserId?: string;
}

interface DmEvent {
  message_create?: {
    message_data?: { text?: string };
    sender_id?: string;
    target?: { recipient_id?: string };
  };
  id?: string;
  type?: string;
}

interface TwitterPayload {
  for_user_id?: string;
  direct_message_events?: DmEvent[];
}

interface InboundEventDoc {
  id: string;
  provider: string;
  receivedAt: string;
  processed: boolean;
  kind: string;
  payload: TwitterPayload;
  reply?: { text: string; sentAt: string; messageId?: string };
  skippedReason?: string;
}

function percentEncode(s: string): string {
  return encodeURIComponent(s)
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

async function loadTwitterCreds(): Promise<TwitterCreds | null> {
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

async function generateReplyText(inboundText: string): Promise<string> {
  const brand = await getBrandDNA();
  const brandDescription = brand?.companyDescription ?? 'SalesVelocity.ai — an AI agent swarm for sales and marketing.';
  const tone = brand?.toneOfVoice ?? 'professional yet approachable';
  const avoid = brand?.avoidPhrases?.join('", "') ?? '';

  const systemPrompt = [
    `You are the brand X / Twitter DM responder for ${brandDescription}`,
    `Tone: ${tone}`,
    avoid ? `Never use these phrases: "${avoid}"` : '',
    'Reply rules:',
    '- One short paragraph, 1-3 sentences, under 240 characters total.',
    '- Acknowledge what the sender said specifically (do not be generic).',
    '- If the sender is asking about the product, give a concrete one-line answer + a single next step (e.g., "DM me your use case and I will tell you which agents fit").',
    '- If the sender is being adversarial / spam / off-topic, decline politely and stop.',
    '- Never offer pricing in DMs — direct them to https://www.salesvelocity.ai for pricing.',
    '- Never make up product features that have not been described to you.',
    '- No marketing-speak ("revolutionary", "industry-leading"), no exclamation overload, no emojis.',
    '- Plain text only. No links unless the user explicitly asked where to find something.',
    'Respond with ONLY the reply text — no JSON, no preamble, no quotes.',
  ].filter(Boolean).join('\n');

  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: 'claude-sonnet-4.6',
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: `Inbound DM from a prospect:\n\n${inboundText}\n\nWrite the reply.` },
    ],
    temperature: 0.6,
    maxTokens: 300,
  });
  return (response.content ?? '').trim();
}

async function sendDirectMessage(creds: TwitterCreds, recipientId: string, text: string): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const url = `https://api.twitter.com/2/dm_conversations/with/${encodeURIComponent(recipientId)}/messages`;
  const auth = buildOAuth1Header('POST', url, creds);
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Authorization': auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text }),
  });
  const responseText = await response.text();
  if (!response.ok) {
    return { success: false, error: `HTTP ${response.status} ${responseText.slice(0, 300)}` };
  }
  try {
    const parsed = JSON.parse(responseText) as { data?: { dm_event_id?: string } };
    return { success: true, messageId: parsed.data?.dm_event_id };
  } catch {
    return { success: true };
  }
}

interface DispatchStats {
  checked: number;
  replied: number;
  skipped: number;
  failed: number;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  try {
    const authError = verifyCronAuth(request, '/api/cron/inbound-social-dispatcher');
    if (authError) { return authError; }

    if (!adminDb) {
      return NextResponse.json({ error: 'Firestore admin not initialized' }, { status: 500 });
    }

    const creds = await loadTwitterCreds();
    if (!creds) {
      return NextResponse.json({ error: 'Twitter credentials missing in apiKeys' }, { status: 500 });
    }

    const stats: DispatchStats = { checked: 0, replied: 0, skipped: 0, failed: 0 };
    const collectionPath = getSubCollection('inboundSocialEvents');
    const eventsSnap = await adminDb
      .collection(collectionPath)
      .where('provider', '==', 'twitter')
      .where('processed', '==', false)
      .limit(20)
      .get();

    if (eventsSnap.empty) {
      return NextResponse.json({ stats, message: 'No unprocessed events' });
    }

    for (const doc of eventsSnap.docs) {
      stats.checked++;
      const event = doc.data() as InboundEventDoc;
      const updateNow = new Date().toISOString();

      if (event.kind !== 'direct_message_events') {
        await doc.ref.update({ processed: true, processedAt: updateNow, skippedReason: `Kind=${event.kind} not auto-handled in this dispatcher` });
        stats.skipped++;
        continue;
      }

      const dmEvents = event.payload.direct_message_events ?? [];
      const ourId = event.payload.for_user_id;
      const dm = dmEvents.find((d) => d.message_create?.sender_id !== ourId && d.message_create?.message_data?.text);

      if (!dm?.message_create) {
        await doc.ref.update({ processed: true, processedAt: updateNow, skippedReason: 'No reply-eligible DM in payload (likely self-loop or empty body)' });
        stats.skipped++;
        continue;
      }

      const senderId = dm.message_create.sender_id;
      const inboundText = dm.message_create.message_data?.text;
      if (!senderId || !inboundText) {
        await doc.ref.update({ processed: true, processedAt: updateNow, skippedReason: 'Missing sender_id or text' });
        stats.skipped++;
        continue;
      }

      try {
        const replyText = await generateReplyText(inboundText);
        if (!replyText) {
          await doc.ref.update({ processed: true, processedAt: updateNow, skippedReason: 'LLM returned empty reply' });
          stats.skipped++;
          continue;
        }

        const sendResult = await sendDirectMessage(creds, senderId, replyText);
        if (!sendResult.success) {
          await doc.ref.update({
            processed: true,
            processedAt: updateNow,
            error: sendResult.error,
          });
          stats.failed++;
          logger.error('[inbound-social-dispatcher] DM send failed', undefined, {
            eventId: event.id,
            error: sendResult.error,
          });
          continue;
        }

        await doc.ref.update({
          processed: true,
          processedAt: updateNow,
          reply: {
            text: replyText,
            sentAt: updateNow,
            messageId: sendResult.messageId ?? null,
          },
        });
        stats.replied++;
        logger.info('[inbound-social-dispatcher] Auto-replied to DM', {
          eventId: event.id,
          senderId,
          replyLength: replyText.length,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        await doc.ref.update({
          processed: true,
          processedAt: updateNow,
          error: msg,
        });
        stats.failed++;
        logger.error('[inbound-social-dispatcher] Dispatch failed', err instanceof Error ? err : new Error(msg), {
          eventId: event.id,
        });
      }
    }

    return NextResponse.json({ stats });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[inbound-social-dispatcher] Cron failed', err instanceof Error ? err : new Error(msg));
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
