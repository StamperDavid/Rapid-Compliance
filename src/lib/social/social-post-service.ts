/**
 * Social Post Service
 * Service layer for managing scheduled social media posts in Firestore
 *
 * Handles:
 * - Creating scheduled posts with real postIds
 * - Validating future-dated timestamps
 * - Persisting posts to Firestore for worker execution
 *
 * Collection: platform/social_posts (platform-level scheduled posts)
 */

import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { v4 as uuidv4 } from 'uuid';

// =============================================================================
// TYPES
// =============================================================================

export type SocialPlatform = 'twitter' | 'linkedin';
export type ScheduledPostStatus = 'scheduled' | 'publishing' | 'published' | 'failed' | 'cancelled';

export interface ScheduledSocialPost {
  id: string;
  platform: SocialPlatform;
  content: string;
  mediaUrls?: string[];

  // Status tracking
  status: ScheduledPostStatus;
  scheduledAt: Date;

  // Result tracking
  platformPostId?: string;
  postUrl?: string;
  publishedAt?: Date;
  error?: string;

  // Metadata
  createdBy: string;
  createdByEmail?: string;
  source: 'admin-dashboard' | 'api' | 'autonomous-agent';

  // Timing
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateScheduledPostRequest {
  platform: SocialPlatform;
  content: string;
  scheduledAt: Date;
  mediaUrls?: string[];
  createdBy: string;
  createdByEmail?: string;
}

// =============================================================================
// SERVICE
// =============================================================================

const PLATFORM_SOCIAL_POSTS_COLLECTION = 'platform_social_posts';

/**
 * Social Post Service
 * Manages platform-level scheduled social media posts in Firestore
 */
export class SocialPostService {
  /**
   * Get the collection path for platform social posts
   */
  private static getCollectionPath(): string {
    return `${COLLECTIONS.ORGANIZATIONS}/platform/${PLATFORM_SOCIAL_POSTS_COLLECTION}`;
  }

  /**
   * Create a scheduled social media post
   */
  static async createScheduledPost(request: CreateScheduledPostRequest): Promise<ScheduledSocialPost> {
    // Validate scheduled time is in the future
    const now = new Date();
    if (request.scheduledAt <= now) {
      throw new Error('Scheduled time must be in the future');
    }

    const postId = `post_${uuidv4()}`;

    const post: ScheduledSocialPost = {
      id: postId,
      platform: request.platform,
      content: request.content,
      mediaUrls: request.mediaUrls,

      // Initial status
      status: 'scheduled',
      scheduledAt: request.scheduledAt,

      // Metadata
      createdBy: request.createdBy,
      createdByEmail: request.createdByEmail,
      source: 'admin-dashboard',

      // Timing
      createdAt: now,
      updatedAt: now,
    };

    try {
      await FirestoreService.set(
        SocialPostService.getCollectionPath(),
        postId,
        post,
        false
      );

      logger.info('SocialPostService: Created scheduled post', {
        postId,
        platform: request.platform,
        scheduledAt: request.scheduledAt.toISOString(),
        file: 'social-post-service.ts',
      });

      return post;
    } catch (error) {
      logger.error(
        'SocialPostService: Failed to create scheduled post',
        error instanceof Error ? error : new Error(String(error)),
        {
          platform: request.platform,
          file: 'social-post-service.ts',
        }
      );
      throw error;
    }
  }

  /**
   * Get a scheduled post by ID
   */
  static async getPost(postId: string): Promise<ScheduledSocialPost | null> {
    try {
      const post = await FirestoreService.get<ScheduledSocialPost>(
        SocialPostService.getCollectionPath(),
        postId
      );
      return post;
    } catch (error) {
      logger.error(
        'SocialPostService: Failed to get post',
        error instanceof Error ? error : new Error(String(error)),
        {
          postId,
          file: 'social-post-service.ts',
        }
      );
      return null;
    }
  }

  /**
   * Get all scheduled posts (pending execution)
   */
  static async getScheduledPosts(platform?: SocialPlatform): Promise<ScheduledSocialPost[]> {
    try {
      const { where, orderBy } = await import('firebase/firestore');
      const constraints = [
        where('status', '==', 'scheduled'),
        orderBy('scheduledAt', 'asc'),
      ];

      if (platform) {
        constraints.unshift(where('platform', '==', platform));
      }

      const posts = await FirestoreService.getAll<ScheduledSocialPost>(
        SocialPostService.getCollectionPath(),
        constraints
      );
      return posts;
    } catch (error) {
      logger.error(
        'SocialPostService: Failed to get scheduled posts',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'social-post-service.ts' }
      );
      return [];
    }
  }

