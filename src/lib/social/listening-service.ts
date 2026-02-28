/**
 * Social Listening Service
 * Monitors mentions, keywords, and hashtags across platforms.
 * Stores mentions in Firestore and runs sentiment analysis.
 *
 * Firestore paths:
 *   organizations/{PLATFORM_ID}/social_mentions/{mentionId}
 *   organizations/{PLATFORM_ID}/settings/social_listening_config
 */

import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';
import { createTwitterService } from '@/lib/integrations/twitter-service';
import { analyzeSentimentBatch } from '@/lib/social/sentiment-analyzer';
import type {
  SocialMention,
  MentionStatus,
  MentionSentiment,
  ListeningConfig,
  SocialPlatform,
} from '@/types/social';

const MENTIONS_COLLECTION = 'social_mentions';
const SETTINGS_COLLECTION = 'settings';
const LISTENING_CONFIG_DOC = 'social_listening_config';

function mentionsPath(): string {
  return getSubCollection(MENTIONS_COLLECTION);
}

function settingsPath(): string {
  return getSubCollection(SETTINGS_COLLECTION);
}

const DEFAULT_LISTENING_CONFIG: ListeningConfig = {
  trackedKeywords: [],
  trackedHashtags: [],
  trackedCompetitors: [],
  sentimentAlertThreshold: 30,
  pollingIntervalMinutes: 30,
  enabledPlatforms: ['twitter'],
};

export class ListeningService {
  /**
   * Get the listening configuration
   */
  static async getConfig(): Promise<ListeningConfig> {
    try {
      const saved = await FirestoreService.get<ListeningConfig>(
        settingsPath(),
        LISTENING_CONFIG_DOC
      );
      return saved ? { ...DEFAULT_LISTENING_CONFIG, ...saved } : { ...DEFAULT_LISTENING_CONFIG };
    } catch (error) {
      logger.error('ListeningService: Failed to get config', error instanceof Error ? error : new Error(String(error)));
      return { ...DEFAULT_LISTENING_CONFIG };
    }
  }

  /**
   * Save listening configuration
   */
  static async saveConfig(config: Partial<ListeningConfig>): Promise<ListeningConfig> {
    const current = await this.getConfig();
    const updated: ListeningConfig = {
      ...current,
      ...config,
      updatedAt: new Date().toISOString(),
    };

    await FirestoreService.set(settingsPath(), LISTENING_CONFIG_DOC, updated);
    return updated;
  }

  /**
   * Collect mentions from all enabled platforms (called by cron)
   */
  static async collectMentions(): Promise<{ collected: number; errors: string[] }> {
    const config = await this.getConfig();
    let collected = 0;
    const errors: string[] = [];

    if (config.trackedKeywords.length === 0 && config.trackedHashtags.length === 0) {
      logger.info('ListeningService: No keywords or hashtags configured, skipping collection');
      return { collected: 0, errors: [] };
    }

    // Collect from Twitter
    if (config.enabledPlatforms.includes('twitter')) {
      try {
        const twitterResult = await this.collectFromTwitter(config);
        collected += twitterResult;
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Twitter collection failed';
        errors.push(msg);
        logger.error('ListeningService: Twitter collection error', error instanceof Error ? error : new Error(msg));
      }
    }

    logger.info('ListeningService: Collection complete', { collected, errors: errors.length });
    return { collected, errors };
  }

