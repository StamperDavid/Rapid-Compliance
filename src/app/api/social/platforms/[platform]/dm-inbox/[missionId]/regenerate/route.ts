/**
 * Regenerate DM Reply
 *
 * POST /api/social/platforms/{platform}/dm-inbox/{missionId}/regenerate
 *
 * Re-runs the platform specialist's compose_dm_reply action for an existing
 * inbound-DM mission and updates the step's toolResult with the new draft.
 * The mission status stays COMPLETED (unchanged). The operator can then
 * review the new draft and send it via the normal send-dm-reply path.
 *
 * Body (all optional):
 *   instructions?: string  — steering note for this regeneration (logged
 *     for audit; not yet wired into the specialist prompt — that path
 *     requires a TrainingFeedback record per Standing Rule #2)
 *
 * Response:
 *   { success: true, draftReply: string }
 *   { success: false, error: string }
 *
 * Standing Rule #2: this endpoint does NOT modify any Golden Master.
 * It re-executes the specialist with the SAME GM and the SAME inbound
 * context. The `instructions` body field steers the operator's intent
 * but does NOT feed into the Prompt Engineer pipeline — that requires a
 * human grade via the TrainingFeedback / StepGradeWidget flow.
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { getMission, updateMissionStep } from '@/lib/orchestrator/mission-persistence';
import { orchestrateInboundDmReply, type InboundDmPlatform } from '@/lib/social/inbound-dm-orchestration-service';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const PlatformSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const BodySchema = z.object({
  instructions: z.string().max(500).optional(),
});

/**
 * Maps a SocialPlatform to the InboundDmPlatform string used by the
 * orchestration service. Only platforms with a wired specialist are listed.
 */
const INBOUND_PLATFORM_BY_SOCIAL: Partial<Record<SocialPlatform, InboundDmPlatform>> = {
  twitter: 'x',
  bluesky: 'bluesky',
  mastodon: 'mastodon',
  linkedin: 'linkedin',
  facebook: 'facebook',
  instagram: 'instagram',
  pinterest: 'pinterest',
};

interface StepResultShape {
  inboundText?: string;
  senderId?: string;
  senderHandle?: string;
  inboundEventId?: string;
  platform?: string;
  composedReply?: {
    replyText?: string;
  };
}

