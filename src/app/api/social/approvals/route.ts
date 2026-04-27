/**
 * API Route: Social Approval Workflow
 *
 * GET  /api/social/approvals             → List approvals (with optional status/platform filter)
 * POST /api/social/approvals             → Create a new approval item
 * PUT  /api/social/approvals             → Update approval status (approve/reject/revision)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { rateLimitMiddleware } from '@/lib/rate-limit/rate-limiter';
import { ApprovalService } from '@/lib/social/approval-service';
import { createTrainingFeedback } from '@/lib/training/training-feedback-service';
import { SOCIAL_PLATFORMS, type ApprovalStatus, type SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const createApprovalSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1),
  platform: z.enum(SOCIAL_PLATFORMS),
  accountId: z.string().optional(),
  flagReason: z.string().min(1),
  flaggedBy: z.enum(['autonomous-agent', 'manual']).optional().default('manual'),
  scheduledFor: z.string().optional(),
});

const updateApprovalSchema = z.object({
  approvalId: z.string().min(1),
  status: z.enum(['pending_review', 'approved', 'rejected', 'revision_requested']),
  comment: z.string().optional(),
  correctedContent: z.string().optional(),
  originalContent: z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/approvals');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status') as ApprovalStatus | null;
    const platform = searchParams.get('platform') as SocialPlatform | null;

    // If requesting counts only
    if (searchParams.get('counts') === 'true') {
      const counts = await ApprovalService.getCounts();
      return NextResponse.json({ success: true, counts });
    }

    const approvals = await ApprovalService.listApprovals({
      status: status ?? undefined,
      platform: platform ?? undefined,
    });

    return NextResponse.json({ success: true, approvals, total: approvals.length });
  } catch (error: unknown) {
    logger.error('Approvals API: GET failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to list approvals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/approvals');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = createApprovalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const approval = await ApprovalService.createApproval(validation.data);

    return NextResponse.json({ success: true, approval });
  } catch (error: unknown) {
    logger.error('Approvals API: POST failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to create approval' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const rateLimitResponse = await rateLimitMiddleware(request, '/api/social/approvals');
    if (rateLimitResponse) {return rateLimitResponse;}

    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {return authResult;}

    const body: unknown = await request.json();
    const validation = updateApprovalSchema.safeParse(body);

    if (!validation.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', details: validation.error.errors },
        { status: 400 }
      );
    }

    const { approvalId, status, comment, correctedContent, originalContent } = validation.data;

    const updated = await ApprovalService.updateStatus(
      approvalId,
      status,
      authResult.user.uid,
      comment
    );

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Approval not found' },
        { status: 404 }
      );
    }

    // Write a TrainingFeedback record when the operator approves with edits,
    // so the correction enters the real training loop (grade → Prompt Engineer → new GM version).
    if (status === 'approved' && correctedContent && originalContent && correctedContent !== originalContent) {
      const SPECIALIST_BY_PLATFORM: Partial<Record<SocialPlatform, { id: string; name: string }>> = {
        twitter:   { id: 'TWITTER_X_EXPERT',    name: 'Twitter/X Expert' },
        bluesky:   { id: 'BLUESKY_EXPERT',       name: 'Bluesky Expert' },
        mastodon:  { id: 'MASTODON_EXPERT',      name: 'Mastodon Expert' },
        linkedin:  { id: 'LINKEDIN_EXPERT',      name: 'LinkedIn Expert' },
        facebook:  { id: 'FACEBOOK_ADS_EXPERT',  name: 'Facebook Ads Expert' },
        instagram: { id: 'INSTAGRAM_EXPERT',     name: 'Instagram Expert' },
        pinterest: { id: 'PINTEREST_EXPERT',     name: 'Pinterest Expert' },
        tiktok:    { id: 'TIKTOK_EXPERT',        name: 'TikTok Expert' },
        youtube:   { id: 'YOUTUBE_EXPERT',       name: 'YouTube Expert' },
      };
      const specialist = SPECIALIST_BY_PLATFORM[updated.platform];
      if (!specialist) {
        logger.debug('Approvals API: No specialist mapped for platform — skipping TrainingFeedback write', { platform: updated.platform, approvalId });
      } else {
        try {
          await createTrainingFeedback({
            targetSpecialistId: specialist.id,
            targetSpecialistName: specialist.name,
            sourceReportTaskId: updated.postId,
            sourceReportExcerpt: correctedContent,
            grade: 'approve_with_notes',
            explanation: `Approved with operator edits — original: "${originalContent.slice(0, 200)}"`,
            graderUserId: authResult.user.uid,
          });
          logger.info('Approvals API: TrainingFeedback written for specialist training', { approvalId, specialist: specialist.id });
        } catch (feedbackError) {
          // Non-blocking — don't fail the approval if the feedback write fails
          logger.error('Approvals API: Failed to write TrainingFeedback', feedbackError instanceof Error ? feedbackError : new Error(String(feedbackError)));
        }
      }
    }

    return NextResponse.json({ success: true, approval: updated });
  } catch (error: unknown) {
    logger.error('Approvals API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update approval' },
      { status: 500 }
    );
  }
}
