/**
 * Outlook Function Executor
 * Allows AI agent to call Outlook/Microsoft functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { sendEmail, listCalendarEvents, createCalendarEvent } from '../outlook-service';

/**
 * Execute an Outlook function
 */
export async function executeOutlookFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  integration: ConnectedIntegration
): Promise<unknown> {
  const accessToken = (integration.accessToken !== '' && integration.accessToken != null) ? integration.accessToken : '';

  if (!accessToken) {
    throw new Error('Outlook access token not configured');
  }

  switch (functionName) {
    case 'sendEmail':
      // Validate required parameters
      if (!parameters.to || typeof parameters.to !== 'string') {
        throw new Error('to (string) is required for sendEmail');
      }
      if (!parameters.subject || typeof parameters.subject !== 'string') {
        throw new Error('subject (string) is required for sendEmail');
      }
      if (!parameters.body || typeof parameters.body !== 'string') {
        throw new Error('body (string) is required for sendEmail');
      }

      return sendEmail(accessToken, {
        to: parameters.to,
        subject: parameters.subject,
        body: parameters.body,
      });

    case 'getCalendar': {
      // Optional parameters
      const startDateTime = parameters.startDateTime as string | undefined;
      const endDateTime = parameters.endDateTime as string | undefined;

      return listCalendarEvents(accessToken, {
        startDateTime,
        endDateTime,
      });
    }

    case 'createCalendarEvent':
      // Validate required parameters
      if (!parameters.subject || typeof parameters.subject !== 'string') {
        throw new Error('subject (string) is required for createCalendarEvent');
      }
      if (!parameters.start || typeof parameters.start !== 'string') {
        throw new Error('start (string) is required for createCalendarEvent');
      }
      if (!parameters.end || typeof parameters.end !== 'string') {
        throw new Error('end (string) is required for createCalendarEvent');
      }

      return createCalendarEvent(accessToken, {
        subject: parameters.subject,
        body: parameters.body as string | undefined,
        start: parameters.start,
        end: parameters.end,
        attendees: parameters.attendees as string[] | undefined,
        location: parameters.location as string | undefined,
      });

    default:
      throw new Error(`Unknown Outlook function: ${functionName}`);
  }
}
