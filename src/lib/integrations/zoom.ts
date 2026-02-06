/**
 * Zoom Integration
 * - Create meetings
 * - Schedule with auto-generated links
 * - Sync with calendar
 */

import { logger } from '@/lib/logger/logger';

interface ZoomMeetingOptions {
  topic: string;
  startTime: Date;
  duration: number; // minutes
  timezone?: string;
  agenda?: string;
  attendees?: string[]; // email addresses
}

interface ZoomMeeting {
  id: string;
  joinUrl: string;
  startUrl: string;
  meetingId: string;
  password?: string;
  topic: string;
  startTime: Date;
  duration: number;
}

interface ZoomApiMeetingResponse {
  id: number;
  join_url: string;
  start_url: string;
  password?: string;
  topic: string;
  start_time: string;
  duration: number;
}

interface ZoomApiErrorResponse {
  message?: string;
}

interface ZoomOAuthTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

/**
 * Create a Zoom meeting
 */
export async function createZoomMeeting(
  organizationId: string,
  options: ZoomMeetingOptions
): Promise<ZoomMeeting> {
  try {
    // Get Zoom OAuth token for this organization
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials(organizationId, 'zoom');
    
    if (!credentials?.accessToken) {
      throw new Error('Zoom not connected. Please connect Zoom in Integrations settings.');
    }

    // Create meeting via Zoom API
    const response = await fetch('https://api.zoom.us/v2/users/me/meetings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        topic: options.topic,
        type: 2, // Scheduled meeting
        start_time: options.startTime.toISOString(),
        duration: options.duration,
        timezone: (options.timezone !== '' && options.timezone != null) ? options.timezone : 'America/New_York',
        agenda: (options.agenda !== '' && options.agenda != null) ? options.agenda : '',
        settings: {
          host_video: true,
          participant_video: true,
          join_before_host: false,
          mute_upon_entry: true,
          waiting_room: true,
          auto_recording: 'cloud',
        },
      }),
    });

    if (!response.ok) {
      const error = await response.json() as ZoomApiErrorResponse;
      const zoomErrorMsg = error.message ?? response.statusText;
      throw new Error(`Zoom API error: ${zoomErrorMsg}`);
    }

    const data = await response.json() as ZoomApiMeetingResponse;

    logger.info('Zoom meeting created', {
      organizationId,
      meetingId: data.id,
      topic: options.topic,
    });

    return {
      id: data.id.toString(),
      joinUrl: data.join_url,
      startUrl: data.start_url,
      meetingId: data.id.toString(),
      password: data.password,
      topic: data.topic,
      startTime: new Date(data.start_time),
      duration: data.duration,
    };

  } catch (error) {
    logger.error('Failed to create Zoom meeting', error instanceof Error ? error : undefined, { organizationId });
    throw error;
  }
}

/**
 * Delete/cancel a Zoom meeting
 */
export async function cancelZoomMeeting(
  organizationId: string,
  meetingId: string
): Promise<void> {
  try {
    const { getIntegrationCredentials } = await import('./integration-manager');
    const credentials = await getIntegrationCredentials(organizationId, 'zoom');
    
    if (!credentials?.accessToken) {
      throw new Error('Zoom not connected');
    }

    const response = await fetch(`https://api.zoom.us/v2/meetings/${meetingId}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${credentials.accessToken}`,
      },
    });

    if (!response.ok && response.status !== 204) {
      throw new Error('Failed to cancel Zoom meeting');
    }

    logger.info('Zoom meeting cancelled', { organizationId, meetingId });

  } catch (error) {
    logger.error('Failed to cancel Zoom meeting', error instanceof Error ? error : undefined, { organizationId, meetingId });
    throw error;
  }
}

/**
 * Get Zoom OAuth authorization URL
 */
export function getZoomAuthUrl(redirectUri: string): string {
  const clientId = process.env.ZOOM_CLIENT_ID;
  if (!clientId) {
    throw new Error('ZOOM_CLIENT_ID not configured');
  }

  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    state: 'rapid-compliance-root', // Pass org ID to know which org to save tokens for
  });

  return `https://zoom.us/oauth/authorize?${params.toString()}`;
}

/**
 * Exchange OAuth code for access token
 */
export async function exchangeZoomCode(
  code: string,
  redirectUri: string
): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
  try {
    const clientId = process.env.ZOOM_CLIENT_ID;
    const clientSecret = process.env.ZOOM_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      throw new Error('Zoom credentials not configured');
    }

    const response = await fetch('https://zoom.us/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error('Failed to exchange Zoom code');
    }

    const data = await response.json() as ZoomOAuthTokenResponse;

    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in,
    };

  } catch (error) {
    logger.error('Zoom OAuth exchange failed', error instanceof Error ? error : undefined);
    throw error;
  }
}

