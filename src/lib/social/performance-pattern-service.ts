/**
 * Performance Pattern Detection Service
 * Analyzes published social media posts with engagement metrics to identify
 * content patterns that correlate with higher performance.
 *
 * Detects patterns in:
 *  - Content length vs engagement
 *  - Hashtag usage vs reach
 *  - Time of day vs engagement
 *  - Platform-specific performance
 *  - CTA presence vs clicks
 *  - Emoji usage vs engagement
 *  - Content structure (questions, lists, stories)
 */

import type { PlaybookPerformancePattern } from '@/types/agent-memory';
import type { SocialMediaPost, PostMetrics, SocialPlatform } from '@/types/social';
import { FirestoreService } from '@/lib/db/firestore-service';
import { logger } from '@/lib/logger/logger';
import { getSubCollection } from '@/lib/firebase/collections';

const SOCIAL_POSTS_COLLECTION = 'social_posts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AnalyzablePost {
  id: string;
  platform: SocialPlatform;
  content: string;
  metrics: PostMetrics;
  publishedAt: string;
}

export interface PerformanceAnalysisResult {
  patterns: PlaybookPerformancePattern[];
  postsAnalyzed: number;
  analyzedAt: string;
}

// ---------------------------------------------------------------------------
// Main Analysis Function
// ---------------------------------------------------------------------------

/**
 * Analyze published posts to detect performance patterns.
 * Requires at least 5 posts with metrics to generate meaningful patterns.
 */
export async function analyzePerformancePatterns(): Promise<PerformanceAnalysisResult> {
  logger.info('[Performance Patterns] Starting analysis', {
    file: 'performance-pattern-service.ts',
  });

  // Fetch published posts with metrics
  const { where, orderBy, limit } = await import('firebase/firestore');
  const posts = await FirestoreService.getAll<SocialMediaPost>(
    getSubCollection(SOCIAL_POSTS_COLLECTION),
    [
      where('status', '==', 'published'),
      orderBy('publishedAt', 'desc'),
      limit(200),
    ]
  );

  // Filter posts that have engagement metrics
  const analyzable: AnalyzablePost[] = posts
    .filter(p => p.metrics && (p.metrics.engagements ?? 0) > 0)
    .map(p => ({
      id: p.id,
      platform: p.platform,
      content: p.content,
      metrics: p.metrics as PostMetrics,
      publishedAt: p.publishedAt instanceof Date
        ? p.publishedAt.toISOString()
        : String(p.publishedAt),
    }));

  logger.info('[Performance Patterns] Posts with metrics', {
    total: posts.length,
    withMetrics: analyzable.length,
    file: 'performance-pattern-service.ts',
  });

  if (analyzable.length < 5) {
    return {
      patterns: [],
      postsAnalyzed: analyzable.length,
      analyzedAt: new Date().toISOString(),
    };
  }

  const patterns: PlaybookPerformancePattern[] = [];

  // Run all pattern detectors
  patterns.push(...detectLengthPatterns(analyzable));
  patterns.push(...detectHashtagPatterns(analyzable));
  patterns.push(...detectTimePatterns(analyzable));
  patterns.push(...detectPlatformPatterns(analyzable));
  patterns.push(...detectStructurePatterns(analyzable));
  patterns.push(...detectEmojiPatterns(analyzable));

  // Sort by confidence descending
  patterns.sort((a, b) => b.confidence - a.confidence);

  logger.info('[Performance Patterns] Analysis complete', {
    postsAnalyzed: analyzable.length,
    patternsFound: patterns.length,
    file: 'performance-pattern-service.ts',
  });

  return {
    patterns,
    postsAnalyzed: analyzable.length,
    analyzedAt: new Date().toISOString(),
  };
}

// ---------------------------------------------------------------------------
// Pattern Detectors
// ---------------------------------------------------------------------------

