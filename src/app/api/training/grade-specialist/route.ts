/**
 * Grade Specialist API
 *
 * Entry point for the Phase 3 grade-to-prompt-edit pipeline for the
 * rebuilt specialist swarm (specialistGoldenMasters collection).
 *
 * This is SEPARATE from /api/training/propose-prompt-revision, which
 * operates on the legacy Training Lab top-level goldenMasters collection
 * (Jasper orchestrator + chat widget GMs). Both routes coexist.
 *
 * POST /api/training/grade-specialist
 *   Creates a TrainingFeedback record + runs the Prompt Engineer to
 *   propose a surgical prompt edit. Returns EDIT_PROPOSED (with diff)
 *   or CLARIFICATION_NEEDED (with questions).
 *
 * GET /api/training/grade-specialist?status=pending_review
 *   Lists TrainingFeedback records filtered by status. Used by the
 *   Swarm Training UI to show pending reviews.
 *
 * Both methods gated by requireRole(['owner', 'admin']) — grading
 * specialists is a high-impact operation that can change production
 * prompts.
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireRole } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { submitGrade } from '@/lib/training/grade-submission-service';
import {
  listTrainingFeedbackByStatus,
  listTrainingFeedbackForSpecialist,
} from '@/lib/training/training-feedback-service';
import type { TrainingFeedback } from '@/types/training';

export const dynamic = 'force-dynamic';

// ============================================================================
// POST — submit a grade
// ============================================================================

const SubmitGradeSchema = z.object({
  targetSpecialistId: z.string().min(1).max(100),
  targetSpecialistName: z.string().min(1).max(200),
  sourceReportTaskId: z.string().min(1).max(300),
  sourceReportExcerpt: z.string().min(1).max(20000),
  grade: z.enum(['reject', 'request_revision', 'approve_with_notes']),
  explanation: z.string().min(5).max(5000),
  industryKey: z.string().min(1).max(100).optional(),
});

export async function POST(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }
  const { user } = authResult;

  try {
    const body: unknown = await request.json();
    const parsed = SubmitGradeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid request payload', details: parsed.error.flatten() },
        { status: 422 },
      );
    }

    const result = await submitGrade({
      targetSpecialistId: parsed.data.targetSpecialistId,
      targetSpecialistName: parsed.data.targetSpecialistName,
      sourceReportTaskId: parsed.data.sourceReportTaskId,
      sourceReportExcerpt: parsed.data.sourceReportExcerpt,
      grade: parsed.data.grade,
      explanation: parsed.data.explanation,
      graderUserId: user.uid,
      graderDisplayName: user.email ?? undefined,
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
      '[GradeSpecialistAPI] POST failed',
      error instanceof Error ? error : new Error(errorMessage),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}

// ============================================================================
// GET — list feedback records
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requireRole(request, ['owner', 'admin']);
  if (authResult instanceof NextResponse) { return authResult; }

  try {
    const { searchParams } = new URL(request.url);
    const statusParam = searchParams.get('status');
    const specialistId = searchParams.get('specialistId');
    const limitParam = searchParams.get('limit');
    const limit = limitParam ? Math.max(1, Math.min(200, parseInt(limitParam, 10))) : 50;

    let records: TrainingFeedback[];

    if (specialistId) {
      records = await listTrainingFeedbackForSpecialist(specialistId, limit);
    } else if (statusParam) {
      const statusValues: TrainingFeedback['status'][] = ['pending_review', 'applied', 'discarded', 'clarification_needed'];
      if (!statusValues.includes(statusParam as TrainingFeedback['status'])) {
        return NextResponse.json(
          { success: false, error: `Invalid status. Allowed: ${statusValues.join(', ')}` },
          { status: 422 },
        );
      }
      records = await listTrainingFeedbackByStatus(statusParam as TrainingFeedback['status'], limit);
    } else {
      records = await listTrainingFeedbackByStatus('pending_review', limit);
    }

    return NextResponse.json({ success: true, records, count: records.length });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error(
      '[GradeSpecialistAPI] GET failed',
      error instanceof Error ? error : new Error(errorMessage),
    );
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 },
    );
  }
}
