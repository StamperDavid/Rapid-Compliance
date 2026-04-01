/**
 * Single Schedule API — Fetch, update, or delete a specific schedule
 *
 * GET    /api/orchestrator/missions/schedules/[scheduleId] — Fetch schedule
 * PATCH  /api/orchestrator/missions/schedules/[scheduleId] — Update status (pause/resume)
 * DELETE /api/orchestrator/missions/schedules/[scheduleId] — Delete schedule permanently
 *
 * Authentication: Required (any authenticated user)
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import { z } from 'zod';
import {
  getSchedule,
  updateScheduleStatus,
  deleteSchedule,
} from '@/lib/orchestrator/mission-schedule-service';

export const dynamic = 'force-dynamic';

// ============================================================================
// SCHEMAS
// ============================================================================

const PatchScheduleSchema = z.object({
  status: z.enum(['active', 'paused'], {
    errorMap: () => ({
      message: 'status must be "active" or "paused"',
    }),
  }),
});

// ============================================================================
// ROUTE CONTEXT
// ============================================================================

interface RouteContext {
  params: Promise<{ scheduleId: string }>;
}

// ============================================================================
// GET — Fetch a single schedule
// ============================================================================

export async function GET(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { scheduleId } = await context.params;

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'scheduleId is required' },
        { status: 400 }
      );
    }

    const schedule = await getSchedule(scheduleId);

    if (!schedule) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: { schedule } });
  } catch (error: unknown) {
    logger.error(
      'Schedule fetch failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/schedules/[scheduleId]' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to fetch schedule' },
      { status: 500 }
    );
  }
}

// ============================================================================
// PATCH — Update schedule status (pause or resume)
// ============================================================================

export async function PATCH(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { scheduleId } = await context.params;

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'scheduleId is required' },
        { status: 400 }
      );
    }

    const body: unknown = await request.json();
    const parsed = PatchScheduleSchema.safeParse(body);

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

    const { status } = parsed.data;

    // Verify the schedule exists before updating
    const existing = await getSchedule(scheduleId);
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    const updated = await updateScheduleStatus(scheduleId, status);

    if (!updated) {
      return NextResponse.json(
        { success: false, error: 'Failed to update schedule' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data: { scheduleId, status } });
  } catch (error: unknown) {
    logger.error(
      'Schedule update failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/schedules/[scheduleId]' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to update schedule' },
      { status: 500 }
    );
  }
}

// ============================================================================
// DELETE — Permanently delete a schedule
// ============================================================================

export async function DELETE(request: NextRequest, context: RouteContext) {
  const authResult = await requireAuth(request);
  if (authResult instanceof NextResponse) {
    return authResult;
  }

  try {
    const { scheduleId } = await context.params;

    if (!scheduleId) {
      return NextResponse.json(
        { success: false, error: 'scheduleId is required' },
        { status: 400 }
      );
    }

    const deleted = await deleteSchedule(scheduleId);

    if (!deleted) {
      return NextResponse.json(
        { success: false, error: 'Schedule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    logger.error(
      'Schedule delete failed',
      error instanceof Error ? error : undefined,
      { route: '/api/orchestrator/missions/schedules/[scheduleId]' }
    );
    return NextResponse.json(
      { success: false, error: 'Failed to delete schedule' },
      { status: 500 }
    );
  }
}