  /**
   * Get recent posts (published within last 7 days)
   */
  static async getRecentPosts(limit: number = 10): Promise<ScheduledSocialPost[]> {
    try {
      const { where, orderBy, limit: firestoreLimit } = await import('firebase/firestore');
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const posts = await FirestoreService.getAll<ScheduledSocialPost>(
        SocialPostService.getCollectionPath(),
        [
          where('status', '==', 'published'),
          where('publishedAt', '>=', sevenDaysAgo),
          orderBy('publishedAt', 'desc'),
          firestoreLimit(limit),
        ]
      );
      return posts;
    } catch (error) {
      logger.error(
        'SocialPostService: Failed to get recent posts',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'social-post-service.ts' }
      );
      return [];
    }
  }

  /**
   * Update a scheduled post's status
   */
  static async updatePostStatus(
    postId: string,
    status: ScheduledPostStatus,
    additionalData?: Partial<ScheduledSocialPost>
  ): Promise<void> {
    try {
      const updateData: Record<string, unknown> = {
        status,
        updatedAt: new Date(),
        ...additionalData,
      };

      // Add publishedAt if status is published
      if (status === 'published') {
        updateData.publishedAt = new Date();
      }

      await FirestoreService.update(
        SocialPostService.getCollectionPath(),
        postId,
        updateData
      );

      logger.info('SocialPostService: Updated post status', {
        postId,
        status,
        file: 'social-post-service.ts',
      });
    } catch (error) {
      logger.error(
        'SocialPostService: Failed to update post status',
        error instanceof Error ? error : new Error(String(error)),
        {
          postId,
          status,
          file: 'social-post-service.ts',
        }
      );
      throw error;
    }
  }

  /**
   * Cancel a scheduled post
   */
  static async cancelPost(postId: string): Promise<{ success: boolean; error?: string }> {
    try {
      const post = await SocialPostService.getPost(postId);

      if (!post) {
        return { success: false, error: 'Post not found' };
      }

      if (post.status !== 'scheduled') {
        return { success: false, error: `Cannot cancel post with status: ${post.status}` };
      }

      await SocialPostService.updatePostStatus(postId, 'cancelled');

      logger.info('SocialPostService: Cancelled scheduled post', {
        postId,
        file: 'social-post-service.ts',
      });

      return { success: true };
    } catch (error) {
      logger.error(
        'SocialPostService: Failed to cancel post',
        error instanceof Error ? error : new Error(String(error)),
        {
          postId,
          file: 'social-post-service.ts',
        }
      );
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Failed to cancel post',
      };
    }
  }

  /**
   * Mark post as published with platform details
   */
  static async markAsPublished(
    postId: string,
    platformPostId: string,
    postUrl?: string
  ): Promise<void> {
    await SocialPostService.updatePostStatus(postId, 'published', {
      platformPostId,
      postUrl,
      publishedAt: new Date(),
    });

    logger.info('SocialPostService: Marked post as published', {
      postId,
      platformPostId,
      file: 'social-post-service.ts',
    });
  }

  /**
   * Mark post as failed with error details
   */
  static async markAsFailed(postId: string, error: string): Promise<void> {
    await SocialPostService.updatePostStatus(postId, 'failed', {
      error,
    });

    logger.warn('SocialPostService: Marked post as failed', {
      postId,
      error,
      file: 'social-post-service.ts',
    });
  }

  /**
   * Get posts due for publishing
   */
  static async getPostsDueForPublishing(): Promise<ScheduledSocialPost[]> {
    try {
      const { where, orderBy } = await import('firebase/firestore');
      const now = new Date();

      const posts = await FirestoreService.getAll<ScheduledSocialPost>(
        SocialPostService.getCollectionPath(),
        [
          where('status', '==', 'scheduled'),
          where('scheduledAt', '<=', now),
          orderBy('scheduledAt', 'asc'),
        ]
      );
      return posts;
    } catch (error) {
      logger.error(
        'SocialPostService: Failed to get posts due for publishing',
        error instanceof Error ? error : new Error(String(error)),
        { file: 'social-post-service.ts' }
      );
      return [];
    }
  }
}
