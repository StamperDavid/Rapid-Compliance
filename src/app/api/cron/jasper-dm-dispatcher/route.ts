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

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_EVENTS_PER_RUN = 5;
const SCOPE = 'inbound_dm_reply';

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

function appBaseUrl(): string {
  const explicit = process.env.NEXT_PUBLIC_APP_URL;
  if (explicit && explicit.length > 0) { return explicit.replace(/\/+$/, ''); }
  const vercel = process.env.VERCEL_URL;
  if (vercel && vercel.length > 0) { return `https://${vercel}`; }
  return 'http://localhost:3000';
}

function buildSyntheticPrompt(args: {
  senderHandle?: string;
  senderId?: string;
  inboundText: string;
  inboundEventId: string;
}): string {
  const senderLine = args.senderHandle
    ? `from ${args.senderHandle}${args.senderId ? ` (X user id ${args.senderId})` : ''}`
    : (args.senderId ? `from X user id ${args.senderId}` : 'from an X user');
  return [
    `An inbound X / Twitter direct message arrived for the brand and needs a reply.`,
    ``,
    `INBOUND DM CONTEXT (pass these values verbatim into delegate_to_marketing.inboundContext — do not modify):`,
    `- platform: x`,
    `- inboundEventId: ${args.inboundEventId}`,
    args.senderHandle ? `- senderHandle: ${args.senderHandle}` : '',
    args.senderId ? `- senderId: ${args.senderId}` : '',
    `- inboundText: """`,
    args.inboundText,
    `"""`,
    ``,
    `YOUR JOB:`,
    `Plan exactly ONE step: delegate_to_marketing with goal "Compose a brand-voiced reply to the inbound X DM ${senderLine}", platform "twitter", contentType "dm_reply", and the inboundContext above.`,
    `Do not plan a send step — the operator will review the X Expert's draft in Mission Control and click "Send reply" themselves.`,
    `Use propose_mission_plan to draft the plan.`,
  ].filter(Boolean).join('\n');
}

export async function GET(request: NextRequest): Promise<NextResponse> {
  const authError = verifyCronAuth(request, '/api/cron/jasper-dm-dispatcher');
  if (authError) { return authError; }

  if (!adminDb) {
    return NextResponse.json({ error: 'Firestore admin not initialized' }, { status: 500 });
  }

  const cronSecret = process.env.CRON_SECRET ?? '';
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
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

    const triggerId = `${SCOPE}_${event.id}_${Date.now()}`;
    const syntheticPrompt = buildSyntheticPrompt({
      inboundEventId: event.id,
      senderId,
      inboundText,
    });

    const triggerUrl = `${appBaseUrl()}/api/orchestrator/synthetic-trigger`;
    let triggerResponseJson: { success: boolean; missionId?: string; autoApproved?: boolean; error?: string } | null = null;
    try {
      const triggerResp = await fetch(triggerUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${cronSecret}`,
        },
        body: JSON.stringify({
          scope: SCOPE,
          syntheticUserMessage: syntheticPrompt,
          sourceEvent: {
            kind: 'inbound_x_dm',
            eventId: event.id,
            senderId,
          },
          triggerId,
        }),
      });

      const triggerText = await triggerResp.text();
      try { triggerResponseJson = JSON.parse(triggerText) as { success: boolean; missionId?: string; autoApproved?: boolean; error?: string }; }
      catch { triggerResponseJson = null; }

      if (!triggerResp.ok || !triggerResponseJson?.success || !triggerResponseJson.missionId) {
        outcomes.push({
          eventId: event.id,
          status: 'failed',
          reason: triggerResponseJson?.error ?? `HTTP ${triggerResp.status} ${triggerText.slice(0, 200)}`,
        });
        // Don't mark processed — the next cron run can retry. Cap retries
        // by setting an attemptCount field if this becomes a hot loop.
        continue;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[jasper-dm-dispatcher] synthetic-trigger fetch threw', err instanceof Error ? err : new Error(msg), {
        eventId: event.id,
        triggerId,
      });
      outcomes.push({
        eventId: event.id,
        status: 'failed',
        reason: `synthetic-trigger fetch threw: ${msg}`,
      });
      continue;
    }

    const missionId = triggerResponseJson.missionId;
    const autoApproved = triggerResponseJson.autoApproved === true;

    // Stamp the event so we never re-fire. When auto-approve was on and
    // the DM was actually sent, the synthetic-trigger pipeline already
    // marked the event processed=true via markInboundEventReplied. In
    // that case our update here is redundant-but-safe (Firestore merges
    // by field).
    const now = new Date().toISOString();
    await doc.ref.update({
      mission_initiated: true,
      missionId,
      mission_initiated_at: now,
    });

    outcomes.push({
      eventId: event.id,
      status: 'dispatched',
      missionId,
      autoApproved,
    });
    dispatched++;
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
