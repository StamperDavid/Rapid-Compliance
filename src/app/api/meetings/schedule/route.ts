/**
 * Meeting Scheduling API
 * POST /api/meetings/schedule - Schedule a meeting with auto-assignment
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { scheduleMeeting } from '@/lib/meetings/scheduler-engine';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

const MeetingAttendeeSchema = z.object({
  name: z.string(),
  email: z.string().email(),
  phone: z.string().optional(),
});

const ScheduleMeetingSchema = z.object({
  schedulerConfigId: z.string().min(1),
  title: z.string().min(1),
  startTime: z.string().optional(),
  attendees: z.array(MeetingAttendeeSchema).min(1),
  notes: z.string().optional(),
  relatedEntityType: z.enum(['lead', 'contact', 'deal']).optional(),
  relatedEntityId: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = ScheduleMeetingSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      schedulerConfigId,
      title,
      startTime,
      attendees,
      notes,
      relatedEntityType,
      relatedEntityId,
    } = parsed.data;

    const meeting = await scheduleMeeting({
      schedulerConfigId,
      title,
      startTime: startTime ? new Date(startTime) : new Date(),
      attendees,
      notes,
      relatedEntityType,
      relatedEntityId,
    });

    return NextResponse.json({
      success: true,
      data: meeting,
    });

  } catch (error: unknown) {
    logger.error('Meeting scheduling API failed', error instanceof Error ? error : new Error(String(error)));
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    return NextResponse.json(
      { success: false, error: errorMessage },
      { status: 500 }
    );
  }
}