function detectLengthPatterns(posts: AnalyzablePost[]): PlaybookPerformancePattern[] {
  const patterns: PlaybookPerformancePattern[] = [];
  const now = new Date().toISOString();

  // Split posts into short/medium/long
  const short = posts.filter(p => p.content.length < 100);
  const medium = posts.filter(p => p.content.length >= 100 && p.content.length < 250);
  const long = posts.filter(p => p.content.length >= 250);

  const avgEngagement = (group: AnalyzablePost[]) => {
    if (group.length === 0) { return 0; }
    return group.reduce((sum, p) => sum + (p.metrics.engagements ?? 0), 0) / group.length;
  };

  const shortAvg = avgEngagement(short);
  const medAvg = avgEngagement(medium);
  const longAvg = avgEngagement(long);

  // Find the best performing length bracket
  const brackets = [
    { label: 'Short posts (under 100 chars)', avg: shortAvg, count: short.length },
    { label: 'Medium posts (100-250 chars)', avg: medAvg, count: medium.length },
    { label: 'Long posts (250+ chars)', avg: longAvg, count: long.length },
  ].filter(b => b.count >= 3);

  if (brackets.length >= 2) {
    const best = brackets.reduce((a, b) => a.avg > b.avg ? a : b);
    const overall = avgEngagement(posts);

    if (best.avg > overall * 1.2) {
      patterns.push({
        id: `perf_length_${Date.now()}`,
        pattern: `${best.label} get ${Math.round((best.avg / overall) * 100 - 100)}% more engagement than average`,
        metric: 'engagements',
        value: Math.round(best.avg * 10) / 10,
        sampleSize: best.count,
        confidence: Math.min(0.9, best.count / posts.length + 0.3),
        discoveredAt: now,
      });
    }
  }

  return patterns;
}

