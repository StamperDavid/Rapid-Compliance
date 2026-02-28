/**
 * Growth Strategist Data Aggregator
 * STATUS: FUNCTIONAL
 *
 * Utility service that pulls from all analytics sources and returns a
 * normalized BusinessSnapshot with all KPIs. Used by the Growth Strategist
 * to synthesize cross-domain business intelligence.
 *
 * Sources:
 * - MemoryVault PERFORMANCE entries (revenue, pipeline, win/loss)
 * - MemoryVault CONTENT entries (SEO, social engagement)
 * - MemoryVault WORKFLOW entries (automation metrics)
 *
 * Caches for 5 minutes to avoid redundant reads.
 *
 * @module agents/growth-strategist/data-aggregator
 */

import {
  getMemoryVault,
  type MemoryEntry,
} from '../shared/memory-vault';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ChannelMetrics {
  channel: string;
  visitors: number;
  leads: number;
  conversions: number;
  conversionRate: number;
  revenue: number;
  costPerAcquisition: number;
  roi: number;
}

export interface SEOSnapshot {
  organicTraffic: number;
  topKeywords: Array<{ keyword: string; position: number; trend: 'up' | 'down' | 'stable' }>;
  domainAuthority: number;
  backlinks: number;
  indexedPages: number;
}

export interface SocialSnapshot {
  totalFollowers: number;
  engagementRate: number;
  topPlatform: string;
  postsThisPeriod: number;
  reachThisPeriod: number;
  platforms: Array<{
    name: string;
    followers: number;
    engagement: number;
    posts: number;
  }>;
}

export interface EmailSnapshot {
  totalSubscribers: number;
  openRate: number;
  clickRate: number;
  unsubscribeRate: number;
  campaignsSent: number;
  conversionsFromEmail: number;
}

export interface RevenueSnapshot {
  mrr: number;
  arr: number;
  revenueGrowthRate: number;
  churnRate: number;
  ltv: number;
  averageOrderValue: number;
  totalCustomers: number;
  newCustomersThisPeriod: number;
}

export interface PipelineSnapshot {
  totalLeads: number;
  qualifiedLeads: number;
  activeDeals: number;
  dealsPipeline: number;
  winRate: number;
  avgDealCycledays: number;
  leadSources: Array<{ source: string; count: number; conversionRate: number }>;
}

export interface BusinessSnapshot {
  generatedAt: string;
  periodDays: number;
  revenue: RevenueSnapshot;
  pipeline: PipelineSnapshot;
  seo: SEOSnapshot;
  social: SocialSnapshot;
  email: EmailSnapshot;
  channels: ChannelMetrics[];
  topRecommendations: string[];
}

// ============================================================================
// CACHE
// ============================================================================

let cachedSnapshot: BusinessSnapshot | null = null;
let cacheTimestamp = 0;
let inflightRequest: Promise<BusinessSnapshot> | null = null;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// AGGREGATOR
// ============================================================================

/**
 * Aggregate data from all analytics sources into a single BusinessSnapshot.
 * Results are cached for 5 minutes.
 */
export function aggregateBusinessData(periodDays: number = 30): Promise<BusinessSnapshot> {
  const now = Date.now();

  // Return cached result if still fresh.
  if (cachedSnapshot !== null && (now - cacheTimestamp) < CACHE_TTL_MS) {
    return Promise.resolve(cachedSnapshot);
  }

  // Deduplicate concurrent callers — share the inflight promise.
  if (inflightRequest !== null) {
    return inflightRequest;
  }

  inflightRequest = fetchAndBuild(periodDays, now).finally(() => {
    inflightRequest = null;
  });

  return inflightRequest;
}

async function fetchAndBuild(periodDays: number, now: number): Promise<BusinessSnapshot> {
  logger.info('[DataAggregator] Aggregating business data', { periodDays });
  const vault = getMemoryVault();

  // Pull data from MemoryVault across all categories in parallel.
  const [performanceEntries, contentEntries, _workflowEntries] = await Promise.all([
    vault.query('GROWTH_STRATEGIST', {
      category: 'PERFORMANCE',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 100,
    }),
    vault.query('GROWTH_STRATEGIST', {
      category: 'CONTENT',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 100,
    }),
    vault.query('GROWTH_STRATEGIST', {
      category: 'WORKFLOW',
      sortBy: 'createdAt',
      sortOrder: 'desc',
      limit: 50,
    }),
  ]);

  const revenue = buildRevenueSnapshot(performanceEntries);
  const pipeline = buildPipelineSnapshot(performanceEntries);
  const seo = buildSEOSnapshot(contentEntries);
  const social = buildSocialSnapshot(contentEntries);
  const email = buildEmailSnapshot(contentEntries);
  const channels = buildChannelMetrics(performanceEntries);
  const topRecommendations = deriveRecommendations(revenue, pipeline, seo, social, email, channels);

  const snapshot: BusinessSnapshot = {
    generatedAt: new Date().toISOString(),
    periodDays,
    revenue,
    pipeline,
    seo,
    social,
    email,
    channels,
    topRecommendations,
  };

  cachedSnapshot = snapshot;
  cacheTimestamp = now;

  logger.info('[DataAggregator] Business snapshot generated', {
    channels: channels.length,
    recommendations: topRecommendations.length,
  });

  return snapshot;
}

