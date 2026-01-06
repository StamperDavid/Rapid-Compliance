/**
 * Slack Integration
 * Complete implementation using Slack Web API
 */

import { WebClient } from '@slack/web-api';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI || 'http://localhost:3000/api/integrations/slack/callback';

/**
 * Get Slack OAuth URL
 */
export function getSlackAuthUrl(): string {
  const scopes = [
    'channels:read',
    'channels:write',
    'chat:write',
    'users:read',
    'users:read.email',
  ].join(',');

  return `https://slack.com/oauth/v2/authorize?client_id=${SLACK_CLIENT_ID}&scope=${scopes}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}`;
}

/**
 * Exchange code for access token
 */
export async function getTokensFromCode(code: string): Promise<{
  access_token: string;
  team_id: string;
  team_name: string;
}> {
  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: SLACK_CLIENT_ID!,
      client_secret: SLACK_CLIENT_SECRET!,
      code,
      redirect_uri: SLACK_REDIRECT_URI,
    }),
  });

  return response.json();
}

/**
 * Create Slack client
 */
function createSlackClient(accessToken: string): WebClient {
  return new WebClient(accessToken);
}

/**
 * Send message to channel
 */
export async function sendMessage(accessToken: string, options: {
  channel: string;
  text: string;
  attachments?: any[];
  blocks?: any[];
}): Promise<any> {
  const client = createSlackClient(accessToken);
  
  return client.chat.postMessage({
    channel: options.channel,
    text: options.text,
    attachments: options.attachments,
    blocks: options.blocks,
  });
}

/**
 * List channels
 */
export async function listChannels(accessToken: string): Promise<any[]> {
  const client = createSlackClient(accessToken);
  const result = await client.conversations.list({
    types: 'public_channel,private_channel',
  });
  
  return result.channels || [];
}

/**
 * Create channel
 */
export async function createChannel(accessToken: string, name: string, isPrivate: boolean = false): Promise<any> {
  const client = createSlackClient(accessToken);
  
  return client.conversations.create({
    name,
    is_private: isPrivate,
  });
}

/**
 * List users
 */
export async function listUsers(accessToken: string): Promise<any[]> {
  const client = createSlackClient(accessToken);
  const result = await client.users.list({});
  
  return result.members || [];
}

/**
 * Send direct message
 */
export async function sendDirectMessage(accessToken: string, userId: string, text: string): Promise<any> {
  const client = createSlackClient(accessToken);
  
  // Open DM channel
  const dm = await client.conversations.open({
    users: userId,
  });
  
  // Send message
  return client.chat.postMessage({
    channel: dm.channel!.id!,
    text,
  });
}

/**
 * Upload file
 */
export async function uploadFile(accessToken: string, options: {
  channels: string;
  content: string;
  filename: string;
  title?: string;
}): Promise<any> {
  const client = createSlackClient(accessToken);
  
  return client.files.upload({
    channels: options.channels,
    content: options.content,
    filename: options.filename,
    title: options.title,
  });
}

/**
 * Get user info
 */
export async function getUserInfo(accessToken: string, userId: string): Promise<any> {
  const client = createSlackClient(accessToken);
  const result = await client.users.info({
    user: userId,
  });
  
  return result.user;
}

/**
 * Set channel topic
 */
export async function setChannelTopic(accessToken: string, channel: string, topic: string): Promise<any> {
  const client = createSlackClient(accessToken);
  
  return client.conversations.setTopic({
    channel,
    topic,
  });
}
