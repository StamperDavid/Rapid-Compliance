/**
 * Meeting Scheduler API
 * POST /api/outbound/meetings/schedule
 * Schedule meetings with prospects
 */

import type { NextRequest} from 'next/server';
import { NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth/api-auth';
import type { MeetingRequest } from '@/lib/outbound/meeting-scheduler';
import { scheduleMeeting } from '@/lib/outbound/meeting-scheduler';
import { logger } from '@/lib/logger/logger';
import { errors } from '@/lib/middleware/error-handler';

export async function POST(request: NextRequest) {
  try {
    const authResult = await requireAuth(request);
    if (authResult instanceof NextResponse) {
      return authResult;
    }

    const body = await request.json();
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
    // Feature check no longer needed - everyone gets meeting scheduling!
    // const featureCheck = await requireFeature(request, orgId, 'multiChannelOutreach' as any);
    // if (featureCheck) return featureCheck;

    const meetingRequest: MeetingRequest = {
      prospectEmail,
      prospectName,
      companyName,
      duration,
      meetingType,
      topic,
      suggestedTimes: suggestedTimes?.map((t: string) => new Date(t)),
      timezone,
      urgency,
      context,
    };

    // Schedule the meeting
    const meeting = await scheduleMeeting(
      meetingRequest,
      authResult.user.uid,
      orgId
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
  } catch (error: any) {
    logger.error('Meeting scheduler error', error, { route: '/api/outbound/meetings/schedule' });
    return errors.externalService('Calendar service', error instanceof Error ? error : undefined);
  }
}