function detectHashtagPatterns(posts: AnalyzablePost[]): PlaybookPerformancePattern[] {
  const patterns: PlaybookPerformancePattern[] = [];
  const now = new Date().toISOString();

  const hashtagPattern = /#\w+/g;

  const withHashtags = posts.filter(p => hashtagPattern.test(p.content));
  const withoutHashtags = posts.filter(p => !hashtagPattern.test(p.content));

  // Reset regex state
  const countHashtags = (content: string) => (content.match(/#\w+/g) ?? []).length;

  if (withHashtags.length >= 3 && withoutHashtags.length >= 3) {
    const avgWith = withHashtags.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / withHashtags.length;
    const avgWithout = withoutHashtags.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / withoutHashtags.length;

    if (avgWith > avgWithout * 1.15) {
      patterns.push({
        id: `perf_hashtags_yes_${Date.now()}`,
        pattern: `Posts with hashtags get ${Math.round((avgWith / avgWithout) * 100 - 100)}% more engagement`,
        metric: 'engagements',
        value: Math.round(avgWith * 10) / 10,
        sampleSize: withHashtags.length,
        confidence: Math.min(0.85, (withHashtags.length + withoutHashtags.length) / (posts.length * 2) + 0.3),
        discoveredAt: now,
      });
    } else if (avgWithout > avgWith * 1.15) {
      patterns.push({
        id: `perf_hashtags_no_${Date.now()}`,
        pattern: `Posts without hashtags get ${Math.round((avgWithout / avgWith) * 100 - 100)}% more engagement`,
        metric: 'engagements',
        value: Math.round(avgWithout * 10) / 10,
        sampleSize: withoutHashtags.length,
        confidence: Math.min(0.85, (withHashtags.length + withoutHashtags.length) / (posts.length * 2) + 0.3),
        discoveredAt: now,
      });
    }
  }

  // Optimal hashtag count
  const fewHashtags = posts.filter(p => { const c = countHashtags(p.content); return c >= 1 && c <= 3; });
  const manyHashtags = posts.filter(p => countHashtags(p.content) > 3);

  if (fewHashtags.length >= 3 && manyHashtags.length >= 3) {
    const avgFew = fewHashtags.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / fewHashtags.length;
    const avgMany = manyHashtags.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / manyHashtags.length;

    if (avgFew > avgMany * 1.2) {
      patterns.push({
        id: `perf_hashtags_count_${Date.now()}`,
        pattern: 'Posts with 1-3 hashtags outperform posts with 4+ hashtags',
        metric: 'engagements',
        value: Math.round(avgFew * 10) / 10,
        sampleSize: fewHashtags.length,
        confidence: 0.6,
        discoveredAt: now,
      });
    }
  }

  return patterns;
}

function detectTimePatterns(posts: AnalyzablePost[]): PlaybookPerformancePattern[] {
  const patterns: PlaybookPerformancePattern[] = [];
  const now = new Date().toISOString();

  // Group by hour of day
  const byHour = new Map<number, { posts: AnalyzablePost[]; totalEngagement: number }>();

  for (const post of posts) {
    try {
      const hour = new Date(post.publishedAt).getHours();
      const existing = byHour.get(hour) ?? { posts: [], totalEngagement: 0 };
      existing.posts.push(post);
      existing.totalEngagement += (post.metrics.engagements ?? 0);
      byHour.set(hour, existing);
    } catch {
      // Skip posts with invalid dates
    }
  }

  // Find best performing time window
  const timeWindows = [
    { label: 'Morning (6-10 AM)', hours: [6, 7, 8, 9, 10] },
    { label: 'Midday (11 AM-1 PM)', hours: [11, 12, 13] },
    { label: 'Afternoon (2-5 PM)', hours: [14, 15, 16, 17] },
    { label: 'Evening (6-9 PM)', hours: [18, 19, 20, 21] },
  ];

  const windowStats = timeWindows.map(window => {
    let totalEng = 0;
    let count = 0;
    for (const hour of window.hours) {
      const data = byHour.get(hour);
      if (data) {
        totalEng += data.totalEngagement;
        count += data.posts.length;
      }
    }
    return { ...window, avg: count > 0 ? totalEng / count : 0, count };
  }).filter(w => w.count >= 3);

  if (windowStats.length >= 2) {
    const best = windowStats.reduce((a, b) => a.avg > b.avg ? a : b);
    const overall = posts.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / posts.length;

    if (best.avg > overall * 1.2) {
      patterns.push({
        id: `perf_time_${Date.now()}`,
        pattern: `${best.label} posts get ${Math.round((best.avg / overall) * 100 - 100)}% more engagement`,
        metric: 'engagements',
        value: Math.round(best.avg * 10) / 10,
        sampleSize: best.count,
        confidence: Math.min(0.8, best.count / posts.length + 0.2),
        discoveredAt: now,
      });
    }
  }

  return patterns;
}

function detectPlatformPatterns(posts: AnalyzablePost[]): PlaybookPerformancePattern[] {
  const patterns: PlaybookPerformancePattern[] = [];
  const now = new Date().toISOString();

  // Group by platform
  const byPlatform = new Map<string, AnalyzablePost[]>();
  for (const post of posts) {
    const existing = byPlatform.get(post.platform) ?? [];
    existing.push(post);
    byPlatform.set(post.platform, existing);
  }

  const platformStats = [...byPlatform.entries()]
    .map(([platform, platformPosts]) => ({
      platform,
      avg: platformPosts.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / platformPosts.length,
      count: platformPosts.length,
    }))
    .filter(p => p.count >= 3)
    .sort((a, b) => b.avg - a.avg);

  if (platformStats.length >= 2) {
    const best = platformStats[0];
    const second = platformStats[1];

    if (best.avg > second.avg * 1.3) {
      patterns.push({
        id: `perf_platform_${Date.now()}`,
        pattern: `${best.platform} posts get ${Math.round((best.avg / second.avg) * 100 - 100)}% more engagement than ${second.platform}`,
        metric: 'engagements',
        value: Math.round(best.avg * 10) / 10,
        sampleSize: best.count,
        confidence: Math.min(0.85, (best.count + second.count) / posts.length + 0.2),
        discoveredAt: now,
      });
    }
  }

  return patterns;
}

function detectStructurePatterns(posts: AnalyzablePost[]): PlaybookPerformancePattern[] {
  const patterns: PlaybookPerformancePattern[] = [];
  const now = new Date().toISOString();

  // Questions vs statements
  const questions = posts.filter(p => p.content.includes('?'));
  const statements = posts.filter(p => !p.content.includes('?'));

  if (questions.length >= 3 && statements.length >= 3) {
    const avgQ = questions.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / questions.length;
    const avgS = statements.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / statements.length;

    if (avgQ > avgS * 1.2) {
      patterns.push({
        id: `perf_question_${Date.now()}`,
        pattern: `Posts with questions get ${Math.round((avgQ / avgS) * 100 - 100)}% more engagement`,
        metric: 'engagements',
        value: Math.round(avgQ * 10) / 10,
        sampleSize: questions.length,
        confidence: 0.65,
        discoveredAt: now,
      });
    }
  }

  // Lists (numbered or bulleted) vs narrative
  const listPattern = /\d\.\s|•|-\s/;
  const lists = posts.filter(p => listPattern.test(p.content));
  const narrative = posts.filter(p => !listPattern.test(p.content));

  if (lists.length >= 3 && narrative.length >= 3) {
    const avgL = lists.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / lists.length;
    const avgN = narrative.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / narrative.length;

    if (avgL > avgN * 1.2) {
      patterns.push({
        id: `perf_list_${Date.now()}`,
        pattern: `List-format posts get ${Math.round((avgL / avgN) * 100 - 100)}% more engagement`,
        metric: 'engagements',
        value: Math.round(avgL * 10) / 10,
        sampleSize: lists.length,
        confidence: 0.6,
        discoveredAt: now,
      });
    }
  }

  // CTA presence
  const ctaPattern = /learn more|check out|click|visit|sign up|try|get started|link in bio|read more|find out/i;
  const withCTA = posts.filter(p => ctaPattern.test(p.content));
  const withoutCTA = posts.filter(p => !ctaPattern.test(p.content));

  if (withCTA.length >= 3 && withoutCTA.length >= 3) {
    const avgCTA = withCTA.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / withCTA.length;
    const avgNoCTA = withoutCTA.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / withoutCTA.length;

    if (avgCTA > avgNoCTA * 1.15) {
      patterns.push({
        id: `perf_cta_${Date.now()}`,
        pattern: `Posts with a CTA get ${Math.round((avgCTA / avgNoCTA) * 100 - 100)}% more engagement`,
        metric: 'engagements',
        value: Math.round(avgCTA * 10) / 10,
        sampleSize: withCTA.length,
        confidence: 0.6,
        discoveredAt: now,
      });
    }
  }

  return patterns;
}

function detectEmojiPatterns(posts: AnalyzablePost[]): PlaybookPerformancePattern[] {
  const patterns: PlaybookPerformancePattern[] = [];
  const now = new Date().toISOString();

  const emojiPattern = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}]/gu;

  const withEmoji = posts.filter(p => emojiPattern.test(p.content));
  // Reset regex lastIndex
  const withoutEmoji = posts.filter(p => {
    emojiPattern.lastIndex = 0;
    return !emojiPattern.test(p.content);
  });

  if (withEmoji.length >= 3 && withoutEmoji.length >= 3) {
    const avgWith = withEmoji.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / withEmoji.length;
    const avgWithout = withoutEmoji.reduce((s, p) => s + (p.metrics.engagements ?? 0), 0) / withoutEmoji.length;

    if (avgWith > avgWithout * 1.15) {
      patterns.push({
        id: `perf_emoji_yes_${Date.now()}`,
        pattern: `Posts with emojis get ${Math.round((avgWith / avgWithout) * 100 - 100)}% more engagement`,
        metric: 'engagements',
        value: Math.round(avgWith * 10) / 10,
        sampleSize: withEmoji.length,
        confidence: 0.55,
        discoveredAt: now,
      });
    } else if (avgWithout > avgWith * 1.15) {
      patterns.push({
        id: `perf_emoji_no_${Date.now()}`,
        pattern: `Posts without emojis get ${Math.round((avgWithout / avgWith) * 100 - 100)}% more engagement`,
        metric: 'engagements',
        value: Math.round(avgWithout * 10) / 10,
        sampleSize: withoutEmoji.length,
        confidence: 0.55,
        discoveredAt: now,
      });
    }
  }

  return patterns;
}

