/**
 * Approve Prompt Edit API
 *
 * POST /api/training/grade-specialist/[feedbackId]/approve
 *
 * Human approved the Prompt Engineer's proposed edit. Creates a new
 * versioned Golden Master with the edit applied, deploys it atomically,
 * invalidates the specialist's GM cache, and marks the feedback applied.
 *
 * Body: the EditProposedResult the human is approving (possibly with
 * tweaked proposedText). currentText must still appear verbatim in the
 * target specialist's active systemPrompt — the deploy path re-verifies.
 *
 * Gated by requireRole(['owner', 'admin']).
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { approvePromptEdit } from '@/lib/training/grade-submission-service';

export const dynamic = 'force-dynamic';

const ApproveEditSchema = z.object({
  approvedEdit: z.object({
    status: z.literal('EDIT_PROPOSED'),
    targetSection: z.object({
      headingOrLocation: z.string().min(1).max(500),
      reasoning: z.string().min(20).max(1500),
    }),
    currentText: z.string().min(1).max(8000),
    proposedText: z.string().min(1).max(8000),
    rationale: z.string().min(30).max(3000),
    confidence: z.number().int().min(0).max(100),
    conflictsWithOtherSections: z.array(z.string().min(1).max(600)).max(10),
    preservesBrandDna: z.literal(true),
  }),
  industryKey: z.string().min(1).max(100).optional(),
});

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ feedbackId: string }> },
) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  const { feedbackId } = await params;
  if (!feedbackId) {
    return NextResponse.json(
      { success: false, error: 'feedbackId is required' },
      { status: 400 },
    );
  }

  try {
    const body: unknown = await request.json();
    const parsed = ApproveEditSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await approvePromptEdit({
      feedbackId,
      approvedEdit: parsed.data.approvedEdit,
      approverUserId: user.uid,
      approverDisplayName: user.email ?? undefined,
      industryKey: parsed.data.industryKey,
    });

    if (result.status === 'ERROR') {
      return NextResponse.json(
        { success: false, error: result.error, feedbackId: result.feedbackId },
        { status: 422 },
      );
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      '[GradeSpecialistAPI] Approve failed',
      error instanceof Error ? error : new Error(errorMessage),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
