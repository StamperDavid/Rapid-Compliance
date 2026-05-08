/**
 * Google Calendar Integration
 * REAL calendar integration using Google Calendar API
 */

import { google } from 'googleapis';
import type { OAuth2Client } from 'google-auth-library'
import { logger } from '@/lib/logger/logger';
import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { getConnectedGoogleTokens } from '@/lib/integrations/google-tokens';

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const googleRedirectUriEnv = process.env.GOOGLE_REDIRECT_URI;
const GOOGLE_REDIRECT_URI = (googleRedirectUriEnv !== '' && googleRedirectUriEnv != null) ? googleRedirectUriEnv : 'http://localhost:3000/api/integrations/google/callback';

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
  // Verify environment variables are set
  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    logger.error('[Google OAuth] Missing environment variables', new Error('[Google OAuth] Missing environment variables'), { file: 'google-calendar-service.ts' });
    logger.error('Google Calendar credentials missing', new Error('Missing Google credentials'), {
      clientId: GOOGLE_CLIENT_ID ? 'SET' : 'MISSING',
      clientSecret: GOOGLE_CLIENT_SECRET ? 'SET' : 'MISSING',
      file: 'google-calendar-service.ts'
    });
    throw new Error('Google OAuth credentials not configured');
  }

  const oauth2Client = createOAuth2Client();
  
  logger.info('[Google OAuth] Exchanging code for tokens...', { file: 'google-calendar-service.ts' });
  logger.info('[Google OAuth] Redirect URI', { redirectUri: GOOGLE_REDIRECT_URI, file: 'google-calendar-service.ts' });
  
  const { tokens } = await oauth2Client.getToken(code);
  
  logger.info('[Google OAuth] Tokens received successfully', { file: 'google-calendar-service.ts' });


  if (!tokens.access_token) {
    throw new Error('Failed to obtain access token from Google');
  }

  return {
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token ?? undefined,
    expiry_date: tokens.expiry_date ?? undefined,
  };
}

/**
 * List calendars
 */
interface CalendarListItem {
  id?: string;
  summary?: string;
  description?: string;
  primary?: boolean;
}

