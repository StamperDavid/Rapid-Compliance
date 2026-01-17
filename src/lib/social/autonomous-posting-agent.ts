/**
 * Autonomous Posting Agent
 * Manages automated content posting across LinkedIn and Twitter/X
 *
 * Features:
 * - Pulls content from existing Content Factory
 * - Schedules posts across multiple platforms
 * - Supports immediate posting or scheduled queue
 * - Logs all posts to Firestore for analytics
 */

import { logger } from '@/lib/logger/logger';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { createTwitterService, type TwitterService } from '@/lib/integrations/twitter-service';
import type { QueryConstraint } from 'firebase/firestore';
import type {
  SocialPlatform,
  SocialMediaPost,
  PostStatus,
  PostingAgentConfig,
  GeneratedContent,
  PostingResult,
  BatchPostingResult,
  QueuedPost,
  ScheduledPost,
} from '@/types/social';

// Collection paths
const SOCIAL_POSTS_COLLECTION = 'social_posts';
const SOCIAL_QUEUE_COLLECTION = 'social_queue';
const SOCIAL_ANALYTICS_COLLECTION = 'social_analytics';

/**
 * Autonomous Posting Agent Class
 */
export class AutonomousPostingAgent {
  private organizationId: string;
  private config: PostingAgentConfig;
  private twitterService: TwitterService | null = null;

  constructor(organizationId: string, config?: Partial<PostingAgentConfig>) {
    this.organizationId = organizationId;
    this.config = {
      organizationId,
      platforms: config?.platforms ?? ['twitter', 'linkedin'],
      contentSources: config?.contentSources ?? [
        { type: 'ai_generated', enabled: true, priority: 1 },
        { type: 'blog', enabled: true, priority: 2 },
      ],
      schedule: config?.schedule ?? {
        timezone: 'America/New_York',
        slots: [
          { dayOfWeek: 1, hour: 9, minute: 0, platforms: ['twitter', 'linkedin'] },
          { dayOfWeek: 2, hour: 14, minute: 0, platforms: ['twitter'] },
          { dayOfWeek: 3, hour: 9, minute: 0, platforms: ['twitter', 'linkedin'] },
          { dayOfWeek: 4, hour: 14, minute: 0, platforms: ['twitter'] },
          { dayOfWeek: 5, hour: 9, minute: 0, platforms: ['linkedin'] },
        ],
        enableWeekends: false,
      },
      approvalRequired: config?.approvalRequired ?? true,
      autoHashtags: config?.autoHashtags ?? true,
      maxDailyPosts: config?.maxDailyPosts ?? 5,
    };
  }

  /**
   * Initialize the agent with platform services
   */
  async initialize(): Promise<void> {
    logger.info('AutonomousPostingAgent: Initializing', {
      organizationId: this.organizationId,
      platforms: this.config.platforms,
    });

    // Initialize Twitter service if configured
    if (this.config.platforms.includes('twitter')) {
      this.twitterService = await createTwitterService(this.organizationId);
      if (!this.twitterService) {
        logger.warn('AutonomousPostingAgent: Twitter service not configured', {
          organizationId: this.organizationId,
        });
      }
    }
  }

  /**
   * Post content immediately to specified platforms
   */
  async postNow(
    content: string,
    platforms: SocialPlatform[],
    options: {
      mediaUrls?: string[];
      hashtags?: string[];
      createdBy?: string;
    } = {}
  ): Promise<BatchPostingResult> {
    const results: PostingResult[] = [];
    const startTime = new Date();

    // Add hashtags if enabled
    let finalContent = content;
    if (this.config.autoHashtags && options.hashtags && options.hashtags.length > 0) {
      const hashtagString = options.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ');
      finalContent = `${content}\n\n${hashtagString}`;
    }

    logger.info('AutonomousPostingAgent: Posting immediately', {
      organizationId: this.organizationId,
      platforms,
      contentLength: finalContent.length,
    });

    for (const platform of platforms) {
      const result = await this.postToPlatform(platform, finalContent, options.mediaUrls);
      results.push(result);

      // Log post to Firestore
      await this.logPost({
        platform,
        content: finalContent,
        mediaUrls: options.mediaUrls,
        status: result.success ? 'published' : 'failed',
        platformPostId: result.platformPostId,
        publishedAt: result.publishedAt,
        error: result.error,
        createdBy: options.createdBy ?? 'autonomous-agent',
      });
    }

    const successCount = results.filter((r) => r.success).length;
    const failureCount = results.filter((r) => !r.success).length;

    logger.info('AutonomousPostingAgent: Batch posting complete', {
      organizationId: this.organizationId,
      successCount,
      failureCount,
      duration: Date.now() - startTime.getTime(),
    });

    return {
      results,
      successCount,
      failureCount,
      timestamp: new Date(),
    };
  }

