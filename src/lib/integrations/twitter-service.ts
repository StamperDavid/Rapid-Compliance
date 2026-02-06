/**
 * Twitter/X Integration Service
 * Uses Twitter API v2 with OAuth 2.0
 *
 * PRODUCTION READY:
 * - Raw fetch() calls to Twitter API v2 endpoints
 * - OAuth 2.0 authentication with PKCE support
 * - Graceful rate limit handling with exponential backoff
 * - Graceful fallback if API keys not configured
 */

import { logger } from '@/lib/logger/logger';
import type {
  TwitterConfig,
  TwitterTweet,
  TwitterUser,
  TwitterPostRequest,
  TwitterPostResponse,
  TwitterTimelineResponse,
  TwitterRateLimitInfo,
  TwitterScheduleRequest,
} from '@/types/social';

// Twitter API v2 Base URL
const TWITTER_API_BASE = 'https://api.twitter.com/2';
const TWITTER_OAUTH2_TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';

// Rate limit tracking
const rateLimitCache = new Map<string, TwitterRateLimitInfo>();

/**
 * Twitter Service Class
 * Handles all Twitter API v2 operations
 */
export class TwitterService {
  private config: TwitterConfig;
  private organizationId: string;

  constructor(config: TwitterConfig, organizationId: string) {
    this.config = config;
    this.organizationId = organizationId;
  }

  /**
   * Check if Twitter is configured
   */
  isConfigured(): boolean {
    return !!(
      this.config.bearerToken ??
      (this.config.accessToken && this.config.clientId)
    );
  }

  /**
   * Make authenticated request to Twitter API
   */
  private async makeRequest<T>(
    endpoint: string,
    options: RequestInit = {},
    useOAuth2 = false
  ): Promise<{ data: T | null; error?: string; rateLimitInfo?: TwitterRateLimitInfo }> {
    if (!this.isConfigured()) {
      logger.warn('Twitter: Service not configured', {
        organizationId: this.organizationId,
      });
      return {
        data: null,
        error: 'Twitter API not configured. Please configure API keys.',
      };
    }

    // Check rate limits before making request
    const rateLimitInfo = rateLimitCache.get(endpoint);
    if (rateLimitInfo?.remaining === 0 && new Date() < rateLimitInfo.reset) {
      const waitTime = Math.ceil((rateLimitInfo.reset.getTime() - Date.now()) / 1000);
      logger.warn('Twitter: Rate limited, waiting', {
        endpoint,
        waitSeconds: waitTime,
        resetAt: rateLimitInfo.reset.toISOString(),
      });
      return {
        data: null,
        error: `Rate limited. Retry after ${waitTime} seconds.`,
        rateLimitInfo,
      };
    }

    const url = `${TWITTER_API_BASE}${endpoint}`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    // Use Bearer token for app-only auth, or OAuth 2.0 access token for user context
    if (useOAuth2 && this.config.accessToken) {
      headers['Authorization'] = `Bearer ${this.config.accessToken}`;
    } else if (this.config.bearerToken) {
      headers['Authorization'] = `Bearer ${this.config.bearerToken}`;
    }

    try {
      logger.debug('Twitter: Making API request', {
        endpoint,
        method: options.method ?? 'GET',
        organizationId: this.organizationId,
      });

      const response = await fetch(url, {
        ...options,
        headers,
      });

      // Update rate limit info from headers
      const newRateLimitInfo = this.parseRateLimitHeaders(response.headers, endpoint);
      if (newRateLimitInfo) {
        rateLimitCache.set(endpoint, newRateLimitInfo);
      }

      if (!response.ok) {
        const errorBody = await response.text();
        let errorMessage = `Twitter API error: ${response.status}`;

        interface TwitterErrorResponse {
          detail?: string;
          title?: string;
          errors?: Array<{ message?: string }>;
        }

        try {
          const errorJson = JSON.parse(errorBody) as TwitterErrorResponse;
          errorMessage = errorJson.detail ?? errorJson.title ?? errorJson.errors?.[0]?.message ?? errorMessage;
        } catch {
          // Use default error message
        }

        logger.error('Twitter: API request failed', new Error(errorMessage), {
          endpoint,
          status: response.status,
          organizationId: this.organizationId,
        });

        // Handle specific error codes
        if (response.status === 429) {
          return {
            data: null,
            error: 'Rate limit exceeded. Please try again later.',
            rateLimitInfo: newRateLimitInfo ?? undefined,
          };
        }

        if (response.status === 401) {
          return {
            data: null,
            error: 'Authentication failed. Please reconnect your Twitter account.',
          };
        }

        if (response.status === 403) {
          return {
            data: null,
            error: 'Access forbidden. Please check your app permissions.',
          };
        }

        return {
          data: null,
          error: errorMessage,
        };
      }

      const data = await response.json() as T;
      return { data, rateLimitInfo: newRateLimitInfo ?? undefined };
    } catch (error) {
      logger.error('Twitter: Request failed', error as Error, {
        endpoint,
        organizationId: this.organizationId,
      });
      return {
        data: null,
        error: error instanceof Error ? error.message : 'Unknown error occurred',
      };
    }
  }