export async function listCalendars(tokens: {
  access_token: string;
  refresh_token?: string;
}): Promise<CalendarListItem[]> {
  const auth = createOAuth2Client(tokens);
  const calendar = google.calendar({ version: 'v3', auth });

  const response = await calendar.calendarList.list();
  return (response.data.items ?? []) as CalendarListItem[];
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

  const busyTimes = response.data.calendars?.[calendarId]?.busy ?? [];

  return {
    busy: busyTimes.map((slot) => ({
      start: slot.start ?? '',
      end: slot.end ?? '',
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

  if (!response.data.id) {
    throw new Error('Failed to create event: no ID returned');
  }
  if (!response.data.htmlLink) {
    throw new Error('Failed to create event: no htmlLink returned');
  }

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink,
    hangoutLink: response.data.hangoutLink ?? undefined,
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
    requestBody: updates,
    sendUpdates: 'all',
  });

  if (!response.data.id) {
    throw new Error('Failed to update event: no ID returned');
  }
  if (!response.data.htmlLink) {
    throw new Error('Failed to update event: no htmlLink returned');
  }

  return {
    id: response.data.id,
    htmlLink: response.data.htmlLink,
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

  // Get busy times
  const { busy } = await getFreeBusy(tokens, calendarId, startDate, endDate);

  const slots: { start: Date; end: Date }[] = [];
  const currentDate = new Date(startDate);

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

// ─── SalesVelocity dedicated calendar helpers ────────────────────────────────
//
// Per `feedback_one_google_account_per_tenant_runs_calendars_and_email`,
// every scheduled item the platform creates (social posts, email sends,
// missions, workflow actions, content calendar entries) writes an event
// to a DEDICATED calendar named "SalesVelocity.ai" under the connected
// account. The dedicated calendar keeps platform-scheduled work
// distinct from the operator's primary work calendar so they can
// hide/show/share it independently.
//
// All helpers below auto-resolve tokens via `getConnectedGoogleTokens`
// (the central token store from Rule 3) — callers don't pass tokens.
// Returns null on failure so callers can choose to log + continue
// rather than block the user-facing scheduling action.

const SALESVELOCITY_CALENDAR_NAME = 'SalesVelocity.ai';
const CALENDAR_ID_CACHE_COLLECTION = 'connectedAccounts';
const CALENDAR_ID_CACHE_DOC = 'google';
export const CALENDAR_EVENT_MAPPINGS_COLLECTION = 'calendarEventMappings';

/**
 * Get or create the dedicated "SalesVelocity.ai" calendar on the
 * connected Google account. Caches the calendar id in Firestore
 * (under the same `connectedAccounts/google` doc) so subsequent
 * callers don't have to list calendars.
 *
 * Returns null when:
 *   - No Google account is connected (operator hasn't OAuth'd yet)
 *   - The Calendar API call fails (logged)
 */
export async function getOrCreateSalesVelocityCalendar(): Promise<string | null> {
  if (!adminDb) {
    return null;
  }

  // Check cache first.
  try {
    const cacheRef = adminDb
      .collection(getSubCollection(CALENDAR_ID_CACHE_COLLECTION))
      .doc(CALENDAR_ID_CACHE_DOC);
    const cached = await cacheRef.get();
    if (cached.exists) {
      const data = cached.data() as { salesvelocityCalendarId?: string } | undefined;
      if (typeof data?.salesvelocityCalendarId === 'string' && data.salesvelocityCalendarId.length > 0) {
        return data.salesvelocityCalendarId;
      }
    }
  } catch (err) {
    // Cache read failure is non-fatal — fall through to live lookup.
    logger.warn('[Calendar] cache read failed, falling through to API', {
      error: err instanceof Error ? err.message : String(err),
      file: 'google-calendar-service.ts',
    });
  }

  const tokens = await getConnectedGoogleTokens();
  if (!tokens) {
    logger.warn('[Calendar] no connected Google account — cannot create dedicated calendar', {
      file: 'google-calendar-service.ts',
    });
    return null;
  }

  try {
    const auth = createOAuth2Client({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? undefined,
    });
    const calendar = google.calendar({ version: 'v3', auth });

    // Look for an existing calendar named "SalesVelocity.ai".
    const list = await calendar.calendarList.list();
    const existing = list.data.items?.find((c) => c.summary === SALESVELOCITY_CALENDAR_NAME);
    let calendarId = existing?.id ?? null;

    // Create if not found.
    if (!calendarId) {
      const created = await calendar.calendars.insert({
        requestBody: {
          summary: SALESVELOCITY_CALENDAR_NAME,
          description: 'Auto-managed by SalesVelocity.ai — every scheduled platform action (social posts, email sends, missions, workflows) appears here.',
          timeZone: 'America/New_York',
        },
      });
      calendarId = created.data.id ?? null;
      if (!calendarId) {
        logger.error('[Calendar] insert returned no id', new Error('no calendar id'), {
          file: 'google-calendar-service.ts',
        });
        return null;
      }
      logger.info('[Calendar] created dedicated SalesVelocity.ai calendar', {
        calendarId,
        file: 'google-calendar-service.ts',
      });
    }

    // Persist to cache for next time.
    try {
      await adminDb
        .collection(getSubCollection(CALENDAR_ID_CACHE_COLLECTION))
        .doc(CALENDAR_ID_CACHE_DOC)
        .set({ salesvelocityCalendarId: calendarId, salesvelocityCalendarUpdatedAt: new Date().toISOString() }, { merge: true });
    } catch (err) {
      logger.warn('[Calendar] cache write failed (non-fatal)', {
        error: err instanceof Error ? err.message : String(err),
        file: 'google-calendar-service.ts',
      });
    }

    return calendarId;
  } catch (err) {
    logger.error('[Calendar] getOrCreateSalesVelocityCalendar failed',
      err instanceof Error ? err : new Error(String(err)),
      { file: 'google-calendar-service.ts' });
    return null;
  }
}

export interface ScheduledItemEventInput {
  /**
   * Stable, unique reference id for the scheduled item. Convention:
   *   social-post-{postId}
   *   email-send-{sendId}
   *   mission-{missionId}
   *   workflow-action-{actionId}
   *   content-calendar-{entryId}
   * Used to look up the existing Google Calendar event id for updates
   * and deletes (idempotent upsert pattern).
   */
  refId: string;
  /** Event title shown in Google Calendar. */
  summary: string;
  /** Optional description / details body. */
  description?: string;
  /** Start time as ISO 8601 string. */
  startIso: string;
  /**
   * End time as ISO 8601 string. Defaults to startIso + 30 minutes if
   * the scheduled item is point-in-time (e.g., a social post fires
   * instantly).
   */
  endIso?: string;
  /** IANA timezone (e.g., "America/New_York"). Defaults to caller-tz. */
  timeZone?: string;
  /**
   * Category for color-coding. We map these to Google Calendar's
   * built-in colorIds so the operator's calendar visually segments
   * social vs email vs missions vs meetings.
   */
  category: 'social' | 'email' | 'mission' | 'workflow' | 'content' | 'meeting' | 'voice';
}

// Google Calendar `colorId` values are integers 1-11 representing the
// platform's built-in event colors. Picked to give visual contrast.
const CATEGORY_COLOR_ID: Record<ScheduledItemEventInput['category'], string> = {
  social: '9', // Blueberry
  email: '10', // Basil (green)
  mission: '3', // Grape (purple)
  workflow: '7', // Peacock (cyan)
  content: '5', // Banana (yellow)
  meeting: '6', // Tangerine (orange)
  voice: '11', // Tomato (red)
};

interface CalendarEventMapping {
  refId: string;
  googleEventId: string;
  calendarId: string;
  updatedAt: string;
}

/**
 * Idempotent upsert of a Google Calendar event for a scheduled
 * platform item. Safe to call repeatedly with the same refId — first
 * call inserts, subsequent calls patch the existing event in place.
 *
 * Failure is non-fatal: returns null + logs. Callers should treat a
 * null return as "calendar event not synced" and continue with the
 * primary scheduling action (the platform's own DB record is the
 * authoritative state).
 */
export async function upsertSalesVelocityCalendarEvent(
  input: ScheduledItemEventInput,
): Promise<{ googleEventId: string; htmlLink: string } | null> {
  if (!adminDb) {
    return null;
  }

  const tokens = await getConnectedGoogleTokens();
  if (!tokens) {
    return null;
  }

  // Per the architectural rule (operator's connected Gmail is a work-only
  // account, no personal events to drown), every platform-scheduled
  // action writes directly to the operator's PRIMARY Google Calendar.
  // Color-coding by category is preserved via Google's `colorId` so the
  // operator can still visually segment social vs email vs missions in
  // the Day/Week view.
  //
  // Older events that were created when this helper used a dedicated
  // "SalesVelocity.ai" sub-calendar are still patchable / deletable —
  // the per-event mapping doc records `calendarId` at insert time, so
  // patch + delete code paths target whichever calendar each event
  // originally landed on. New events all go to 'primary'.
  const calendarId = 'primary';

  const startIso = input.startIso;
  const endIso = input.endIso ?? new Date(new Date(startIso).getTime() + 30 * 60 * 1000).toISOString();
  const timeZone = input.timeZone ?? 'America/New_York';
  const colorId = CATEGORY_COLOR_ID[input.category];

  try {
    const mappingsRef = adminDb
      .collection(getSubCollection(CALENDAR_EVENT_MAPPINGS_COLLECTION))
      .doc(input.refId);
    const existingMapping = await mappingsRef.get();

    const auth = createOAuth2Client({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? undefined,
    });
    const calendar = google.calendar({ version: 'v3', auth });

    if (existingMapping.exists) {
      const mapping = existingMapping.data() as CalendarEventMapping;
      // PATCH the existing event.
      const patched = await calendar.events.patch({
        calendarId: mapping.calendarId,
        eventId: mapping.googleEventId,
        requestBody: {
          summary: input.summary,
          description: input.description,
          start: { dateTime: startIso, timeZone },
          end: { dateTime: endIso, timeZone },
          colorId,
        },
      });
      const eventId = patched.data.id;
      const htmlLink = patched.data.htmlLink;
      if (!eventId || !htmlLink) {
        return null;
      }
      await mappingsRef.set(
        { refId: input.refId, googleEventId: eventId, calendarId: mapping.calendarId, updatedAt: new Date().toISOString() },
        { merge: true },
      );
      return { googleEventId: eventId, htmlLink };
    }

    // INSERT a new event.
    const inserted = await calendar.events.insert({
      calendarId,
      requestBody: {
        summary: input.summary,
        description: input.description,
        start: { dateTime: startIso, timeZone },
        end: { dateTime: endIso, timeZone },
        colorId,
        extendedProperties: {
          private: {
            salesvelocityRefId: input.refId,
            salesvelocityCategory: input.category,
          },
        },
      },
    });
    const eventId = inserted.data.id;
    const htmlLink = inserted.data.htmlLink;
    if (!eventId || !htmlLink) {
      return null;
    }
    await mappingsRef.set({
      refId: input.refId,
      googleEventId: eventId,
      calendarId,
      updatedAt: new Date().toISOString(),
    });
    return { googleEventId: eventId, htmlLink };
  } catch (err) {
    logger.error('[Calendar] upsertSalesVelocityCalendarEvent failed',
      err instanceof Error ? err : new Error(String(err)),
      { refId: input.refId, file: 'google-calendar-service.ts' });
    return null;
  }
}

/**
 * Delete the Google Calendar event corresponding to a scheduled item
 * that was cancelled. Idempotent — no-ops if the mapping doesn't exist
 * (e.g., the item was scheduled before this code shipped, or the
 * calendar event was never successfully created).
 */
export async function deleteSalesVelocityCalendarEvent(refId: string): Promise<{ success: boolean }> {
  if (!adminDb) {
    return { success: false };
  }
  const tokens = await getConnectedGoogleTokens();
  if (!tokens) {
    return { success: false };
  }

  try {
    const mappingsRef = adminDb
      .collection(getSubCollection(CALENDAR_EVENT_MAPPINGS_COLLECTION))
      .doc(refId);
    const mappingSnap = await mappingsRef.get();
    if (!mappingSnap.exists) {
      // Nothing to delete — return success so callers can ignore.
      return { success: true };
    }
    const mapping = mappingSnap.data() as CalendarEventMapping;

    const auth = createOAuth2Client({
      access_token: tokens.accessToken,
      refresh_token: tokens.refreshToken ?? undefined,
    });
    const calendar = google.calendar({ version: 'v3', auth });
    await calendar.events.delete({
      calendarId: mapping.calendarId,
      eventId: mapping.googleEventId,
    });
    await mappingsRef.delete();
    return { success: true };
  } catch (err) {
    logger.error('[Calendar] deleteSalesVelocityCalendarEvent failed',
      err instanceof Error ? err : new Error(String(err)),
      { refId, file: 'google-calendar-service.ts' });
    return { success: false };
  }
}



















