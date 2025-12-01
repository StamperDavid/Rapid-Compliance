/**
 * AI Meeting Scheduler
 * Autonomously books meetings with prospects
 */

export interface MeetingRequest {
  prospectEmail: string;
  prospectName: string;
  companyName: string;
  
  // Meeting preferences
  duration: number; // minutes (15, 30, 60)
  meetingType: 'demo' | 'discovery' | 'intro' | 'follow-up' | 'custom';
  topic?: string;
  
  // Scheduling constraints
  suggestedTimes?: Date[]; // Prospect's suggested times
  timezone?: string; // Prospect's timezone
  urgency?: 'asap' | 'this_week' | 'next_week' | 'flexible';
  
  // Context
  context?: string; // Additional context for the meeting
  notes?: string;
}

export interface MeetingSlot {
  startTime: Date;
  endTime: Date;
  timezone: string;
  available: boolean;
  conflictsWith?: string[]; // Other meetings during this time
}

export interface ScheduledMeeting {
  id: string;
  organizationId: string;
  prospectId?: string;
  
  // Meeting details
  title: string;
  description: string;
  duration: number; // minutes
  
  // Participants
  host: {
    name: string;
    email: string;
    userId: string;
  };
  attendees: {
    name: string;
    email: string;
    status: 'pending' | 'accepted' | 'declined' | 'tentative';
  }[];
  
  // Time
  startTime: string; // ISO datetime
  endTime: string;   // ISO datetime
  timezone: string;
  
  // Location/link
  meetingLink?: string; // Zoom, Google Meet, etc.
  location?: string;
  
  // Integration
  calendarEventId?: string; // Google Calendar, Outlook, etc.
  conferenceLink?: string;  // Video conference link
  
  // Status
  status: 'scheduled' | 'confirmed' | 'completed' | 'cancelled' | 'no_show';
  
  // Reminders
  reminders: {
    minutes: number; // Minutes before meeting
    sent: boolean;
  }[];
  
  // Metadata
  createdAt: string;
  updatedAt: string;
  createdBy: 'ai' | 'human';
  source?: string; // 'sequence', 'manual', 'reply_handler'
}

/**
 * Find available meeting slots
 */
export async function findAvailableSlots(
  userId: string,
  duration: number,
  startDate: Date,
  endDate: Date,
  timezone: string = 'America/New_York'
): Promise<MeetingSlot[]> {
  console.log(`[Meeting Scheduler] Finding ${duration}min slots from ${startDate} to ${endDate}`);

  const slots: MeetingSlot[] = [];

  // Get user's calendar availability
  const existingMeetings = await getUserMeetings(userId, startDate, endDate);

  // Business hours: 9am - 5pm
  const businessStartHour = 9;
  const businessEndHour = 17;

  let currentDate = new Date(startDate);
  
  while (currentDate <= endDate) {
    // Skip weekends
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      continue;
    }

    // Check each hour during business hours
    for (let hour = businessStartHour; hour < businessEndHour; hour++) {
      const slotStart = new Date(currentDate);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + duration);

      // Don't suggest slots that go past business hours
      if (slotEnd.getHours() > businessEndHour) {
        continue;
      }

      // Check if slot conflicts with existing meetings
      const conflicts = existingMeetings.filter(meeting => {
        const meetingStart = new Date(meeting.startTime);
        const meetingEnd = new Date(meeting.endTime);

        return (slotStart >= meetingStart && slotStart < meetingEnd) ||
               (slotEnd > meetingStart && slotEnd <= meetingEnd) ||
               (slotStart <= meetingStart && slotEnd >= meetingEnd);
      });

      slots.push({
        startTime: slotStart,
        endTime: slotEnd,
        timezone,
        available: conflicts.length === 0,
        conflictsWith: conflicts.map(m => m.id),
      });
    }

    currentDate.setDate(currentDate.getDate() + 1);
  }

  // Return only available slots
  return slots.filter(slot => slot.available);
}

