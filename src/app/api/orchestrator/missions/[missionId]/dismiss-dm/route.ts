/**
 * Dismiss DM Without Sending
 *
 * POST /api/orchestrator/missions/[missionId]/dismiss-dm
 *
 * Closes the honest gap documented in PinnedDMInbox.tsx: without this
 * endpoint the "Skip / mark resolved" button removes the row from local
 * state but the row reappears on the next 30-second poll because Firestore
 * still considers the inbound event un-replied.
 *
 * What this endpoint does:
 *   1. Loads the mission to locate its linked inboundSocialEvents doc via
 *      mission.sourceEvent.eventId.
 *   2. Stamps `reply.dismissedAt` (ISO timestamp) + optional
 *      `reply.dismissReason` on the inboundSocialEvents doc.
 *   3. The inbox route's `isAlreadyHandled` helper (updated in the same
 *      PR) also excludes docs with `dismissedAt` set, so dismissed rows
 *      stay gone across polls.
 *
 * Mission status: the mission is already COMPLETED (the specialist ran and
 * produced a draft). We deliberately leave the mission status unchanged.
 * Marking it something else (e.g. CANCELLED) would pollute Mission Control
 * history with false failures and is not needed — the inbox query is driven
 * entirely by the inboundSocialEvents doc's reply field, not by mission
 * status. This choice is intentional and documented here.
 *
 * Standing Rule #2 compliance: this endpoint does NOT modify any Golden
 * Master and does NOT write a TrainingFeedback record. A dismiss is a
 * pure operator workflow action, not a training signal.
 *
 * Auth + Rate-limit: mirrors the sibling regenerate/route.ts pattern.
 *
 * Body (all optional):
 *   reason?: string — operator note (e.g. "spam", "handled offline"). Stored
 *     as reply.dismissReason on the inboundSocialEvents doc. Max 500 chars.
 *
 * Responses:
 *   200 { success: true, missionId, inboundEventId, dismissedAt }
 *   400 missionId missing / not an inbound-DM mission
 *   404 mission not found / no sourceEvent.eventId
 *   409 already replied (sentAt present) — dismissing after sending is a no-op
 *   500 unexpected error
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getMission } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

const BodySchema = z.object({
  reason: z.string().max(500).optional(),
});

const INBOUND_DM_KINDS = new Set([
  'inbound_x_dm',
  'inbound_bluesky_dm',
  'inbound_linkedin_dm',
  'inbound_facebook_dm',
  'inbound_instagram_dm',
  'inbound_pinterest_dm',
  'inbound_mastodon_dm',
]);

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ missionId: string }> },
): Promise<NextResponse> {
  try {
    const rl = await rateLimitMiddleware(request, '/api/orchestrator/missions/dismiss-dm');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }
    const { user } = auth;

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json(
        { success: false, error: 'Insufficient permissions' },
        { status: 403 },
      );
    }

    const { missionId } = await params;
    if (!missionId) {
      return NextResponse.json(
        { success: false, error: 'missionId is required' },
        { status: 400 },
      );
    }

    let body: z.infer<typeof BodySchema> = {};
    try {
      const raw: unknown = await request.json().catch(() => ({}));
      const parsed = BodySchema.safeParse(raw);
      if (parsed.success) { body = parsed.data; }
    } catch {
      // empty body is acceptable
    }

    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: 'Mission not found' },
        { status: 404 },
      );
    }

    const sourceEvent = mission.sourceEvent;
    if (!sourceEvent?.kind || !INBOUND_DM_KINDS.has(sourceEvent.kind)) {
      return NextResponse.json(
        {
          success: false,
          error: `Mission is not an inbound-DM mission (sourceEvent.kind=${sourceEvent?.kind ?? 'missing'})`,
        },
        { status: 400 },
      );
    }

    const eventId = sourceEvent.eventId;
    if (!eventId) {
      return NextResponse.json(
        { success: false, error: 'Mission sourceEvent is missing eventId — cannot locate inboundSocialEvents doc' },
        { status: 404 },
      );
    }

    if (!adminDb) {
      logger.warn('[dismiss-dm] adminDb not available', { missionId, eventId });
      return NextResponse.json(
        { success: false, error: 'Database not available' },
        { status: 503 },
      );
    }

    const eventsCollection = getSubCollection('inboundSocialEvents');
    const eventRef = adminDb.collection(eventsCollection).doc(eventId);

    // Idempotency + guard: check current reply state before writing.
    const snap = await eventRef.get();
    if (snap.exists) {
      const data = snap.data() as Record<string, unknown> | undefined;
      const replyRaw = data?.reply;
      if (replyRaw && typeof replyRaw === 'object') {
        const reply = replyRaw as Record<string, unknown>;
        // If the operator already sent a real reply, dismissing after the
        // fact is meaningless — return 409 so the caller knows the state
        // changed underneath them.
        if (typeof reply.sentAt === 'string' && reply.sentAt.length > 0) {
          logger.warn('[dismiss-dm] already_replied — cannot dismiss after send', {
            missionId,
            eventId,
            sentAt: reply.sentAt,
          });
          return NextResponse.json(
            {
              success: false,
              reason: 'already_replied',
              sentAt: reply.sentAt,
            },
            { status: 409 },
          );
        }
        // Idempotent: already dismissed — return success without writing again.
        if (typeof reply.dismissedAt === 'string' && reply.dismissedAt.length > 0) {
          return NextResponse.json({
            success: true,
            missionId,
            inboundEventId: eventId,
            dismissedAt: reply.dismissedAt,
            idempotent: true,
          });
        }
      }
    }

    const dismissedAt = new Date().toISOString();

    // Stamp the inboundSocialEvents doc. The inbox route's isAlreadyHandled
    // helper reads reply.dismissedAt alongside reply.sentAt to exclude this
    // event from future polls.
    await eventRef.set(
      {
        processed: true,
        processedAt: dismissedAt,
        reply: {
          dismissedAt,
          dismissedBy: user.uid,
          ...(body.reason ? { dismissReason: body.reason } : {}),
          missionId,
        },
      },
      { merge: true },
    );

    logger.info('[dismiss-dm] DM dismissed', {
      missionId,
      eventId,
      actorUid: user.uid,
      hasReason: Boolean(body.reason),
    });

    return NextResponse.json({
      success: true,
      missionId,
      inboundEventId: eventId,
      dismissedAt,
    });
  } catch (error: unknown) {
    logger.error(
      '[dismiss-dm] POST failed',
      error instanceof Error ? error : new Error(String(error)),
      { route: '/api/orchestrator/missions/[missionId]/dismiss-dm' },
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to dismiss DM' },
      { status: 500 },
    );
  }
}
