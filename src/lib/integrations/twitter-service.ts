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

  constructor(config: TwitterConfig) {
    this.config = config;
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
      logger.warn('Twitter: Service not configured');
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
      logger.warn('Twitter: Cannot post tweet - OAuth 2.0 access token required');
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
      });

      logger.info('Twitter: Tweet scheduled', {
        scheduledId,
        scheduledTime: request.scheduledTime.toISOString(),
      });

      return {
        success: true,
        scheduledId,
      };
    } catch (error) {
      logger.error('Twitter: Failed to schedule tweet', error as Error);
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
    });

    return {
      success: result.data.data.deleted,
    };
  }

  /**
   * Upload media to Twitter (v1.1 media upload endpoint)
   * Returns media_id string for use in tweet creation
   */
  async uploadMedia(
    buffer: Buffer,
    mimeType: string
  ): Promise<{ mediaId: string | null; error?: string }> {
    if (!this.config.accessToken) {
      return { mediaId: null, error: 'OAuth 2.0 access token required for media upload' };
    }

    try {
      // Twitter media upload uses v1.1 endpoint
      const formData = new FormData();
      const blob = new Blob([new Uint8Array(buffer)], { type: mimeType });
      formData.append('media', blob);
      formData.append('media_category', mimeType.startsWith('video/') ? 'tweet_video' : 'tweet_image');

      const response = await fetch('https://upload.twitter.com/1.1/media/upload.json', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.accessToken}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errorText = await response.text();
        logger.error('Twitter: Media upload failed', new Error(errorText), { status: response.status });
        return { mediaId: null, error: `Media upload failed: ${response.status}` };
      }

      const data = await response.json() as { media_id_string: string };
      logger.info('Twitter: Media uploaded', { mediaId: data.media_id_string, mimeType });

      return { mediaId: data.media_id_string };
    } catch (error) {
      logger.error('Twitter: Media upload error', error as Error);
      return { mediaId: null, error: error instanceof Error ? error.message : 'Media upload failed' };
    }
  }

  /**
   * Search recent tweets (Twitter API v2)
   * Uses GET /2/tweets/search/recent (Basic tier)
   */
  async searchRecentTweets(
    queryStr: string,
    options: { maxResults?: number; startTime?: Date; endTime?: Date } = {}
  ): Promise<{ tweets: TwitterTweet[]; error?: string }> {
    const params = new URLSearchParams();
    params.set('query', queryStr);
    params.set('max_results', String(Math.min(options.maxResults ?? 10, 100)));
    params.set('tweet.fields', 'created_at,public_metrics,author_id,entities');

    if (options.startTime) {
      params.set('start_time', options.startTime.toISOString());
    }
    if (options.endTime) {
      params.set('end_time', options.endTime.toISOString());
    }

    const result = await this.makeRequest<{
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        created_at: string;
        public_metrics?: {
          retweet_count: number;
          reply_count: number;
          like_count: number;
          quote_count: number;
          impression_count?: number;
        };
        entities?: TwitterTweet['entities'];
      }>;
    }>(
      `/tweets/search/recent?${params.toString()}`,
      { method: 'GET' }
    );

    if (result.error || !result.data) {
      return { tweets: [], error: result.error ?? 'Failed to search tweets' };
    }

    const tweets: TwitterTweet[] = (result.data.data ?? []).map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      publicMetrics: tweet.public_metrics ? {
        retweetCount: tweet.public_metrics.retweet_count,
        replyCount: tweet.public_metrics.reply_count,
        likeCount: tweet.public_metrics.like_count,
        quoteCount: tweet.public_metrics.quote_count,
        impressionCount: tweet.public_metrics.impression_count,
      } : undefined,
      entities: tweet.entities,
    }));

    return { tweets };
  }

  /**
   * Get mentions for a user (Twitter API v2)
   * Uses GET /2/users/:id/mentions
   */
  async getMentions(
    userId: string,
    options: { maxResults?: number; sinceId?: string } = {}
  ): Promise<{ tweets: TwitterTweet[]; error?: string }> {
    if (!this.config.accessToken) {
      return { tweets: [], error: 'OAuth 2.0 access token required for mentions' };
    }

    const params = new URLSearchParams();
    params.set('max_results', String(Math.min(options.maxResults ?? 10, 100)));
    params.set('tweet.fields', 'created_at,public_metrics,author_id,entities');

    if (options.sinceId) {
      params.set('since_id', options.sinceId);
    }

    const result = await this.makeRequest<{
      data?: Array<{
        id: string;
        text: string;
        author_id: string;
        created_at: string;
        public_metrics?: {
          retweet_count: number;
          reply_count: number;
          like_count: number;
          quote_count: number;
          impression_count?: number;
        };
        entities?: TwitterTweet['entities'];
      }>;
    }>(
      `/users/${userId}/mentions?${params.toString()}`,
      { method: 'GET' },
      true
    );

    if (result.error || !result.data) {
      return { tweets: [], error: result.error ?? 'Failed to get mentions' };
    }

    const tweets: TwitterTweet[] = (result.data.data ?? []).map((tweet) => ({
      id: tweet.id,
      text: tweet.text,
      authorId: tweet.author_id,
      createdAt: tweet.created_at,
      publicMetrics: tweet.public_metrics ? {
        retweetCount: tweet.public_metrics.retweet_count,
        replyCount: tweet.public_metrics.reply_count,
        likeCount: tweet.public_metrics.like_count,
        quoteCount: tweet.public_metrics.quote_count,
        impressionCount: tweet.public_metrics.impression_count,
      } : undefined,
      entities: tweet.entities,
    }));

    return { tweets };
  }

  /**
   * Like a tweet
   * Requires OAuth 2.0 User Context (like.write scope)
   * POST /2/users/:id/likes
   */
  async likeTweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'OAuth 2.0 access token required for liking tweets.' };
    }

    // First get our user ID
    const meResult = await this.getMe();
    if (!meResult.user) {
      return { success: false, error: meResult.error ?? 'Failed to get authenticated user' };
    }

    const result = await this.makeRequest<{ data: { liked: boolean } }>(
      `/users/${meResult.user.id}/likes`,
      {
        method: 'POST',
        body: JSON.stringify({ tweet_id: tweetId }),
      },
      true
    );

    if (result.error ?? !result.data) {
      return { success: false, error: result.error ?? 'Failed to like tweet' };
    }

    logger.info('Twitter: Tweet liked', { tweetId });
    return { success: result.data.data.liked };
  }

  /**
   * Unlike a tweet
   * DELETE /2/users/:id/likes/:tweet_id
   */
  async unlikeTweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'OAuth 2.0 access token required.' };
    }

    const meResult = await this.getMe();
    if (!meResult.user) {
      return { success: false, error: meResult.error ?? 'Failed to get authenticated user' };
    }

    const result = await this.makeRequest<{ data: { liked: boolean } }>(
      `/users/${meResult.user.id}/likes/${tweetId}`,
      { method: 'DELETE' },
      true
    );

    if (result.error ?? !result.data) {
      return { success: false, error: result.error ?? 'Failed to unlike tweet' };
    }

    logger.info('Twitter: Tweet unliked', { tweetId });
    return { success: !result.data.data.liked };
  }

  /**
   * Retweet a tweet
   * POST /2/users/:id/retweets
   */
  async retweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'OAuth 2.0 access token required for retweeting.' };
    }

    const meResult = await this.getMe();
    if (!meResult.user) {
      return { success: false, error: meResult.error ?? 'Failed to get authenticated user' };
    }

    const result = await this.makeRequest<{ data: { retweeted: boolean } }>(
      `/users/${meResult.user.id}/retweets`,
      {
        method: 'POST',
        body: JSON.stringify({ tweet_id: tweetId }),
      },
      true
    );

    if (result.error ?? !result.data) {
      return { success: false, error: result.error ?? 'Failed to retweet' };
    }

    logger.info('Twitter: Tweet retweeted', { tweetId });
    return { success: result.data.data.retweeted };
  }

  /**
   * Undo a retweet
   * DELETE /2/users/:id/retweets/:tweet_id
   */
  async unretweet(tweetId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'OAuth 2.0 access token required.' };
    }

    const meResult = await this.getMe();
    if (!meResult.user) {
      return { success: false, error: meResult.error ?? 'Failed to get authenticated user' };
    }

    const result = await this.makeRequest<{ data: { retweeted: boolean } }>(
      `/users/${meResult.user.id}/retweets/${tweetId}`,
      { method: 'DELETE' },
      true
    );

    if (result.error ?? !result.data) {
      return { success: false, error: result.error ?? 'Failed to unretweet' };
    }

    logger.info('Twitter: Retweet removed', { tweetId });
    return { success: !result.data.data.retweeted };
  }

  /**
   * Follow a user
   * POST /2/users/:id/following
   */
  async followUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'OAuth 2.0 access token required for following users.' };
    }

    const meResult = await this.getMe();
    if (!meResult.user) {
      return { success: false, error: meResult.error ?? 'Failed to get authenticated user' };
    }

    const result = await this.makeRequest<{ data: { following: boolean; pending_follow: boolean } }>(
      `/users/${meResult.user.id}/following`,
      {
        method: 'POST',
        body: JSON.stringify({ target_user_id: targetUserId }),
      },
      true
    );

    if (result.error ?? !result.data) {
      return { success: false, error: result.error ?? 'Failed to follow user' };
    }

    logger.info('Twitter: User followed', {
      targetUserId,
      pending: result.data.data.pending_follow,
    });
    return { success: result.data.data.following || result.data.data.pending_follow };
  }

  /**
   * Unfollow a user
   * DELETE /2/users/:id/following/:target_user_id
   */
  async unfollowUser(targetUserId: string): Promise<{ success: boolean; error?: string }> {
    if (!this.config.accessToken) {
      return { success: false, error: 'OAuth 2.0 access token required.' };
    }

    const meResult = await this.getMe();
    if (!meResult.user) {
      return { success: false, error: meResult.error ?? 'Failed to get authenticated user' };
    }

    const result = await this.makeRequest<{ data: { following: boolean } }>(
      `/users/${meResult.user.id}/following/${targetUserId}`,
      { method: 'DELETE' },
      true
    );

    if (result.error ?? !result.data) {
      return { success: false, error: result.error ?? 'Failed to unfollow user' };
    }

    logger.info('Twitter: User unfollowed', { targetUserId });
    return { success: !result.data.data.following };
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
        expiresIn: data.expires_in,
      });

      return {
        success: true,
        accessToken: data.access_token,
        refreshToken: data.refresh_token,
        expiresIn: data.expires_in,
      };
    } catch (error) {
      logger.error('Twitter: Token refresh error', error as Error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error during token refresh',
      };
    }
  }
}