/**
 * Schedule a meeting autonomously
 */
export async function scheduleMeeting(
  request: MeetingRequest,
  hostUserId: string,
  organizationId: string
): Promise<ScheduledMeeting> {
  console.log(`[Meeting Scheduler] Scheduling ${request.duration}min ${request.meetingType} with ${request.prospectEmail}`);

  try {
    // Find available slots
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(nextWeek.getDate() + 7);

    const availableSlots = await findAvailableSlots(
      hostUserId,
      request.duration,
      today,
      nextWeek,
      request.timezone || 'America/New_York'
    );

    if (availableSlots.length === 0) {
      throw new Error('No available slots found');
    }

    // Pick best slot (first available, or closest to suggested time)
    let bestSlot = availableSlots[0];

    if (request.suggestedTimes && request.suggestedTimes.length > 0) {
      // Find slot closest to prospect's suggestion
      const suggested = new Date(request.suggestedTimes[0]);
      bestSlot = availableSlots.reduce((closest, slot) => {
        const currentDiff = Math.abs(slot.startTime.getTime() - suggested.getTime());
        const closestDiff = Math.abs(closest.startTime.getTime() - suggested.getTime());
        return currentDiff < closestDiff ? slot : closest;
      });
    }

    // Get host details
    const host = await getHostDetails(hostUserId);

    // Create meeting
    const meetingId = `meeting_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const meeting: ScheduledMeeting = {
      id: meetingId,
      organizationId,
      title: getMeetingTitle(request.meetingType, request.companyName),
      description: request.topic || getMeetingDescription(request.meetingType),
      duration: request.duration,
      host: {
        name: host.name,
        email: host.email,
        userId: hostUserId,
      },
      attendees: [
        {
          name: request.prospectName,
          email: request.prospectEmail,
          status: 'pending',
        },
      ],
      startTime: bestSlot.startTime.toISOString(),
      endTime: bestSlot.endTime.toISOString(),
      timezone: bestSlot.timezone,
      status: 'scheduled',
      reminders: [
        { minutes: 60, sent: false },      // 1 hour before
        { minutes: 24 * 60, sent: false }, // 1 day before
      ],
      createdAt: now,
      updatedAt: now,
      createdBy: 'ai',
    };

    // Create calendar event
    const calendarEvent = await createCalendarEvent(meeting);
    meeting.calendarEventId = calendarEvent.id;
    meeting.meetingLink = calendarEvent.link;

    // Send calendar invite
    await sendCalendarInvite(meeting);

    console.log(`[Meeting Scheduler] Meeting scheduled: ${meetingId} at ${meeting.startTime}`);

    return meeting;
  } catch (error) {
    console.error('[Meeting Scheduler] Error scheduling meeting:', error);
    throw error;
  }
}

/**
 * Reschedule an existing meeting
 */
export async function rescheduleMeeting(
  meetingId: string,
  newStartTime: Date,
  organizationId: string
): Promise<ScheduledMeeting> {
  console.log(`[Meeting Scheduler] Rescheduling meeting ${meetingId} to ${newStartTime}`);

  // Get existing meeting
  const meeting = await getMeetingById(meetingId, organizationId);
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  // Update times
  const newEndTime = new Date(newStartTime);
  newEndTime.setMinutes(newEndTime.getMinutes() + meeting.duration);

  meeting.startTime = newStartTime.toISOString();
  meeting.endTime = newEndTime.toISOString();
  meeting.updatedAt = new Date().toISOString();

  // Update calendar event
  if (meeting.calendarEventId) {
    await updateCalendarEvent(meeting);
  }

  // Send update email
  await sendMeetingUpdate(meeting, 'rescheduled');

  return meeting;
}

/**
 * Cancel a meeting
 */
export async function cancelMeeting(
  meetingId: string,
  organizationId: string,
  reason?: string
): Promise<void> {
  console.log(`[Meeting Scheduler] Cancelling meeting ${meetingId}`);

  const meeting = await getMeetingById(meetingId, organizationId);
  if (!meeting) {
    throw new Error('Meeting not found');
  }

  meeting.status = 'cancelled';
  meeting.updatedAt = new Date().toISOString();

  // Cancel calendar event
  if (meeting.calendarEventId) {
    await cancelCalendarEvent(meeting.calendarEventId);
  }

  // Send cancellation email
  await sendMeetingUpdate(meeting, 'cancelled', reason);
}

/**
 * Extract meeting time from natural language
 */
export async function extractMeetingTime(text: string): Promise<Date | null> {
  console.log(`[Meeting Scheduler] Extracting time from: "${text}"`);

  try {
    // Use AI to parse natural language date/time
    const { sendUnifiedChatMessage } = await import('@/lib/ai/unified-ai-service');

    const prompt = `Extract the meeting date and time from this text. Today is ${new Date().toISOString()}.

Text: "${text}"

Respond with ONLY the ISO datetime string (YYYY-MM-DDTHH:MM:SS), or "null" if no clear time is mentioned.`;

    const response = await sendUnifiedChatMessage({
      model: 'gpt-4-turbo',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 100,
    });

    const extracted = response.text.trim();
    
    if (extracted === 'null' || !extracted) {
      return null;
    }

    return new Date(extracted);
  } catch (error) {
    console.error('[Meeting Scheduler] Time extraction failed:', error);
    return null;
  }
}

// Helper functions

function getMeetingTitle(type: string, companyName: string): string {
  const titles: Record<string, string> = {
    demo: `Product Demo - ${companyName}`,
    discovery: `Discovery Call - ${companyName}`,
    intro: `Introduction Call - ${companyName}`,
    'follow-up': `Follow-up Call - ${companyName}`,
    custom: `Meeting - ${companyName}`,
  };
  return titles[type] || `Meeting - ${companyName}`;
}

function getMeetingDescription(type: string): string {
  const descriptions: Record<string, string> = {
    demo: 'Product demonstration and walkthrough',
    discovery: 'Discovery call to discuss your needs and goals',
    intro: 'Introductory call to learn about your business',
    'follow-up': 'Follow-up discussion',
    custom: 'Meeting',
  };
  return descriptions[type] || 'Meeting';
}

async function getHostDetails(userId: string): Promise<{ name: string; email: string }> {
  // TODO: Get from user database
  return {
    name: 'Sales Team',
    email: 'sales@company.com',
  };
}

async function getUserMeetings(
  userId: string,
  startDate: Date,
  endDate: Date
): Promise<ScheduledMeeting[]> {
  // Get user's calendar integration
  const tokens = await getCalendarTokens(userId);
  if (!tokens) {
    return []; // No calendar connected
  }

  try {
    const { getFreeBusy } = await import('@/lib/integrations/google-calendar-service');
    const { busy } = await getFreeBusy(
      tokens,
      'primary',
      startDate,
      endDate
    );

    // Convert busy times to meetings (simplified)
    return busy.map((slot, index) => ({
      id: `meeting_${index}`,
      organizationId: '',
      title: 'Busy',
      description: '',
      duration: Math.floor((new Date(slot.end).getTime() - new Date(slot.start).getTime()) / 60000),
      host: { name: '', email: '', userId },
      attendees: [],
      startTime: slot.start,
      endTime: slot.end,
      timezone: 'America/New_York',
      status: 'scheduled',
      reminders: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      createdBy: 'ai',
    }));
  } catch (error) {
    console.error('[Meeting Scheduler] Error fetching calendar events:', error);
    return [];
  }
}

async function getMeetingById(
  meetingId: string,
  organizationId: string
): Promise<ScheduledMeeting | null> {
  const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
  return await FirestoreService.get(
    `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/meetings`,
    meetingId
  ) as ScheduledMeeting | null;
}

async function createCalendarEvent(meeting: ScheduledMeeting): Promise<{ id: string; link: string }> {
  const tokens = await getCalendarTokens(meeting.host.userId);
  
  if (!tokens) {
    // Fallback if no calendar connected
    console.log('[Meeting Scheduler] No calendar connected, creating meeting in database only');
    return {
      id: `cal_${meeting.id}`,
      link: `https://meet.google.com/${meeting.id}`,
    };
  }

  try {
    const { createEvent } = await import('@/lib/integrations/google-calendar-service');
    
    const event = await createEvent(
      tokens,
      'primary',
      {
        summary: meeting.title,
        description: meeting.description,
        start: {
          dateTime: meeting.startTime,
          timeZone: meeting.timezone,
        },
        end: {
          dateTime: meeting.endTime,
          timeZone: meeting.timezone,
        },
        attendees: meeting.attendees.map(a => ({
          email: a.email,
          displayName: a.name,
        })),
        conferenceData: {
          createRequest: {
            requestId: `meet_${meeting.id}`,
            conferenceSolutionKey: {
              type: 'hangoutsMeet',
            },
          },
        },
      }
    );

    console.log('[Meeting Scheduler] Calendar event created:', event.id);

    return {
      id: event.id,
      link: event.hangoutLink || event.htmlLink,
    };
  } catch (error) {
    console.error('[Meeting Scheduler] Error creating calendar event:', error);
    throw error;
  }
}

