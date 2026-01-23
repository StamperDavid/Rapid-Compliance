/**
 * Microsoft Teams Integration
 * Uses Microsoft Graph API
 */

import { Client } from '@microsoft/microsoft-graph-client';

function createGraphClient(accessToken: string): Client {
  return Client.init({
    authProvider: (done) => {
      done(null, accessToken);
    },
  });
}

interface TeamsMessageResponse {
  id: string;
  createdDateTime: string;
  body: {
    content: string;
  };
}

export async function sendTeamsMessage(accessToken: string, options: {
  teamId: string;
  channelId: string;
  message: string;
}): Promise<TeamsMessageResponse> {
  const client = createGraphClient(accessToken);

  return client
    .api(`/teams/${options.teamId}/channels/${options.channelId}/messages`)
    .post({
      body: {
        content: options.message,
      },
    }) as Promise<TeamsMessageResponse>;
}

interface TeamsTeam {
  id: string;
  displayName: string;
  description?: string;
}

interface TeamsListResponse {
  value: TeamsTeam[];
}

export async function listTeams(accessToken: string): Promise<TeamsTeam[]> {
  const client = createGraphClient(accessToken);
  const response = await client.api('/me/joinedTeams').get() as TeamsListResponse;
  return response.value;
}

interface TeamsChannel {
  id: string;
  displayName: string;
  description?: string;
}

interface TeamsChannelsResponse {
  value: TeamsChannel[];
}

export async function listChannels(accessToken: string, teamId: string): Promise<TeamsChannel[]> {
  const client = createGraphClient(accessToken);
  const response = await client.api(`/teams/${teamId}/channels`).get() as TeamsChannelsResponse;
  return response.value;
}

interface TeamsChannelCreateResponse {
  id: string;
  displayName: string;
}

export async function createChannel(accessToken: string, teamId: string, channelName: string): Promise<TeamsChannelCreateResponse> {
  const client = createGraphClient(accessToken);

  return client.api(`/teams/${teamId}/channels`).post({
    displayName: channelName,
    description: `Channel created by AI Sales Platform`,
  }) as Promise<TeamsChannelCreateResponse>;
}

interface TeamsMember {
  id: string;
  displayName: string;
  email?: string;
  roles?: string[];
}

interface TeamsMembersResponse {
  value: TeamsMember[];
}

export async function listTeamMembers(accessToken: string, teamId: string): Promise<TeamsMember[]> {
  const client = createGraphClient(accessToken);
  const response = await client.api(`/teams/${teamId}/members`).get() as TeamsMembersResponse;
  return response.value;
}

interface TeamsMeetingResponse {
  id: string;
  joinUrl: string;
  subject: string;
  startDateTime: string;
  endDateTime: string;
}

export async function scheduleTeamsMeeting(accessToken: string, meeting: {
  subject: string;
  startTime: string;
  endTime: string;
  attendees: string[];
}): Promise<TeamsMeetingResponse> {
  const client = createGraphClient(accessToken);

  return client.api('/me/onlineMeetings').post({
    subject: meeting.subject,
    startDateTime: meeting.startTime,
    endDateTime: meeting.endTime,
    participants: {
      attendees: meeting.attendees.map(email => ({
        identity: {
          user: {
            id: email,
          },
        },
      })),
    },
  }) as Promise<TeamsMeetingResponse>;
}






