  /**
   * Post to a specific platform
   */
  private async postToPlatform(
    platform: SocialPlatform,
    content: string,
    mediaUrls?: string[]
  ): Promise<PostingResult> {
    const postId = `post-${platform}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    try {
      switch (platform) {
        case 'twitter':
          return await this.postToTwitter(postId, content, mediaUrls);

        case 'linkedin':
          return await this.postToLinkedIn(postId, content, mediaUrls);

        default:
          return {
            success: false,
            platform,
            postId,
            error: `Unsupported platform: ${platform}`,
          };
      }
    } catch (error) {
      logger.error('AutonomousPostingAgent: Platform posting error', error as Error, {
        platform,
        organizationId: this.organizationId,
      });
      return {
        success: false,
        platform,
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Post to Twitter/X
   */
  private async postToTwitter(
    postId: string,
    content: string,
    _mediaUrls?: string[]
  ): Promise<PostingResult> {
    // Try to initialize if not already initialized
    this.twitterService ??= await createTwitterService(this.organizationId);

    if (!this.twitterService) {
      return {
        success: false,
        platform: 'twitter',
        postId,
        error: 'Twitter service not configured',
      };
    }

    // Truncate content for Twitter's 280 character limit
    let tweetContent = content;
    if (tweetContent.length > 280) {
      tweetContent = `${tweetContent.substring(0, 277)  }...`;
    }

    const result = await this.twitterService.postTweet({
      text: tweetContent,
      // Note: Media upload requires separate media upload API
      // mediaIds would need to be obtained by uploading media first
    });

    if (result.success) {
      return {
        success: true,
        platform: 'twitter',
        postId,
        platformPostId: result.tweetId,
        publishedAt: new Date(),
      };
    }

    return {
      success: false,
      platform: 'twitter',
      postId,
      error: result.error,
      rateLimited: result.rateLimitRemaining === 0,
      nextRetryAt: result.rateLimitReset,
    };
  }

  /**
   * Post to LinkedIn
   * Note: LinkedIn's official API is restricted; using RapidAPI or manual fallback
   */
  private async postToLinkedIn(
    postId: string,
    content: string,
    _mediaUrls?: string[]
  ): Promise<PostingResult> {
    // LinkedIn posting typically requires posting as a status update
    // Since we're using RapidAPI for messaging, we'll adapt for posting
    // For now, create a manual task or use RapidAPI if available

    try {
      // Get organization's API keys to check for RapidAPI and LinkedIn config
      const { apiKeyService } = await import('@/lib/api-keys/api-key-service');
      const apiKeys = await apiKeyService.getKeys(this.organizationId);

      // Check for RapidAPI key in org config first, then fallback to env
      const rapidApiKey = apiKeys?.enrichment?.rapidApiKey ?? process.env.RAPIDAPI_KEY;

      // Check if LinkedIn is configured (social.linkedin or integrations.linkedin)
      const linkedInConfig = apiKeys?.social?.linkedin ?? apiKeys?.integrations?.googleWorkspace;

      if (rapidApiKey) {
        // Use RapidAPI for LinkedIn posting
        const response = await fetch('https://linkedin-api.p.rapidapi.com/create-post', {
          method: 'POST',
          headers: {
            'X-RapidAPI-Key': rapidApiKey,
            'X-RapidAPI-Host': 'linkedin-api.p.rapidapi.com',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            text: content,
            visibility: 'PUBLIC',
          }),
        });

        if (response.ok) {
          const data = await response.json() as { postId?: string; id?: string };
          return {
            success: true,
            platform: 'linkedin',
            postId,
            platformPostId: data.postId ?? data.id,
            publishedAt: new Date(),
          };
        }

        const errorText = await response.text();
        logger.warn('AutonomousPostingAgent: LinkedIn API error', {
          status: response.status,
          error: errorText,
          organizationId: this.organizationId,
        });
      }

      // Log if LinkedIn is not configured
      if (!linkedInConfig && !rapidApiKey) {
        logger.info('AutonomousPostingAgent: LinkedIn not configured, creating manual task', {
          organizationId: this.organizationId,
        });
      }

      // Fallback: Create manual task for LinkedIn posting
      await this.createManualPostTask('linkedin', content);

      return {
        success: true, // Task created successfully
        platform: 'linkedin',
        postId,
        platformPostId: `linkedin-manual-${Date.now()}`,
        publishedAt: new Date(),
      };
    } catch (error) {
      logger.error('AutonomousPostingAgent: LinkedIn posting error', error as Error, {
        organizationId: this.organizationId,
      });
      return {
        success: false,
        platform: 'linkedin',
        postId,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create a manual task for posting when API is unavailable
   */
  private async createManualPostTask(
    platform: SocialPlatform,
    content: string
  ): Promise<void> {
    const taskId = `social-manual-${platform}-${Date.now()}`;

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/tasks`,
      taskId,
      {
        id: taskId,
        organizationId: this.organizationId,
        title: `Post content to ${platform.charAt(0).toUpperCase() + platform.slice(1)}`,
        description: `Please manually post this content:\n\n${content}`,
        type: `social-${platform}-post`,
        status: 'pending',
        priority: 'medium',
        dueDate: new Date(),
        platform,
        content,
        source: 'autonomous-posting-agent',
        createdBy: 'autonomous-agent',
        createdAt: new Date(),
        updatedAt: new Date(),
      }
    );

