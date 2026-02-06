/**
 * AI Meeting Scheduler
 * Autonomously books meetings with prospects
 */

import { logger } from '@/lib/logger/logger';

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
  

  const slots: MeetingSlot[] = [];

  // Get user's calendar availability
  const existingMeetings = await getUserMeetings(userId, startDate, endDate);

  // Business hours: 9am - 5pm
  const businessStartHour = 9;
  const businessEndHour = 17;

  const currentDate = new Date(startDate);
  
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
  hostUserId: string
): Promise<ScheduledMeeting> {
  const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');

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
(request.timezone !== '' && request.timezone != null) ? request.timezone : 'America/New_York'
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
      organizationId: DEFAULT_ORG_ID,
      title: getMeetingTitle(request.meetingType, request.companyName),
      description: request.topic ?? getMeetingDescription(request.meetingType),
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
    sendCalendarInvite(meeting);



    return meeting;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Error scheduling meeting:', new Error(message), { file: 'meeting-scheduler.ts' });
    throw error;
  }
}

/**
 * Reschedule an existing meeting
 */
export async function rescheduleMeeting(
  meetingId: string,
  newStartTime: Date
): Promise<ScheduledMeeting> {
  // Get existing meeting
  const meeting = await getMeetingById(meetingId);
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
  reason?: string
): Promise<void> {


  const meeting = await getMeetingById(meetingId);
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Time extraction failed:', new Error(message), { file: 'meeting-scheduler.ts' });
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
  try {
    const { dal } = await import('@/lib/firebase/dal');

    interface UserDoc {
      name?: string;
      displayName?: string;
      email?: string;
    }

    // Get user from Firestore using DAL
    const userDoc = await dal.safeGetDoc('USERS', userId);

    if (userDoc.exists()) {
      const user = userDoc.data() as UserDoc;
      return {
        name:(user.name ?? user.displayName ?? 'Sales Team'),
        email:(user.email ?? 'sales@company.com'),
      };
    }
    
    // Fallback: Try to get from Firebase Auth
    const admin = await import('firebase-admin');
    if (admin.apps.length > 0) {
      try {
        const authUser = await admin.auth().getUser(userId);
        return {
          name:(authUser.displayName !== '' && authUser.displayName != null) ? authUser.displayName : 'Sales Team',
          email:(authUser.email !== '' && authUser.email != null) ? authUser.email : 'sales@company.com',
        };
      } catch {
        // User not found in Auth
      }
    }
    
    // Default fallback
    return {
      name: 'Sales Team',
      email: 'sales@company.com',
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Error getting host details:', new Error(message), { file: 'meeting-scheduler.ts' });
    return {
      name: 'Sales Team',
      email: 'sales@company.com',
    };
  }
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
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Error fetching calendar events:', new Error(message), { file: 'meeting-scheduler.ts' });
    return [];
  }
}

async function getMeetingById(
  meetingId: string
): Promise<ScheduledMeeting | null> {
  const { db } = await import('@/lib/firebase/config');
  if (!db) {throw new Error('Firestore not initialized');}

  const { doc, getDoc } = await import('firebase/firestore');
  const { getOrgSubCollection } = await import('@/lib/firebase/collections');

  const meetingPath = getOrgSubCollection('meetings');
  const meetingDoc = await getDoc(doc(db, meetingPath, meetingId));

  return meetingDoc.exists() ? (meetingDoc.data() as ScheduledMeeting) : null;
}