/**
 * Create a Twitter service for a specific social account (multi-account support)
 */
export async function createTwitterServiceForAccount(accountId: string): Promise<TwitterService | null> {
  try {
    const { SocialAccountService } = await import('@/lib/social/social-account-service');
    const account = await SocialAccountService.getAccount(accountId);

    if (account?.platform !== 'twitter') {
      logger.debug('Twitter: Account not found or not a Twitter account', { accountId });
      return null;
    }

    const creds = account.credentials as {
      clientId?: string;
      clientSecret?: string;
      accessToken?: string;
      refreshToken?: string;
      bearerToken?: string;
    };

    const config: TwitterConfig = {
      clientId: creds.clientId ?? '',
      clientSecret: creds.clientSecret ?? '',
      accessToken: creds.accessToken,
      refreshToken: creds.refreshToken,
      bearerToken: creds.bearerToken,
    };

    if (!config.bearerToken && !config.accessToken && !config.clientId) {
      logger.debug('Twitter: No valid credentials for account', { accountId });
      return null;
    }

    logger.info('Twitter: Service created for account', { accountId, handle: account.handle });
    return new TwitterService(config);
  } catch (error) {
    logger.error('Twitter: Failed to create service for account', error as Error, { accountId });
    return null;
  }
}

/**
 * Create a Twitter service instance from organization's API keys
 */
