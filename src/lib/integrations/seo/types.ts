/**
 * SEO Service Integration Types
 * TypeScript interfaces for all external SEO API responses
 */

// ============================================================================
// GENERIC WRAPPER
// ============================================================================

export interface SEOServiceResult<T> {
  success: boolean;
  data: T | null;
  error: string | null;
  source: 'pagespeed' | 'dataforseo' | 'serper' | 'gsc' | 'cache' | 'fallback';
  cached: boolean;
}

// ============================================================================
// PAGESPEED INSIGHTS
// ============================================================================

export interface CoreWebVitals {
  /** Largest Contentful Paint (ms) */
  lcp: number;
  /** First Input Delay (ms) */
  fid: number;
  /** Cumulative Layout Shift */
  cls: number;
  /** First Contentful Paint (ms) */
  fcp: number;
  /** Time to First Byte (ms) */
  ttfb: number;
  /** Total Blocking Time (ms) */
  tbt: number;
  /** Speed Index */
  speedIndex: number;
}

export interface PageSpeedResult {
  url: string;
  strategy: 'mobile' | 'desktop';
  performanceScore: number;
  accessibilityScore: number;
  bestPracticesScore: number;
  seoScore: number;
  coreWebVitals: CoreWebVitals;
  loadTime: number;
  totalByteWeight: number;
  recommendations: string[];
}

// ============================================================================
// DATAFORSEO
// ============================================================================

export interface DataForSEOKeywordData {
  keyword: string;
  searchVolume: number;
  cpc: number;
  competition: number;
  competitionLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  monthlySearches: Array<{ month: string; searchVolume: number }>;
}

export interface DataForSEOSerpResult {
  keyword: string;
  totalResults: number;
  items: Array<{
    position: number;
    domain: string;
    url: string;
    title: string;
    description: string;
  }>;
  serpFeatures: string[];
}

export interface DataForSEODomainMetrics {
  domain: string;
  organicTraffic: number;
  organicKeywords: number;
  backlinks: number;
  referringDomains: number;
  domainRank: number;
}

export interface DataForSEOOnPageResult {
  url: string;
  title: string | null;
  description: string | null;
  statusCode: number;
  contentLength: number;
  wordCount: number;
  internalLinks: number;
  externalLinks: number;
  images: number;
  imagesWithoutAlt: number;
  headings: Record<string, number>;
  checks: Record<string, boolean>;
}

// ============================================================================
// SERPER
// ============================================================================

export interface SerperSEOResult {
  query: string;
  organic: Array<{
    position: number;
    title: string;
    link: string;
    domain: string;
    snippet: string;
  }>;
  peopleAlsoAsk: Array<{
    question: string;
    snippet: string;
  }>;
  relatedSearches: string[];
  knowledgeGraph: {
    title: string;
    type: string;
    description: string;
  } | null;
  totalResults: number;
}

// ============================================================================
// GOOGLE SEARCH CONSOLE
// ============================================================================

export interface GSCSearchAnalyticsRow {
  keys: string[];
  clicks: number;
  impressions: number;
  ctr: number;
  position: number;
}

export interface GSCProperty {
  siteUrl: string;
  permissionLevel: string;
}

export interface GSCIndexingStatus {
  indexedPages: number;
  totalPages: number;
  crawlErrors: number;
  lastCrawlDate: string | null;
}

// ============================================================================
// CACHE ENTRY TYPE
// ============================================================================

export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}