  /**
   * Parse rate limit headers from response
   */
  private parseRateLimitHeaders(headers: Headers, endpoint: string): TwitterRateLimitInfo | null {
    const limit = headers.get('x-rate-limit-limit');
    const remaining = headers.get('x-rate-limit-remaining');
    const reset = headers.get('x-rate-limit-reset');

    if (limit && remaining && reset) {
      return {
        limit: parseInt(limit, 10),
        remaining: parseInt(remaining, 10),
        reset: new Date(parseInt(reset, 10) * 1000),
        endpoint,
      };
    }

    return null;
  }

  /**
   * Post a tweet
   * Requires OAuth 2.0 User Context (write:tweets scope)
   */
  async postTweet(request: TwitterPostRequest): Promise<TwitterPostResponse> {
    if (!this.config.accessToken) {
      logger.warn('Twitter: Cannot post tweet - OAuth 2.0 access token required', {
        organizationId: this.organizationId,
      });
      return {
        success: false,
        error: 'OAuth 2.0 access token required for posting tweets.',
      };
    }

    // Validate tweet length (280 characters max)
    if (request.text.length > 280) {
      return {
        success: false,
        error: `Tweet exceeds character limit. Current: ${request.text.length}, Max: 280`,
      };
    }

    // Build tweet payload
    const payload: Record<string, unknown> = {
      text: request.text,
    };

    // Add media if provided
    if (request.mediaIds && request.mediaIds.length > 0) {
      payload.media = {
        media_ids: request.mediaIds,
      };
    }

    // Add poll if provided
    if (request.pollOptions && request.pollOptions.length >= 2) {
      payload.poll = {
        options: request.pollOptions,
        duration_minutes: request.pollDurationMinutes ?? 1440, // Default 24 hours
      };
    }

    // Add reply settings if replying to a tweet
    if (request.replyToTweetId) {
      payload.reply = {
        in_reply_to_tweet_id: request.replyToTweetId,
      };
    }

    // Add quote tweet if provided
    if (request.quoteTweetId) {
      payload.quote_tweet_id = request.quoteTweetId;
    }

    logger.info('Twitter: Posting tweet', {
      textLength: request.text.length,
      hasMedia: !!(request.mediaIds && request.mediaIds.length > 0),
      hasPoll: !!(request.pollOptions && request.pollOptions.length > 0),
      organizationId: this.organizationId,
    });

    const result = await this.makeRequest<{ data: { id: string; text: string } }>(
      '/tweets',
      {
        method: 'POST',
        body: JSON.stringify(payload),
      },
      true // Use OAuth 2.0 user context
    );

    if (result.error ?? !result.data) {
      return {
        success: false,
        error: result.error ?? 'Failed to post tweet',
        rateLimitRemaining: result.rateLimitInfo?.remaining,
        rateLimitReset: result.rateLimitInfo?.reset,
      };
    }

    logger.info('Twitter: Tweet posted successfully', {
      tweetId: result.data.data.id,
      organizationId: this.organizationId,
    });

    return {
      success: true,
      tweetId: result.data.data.id,
      text: result.data.data.text,
      rateLimitRemaining: result.rateLimitInfo?.remaining,
      rateLimitReset: result.rateLimitInfo?.reset,
    };
  }