// ---------------------------------------------------------------------------
// Apply patterns to playbook
// ---------------------------------------------------------------------------

/**
 * Apply detected performance patterns to the active playbook.
 * Creates a new version with the patterns embedded.
 */
export async function applyPatternsToPlaybook(
  patterns: PlaybookPerformancePattern[]
): Promise<{ success: boolean; newVersion?: string }> {
  const { getActivePlaybook, savePlaybook, compilePlaybookPrompt } = await import('@/lib/social/golden-playbook-builder');
  const playbook = await getActivePlaybook();

  if (!playbook) {
    return { success: false };
  }

  // Merge new patterns (avoid duplicates by pattern text)
  const existingPatternTexts = new Set(playbook.performancePatterns.map(p => p.pattern));
  const newPatterns = patterns.filter(p => !existingPatternTexts.has(p.pattern));

  if (newPatterns.length === 0) {
    return { success: true, newVersion: playbook.version };
  }

  // Create updated playbook
  const updatedPlaybook = {
    ...playbook,
    performancePatterns: [...playbook.performancePatterns, ...newPatterns],
    updatedAt: new Date().toISOString(),
    compiledPrompt: '',
  };
  updatedPlaybook.compiledPrompt = compilePlaybookPrompt(updatedPlaybook);

  await savePlaybook(updatedPlaybook);

  logger.info('[Performance Patterns] Patterns applied to playbook', {
    playbookId: playbook.id,
    newPatternsAdded: newPatterns.length,
    file: 'performance-pattern-service.ts',
  });

  return { success: true, newVersion: playbook.version };
}
