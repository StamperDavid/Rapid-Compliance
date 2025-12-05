/**
 * Google Calendar Integration
 * REAL calendar integration using Google Calendar API
 */

import { google } from 'googleapis';
import { OAuth2Client } from 'google-auth-library';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_REDIRECT_URI = process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/api/integrations/google/callback';

export interface CalendarEvent {
  id?: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime: string;
    timeZone?: string;
  };
  end: {
    dateTime: string;
    timeZone?: string;
  };
  attendees?: {
    email: string;
    displayName?: string;
  }[];
  conferenceData?: {
    createRequest?: {
      requestId: string;
      conferenceSolutionKey: {
        type: string;
      };
    };
  };
}

/**
 * Create OAuth2 client
 */
function createOAuth2Client(tokens?: {
  access_token: string;
  refresh_token?: string;
}): OAuth2Client {
  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_REDIRECT_URI
  );

  if (tokens) {
    oauth2Client.setCredentials({
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
    });
  }

  return oauth2Client;
}

/**
 * Get authorization URL for OAuth flow
 */
export function getAuthUrl(): string {
  const oauth2Client = createOAuth2Client();
  
  return oauth2Client.generateAuthUrl({
    access_type: 'offline',
    scope: [
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/calendar.events',
    ],
    prompt: 'consent',
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string): Promise<{
  access_token: string;
  refresh_token?: string;
  expiry_date?: number;
}> {
  const oauth2Client = createOAuth2Client();
  const { tokens } = await oauth2Client.getToken(code);
  
  return {
    access_token: tokens.access_token!,
    refresh_token: tokens.refresh_token,
    expiry_date: tokens.expiry_date,
  };
}

/**
 * List calendars
 */
export async function listCalendars(tokens: {
  access_token: string;
  refresh_token?: string;
}): Promise<any[]> {
  const auth = createOAuth2Client(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.calendarList.list();
  return response.data.items || [];
}

/**
 * Get free/busy information
 */
export async function getFreeBusy(
  tokens: { access_token: string; refresh_token?: string },
  calendarId: string,
  timeMin: Date,
  timeMax: Date
): Promise<{
  busy: { start: string; end: string }[];
}> {
  const auth = createOAuth2Client(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busyTimes = response.data.calendars?.[calendarId]?.busy || [];
  
  return {
    busy: busyTimes.map((slot: any) => ({
      start: slot.start,
      end: slot.end,
    })),
  };
}

/**
 * Create calendar event
 */
export async function createEvent(
  tokens: { access_token: string; refresh_token?: string },
  calendarId: string,
  event: CalendarEvent
): Promise<{
  id: string;
  htmlLink: string;
  hangoutLink?: string;
}> {
  const auth = createOAuth2Client(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.insert({
    calendarId,
    conferenceDataVersion: event.conferenceData ? 1 : 0,
    requestBody: {
      summary: event.summary,
      description: event.description,
      location: event.location,
      start: event.start,
      end: event.end,
      attendees: event.attendees,
      conferenceData: event.conferenceData,
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 }, // 1 day before
          { method: 'popup', minutes: 60 }, // 1 hour before
        ],
      },
    },
    sendUpdates: 'all', // Send invites to attendees
  });

  return {
    id: response.data.id!,
    htmlLink: response.data.htmlLink!,
    hangoutLink: response.data.hangoutLink,
  };
}

/**
 * Update calendar event
 */
export async function updateEvent(
  tokens: { access_token: string; refresh_token?: string },
  calendarId: string,
  eventId: string,
  updates: Partial<CalendarEvent>
): Promise<{
  id: string;
  htmlLink: string;
}> {
  const auth = createOAuth2Client(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.events.patch({
    calendarId,
    eventId,
    requestBody: updates as any,
    sendUpdates: 'all',
  });

  return {
    id: response.data.id!,
    htmlLink: response.data.htmlLink!,
  };
}

/**
 * Delete calendar event
 */
export async function deleteEvent(
  tokens: { access_token: string; refresh_token?: string },
  calendarId: string,
  eventId: string
): Promise<void> {
  const auth = createOAuth2Client(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  await calendar.events.delete({
    calendarId,
    eventId,
    sendUpdates: 'all',
  });
}

/**
 * Find available slots
 */
export async function findAvailableSlots(
  tokens: { access_token: string; refresh_token?: string },
  calendarId: string,
  startDate: Date,
  endDate: Date,
  durationMinutes: number,
  options?: {
    businessHoursStart?: number; // 9
    businessHoursEnd?: number; // 17
    timezone?: string;
  }
): Promise<{ start: Date; end: Date }[]> {
  const businessStart = options?.businessHoursStart ?? 9;
  const businessEnd = options?.businessHoursEnd ?? 17;
  const timezone = options?.timezone ?? 'America/New_York';

  // Get busy times
  const { busy } = await getFreeBusy(tokens, calendarId, startDate, endDate);

  const slots: { start: Date; end: Date }[] = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    // Skip weekends
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek === 0 || dayOfWeek === 6) {
      currentDate.setDate(currentDate.getDate() + 1);
      currentDate.setHours(0, 0, 0, 0);
      continue;
    }

    // Check each hour during business hours
    for (let hour = businessStart; hour < businessEnd; hour++) {
      const slotStart = new Date(currentDate);
      slotStart.setHours(hour, 0, 0, 0);

      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes);

      // Don't suggest slots that go past business hours
      if (slotEnd.getHours() > businessEnd) {
        continue;
      }

      // Check if slot conflicts with busy times
      const hasConflict = busy.some(busySlot => {
        const busyStart = new Date(busySlot.start);
        const busyEnd = new Date(busySlot.end);

        return (slotStart >= busyStart && slotStart < busyEnd) ||
               (slotEnd > busyStart && slotEnd <= busyEnd) ||
               (slotStart <= busyStart && slotEnd >= busyEnd);
      });

      if (!hasConflict) {
        slots.push({ start: slotStart, end: slotEnd });
      }
    }

    currentDate.setDate(currentDate.getDate() + 1);
    currentDate.setHours(0, 0, 0, 0);
  }

  return slots;
}





