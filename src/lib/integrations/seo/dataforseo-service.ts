/**
 * DataForSEO Service
 *
 * Reads credentials from apiKeyService (seo.dataforseoLogin / seo.dataforseoPassword).
 * Provides keyword data, SERP results, domain metrics, and on-page analysis.
 *
 * Cache TTLs:
 *   keyword data — 24 h
 *   domain metrics — 6 h
 *   SERP results — 1 h
 *   on-page — 1 h
 */

import type {
  SEOServiceResult,
  DataForSEOKeywordData,
  DataForSEOSerpResult,
  DataForSEODomainMetrics,
  DataForSEORankedKeyword,
  DataForSEOReferringDomain,
  DataForSEOBacklinksSummary,
  DataForSEOCompetitor,
  DataForSEOOnPageResult,
  CacheEntry,
} from './types';
import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';

// ============================================================================
// RAW API RESPONSE SHAPES (relevant subsets)
// ============================================================================

interface DFSApiStatus {
  status_code: number;
  status_message: string;
}

interface DFSKeywordItem {
  keyword: string;
  search_volume: number;
  cpc: number;
  competition: number;
  competition_level: string;
  monthly_searches?: Array<{ month: number; year: number; search_volume: number }>;
}

interface DFSSerpItem {
  type: string;
  rank_absolute: number;
  domain: string;
  url: string;
  title: string;
  description: string;
}

interface DFSSerpTask {
  result?: Array<{
    keyword: string;
    se_results_count: number;
    items?: DFSSerpItem[];
    item_types?: string[];
  }>;
}

interface DFSDomainItem {
  domain: string;
  organic_etv: number;
  organic_count: number;
  backlinks: number;
  referring_domains: number;
  rank: number;
}

interface DFSRankedKeywordItem {
  keyword_data: {
    keyword: string;
    search_volume: number;
    cpc: number;
  };
  ranked_serp_element: {
    serp_item: {
      url: string;
      rank_absolute: number;
    };
    etv: number;
  };
}

interface DFSReferringDomainItem {
  domain: string;
  rank: number;
  backlinks: number;
  backlinks_spam_score: number;
  broken_backlinks: number;
  first_seen: string | null;
  lost_date: string | null;
  dofollow: number;
  nofollow: number;
  anchor: number;
  redirect: number;
  image: number;
  form: number;
  alternate: number;
}

interface DFSBacklinksSummaryItem {
  target: string;
  total_backlinks: number;
  referring_domains: number;
  dofollow: number;
  nofollow: number;
  anchor: number;
  image: number;
  redirect: number;
  rank: number;
  broken_backlinks: number;
  referring_ips: number;
  referring_subnets: number;
}

interface DFSCompetitorItem {
  domain: string;
  avg_position: number;
  sum_position: number;
  intersections: number;
  full_domain_metrics: Record<string, {
    organic: {
      etv: number;
      count: number;
      pos_1: number;
      pos_2_3: number;
      pos_4_10: number;
    };
  }>;
  competitor_relevance: number;
}

interface DFSOnPageItem {
  url: string;
  meta?: {
    title?: string;
    description?: string;
    content_length?: number;
    internal_links_count?: number;
    external_links_count?: number;
    images_count?: number;
    images_without_alt_count?: number;
    words_count?: number;
    htags?: Record<string, string[]>;
  };
  status_code?: number;
  checks?: Record<string, boolean>;
}

interface DFSGenericResponse<T> {
  status_code: number;
  status_message: string;
  tasks?: Array<DFSApiStatus & { result?: T[] }>;
}

// ============================================================================
// CACHE TTL CONSTANTS
// ============================================================================

const TTL_KEYWORD = 24 * 60 * 60 * 1000; // 24h
const TTL_DOMAIN = 6 * 60 * 60 * 1000;   // 6h
const TTL_SERP = 60 * 60 * 1000;          // 1h
const TTL_ONPAGE = 60 * 60 * 1000;        // 1h

// ============================================================================
// SERVICE
// ============================================================================

class DataForSEOService {
  private cache = new Map<string, CacheEntry<unknown>>();

  // -----------------------------------------------------------
  // Auth header
  // -----------------------------------------------------------

  private async getAuthHeader(): Promise<string | null> {
    const raw = await apiKeyService.getServiceKey(PLATFORM_ID, 'dataforseo');
    if (!raw || typeof raw !== 'object') {
      return null;
    }
    const login = typeof raw.login === 'string' ? raw.login : null;
    const password = typeof raw.password === 'string' ? raw.password : null;
    if (!login || !password) {
      return null;
    }
    return `Basic ${Buffer.from(`${login}:${password}`).toString('base64')}`;
  }

