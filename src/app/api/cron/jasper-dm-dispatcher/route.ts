/**
 * Jasper DM Dispatcher Cron
 *
 * GET /api/cron/jasper-dm-dispatcher
 * Schedule: every 1 minute (vercel.json)
 *
 * Polls `inboundSocialEvents` for unprocessed direct-message events and
 * fires the synthetic-trigger endpoint for each — which kicks off a
 * proper Jasper mission (plan-gate → delegate_to_marketing → X Expert
 * compose_dm_reply) for the operator to review (or auto-approve to
 * fully drive end-to-end when the org's `automation/inbound.xDmReply`
 * flag is on).
 *
 * Replaces the old `/api/cron/inbound-social-dispatcher` which called
 * OpenRouter directly (architecture violation flagged Apr 25 2026 —
 * see `feedback_no_jasper_bypass_even_for_simple_replies`). The old
 * route is left in the repo as a reference for the OAuth 1.0a header +
 * DM POST shape; this dispatcher reuses the same `inboundSocialEvents`
 * query but routes EVERY reply through Jasper instead of bypassing him.
 *
 * Idempotency:
 *   - Each event gets a `mission_initiated` flag once the
 *     synthetic-trigger fires for it. The next cron run skips events
 *     that already have a mission.
 *   - The dispatch record stores the missionId on the event doc so
 *     operators can trace events ↔ missions in Mission Control.
 *
 * Per-run limits:
 *   - Max 5 events per run. Inbound DM volume is low at this scale; if
 *     this becomes a hot path we move it to a Firestore listener +
 *     real-time queue.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { verifyCronAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { orchestrateInboundDmReply } from '@/lib/social/inbound-dm-orchestration-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_EVENTS_PER_RUN = 5;

interface InboundDmEvent {
  id: string;
  provider: string;
  receivedAt: string;
  processed: boolean;
  mission_initiated?: boolean;
  missionId?: string;
  kind: string;
  payload: {
    for_user_id?: string;
    direct_message_events?: Array<{
      message_create?: {
        message_data?: { text?: string };
        sender_id?: string;
      };
    }>;
  };
}

interface DispatchedEventOutcome {
  eventId: string;
  status: 'dispatched' | 'skipped' | 'failed';
  reason?: string;
  missionId?: string;
  autoApproved?: boolean;
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request, '/api/cron/jasper-dm-dispatcher');
  if (authError) { return authError; }

  if (!adminDb) {
    return NextResponse.json({ error: 'Firestore admin not initialized' }, { status: 500 });
  }

  const collectionPath = getSubCollection('inboundSocialEvents');
  const snap = await adminDb
    .collection(collectionPath)
    .where('provider', '==', 'twitter')
    .where('processed', '==', false)
    .where('kind', '==', 'direct_message_events')
    .limit(MAX_EVENTS_PER_RUN * 2)
    .get();

  if (snap.empty) {
    return NextResponse.json({ checked: 0, dispatched: 0, outcomes: [] });
  }

  const outcomes: DispatchedEventOutcome[] = [];
  let dispatched = 0;

  for (const doc of snap.docs) {
    if (dispatched >= MAX_EVENTS_PER_RUN) { break; }

    const event = doc.data() as InboundDmEvent;

    // Skip events already initiated — the cron is at-least-once delivery,
    // we should never double-fire a mission for the same event.
    if (event.mission_initiated === true) {
      outcomes.push({
        eventId: event.id,
        status: 'skipped',
        reason: `mission_initiated=true (mission ${event.missionId ?? 'unknown'})`,
      });
      continue;
    }

    const dmEvents = event.payload.direct_message_events ?? [];
    const ourId = event.payload.for_user_id;
    const dm = dmEvents.find((d) => d.message_create?.sender_id !== ourId && d.message_create?.message_data?.text);
    if (!dm?.message_create) {
      // Self-loop or empty body — nothing to reply to. Mark processed so
      // we never see this event again.
      const now = new Date().toISOString();
      await doc.ref.update({
        processed: true,
        processedAt: now,
        skippedReason: 'No reply-eligible DM in payload (likely self-loop or empty body)',
      });
      outcomes.push({
        eventId: event.id,
        status: 'skipped',
        reason: 'no reply-eligible DM in payload',
      });
      continue;
    }

    const senderId = dm.message_create.sender_id;
    const inboundText = dm.message_create.message_data?.text;
    if (!senderId || !inboundText) {
      const now = new Date().toISOString();
      await doc.ref.update({
        processed: true,
        processedAt: now,
        skippedReason: 'Missing sender_id or text in DM payload',
      });
      outcomes.push({
        eventId: event.id,
        status: 'skipped',
        reason: 'missing sender_id or text',
      });
      continue;
    }

    // Direct-orchestrate: dispatcher → TwitterExpert → mission record.
    // SCOPED EXCEPTION to the "everything goes through Jasper" rule,
    // applies ONLY to inbound social DMs because the intent
    // ("compose a reply to this incoming message") is fixed and
    // machine-detected — Jasper's intent-interpretation role adds
    // nothing. See `inbound-dm-orchestration-service.ts` for the rule.
    try {
      const result = await orchestrateInboundDmReply({
        platform: 'x',
        inboundEventId: event.id,
        inboundText,
        senderId,
      });
      const now = new Date().toISOString();
      await doc.ref.update({
        mission_initiated: true,
        missionId: result.missionId,
        mission_initiated_at: now,
      });
      outcomes.push({
        eventId: event.id,
        status: 'dispatched',
        missionId: result.missionId,
      });
      dispatched++;
    } catch (orchestrationErr) {
      const errMsg = orchestrationErr instanceof Error ? orchestrationErr.message : String(orchestrationErr);
      logger.error(
        '[jasper-dm-dispatcher] orchestration failed',
        orchestrationErr instanceof Error ? orchestrationErr : new Error(errMsg),
        { eventId: event.id },
      );
      outcomes.push({
        eventId: event.id,
        status: 'failed',
        reason: `orchestration failed: ${errMsg}`,
      });
      // Don't mark mission_initiated — next cron run will retry.
      continue;
    }
  }

  logger.info('[jasper-dm-dispatcher] run complete', {
    checked: snap.size,
    dispatched,
    outcomes: outcomes.map((o) => `${o.eventId}:${o.status}`),
  });

  return NextResponse.json({
    checked: snap.size,
    dispatched,
    outcomes,
  });
}
