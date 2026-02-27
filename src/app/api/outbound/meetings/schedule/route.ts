/**
 * Meeting Scheduler API
 * POST /api/outbound/meetings/schedule
 * Schedule meetings with prospects
 */

import { type NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { requireAuth } from '@/lib/auth/api-auth';
import { scheduleMeeting, type MeetingRequest } from '@/lib/outbound/meeting-scheduler';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export const dynamic = 'force-dynamic';

const MeetingScheduleSchema = z.object({
  prospectEmail: z.string().email(),
  prospectName: z.string().min(1),
  companyName: z.string().min(1),
  duration: z.number().int().positive().optional().default(30),
  meetingType: z.enum(['demo', 'discovery', 'intro', 'follow-up', 'custom']).optional().default('discovery'),
  topic: z.string().optional(),
  suggestedTimes: z.array(z.string()).optional(),
  timezone: z.string().optional(),
  urgency: z.enum(['asap', 'this_week', 'next_week', 'flexible']).optional(),
  context: z.string().optional(),
});

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    const parsed = MeetingScheduleSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const {
      prospectEmail,
      prospectName,
      companyName,
      duration,
      meetingType,
      topic,
      suggestedTimes,
      timezone,
      urgency,
      context,
    } = parsed.data;

    // Penthouse model: All features available

    const meetingRequest: MeetingRequest = {
      prospectEmail,
      prospectName,
      companyName,
      duration,
      meetingType,
      topic,
      suggestedTimes: suggestedTimes?.map((t) => new Date(t)),
      timezone,
      urgency,
      context,
    };

    // Schedule the meeting
    const meeting = await scheduleMeeting(
      meetingRequest,
      authResult.user.uid
    );

    return NextResponse.json({
      success: true,
      message: 'Meeting scheduled successfully',
      meeting: {
        id: meeting.id,
        title: meeting.title,
        startTime: meeting.startTime,
        endTime: meeting.endTime,
        timezone: meeting.timezone,
        duration: meeting.duration,
        meetingLink: meeting.meetingLink,
        status: meeting.status,
      },
    });
  } catch (error) {
    logger.error('Meeting scheduler error', error instanceof Error ? error : new Error(String(error)), { route: '/api/outbound/meetings/schedule' });
    return errors.externalService('Calendar service', error instanceof Error ? error : undefined);
  }
}

