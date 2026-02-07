/**
 * Engagement Metrics Collector Service
 *
 * Fetches engagement data for published social media posts and updates
 * PostMetrics in Firestore. Uses TwitterService.getTimeline() which already
 * returns public_metrics (likes, retweets, replies, impressions).
 *
 * ARCHITECTURE:
 * - Matches tweets to stored social_posts by platformPostId
 * - Updates PostMetrics fields in Firestore with real data
 * - Stores historical snapshots for delta tracking
 * - Writes performance data to MemoryVault for cross-agent analysis
 *
 * @module social/engagement-metrics-collector
 */

import { logger } from '@/lib/logger/logger';
import { FirestoreService, COLLECTIONS } from '@/lib/db/firestore-service';
import { createTwitterService } from '@/lib/integrations/twitter-service';
import { getMemoryVault } from '@/lib/agents/shared/memory-vault';
import { DEFAULT_ORG_ID } from '@/lib/constants/platform';
import type { SocialMediaPost, PostMetrics } from '@/types/social';

// ============================================================================
// TYPES
// ============================================================================

/** Result of a single post metrics update */
interface PostMetricsUpdate {
  postId: string;
  platform: string;
  platformPostId: string;
  previousMetrics: PostMetrics | undefined;
  currentMetrics: PostMetrics;
  delta: PostMetricsDelta;
  updatedAt: Date;
}

/** Delta between two metric snapshots */
interface PostMetricsDelta {
  impressions: number;
  engagements: number;
  likes: number;
  comments: number;
  shares: number;
  clicks: number;
}

/** Historical snapshot for tracking metrics over time */
interface MetricsSnapshot {
  postId: string;
  platformPostId: string;
  platform: string;
  metrics: PostMetrics;
  collectedAt: Date;
}

/** Collector run result */
export interface MetricsCollectionResult {
  success: boolean;
  postsScanned: number;
  postsUpdated: number;
  errors: string[];
  updates: PostMetricsUpdate[];
  collectedAt: Date;
  durationMs: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

const SOCIAL_POSTS_COLLECTION = 'social_posts';
const METRICS_SNAPSHOTS_COLLECTION = 'social_metrics_snapshots';

// ============================================================================
// ENGAGEMENT METRICS COLLECTOR
// ============================================================================

/**
 * Collect engagement metrics for all published posts across platforms.
 * Fetches real-time data from platform APIs and updates Firestore.
 */
export async function collectEngagementMetrics(): Promise<MetricsCollectionResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  const updates: PostMetricsUpdate[] = [];

  logger.info('[MetricsCollector] Starting engagement metrics collection', {
    organizationId: DEFAULT_ORG_ID,
  });

  try {
    // 1. Fetch all published posts that have a platformPostId
    const publishedPosts = await getPublishedPostsWithPlatformIds();

    if (publishedPosts.length === 0) {
      logger.info('[MetricsCollector] No published posts with platform IDs found');
      return {
        success: true,
        postsScanned: 0,
        postsUpdated: 0,
        errors: [],
        updates: [],
        collectedAt: new Date(),
        durationMs: Date.now() - startTime,
      };
    }

    // 2. Collect metrics per platform
    const twitterPosts = publishedPosts.filter(p => p.platform === 'twitter');
    const linkedinPosts = publishedPosts.filter(p => p.platform === 'linkedin');

    // 3. Fetch Twitter metrics
    if (twitterPosts.length > 0) {
      const twitterUpdates = await collectTwitterMetrics(twitterPosts);
      updates.push(...twitterUpdates.updates);
      errors.push(...twitterUpdates.errors);
    }

    // 4. LinkedIn metrics (placeholder — API limitations)
    if (linkedinPosts.length > 0) {
      logger.info('[MetricsCollector] LinkedIn metrics collection not yet supported', {
        count: linkedinPosts.length,
      });
    }

    // 5. Write performance summary to MemoryVault for cross-agent analysis
    if (updates.length > 0) {
      writePerformanceToMemoryVault(updates);
    }

    const result: MetricsCollectionResult = {
      success: errors.length === 0,
      postsScanned: publishedPosts.length,
      postsUpdated: updates.length,
      errors,
      updates,
      collectedAt: new Date(),
      durationMs: Date.now() - startTime,
    };

    logger.info('[MetricsCollector] Collection complete', {
      postsScanned: result.postsScanned,
      postsUpdated: result.postsUpdated,
      errors: result.errors.length,
      durationMs: result.durationMs,
    });

    return result;
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    logger.error('[MetricsCollector] Collection failed', error instanceof Error ? error : new Error(errorMsg));

    return {
      success: false,
      postsScanned: 0,
      postsUpdated: updates.length,
      errors: [errorMsg],
      updates,
      collectedAt: new Date(),
      durationMs: Date.now() - startTime,
    };
  }
}