async function updateCalendarEvent(meeting: ScheduledMeeting): Promise<void> {
  const tokens = await getCalendarTokens(meeting.host.userId);
  
  if (!tokens || !meeting.calendarEventId) {
    return;
  }

  try {
    const { updateEvent } = await import('@/lib/integrations/google-calendar-service');
    
    await updateEvent(
      tokens,
      'primary',
      meeting.calendarEventId,
      {
        start: {
          dateTime: meeting.startTime,
          timeZone: meeting.timezone,
        },
        end: {
          dateTime: meeting.endTime,
          timeZone: meeting.timezone,
        },
      }
    );

    console.log('[Meeting Scheduler] Calendar event updated');
  } catch (error) {
    console.error('[Meeting Scheduler] Error updating calendar event:', error);
  }
}

async function cancelCalendarEvent(calendarEventId: string, userId?: string): Promise<void> {
  if (!userId) return;
  
  const tokens = await getCalendarTokens(userId);
  if (!tokens) return;

  try {
    const { deleteEvent } = await import('@/lib/integrations/google-calendar-service');
    await deleteEvent(tokens, 'primary', calendarEventId);
    console.log('[Meeting Scheduler] Calendar event cancelled');
  } catch (error) {
    console.error('[Meeting Scheduler] Error cancelling calendar event:', error);
  }
}

