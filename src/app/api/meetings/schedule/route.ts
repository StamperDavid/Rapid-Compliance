/**
 * Meeting Scheduling API
 * POST /api/meetings/schedule - Schedule a meeting with auto-assignment
 */

import { type NextRequest, NextResponse } from 'next/server';
import { scheduleMeeting } from '@/lib/meetings/scheduler-engine';
import { logger } from '@/lib/logger/logger';
import { requireAuth } from '@/lib/auth/api-auth';

export const dynamic = 'force-dynamic';

type RelatedEntityType = 'lead' | 'contact' | 'deal';

interface MeetingAttendee {
  name: string;
  email: string;
  phone?: string;
}

interface ScheduleMeetingRequestBody {
  schedulerConfigId?: string;
  title?: string;
  startTime?: string;
  attendees?: MeetingAttendee[];
  notes?: string;
  relatedEntityType?: string;
  relatedEntityId?: string;
}

function isScheduleMeetingRequestBody(value: unknown): value is ScheduleMeetingRequestBody {
  return typeof value === 'object' && value !== null;
}

function isValidRelatedEntityType(value: string | undefined): value is RelatedEntityType | undefined {
  return value === undefined || value === 'lead' || value === 'contact' || value === 'deal';
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    if (!isScheduleMeetingRequestBody(body)) {
      return NextResponse.json({ error: 'Invalid request body' }, { status: 400 });
    }

    // Validate required fields
    if (!body.schedulerConfigId) {
      return NextResponse.json({ error: 'schedulerConfigId is required' }, { status: 400 });
    }

    if (!body.title) {
      return NextResponse.json({ error: 'title is required' }, { status: 400 });
    }

    if (!body.attendees || body.attendees.length === 0) {
      return NextResponse.json({ error: 'attendees are required' }, { status: 400 });
    }

    // Validate relatedEntityType if provided
    const relatedEntityType = isValidRelatedEntityType(body.relatedEntityType)
      ? body.relatedEntityType
      : undefined;

    const meeting = await scheduleMeeting({
      schedulerConfigId: body.schedulerConfigId,
      title: body.title,
      startTime: body.startTime ? new Date(body.startTime) : new Date(),
      attendees: body.attendees,
      notes: body.notes,
      relatedEntityType,
      relatedEntityId: body.relatedEntityId,
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