  private notConfigured<T>(): SEOServiceResult<T> {
    return {
      success: false,
      data: null,
      error: 'DataForSEO not configured — add login/password on the API Keys page',
      source: 'dataforseo',
      cached: false,
    };
  }

  // -----------------------------------------------------------
  // Generic POST helper
  // -----------------------------------------------------------

  private async post<T>(
    endpoint: string,
    body: unknown[],
    ttl: number,
    cacheKey: string
  ): Promise<SEOServiceResult<T>> {
    const auth = await this.getAuthHeader();
    if (!auth) {
      return this.notConfigured<T>();
    }

    // cache hit?
    const cached = this.getFromCache<T>(cacheKey);
    if (cached) {
      return { success: true, data: cached, error: null, source: 'cache', cached: true };
    }

    try {
      const response = await fetch(`https://api.dataforseo.com/v3/${endpoint}`, {
        method: 'POST',
        headers: {
          'Authorization': auth,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return {
          success: false,
          data: null,
          error: `DataForSEO ${response.status}: ${errBody.slice(0, 200)}`,
          source: 'dataforseo',
          cached: false,
        };
      }

      const json = (await response.json()) as DFSGenericResponse<T>;
      if (json.status_code !== 20000) {
        return {
          success: false,
          data: null,
          error: json.status_message,
          source: 'dataforseo',
          cached: false,
        };
      }

      const firstTask = json.tasks?.[0];
      if (!firstTask || firstTask.status_code !== 20000) {
        return {
          success: false,
          data: null,
          error: firstTask?.status_message ?? 'No task returned',
          source: 'dataforseo',
          cached: false,
        };
      }

      const data = (firstTask.result ?? []) as unknown as T;
      this.setCache(cacheKey, data, ttl);

      return { success: true, data, error: null, source: 'dataforseo', cached: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, data: null, error: msg, source: 'dataforseo', cached: false };
    }
  }

  // -----------------------------------------------------------
  // Public — keyword data
  // -----------------------------------------------------------

  async getKeywordData(
    keywords: string[],
    locationCode: number = 2840, // US
    languageCode: string = 'en'
  ): Promise<SEOServiceResult<DataForSEOKeywordData[]>> {
    const cacheKey = `kw|${keywords.sort().join(',')}|${locationCode}`;

    const result = await this.post<DFSKeywordItem[]>(
      'keywords_data/google_ads/search_volume/live',
      [{ keywords, location_code: locationCode, language_code: languageCode }],
      TTL_KEYWORD,
      cacheKey
    );

    if (!result.success || !result.data) {
      return { success: false, data: null, error: result.error, source: result.source, cached: result.cached };
    }

    const items = result.data as unknown as DFSKeywordItem[];
    const mapped: DataForSEOKeywordData[] = items.map(item => ({
      keyword: item.keyword,
      searchVolume: item.search_volume ?? 0,
      cpc: item.cpc ?? 0,
      competition: item.competition ?? 0,
      competitionLevel: (item.competition_level ?? 'LOW').toUpperCase() as DataForSEOKeywordData['competitionLevel'],
      monthlySearches: (item.monthly_searches ?? []).map(m => ({
        month: `${m.year}-${String(m.month).padStart(2, '0')}`,
        searchVolume: m.search_volume,
      })),
    }));

    return { success: true, data: mapped, error: null, source: result.source, cached: result.cached };
  }

  // -----------------------------------------------------------
  // Public — SERP results
  // -----------------------------------------------------------

  async getSerpResults(
    keyword: string,
    locationCode: number = 2840,
    languageCode: string = 'en'
  ): Promise<SEOServiceResult<DataForSEOSerpResult>> {
    const cacheKey = `serp|${keyword}|${locationCode}`;

    const result = await this.post<DFSSerpTask>(
      'serp/google/organic/live/regular',
      [{ keyword, location_code: locationCode, language_code: languageCode, depth: 30 }],
      TTL_SERP,
      cacheKey
    );

    if (!result.success || !result.data) {
      return { success: false, data: null, error: result.error, source: result.source, cached: result.cached };
    }

    // result.data is the raw array from the task; first element has the SERP
    const raw = (result.data as unknown as Array<{
      keyword: string;
      se_results_count: number;
      items?: DFSSerpItem[];
      item_types?: string[];
    }>)[0];

    if (!raw) {
      return { success: false, data: null, error: 'Empty SERP result', source: 'dataforseo', cached: false };
    }

    const mapped: DataForSEOSerpResult = {
      keyword: raw.keyword,
      totalResults: raw.se_results_count ?? 0,
      items: (raw.items ?? [])
        .filter(i => i.type === 'organic')
        .map(i => ({
          position: i.rank_absolute,
          domain: i.domain,
          url: i.url,
          title: i.title,
          description: i.description,
        })),
      serpFeatures: raw.item_types ?? [],
    };

    return { success: true, data: mapped, error: null, source: result.source, cached: result.cached };
  }

  // -----------------------------------------------------------
  // Public — domain metrics
  // -----------------------------------------------------------

  async getDomainMetrics(domain: string): Promise<SEOServiceResult<DataForSEODomainMetrics>> {
    const cacheKey = `dom|${domain}`;

    const result = await this.post<DFSDomainItem[]>(
      'dataforseo_labs/google/domain_rank/live',
      [{ target: domain }],
      TTL_DOMAIN,
      cacheKey
    );

    if (!result.success || !result.data) {
      return { success: false, data: null, error: result.error, source: result.source, cached: result.cached };
    }

    const items = result.data as unknown as DFSDomainItem[];
    const first = items[0];
    if (!first) {
      return { success: false, data: null, error: 'No domain data returned', source: 'dataforseo', cached: false };
    }

    const mapped: DataForSEODomainMetrics = {
      domain: first.domain,
      organicTraffic: first.organic_etv ?? 0,
      organicKeywords: first.organic_count ?? 0,
      backlinks: first.backlinks ?? 0,
      referringDomains: first.referring_domains ?? 0,
      domainRank: first.rank ?? 0,
    };

    return { success: true, data: mapped, error: null, source: result.source, cached: result.cached };
  }

  // -----------------------------------------------------------
  // Public — ranked keywords (top traffic-driving keywords)
  // -----------------------------------------------------------

  async getRankedKeywords(
    domain: string,
    limit: number = 20
  ): Promise<SEOServiceResult<DataForSEORankedKeyword[]>> {
    const cacheKey = `ranked|${domain}|${limit}`;

    const result = await this.post<DFSRankedKeywordItem[]>(
      'dataforseo_labs/google/ranked_keywords/live',
      [{ target: domain, limit, order_by: ['ranked_serp_element.etv,desc'] }],
      TTL_DOMAIN,
      cacheKey
    );

    if (!result.success || !result.data) {
      return { success: false, data: null, error: result.error, source: result.source, cached: result.cached };
    }

    const items = result.data as unknown as DFSRankedKeywordItem[];

    const mapped: DataForSEORankedKeyword[] = items.map(item => ({
      keyword: item.keyword_data?.keyword ?? '',
      position: item.ranked_serp_element?.serp_item?.rank_absolute ?? 0,
      url: item.ranked_serp_element?.serp_item?.url ?? '',
      searchVolume: item.keyword_data?.search_volume ?? 0,
      traffic: item.ranked_serp_element?.etv ?? 0,
      cpc: item.keyword_data?.cpc ?? 0,
    }));

    return { success: true, data: mapped, error: null, source: result.source, cached: result.cached };
  }

  // -----------------------------------------------------------
  // Public — referring domains (which sites link to a domain)
  // -----------------------------------------------------------

  async getReferringDomains(
    domain: string,
    limit: number = 20
  ): Promise<SEOServiceResult<DataForSEOReferringDomain[]>> {
    const cacheKey = `refdom|${domain}|${limit}`;

    const result = await this.post<DFSReferringDomainItem[]>(
      'backlinks/referring_domains/live',
      [{ target: domain, limit, order_by: ['rank,desc'], backlinks_filters: ['dofollow', '=', true] }],
      TTL_DOMAIN,
      cacheKey
    );

    if (!result.success || !result.data) {
      return { success: false, data: null, error: result.error, source: result.source, cached: result.cached };
    }

    const items = result.data as unknown as DFSReferringDomainItem[];

    const mapped: DataForSEOReferringDomain[] = items.map(item => ({
      domain: item.domain ?? '',
      rank: item.rank ?? 0,
      backlinks: item.backlinks ?? 0,
      backlinkTypes: {
        anchor: item.anchor ?? 0,
        redirect: item.redirect ?? 0,
        image: item.image ?? 0,
        form: item.form ?? 0,
        alternate: item.alternate ?? 0,
      },
      dofollow: item.dofollow ?? 0,
      nofollow: item.nofollow ?? 0,
      firstSeen: item.first_seen ?? null,
      lastSeen: item.lost_date ?? null,
    }));

    return { success: true, data: mapped, error: null, source: result.source, cached: result.cached };
  }

  // -----------------------------------------------------------
  // Public — backlinks summary (aggregate profile)
  // -----------------------------------------------------------

  async getBacklinksSummary(domain: string): Promise<SEOServiceResult<DataForSEOBacklinksSummary>> {
    const cacheKey = `blsum|${domain}`;

    const result = await this.post<DFSBacklinksSummaryItem[]>(
      'backlinks/summary/live',
      [{ target: domain }],
      TTL_DOMAIN,
      cacheKey
    );

    if (!result.success || !result.data) {
      return { success: false, data: null, error: result.error, source: result.source, cached: result.cached };
    }

    const items = result.data as unknown as DFSBacklinksSummaryItem[];
    const first = items[0];
    if (!first) {
      return { success: false, data: null, error: 'No backlinks summary returned', source: 'dataforseo', cached: false };
    }

    const mapped: DataForSEOBacklinksSummary = {
      totalBacklinks: first.total_backlinks ?? 0,
      totalReferringDomains: first.referring_domains ?? 0,
      dofollow: first.dofollow ?? 0,
      nofollow: first.nofollow ?? 0,
      anchorLinks: first.anchor ?? 0,
      imageLinks: first.image ?? 0,
      redirectLinks: first.redirect ?? 0,
      domainRank: first.rank ?? 0,
      brokenBacklinks: first.broken_backlinks ?? 0,
      referringIPs: first.referring_ips ?? 0,
      referringSubnets: first.referring_subnets ?? 0,
    };

    return { success: true, data: mapped, error: null, source: result.source, cached: result.cached };
  }

  // -----------------------------------------------------------
  // Public — competitors (domains competing for same keywords)
  // -----------------------------------------------------------

  async getCompetitors(
    domain: string,
    limit: number = 10
  ): Promise<SEOServiceResult<DataForSEOCompetitor[]>> {
    const cacheKey = `comp|${domain}|${limit}`;

    const result = await this.post<DFSCompetitorItem[]>(
      'dataforseo_labs/google/competitors_domain/live',
      [{ target: domain, limit }],
      TTL_DOMAIN,
      cacheKey
    );

    if (!result.success || !result.data) {
      return { success: false, data: null, error: result.error, source: result.source, cached: result.cached };
    }

    const items = result.data as unknown as DFSCompetitorItem[];

    const mapped: DataForSEOCompetitor[] = items.map(item => {
      const metricsMap = item.full_domain_metrics ?? {};
      const firstMetric = Object.values(metricsMap)[0];
      return {
        domain: item.domain ?? '',
        avgPosition: item.avg_position ?? 0,
        sumPosition: item.sum_position ?? 0,
        intersections: item.intersections ?? 0,
        competitorRelevance: item.competitor_relevance ?? 0,
        organicTraffic: firstMetric?.organic?.etv ?? 0,
        organicKeywords: firstMetric?.organic?.count ?? 0,
      };
    });

    return { success: true, data: mapped, error: null, source: result.source, cached: result.cached };
  }

  // -----------------------------------------------------------
  // Public — on-page analysis
  // -----------------------------------------------------------

  async analyzeOnPage(url: string): Promise<SEOServiceResult<DataForSEOOnPageResult>> {
    const cacheKey = `onpage|${url}`;

    const result = await this.post<DFSOnPageItem[]>(
      'on_page/instant_pages',
      [{ url, enable_javascript: true }],
      TTL_ONPAGE,
      cacheKey
    );

    if (!result.success || !result.data) {
      return { success: false, data: null, error: result.error, source: result.source, cached: result.cached };
    }

    const items = result.data as unknown as DFSOnPageItem[];
    const first = items[0];
    if (!first) {
      return { success: false, data: null, error: 'No on-page data returned', source: 'dataforseo', cached: false };
    }

    const meta = first.meta;
    const htags = meta?.htags ?? {};
    const headings: Record<string, number> = {};
    for (const [tag, values] of Object.entries(htags)) {
      headings[tag] = Array.isArray(values) ? values.length : 0;
    }

    const mapped: DataForSEOOnPageResult = {
      url: first.url ?? url,
      title: meta?.title ?? null,
      description: meta?.description ?? null,
      statusCode: first.status_code ?? 0,
      contentLength: meta?.content_length ?? 0,
      wordCount: meta?.words_count ?? 0,
      internalLinks: meta?.internal_links_count ?? 0,
      externalLinks: meta?.external_links_count ?? 0,
      images: meta?.images_count ?? 0,
      imagesWithoutAlt: meta?.images_without_alt_count ?? 0,
      headings,
      checks: first.checks ?? {},
    };

    return { success: true, data: mapped, error: null, source: result.source, cached: result.cached };
  }

  // -----------------------------------------------------------
  // Cache helpers
  // -----------------------------------------------------------

  private getFromCache<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data as T;
  }

  private setCache(key: string, data: unknown, ttl: number): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: DataForSEOService | null = null;

export function getDataForSEOService(): DataForSEOService {
  instance ??= new DataForSEOService();
  return instance;
}