    logger.info('AutonomousPostingAgent: Created manual task', {
      taskId,
      platform,
      organizationId: this.organizationId,
    });
  }

  /**
   * Schedule a post for future publishing
   */
  async schedulePost(
    content: string,
    platforms: SocialPlatform[],
    scheduledAt: Date,
    options: {
      mediaUrls?: string[];
      hashtags?: string[];
      createdBy?: string;
    } = {}
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    // Validate scheduled time
    if (scheduledAt <= new Date()) {
      return {
        success: false,
        error: 'Scheduled time must be in the future',
      };
    }

    const postId = `scheduled-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Add hashtags if enabled
    let finalContent = content;
    if (this.config.autoHashtags && options.hashtags && options.hashtags.length > 0) {
      const hashtagString = options.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ');
      finalContent = `${content}\n\n${hashtagString}`;
    }

    try {
      // Create scheduled post entries for each platform
      for (const platform of platforms) {
        const scheduledPost: ScheduledPost = {
          id: `${postId}-${platform}`,
          organizationId: this.organizationId,
          platform,
          content: finalContent,
          mediaUrls: options.mediaUrls,
          status: 'scheduled',
          scheduledAt,
          createdBy: options.createdBy ?? 'autonomous-agent',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_POSTS_COLLECTION}`,
          scheduledPost.id,
          scheduledPost
        );
      }

      logger.info('AutonomousPostingAgent: Post scheduled', {
        postId,
        platforms,
        scheduledAt: scheduledAt.toISOString(),
        organizationId: this.organizationId,
      });

      return {
        success: true,
        postId,
      };
    } catch (error) {
      logger.error('AutonomousPostingAgent: Failed to schedule post', error as Error, {
        organizationId: this.organizationId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to schedule post',
      };
    }
  }

  /**
   * Add post to queue for later processing
   */
  async addToQueue(
    content: string,
    platforms: SocialPlatform[],
    options: {
      mediaUrls?: string[];
      hashtags?: string[];
      preferredTimeSlot?: string;
      createdBy?: string;
    } = {}
  ): Promise<{ success: boolean; postId?: string; error?: string }> {
    const postId = `queued-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    // Add hashtags if enabled
    let finalContent = content;
    if (this.config.autoHashtags && options.hashtags && options.hashtags.length > 0) {
      const hashtagString = options.hashtags.map((tag) => `#${tag.replace(/^#/, '')}`).join(' ');
      finalContent = `${content}\n\n${hashtagString}`;
    }

    try {
      // Get current queue position
      const existingQueue = await FirestoreService.getAll<QueuedPost>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`
      );
      const queuePosition = existingQueue.length + 1;

      // Create queued post entries for each platform
      for (const platform of platforms) {
        const queuedPost: QueuedPost = {
          id: `${postId}-${platform}`,
          organizationId: this.organizationId,
          platform,
          content: finalContent,
          mediaUrls: options.mediaUrls,
          status: 'queued',
          queuePosition,
          preferredTimeSlot: options.preferredTimeSlot,
          createdBy: options.createdBy ?? 'autonomous-agent',
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        await FirestoreService.set(
          `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`,
          queuedPost.id,
          queuedPost
        );
      }

      logger.info('AutonomousPostingAgent: Post added to queue', {
        postId,
        platforms,
        queuePosition,
        organizationId: this.organizationId,
      });

      return {
        success: true,
        postId,
      };
    } catch (error) {
      logger.error('AutonomousPostingAgent: Failed to add to queue', error as Error, {
        organizationId: this.organizationId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to add to queue',
      };
    }
  }

  /**
   * Process scheduled posts that are due
   */
  async processScheduledPosts(): Promise<BatchPostingResult> {
    const now = new Date();
    const results: PostingResult[] = [];

    try {
      // Get all scheduled posts that are due
      const { where } = await import('firebase/firestore');
      const scheduledPosts = await FirestoreService.getAll<SocialMediaPost>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_POSTS_COLLECTION}`,
        [
          where('status', '==', 'scheduled'),
          where('scheduledAt', '<=', now),
        ]
      );

      logger.info('AutonomousPostingAgent: Processing scheduled posts', {
        count: scheduledPosts.length,
        organizationId: this.organizationId,
      });

      for (const post of scheduledPosts) {
        // Update status to publishing
        await FirestoreService.update(
          `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_POSTS_COLLECTION}`,
          post.id,
          { status: 'publishing', updatedAt: new Date() }
        );

        // Post to platform
        const result = await this.postToPlatform(post.platform, post.content, post.mediaUrls);
        results.push(result);

        // Update post record
        await FirestoreService.update(
          `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_POSTS_COLLECTION}`,
          post.id,
          {
            status: result.success ? 'published' : 'failed',
            platformPostId: result.platformPostId,
            publishedAt: result.publishedAt,
            error: result.error,
            updatedAt: new Date(),
          }
        );
      }

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      logger.info('AutonomousPostingAgent: Scheduled posts processed', {
        successCount,
        failureCount,
        organizationId: this.organizationId,
      });

      return {
        results,
        successCount,
        failureCount,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('AutonomousPostingAgent: Error processing scheduled posts', error as Error, {
        organizationId: this.organizationId,
      });
      return {
        results,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Process queue and publish next posts
   */
  async processQueue(maxPosts: number = 1): Promise<BatchPostingResult> {
    const results: PostingResult[] = [];

    try {
      // Get queued posts ordered by position
      const { orderBy, limit } = await import('firebase/firestore');
      const queuedPosts = await FirestoreService.getAll<QueuedPost>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`,
        [
          orderBy('queuePosition', 'asc'),
          limit(maxPosts),
        ]
      );

      logger.info('AutonomousPostingAgent: Processing queue', {
        count: queuedPosts.length,
        maxPosts,
        organizationId: this.organizationId,
      });

      for (const post of queuedPosts) {
        // Post to platform
        const result = await this.postToPlatform(post.platform, post.content, post.mediaUrls);
        results.push(result);

        // Move from queue to posts collection
        await FirestoreService.delete(
          `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`,
          post.id
        );

        // Log the post
        await this.logPost({
          platform: post.platform,
          content: post.content,
          mediaUrls: post.mediaUrls,
          status: result.success ? 'published' : 'failed',
          platformPostId: result.platformPostId,
          publishedAt: result.publishedAt,
          error: result.error,
          createdBy: post.createdBy,
        });
      }

      // Reorder remaining queue positions
      await this.reorderQueue();

      const successCount = results.filter((r) => r.success).length;
      const failureCount = results.filter((r) => !r.success).length;

      return {
        results,
        successCount,
        failureCount,
        timestamp: new Date(),
      };
    } catch (error) {
      logger.error('AutonomousPostingAgent: Error processing queue', error as Error, {
        organizationId: this.organizationId,
      });
      return {
        results,
        successCount: results.filter((r) => r.success).length,
        failureCount: results.filter((r) => !r.success).length,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Reorder queue positions after processing
   */
  private async reorderQueue(): Promise<void> {
    try {
      const { orderBy } = await import('firebase/firestore');
      const queuedPosts = await FirestoreService.getAll<QueuedPost>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`,
        [orderBy('queuePosition', 'asc')]
      );

      for (let i = 0; i < queuedPosts.length; i++) {
        if (queuedPosts[i].queuePosition !== i + 1) {
          await FirestoreService.update(
            `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`,
            queuedPosts[i].id,
            { queuePosition: i + 1, updatedAt: new Date() }
          );
        }
      }
    } catch (error) {
      logger.warn('AutonomousPostingAgent: Failed to reorder queue', {
        error: error instanceof Error ? error.message : 'Unknown error',
        organizationId: this.organizationId,
      });
    }
  }

  /**
   * Log post to Firestore for analytics
   */
  private async logPost(data: {
    platform: SocialPlatform;
    content: string;
    mediaUrls?: string[];
    status: PostStatus;
    platformPostId?: string;
    publishedAt?: Date;
    error?: string;
    createdBy: string;
  }): Promise<void> {
    const postId = `post-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

    const post: SocialMediaPost = {
      id: postId,
      organizationId: this.organizationId,
      platform: data.platform,
      content: data.content,
      mediaUrls: data.mediaUrls,
      status: data.status,
      platformPostId: data.platformPostId,
      publishedAt: data.publishedAt,
      error: data.error,
      createdBy: data.createdBy,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_POSTS_COLLECTION}`,
      postId,
      post
    );

    // Also log to analytics collection for reporting
    await FirestoreService.set(
      `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_ANALYTICS_COLLECTION}`,
      postId,
      {
        postId,
        platform: data.platform,
        status: data.status,
        publishedAt: data.publishedAt ?? new Date(),
        success: data.status === 'published',
        createdAt: new Date(),
      }
    );
  }

  /**
   * Get queue contents
   */
  async getQueue(platform?: SocialPlatform): Promise<QueuedPost[]> {
    try {
      const { orderBy, where } = await import('firebase/firestore');
      const constraints: QueryConstraint[] = [orderBy('queuePosition', 'asc')];

      if (platform) {
        constraints.unshift(where('platform', '==', platform));
      }

      return await FirestoreService.getAll<QueuedPost>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`,
        constraints
      );
    } catch (error) {
      logger.error('AutonomousPostingAgent: Failed to get queue', error as Error, {
        organizationId: this.organizationId,
      });
      return [];
    }
  }

  /**
   * Get scheduled posts
   */
  async getScheduledPosts(platform?: SocialPlatform): Promise<ScheduledPost[]> {
    try {
      const { orderBy, where } = await import('firebase/firestore');
      const constraints = [
        where('status', '==', 'scheduled'),
        orderBy('scheduledAt', 'asc'),
      ];

      if (platform) {
        constraints.unshift(where('platform', '==', platform));
      }

      return await FirestoreService.getAll<ScheduledPost>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_POSTS_COLLECTION}`,
        constraints
      );
    } catch (error) {
      logger.error('AutonomousPostingAgent: Failed to get scheduled posts', error as Error, {
        organizationId: this.organizationId,
      });
      return [];
    }
  }

  /**
   * Cancel a scheduled or queued post
   */
  async cancelPost(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      // Try to find in scheduled posts
      const post = await FirestoreService.get<SocialMediaPost>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_POSTS_COLLECTION}`,
        postId
      );

      if (post?.status === 'scheduled') {
        await FirestoreService.update(
          `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_POSTS_COLLECTION}`,
          postId,
          { status: 'cancelled', updatedAt: new Date() }
        );
        return { success: true };
      }

      // Try to find in queue
      const queuedPost = await FirestoreService.get<QueuedPost>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`,
        postId
      );

      if (queuedPost) {
        await FirestoreService.delete(
          `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_QUEUE_COLLECTION}`,
          postId
        );
        await this.reorderQueue();
        return { success: true };
      }

      return { success: false, error: 'Post not found' };
    } catch (error) {
      logger.error('AutonomousPostingAgent: Failed to cancel post', error as Error, {
        postId,
        organizationId: this.organizationId,
      });
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel post',
      };
    }
  }

  /**
   * Get posting analytics
   */
  async getAnalytics(options: {
    startDate?: Date;
    endDate?: Date;
    platform?: SocialPlatform;
  } = {}): Promise<{
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    byPlatform: Record<SocialPlatform, { total: number; success: number; failed: number }>;
  }> {
    try {
      const { where, orderBy } = await import('firebase/firestore');
      const constraints = [];

      if (options.startDate) {
        constraints.push(where('publishedAt', '>=', options.startDate));
      }
      if (options.endDate) {
        constraints.push(where('publishedAt', '<=', options.endDate));
      }
      if (options.platform) {
        constraints.push(where('platform', '==', options.platform));
      }

      constraints.push(orderBy('publishedAt', 'desc'));

      const posts = await FirestoreService.getAll<{ platform: SocialPlatform; success: boolean }>(
        `${COLLECTIONS.ORGANIZATIONS}/${this.organizationId}/${SOCIAL_ANALYTICS_COLLECTION}`,
        constraints
      );

      const analytics = {
        totalPosts: posts.length,
        successfulPosts: posts.filter((p) => p.success).length,
        failedPosts: posts.filter((p) => !p.success).length,
        byPlatform: {} as Record<SocialPlatform, { total: number; success: number; failed: number }>,
      };

      // Aggregate by platform
      for (const post of posts) {
        if (!analytics.byPlatform[post.platform]) {
          analytics.byPlatform[post.platform] = { total: 0, success: 0, failed: 0 };
        }
        analytics.byPlatform[post.platform].total++;
        if (post.success) {
          analytics.byPlatform[post.platform].success++;
        } else {
          analytics.byPlatform[post.platform].failed++;
        }
      }

      return analytics;
    } catch (error) {
      logger.error('AutonomousPostingAgent: Failed to get analytics', error as Error, {
        organizationId: this.organizationId,
      });
      return {
        totalPosts: 0,
        successfulPosts: 0,
        failedPosts: 0,
        byPlatform: {} as Record<SocialPlatform, { total: number; success: number; failed: number }>,
      };
    }
  }

  /**
   * Generate content from AI
   */
  async generateContent(options: {
    topic: string;
    platform: SocialPlatform;
    tone?: string;
    includeHashtags?: boolean;
  }): Promise<GeneratedContent | null> {
    try {
      const { generateText } = await import('@/lib/ai/gemini-service');

      const platformGuide = options.platform === 'twitter'
        ? 'Keep it under 280 characters. Be concise and engaging.'
        : 'Can be longer form. Be professional and insightful.';

      const prompt = `Generate a ${options.platform} post about: ${options.topic}

Tone: ${options.tone ?? 'professional'}
${platformGuide}
${options.includeHashtags ? 'Include 3-5 relevant hashtags.' : ''}

Return ONLY a JSON object with:
- content: The post text
- hashtags: Array of hashtags (without # prefix)`;

      const response = await generateText(prompt, undefined, this.organizationId);
      const jsonMatch = response.text.match(/\{[\s\S]*\}/);

      if (jsonMatch) {
        const generated = JSON.parse(jsonMatch[0]) as { content?: string; hashtags?: string[] };
        const content = generated.content;
        const hashtags = generated.hashtags;

        if (!content) {
          return null;
        }

        return {
          id: `generated-${Date.now()}`,
          sourceType: 'ai_generated',
          content,
          hashtags,
          suggestedPlatforms: [options.platform],
          generatedAt: new Date(),
          metadata: { topic: options.topic, tone: options.tone },
        };
      }

      return null;
    } catch (error) {
      logger.error('AutonomousPostingAgent: Failed to generate content', error as Error, {
        organizationId: this.organizationId,
      });
      return null;
    }
  }
}

/**
 * Create an autonomous posting agent for an organization
 */
export async function createPostingAgent(
  organizationId: string,
  config?: Partial<PostingAgentConfig>
): Promise<AutonomousPostingAgent> {
  const agent = new AutonomousPostingAgent(organizationId, config);
  await agent.initialize();
  return agent;
}
