/**
 * Slack Service
 * 
 * Production-ready Slack API client with comprehensive error handling,
 * retry logic, and rate limiting.
 * 
 * Features:
 * - OAuth 2.0 authentication
 * - Message sending with rich formatting
 * - Channel and user management
 * - Rate limiting and retry logic
 * - Error handling and logging
 * - Webhook signature verification
 */

import { logger } from '@/lib/logger/logger';
import { Timestamp } from 'firebase-admin/firestore';
import crypto from 'crypto';
import type {
  SlackMessage,
  SlackWorkspace,
  SlackBlock,
  SlackAttachment,
  SlackAPIError,
  SlackRateLimitInfo,
  SlackServiceConfig,
  SlackChannelType,
} from './types';

/**
 * Slack API Response
 */
interface SlackAPIResponse {
  ok: boolean;
  error?: string;
  response_metadata?: {
    next_cursor?: string;
  };
  [key: string]: unknown;
}

/**
 * Slack Message Response
 */
interface SlackMessageResponse extends SlackAPIResponse {
  channel: string;
  ts: string;
  message?: {
    text: string;
    username?: string;
    bot_id?: string;
    type: string;
    ts: string;
  };
}

/**
 * Slack OAuth Response
 */
interface SlackOAuthResponse extends SlackAPIResponse {
  access_token: string;
  token_type: string;
  scope: string;
  bot_user_id?: string;
  app_id: string;
  team: {
    id: string;
    name: string;
  };
  enterprise?: {
    id: string;
    name: string;
  };
  authed_user?: {
    id: string;
    scope?: string;
    access_token?: string;
    token_type?: string;
  };
  incoming_webhook?: {
    channel: string;
    channel_id: string;
    configuration_url: string;
    url: string;
  };
}

/**
 * Slack Channel Data
 */
interface SlackChannelData {
  id: string;
  name: string;
  is_channel: boolean;
  is_group: boolean;
  is_im: boolean;
  is_mpim: boolean;
  is_private: boolean;
  created: number;
  is_archived: boolean;
  is_general: boolean;
  is_member: boolean;
  num_members?: number;
  topic?: {
    value: string;
    creator: string;
    last_set: number;
  };
  purpose?: {
    value: string;
    creator: string;
    last_set: number;
  };
}

/**
 * Slack Channels List Response
 */
interface SlackChannelsResponse extends SlackAPIResponse {
  channels: SlackChannelData[];
}

/**
 * Slack User Data
 */
interface SlackUserData {
  id: string;
  team_id: string;
  name: string;
  deleted: boolean;
  profile: {
    email?: string;
    display_name?: string;
    real_name?: string;
    image_24?: string;
  };
  is_bot: boolean;
  is_app_user: boolean;
}

/**
 * Slack Users List Response
 */
interface SlackUsersResponse extends SlackAPIResponse {
  members: SlackUserData[];
}

/**
 * Slack Auth Test Response
 */
interface SlackAuthTestResponse extends SlackAPIResponse {
  url: string;
  team: string;
  user: string;
  team_id: string;
  user_id: string;
  bot_id?: string;
}

/**
 * Slack Service
 * 
 * Main service class for Slack API interactions
 */
export class SlackService {
  private config: SlackServiceConfig;
  private rateLimitCache: Map<string, SlackRateLimitInfo> = new Map();
  
  constructor(config: SlackServiceConfig) {
    this.config = config;
    
    logger.info('SlackService initialized', {
      scopes: config.scopes,
      rateLimit: config.rateLimit,
    });
  }
  
  // ============================================================================
  // OAUTH METHODS
  // ============================================================================
  
  /**
   * Get OAuth authorization URL
   */
  getAuthorizationUrl(state: string, redirectUri: string): string {
    const params = new URLSearchParams({
      client_id: this.config.clientId,
      scope: this.config.scopes.join(','),
      redirect_uri: redirectUri,
      state,
    });
    
    return `https://slack.com/oauth/v2/authorize?${params.toString()}`;
  }
  