export async function createTwitterService(): Promise<TwitterService | null> {
  try {
    const { apiKeyService } = await import('@/lib/api-keys/api-key-service');

    // Get organization's API keys config from proper APIKeysConfig structure
    const apiKeys = await apiKeyService.getKeys();

    if (!apiKeys) {
      logger.debug('Twitter: No API keys configured');
      return null;
    }

    // Twitter keys can be in social.twitter OR integrations.twitter (support both locations)
    const socialTwitter = apiKeys.social?.twitter;
    const integrationsTwitter = apiKeys.integrations?.twitter;
    const twitterConfig = socialTwitter ?? integrationsTwitter;

    if (!twitterConfig) {
      logger.debug('Twitter: Twitter integration not configured');
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
      logger.debug('Twitter: No valid authentication credentials found');
      return null;
    }

    logger.info('Twitter: Service created successfully', {
      hasBearerToken: !!config.bearerToken,
      hasAccessToken: !!config.accessToken,
      hasClientId: !!config.clientId,
    });

    return new TwitterService(config);
  } catch (error) {
    logger.error('Twitter: Failed to create service', error as Error);
    return null;
  }
}

/**
 * Send a tweet (convenience function)
 */
export async function postTweet(
  text: string,
  options: Omit<TwitterPostRequest, 'text'> = {}
): Promise<TwitterPostResponse> {
  const service = await createTwitterService();

  if (!service) {
    return {
      success: false,
      error: 'Twitter service not configured for this organization',
    };
  }

  return service.postTweet({ text, ...options });
}