// ============================================================================
// PLATFORM-SPECIFIC COLLECTORS
// ============================================================================

/**
 * Collect metrics from Twitter for published posts.
 * Uses getTimeline() which returns public_metrics per tweet.
 */
async function collectTwitterMetrics(
  posts: SocialMediaPost[]
): Promise<{ updates: PostMetricsUpdate[]; errors: string[] }> {
  const updates: PostMetricsUpdate[] = [];
  const errors: string[] = [];

  const twitterService = await createTwitterService();
  if (!twitterService) {
    errors.push('Twitter service not configured — cannot collect metrics');
    return { updates, errors };
  }

  try {
    // Fetch recent timeline with public_metrics
    const timeline = await twitterService.getTimeline({
      maxResults: 100,
      excludeReplies: false,
      excludeRetweets: true,
    });

    if (timeline.error) {
      errors.push(`Twitter timeline fetch error: ${timeline.error}`);
      return { updates, errors };
    }

    // Build a lookup map: tweetId → tweet with metrics
    const tweetMap = new Map(
      timeline.tweets.map(tweet => [tweet.id, tweet])
    );

    // Match stored posts to timeline tweets by platformPostId
    for (const post of posts) {
      if (!post.platformPostId) { continue; }

      const tweet = tweetMap.get(post.platformPostId);
      if (!tweet?.publicMetrics) { continue; }

      const currentMetrics: PostMetrics = {
        impressions: tweet.publicMetrics.impressionCount ?? 0,
        engagements: (tweet.publicMetrics.likeCount ?? 0) +
          (tweet.publicMetrics.retweetCount ?? 0) +
          (tweet.publicMetrics.replyCount ?? 0) +
          (tweet.publicMetrics.quoteCount ?? 0),
        likes: tweet.publicMetrics.likeCount ?? 0,
        comments: tweet.publicMetrics.replyCount ?? 0,
        shares: (tweet.publicMetrics.retweetCount ?? 0) + (tweet.publicMetrics.quoteCount ?? 0),
        clicks: 0, // Twitter API v2 doesn't return click data in public_metrics
      };

      const previousMetrics = post.metrics;
      const delta = calculateDelta(previousMetrics, currentMetrics);

      // Update the post in Firestore with new metrics
      await updatePostMetrics(post.id, currentMetrics);

      // Store historical snapshot
      await storeMetricsSnapshot({
        postId: post.id,
        platformPostId: post.platformPostId,
        platform: 'twitter',
        metrics: currentMetrics,
        collectedAt: new Date(),
      });

      updates.push({
        postId: post.id,
        platform: 'twitter',
        platformPostId: post.platformPostId,
        previousMetrics,
        currentMetrics,
        delta,
        updatedAt: new Date(),
      });
    }

    logger.info('[MetricsCollector] Twitter metrics collected', {
      postsMatched: updates.length,
      totalTimelineTweets: timeline.tweets.length,
      totalStoredPosts: posts.length,
    });
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    errors.push(`Twitter metrics collection error: ${errorMsg}`);
    logger.error('[MetricsCollector] Twitter collection error', error instanceof Error ? error : new Error(errorMsg));
  }

  return { updates, errors };
}

// ============================================================================
// FIRESTORE OPERATIONS
// ============================================================================

/** Fetch all published posts that have a platformPostId */
async function getPublishedPostsWithPlatformIds(): Promise<SocialMediaPost[]> {
  try {
    const { where } = await import('firebase/firestore');
    const posts = await FirestoreService.getAll<SocialMediaPost>(
      `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/${SOCIAL_POSTS_COLLECTION}`,
      [where('status', '==', 'published')]
    );

    // Filter to only posts with a platformPostId
    return posts.filter(p => !!p.platformPostId);
  } catch (error) {
    logger.error('[MetricsCollector] Failed to fetch published posts',
      error instanceof Error ? error : new Error(String(error)));
    return [];
  }
}

