/**
 * Meeting Scheduling API
 * POST /api/meetings/schedule - Schedule a meeting with auto-assignment
 */

import { NextRequest, NextResponse } from 'next/server';
import { scheduleMeeting } from '@/lib/meetings/scheduler-engine';
import { logger } from '@/lib/logger/logger';
import { getAuthToken } from '@/lib/auth/server-auth';

export async function POST(request: NextRequest) {
  try {
    const token = await getAuthToken(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const organizationId = token.organizationId;
    const workspaceId = body.workspaceId || 'default';

    const meeting = await scheduleMeeting(organizationId, workspaceId, {
      schedulerConfigId: body.schedulerConfigId,
      title: body.title,
      startTime: new Date(body.startTime),
      attendees: body.attendees,
      notes: body.notes,
      relatedEntityType: body.relatedEntityType,
      relatedEntityId: body.relatedEntityId,
    });

    return NextResponse.json({
      success: true,
      data: meeting,
    });

  } catch (error: any) {
    logger.error('Meeting scheduling API failed', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}

