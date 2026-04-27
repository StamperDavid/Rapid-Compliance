/**
 * Social Metrics Service
 *
 * Aggregates per-platform and cross-platform social metrics from the
 * `social_posts` Firestore collection (status='published' only). Backs
 * the Social Hub overview and per-platform rollup endpoints.
 *
 * Defensive query pattern (matches the engagement route):
 *   Single-field `where` only, no composite `orderBy` — that combination
 *   would require a Firestore composite index that isn't deployed. We
 *   pull all published posts and slice/sort/group in JS. Result sets are
 *   bounded by tenant size and any tenant we care about has < 10k
 *   published posts, so the in-process work is trivial.
 *
 * @module social/metrics-service
 */

import { logger } from '@/lib/logger/logger';
import { AdminFirestoreService } from '@/lib/db/admin-firestore-service';
import { getSubCollection } from '@/lib/firebase/collections';
import type {
  PostMetrics,
  SocialMediaPost,
  SocialPlatform,
} from '@/types/social';

const SOCIAL_POSTS_COLLECTION = getSubCollection('social_posts');

// ============================================================================
// PUBLIC TYPES
// ============================================================================

export interface SocialMetricsTotals {
  postsToday: number;
  postsThisWeek: number;
  postsThisMonth: number;
  totalImpressions: number;
  totalEngagements: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
}

export interface SocialMetricsByPlatform {
  platform: string;
  posts: number;
  impressions: number;
  engagements: number;
}

export interface SocialMetricsTrendPoint {
  date: string;
  posts: number;
  engagements: number;
}

export interface SocialMetricsOverview {
  totals: SocialMetricsTotals;
  byPlatform: SocialMetricsByPlatform[];
  trend: SocialMetricsTrendPoint[];
}

export interface SocialMetricsPlatformPostSummary {
  id: string;
  content: string;
  publishedAt: string | null;
  metrics: PostMetrics;
}

export interface SocialMetricsPlatformOverview {
  platform: string;
  totals: SocialMetricsTotals;
  recentPosts: SocialMetricsPlatformPostSummary[];
  trend: SocialMetricsTrendPoint[];
}

// ============================================================================
// PUBLIC API
// ============================================================================

/**
 * Cross-platform overview — totals, by-platform breakdown, 30-day trend.
 */
export async function getSocialMetricsOverview(): Promise<SocialMetricsOverview> {
  const published = await loadPublishedPosts();
  const totals = computeTotals(published);
  const byPlatform = computeByPlatform(published);
  const trend = computeTrend(published, 30);

  return { totals, byPlatform, trend };
}

/**
 * Per-platform overview — totals, recent posts (limit 20), 30-day trend.
 */
export async function getSocialMetricsForPlatform(
  platform: SocialPlatform,
): Promise<SocialMetricsPlatformOverview> {
  const allPublished = await loadPublishedPosts();
  const filtered = allPublished.filter((p) => p.platform === platform);

  const totals = computeTotals(filtered);
  const trend = computeTrend(filtered, 30);
  const recentPosts = computeRecentPosts(filtered, 20);

  return {
    platform,
    totals,
    recentPosts,
    trend,
  };
}

// ============================================================================
// INTERNAL
// ============================================================================

async function loadPublishedPosts(): Promise<SocialMediaPost[]> {
  try {
    const { where } = await import('firebase/firestore');
    const docs = (await AdminFirestoreService.getAll(
      SOCIAL_POSTS_COLLECTION,
      [where('status', '==', 'published')],
    ).catch(() => [])) as SocialMediaPost[];
    return docs;
  } catch (error) {
    logger.error(
      '[SocialMetricsService] loadPublishedPosts failed',
      error instanceof Error ? error : new Error(String(error)),
    );
    return [];
  }
}

function publishedAtTimestamp(p: SocialMediaPost): number {
  if (!p.publishedAt) { return 0; }
  const t = new Date(p.publishedAt as unknown as string).getTime();
  return Number.isFinite(t) ? t : 0;
}

function isAfter(p: SocialMediaPost, since: number): boolean {
  return publishedAtTimestamp(p) >= since;
}