function parseStepResult(toolResult: string): StepResultShape | null {
  try {
    const parsed = JSON.parse(toolResult) as unknown;
    if (!parsed || typeof parsed !== 'object') { return null; }
    return parsed as StepResultShape;
  } catch {
    return null;
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string; missionId: string }> },
): Promise<NextResponse> {
  try {
    const rl = await rateLimitMiddleware(request, '/api/social/platforms/dm-inbox/regenerate');
    if (rl) { return rl; }

    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) { return auth; }
    const { user } = auth;

    if (user.role !== 'owner' && user.role !== 'admin') {
      return NextResponse.json({ success: false, error: 'Insufficient permissions' }, { status: 403 });
    }

    const rawParams = await params;
    const parsedPlatform = PlatformSchema.safeParse({ platform: rawParams.platform });
    if (!parsedPlatform.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform' },
        { status: 422 },
      );
    }
    const platform = parsedPlatform.data.platform;
    const { missionId } = rawParams;
    if (!missionId) {
      return NextResponse.json({ success: false, error: 'missionId required' }, { status: 400 });
    }

    let body: z.infer<typeof BodySchema> = {};
    try {
      const raw: unknown = await request.json().catch(() => ({}));
      const parsed = BodySchema.safeParse(raw);
      if (parsed.success) { body = parsed.data; }
    } catch {
      // empty body is fine
    }

    const inboundPlatform = INBOUND_PLATFORM_BY_SOCIAL[platform];
    if (!inboundPlatform) {
      return NextResponse.json(
        { success: false, error: `${platform} does not support inbound DM regeneration` },
        { status: 409 },
      );
    }

    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json({ success: false, error: 'Mission not found' }, { status: 404 });
    }

    // Locate the compose_dm_reply step to pull the original inbound context.
    const dmStep = mission.steps.find(
      (s) => s.toolName === 'compose_dm_reply' && s.status === 'COMPLETED',
    );
    if (!dmStep || typeof dmStep.toolResult !== 'string') {
      return NextResponse.json(
        { success: false, error: 'No completed compose_dm_reply step found on this mission' },
        { status: 409 },
      );
    }

    const stepData = parseStepResult(dmStep.toolResult);
    if (!stepData) {
      return NextResponse.json(
        { success: false, error: 'Could not parse existing step toolResult' },
        { status: 409 },
      );
    }

    const inboundText = stepData.inboundText ?? '';
    const senderId = stepData.senderId ?? mission.sourceEvent?.senderId ?? '';
    const senderHandle = stepData.senderHandle ?? mission.sourceEvent?.senderHandle;
    const inboundEventId = stepData.inboundEventId ?? mission.sourceEvent?.eventId ?? '';

    if (!inboundText || !senderId || !inboundEventId) {
      return NextResponse.json(
        {
          success: false,
          error: 'Missing inboundText, senderId, or inboundEventId in original step — cannot regenerate',
        },
        { status: 409 },
      );
    }

    logger.info('[dm-inbox/regenerate] Starting re-compose', {
      platform,
      missionId,
      inboundEventId,
      hasInstructions: Boolean(body.instructions),
      actorUid: user.uid,
    });

    // Re-run the specialist. orchestrateInboundDmReply writes a NEW mission
    // as a side-effect, but we only use its composedReply — we update the
    // EXISTING step in the EXISTING mission so the operator's Mission Control
    // view stays coherent. The side-effect mission is a harmless extra record
    // (it won't have a linked inboundSocialEvents doc with reply.sentAt, so
    // it would show up in the inbox as a duplicate — we prevent this by
    // using a unique synthetic eventId for the regeneration call).
    const syntheticEventId = `${inboundEventId}_regen_${Date.now()}`;

    const regenResult = await orchestrateInboundDmReply({
      platform: inboundPlatform,
      inboundEventId: syntheticEventId,
      inboundText,
      senderId,
      ...(senderHandle ? { senderHandle } : {}),
    });

    // Delete the side-effect mission so the inbox stays clean.
    // This is a best-effort cleanup — if it fails, the orphan mission
    // will have a synthetic eventId that will never match a real
    // inboundSocialEvents doc, so `isAlreadyReplied` will return false
    // and it will briefly appear in the inbox. A future GC cron can clean
    // these up. We accept this rather than blocking the regeneration path.
    if (adminDb) {
      const missionsPath = getSubCollection('missions');
      void adminDb.collection(missionsPath).doc(regenResult.missionId).delete().catch((cleanupErr: unknown) => {
        logger.warn('[dm-inbox/regenerate] side-effect mission cleanup failed', {
          sideEffectMissionId: regenResult.missionId,
          error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
        });
      });
    }

    // Update the original step's toolResult with the new draft.
    // Cast stepData to Record<string, unknown> for the spread — the shape
    // is already validated above; we're rebuilding the JSON string.
    const updatedResult: Record<string, unknown> = {
      ...(stepData as Record<string, unknown>),
      composedReply: {
        replyText: regenResult.composedReply,
        reasoning: regenResult.reasoning,
        confidence: regenResult.confidence,
        suggestEscalation: regenResult.suggestEscalation,
      },
    };

    await updateMissionStep(missionId, dmStep.stepId, {
      toolResult: JSON.stringify(updatedResult),
      summary: `${mission.steps.find((s) => s.stepId === dmStep.stepId)?.delegatedTo ?? 'SPECIALIST'} regenerated reply (${regenResult.confidence} confidence${regenResult.suggestEscalation ? ', escalation suggested' : ''})`,
    });

    logger.info('[dm-inbox/regenerate] Step updated with new draft', {
      missionId,
      stepId: dmStep.stepId,
      confidence: regenResult.confidence,
    });

    return NextResponse.json({
      success: true,
      draftReply: regenResult.composedReply,
    });
  } catch (error: unknown) {
    logger.error(
      '[dm-inbox/regenerate] POST failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return NextResponse.json(
      { success: false, error: error instanceof Error ? error.message : 'Regeneration failed' },
      { status: 500 },
    );
  }
}
