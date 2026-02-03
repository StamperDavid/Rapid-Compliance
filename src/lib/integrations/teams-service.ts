/**
 * Microsoft Teams Integration
 * Uses Microsoft Graph API
 */

import { Client } from '@microsoft/microsoft-graph-client';

/**
 * Error thrown when Teams API operations fail
 */
export class TeamsApiError extends Error {
  constructor(
    message: string,
    public readonly statusCode?: number,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = 'TeamsApiError';
    Object.setPrototypeOf(this, TeamsApiError.prototype);
  }
}

/**
 * Creates a configured Microsoft Graph client
 */
function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

/**
 * Validates that a response has the expected structure
 */
function isValidGraphResponse<T>(response: unknown): response is T {
  return response !== null && typeof response === 'object';
}

/**
 * Message body structure
 */
interface TeamsMessageBody {
  content: string;
  contentType?: 'text' | 'html';
}

/**
 * Response from posting a Teams message
 */
export interface TeamsMessageResponse {
  id: string;
  createdDateTime: string;
  body: TeamsMessageBody;
  from?: {
    user?: {
      id?: string;
      displayName?: string;
    };
  };
}

/**
 * Options for sending a Teams message
 */
export interface SendTeamsMessageOptions {
  teamId: string;
  channelId: string;
  message: string;
  contentType?: 'text' | 'html';
}

/**
 * Sends a message to a Teams channel
 */
export async function sendTeamsMessage(
  accessToken: string,
  options: SendTeamsMessageOptions
): Promise<TeamsMessageResponse> {
  try {
    const client = createGraphClient(accessToken);

    const response: unknown = await client
      .api(`/teams/${options.teamId}/channels/${options.channelId}/messages`)
      .post({
        body: {
          content: options.message,
          contentType: options.contentType ?? 'text',
        },
      });

    if (!isValidGraphResponse<TeamsMessageResponse>(response)) {
      throw new TeamsApiError('Invalid response format from Teams API');
    }

    return response;
  } catch (error) {
    if (error instanceof TeamsApiError) {
      throw error;
    }
    throw new TeamsApiError(
      'Failed to send Teams message',
      undefined,
      error
    );
  }
}

/**
 * Teams team structure
 */
export interface TeamsTeam {
  id: string;
  displayName: string;
  description?: string;
  webUrl?: string;
  isArchived?: boolean;
}

/**
 * Response from listing teams
 */
interface TeamsListResponse {
  value: TeamsTeam[];
  '@odata.nextLink'?: string;
}

/**
 * Lists all teams the user is a member of
 */
export async function listTeams(accessToken: string): Promise<TeamsTeam[]> {
  try {
    const client = createGraphClient(accessToken);
    const response: unknown = await client.api('/me/joinedTeams').get();

    if (!isValidGraphResponse<TeamsListResponse>(response)) {
      throw new TeamsApiError('Invalid response format from Teams API');
    }

    return response.value ?? [];
  } catch (error) {
    if (error instanceof TeamsApiError) {
      throw error;
    }
    throw new TeamsApiError(
      'Failed to list Teams',
      undefined,
      error
    );
  }
}

/**
 * Teams channel structure
 */
export interface TeamsChannel {
  id: string;
  displayName: string;
  description?: string;
  webUrl?: string;
  membershipType?: 'standard' | 'private' | 'shared';
}

/**
 * Response from listing channels
 */
interface TeamsChannelsResponse {
  value: TeamsChannel[];
  '@odata.nextLink'?: string;
}

/**
 * Lists all channels in a team
 */
export async function listChannels(
  accessToken: string,
  teamId: string
): Promise<TeamsChannel[]> {
  try {
    const client = createGraphClient(accessToken);
    const response: unknown = await client.api(`/teams/${teamId}/channels`).get();

    if (!isValidGraphResponse<TeamsChannelsResponse>(response)) {
      throw new TeamsApiError('Invalid response format from Teams API');
    }

    return response.value ?? [];
  } catch (error) {
    if (error instanceof TeamsApiError) {
      throw error;
    }
    throw new TeamsApiError(
      'Failed to list channels',
      undefined,
      error
    );
  }
}

