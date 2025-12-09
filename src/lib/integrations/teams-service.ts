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

export async function sendTeamsMessage(accessToken: string, options: {
  teamId: string;
  channelId: string;
  message: string;
}): Promise<any> {
  const client = createGraphClient(accessToken);
  
  return await client
    .api(`/teams/${options.teamId}/channels/${options.channelId}/messages`)
    .post({
      body: {
        content: options.message,
      },
    });
}

export async function listTeams(accessToken: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  const response = await client.api('/me/joinedTeams').get();
  return response.value;
}

export async function listChannels(accessToken: string, teamId: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  const response = await client.api(`/teams/${teamId}/channels`).get();
  return response.value;
}

export async function createChannel(accessToken: string, teamId: string, channelName: string): Promise<any> {
  const client = createGraphClient(accessToken);
  
  return await client.api(`/teams/${teamId}/channels`).post({
    displayName: channelName,
    description: `Channel created by AI Sales Platform`,
  });
}

export async function listTeamMembers(accessToken: string, teamId: string): Promise<any[]> {
  const client = createGraphClient(accessToken);
  const response = await client.api(`/teams/${teamId}/members`).get();
  return response.value;
}

export async function scheduleTeamsMeeting(accessToken: string, meeting: {
  subject: string;
  startTime: string;
  endTime: string;
  attendees: string[];
}): Promise<any> {
  const client = createGraphClient(accessToken);
  
  return await client.api('/me/onlineMeetings').post({
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
  });
}










