/**
 * Zoom Function Executor
 * Allows AI agent to call Zoom functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { createZoomMeeting, cancelZoomMeeting } from '../zoom';

/**
 * Execute a Zoom function
 */
export async function executeZoomFunction(
  functionName: string,
  parameters: Record<string, any>,
  integration: ConnectedIntegration
): Promise<any> {
  const organizationId = integration.organizationId || '';
  const accessToken = integration.accessToken || '';
  
  if (!organizationId) {
    throw new Error('Organization ID not configured');
  }
  
  if (!accessToken) {
    throw new Error('Zoom access token not configured');
  }
  
  switch (functionName) {
    case 'createMeeting':
      // Validate required parameters
      if (!parameters.topic || typeof parameters.topic !== 'string') {
        throw new Error('topic (string) is required for createMeeting');
      }
      if (!parameters.startTime || typeof parameters.startTime !== 'string') {
        throw new Error('startTime (string) is required for createMeeting');
      }
      if (typeof parameters.duration !== 'number') {
        throw new Error('duration (number) is required for createMeeting');
      }
      
      return await createZoomMeeting(organizationId, {
        topic: parameters.topic,
        startTime: new Date(parameters.startTime),
        duration: parameters.duration,
        timezone: parameters.timezone,
        agenda: parameters.agenda,
        attendees: parameters.attendees,
      });
      
    case 'getRecordings':
      // Get recordings using Zoom API
      const recordingsResponse = await fetch(
        `https://api.zoom.us/v2/users/me/recordings?from=${parameters.from || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );
      
      if (!recordingsResponse.ok) {
        throw new Error('Failed to fetch Zoom recordings');
      }
      
      const recordingsData = await recordingsResponse.json();
      return recordingsData.meetings || [];
      
    case 'cancelMeeting':
      // Validate required parameters
      if (!parameters.meetingId || typeof parameters.meetingId !== 'string') {
        throw new Error('meetingId (string) is required for cancelMeeting');
      }
      
      return await cancelZoomMeeting(organizationId, parameters.meetingId);
      
    default:
      throw new Error(`Unknown Zoom function: ${functionName}`);
  }
}
