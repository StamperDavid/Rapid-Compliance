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
import type { ApprovalStatus, SocialPlatform } from '@/types/social';

export const dynamic = 'force-dynamic';

const createApprovalSchema = z.object({
  postId: z.string().min(1),
  content: z.string().min(1),
  platform: z.enum(['twitter', 'linkedin']),
  accountId: z.string().optional(),
  flagReason: z.string().min(1),
  flaggedBy: z.enum(['autonomous-agent', 'manual']).optional().default('manual'),
  scheduledFor: z.string().optional(),
});

const updateApprovalSchema = z.object({
  approvalId: z.string().min(1),
  status: z.enum(['pending_review', 'approved', 'rejected', 'revision_requested']),
  comment: z.string().optional(),
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

    const { approvalId, status, comment } = validation.data;

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

    return NextResponse.json({ success: true, approval: updated });
  } catch (error: unknown) {
    logger.error('Approvals API: PUT failed', error instanceof Error ? error : new Error(String(error)));
    return NextResponse.json(
      { success: false, error: 'Failed to update approval' },
      { status: 500 }
    );
  }
}