/** Update a post's metrics in Firestore */
async function updatePostMetrics(postId: string, metrics: PostMetrics): Promise<void> {
  await FirestoreService.update(
    `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/${SOCIAL_POSTS_COLLECTION}`,
    postId,
    {
      metrics,
      updatedAt: new Date(),
    }
  );
}

/** Store a historical metrics snapshot */
async function storeMetricsSnapshot(snapshot: MetricsSnapshot): Promise<void> {
  const snapshotId = `snapshot_${snapshot.postId}_${Date.now()}`;
  await FirestoreService.set(
    `${COLLECTIONS.ORGANIZATIONS}/${DEFAULT_ORG_ID}/${METRICS_SNAPSHOTS_COLLECTION}`,
    snapshotId,
    {
      ...snapshot,
      id: snapshotId,
    }
  );
}

// ============================================================================
// MEMORY VAULT INTEGRATION
// ============================================================================

/** Write aggregated performance data to MemoryVault for GROWTH_ANALYST */
function writePerformanceToMemoryVault(updates: PostMetricsUpdate[]): void {
  try {
    const vault = getMemoryVault();

    // Aggregate metrics across all updated posts
    const totalImpressions = updates.reduce((sum, u) => sum + (u.currentMetrics.impressions ?? 0), 0);
    const totalEngagements = updates.reduce((sum, u) => sum + (u.currentMetrics.engagements ?? 0), 0);
    const totalLikes = updates.reduce((sum, u) => sum + (u.currentMetrics.likes ?? 0), 0);
    const totalComments = updates.reduce((sum, u) => sum + (u.currentMetrics.comments ?? 0), 0);
    const totalShares = updates.reduce((sum, u) => sum + (u.currentMetrics.shares ?? 0), 0);

    const engagementRate = totalImpressions > 0
      ? (totalEngagements / totalImpressions) * 100
      : 0;

    // Find top performer
    const topPerformer = updates.reduce<PostMetricsUpdate | null>((best, current) => {
      if (!best) { return current; }
      return (current.currentMetrics.engagements ?? 0) > (best.currentMetrics.engagements ?? 0)
        ? current
        : best;
    }, null);

    vault.write(
      'PERFORMANCE',
      `social_metrics_${Date.now()}`,
      {
        collectedAt: new Date().toISOString(),
        postsAnalyzed: updates.length,
        aggregate: {
          totalImpressions,
          totalEngagements,
          totalLikes,
          totalComments,
          totalShares,
          engagementRate: Math.round(engagementRate * 100) / 100,
        },
        topPerformer: topPerformer ? {
          postId: topPerformer.postId,
          platformPostId: topPerformer.platformPostId,
          platform: topPerformer.platform,
          engagements: topPerformer.currentMetrics.engagements,
          impressions: topPerformer.currentMetrics.impressions,
        } : null,
        perPost: updates.map(u => ({
          postId: u.postId,
          platform: u.platform,
          metrics: u.currentMetrics,
          delta: u.delta,
        })),
      },
      'METRICS_COLLECTOR',
      {
        priority: 'MEDIUM',
        tags: ['social', 'metrics', 'performance', 'engagement'],
      }
    );

    logger.info('[MetricsCollector] Performance data written to MemoryVault', {
      postsAnalyzed: updates.length,
      engagementRate: `${Math.round(engagementRate * 100) / 100}%`,
    });
  } catch (error) {
    logger.error('[MetricsCollector] Failed to write to MemoryVault',
      error instanceof Error ? error : new Error(String(error)));
  }
}

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/** Calculate delta between two metric snapshots */
function calculateDelta(
  previous: PostMetrics | undefined,
  current: PostMetrics
): PostMetricsDelta {
  return {
    impressions: (current.impressions ?? 0) - (previous?.impressions ?? 0),
    engagements: (current.engagements ?? 0) - (previous?.engagements ?? 0),
    likes: (current.likes ?? 0) - (previous?.likes ?? 0),
    comments: (current.comments ?? 0) - (previous?.comments ?? 0),
    shares: (current.shares ?? 0) - (previous?.shares ?? 0),
    clicks: (current.clicks ?? 0) - (previous?.clicks ?? 0),
  };
}