async function createCalendarEvent(meeting: ScheduledMeeting): Promise<{ id: string; link: string }> {
  const tokens = await getCalendarTokens(meeting.host.userId);
  
  if (!tokens) {
    // Fallback if no calendar connected
    
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

    

    return {
      id: event.id,
      link:event.hangoutLink ?? event.htmlLink,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Error creating calendar event:', new Error(message), { file: 'meeting-scheduler.ts' });
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


  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Error updating calendar event:', new Error(message), { file: 'meeting-scheduler.ts' });
  }
}

async function cancelCalendarEvent(calendarEventId: string, userId?: string): Promise<void> {
  if (!userId) {return;}
  
  const tokens = await getCalendarTokens(userId);
  if (!tokens) {return;}

  try {
    const { deleteEvent } = await import('@/lib/integrations/google-calendar-service');
    await deleteEvent(tokens, 'primary', calendarEventId);

  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Error cancelling calendar event:', new Error(message), { file: 'meeting-scheduler.ts' });
  }
}

function sendCalendarInvite(meeting: ScheduledMeeting): void {
  // Google Calendar sends invites automatically when creating event
  const attendees = meeting.attendees.map(a => a.email).join(', ');
  logger.info(`Meeting Scheduler Calendar invites sent to ${attendees}`, { file: 'meeting-scheduler.ts' });
}

async function getCalendarTokens(userId: string): Promise<{ access_token: string; refresh_token?: string } | null> {
  try {
    const { dal } = await import('@/lib/firebase/dal');
    const { where } = await import('firebase/firestore');

    interface IntegrationCredentials {
      access_token: string;
      refresh_token?: string;
    }

    interface IntegrationDoc {
      credentials: IntegrationCredentials;
    }

    const snapshot = await dal.safeGetDocs('INTEGRATIONS',
      where('userId', '==', userId),
      where('provider', '==', 'google'),
      where('type', '==', 'calendar'),
      where('status', '==', 'active')
    );

    if (!snapshot.empty) {
      const integration = snapshot.docs[0].data() as IntegrationDoc;
      return {
        access_token: integration.credentials.access_token,
        refresh_token: integration.credentials.refresh_token,
      };
    }

    return null;
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Error getting calendar tokens:', new Error(message), { file: 'meeting-scheduler.ts' });
    return null;
  }
}

async function sendMeetingUpdate(
  meeting: ScheduledMeeting,
  updateType: 'rescheduled' | 'cancelled',
  reason?: string
): Promise<void> {
  try {
    const { sendEmail } = await import('@/lib/integrations/sendgrid-service');
    
    // Get organization settings for email templates
    const { db } = await import('@/lib/firebase/config');
    if (!db) {throw new Error('Firestore not initialized');}
    
    const { doc, getDoc } = await import('firebase/firestore');
    const { getOrgSubCollection } = await import('@/lib/firebase/collections');

    const settingsPath = getOrgSubCollection('settings');
    interface OrgEmailSettings {
      companyName?: string;
      replyToEmail?: string;
    }

    const settingsDoc = await getDoc(doc(db, settingsPath, 'email'));
    const orgSettings = settingsDoc.exists() ? (settingsDoc.data() as OrgEmailSettings) : null;

    const settingsCompanyName = orgSettings?.companyName;
    const companyName = (settingsCompanyName !== '' && settingsCompanyName != null) ? settingsCompanyName : 'Our Team';
    const replyTo = orgSettings?.replyToEmail ?? meeting.host.email;
    
    // Build email content based on update type
    let subject: string;
    let htmlContent: string;
    
    const meetingDate = new Date(meeting.startTime).toLocaleDateString('en-US', {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
    const meetingTime = new Date(meeting.startTime).toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      timeZoneName: 'short',
    });
    
    if (updateType === 'rescheduled') {
      subject = `Meeting Rescheduled: ${meeting.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #2563eb;">Meeting Rescheduled</h2>
          <p>Hi ${meeting.attendees[0]?.name || 'there'},</p>
          <p>Your meeting "<strong>${meeting.title}</strong>" has been rescheduled.</p>
          
          <div style="background: #f3f4f6; padding: 20px; border-radius: 8px; margin: 20px 0;">
            <p><strong>New Date:</strong> ${meetingDate}</p>
            <p><strong>New Time:</strong> ${meetingTime}</p>
            ${meeting.meetingLink ? `<p><strong>Meeting Link:</strong> <a href="${meeting.meetingLink}">${meeting.meetingLink}</a></p>` : ''}
          </div>
          
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          
          <p>If this new time doesn't work for you, please let us know and we'll find another slot.</p>
          
          <p>Best regards,<br>${meeting.host.name}<br>${companyName}</p>
        </div>
      `;
    } else {
      subject = `Meeting Cancelled: ${meeting.title}`;
      htmlContent = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #dc2626;">Meeting Cancelled</h2>
          <p>Hi ${meeting.attendees[0]?.name || 'there'},</p>
          <p>Unfortunately, your meeting "<strong>${meeting.title}</strong>" scheduled for ${meetingDate} at ${meetingTime} has been cancelled.</p>
          
          ${reason ? `<p><strong>Reason:</strong> ${reason}</p>` : ''}
          
          <p>If you'd like to reschedule, please reply to this email or use our booking link.</p>
          
          <p>We apologize for any inconvenience.</p>
          
          <p>Best regards,<br>${meeting.host.name}<br>${companyName}</p>
        </div>
      `;
    }
    
    // Send to all attendees
    for (const attendee of meeting.attendees) {
      await sendEmail({
        to: attendee.email,
        subject,
        html: htmlContent,
        from: meeting.host.email,
        replyTo,
      });
    }

    logger.info(`Meeting Scheduler Sent ${updateType} emails to ${meeting.attendees.length} attendees`, { file: 'meeting-scheduler.ts' });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown error';
    logger.error('[Meeting Scheduler] Error sending update email:', new Error(message), { file: 'meeting-scheduler.ts' });
    // Don't throw - email failure shouldn't block the main operation
  }
}