/**
 * Response from creating a channel
 */
export interface TeamsChannelCreateResponse {
  id: string;
  displayName: string;
  description?: string;
  webUrl?: string;
}

/**
 * Creates a new channel in a team
 */
export async function createChannel(
  accessToken: string,
  teamId: string,
  channelName: string,
  description?: string
): Promise<TeamsChannelCreateResponse> {
  try {
    const client = createGraphClient(accessToken);

    const response: unknown = await client.api(`/teams/${teamId}/channels`).post({
      displayName: channelName,
      description: description ?? 'Channel created by Rapid Compliance',
    });

    if (!isValidGraphResponse<TeamsChannelCreateResponse>(response)) {
      throw new TeamsApiError('Invalid response format from Teams API');
    }

    return response;
  } catch (error) {
    if (error instanceof TeamsApiError) {
      throw error;
    }
    throw new TeamsApiError(
      'Failed to create channel',
      undefined,
      error
    );
  }
}

/**
 * Teams member structure
 */
export interface TeamsMember {
  id: string;
  displayName: string;
  email?: string;
  roles?: string[];
  userId?: string;
}

/**
 * Response from listing team members
 */
interface TeamsMembersResponse {
  value: TeamsMember[];
  '@odata.nextLink'?: string;
}

/**
 * Lists all members of a team
 */
export async function listTeamMembers(
  accessToken: string,
  teamId: string
): Promise<TeamsMember[]> {
  try {
    const client = createGraphClient(accessToken);
    const response: unknown = await client.api(`/teams/${teamId}/members`).get();

    if (!isValidGraphResponse<TeamsMembersResponse>(response)) {
      throw new TeamsApiError('Invalid response format from Teams API');
    }

    return response.value ?? [];
  } catch (error) {
    if (error instanceof TeamsApiError) {
      throw error;
    }
    throw new TeamsApiError(
      'Failed to list team members',
      undefined,
      error
    );
  }
}

/**
 * Meeting participant identity
 */
interface TeamsMeetingParticipantIdentity {
  identity: {
    user: {
      id: string;
    };
  };
}

/**
 * Meeting participants structure
 */
interface TeamsMeetingParticipants {
  attendees: TeamsMeetingParticipantIdentity[];
}

/**
 * Response from scheduling a Teams meeting
 */
export interface TeamsMeetingResponse {
  id: string;
  joinUrl: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
  participants?: TeamsMeetingParticipants;
}

/**
 * Options for scheduling a Teams meeting
 */
export interface ScheduleTeamsMeetingOptions {
  subject: string;
  startTime: string;
  endTime: string;
  attendees: string[];
}

/**
 * Schedules a new Teams meeting
 */
export async function scheduleTeamsMeeting(
  accessToken: string,
  meeting: ScheduleTeamsMeetingOptions
): Promise<TeamsMeetingResponse> {
  try {
    const client = createGraphClient(accessToken);

    const response: unknown = await client.api('/me/onlineMeetings').post({
      subject: meeting.subject,
      startDateTime: meeting.startTime,
      endDateTime: meeting.endTime,
      participants: {
        attendees: meeting.attendees.map((email): TeamsMeetingParticipantIdentity => ({
          identity: {
            user: {
              id: email,
            },
          },
        })),
      },
    });

    if (!isValidGraphResponse<TeamsMeetingResponse>(response)) {
      throw new TeamsApiError('Invalid response format from Teams API');
    }

    return response;
  } catch (error) {
    if (error instanceof TeamsApiError) {
      throw error;
    }
    throw new TeamsApiError(
      'Failed to schedule Teams meeting',
      undefined,
      error
    );
  }
}






















