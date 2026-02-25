/**
 * Slack Integration
 * Complete implementation using Slack Web API
 */

import { WebClient } from '@slack/web-api';
import { logger } from '@/lib/logger/logger';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

const SLACK_REDIRECT_URI = process.env.SLACK_REDIRECT_URI ?? 'http://localhost:3000/api/integrations/slack/callback';

interface SlackCredentials {
  clientId: string;
  clientSecret: string;
  signingSecret?: string;
}

/**
 * Get Slack OAuth credentials from Firestore API keys
 */
async function getSlackCredentials(): Promise<SlackCredentials | null> {
  const slackConfig = await apiKeyService.getServiceKey(PLATFORM_ID, 'slack');
  if (slackConfig && typeof slackConfig === 'object' && 'clientId' in slackConfig) {
    const config = slackConfig;
    return {
      clientId: config.clientId as string,
      clientSecret: config.clientSecret as string,
      signingSecret: config.signingSecret as string | undefined,
    };
  }
  // Fallback to env vars
  if (process.env.SLACK_CLIENT_ID) {
    return {
      clientId: process.env.SLACK_CLIENT_ID,
      clientSecret: process.env.SLACK_CLIENT_SECRET ?? '',
    };
  }
  return null;
}

/**
 * Get Slack OAuth URL
 */
export async function getSlackAuthUrl(): Promise<string> {
  const creds = await getSlackCredentials();
  const clientId = creds?.clientId ?? '';

  const scopes = [
    'channels:read',
    'channels:write',
    'chat:write',
    'users:read',
    'users:read.email',
  ].join(',');

  return `https://slack.com/oauth/v2/authorize?client_id=${clientId}&scope=${scopes}&redirect_uri=${encodeURIComponent(SLACK_REDIRECT_URI)}`;
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
  const creds = await getSlackCredentials();

  const response = await fetch('https://slack.com/api/oauth.v2.access', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: creds?.clientId ?? '',
      client_secret: creds?.clientSecret ?? '',
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
 */
export async function sendSlackMessage(params: {
  channelId: string;
  message: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  try {
    const { FirestoreService } = await import('@/lib/db/firestore-service');
    const { getIntegrationsCollection } = await import('@/lib/firebase/collections');

    // Look up the org's Slack integration credentials
    const integration = await FirestoreService.get(
      getIntegrationsCollection(),
      'slack'
    );

    if (!integration || typeof integration !== 'object') {
      logger.warn('Slack integration not configured for organization', {
        file: 'slack-service.ts',
      });
      return;
    }

    const integrationData = integration as Record<string, unknown>;
    const accessToken = integrationData.accessToken;

    if (typeof accessToken !== 'string' || !accessToken) {
      logger.warn('Slack access token not found for organization', {
        file: 'slack-service.ts',
      });
      return;
    }

    // Call the real sendMessage function
    await sendMessage(accessToken, {
      channel: params.channelId,
      text: params.message,
    });

    logger.info('Slack message sent', {
      channelId: params.channelId,
      file: 'slack-service.ts',
    });
  } catch (error) {
    logger.error('Failed to send Slack message',
      error instanceof Error ? error : new Error(String(error)),
      { channelId: params.channelId, file: 'slack-service.ts' }
    );
  }
}
