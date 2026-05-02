/**
 * DM Inbox API
 *
 * GET /api/social/platforms/{platform}/dm-inbox
 *
 * Returns pending inbound DMs for a given platform — missions that were
 * created by the inbound-DM orchestration service (orchestrateInboundDmReply)
 * and have not yet had a reply sent (no `reply.sentAt` on the linked
 * inboundSocialEvents doc).
 *
 * Response shape:
 *   { pending: Array<PendingDmItem> }
 *
 * PendingDmItem:
 *   missionId    — Firestore mission doc id
 *   stepId       — the compose_dm_reply step id within the mission
 *   senderHandle — @handle from sourceEvent.senderHandle (may be undefined)
 *   inboundText  — original DM body extracted from the step toolResult
 *   draftReply   — AI-composed reply text from the step toolResult
 *   receivedAt   — mission.createdAt ISO string
 *
 * Query strategy:
 *   Primary — `sourceEvent.kind === <platform_kind>` AND `status === 'COMPLETED'`.
 *   The orchestration service writes missions in COMPLETED status (the specialist
 *   already ran; the mission is waiting for the operator to *send* the reply, not
 *   approve a plan). The reply-sent state is tracked on the inboundSocialEvents
 *   doc, not on the mission status.
 *
 *   Firestore composite index required: (status, createdAt desc).
 *   The `sourceEvent.kind` filter is applied in-memory after the status query
 *   because Firestore Free/Blaze does not automatically index nested fields used
 *   in compound queries with array-contains or nested object equality.
 *
 *   Fallback — if no sourceEvent.kind match is found, we additionally scan for
 *   missions whose first step toolName is `compose_dm_reply` and whose step
 *   toolResult.platform matches. This handles any missions written before the
 *   sourceEvent stamp was reliable. Documented honestly: the fallback exists
 *   because early dispatcher runs may not have stamped sourceEvent.
 *
 * Auth + Rate-limit: matches the pattern in the insights route.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import type { Mission } from '@/lib/orchestrator/mission-persistence';

export const dynamic = 'force-dynamic';

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

/**
 * Maps a SocialPlatform value to the sourceEvent.kind written by
 * inbound-dm-orchestration-service. Only the three platforms that
 * currently have dispatchers (x, bluesky, mastodon) will produce live
 * missions — the rest are here for completeness.
 */
const SOURCE_EVENT_KIND_BY_PLATFORM: Partial<Record<SocialPlatform, string>> = {
  twitter: 'inbound_x_dm',
  bluesky: 'inbound_bluesky_dm',
  mastodon: 'inbound_mastodon_dm',
  linkedin: 'inbound_linkedin_dm',
  facebook: 'inbound_facebook_dm',
  instagram: 'inbound_instagram_dm',
  pinterest: 'inbound_pinterest_dm',
};

export interface PendingDmItem {
  missionId: string;
  stepId: string;
  senderHandle: string | undefined;
  inboundText: string;
  draftReply: string;
  receivedAt: string;
}

/**
 * Attempt to extract the inbound text and draft reply from a mission's
 * compose_dm_reply step. The toolResult JSON written by the orchestration
 * service is:
 *   { mode, platform, inboundEventId, inboundText, senderId,
 *     composedReply: { replyText, reasoning, confidence, suggestEscalation },
 *     specialistsUsed }
 */
interface StepResultShape {
  inboundText?: string;
  composedReply?: {
    replyText?: string;
  };
}

function extractDmPayload(
  toolResult: string,
): { inboundText: string; draftReply: string } | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(toolResult);
  } catch {
    return null;
  }
  if (!parsed || typeof parsed !== 'object') { return null; }
  const shape = parsed as StepResultShape;
  const inboundText = typeof shape.inboundText === 'string' ? shape.inboundText : '';
  const draftReply = typeof shape.composedReply?.replyText === 'string'
    ? shape.composedReply.replyText
    : '';
  if (!draftReply) { return null; }
  return { inboundText, draftReply };
}

/**
 * Check the inboundSocialEvents doc to see if the DM has already been
 * replied to. Returns true when a reply.sentAt timestamp is present —
 * the mission should be excluded from the inbox.
 */
async function isAlreadyReplied(eventId: string): Promise<boolean> {
  if (!adminDb) { return false; }
  try {
    const snap = await adminDb
      .collection(getSubCollection('inboundSocialEvents'))
      .doc(eventId)
      .get();
    if (!snap.exists) { return false; }
    const data = snap.data() as Record<string, unknown> | undefined;
    const replyRaw = data?.reply;
    if (!replyRaw || typeof replyRaw !== 'object') { return false; }
    const reply = replyRaw as Record<string, unknown>;
    const sentAt = reply.sentAt;
    return typeof sentAt === 'string' && sentAt.length > 0;
  } catch (err) {
    logger.warn('[dm-inbox] isAlreadyReplied check failed', {
      eventId,
      error: err instanceof Error ? err.message : String(err),
    });
    // Fail-open: include the mission so the operator can see it.
    return false;
  }
}

/**
 * Convert a COMPLETED inbound-DM mission into a PendingDmItem.
 * Returns null if the mission is missing the expected step shape or
 * has already been replied to.
 */
