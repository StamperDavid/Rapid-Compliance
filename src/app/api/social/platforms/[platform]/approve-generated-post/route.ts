/**
 * Approve Generated Post
 *
 * POST /api/social/platforms/{platform}/approve-generated-post
 *
 * Called by the InlineReviewCard when the operator clicks "Post now" or
 * "Schedule for later". Fetches the pending mission, publishes or schedules
 * the content, then marks the mission as COMPLETED.
 *
 * Standing Rule #2: this route does NOT mutate any Golden Master document.
 * Grading (if any) is a separate, independent action via the StepGradeWidget
 * API path and does NOT happen here.
 *
 * Body:
 *   {
 *     missionId: string;
 *     postAt: 'now' | '<ISO 8601 timestamp>';
 *     finalText?: string;       // operator may have edited the AI copy
 *     finalMediaUrls?: string[];
 *   }
 *
 * Response on success: { success: true, postId?: string, scheduledPostId?: string }
 * Response on error:   { success: false, error: string }
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import {
  getMission,
  updateMissionStep,
  finalizeMission,
  type Mission,
} from '@/lib/orchestrator/mission-persistence';
import { SocialPostService } from '@/lib/social/social-post-service';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';

export const dynamic = 'force-dynamic';

// ── Validation schemas ────────────────────────────────────────────────────────

const PlatformParamSchema = z.object({
  platform: z.enum(SOCIAL_PLATFORMS as unknown as readonly [SocialPlatform, ...SocialPlatform[]]),
});

const ApproveBodySchema = z.object({
  missionId: z.string().min(1).max(200),
  /**
   * 'now' to post immediately, or an ISO 8601 datetime string to schedule.
   */
  postAt: z.string().min(1),
  /** Operator may have edited the AI copy before posting. */
  finalText: z.string().min(1).max(50000).optional(),
  finalMediaUrls: z.array(z.string().url()).max(10).optional(),
});

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Extract the review-ready content from the step-3 toolResult JSON.
 * Falls back to step-1 output if step-3 has no toolResult yet.
 */
function extractContentFromMission(mission: Mission): {
  text: string;
  mediaUrls: string[];
} {
  const steps = mission.steps ?? [];

  // Prefer step 3 (await_review) toolResult which has the materialised output.
  const step3 = steps.find((s) => s.toolName === 'await_review');
  if (step3?.toolResult) {
    try {
      const parsed = JSON.parse(step3.toolResult) as { finalText?: string; mediaUrls?: string[] };
      if (typeof parsed.finalText === 'string' && parsed.finalText.length > 0) {
        return {
          text: parsed.finalText,
          mediaUrls: Array.isArray(parsed.mediaUrls) ? parsed.mediaUrls : [],
        };
      }
    } catch {
      // Fall through to step-2
    }
  }

  // Fallback: step 2 (materialize_content) toolResult.
  const step2 = steps.find((s) => s.toolName === 'materialize_content');
  if (step2?.toolResult) {
    try {
      const parsed = JSON.parse(step2.toolResult) as { finalText?: string; mediaUrls?: string[] };
      if (typeof parsed.finalText === 'string' && parsed.finalText.length > 0) {
        return {
          text: parsed.finalText,
          mediaUrls: Array.isArray(parsed.mediaUrls) ? parsed.mediaUrls : [],
        };
      }
    } catch {
      // Fall through to step-1
    }
  }

  // Last resort: step 1 (generate_brief) primaryPost field.
  const step1 = steps.find((s) => s.toolName === 'generate_brief');
  if (step1?.toolResult) {
    try {
      const parsed = JSON.parse(step1.toolResult) as { primaryPost?: string };
      if (typeof parsed.primaryPost === 'string' && parsed.primaryPost.length > 0) {
        return { text: parsed.primaryPost, mediaUrls: [] };
      }
    } catch {
      // Swallow
    }
  }

  return { text: '', mediaUrls: [] };
}

/**
 * Resolve the step-3 stepId from the mission.
 */
function getStep3Id(mission: Mission): string | undefined {
  return mission.steps.find((s) => s.toolName === 'await_review')?.stepId;
}

/**
 * Mark step 3 as COMPLETED and flip mission to COMPLETED in a single
 * Firestore transaction.
 */
async function completeMission(missionId: string, step3Id: string): Promise<void> {
  if (!adminDb) { return; }
  const { FieldValue } = await import('firebase-admin/firestore');
  const docRef = adminDb.collection(getSubCollection('missions')).doc(missionId);

  await adminDb.runTransaction(async (tx) => {
    const doc = await tx.get(docRef);
    if (!doc.exists) { return; }
    const m = doc.data() as Mission;

    const idx = m.steps.findIndex((s) => s.stepId === step3Id);
    if (idx === -1) { return; }

    const now = new Date().toISOString();
    const updatedSteps = [...m.steps];
    updatedSteps[idx] = {
      ...updatedSteps[idx],
      status: 'COMPLETED',
      completedAt: now,
      summary: 'Operator approved — content published or scheduled.',
    };

    tx.update(docRef, {
      steps: updatedSteps,
      status: 'COMPLETED',
      completedAt: now,
      approvalRequired: false,
      updatedAt: FieldValue.serverTimestamp(),
    });
  });
}

