/**
 * Jasper Bluesky DM Dispatcher Cron
 *
 * GET /api/cron/jasper-bluesky-dm-dispatcher
 * Schedule: every 1 minute (vercel.json)
 *
 * Bluesky has no webhook system for chat — events must be polled.
 * Each minute we:
 *   1. List the brand's Bluesky conversations via chat.bsky.convo.listConvos
 *   2. For each unread message NOT from the brand itself:
 *        a. Persist to inboundSocialEvents (provider='bluesky',
 *           kind='direct_message_events') with the same shape the X
 *           webhook would have written, so the existing dispatcher and
 *           synthetic-trigger pipeline pick it up identically
 *        b. Fire the synthetic-trigger to kick off Jasper
 *        c. Mark the message read on Bluesky's side so the next poll
 *           does not re-fire the same message
 *
 * Idempotency:
 *   - inboundSocialEvents doc id is keyed on the Bluesky message id
 *   - mission_initiated flag set after synthetic-trigger fires
 *   - Bluesky's own "read" state is the authoritative dedup signal
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { createBlueskyService } from '@/lib/integrations/bluesky-service';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { orchestrateInboundDmReply } from '@/lib/social/inbound-dm-orchestration-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_EVENTS_PER_RUN = 5;
const CHAT_HOST = 'https://api.bsky.chat';

interface BlueskyConvoMember { did: string; handle: string; displayName?: string }
interface BlueskyMessage {
  id: string;
  rev?: string;
  text: string;
  sentAt: string;
  sender?: { did: string };
}
interface BlueskyConvo {
  id: string;
  rev: string;
  members: BlueskyConvoMember[];
  lastMessage?: BlueskyMessage;
  unreadCount: number;
}
interface ListConvosResponse { convos: BlueskyConvo[]; cursor?: string }
interface GetMessagesResponse { messages: BlueskyMessage[]; cursor?: string }

interface DispatcherOutcome {
  conversationId: string;
  messageId: string;
  status: 'dispatched' | 'skipped' | 'failed';
  reason?: string;
  missionId?: string;
}

interface FirestoreInboundEvent {
  id: string;
  provider: 'bluesky';
  kind: 'direct_message_events';
  receivedAt: string;
  processed: boolean;
  mission_initiated?: boolean;
  missionId?: string;
  payload: Record<string, unknown>;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request, '/api/cron/jasper-bluesky-dm-dispatcher');
  if (authError) { return authError; }

  if (!adminDb) {
    return NextResponse.json({ error: 'Firestore admin not initialized' }, { status: 500 });
  }

  // Ensure Bluesky is configured. createBlueskyService returns null when
  // creds are missing — we silently no-op the cron in that case rather
  // than 500ing every minute.
  const service = await createBlueskyService();
  if (!service) {
    return NextResponse.json({ checked: 0, dispatched: 0, message: 'Bluesky not configured', outcomes: [] });
  }

  // Load creds for direct chat-service calls (createBlueskyService gives
  // us postRecord/sendDirectMessage but the chat list/read endpoints
  // need raw fetch with the same access token).
  interface BskyKeys { identifier?: string; password?: string; accessJwt?: string; did?: string; handle?: string }
  const keys = await apiKeyService.getServiceKey(PLATFORM_ID, 'bluesky') as BskyKeys | null;
  if (!keys?.identifier || !keys.password) {
    return NextResponse.json({ checked: 0, dispatched: 0, message: 'Bluesky creds incomplete', outcomes: [] });
  }

  // Refresh a session — the cached accessJwt may be stale across cron runs.
  const sessionResp = await fetch('https://bsky.social/xrpc/com.atproto.server.createSession', {
    method: 'POST',
    cache: 'no-store',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ identifier: keys.identifier, password: keys.password }),
  });
  if (!sessionResp.ok) {
    const errText = await sessionResp.text();
    logger.error('[bluesky-dm-dispatcher] createSession failed', new Error(`HTTP ${sessionResp.status}`), { errPreview: errText.slice(0, 200) });
    return NextResponse.json({ error: `Bluesky auth failed: HTTP ${sessionResp.status}` }, { status: 502 });
  }
  const session = await sessionResp.json() as { accessJwt?: string; did?: string; handle?: string };
  const accessJwt = session.accessJwt;
  const brandDid = session.did;
  if (!accessJwt || !brandDid) {
    return NextResponse.json({ error: 'Bluesky session missing accessJwt or did' }, { status: 502 });
  }

  const proxyHeaders = {
    Authorization: `Bearer ${accessJwt}`,
    'atproto-proxy': 'did:web:api.bsky.chat#bsky_chat',
  };

  // 1. List conversations with unread messages
  const convosResp = await fetch(`${CHAT_HOST}/xrpc/chat.bsky.convo.listConvos`, { cache: 'no-store', headers: proxyHeaders });
  if (!convosResp.ok) {
    const errText = await convosResp.text();
    return NextResponse.json({ error: `listConvos failed: HTTP ${convosResp.status} ${errText.slice(0, 200)}` }, { status: 502 });
  }
  const convosData = await convosResp.json() as ListConvosResponse;

  const outcomes: DispatcherOutcome[] = [];
  let dispatched = 0;
  let checked = 0;

  for (const convo of convosData.convos) {
    if (dispatched >= MAX_EVENTS_PER_RUN) { break; }
    if (convo.unreadCount === 0) { continue; }

    // 2. Pull the unread messages for this conversation
    const messagesResp = await fetch(
      `${CHAT_HOST}/xrpc/chat.bsky.convo.getMessages?convoId=${encodeURIComponent(convo.id)}&limit=20`,
      { cache: 'no-store', headers: proxyHeaders },
    );
    if (!messagesResp.ok) {
      outcomes.push({
        conversationId: convo.id,
        messageId: '',
        status: 'failed',
        reason: `getMessages HTTP ${messagesResp.status}`,
      });
      continue;
    }
    const messagesData = await messagesResp.json() as GetMessagesResponse;

    // Process oldest-first so reply order is deterministic
    const ordered = [...messagesData.messages].reverse();
    for (const msg of ordered) {
      if (dispatched >= MAX_EVENTS_PER_RUN) { break; }

      // Defensive structural guard — auto-reply applies to private DMs
      // ONLY. Bluesky's `chat.bsky.convo.*` lexicons are DM-only by spec
      // (public posts go through `app.bsky.feed.post`, a separate code
      // path), so this loop already operates on chat-channel data. The
      // `id`/`sender.did`/`text` shape check below asserts that — if a
      // future Bluesky API change ever returns non-chat events here,
      // the guard fails closed (skip + log) rather than silently feeding
      // public engagement into the auto-reply pipeline.
      const looksLikeChatMessage = (
        typeof msg.id === 'string' && msg.id.length > 0
        && typeof msg.sender?.did === 'string' && msg.sender.did.length > 0
        && typeof msg.text === 'string'
      );
      if (!looksLikeChatMessage) {
        logger.warn('[bluesky-dm-dispatcher] non-chat-shaped message in chat.bsky.convo.getMessages — skipping', {
          msgId: msg.id,
          hasSender: Boolean(msg.sender?.did),
        });
        continue;
      }

      if (!msg.sender || msg.sender.did === brandDid) { continue; } // skip own messages
      if (!msg.text || msg.text.trim().length === 0) { continue; }

      checked++;
      const eventDocId = `bluesky_${msg.id}`;
      const eventRef = adminDb.collection(getSubCollection('inboundSocialEvents')).doc(eventDocId);
      const existing = await eventRef.get();
      if (existing.exists) {
        const existingData = existing.data() as FirestoreInboundEvent;
        if (existingData.mission_initiated === true || existingData.processed === true) {
          outcomes.push({
            conversationId: convo.id,
            messageId: msg.id,
            status: 'skipped',
            reason: 'already initiated or processed',
            missionId: existingData.missionId,
          });
          continue;
        }
      }

      const sender = msg.sender;
      const senderHandle = convo.members.find((m) => m.did === sender.did)?.handle;

      // 3a. Persist the inbound event so anything else watching can see it
      const eventDoc: FirestoreInboundEvent = {
        id: eventDocId,
        provider: 'bluesky',
        kind: 'direct_message_events',
        receivedAt: msg.sentAt,
        processed: false,
        payload: {
          convoId: convo.id,
          messageId: msg.id,
          rev: msg.rev,
          sender: { did: sender.did, handle: senderHandle },
          text: msg.text,
          recipientDid: brandDid,
        },
      };
      await eventRef.set(eventDoc, { merge: true });

      // 3b. Direct-orchestrate: dispatcher → BlueskyExpert → mission
      // record. SCOPED EXCEPTION to the "everything goes through Jasper"
      // rule, applies ONLY to inbound social DMs because the intent
      // ("compose a reply to this incoming message") is fixed and
      // machine-detected — Jasper's intent-interpretation role adds
      // nothing. See `inbound-dm-orchestration-service.ts` for the rule.
      try {
        const result = await orchestrateInboundDmReply({
          platform: 'bluesky',
          inboundEventId: eventDocId,
          inboundText: msg.text,
          senderId: sender.did,
          ...(senderHandle ? { senderHandle } : {}),
        });

        await eventRef.update({
          mission_initiated: true,
          missionId: result.missionId,
          mission_initiated_at: new Date().toISOString(),
        });
        outcomes.push({ conversationId: convo.id, messageId: msg.id, status: 'dispatched', missionId: result.missionId });
        dispatched++;
      } catch (orchestrationErr) {
        const errMsg = orchestrationErr instanceof Error ? orchestrationErr.message : String(orchestrationErr);
        logger.error(
          '[bluesky-dm-dispatcher] orchestration failed',
          orchestrationErr instanceof Error ? orchestrationErr : new Error(errMsg),
          { eventId: eventDocId },
        );
        outcomes.push({
          conversationId: convo.id,
          messageId: msg.id,
          status: 'failed',
          reason: `orchestration failed: ${errMsg}`,
        });
        continue;
      }
    }

    // 4. Mark this conversation read up to the latest message so we
    // don't re-fire on future polls. Bluesky exposes
    // chat.bsky.convo.updateRead which takes a convoId + optional
    // messageId.
    const latestMessageId = messagesData.messages[0]?.id;
    if (latestMessageId) {
      await fetch(`${CHAT_HOST}/xrpc/chat.bsky.convo.updateRead`, {
        method: 'POST',
        cache: 'no-store',
        headers: { ...proxyHeaders, 'Content-Type': 'application/json' },
        body: JSON.stringify({ convoId: convo.id, messageId: latestMessageId }),
      }).catch(() => { /* noop — best effort */ });
    }
  }

  logger.info('[bluesky-dm-dispatcher] run complete', {
    checked,
    dispatched,
    outcomes: outcomes.map((o) => `${o.messageId.slice(0, 8)}:${o.status}`),
  });

  return NextResponse.json({ checked, dispatched, outcomes });
}
