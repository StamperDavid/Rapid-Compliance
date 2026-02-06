/**
 * Meeting Scheduler API
 * POST /api/outbound/meetings/schedule
 * Schedule meetings with prospects
 */

import { type NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import { scheduleMeeting, type MeetingRequest } from '@/lib/outbound/meeting-scheduler';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

type MeetingType = 'demo' | 'discovery' | 'intro' | 'follow-up' | 'custom';
type MeetingUrgency = 'asap' | 'this_week' | 'next_week' | 'flexible';

interface MeetingScheduleRequestBody {
  orgId?: string;
  prospectEmail?: string;
  prospectName?: string;
  companyName?: string;
  duration?: number;
  meetingType?: string;
  topic?: string;
  suggestedTimes?: string[];
  timezone?: string;
  urgency?: string;
  context?: string;
}

function isValidMeetingType(value: string): value is MeetingType {
  return ['demo', 'discovery', 'intro', 'follow-up', 'custom'].includes(value);
}

function isValidMeetingUrgency(value: string): value is MeetingUrgency {
  return ['asap', 'this_week', 'next_week', 'flexible'].includes(value);
}

function isMeetingScheduleRequestBody(value: unknown): value is MeetingScheduleRequestBody {
  return typeof value === 'object' && value !== null;
}

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body: unknown = await request.json();
    if (!isMeetingScheduleRequestBody(body)) {
      return errors.badRequest('Invalid request body');
    }

    const {
      orgId,
      prospectEmail,
      prospectName,
      companyName,
      duration = 30,
      meetingType = 'discovery',
      topic,
      suggestedTimes,
      timezone,
      urgency,
      context,
    } = body;

    if (!orgId) {
      return NextResponse.json(
        { success: false, error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    if (!prospectEmail || !prospectName || !companyName) {
      return NextResponse.json(
        { success: false, error: 'Prospect email, name, and company are required' },
        { status: 400 }
      );
    }

    // NEW PRICING MODEL: All features available to all active subscriptions
    // Meeting scheduling is now available to all users

    // Validate meetingType and urgency
    const validMeetingType: MeetingType = isValidMeetingType(meetingType) ? meetingType : 'discovery';
    const validUrgency: MeetingUrgency | undefined = urgency && isValidMeetingUrgency(urgency) ? urgency : undefined;

    const meetingRequest: MeetingRequest = {
      prospectEmail,
      prospectName,
      companyName,
      duration,
      meetingType: validMeetingType,
      topic,
      suggestedTimes: suggestedTimes?.map((t) => new Date(t)),
      timezone,
      urgency: validUrgency,
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