function startOfDay(d: Date): Date {
  const out = new Date(d);
  out.setHours(0, 0, 0, 0);
  return out;
}

function isoDayKey(timestampMs: number): string {
  const d = new Date(timestampMs);
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(d.getUTCDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function computeTotals(posts: SocialMediaPost[]): SocialMetricsTotals {
  const now = Date.now();
  const startOfToday = startOfDay(new Date()).getTime();
  const sevenDaysAgo = now - 7 * 24 * 60 * 60 * 1000;
  const thirtyDaysAgo = now - 30 * 24 * 60 * 60 * 1000;

  let postsToday = 0;
  let postsThisWeek = 0;
  let postsThisMonth = 0;
  let totalImpressions = 0;
  let totalEngagements = 0;
  let totalLikes = 0;
  let totalComments = 0;
  let totalShares = 0;

  for (const p of posts) {
    if (isAfter(p, startOfToday)) { postsToday++; }
    if (isAfter(p, sevenDaysAgo)) { postsThisWeek++; }
    if (isAfter(p, thirtyDaysAgo)) { postsThisMonth++; }

    const m = p.metrics;
    if (!m) { continue; }
    totalImpressions += m.impressions ?? 0;
    totalEngagements += m.engagements ?? 0;
    totalLikes += m.likes ?? 0;
    totalComments += m.comments ?? 0;
    totalShares += m.shares ?? 0;
  }

  const engagementRate = totalImpressions > 0
    ? Math.round((totalEngagements / totalImpressions) * 10000) / 100
    : 0;

  return {
    postsToday,
    postsThisWeek,
    postsThisMonth,
    totalImpressions,
    totalEngagements,
    totalLikes,
    totalComments,
    totalShares,
    engagementRate,
  };
}

function computeByPlatform(posts: SocialMediaPost[]): SocialMetricsByPlatform[] {
  const acc = new Map<string, SocialMetricsByPlatform>();
  for (const p of posts) {
    const key = p.platform;
    let entry = acc.get(key);
    if (!entry) {
      entry = { platform: key, posts: 0, impressions: 0, engagements: 0 };
      acc.set(key, entry);
    }
    entry.posts++;
    if (p.metrics) {
      entry.impressions += p.metrics.impressions ?? 0;
      entry.engagements += p.metrics.engagements ?? 0;
    }
  }
  return Array.from(acc.values()).sort((a, b) => b.posts - a.posts);
}

function computeTrend(posts: SocialMediaPost[], days: number): SocialMetricsTrendPoint[] {
  const buckets = new Map<string, { posts: number; engagements: number }>();
  const now = Date.now();
  const horizon = now - days * 24 * 60 * 60 * 1000;

  // Pre-seed buckets for every day in the window so the result is dense.
  for (let i = 0; i < days; i++) {
    const ts = now - i * 24 * 60 * 60 * 1000;
    buckets.set(isoDayKey(ts), { posts: 0, engagements: 0 });
  }

  for (const p of posts) {
    const ts = publishedAtTimestamp(p);
    if (ts < horizon || ts > now) { continue; }
    const key = isoDayKey(ts);
    const entry = buckets.get(key);
    if (!entry) { continue; }
    entry.posts++;
    entry.engagements += p.metrics?.engagements ?? 0;
  }

  return Array.from(buckets.entries())
    .map(([date, v]) => ({ date, posts: v.posts, engagements: v.engagements }))
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

function computeRecentPosts(
  posts: SocialMediaPost[],
  limit: number,
): SocialMetricsPlatformPostSummary[] {
  const sorted = [...posts].sort((a, b) => publishedAtTimestamp(b) - publishedAtTimestamp(a));
  return sorted.slice(0, limit).map((p) => ({
    id: p.id,
    content: (p.content ?? '').slice(0, 200),
    publishedAt: p.publishedAt
      ? new Date(p.publishedAt as unknown as string).toISOString()
      : null,
    metrics: p.metrics ?? {
      impressions: 0,
      engagements: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      clicks: 0,
      reach: 0,
    },
  }));
}