/**
 * Force-clear the cache so the next aggregation re-reads all sources.
 */
export function clearAggregatorCache(): void {
  cachedSnapshot = null;
  cacheTimestamp = 0;
}

// ============================================================================
// BUILDERS
// ============================================================================

function buildRevenueSnapshot(entries: MemoryEntry[]): RevenueSnapshot {
  // Extract revenue data from PERFORMANCE entries
  const revenueEntries = entries.filter(
    e => typeof e.value === 'object' && e.value !== null && 'revenue' in (e.value as Record<string, unknown>)
  );

  if (revenueEntries.length === 0) {
    return {
      mrr: 0,
      arr: 0,
      revenueGrowthRate: 0,
      churnRate: 0,
      ltv: 0,
      averageOrderValue: 0,
      totalCustomers: 0,
      newCustomersThisPeriod: 0,
    };
  }

  const latest = revenueEntries[0]?.value as Record<string, unknown> | undefined;
  return {
    mrr: (latest?.mrr as number) ?? 0,
    arr: (latest?.arr as number) ?? 0,
    revenueGrowthRate: (latest?.revenueGrowthRate as number) ?? 0,
    churnRate: (latest?.churnRate as number) ?? 0,
    ltv: (latest?.ltv as number) ?? 0,
    averageOrderValue: (latest?.averageOrderValue as number) ?? 0,
    totalCustomers: (latest?.totalCustomers as number) ?? 0,
    newCustomersThisPeriod: (latest?.newCustomersThisPeriod as number) ?? 0,
  };
}

function buildPipelineSnapshot(entries: MemoryEntry[]): PipelineSnapshot {
  const pipelineEntries = entries.filter(
    e => typeof e.value === 'object' && e.value !== null && 'pipeline' in (e.value as Record<string, unknown>)
  );

  if (pipelineEntries.length === 0) {
    return {
      totalLeads: 0,
      qualifiedLeads: 0,
      activeDeals: 0,
      dealsPipeline: 0,
      winRate: 0,
      avgDealCycledays: 0,
      leadSources: [],
    };
  }

  const latest = pipelineEntries[0]?.value as Record<string, unknown> | undefined;
  const pipe = (latest?.pipeline as Record<string, unknown>) ?? {};
  return {
    totalLeads: (pipe.totalLeads as number) ?? 0,
    qualifiedLeads: (pipe.qualifiedLeads as number) ?? 0,
    activeDeals: (pipe.activeDeals as number) ?? 0,
    dealsPipeline: (pipe.dealsPipeline as number) ?? 0,
    winRate: (pipe.winRate as number) ?? 0,
    avgDealCycledays: (pipe.avgDealCycledays as number) ?? 0,
    leadSources: (pipe.leadSources as Array<{ source: string; count: number; conversionRate: number }>) ?? [],
  };
}

function buildSEOSnapshot(entries: MemoryEntry[]): SEOSnapshot {
  const seoEntries = entries.filter(
    e => typeof e.value === 'object' && e.value !== null && 'seo' in (e.value as Record<string, unknown>)
  );

  if (seoEntries.length === 0) {
    return {
      organicTraffic: 0,
      topKeywords: [],
      domainAuthority: 0,
      backlinks: 0,
      indexedPages: 0,
    };
  }

  const latest = seoEntries[0]?.value as Record<string, unknown> | undefined;
  const seo = (latest?.seo as Record<string, unknown>) ?? {};
  return {
    organicTraffic: (seo.organicTraffic as number) ?? 0,
    topKeywords: (seo.topKeywords as SEOSnapshot['topKeywords']) ?? [],
    domainAuthority: (seo.domainAuthority as number) ?? 0,
    backlinks: (seo.backlinks as number) ?? 0,
    indexedPages: (seo.indexedPages as number) ?? 0,
  };
}

