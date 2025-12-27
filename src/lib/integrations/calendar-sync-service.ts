/**
 * Google Calendar Sync Service
 * Bidirectional calendar syncing between Google Calendar and CRM
 */

import { calendar_v3, google } from 'googleapis';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service'
import { logger } from '@/lib/logger/logger';;

const CALENDAR_SCOPES = [
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

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
  organizationId: string,
  accessToken: string,
  calendarId: string = 'primary'
): Promise<CalendarSyncStatus> {
  const calendar = getCalendarClient(accessToken);
  
  try {
    // Get last sync status
    const lastSync = await getLastSyncStatus(organizationId, calendarId);
    
    // If we have a sync token, use incremental sync
    if (lastSync?.syncToken) {
      return await incrementalSync(calendar, organizationId, calendarId, lastSync.syncToken);
    }
    
    // Full sync (first time)
    return await fullSync(calendar, organizationId, calendarId);
  } catch (error) {
    logger.error('[Calendar Sync] Error:', error, { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Full sync (initial sync)
 */
async function fullSync(
  calendar: calendar_v3.Calendar,
  organizationId: string,
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
            await saveEventToCRM(organizationId, parsed);
            eventsSynced++;
          } catch (err) {
            logger.error('[Calendar Sync] Error processing event ${event.id}:', err, { file: 'calendar-sync-service.ts' });
            errors++;
          }
        }
      }
      
      pageToken = response.data.nextPageToken || undefined;
      syncToken = response.data.nextSyncToken || undefined;
    } while (pageToken);
    
    const status: CalendarSyncStatus = {
      organizationId,
      lastSyncAt: new Date().toISOString(),
      syncToken,
      eventsSynced,
      errors,
    };
    
    await saveSyncStatus(organizationId, calendarId, status);
    
    return status;
  } catch (error) {
    logger.error('[Calendar Sync] Full sync error:', error, { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Incremental sync using sync token
 */
async function incrementalSync(
  calendar: calendar_v3.Calendar,
  organizationId: string,
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
      });
      
      if (response.data.items) {
        for (const event of response.data.items) {
          try {
            if (event.status === 'cancelled') {
              // Delete cancelled events
              await deleteEventFromCRM(organizationId, event.id!);
            } else {
              // Update or create event
              const parsed = parseCalendarEvent(event, calendarId);
              await saveEventToCRM(organizationId, parsed);
              eventsSynced++;
            }
          } catch (err) {
            logger.error('[Calendar Sync] Error processing event ${event.id}:', err, { file: 'calendar-sync-service.ts' });
            errors++;
          }
        }
      }
      
      pageToken = response.data.nextPageToken || undefined;
      syncToken = response.data.nextSyncToken || syncToken;
    } while (pageToken);
    
    const status: CalendarSyncStatus = {
      organizationId,
      lastSyncAt: new Date().toISOString(),
      syncToken,
      eventsSynced,
      errors,
    };
    
    await saveSyncStatus(organizationId, calendarId, status);
    
    return status;
  } catch (error) {
    logger.error('[Calendar Sync] Incremental sync error:', error, { file: 'calendar-sync-service.ts' });
    // If sync token is invalid, fall back to full sync
    if ((error as any).code === 410) {
      logger.info('[Calendar Sync] Sync token invalid, performing full sync', { file: 'calendar-sync-service.ts' });
      return await fullSync(calendar, organizationId, calendarId);
    }
    throw error;
  }
}

/**
 * Parse Google Calendar event to our format
 */