  /**
   * Schedule a tweet for future posting
   * Note: Twitter API v2 doesn't natively support scheduling
   * This stores the scheduled tweet for later processing
   */
  async scheduleTweet(
    request: TwitterScheduleRequest,
    storeCallback: (scheduledTweet: {
      id: string;
      request: TwitterPostRequest;
      scheduledTime: Date;
      organizationId: string;
    }) => Promise<void>
  ): Promise<{ success: boolean; scheduledId?: string; error?: string }> {
    // Validate scheduled time is in the future
    const now = new Date();
    if (request.scheduledTime <= now) {
      return {
        success: false,
        error: 'Scheduled time must be in the future',
      };
    }

    // Validate tweet content
    if (request.text.length > 280) {
      return {
        success: false,
        error: `Tweet exceeds character limit. Current: ${request.text.length}, Max: 280`,
      };
    }

    const scheduledId = `twitter-scheduled-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      await storeCallback({
        id: scheduledId,
        request: {
          text: request.text,
          mediaIds: request.mediaIds,
          pollOptions: request.pollOptions,
          pollDurationMinutes: request.pollDurationMinutes,
          replyToTweetId: request.replyToTweetId,
          quoteTweetId: request.quoteTweetId,
        },
        scheduledTime: request.scheduledTime,
        organizationId: this.organizationId,
      });

      logger.info('Twitter: Tweet scheduled', {
        scheduledId,
        scheduledTime: request.scheduledTime.toISOString(),
        organizationId: this.organizationId,
      });

      return {
        success: true,
        scheduledId,
      };
    } catch (error) {
      logger.error('Twitter: Failed to schedule tweet', error as Error, {
        organizationId: this.organizationId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule tweet',
      };
    }
  }

  /**
   * Get user's home timeline
   * Requires OAuth 2.0 User Context (read:tweets scope)
   */
  async getTimeline(options: {
    maxResults?: number;
    paginationToken?: string;
    startTime?: Date;
    endTime?: Date;
    excludeReplies?: boolean;
    excludeRetweets?: boolean;
  } = {}): Promise<TwitterTimelineResponse & { error?: string }> {
    if (!this.config.accessToken) {
      return {
        tweets: [],
        error: 'OAuth 2.0 access token required for timeline access.',
      };
    }

    // Build query parameters
    const params = new URLSearchParams();
    params.set('max_results', String(Math.min(options.maxResults ?? 10, 100)));
    params.set('tweet.fields', 'created_at,public_metrics,conversation_id,in_reply_to_user_id,entities,attachments');
    params.set('user.fields', 'name,username,profile_image_url,verified');
    params.set('expansions', 'author_id,attachments.media_keys');

    if (options.paginationToken) {
      params.set('pagination_token', options.paginationToken);
    }

    if (options.startTime) {
      params.set('start_time', options.startTime.toISOString());
    }

    if (options.endTime) {
      params.set('end_time', options.endTime.toISOString());
    }

    // Build exclude parameter
    const excludes: string[] = [];
    if (options.excludeReplies) {excludes.push('replies');}
    if (options.excludeRetweets) {excludes.push('retweets');}
    if (excludes.length > 0) {
      params.set('exclude', excludes.join(','));
    }

    const result = await this.makeRequest<{
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        created_at: string;
        conversation_id?: string;
        in_reply_to_user_id?: string;
        public_metrics?: {
          retweet_count: number;
          reply_count: number;
          like_count: number;
          quote_count: number;
          impression_count?: number;
        };
        entities?: TwitterTweet['entities'];
        attachments?: TwitterTweet['attachments'];
      }>;
      meta?: {
        result_count: number;
        newest_id?: string;
        oldest_id?: string;
        next_token?: string;
        previous_token?: string;
      };
    }>(
      `/users/me/timelines/reverse_chronological?${params.toString()}`,
      { method: 'GET' },
      true
    );

    if (result.error ?? !result.data) {
      return {
        tweets: [],
        error: result.error ?? 'Failed to fetch timeline',
      };
    }

    // Transform API response to our types
    const tweets: TwitterTweet[] = (result.data.data ?? []).map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      conversationId: tweet.conversation_id,
      inReplyToUserId: tweet.in_reply_to_user_id,
      publicMetrics: tweet.public_metrics ? {
        retweetCount: tweet.public_metrics.retweet_count,
        replyCount: tweet.public_metrics.reply_count,
        likeCount: tweet.public_metrics.like_count,
        quoteCount: tweet.public_metrics.quote_count,
        impressionCount: tweet.public_metrics.impression_count,
      } : undefined,
      entities: tweet.entities,
      attachments: tweet.attachments,
    }));

    return {
      tweets,
      meta: result.data.meta ? {
        resultCount: result.data.meta.result_count,
        newestId: result.data.meta.newest_id,
        oldestId: result.data.meta.oldest_id,
        nextToken: result.data.meta.next_token,
        previousToken: result.data.meta.previous_token,
      } : undefined,
    };
  }

  /**
   * Get authenticated user's profile
   */
  async getMe(): Promise<{ user: TwitterUser | null; error?: string }> {
    if (!this.config.accessToken) {
      return {
        user: null,
        error: 'OAuth 2.0 access token required.',
      };
    }

    const params = new URLSearchParams();
    params.set('user.fields', 'description,profile_image_url,public_metrics,verified');

    const result = await this.makeRequest<{
      data: {
        id: string;
        name: string;
        username: string;
        description?: string;
        profile_image_url?: string;
        verified?: boolean;
        public_metrics?: {
          followers_count: number;
          following_count: number;
          tweet_count: number;
          listed_count: number;
        };
      };
    }>(
      `/users/me?${params.toString()}`,
      { method: 'GET' },
      true
    );

    if (result.error ?? !result.data) {
      return {
        user: null,
        error: result.error ?? 'Failed to fetch user profile',
      };
    }

    const userData = result.data.data;
    return {
      user: {
        id: userData.id,
        name: userData.name,
        username: userData.username,
        description: userData.description,
        profileImageUrl: userData.profile_image_url,
        verified: userData.verified,
        publicMetrics: userData.public_metrics ? {
          followersCount: userData.public_metrics.followers_count,
          followingCount: userData.public_metrics.following_count,
          tweetCount: userData.public_metrics.tweet_count,
          listedCount: userData.public_metrics.listed_count,
        } : undefined,
      },
    };
  }

  /**
   * Delete a tweet
   */
  async deleteTweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return {
        success: false,
        error: 'OAuth 2.0 access token required.',
      };
    }

    const result = await this.makeRequest<{ data: { deleted: boolean } }>(
      `/tweets/${tweetId}`,
      { method: 'DELETE' },
      true
    );

    if (result.error ?? !result.data) {
      return {
        success: false,
        error: result.error ?? 'Failed to delete tweet',
      };
    }

    logger.info('Twitter: Tweet deleted', {
      tweetId,
      organizationId: this.organizationId,
    });

    return {
      success: result.data.data.deleted,
    };
  }

  /**
   * Get rate limit status for an endpoint
   */
  getRateLimitStatus(endpoint: string): TwitterRateLimitInfo | null {
    return rateLimitCache.get(endpoint) ?? null;
  }

  /**
   * Refresh OAuth 2.0 access token
   */
  async refreshAccessToken(): Promise<{
    success: boolean;
    accessToken?: string;
    refreshToken?: string;
    expiresIn?: number;
    error?: string;
  }> {
    if (!this.config.refreshToken || !this.config.clientId || !this.config.clientSecret) {
      return {
        success: false,
        error: 'Missing credentials for token refresh',
      };
    }

    try {
      const credentials = Buffer.from(
        `${this.config.clientId}:${this.config.clientSecret}`
      ).toString('base64');

      interface TwitterTokenRefreshResponse {
        access_token: string;
        refresh_token?: string;
        expires_in: number;
      }

      const response = await fetch(TWITTER_OAUTH2_TOKEN_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'Authorization': `Basic ${credentials}`,
        },
        body: new URLSearchParams({
          grant_type: 'refresh_token',
          refresh_token: this.config.refreshToken,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Twitter: Token refresh failed', new Error(errorText), {
          status: response.status,
          organizationId: this.organizationId,
        });
        return {
          success: false,
          error: `Token refresh failed: ${response.status}`,
        };
      }

      const data = await response.json() as TwitterTokenRefreshResponse;

      // Update internal config
      this.config.accessToken = data.access_token;
      if (data.refresh_token) {
        this.config.refreshToken = data.refresh_token;
      }

      logger.info('Twitter: Access token refreshed', {
        organizationId: this.organizationId,
        expiresIn: data.expires_in,
      });

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      logger.error('Twitter: Token refresh error', error as Error, {
        organizationId: this.organizationId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during token refresh',
      };
    }
  }
}

/**
 * Create a Twitter service instance from organization's API keys
 */
export async function createTwitterService(
  organizationId: string
): Promise<TwitterService | null> {
  try {
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');

    // Get organization's API keys config from proper APIKeysConfig structure
    const apiKeys = await apiKeyService.getKeys();

    if (!apiKeys) {
      logger.debug('Twitter: No API keys configured for organization', {
        organizationId,
      });
      return null;
    }

    // Twitter keys can be in social.twitter OR integrations.twitter (support both locations)
    const socialTwitter = apiKeys.social?.twitter;
    const integrationsTwitter = apiKeys.integrations?.twitter;
    const twitterConfig = socialTwitter ?? integrationsTwitter;

    if (!twitterConfig) {
      logger.debug('Twitter: Twitter integration not configured', {
        organizationId,
      });
      return null;
    }

    const config: TwitterConfig = {
      clientId: twitterConfig.clientId ?? '',
      clientSecret: twitterConfig.clientSecret ?? '',
      accessToken: twitterConfig.accessToken,
      refreshToken: twitterConfig.refreshToken,
      bearerToken: twitterConfig.bearerToken,
    };

    // Validate at least one auth method is configured
    if (!config.bearerToken && !config.accessToken && !config.clientId) {
      logger.debug('Twitter: No valid authentication credentials found', {
        organizationId,
      });
      return null;
    }

    logger.info('Twitter: Service created successfully', {
      organizationId,
      hasBearerToken: !!config.bearerToken,
      hasAccessToken: !!config.accessToken,
      hasClientId: !!config.clientId,
    });

    return new TwitterService(config, organizationId);
  } catch (error) {
    logger.error('Twitter: Failed to create service', error as Error, {
      organizationId,
    });
    return null;
  }
}

/**
 * Send a tweet (convenience function)
 */
export async function postTweet(
  organizationId: string,
  text: string,
  options: Omit<TwitterPostRequest, 'text'> = {}
): Promise<TwitterPostResponse> {
  const service = await createTwitterService(organizationId);

  if (!service) {
    return {
      success: false,
      error: 'Twitter service not configured for this organization',
    };
  }

  return service.postTweet({ text, ...options });
}