function buildSocialSnapshot(entries: MemoryEntry[]): SocialSnapshot {
  const socialEntries = entries.filter(
    e => typeof e.value === 'object' && e.value !== null && 'social' in (e.value as Record<string, unknown>)
  );

  if (socialEntries.length === 0) {
    return {
      totalFollowers: 0,
      engagementRate: 0,
      topPlatform: 'none',
      postsThisPeriod: 0,
      reachThisPeriod: 0,
      platforms: [],
    };
  }

  const latest = socialEntries[0]?.value as Record<string, unknown> | undefined;
  const social = (latest?.social as Record<string, unknown>) ?? {};
  return {
    totalFollowers: (social.totalFollowers as number) ?? 0,
    engagementRate: (social.engagementRate as number) ?? 0,
    topPlatform: (social.topPlatform as string) ?? 'none',
    postsThisPeriod: (social.postsThisPeriod as number) ?? 0,
    reachThisPeriod: (social.reachThisPeriod as number) ?? 0,
    platforms: (social.platforms as SocialSnapshot['platforms']) ?? [],
  };
}

function buildEmailSnapshot(entries: MemoryEntry[]): EmailSnapshot {
  const emailEntries = entries.filter(
    e => typeof e.value === 'object' && e.value !== null && 'email' in (e.value as Record<string, unknown>)
  );

  if (emailEntries.length === 0) {
    return {
      totalSubscribers: 0,
      openRate: 0,
      clickRate: 0,
      unsubscribeRate: 0,
      campaignsSent: 0,
      conversionsFromEmail: 0,
    };
  }

  const latest = emailEntries[0]?.value as Record<string, unknown> | undefined;
  const email = (latest?.email as Record<string, unknown>) ?? {};
  return {
    totalSubscribers: (email.totalSubscribers as number) ?? 0,
    openRate: (email.openRate as number) ?? 0,
    clickRate: (email.clickRate as number) ?? 0,
    unsubscribeRate: (email.unsubscribeRate as number) ?? 0,
    campaignsSent: (email.campaignsSent as number) ?? 0,
    conversionsFromEmail: (email.conversionsFromEmail as number) ?? 0,
  };
}

function buildChannelMetrics(entries: MemoryEntry[]): ChannelMetrics[] {
  const channelEntries = entries.filter(
    e => typeof e.value === 'object' && e.value !== null && 'channels' in (e.value as Record<string, unknown>)
  );

  if (channelEntries.length === 0) {
    return [];
  }

  const latest = channelEntries[0]?.value as Record<string, unknown> | undefined;
  return (latest?.channels as ChannelMetrics[]) ?? [];
}

function deriveRecommendations(
  revenue: RevenueSnapshot,
  pipeline: PipelineSnapshot,
  seo: SEOSnapshot,
  social: SocialSnapshot,
  email: EmailSnapshot,
  channels: ChannelMetrics[]
): string[] {
  const recommendations: string[] = [];

  // Revenue-based
  if (revenue.churnRate > 5) {
    recommendations.push('Churn rate is above 5% — investigate retention and implement win-back campaigns');
  }
  if (revenue.revenueGrowthRate < 0) {
    recommendations.push('Revenue is declining — review pricing strategy and sales pipeline');
  }

  // Pipeline-based
  if (pipeline.winRate < 20 && pipeline.totalLeads > 0) {
    recommendations.push('Win rate is below 20% — review lead qualification criteria and sales process');
  }
  if (pipeline.qualifiedLeads === 0 && pipeline.totalLeads > 10) {
    recommendations.push('Zero qualified leads despite volume — tighten ICP targeting');
  }

  // SEO-based
  if (seo.organicTraffic === 0) {
    recommendations.push('No organic traffic detected — prioritize SEO content strategy and keyword targeting');
  }

  // Social-based
  if (social.engagementRate < 1 && social.totalFollowers > 100) {
    recommendations.push('Social engagement below 1% — review content mix and posting times');
  }

  // Email-based
  if (email.openRate < 15 && email.campaignsSent > 0) {
    recommendations.push('Email open rate below 15% — test subject lines and clean email list');
  }

  // Channel-based
  const unprofitableChannels = channels.filter(c => c.roi < 0);
  if (unprofitableChannels.length > 0) {
    const names = unprofitableChannels.map(c => c.channel).join(', ');
    recommendations.push(`Negative ROI on: ${names} — reduce spend or improve conversion on these channels`);
  }

  if (recommendations.length === 0) {
    recommendations.push('All metrics within healthy ranges — continue current strategy and monitor for changes');
  }

  return recommendations;
}