async function missionToPendingItem(
  mission: Mission,
  expectedKind: string | undefined,
): Promise<PendingDmItem | null> {
  const sourceEvent = mission.sourceEvent;

  // Primary filter: sourceEvent.kind must match the platform.
  // If expectedKind is undefined (platform has no DM capability), skip.
  if (!expectedKind) { return null; }
  if (sourceEvent?.kind !== expectedKind) { return null; }

  // Find the compose_dm_reply step.
  const step = mission.steps.find((s) => s.toolName === 'compose_dm_reply' && s.status === 'COMPLETED');
  if (!step || typeof step.toolResult !== 'string') { return null; }

  const payload = extractDmPayload(step.toolResult);
  if (!payload) { return null; }

  // Check the inboundSocialEvents doc for a prior send.
  const eventId = sourceEvent.eventId;
  const replied = await isAlreadyReplied(eventId);
  if (replied) { return null; }

  return {
    missionId: mission.missionId,
    stepId: step.stepId,
    senderHandle: sourceEvent.senderHandle,
    inboundText: payload.inboundText,
    draftReply: payload.draftReply,
    receivedAt: mission.createdAt,
  };
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
): Promise<NextResponse> {
  try {
    const rl = await rateLimitMiddleware(request, '/api/social/platforms/dm-inbox');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }

    const rawParams = await params;
    const parsed = PlatformSchema.safeParse(rawParams);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const platform = parsed.data.platform;
    const expectedKind = SOURCE_EVENT_KIND_BY_PLATFORM[platform];

    if (!expectedKind) {
      // Platform has no DM capability — return empty inbox immediately.
      return NextResponse.json({ pending: [] });
    }

    if (!adminDb) {
      return NextResponse.json({ pending: [] });
    }

    // Query COMPLETED missions ordered newest-first. Limit to 50 to bound
    // the per-request Firestore read cost. In-memory filter by sourceEvent.kind
    // follows because Firestore doesn't auto-index nested fields.
    const missionsPath = getSubCollection('missions');
    const snap = await adminDb
      .collection(missionsPath)
      .where('status', '==', 'COMPLETED')
      .orderBy('createdAt', 'desc')
      .limit(50)
      .get();

    const pendingItems: PendingDmItem[] = [];

    for (const doc of snap.docs) {
      const mission = doc.data() as Mission;
      const item = await missionToPendingItem(mission, expectedKind);
      if (item) {
        pendingItems.push(item);
      }
      // Return at most 20 pending DMs in the inbox — if there are more,
      // the operator should work through Mission Control directly.
      if (pendingItems.length >= 20) { break; }
    }

    // Fallback: if no missions were found via the primary path, scan for
    // missions whose first step is compose_dm_reply and whose step
    // toolResult.platform matches. This handles missions written by an
    // older dispatcher revision that may not have stamped sourceEvent
    // reliably. The fallback is intentionally narrow (limit 20) and
    // only runs when the primary path returns 0 results.
    // HONEST COMMENT: this fallback was NOT verified against live Firestore
    // because the primary path is the authoritative shape. If the primary
    // path consistently returns results, this branch is dead code. It is
    // kept to prevent silent gaps in deployments that run an older
    // dispatcher version alongside a newer inbox API.
    if (pendingItems.length === 0) {
      const fallbackSnap = await adminDb
        .collection(missionsPath)
        .where('status', '==', 'COMPLETED')
        .orderBy('createdAt', 'desc')
        .limit(20)
        .get();

      for (const doc of fallbackSnap.docs) {
        const mission = doc.data() as Mission;
        // Look for a compose_dm_reply step whose toolResult mentions the platform.
        const step = mission.steps.find(
          (s) => s.toolName === 'compose_dm_reply' && s.status === 'COMPLETED',
        );
        if (!step || typeof step.toolResult !== 'string') { continue; }
        let stepParsed: unknown;
        try { stepParsed = JSON.parse(step.toolResult); } catch { continue; }
        if (!stepParsed || typeof stepParsed !== 'object') { continue; }
        const stepData = stepParsed as Record<string, unknown>;
        // Only match this platform via the toolResult.platform field.
        // Type-guard the unknown field before comparing.
        const inboundPlatformRaw = stepData.platform;
        const inboundPlatform = typeof inboundPlatformRaw === 'string' ? inboundPlatformRaw : undefined;
        const platformMatchMap: Partial<Record<SocialPlatform, string>> = {
          twitter: 'x',
          bluesky: 'bluesky',
          mastodon: 'mastodon',
          linkedin: 'linkedin',
          facebook: 'facebook',
          instagram: 'instagram',
          pinterest: 'pinterest',
        };
        if (inboundPlatform !== platformMatchMap[platform]) { continue; }
        // Construct a synthetic sourceEvent for the fallback path so
        // missionToPendingItem can check isAlreadyReplied. We only reach
        // this branch when mission.sourceEvent is missing or mismatched,
        // so we synthesize the minimum required fields.
        const syntheticEventId = typeof stepData.inboundEventId === 'string'
          ? stepData.inboundEventId
          : '';
        if (!syntheticEventId) { continue; }
        const replied = await isAlreadyReplied(syntheticEventId);
        if (replied) { continue; }
        const payload = extractDmPayload(step.toolResult);
        if (!payload) { continue; }
        pendingItems.push({
          missionId: mission.missionId,
          stepId: step.stepId,
          senderHandle: mission.sourceEvent?.senderHandle,
          inboundText: payload.inboundText,
          draftReply: payload.draftReply,
          receivedAt: mission.createdAt,
        });
        if (pendingItems.length >= 20) { break; }
      }
    }

    logger.debug('[dm-inbox] GET complete', {
      platform,
      pendingCount: pendingItems.length,
    });

    return NextResponse.json({ pending: pendingItems });
  } catch (error: unknown) {
    logger.error(
      '[dm-inbox] GET failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Failed to load DM inbox' },
      { status: 500 },
    );
  }
}