// ── POST handler ──────────────────────────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ platform: string }> },
) {
  // Rate limit
  const rl = await rateLimitMiddleware(request, '/api/social/platforms/approve-generated-post');
  if (rl) { return rl; }

  // Auth
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    // Platform param
    const rawParams = await params;
    const parsedPlatform = PlatformParamSchema.safeParse(rawParams);
    if (!parsedPlatform.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid or unsupported platform', details: parsedPlatform.error.flatten() },
        { status: 422 },
      );
    }
    const platform = parsedPlatform.data.platform;

    // Body
    const rawBody: unknown = await request.json();
    const parsedBody = ApproveBodySchema.safeParse(rawBody);
    if (!parsedBody.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request body', details: parsedBody.error.flatten() },
        { status: 422 },
      );
    }

    const { missionId, postAt, finalText, finalMediaUrls } = parsedBody.data;

    // Fetch mission
    const mission = await getMission(missionId);
    if (!mission) {
      return NextResponse.json(
        { success: false, error: `Mission "${missionId}" not found.` },
        { status: 404 },
      );
    }

    // Confirm this is a social post mission in AWAITING_APPROVAL.
    const missionKind = mission.metadata?.['kind'];
    const missionPlatform = mission.metadata?.['platform'];

    if (missionKind !== 'social_post_generation') {
      return NextResponse.json(
        { success: false, error: 'Mission is not a social_post_generation mission.' },
        { status: 409 },
      );
    }
    if (mission.status !== 'AWAITING_APPROVAL') {
      return NextResponse.json(
        {
          success: false,
          error: `Mission is in status "${mission.status}", expected AWAITING_APPROVAL.`,
        },
        { status: 409 },
      );
    }
    if (missionPlatform && missionPlatform !== platform) {
      return NextResponse.json(
        {
          success: false,
          error: `Mission platform "${missionPlatform}" does not match route platform "${platform}".`,
        },
        { status: 409 },
      );
    }

    const step3Id = getStep3Id(mission);
    if (!step3Id) {
      return NextResponse.json(
        { success: false, error: 'Mission does not have an await_review step.' },
        { status: 500 },
      );
    }

    // Resolve content — operator override takes precedence.
    const extracted = extractContentFromMission(mission);
    const postContent = finalText ?? extracted.text;
    const mediaUrls = finalMediaUrls ?? extracted.mediaUrls;

    if (!postContent) {
      return NextResponse.json(
        {
          success: false,
          error:
            'No content found in mission steps and no finalText provided. Cannot approve an empty post.',
        },
        { status: 422 },
      );
    }

    // ── Post now ────────────────────────────────────────────────────────────
    if (postAt === 'now') {
      const { AutonomousPostingAgent } = await import('@/lib/social/autonomous-posting-agent');
      const agent = AutonomousPostingAgent.getInstance();
      const result = await agent.publishNow(platform, postContent, {
        contentType: 'post',
        ...(mediaUrls.length > 0 ? { mediaUrls: mediaUrls.join(',') } : {}),
      });

      if (!result.success) {
        // Mark step 3 FAILED but leave mission open so operator can retry.
        await updateMissionStep(missionId, step3Id, {
          status: 'FAILED',
          completedAt: new Date().toISOString(),
          error: result.error ?? `Publishing to ${platform} failed`,
          summary: `Publishing failed: ${result.error ?? 'unknown error'}`,
        });
        await finalizeMission(missionId, 'FAILED', result.error ?? `Publishing to ${platform} failed`);

        logger.error('[ApprovePost] Publish failed', undefined, {
          missionId,
          platform,
          error: result.error,
        });
        return NextResponse.json(
          { success: false, error: result.error ?? `Publishing to ${platform} failed` },
          { status: 502 },
        );
      }

      // Success — mark mission COMPLETED.
      await completeMission(missionId, step3Id);

      logger.info('[ApprovePost] Published immediately', {
        missionId,
        platform,
        platformPostId: result.postId,
      });

      return NextResponse.json({
        success: true,
        postId: result.postId ?? null,
        missionId,
        platform,
      });
    }

    // ── Schedule for later ──────────────────────────────────────────────────
    const scheduledDate = new Date(postAt);
    if (isNaN(scheduledDate.getTime())) {
      return NextResponse.json(
        {
          success: false,
          error: `"postAt" value "${postAt}" is not a valid ISO timestamp. Use 'now' or a valid ISO 8601 datetime.`,
        },
        { status: 422 },
      );
    }
    if (scheduledDate <= new Date()) {
      return NextResponse.json(
        {
          success: false,
          error: 'Scheduled time must be in the future. Use postAt="now" to post immediately.',
        },
        { status: 422 },
      );
    }

    const scheduledPost = await SocialPostService.createScheduledPost({
      platform,
      content: postContent,
      scheduledAt: scheduledDate,
      mediaUrls: mediaUrls.length > 0 ? mediaUrls : undefined,
      createdBy: authResult.user.uid,
      createdByEmail: authResult.user.email ?? undefined,
    });

    // Mark mission COMPLETED.
    await completeMission(missionId, step3Id);

    logger.info('[ApprovePost] Scheduled', {
      missionId,
      platform,
      scheduledAt: scheduledDate.toISOString(),
      scheduledPostId: scheduledPost.id,
    });

    return NextResponse.json({
      success: true,
      scheduledPostId: scheduledPost.id,
      scheduledAt: scheduledDate.toISOString(),
      missionId,
      platform,
    });
  } catch (err) {
    logger.error(
      '[ApprovePost] Unexpected error',
      err instanceof Error ? err : new Error(String(err)),
    );
    return NextResponse.json(
      {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to approve generated post',
      },
      { status: 500 },
    );
  }
}
