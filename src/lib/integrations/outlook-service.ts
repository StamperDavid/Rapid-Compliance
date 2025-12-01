/**
 * Outlook/Microsoft Integration
 * Real integration using Microsoft Graph API
 */

import { Client } from '@microsoft/microsoft-graph-client';

const MICROSOFT_CLIENT_ID = process.env.MICROSOFT_CLIENT_ID;
const MICROSOFT_CLIENT_SECRET = process.env.MICROSOFT_CLIENT_SECRET;
const MICROSOFT_REDIRECT_URI = process.env.MICROSOFT_REDIRECT_URI || 'http://localhost:3000/api/integrations/microsoft/callback';

/**
 * Get Microsoft OAuth URL
 */
export function getMicrosoftAuthUrl(): string {
  const scopes = [
    'openid',
    'profile',
    'email',
    'offline_access',
    'Mail.Read',
    'Mail.Send',
    'Calendars.ReadWrite',
  ].join(' ');

  return `https://login.microsoftonline.com/common/oauth2/v2.0/authorize?client_id=${MICROSOFT_CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(MICROSOFT_REDIRECT_URI)}&scope=${encodeURIComponent(scopes)}`;
}

/**
 * Exchange code for tokens
 */
export async function getTokensFromCode(code: string): Promise<{
  access_token: string;
  refresh_token: string;
  expires_in: number;
}> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID!,
      client_secret: MICROSOFT_CLIENT_SECRET!,
      code,
      redirect_uri: MICROSOFT_REDIRECT_URI,
      grant_type: 'authorization_code',
    }),
  });

  return await response.json();
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(refreshToken: string): Promise<{
  access_token: string;
  refresh_token: string;
}> {
  const response = await fetch('https://login.microsoftonline.com/common/oauth2/v2.0/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: MICROSOFT_CLIENT_ID!,
      client_secret: MICROSOFT_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: 'refresh_token',
    }),
  });

  return await response.json();
}

/**
 * Create Graph client
 */
function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * List emails
 */
export async function listEmails(accessToken: string, options?: {
  top?: number;
  skip?: number;
  filter?: string;
}): Promise<any[]> {
  const client = createGraphClient(accessToken);
  
  let request = client.api('/me/messages').top(options?.top || 50);
  
  if (options?.skip) {
    request = request.skip(options.skip);
  }
  
  if (options?.filter) {
    request = request.filter(options.filter);
  }

  const response = await request.get();
  return response.value;
}

/**
 * Send email
 */
export async function sendEmail(accessToken: string, email: {
  to: string;
  subject: string;
  body: string;
}): Promise<void> {
  const client = createGraphClient(accessToken);
  
  await client.api('/me/sendMail').post({
    message: {
      subject: email.subject,
      body: {
        contentType: 'HTML',
        content: email.body,
      },
      toRecipients: [
        {
          emailAddress: {
            address: email.to,
          },
        },
      ],
    },
  });
}

/**
 * List calendar events
 */
export async function listCalendarEvents(accessToken: string, options?: {
  startDateTime?: string;
  endDateTime?: string;
}): Promise<any[]> {
  const client = createGraphClient(accessToken);
  
  let request = client.api('/me/calendar/events');
  
  if (options?.startDateTime && options?.endDateTime) {
    request = request.query({
      startDateTime: options.startDateTime,
      endDateTime: options.endDateTime,
    });
  }

  const response = await request.get();
  return response.value;
}

/**
 * Create calendar event
 */
export async function createCalendarEvent(accessToken: string, event: {
  subject: string;
  body?: string;
  start: string;
  end: string;
  attendees?: string[];
  location?: string;
}): Promise<any> {
  const client = createGraphClient(accessToken);
  
  const eventData: any = {
    subject: event.subject,
    start: {
      dateTime: event.start,
      timeZone: 'UTC',
    },
    end: {
      dateTime: event.end,
      timeZone: 'UTC',
    },
  };

  if (event.body) {
    eventData.body = {
      contentType: 'HTML',
      content: event.body,
    };
  }

  if (event.location) {
    eventData.location = {
      displayName: event.location,
    };
  }

  if (event.attendees && event.attendees.length > 0) {
    eventData.attendees = event.attendees.map(email => ({
      emailAddress: {
        address: email,
      },
      type: 'required',
    }));
  }

  return await client.api('/me/calendar/events').post(eventData);
}

/**
 * Get calendar free/busy
 */
export async function getFreeBusy(accessToken: string, options: {
  emails: string[];
  startTime: string;
  endTime: string;
}): Promise<any> {
  const client = createGraphClient(accessToken);
  
  return await client.api('/me/calendar/getSchedule').post({
    schedules: options.emails,
    startTime: {
      dateTime: options.startTime,
      timeZone: 'UTC',
    },
    endTime: {
      dateTime: options.endTime,
      timeZone: 'UTC',
    },
    availabilityViewInterval: 30,
  });
}

