/**
 * Zoom Function Executor
 * Allows AI agent to call Zoom functions
 */

import type { ConnectedIntegration } from '@/types/integrations';
import { createZoomMeeting, cancelZoomMeeting } from '../zoom';

interface ZoomRecordingsResponse {
  meetings?: unknown[];
}

/**
 * Execute a Zoom function
 */
export async function executeZoomFunction(
  functionName: string,
  parameters: Record<string, unknown>,
  integration: ConnectedIntegration
): Promise<unknown> {
  // Import DEFAULT_ORG_ID for penthouse
  const { DEFAULT_ORG_ID } = await import('@/lib/constants/platform');
  const accessToken = (integration.accessToken !== '' && integration.accessToken != null) ? integration.accessToken : '';

  if (!accessToken) {
    throw new Error('Zoom access token not configured');
  }

  switch (functionName) {
    case 'createMeeting': {
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

      return createZoomMeeting(DEFAULT_ORG_ID, {
        topic: parameters.topic,
        startTime: new Date(parameters.startTime),
        duration: parameters.duration,
        timezone: parameters.timezone as string | undefined,
        agenda: parameters.agenda as string | undefined,
        attendees: parameters.attendees as string[] | undefined,
      });
    }

    case 'getRecordings': {
      // Get recordings using Zoom API
      const fromDate = (parameters.from !== '' && parameters.from != null) ? parameters.from as string : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const recordingsResponse = await fetch(
        `https://api.zoom.us/v2/users/me/recordings?from=${fromDate}`,
        {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
          },
        }
      );

      if (!recordingsResponse.ok) {
        throw new Error('Failed to fetch Zoom recordings');
      }

      const recordingsData = await recordingsResponse.json() as ZoomRecordingsResponse;
      return recordingsData.meetings ?? [];
    }

    case 'cancelMeeting':
      // Validate required parameters
      if (!parameters.meetingId || typeof parameters.meetingId !== 'string') {
        throw new Error('meetingId (string) is required for cancelMeeting');
      }

      return cancelZoomMeeting(DEFAULT_ORG_ID, parameters.meetingId);

    default:
      throw new Error(`Unknown Zoom function: ${functionName}`);
  }
}
