/**
 * Google Calendar Sync Service
 * Bidirectional calendar syncing between Google Calendar and CRM
 */

import { google, type calendar_v3 } from 'googleapis';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';

export interface CalendarEvent {
  id: string;
  calendarId: string;
  summary: string;
  description?: string;
  location?: string;
  start: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  end: {
    dateTime?: string;
    date?: string;
    timeZone?: string;
  };
  attendees?: Array<{
    email: string;
    displayName?: string;
    responseStatus: 'needsAction' | 'declined' | 'tentative' | 'accepted';
  }>;
  organizer?: {
    email: string;
    displayName?: string;
  };
  meetLink?: string;
  status: 'confirmed' | 'tentative' | 'cancelled';
  visibility: 'default' | 'public' | 'private';
  recurringEventId?: string;
  created: string;
  updated: string;
}

export interface CalendarSyncStatus {
  organizationId: string;
  lastSyncAt: string;
  syncToken?: string;
  eventsSynced: number;
  errors: number;
}

interface ContactWithId {
  id: string;
  email?: string;
}

/**
 * Initialize Calendar API client
 */
function getCalendarClient(accessToken: string): calendar_v3.Calendar {
  const auth = new google.auth.OAuth2();
  auth.setCredentials({ access_token: accessToken });

  return google.calendar({ version: 'v3', auth });
}

/**
 * Sync Google Calendar events to CRM
 */
