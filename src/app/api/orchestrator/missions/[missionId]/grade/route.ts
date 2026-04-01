/**
 * Mission Grade API — Submit or fetch grades for a mission
 *
 * POST /api/orchestrator/missions/[missionId]/grade  — Submit a grade
 * GET  /api/orchestrator/missions/[missionId]/grade  — Fetch all grades
 *
 * Authentication: Required (any authenticated user)
 */

import { NextResponse, type NextRequest } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { submitGrade, getGradesForMission } from '@/lib/orchestrator/mission-grade-service';
import { logger } from '@/lib/logger/logger';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ missionId: string }>;
}

const GradeSchema = z.object({
  stepId: z.string().optional(),
  score: z.number().int().min(1).max(5),
  explanation: z.string().max(1000).optional(),
});

export async function POST(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  const { user } = authResult;

  try {
    const { missionId } = await context.params;

    if (!missionId) {
      return NextResponse.json(
        { success: false, error: 'missionId is required' },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();
    const parsed = GradeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid grade payload', details: parsed.error.flatten() },
        { status: 422 }
      );
    }

    const { score, stepId, explanation } = parsed.data;

    const gradeId = await submitGrade(
      missionId,
      user.uid,
      score,
      stepId,
      explanation
    );

    return NextResponse.json({ success: true, data: { gradeId } });
  } catch (error: unknown) {
    logger.error(
      'Mission grade submission failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/[missionId]/grade', method: 'POST' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to submit grade' },
      { status: 500 }
    );
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { missionId } = await context.params;

    if (!missionId) {
      return NextResponse.json(
        { success: false, error: 'missionId is required' },
        { status: 400 }
      );
    }

    const grades = await getGradesForMission(missionId);

    return NextResponse.json({ success: true, data: { grades } });
  } catch (error: unknown) {
    logger.error(
      'Mission grades fetch failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/[missionId]/grade', method: 'GET' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch grades' },
      { status: 500 }
    );
  }
}