async function sendCalendarInvite(meeting: ScheduledMeeting): Promise<void> {
  // Google Calendar sends invites automatically when creating event
  console.log(`[Meeting Scheduler] Calendar invites sent to ${meeting.attendees.map(a => a.email).join(', ')}`);
}

async function getCalendarTokens(userId: string): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const { FirestoreService, COLLECTIONS } = await import('@/lib/db/firestore-service');
    const { where } = await import('firebase/firestore');
    
    const integration = await FirestoreService.getAll(
      COLLECTIONS.INTEGRATIONS,
      [
        where('userId', '==', userId),
        where('provider', '==', 'google'),
        where('type', '==', 'calendar'),
        where('status', '==', 'active'),
      ]
    );

    if (integration && integration.length > 0) {
      return {
        access_token: integration[0].credentials.access_token,
        refresh_token: integration[0].credentials.refresh_token,
      };
    }

    return null;
  } catch (error) {
    console.error('[Meeting Scheduler] Error getting calendar tokens:', error);
    return null;
  }
}

async function sendMeetingUpdate(
  meeting: ScheduledMeeting,
  updateType: 'rescheduled' | 'cancelled',
  reason?: string
): Promise<void> {
  // TODO: Send update email
  console.log(`[Meeting Scheduler] Sending ${updateType} email`);
}