export async function syncCalendarEvents(
  accessToken: string,
  calendarId: string = 'primary'
): Promise<CalendarSyncStatus> {
  const calendar = getCalendarClient(accessToken);

  try {
    // Get last sync status
    const lastSync = await getLastSyncStatus(calendarId);

    // If we have a sync token, use incremental sync
    if (lastSync?.syncToken) {
      return await incrementalSync(calendar, calendarId, lastSync.syncToken);
    }

    // Full sync (first time)
    return await fullSync(calendar, calendarId);
  } catch (error) {
    logger.error('[Calendar Sync] Error:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Full sync (initial sync)
 */
async function fullSync(
  calendar: calendar_v3.Calendar,
  calendarId: string
): Promise<CalendarSyncStatus> {
  let eventsSynced = 0;
  let errors = 0;
  let syncToken: string | undefined;

  try {
    const now = new Date();
    const oneMonthAgo = new Date(now);
    oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1);
    const threeMonthsLater = new Date(now);
    threeMonthsLater.setMonth(threeMonthsLater.getMonth() + 3);

    let pageToken: string | undefined;

    do {
      const response = await calendar.events.list({
        calendarId,
        timeMin: oneMonthAgo.toISOString(),
        timeMax: threeMonthsLater.toISOString(),
        maxResults: 250,
        singleEvents: true,
        orderBy: 'startTime',
        pageToken,
      });

      if (response.data.items) {
        for (const event of response.data.items) {
          try {
            const parsed = parseCalendarEvent(event, calendarId);
            await saveEventToCRM(parsed);
            eventsSynced++;
          } catch (err) {
            logger.error(`[Calendar Sync] Error processing event ${event.id ?? 'unknown'}:`, err instanceof Error ? err : new Error(String(err)), { file: 'calendar-sync-service.ts' });
            errors++;
          }
        }
      }

      const nextPage = response.data.nextPageToken;
      pageToken = (nextPage !== '' && nextPage != null) ? nextPage : undefined;
      const nextSync = response.data.nextSyncToken;
      syncToken = (nextSync !== '' && nextSync != null) ? nextSync : undefined;
    } while (pageToken);

    const status: CalendarSyncStatus = {
      organizationId: DEFAULT_ORG_ID,
      lastSyncAt: new Date().toISOString(),
      syncToken,
      eventsSynced,
      errors,
    };

    await saveSyncStatus(calendarId, status);

    return status;
  } catch (error) {
    logger.error('[Calendar Sync] Full sync error:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Incremental sync using sync token
 */
async function incrementalSync(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  startSyncToken: string
): Promise<CalendarSyncStatus> {
  let eventsSynced = 0;
  let errors = 0;
  let syncToken: string | undefined = startSyncToken;

  try {
    let pageToken: string | undefined;

    do {
      const response = await calendar.events.list({
        calendarId,
        syncToken,
        pageToken,
      }) as { data: { items?: calendar_v3.Schema$Event[]; nextPageToken?: string | null; nextSyncToken?: string | null } };

      if (response.data.items) {
        for (const event of response.data.items) {
          try {
            if (event.status === 'cancelled') {
              // Delete cancelled events
              if (event.id) {
                await deleteEventFromCRM(event.id);
              }
            } else {
              // Update or create event
              const parsed = parseCalendarEvent(event, calendarId);
              await saveEventToCRM(parsed);
              eventsSynced++;
            }
          } catch (err) {
            logger.error(`[Calendar Sync] Error processing event ${event.id ?? 'unknown'}:`, err instanceof Error ? err : new Error(String(err)), { file: 'calendar-sync-service.ts' });
            errors++;
          }
        }
      }

      const nextPage2 = response.data.nextPageToken;
      pageToken = (nextPage2 !== '' && nextPage2 != null) ? nextPage2 : undefined;
      const nextSync2 = response.data.nextSyncToken;
      syncToken = (nextSync2 !== '' && nextSync2 != null) ? nextSync2 : syncToken;
    } while (pageToken);

    const status: CalendarSyncStatus = {
      organizationId: DEFAULT_ORG_ID,
      lastSyncAt: new Date().toISOString(),
      syncToken,
      eventsSynced,
      errors,
    };

    await saveSyncStatus(calendarId, status);

    return status;
  } catch (error) {
    logger.error('[Calendar Sync] Incremental sync error:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    // If sync token is invalid, fall back to full sync
    if (error && typeof error === 'object' && 'code' in error && error.code === 410) {
      logger.info('[Calendar Sync] Sync token invalid, performing full sync', { file: 'calendar-sync-service.ts' });
      return fullSync(calendar, calendarId);
    }
    throw error;
  }
}

/**
 * Parse Google Calendar event to our format
 */
function parseCalendarEvent(event: calendar_v3.Schema$Event, calendarId: string): CalendarEvent {
  if (!event.id) {
    throw new Error('Event ID is required');
  }
  if (!event.created) {
    throw new Error('Event created date is required');
  }
  if (!event.updated) {
    throw new Error('Event updated date is required');
  }

  return {
    id: event.id,
    calendarId,
    summary: (event.summary !== '' && event.summary != null) ? event.summary : '(No title)',
    description: event.description ?? undefined,
    location: event.location ?? undefined,
    start: {
      dateTime: event.start?.dateTime ?? undefined,
      date: event.start?.date ?? undefined,
      timeZone: event.start?.timeZone ?? undefined,
    },
    end: {
      dateTime: event.end?.dateTime ?? undefined,
      date: event.end?.date ?? undefined,
      timeZone: event.end?.timeZone ?? undefined,
    },
    attendees: event.attendees?.map(a => {
      if (!a.email) {
        throw new Error('Attendee email is required');
      }
      return {
        email: a.email,
        displayName: a.displayName ?? undefined,
        responseStatus: (a.responseStatus ?? 'needsAction') as 'needsAction' | 'declined' | 'tentative' | 'accepted',
      };
    }),
    organizer: event.organizer?.email ? {
      email: event.organizer.email,
      displayName: event.organizer.displayName ?? undefined,
    } : undefined,
    meetLink: (event.hangoutLink ?? event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri) ?? undefined,
    status: (event.status ?? 'confirmed') as 'confirmed' | 'tentative' | 'cancelled',
    visibility: (event.visibility ?? 'default') as 'default' | 'public' | 'private',
    recurringEventId: event.recurringEventId ?? undefined,
    created: event.created,
    updated: event.updated,
  };
}

/**
 * Save event to CRM
 */
async function saveEventToCRM(event: CalendarEvent): Promise<void> {
  try {
    // Try to match attendees to contacts
    const contactIds: string[] = [];
    if (event.attendees) {
      for (const attendee of event.attendees) {
        const contact = await findContactByEmail(attendee.email);
        if (contact?.id) {
          contactIds.push(contact.id);
        }
      }
    }

    const eventData = {
      id: event.id,
      organizationId: DEFAULT_ORG_ID,
      calendarId: event.calendarId,
      title: event.summary,
      description: event.description,
      location: event.location,
      startTime: event.start.dateTime ? new Date(event.start.dateTime) :
                 event.start.date ? new Date(event.start.date) : new Date(),
      endTime: event.end.dateTime ? new Date(event.end.dateTime) :
               event.end.date ? new Date(event.end.date) : new Date(),
      isAllDay: !!event.start.date,
      attendees: event.attendees?.map(a => a.email),
      attendeeDetails: event.attendees,
      contactIds,
      organizer: event.organizer?.email,
      meetLink: event.meetLink,
      status: event.status,
      visibility: event.visibility,
      isRecurring: !!event.recurringEventId,
      recurringEventId: event.recurringEventId,
      source: 'google-calendar',
      createdAt: new Date(event.created),
      updatedAt: new Date(event.updated),
    };

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/calendarEvents`,
      event.id,
      eventData
    );

    // Update contacts with last interaction
    for (const contactId of contactIds) {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/contacts`,
        contactId,
        {
          lastContactDate: eventData.startTime,
          lastContactType: 'meeting',
          updatedAt: new Date(),
        }
      );
    }
  } catch (error) {
    logger.error('[Calendar Sync] Error saving event to CRM:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Delete event from CRM
 */
async function deleteEventFromCRM(eventId: string): Promise<void> {
  try {
    await FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/calendarEvents`,
      eventId
    );
  } catch (error) {
    logger.error('[Calendar Sync] Error deleting event:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
  }
}

/**
 * Create event in Google Calendar from CRM
 */
export async function createCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventData: {
    summary: string;
    description?: string;
    location?: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees?: string[];
    conferenceData?: boolean; // Add Google Meet link
  }
): Promise<string> {
  const calendar = getCalendarClient(accessToken);

  try {
    const request: calendar_v3.Schema$Event = {
      summary: eventData.summary,
      description: eventData.description,
      location: eventData.location,
      start: eventData.start,
      end: eventData.end,
      attendees: eventData.attendees?.map(email => ({ email })),
    };

    // Add Google Meet conference if requested
    if (eventData.conferenceData) {
      request.conferenceData = {
        createRequest: {
          requestId: `meet-${Date.now()}`,
          conferenceSolutionKey: { type: 'hangoutsMeet' },
        },
      };
    }

    const response = await calendar.events.insert({
      calendarId,
      requestBody: request,
      conferenceDataVersion: eventData.conferenceData ? 1 : 0,
      sendUpdates: 'all', // Send email invitations
    });

    if (!response.data.id) {
      throw new Error('Failed to create calendar event: no ID returned');
    }

    return response.data.id;
  } catch (error) {
    logger.error('[Calendar Sync] Error creating event:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Update event in Google Calendar from CRM
 */
export async function updateCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string,
  eventData: Partial<{
    summary: string;
    description: string;
    location: string;
    start: { dateTime: string; timeZone?: string };
    end: { dateTime: string; timeZone?: string };
    attendees: string[];
  }>
): Promise<void> {
  const calendar = getCalendarClient(accessToken);

  try {
    const request: calendar_v3.Schema$Event = {
      ...eventData,
      attendees: eventData.attendees?.map(email => ({ email })),
    };

    await calendar.events.patch({
      calendarId,
      eventId,
      requestBody: request,
      sendUpdates: 'all',
    });
  } catch (error) {
    logger.error('[Calendar Sync] Error updating event:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Delete event from Google Calendar
 */
export async function deleteCalendarEvent(
  accessToken: string,
  calendarId: string,
  eventId: string
): Promise<void> {
  const calendar = getCalendarClient(accessToken);

  try {
    await calendar.events.delete({
      calendarId,
      eventId,
      sendUpdates: 'all',
    });
  } catch (error) {
    logger.error('[Calendar Sync] Error deleting event:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Find contact by email
 */
async function findContactByEmail(email: string): Promise<ContactWithId | null> {
  try {
    const contacts = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/contacts`
    );
    const contactsFiltered = contacts.filter((c: unknown): c is ContactWithId => {
      if (typeof c !== 'object' || c === null) {return false;}
      const contact = c as Record<string, unknown>;
      return typeof contact.email === 'string' && contact.email === email;
    });

    return contactsFiltered.length > 0 ? contactsFiltered[0] : null;
  } catch (error) {
    logger.error('[Calendar Sync] Error finding contact:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    return null;
  }
}

/**
 * Get last sync status
 */
async function getLastSyncStatus(calendarId: string): Promise<CalendarSyncStatus | null> {
  try {
    const status = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/integrationStatus`,
      `calendar-sync-${calendarId}`
    );
    return status as CalendarSyncStatus | null;
  } catch (_error) {
    return null;
  }
}

/**
 * Save sync status
 */
async function saveSyncStatus(calendarId: string, status: CalendarSyncStatus): Promise<void> {
  try {
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/integrationStatus`,
      `calendar-sync-${calendarId}`,
      status
    );
  } catch (error) {
    logger.error('[Calendar Sync] Error saving sync status:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
  }
}

/**
 * Setup calendar push notifications (webhook)
 */
export async function setupCalendarPushNotifications(
  accessToken: string,
  calendarId: string,
  webhookUrl: string
): Promise<string> {
  const calendar = getCalendarClient(accessToken);

  try {
    const response = await calendar.events.watch({
      calendarId,
      requestBody: {
        id: `calendar-watch-${calendarId}-${Date.now()}`,
        type: 'web_hook',
        address: webhookUrl,
      },
    });

    logger.info('[Calendar Sync] Push notifications enabled', { file: 'calendar-sync-service.ts' });

    if (!response.data.id) {
      throw new Error('Failed to setup push notifications: no channel ID returned');
    }

    return response.data.id;
  } catch (error) {
    logger.error('[Calendar Sync] Error setting up push notifications:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Stop calendar push notifications
 */
export async function stopCalendarPushNotifications(
  accessToken: string,
  channelId: string,
  resourceId: string
): Promise<void> {
  const calendar = getCalendarClient(accessToken);

  try {
    await calendar.channels.stop({
      requestBody: {
        id: channelId,
        resourceId,
      },
    });

    logger.info('[Calendar Sync] Push notifications disabled', { file: 'calendar-sync-service.ts' });
  } catch (error) {
    logger.error('[Calendar Sync] Error stopping push notifications:', error instanceof Error ? error : new Error(String(error)), { file: 'calendar-sync-service.ts' });
    throw error;
  }
}
