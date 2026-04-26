/**
 * Send DM Reply
 *
 * POST /api/orchestrator/missions/[missionId]/send-dm-reply
 *
 * Operator-clicked or auto-approve-driven send for an inbound-DM-reply
 * mission. After the X Expert specialist composed a draft via
 * delegate_to_marketing → compose_dm_reply, the operator reviews the
 * draft in Mission Control and either:
 *
 *   - clicks "Send reply" (this endpoint) to dispatch the draft as-is
 *   - edits the step output via the existing M6 "Edit output directly"
 *     button, then clicks "Send reply" — this endpoint reads the latest
 *     edited toolResult so the edit lands in the actual DM
 *   - clicks "Don't send" (calls cancelMission instead — out of scope here)
 *
 * Auth: real operator (requireRole(['owner', 'admin'])) OR synthetic
 * trigger with scope='inbound_dm_reply' (auto-approve driver).
 *
 * Mission shape requirements:
 *   - mission.sourceEvent.kind === 'inbound_x_dm'
 *   - mission.sourceEvent.eventId points at a real inboundSocialEvents doc
 *   - mission has at least one COMPLETED delegate_to_marketing step whose
 *     toolResult parses to `{ composedReply: { replyText, ... } }`
 *
 * Body (all optional):
 *   - replyText: override the composed reply with operator-pasted text
 *     (last-mile edit path). Defaults to the latest step output.
 *
 * Response:
 *   - success: boolean
 *   - messageId: X DM event id when send succeeded
 *   - replyText: the actual text sent
 *   - inboundEventId: the source event id that was marked processed
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuthOrSynthetic } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getMission, finalizeMission } from '@/lib/orchestrator/mission-persistence';
import { sendXDirectMessage, markInboundEventReplied } from '@/lib/integrations/twitter-dm-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const bodySchema = z.object({
  replyText: z.string().min(1).max(500).optional(),
});

interface ComposedReplyShape {
  replyText: string;
  reasoning?: string;
  confidence?: 'low' | 'medium' | 'high';
  suggestEscalation?: boolean;
}

interface MarketingStepResultShape {
  mode?: string;
  composedReply?: ComposedReplyShape;
  inboundEventId?: string;
}

function extractComposedReplyFromMission(
  steps: { toolName: string; status: string; toolResult?: string }[],
): { replyText: string; inboundEventId?: string } | null {
  // Walk newest-first so a rerun's output wins over the original.
  for (let i = steps.length - 1; i >= 0; i--) {
    const step = steps[i];
    if (step.status !== 'COMPLETED') { continue; }
    if (step.toolName !== 'delegate_to_marketing') { continue; }
    if (typeof step.toolResult !== 'string') { continue; }
    let parsed: unknown;
    try { parsed = JSON.parse(step.toolResult); } catch { continue; }
    if (!parsed || typeof parsed !== 'object') { continue; }
    const result = parsed as MarketingStepResultShape;
    if (result.composedReply && typeof result.composedReply.replyText === 'string') {
      return {
        replyText: result.composedReply.replyText,
        ...(typeof result.inboundEventId === 'string' ? { inboundEventId: result.inboundEventId } : {}),
      };
    }
  }
  return null;
}

async function loadInboundEventSenderId(eventId: string): Promise<string | null> {
  if (!adminDb) { return null; }
  try {
    const snap = await adminDb
      .collection(getSubCollection('inboundSocialEvents'))
      .doc(eventId)
      .get();
    if (!snap.exists) { return null; }
    const data = snap.data() as Record<string, unknown> | undefined;
    if (!data) { return null; }
    const payload = data.payload as Record<string, unknown> | undefined;
    const dmEvents = payload?.direct_message_events;
    const forUserId = payload?.for_user_id;
    if (!Array.isArray(dmEvents)) { return null; }
    for (const dm of dmEvents) {
      if (!dm || typeof dm !== 'object') { continue; }
      const mc = (dm as Record<string, unknown>).message_create as Record<string, unknown> | undefined;
      if (!mc) { continue; }
      const senderId = typeof mc.sender_id === 'string' ? mc.sender_id : '';
      if (senderId && senderId !== forUserId) { return senderId; }
    }
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error('[send-dm-reply] inbound event load failed', err instanceof Error ? err : new Error(msg), { eventId });
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> },
): Promise<NextResponse> {
  const authResult = await requireAuthOrSynthetic(request, ['inbound_dm_reply']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user, isSynthetic } = authResult;

  // Real operators must be owner or admin; the synthetic-trigger gate
  // already established equivalent privilege via CRON_SECRET + scope.
  if (!isSynthetic && user.role !== 'owner' && user.role !== 'admin') {
    return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
  }

  const { missionId } = await params;
  if (!missionId) {
    return NextResponse.json({ success: false, error: 'missionId required' }, { status: 400 });
  }

  let bodyOverride: z.infer<typeof bodySchema> = {};
  try {
    const raw: unknown = await request.json().catch(() => ({}));
    const parsed = bodySchema.safeParse(raw);
    if (parsed.success) { bodyOverride = parsed.data; }
  } catch {
    // empty body is fine
  }

  const mission = await getMission(missionId);
  if (!mission) {
    return NextResponse.json({ success: false, error: 'Mission not found' }, { status: 404 });
  }

  const sourceEvent = mission.sourceEvent;
  const sourceKind = sourceEvent?.kind;
  if (!sourceEvent || (sourceKind !== 'inbound_x_dm' && sourceKind !== 'inbound_bluesky_dm')) {
    return NextResponse.json(
      { success: false, error: `Mission is not an inbound DM mission (sourceEvent.kind=${String(sourceKind)})` },
      { status: 400 },
    );
  }
  const eventId = sourceEvent.eventId;
  const platform: 'x' | 'bluesky' = sourceKind === 'inbound_bluesky_dm' ? 'bluesky' : 'x';

  const composed = extractComposedReplyFromMission(mission.steps);
  const replyText = (bodyOverride.replyText ?? composed?.replyText ?? '').trim();
  if (!replyText) {
    return NextResponse.json(
      {
        success: false,
        error: 'No composed reply found in mission steps and no replyText override provided',
      },
      { status: 409 },
    );
  }

  // For X: senderId is the X numeric user id (used directly by sendXDirectMessage).
  // For Bluesky: senderId is the sender DID (or handle) — passed straight to BlueskyService.
  const recipientUserId = sourceEvent.senderId
    ?? (platform === 'x' ? await loadInboundEventSenderId(eventId) : null);
  if (!recipientUserId) {
    return NextResponse.json(
      {
        success: false,
        error: `Could not determine sender id for inboundSocialEvents/${eventId}`,
      },
      { status: 409 },
    );
  }

  logger.info('[send-dm-reply] dispatching', {
    missionId,
    platform,
    eventId,
    recipientUserId,
    replyTextLen: replyText.length,
    isSynthetic,
    actorUid: user.uid,
  });

  let sendResult: { success: boolean; messageId?: string; error?: string; httpStatus?: number };
  if (platform === 'bluesky') {
    const { createBlueskyService } = await import('@/lib/integrations/bluesky-service');
    const service = await createBlueskyService();
    if (!service) {
      sendResult = { success: false, error: 'Bluesky credentials missing — run scripts/save-bluesky-config.ts' };
    } else {
      const r = await service.sendDirectMessage({ recipient: recipientUserId, text: replyText });
      sendResult = { success: r.success, messageId: r.messageId, error: r.error };
    }
  } else {
    sendResult = await sendXDirectMessage({ recipientUserId, text: replyText });
  }

  if (!sendResult.success) {
    logger.error('[send-dm-reply] DM send failed', new Error(sendResult.error ?? 'unknown'), {
      missionId,
      platform,
      eventId,
      httpStatus: sendResult.httpStatus,
    });
    return NextResponse.json(
      {
        success: false,
        error: sendResult.error ?? `${platform} DM send failed`,
        httpStatus: sendResult.httpStatus,
      },
      { status: 502 },
    );
  }

  await markInboundEventReplied({
    eventId,
    replyText,
    messageId: sendResult.messageId,
    missionId,
  });

  // The mission has already finished its plan steps (delegate_to_marketing
  // COMPLETED). Mark it COMPLETED at the mission level too — the send
  // is the deliberate terminal action for an inbound-DM mission.
  if (mission.status !== 'COMPLETED') {
    await finalizeMission(missionId, 'COMPLETED');
  }

  return NextResponse.json({
    success: true,
    missionId,
    inboundEventId: eventId,
    recipientUserId,
    replyText,
    messageId: sendResult.messageId,
  });
}
