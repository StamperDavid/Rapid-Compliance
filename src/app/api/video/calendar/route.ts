/**
 * API Route: Content Calendar Management
 *
 * GET    /api/video/calendar              — List calendar weeks
 * POST   /api/video/calendar              — Create a new calendar week
 * PATCH  /api/video/calendar              — Update a batch project within a week
 * DELETE /api/video/calendar?weekId=xxx   — Delete a calendar week
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { logger } from '@/lib/logger/logger';
import {
  createCalendarWeek,
  listCalendarWeeks,
  deleteCalendarWeek,
  updateBatchProject,
} from '@/lib/video/batch-generator';

export const dynamic = 'force-dynamic';

const createWeekSchema = z.object({
  name: z.string().min(1, 'Week name is required').max(200),
  weekStartDate: z.string().min(1, 'Week start date is required'),
  theme: z.string().min(1, 'Theme is required').max(200),
  topics: z
    .array(
      z.object({
        dayOfWeek: z.number().int().min(0).max(6),
        topic: z.string().min(1),
        videoType: z.enum(['tutorial', 'explainer', 'product-demo', 'sales-pitch', 'testimonial', 'social-ad']).optional(),
        platform: z.enum(['youtube', 'tiktok', 'instagram', 'linkedin', 'website']).optional(),
      })
    )
    .min(1, 'At least one topic is required'),
});

export async function GET(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const weeks = await listCalendarWeeks();

    return NextResponse.json({ success: true, weeks });
  } catch (error) {
    logger.error('Failed to list calendar weeks', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: 'Failed to list calendar weeks' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = createWeekSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const week = await createCalendarWeek({
      ...parsed.data,
      createdBy: authResult.user.uid,
    });

    return NextResponse.json({ success: true, week });
  } catch (error) {
    logger.error('Failed to create calendar week', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: 'Failed to create calendar week' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const { searchParams } = new URL(request.url);
    const weekId = searchParams.get('weekId');

    if (!weekId) {
      return NextResponse.json(
        { success: false, error: 'weekId is required' },
        { status: 400 }
      );
    }

    await deleteCalendarWeek(weekId);

    return NextResponse.json({ success: true });
  } catch (error) {
    logger.error('Failed to delete calendar week', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: 'Failed to delete calendar week' },
      { status: 500 }
    );
  }
}

// ─── PATCH: Update a batch project within a week ─────────────────────────────

const updateBatchProjectSchema = z.object({
  weekId: z.string().min(1, 'weekId is required'),
  projectIndex: z.number().int().min(0),
  updates: z.object({
    projectId: z.string().nullable().optional(),
    status: z.enum(['pending', 'storyboarded', 'approved', 'generating', 'completed', 'failed']).optional(),
    videoUrl: z.string().nullable().optional(),
  }),
});

export async function PATCH(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = updateBatchProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: parsed.error.issues[0]?.message || 'Invalid request' },
        { status: 400 }
      );
    }

    const { weekId, projectIndex, updates } = parsed.data;
    const updatedWeek = await updateBatchProject(weekId, projectIndex, updates);

    return NextResponse.json({ success: true, week: updatedWeek });
  } catch (error) {
    logger.error('Failed to update batch project', error instanceof Error ? error : undefined);
    return NextResponse.json(
      { success: false, error: 'Failed to update batch project' },
      { status: 500 }
    );
  }
}
