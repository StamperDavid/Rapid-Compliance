/**
 * Slack Integration
 * Complete implementation using Slack Web API
 */

import { WebClient } from '@slack/web-api';

const SLACK_CLIENT_ID = process.env.SLACK_CLIENT_ID;
const SLACK_CLIENT_SECRET = process.env.SLACK_CLIENT_SECRET;
const slackRedirectUriEnv = process.env.SLACK_REDIRECT_URI;
const SLACK_REDIRECT_URI = (slackRedirectUriEnv !== '' && slackRedirectUriEnv != null) ? slackRedirectUriEnv : 'http://localhost:3000/api/integrations/slack/callback';

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

interface SlackTokenResponse {
  access_token: string;
  team_id: string;
  team_name: string;
  ok?: boolean;
  error?: string;
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
      client_id: SLACK_CLIENT_ID ?? '',
      client_secret: SLACK_CLIENT_SECRET ?? '',
      code,
      redirect_uri: SLACK_REDIRECT_URI,
    }),
  });

  const data = await response.json() as SlackTokenResponse;
  return {
    access_token: data.access_token,
    team_id: data.team_id,
    team_name: data.team_name,
  };
}

/**
 * Create Slack client
 */
function createSlackClient(accessToken: string): WebClient {
  return new WebClient(accessToken);
}

export interface SlackAttachment {
  fallback?: string;
  color?: string;
  pretext?: string;
  author_name?: string;
  title?: string;
  text?: string;
  fields?: Array<{
    title: string;
    value: string;
    short?: boolean;
  }>;
}

export interface SlackBlock {
  type: string;
  text?: {
    type: string;
    text: string;
  };
  [key: string]: unknown;
}

interface SlackMessageResponse {
  ok?: boolean;
  channel?: string;
  ts?: string;
  message?: {
    text?: string;
    user?: string;
  };
}

/**
 * Send message to channel
 */
export async function sendMessage(accessToken: string, options: {
  channel: string;
  text: string;
  attachments?: SlackAttachment[];
  blocks?: SlackBlock[];
}): Promise<SlackMessageResponse> {
  const client = createSlackClient(accessToken);
  
  return client.chat.postMessage({
    channel: options.channel,
    text: options.text,
    attachments: options.attachments,
    blocks: options.blocks,
  });
}

interface SlackChannel {
  id?: string;
  name?: string;
  is_channel?: boolean;
  is_private?: boolean;
  is_member?: boolean;
}

/**
 * List channels
 */
export async function listChannels(accessToken: string): Promise<SlackChannel[]> {
  const client = createSlackClient(accessToken);
  const result = await client.conversations.list({
    types: 'public_channel,private_channel',
  });
  
  return result.channels ?? [];
}

interface SlackChannelCreateResponse {
  ok?: boolean;
  channel?: SlackChannel;
}

/**
 * Create channel
 */
export async function createChannel(accessToken: string, name: string, isPrivate: boolean = false): Promise<SlackChannelCreateResponse> {
  const client = createSlackClient(accessToken);
  
  return client.conversations.create({
    name,
    is_private: isPrivate,
  });
}

interface SlackUser {
  id?: string;
  name?: string;
  real_name?: string;
  profile?: {
    email?: string;
    image_72?: string;
  };
}

/**
 * List users
 */
export async function listUsers(accessToken: string): Promise<SlackUser[]> {
  const client = createSlackClient(accessToken);
  const result = await client.users.list({});
  
  return result.members ?? [];
}

interface SlackConversationOpenResponse {
  ok?: boolean;
  channel?: {
    id?: string;
  };
}

/**
 * Send direct message
 */
export async function sendDirectMessage(accessToken: string, userId: string, text: string): Promise<SlackMessageResponse> {
  const client = createSlackClient(accessToken);
  
  // Open DM channel
  const dm = await client.conversations.open({
    users: userId,
  }) as SlackConversationOpenResponse;

  // Send message
  return client.chat.postMessage({
    channel: dm.channel?.id ?? '',
    text,
  }) as Promise<SlackMessageResponse>;
}

interface SlackFileUploadResponse {
  ok?: boolean;
  file?: {
    id?: string;
    name?: string;
    url_private?: string;
  };
}

/**
 * Upload file
 */
export async function uploadFile(accessToken: string, options: {
  channels: string;
  content: string;
  filename: string;
  title?: string;
}): Promise<SlackFileUploadResponse> {
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
export async function getUserInfo(accessToken: string, userId: string): Promise<SlackUser> {
  const client = createSlackClient(accessToken);
  const result = await client.users.info({
    user: userId,
  });

  return (result.user ?? {}) as SlackUser;
}

interface SlackTopicResponse {
  ok?: boolean;
  channel?: string;
  topic?: string;
}

/**
 * Set channel topic
 */
export async function setChannelTopic(accessToken: string, channel: string, topic: string): Promise<SlackTopicResponse> {
  const client = createSlackClient(accessToken);
  const result = await client.conversations.setTopic({
    channel,
    topic,
  });

  return result as SlackTopicResponse;
}

/**
 * Send Slack message using stored org credentials
 * Convenience wrapper for form triggers and workflows
 *
 * TODO: Implement org credential lookup from integrations collection
 */
export function sendSlackMessage(params: {
  orgId: string;
  channelId: string;
  message: string;
  metadata?: Record<string, unknown>;
}): void {
  // TODO: Look up Slack access token from org's integrations
  // For now, this is a stub that logs the message
  // eslint-disable-next-line no-console
  console.log('[Slack] sendSlackMessage called:', {
    orgId: params.orgId,
    channelId: params.channelId,
    messageLength: params.message.length,
    hasMetadata: !!params.metadata,
  });

  // When implemented, this would:
  // 1. Look up the org's Slack integration credentials from Firestore
  // 2. Call sendMessage(accessToken, { channel: params.channelId, text: params.message })
}
