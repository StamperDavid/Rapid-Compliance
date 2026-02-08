/**
 * Approvals API Endpoint
 *
 * GET /api/orchestrator/approvals
 *   Returns all pending approvals.
 *
 * POST /api/orchestrator/approvals
 *   Process an approval decision (approve or reject).
 *   Body: { approvalId: string, decision: 'APPROVED' | 'REJECTED', reason?: string }
 *
 * Authentication: Required (owner or admin)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { getJasperCommandAuthority } from '@/lib/orchestrator/jasper-command-authority';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';

export const dynamic = 'force-dynamic';

const ApprovalDecisionSchema = z.object({
  approvalId: z.string().min(1, 'approvalId is required'),
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional(),
});

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const authority = getJasperCommandAuthority();
    const approvals = authority.getPendingApprovals();

    return NextResponse.json({
      success: true,
      approvals: approvals.map(a => ({
        ...a,
        createdAt: a.createdAt.toISOString(),
        expiresAt: a.expiresAt?.toISOString() ?? null,
      })),
      count: approvals.length,
    });
  } catch (error: unknown) {
    logger.error(
      'Approvals fetch failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/approvals' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch approvals' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = ApprovalDecisionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { approvalId, decision, reason } = parsed.data;
    const authority = getJasperCommandAuthority();
    const result = await authority.processApproval(approvalId, decision, reason);

    return NextResponse.json({
      success: result.status !== 'FAILED',
      result,
    });
  } catch (error: unknown) {
    logger.error(
      'Approval processing failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/approvals' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to process approval' },
      { status: 500 }
    );
  }
}