  /**
   * Exchange OAuth code for access token
   */
  async exchangeOAuthCode(
    code: string,
    redirectUri: string
  ): Promise<SlackOAuthResponse> {
    try {
      logger.info('Exchanging OAuth code for access token');
      
      const response = await fetch('https://slack.com/api/oauth.v2.access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          client_id: this.config.clientId,
          client_secret: this.config.clientSecret,
          code,
          redirect_uri: redirectUri,
        }).toString(),
      });
      
      const data = await response.json() as SlackOAuthResponse;
      
      if (!data.ok) {
        throw this.createAPIError(data, 'OAuth token exchange failed', response.status);
      }
      
      logger.info('OAuth token exchange successful', {
        teamId: data.team.id,
        teamName: data.team.name,
        botUserId: data.bot_user_id,
      });
      
      return data;
      
    } catch (error) {
      logger.error('OAuth token exchange failed', { error });
      throw error;
    }
  }
  
  /**
   * Revoke OAuth token
   */
  async revokeToken(token: string): Promise<void> {
    try {
      logger.info('Revoking OAuth token');
      
      const response = await fetch('https://slack.com/api/auth.revoke', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
      });
      
      const data = await response.json() as SlackAPIResponse;
      
      if (!data.ok && data.error !== 'token_revoked') {
        throw this.createAPIError(data, 'Token revocation failed', response.status);
      }
      
      logger.info('OAuth token revoked successfully');
      
    } catch (error) {
      logger.error('Token revocation failed', { error });
      throw error;
    }
  }
  
  /**
   * Test authentication
   */
  async testAuth(token: string): Promise<SlackAuthTestResponse> {
    try {
      const response = await this.makeAPICall<SlackAuthTestResponse>(
        'auth.test',
        {},
        token
      );
      
      return response;
      
    } catch (error) {
      logger.error('Auth test failed', { error });
      throw error;
    }
  }
  
  // ============================================================================
  // MESSAGE METHODS
  // ============================================================================
  
  /**
   * Send message to Slack
   * 
   * Supports text, blocks, attachments, and threading
   */
  async sendMessage(
    workspace: SlackWorkspace,
    message: Partial<SlackMessage>
  ): Promise<{ ts: string; channel: string; permalink: string }> {
    try {
      // Check rate limit
      this.checkRateLimit(workspace.id);

      // Build message payload
      const payload: Record<string, unknown> = {
        channel: message.channelId,
        text: message.text,
      };
      
      // Add blocks if present
      if (message.blocks && message.blocks.length > 0) {
        payload.blocks = message.blocks;
      }
      
      // Add attachments if present
      if (message.attachments && message.attachments.length > 0) {
        payload.attachments = message.attachments;
      }
      
      // Add thread_ts if replying to thread
      if (message.threadTs) {
        payload.thread_ts = message.threadTs;
      }
      
      // Add mentions
      if (message.mentions) {
        // Add @channel or @here to text if specified
        if (message.mentions.channel && workspace.settings.mentions?.allowChannelMentions) {
          payload.text = `<!channel> ${payload.text}`;
        } else if (message.mentions.here && workspace.settings.mentions?.allowHereMentions) {
          payload.text = `<!here> ${payload.text}`;
        }
        
        // Add user mentions
        if (message.mentions.users && message.mentions.users.length > 0) {
          const userMentions = message.mentions.users.map(id => `<@${id}>`).join(' ');
          payload.text = `${userMentions} ${payload.text}`;
        }
      }
      
      // Send message with retry logic
      const response = await this.makeAPICallWithRetry<SlackMessageResponse>(
        'chat.postMessage',
        payload,
        workspace.botToken
      );
      
      // Track rate limit
      this.trackRateLimit(workspace.id);
      
      // Get permalink
      const permalink = await this.getPermalink(
        workspace.botToken,
        response.channel,
        response.ts
      );
      
      logger.info('Slack message sent successfully', {
        workspaceId: workspace.id,
        channelId: message.channelId,
        ts: response.ts,
        category: message.category,
      });
      
      return {
        ts: response.ts,
        channel: response.channel,
        permalink,
      };
      
    } catch (error) {
      logger.error('Failed to send Slack message', {
        error,
        workspaceId: workspace.id,
        channelId: message.channelId,
        category: message.category,
      });
      throw error;
    }
  }
  
  /**
   * Update existing message
   */
  async updateMessage(
    token: string,
    channelId: string,
    ts: string,
    options: {
      text?: string;
      blocks?: SlackBlock[];
      attachments?: SlackAttachment[];
    }
  ): Promise<void> {
    try {
      const payload: Record<string, unknown> = {
        channel: channelId,
        ts,
      };
      
      if (options.text) {
        payload.text = options.text;
      }
      
      if (options.blocks) {
        payload.blocks = options.blocks;
      }
      
      if (options.attachments) {
        payload.attachments = options.attachments;
      }
      
      await this.makeAPICallWithRetry(
        'chat.update',
        payload,
        token
      );
      
      logger.info('Slack message updated successfully', {
        channelId,
        ts,
      });
      
    } catch (error) {
      logger.error('Failed to update Slack message', {
        error,
        channelId,
        ts,
      });
      throw error;
    }
  }
  
  /**
   * Delete message
   */
  async deleteMessage(
    token: string,
    channelId: string,
    ts: string
  ): Promise<void> {
    try {
      await this.makeAPICallWithRetry(
        'chat.delete',
        {
          channel: channelId,
          ts,
        },
        token
      );
      
      logger.info('Slack message deleted successfully', {
        channelId,
        ts,
      });
      
    } catch (error) {
      logger.error('Failed to delete Slack message', {
        error,
        channelId,
        ts,
      });
      throw error;
    }
  }
  
  /**
   * Get message permalink
   */
  async getPermalink(
    token: string,
    channelId: string,
    messageTs: string
  ): Promise<string> {
    try {
      const response = await this.makeAPICall<SlackAPIResponse & { permalink: string }>(
        'chat.getPermalink',
        {
          channel: channelId,
          message_ts: messageTs,
        },
        token
      );
      
      return response.permalink;
      
    } catch (error) {
      logger.error('Failed to get message permalink', {
        error,
        channelId,
        messageTs,
      });
      // Return empty string on error (non-critical)
      return '';
    }
  }
  
  // ============================================================================
  // CHANNEL METHODS
  // ============================================================================
  
  /**
   * List channels
   */
  async listChannels(
    token: string,
    options: {
      types?: SlackChannelType[];
      excludeArchived?: boolean;
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<{
    channels: Array<{
      id: string;
      name: string;
      type: SlackChannelType;
      isArchived: boolean;
      isMember: boolean;
      topic?: string;
      purpose?: string;
      memberCount?: number;
      created?: number;
    }>;
    nextCursor?: string;
  }> {
    try {
      const params: Record<string, unknown> = {
        limit: options.limit ?? 100,
        exclude_archived: options.excludeArchived !== false,
      };
      
      if (options.cursor) {
        params.cursor = options.cursor;
      }
      
      // Determine which API method to use based on types
      const types =options.types ?? ['public_channel', 'private_channel'];
      
      if (types.includes('im') || types.includes('mpim')) {
        params.types = types.join(',');
      } else {
        params.types = types.includes('private_channel') 
          ? 'public_channel,private_channel'
          : 'public_channel';
      }
      
      const response = await this.makeAPICall<SlackChannelsResponse>(
        'conversations.list',
        params,
        token
      );
      
      const channels = response.channels.map(channel => {
        let type: SlackChannelType = 'public_channel';
        
        if (channel.is_im) {
          type = 'im';
        } else if (channel.is_mpim) {
          type = 'mpim';
        } else if (channel.is_private) {
          type = 'private_channel';
        } else if (channel.is_group) {
          type = 'group';
        }
        
        return {
          id: channel.id,
          name: channel.name,
          type,
          isArchived: channel.is_archived,
          isMember: channel.is_member,
          topic: channel.topic?.value,
          purpose: channel.purpose?.value,
          memberCount: channel.num_members,
          created: channel.created,
        };
      });
      
      return {
        channels,
        nextCursor: response.response_metadata?.next_cursor,
      };
      
    } catch (error) {
      logger.error('Failed to list Slack channels', { error });
      throw error;
    }
  }
  
  /**
   * Get channel info
   */
  async getChannel(
    token: string,
    channelId: string
  ): Promise<{
    id: string;
    name: string;
    type: SlackChannelType;
    isArchived: boolean;
    isMember: boolean;
    topic?: string;
    purpose?: string;
    memberCount?: number;
  }> {
    try {
      const response = await this.makeAPICall<SlackAPIResponse & { channel: SlackChannelData }>(
        'conversations.info',
        { channel: channelId },
        token
      );

      const channel = response.channel;
      
      let type: SlackChannelType = 'public_channel';
      
      if (channel.is_im) {
        type = 'im';
      } else if (channel.is_mpim) {
        type = 'mpim';
      } else if (channel.is_private) {
        type = 'private_channel';
      } else if (channel.is_group) {
        type = 'group';
      }
      
      return {
        id: channel.id,
        name: channel.name,
        type,
        isArchived: channel.is_archived,
        isMember: channel.is_member,
        topic: channel.topic?.value,
        purpose: channel.purpose?.value,
        memberCount: channel.num_members,
      };
      
    } catch (error) {
      logger.error('Failed to get Slack channel', {
        error,
        channelId,
      });
      throw error;
    }
  }
  
  /**
   * Join channel
   */
  async joinChannel(token: string, channelId: string): Promise<void> {
    try {
      await this.makeAPICallWithRetry(
        'conversations.join',
        { channel: channelId },
        token
      );
      
      logger.info('Joined Slack channel', { channelId });
      
    } catch (error) {
      logger.error('Failed to join Slack channel', {
        error,
        channelId,
      });
      throw error;
    }
  }
  
  // ============================================================================
  // USER METHODS
  // ============================================================================
  
  /**
   * List users
   */
  async listUsers(
    token: string,
    options: {
      limit?: number;
      cursor?: string;
    } = {}
  ): Promise<{
    users: Array<{
      id: string;
      name: string;
      email?: string;
      displayName?: string;
      realName?: string;
      isBot: boolean;
    }>;
    nextCursor?: string;
  }> {
    try {
      const params: Record<string, unknown> = {
        limit: options.limit ?? 100,
      };
      
      if (options.cursor) {
        params.cursor = options.cursor;
      }
      
      const response = await this.makeAPICall<SlackUsersResponse>(
        'users.list',
        params,
        token
      );
      
      const users = response.members
        .filter(user => !user.deleted)
        .map(user => ({
          id: user.id,
          name: user.name,
          email: user.profile.email,
          displayName: user.profile.display_name,
          realName: user.profile.real_name,
          isBot: user.is_bot || user.is_app_user,
        }));
      
      return {
        users,
        nextCursor: response.response_metadata?.next_cursor,
      };
      
    } catch (error) {
      logger.error('Failed to list Slack users', { error });
      throw error;
    }
  }
  
  /**
   * Get user info
   */
  async getUser(
    token: string,
    userId: string
  ): Promise<{
    id: string;
    name: string;
    email?: string;
    displayName?: string;
    realName?: string;
    isBot: boolean;
  }> {
    try {
      const response = await this.makeAPICall<SlackAPIResponse & { user: SlackUserData }>(
        'users.info',
        { user: userId },
        token
      );

      const user = response.user;
      
      return {
        id: user.id,
        name: user.name,
        email: user.profile.email,
        displayName: user.profile.display_name,
        realName: user.profile.real_name,
        isBot:user.is_bot ?? user.is_app_user,
      };
      
    } catch (error) {
      logger.error('Failed to get Slack user', {
        error,
        userId,
      });
      throw error;
    }
  }
  
  // ============================================================================
  // WEBHOOK METHODS
  // ============================================================================
  
  /**
   * Verify webhook signature
   * 
   * Ensures webhook requests are from Slack
   */
  verifyWebhookSignature(
    timestamp: string,
    signature: string,
    body: string
  ): boolean {
    if (!this.config.verifyWebhooks) {
      return true;
    }
    
    try {
      // Check timestamp is within 5 minutes
      const currentTime = Math.floor(Date.now() / 1000);
      const requestTime = parseInt(timestamp, 10);
      
      if (Math.abs(currentTime - requestTime) > 60 * 5) {
        logger.warn('Webhook timestamp too old', {
          currentTime,
          requestTime,
          diff: currentTime - requestTime,
        });
        return false;
      }
      
      // Verify signature
      const sigBasestring = `v0:${timestamp}:${body}`;
      const mySignature = `v0=${crypto
        .createHmac('sha256', this.config.signingSecret)
        .update(sigBasestring)
        .digest('hex')}`;
      
      const isValid = crypto.timingSafeEqual(
        Buffer.from(mySignature),
        Buffer.from(signature)
      );
      
      if (!isValid) {
        logger.warn('Invalid webhook signature', {
          expected: mySignature,
          received: signature,
        });
      }
      
      return isValid;
      
    } catch (error) {
      logger.error('Webhook signature verification failed', { error });
      return false;
    }
  }
  
  // ============================================================================
  // RATE LIMITING
  // ============================================================================
  
  /**
   * Check if rate limit allows sending
   */
  private checkRateLimit(workspaceId: string): void {
    const limit = this.rateLimitCache.get(workspaceId);

    if (!limit) {
      // Initialize rate limit tracking
      this.rateLimitCache.set(workspaceId, {
        workspaceId,
        messagesThisMinute: 0,
        messagesThisHour: 0,
        maxPerMinute: this.config.rateLimit.maxPerMinute,
        maxPerHour: this.config.rateLimit.maxPerHour,
        minuteResetAt: Timestamp.fromMillis(Date.now() + 60000),
        hourResetAt: Timestamp.fromMillis(Date.now() + 3600000),
        isLimited: false,
      });
      return;
    }

    const now = Date.now();

    // Reset minute counter if window expired
    if (limit.minuteResetAt.toMillis() <= now) {
      limit.messagesThisMinute = 0;
      limit.minuteResetAt = Timestamp.fromMillis(now + 60000);
    }

    // Reset hour counter if window expired
    if (limit.hourResetAt.toMillis() <= now) {
      limit.messagesThisHour = 0;
      limit.hourResetAt = Timestamp.fromMillis(now + 3600000);
    }

    // Check if rate limited
    if (limit.messagesThisMinute >= limit.maxPerMinute) {
      const waitMs = limit.minuteResetAt.toMillis() - now;
      throw new Error(`Rate limited: wait ${Math.ceil(waitMs / 1000)}s before sending`);
    }

    if (limit.messagesThisHour >= limit.maxPerHour) {
      const waitMs = limit.hourResetAt.toMillis() - now;
      throw new Error(`Hourly rate limit exceeded: wait ${Math.ceil(waitMs / 60000)}m before sending`);
    }
  }
  
  /**
   * Track message sent for rate limiting
   */
  private trackRateLimit(workspaceId: string): void {
    const limit = this.rateLimitCache.get(workspaceId);

    if (limit) {
      limit.messagesThisMinute++;
      limit.messagesThisHour++;
      this.rateLimitCache.set(workspaceId, limit);
    }
  }
  
  // ============================================================================
  // HELPER METHODS
  // ============================================================================
  
  /**
   * Make Slack API call
   */
  private async makeAPICall<T extends SlackAPIResponse>(
    method: string,
    params: Record<string, unknown>,
    token: string
  ): Promise<T> {
    const url = `https://slack.com/api/${method}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify(params),
    });
    
    const data = await response.json() as T;
    
    if (!data.ok) {
      throw this.createAPIError(data, `Slack API call failed: ${method}`, response.status);
    }
    
    return data;
  }
  
  /**
   * Make API call with retry logic
   */
  private async makeAPICallWithRetry<T extends SlackAPIResponse>(
    method: string,
    params: Record<string, unknown>,
    token: string,
    attempt = 1
  ): Promise<T> {
    try {
      return await this.makeAPICall<T>(method, params, token);
      
    } catch (error) {
      const slackError = error as SlackAPIError;
      
      // Don't retry if max attempts reached
      if (attempt >= this.config.retry.maxRetries) {
        throw error;
      }
      
      // Don't retry if error is not retryable
      if (!slackError.retryable) {
        throw error;
      }
      
      // Calculate delay with exponential backoff
      const delay = Math.min(
        this.config.retry.initialDelayMs * Math.pow(this.config.retry.backoffMultiplier, attempt - 1),
        this.config.retry.maxDelayMs
      );
      
      // Use retry-after header if provided (for rate limits)
      const retryDelay = slackError.retryAfter 
        ? slackError.retryAfter * 1000
        : delay;
      
      logger.warn('Retrying Slack API call', {
        method,
        attempt,
        delay: retryDelay,
        error: slackError.error,
      });
      
      // Wait before retrying
      await new Promise<void>(resolve => { setTimeout(resolve, retryDelay); });
      
      // Retry
      return this.makeAPICallWithRetry<T>(method, params, token, attempt + 1);
    }
  }
  
  /**
   * Create standardized API error
   */
  private createAPIError(
    response: SlackAPIResponse,
    message: string,
    statusCode: number
  ): SlackAPIError {
    const errorCode =(response.error !== '' && response.error != null) ? response.error : 'unknown_error';
    
    // Determine if error is retryable
    const retryableErrors = [
      'rate_limited',
      'timeout',
      'service_unavailable',
      'internal_error',
    ];
    
    const retryable = retryableErrors.includes(errorCode);
    
    // Extract retry-after from rate limit errors
    let retryAfter: number | undefined;
    
    if (errorCode === 'rate_limited' && typeof response.retry_after === 'number') {
      retryAfter = response.retry_after;
    }
    
    return {
      error: errorCode,
      message,
      statusCode,
      retryable,
      retryAfter,
      response,
    };
  }
}

/**
 * Create Slack service instance
 */
export function createSlackService(): SlackService {
  const config: SlackServiceConfig = {
    clientId: process.env.SLACK_CLIENT_ID ?? '',
    clientSecret: process.env.SLACK_CLIENT_SECRET ?? '',
    signingSecret: process.env.SLACK_SIGNING_SECRET ?? '',
    scopes: [
      'channels:read',
      'channels:join',
      'chat:write',
      'chat:write.public',
      'users:read',
      'users:read.email',
      'team:read',
    ],
    rateLimit: {
      maxPerMinute: 60,
      maxPerHour: 3000,
    },
    retry: {
      maxRetries: 3,
      initialDelayMs: 1000,
      maxDelayMs: 30000,
      backoffMultiplier: 2,
    },
    verifyWebhooks: process.env.NODE_ENV === 'production',
  };
  
  return new SlackService(config);
}

export default SlackService;
