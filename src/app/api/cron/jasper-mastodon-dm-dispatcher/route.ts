/**
 * Jasper Mastodon DM Dispatcher Cron
 *
 * GET /api/cron/jasper-mastodon-dm-dispatcher
 * Schedule: every 1 minute (vercel.json)
 *
 * Mastodon-family instances expose direct messages as statuses with
 * `visibility: 'direct'`, surfaced through `/api/v1/conversations`.
 * No webhook system exists, so we poll every minute.
 *
 * Each tick we:
 *   1. List conversations via `pollDirectMessages()` (calls
 *      GET /api/v1/conversations)
 *   2. For each unread conversation whose last_status is from someone
 *      OTHER than the brand:
 *        a. Persist to inboundSocialEvents (provider='mastodon',
 *           kind='direct_message_events') keyed on the status id —
 *           if the same status id appears in two polls, the second is
 *           a no-op (mission_initiated already set)
 *        b. Direct-orchestrate via `orchestrateInboundDmReply` (no
 *           Jasper, no Marketing Manager — see
 *           inbound-dm-orchestration-service for the rule)
 *        c. Mark the conversation read via Mastodon's
 *           POST /api/v1/conversations/{id}/read so subsequent polls
 *           don't re-fire on the same status
 *
 * Idempotency:
 *   - inboundSocialEvents doc id = `mastodon_${statusId}` — globally
 *     unique per status, so reposts under the same conversation create
 *     fresh events (intentional)
 *   - mission_initiated flag set after orchestration succeeds
 *   - Mastodon's "read" state is a server-side dedup signal, not
 *     load-bearing here — we rely on the doc id check
 *
 * History: this same code path was attempted against Truth Social
 * (also Mastodon-API-compatible) on Apr 26 2026 and 403'd at the
 * Cloudflare TLS layer. Truth Social is parked; this route serves
 * mastodon.social, hachyderm.io, and any other Mastodon instance
 * the brand connects via `instanceUrl` config.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { createMastodonService } from '@/lib/integrations/mastodon-service';
import { orchestrateInboundDmReply } from '@/lib/social/inbound-dm-orchestration-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_EVENTS_PER_RUN = 5;

interface DispatcherOutcome {
  conversationId: string;
  statusId: string;
  status: 'dispatched' | 'skipped' | 'failed';
  reason?: string;
  missionId?: string;
}

interface FirestoreInboundEvent {
  id: string;
  provider: 'mastodon';
  kind: 'direct_message_events';
  receivedAt: string;
  processed: boolean;
  mission_initiated?: boolean;
  missionId?: string;
  payload: Record<string, unknown>;
}

/**
 * Strip Mastodon's HTML wrapping out of status content. Mastodon
 * returns status content as HTML (<p>text</p><br/>etc), but the
 * specialist needs plain text for the user prompt.
 */