  /**
   * Collect mentions from Twitter using search API
   */
  private static async collectFromTwitter(config: ListeningConfig): Promise<number> {
    const twitterService = await createTwitterService();
    if (!twitterService) {
      logger.warn('ListeningService: Twitter service not configured');
      return 0;
    }

    // Build search query from keywords and hashtags
    const queryParts: string[] = [];

    for (const keyword of config.trackedKeywords) {
      queryParts.push(`"${keyword}"`);
    }
    for (const hashtag of config.trackedHashtags) {
      const tag = hashtag.startsWith('#') ? hashtag : `#${hashtag}`;
      queryParts.push(tag);
    }
    for (const competitor of config.trackedCompetitors) {
      queryParts.push(`@${competitor.replace(/^@/, '')}`);
    }

    if (queryParts.length === 0) {return 0;}

    // Twitter search API limits query length
    const searchQuery = queryParts.join(' OR ').substring(0, 512);

    const { tweets, error } = await twitterService.searchRecentTweets(searchQuery, {
      maxResults: 50,
      startTime: new Date(Date.now() - config.pollingIntervalMinutes * 60 * 1000),
    });

    if (error) {
      logger.warn('ListeningService: Twitter search error', { error });
      return 0;
    }

    if (tweets.length === 0) {return 0;}

    // Run batch sentiment analysis
    const textsForAnalysis = tweets.map((t) => ({ id: t.id, content: t.text }));
    const sentimentResults = await analyzeSentimentBatch(textsForAnalysis);

    // Store mentions
    let stored = 0;
    for (const tweet of tweets) {
      // Check if we already have this mention
      const existing = await FirestoreService.get(mentionsPath(), `twitter-${tweet.id}`);
      if (existing) {continue;}

      const sentimentResult = sentimentResults.get(tweet.id);

      // Determine which keywords matched
      const matchedKeywords: string[] = [];
      const tweetLower = tweet.text.toLowerCase();
      for (const kw of [...config.trackedKeywords, ...config.trackedHashtags]) {
        if (tweetLower.includes(kw.toLowerCase())) {
          matchedKeywords.push(kw);
        }
      }

      // Determine mention type
      let mentionType: 'direct_mention' | 'keyword_match' | 'hashtag_match' = 'keyword_match';
      if (matchedKeywords.some((kw) => kw.startsWith('#'))) {
        mentionType = 'hashtag_match';
      }
      // Check for direct @mentions of our accounts
      if (tweet.entities?.mentions?.some((m) => config.trackedCompetitors.includes(m.username))) {
        mentionType = 'direct_mention';
      }

      const mention: SocialMention = {
        id: `twitter-${tweet.id}`,
        platform: 'twitter',
        externalId: tweet.id,
        authorName: tweet.authorId, // Would need user lookup for display name
        authorHandle: tweet.authorId,
        content: tweet.text,
        sentiment: sentimentResult?.sentiment ?? 'unknown',
        sentimentConfidence: sentimentResult?.confidence,
        keyPhrases: sentimentResult?.keyPhrases,
        matchedKeywords,
        mentionType,
        sourceUrl: `https://twitter.com/i/web/status/${tweet.id}`,
        detectedAt: new Date().toISOString(),
        status: 'new',
        engagementMetrics: tweet.publicMetrics ? {
          likes: tweet.publicMetrics.likeCount,
          comments: tweet.publicMetrics.replyCount,
          shares: tweet.publicMetrics.retweetCount,
          impressions: tweet.publicMetrics.impressionCount,
        } : undefined,
      };

      await FirestoreService.set(mentionsPath(), mention.id, mention, false);
      stored++;
    }

    logger.info('ListeningService: Twitter mentions stored', { stored, total: tweets.length });
    return stored;
  }

  /**
   * List mentions with filters
   */
  static async listMentions(filters?: {
    platform?: SocialPlatform;
    sentiment?: MentionSentiment;
    status?: MentionStatus;
    limit?: number;
  }): Promise<SocialMention[]> {
    try {
      const { where, orderBy, limit } = await import('firebase/firestore');
      const constraints = [];

      if (filters?.platform) {
        constraints.push(where('platform', '==', filters.platform));
      }
      if (filters?.sentiment) {
        constraints.push(where('sentiment', '==', filters.sentiment));
      }
      if (filters?.status) {
        constraints.push(where('status', '==', filters.status));
      }

      constraints.push(orderBy('detectedAt', 'desc'));

      if (filters?.limit) {
        constraints.push(limit(filters.limit));
      }

      return await FirestoreService.getAll<SocialMention>(mentionsPath(), constraints);
    } catch (error) {
      logger.error('ListeningService: Failed to list mentions', error instanceof Error ? error : new Error(String(error)));
      return [];
    }
  }

  /**
   * Update mention status
   */
  static async updateMentionStatus(
    mentionId: string,
    status: MentionStatus
  ): Promise<boolean> {
    try {
      await FirestoreService.update(mentionsPath(), mentionId, { status });
      return true;
    } catch (error) {
      logger.error('ListeningService: Failed to update mention', error instanceof Error ? error : new Error(String(error)));
      return false;
    }
  }

  /**
   * Get sentiment breakdown for stats
   */
  static async getSentimentBreakdown(): Promise<{
    positive: number;
    neutral: number;
    negative: number;
    unknown: number;
    total: number;
  }> {
    try {
      const mentions = await FirestoreService.getAll<SocialMention>(mentionsPath());
      const breakdown = { positive: 0, neutral: 0, negative: 0, unknown: 0, total: mentions.length };

      for (const m of mentions) {
        breakdown[m.sentiment] = (breakdown[m.sentiment] ?? 0) + 1;
      }

      return breakdown;
    } catch (error) {
      logger.error('ListeningService: Failed to get breakdown', error instanceof Error ? error : new Error(String(error)));
      return { positive: 0, neutral: 0, negative: 0, unknown: 0, total: 0 };
    }
  }
}
