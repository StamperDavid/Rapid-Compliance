/**
 * Mission Schedules API — List all schedules or create a new one
 *
 * GET  /api/orchestrator/missions/schedules — Return all schedules
 * POST /api/orchestrator/missions/schedules — Create a new schedule from a completed mission
 *
 * Authentication: Required (any authenticated user)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';
import { getMission } from '@/lib/orchestrator/mission-persistence';
import {
  createSchedule,
  getSchedules,
} from '@/lib/orchestrator/mission-schedule-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMAS
// ============================================================================

const CreateScheduleSchema = z.object({
  sourceMissionId: z.string().min(1, 'sourceMissionId is required'),
  name: z.string().min(1, 'name is required').max(200, 'name must be 200 characters or less'),
  frequency: z.enum(['daily', 'weekly', 'biweekly', 'monthly', 'custom'], {
    errorMap: () => ({
      message: "frequency must be one of: daily, weekly, biweekly, monthly, custom",
    }),
  }),
  customIntervalHours: z.number().int().positive().optional(),
  expiresAt: z.string().datetime({ message: 'expiresAt must be a valid ISO 8601 date string' }).optional(),
});

// ============================================================================
// GET — List all schedules
// ============================================================================

export async function GET(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const schedules = await getSchedules();

    return NextResponse.json({
      success: true,
      data: { schedules },
    });
  } catch (error: unknown) {
    logger.error(
      'Schedule list failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/schedules' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to list schedules' },
      { status: 500 }
    );
  }
}

// ============================================================================
// POST — Create a new schedule from a completed mission
// ============================================================================

export async function POST(request: NextRequest) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const body: unknown = await request.json();
    const parsed = CreateScheduleSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Invalid request',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { sourceMissionId, name, frequency, customIntervalHours, expiresAt } = parsed.data;

    // 'custom' frequency requires customIntervalHours
    if (frequency === 'custom' && !customIntervalHours) {
      return NextResponse.json(
        {
          success: false,
          error: 'customIntervalHours is required when frequency is "custom"',
        },
        { status: 400 }
      );
    }

    // Load source mission to extract the original prompt
    const sourceMission = await getMission(sourceMissionId);
    if (!sourceMission) {
      return NextResponse.json(
        { success: false, error: 'Source mission not found' },
        { status: 404 }
      );
    }

    const schedule = await createSchedule(
      sourceMissionId,
      name,
      sourceMission.userPrompt,
      frequency,
      authResult.user.uid,
      customIntervalHours,
      expiresAt
    );

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Failed to create schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: true, data: { schedule } },
      { status: 201 }
    );
  } catch (error: unknown) {
    logger.error(
      'Schedule creation failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/schedules' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to create schedule' },
      { status: 500 }
    );
  }
}
