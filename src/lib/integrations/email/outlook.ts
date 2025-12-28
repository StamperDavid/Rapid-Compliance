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
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const accessToken = integration.accessToken || '';
  
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
      
      return await sendEmail(accessToken, {
        to: parameters.to,
        subject: parameters.subject,
        body: parameters.body,
      });
      
    case 'getCalendar':
      // Optional parameters
      const startDateTime = parameters.startDateTime;
      const endDateTime = parameters.endDateTime;
      
      return await listCalendarEvents(accessToken, {
        startDateTime,
        endDateTime,
      });
      
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
      
      return await createCalendarEvent(accessToken, {
        subject: parameters.subject,
        body: parameters.body,
        start: parameters.start,
        end: parameters.end,
        attendees: parameters.attendees,
        location: parameters.location,
      });
      
    default:
      throw new Error(`Unknown Outlook function: ${functionName}`);
  }
}