function parseCalendarEvent(event: calendar_v3.Schema$Event, calendarId: string): CalendarEvent {
  return {
    id: event.id!,
    calendarId,
    summary: event.summary || '(No title)',
    description: event.description,
    location: event.location,
    start: {
      dateTime: event.start?.dateTime,
      date: event.start?.date,
      timeZone: event.start?.timeZone,
    },
    end: {
      dateTime: event.end?.dateTime,
      date: event.end?.date,
      timeZone: event.end?.timeZone,
    },
    attendees: event.attendees?.map(a => ({
      email: a.email!,
      displayName: a.displayName,
      responseStatus: (a.responseStatus || 'needsAction') as any,
    })),
    organizer: event.organizer ? {
      email: event.organizer.email!,
      displayName: event.organizer.displayName,
    } : undefined,
    meetLink: event.hangoutLink || event.conferenceData?.entryPoints?.find(e => e.entryPointType === 'video')?.uri,
    status: (event.status || 'confirmed') as any,
    visibility: (event.visibility || 'default') as any,
    recurringEventId: event.recurringEventId,
    created: event.created!,
    updated: event.updated!,
  };
}

/**
 * Save event to CRM
 */
async function saveEventToCRM(organizationId: string, event: CalendarEvent): Promise<void> {
  try {
    // Try to match attendees to contacts
    const contactIds: string[] = [];
    if (event.attendees) {
      for (const attendee of event.attendees) {
        const contact = await findContactByEmail(organizationId, attendee.email);
        if (contact) {
          contactIds.push(contact.id);
        }
      }
    }
    
    const eventData = {
      id: event.id,
      organizationId,
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
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/calendarEvents`,
      event.id,
      eventData
    );
    
    // Update contacts with last interaction
    for (const contactId of contactIds) {
      await FirestoreService.update(
        `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/contacts`,
        contactId,
        {
          lastContactDate: eventData.startTime,
          lastContactType: 'meeting',
          updatedAt: new Date(),
        }
      );
    }
  } catch (error) {
    logger.error('[Calendar Sync] Error saving event to CRM:', error, { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Delete event from CRM
 */
async function deleteEventFromCRM(organizationId: string, eventId: string): Promise<void> {
  try {
    await FirestoreService.delete(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/calendarEvents`,
      eventId
    );
  } catch (error) {
    logger.error('[Calendar Sync] Error deleting event:', error, { file: 'calendar-sync-service.ts' });
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
    
    return response.data.id!;
  } catch (error) {
    logger.error('[Calendar Sync] Error creating event:', error, { file: 'calendar-sync-service.ts' });
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
    logger.error('[Calendar Sync] Error updating event:', error, { file: 'calendar-sync-service.ts' });
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
    logger.error('[Calendar Sync] Error deleting event:', error, { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

/**
 * Find contact by email
 */
async function findContactByEmail(organizationId: string, email: string): Promise<any | null> {
  try {
    const contacts = await FirestoreService.getAll(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/contacts`
    );
    const contactsFiltered = contacts.filter((c: any) => c.email === email);
    
    return contactsFiltered.length > 0 ? contactsFiltered[0] : null;
  } catch (error) {
    logger.error('[Calendar Sync] Error finding contact:', error, { file: 'calendar-sync-service.ts' });
    return null;
  }
}

/**
 * Get last sync status
 */
async function getLastSyncStatus(organizationId: string, calendarId: string): Promise<CalendarSyncStatus | null> {
  try {
    const status = await FirestoreService.get(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrationStatus`,
      `calendar-sync-${calendarId}`
    );
    return status as CalendarSyncStatus | null;
  } catch (error) {
    return null;
  }
}

/**
 * Save sync status
 */
async function saveSyncStatus(organizationId: string, calendarId: string, status: CalendarSyncStatus): Promise<void> {
  try {
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${organizationId}/integrationStatus`,
      `calendar-sync-${calendarId}`,
      status
    );
  } catch (error) {
    logger.error('[Calendar Sync] Error saving sync status:', error, { file: 'calendar-sync-service.ts' });
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
    return response.data.id!;
  } catch (error) {
    logger.error('[Calendar Sync] Error setting up push notifications:', error, { file: 'calendar-sync-service.ts' });
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
    logger.error('[Calendar Sync] Error stopping push notifications:', error, { file: 'calendar-sync-service.ts' });
    throw error;
  }
}