function stripStatusHtml(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>\s*<p>/gi, '\n\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .trim();
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request, '/api/cron/jasper-mastodon-dm-dispatcher');
  if (authError) { return authError; }

  if (!adminDb) {
    return NextResponse.json({ error: 'Firestore admin not initialized' }, { status: 500 });
  }

  const service = await createMastodonService();
  if (!service) {
    return NextResponse.json({ checked: 0, dispatched: 0, message: 'Mastodon not configured', outcomes: [] });
  }

  // Need the brand's own account id so we can skip statuses from the
  // brand itself (the brand's outgoing DMs also appear in the
  // conversations feed).
  const profile = await service.getProfile();
  if (!profile) {
    return NextResponse.json({ error: 'Mastodon profile fetch failed (token may be invalid)' }, { status: 502 });
  }
  const brandAccountId = profile.id;

  const pollResult = await service.pollDirectMessages();
  if (!pollResult.success) {
    return NextResponse.json({ error: pollResult.error ?? 'pollDirectMessages failed' }, { status: 502 });
  }

  const outcomes: DispatcherOutcome[] = [];
  let dispatched = 0;
  let checked = 0;

  for (const convo of pollResult.conversations) {
    if (dispatched >= MAX_EVENTS_PER_RUN) { break; }
    if (!convo.unread) { continue; }
    if (!convo.last_status) { continue; }

    const status = convo.last_status;
    if (status.account.id === brandAccountId) {
      // Brand's own outgoing DM — skip
      continue;
    }
    // Defensive visibility guard — the conversations endpoint by design
    // only returns direct-visibility statuses, but we enforce the rule
    // explicitly in code so a future API change or federation oddity
    // can't silently let a public mention into the auto-reply pipeline.
    // RULE: auto-reply applies to private DMs only; public mentions /
    // replies / boosts must NOT trigger an automated response — they
    // are visible to everyone and a tone-deaf auto-reply gets seen by
    // all. Public-mention engagement should go through a separate
    // operator-approved path, not this cron.
    if (status.visibility !== 'direct') {
      logger.warn('[mastodon-dm-dispatcher] non-direct status leaked into conversations endpoint — skipping', {
        statusId: status.id,
        visibility: status.visibility,
        from: status.account.acct,
      });
      continue;
    }
    const plainText = stripStatusHtml(status.content);
    if (!plainText) { continue; }

    checked++;
    const eventDocId = `mastodon_${status.id}`;
    const eventRef = adminDb.collection(getSubCollection('inboundSocialEvents')).doc(eventDocId);
    const existing = await eventRef.get();
    if (existing.exists) {
      const existingData = existing.data() as FirestoreInboundEvent;
      if (existingData.mission_initiated === true || existingData.processed === true) {
        outcomes.push({
          conversationId: convo.id,
          statusId: status.id,
          status: 'skipped',
          reason: 'already initiated or processed',
          missionId: existingData.missionId,
        });
        // Still mark conversation read so it stops showing as unread
        await service.markConversationRead(convo.id).catch(() => { /* noop */ });
        continue;
      }
    }

    const senderHandle = status.account.acct || status.account.username;
    const senderId = status.account.id;

    const eventDoc: FirestoreInboundEvent = {
      id: eventDocId,
      provider: 'mastodon',
      kind: 'direct_message_events',
      receivedAt: status.created_at,
      processed: false,
      payload: {
        conversationId: convo.id,
        statusId: status.id,
        sender: { id: senderId, acct: senderHandle, username: status.account.username },
        text: plainText,
        recipientAccountId: brandAccountId,
        visibility: status.visibility,
      },
    };
    await eventRef.set(eventDoc, { merge: true });

    try {
      const result = await orchestrateInboundDmReply({
        platform: 'mastodon',
        inboundEventId: eventDocId,
        inboundText: plainText,
        senderId,
        ...(senderHandle ? { senderHandle } : {}),
      });

      await eventRef.update({
        mission_initiated: true,
        missionId: result.missionId,
        mission_initiated_at: new Date().toISOString(),
      });
      outcomes.push({ conversationId: convo.id, statusId: status.id, status: 'dispatched', missionId: result.missionId });
      dispatched++;
    } catch (orchestrationErr) {
      const errMsg = orchestrationErr instanceof Error ? orchestrationErr.message : String(orchestrationErr);
      logger.error(
        '[mastodon-dm-dispatcher] orchestration failed',
        orchestrationErr instanceof Error ? orchestrationErr : new Error(errMsg),
        { eventId: eventDocId },
      );
      outcomes.push({
        conversationId: convo.id,
        statusId: status.id,
        status: 'failed',
        reason: `orchestration failed: ${errMsg}`,
      });
      continue;
    }

    // Mark read AFTER successful orchestration so a transient failure
    // re-fires on the next poll instead of being silently dropped.
    await service.markConversationRead(convo.id).catch(() => { /* noop — best effort */ });
  }

  logger.info('[mastodon-dm-dispatcher] run complete', {
    checked,
    dispatched,
    outcomes: outcomes.map((o) => `${o.statusId.slice(0, 12)}:${o.status}`),
  });

  return NextResponse.json({ checked, dispatched, outcomes });
}
