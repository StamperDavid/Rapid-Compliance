/**
 * Google Search Console Service
 *
 * Uses existing Google OAuth infrastructure (oauth-service.ts) for auth.
 * Reads from the stored Google integration tokens to call the GSC API.
 *
 * Requires:
 *   - A Google OAuth integration to have been connected (provider=google with
 *     the `https://www.googleapis.com/auth/webmasters.readonly` scope).
 */

import type {
  SEOServiceResult,
  GSCSearchAnalyticsRow,
  GSCProperty,
  GSCIndexingStatus,
  CacheEntry,
} from './types';

// ============================================================================
// RAW GSC API SHAPES (subset)
// ============================================================================

interface GSCSearchAnalyticsResponse {
  rows?: Array<{
    keys: string[];
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;
  responseAggregationType?: string;
}

interface GSCSitesResponse {
  siteEntry?: Array<{
    siteUrl: string;
    permissionLevel: string;
  }>;
}

// ============================================================================
// SERVICE
// ============================================================================

const CACHE_TTL_MS = 30 * 60 * 1000; // 30 minutes
const GSC_INTEGRATION_ID = 'google-search-console';

class GSCService {
  private cache = new Map<string, CacheEntry<unknown>>();

  // -----------------------------------------------------------
  // Connection check
  // -----------------------------------------------------------

  async isConnected(): Promise<boolean> {
    try {
      const token = await this.getAccessToken();
      return token !== null;
    } catch {
      return false;
    }
  }

  // -----------------------------------------------------------
  // Public — list properties
  // -----------------------------------------------------------

  async getProperties(): Promise<SEOServiceResult<GSCProperty[]>> {
    const token = await this.getAccessToken();
    if (!token) {
      return {
        success: false,
        data: null,
        error: 'Google Search Console not connected',
        source: 'gsc',
        cached: false,
      };
    }

    const cacheKey = 'gsc|properties';
    const cached = this.getFromCache<GSCProperty[]>(cacheKey);
    if (cached) {
      return { success: true, data: cached, error: null, source: 'cache', cached: true };
    }

    try {
      const response = await fetch('https://www.googleapis.com/webmasters/v3/sites', {
        headers: { Authorization: `Bearer ${token}` },
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        return await this.apiError<GSCProperty[]>(response);
      }

      const json = (await response.json()) as GSCSitesResponse;
      const properties: GSCProperty[] = (json.siteEntry ?? []).map(s => ({
        siteUrl: s.siteUrl,
        permissionLevel: s.permissionLevel,
      }));

      this.setCache(cacheKey, properties);
      return { success: true, data: properties, error: null, source: 'gsc', cached: false };
    } catch (err) {
      return this.handleError<GSCProperty[]>(err);
    }
  }

  // -----------------------------------------------------------
  // Public — top keywords
  // -----------------------------------------------------------

  async getTopKeywords(
    siteUrl: string,
    options: { days?: number; rowLimit?: number } = {}
  ): Promise<SEOServiceResult<GSCSearchAnalyticsRow[]>> {
    const token = await this.getAccessToken();
    if (!token) {
      return this.notConnected<GSCSearchAnalyticsRow[]>();
    }

    const days = options.days ?? 28;
    const rowLimit = options.rowLimit ?? 50;
    const cacheKey = `gsc|kw|${siteUrl}|${days}|${rowLimit}`;
    const cached = this.getFromCache<GSCSearchAnalyticsRow[]>(cacheKey);
    if (cached) {
      return { success: true, data: cached, error: null, source: 'cache', cached: true };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const encodedUrl = encodeURIComponent(siteUrl);
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedUrl}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            dimensions: ['query'],
            rowLimit,
            dataState: 'final',
          }),
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (!response.ok) {
        return await this.apiError<GSCSearchAnalyticsRow[]>(response);
      }

      const json = (await response.json()) as GSCSearchAnalyticsResponse;
      const rows: GSCSearchAnalyticsRow[] = (json.rows ?? []).map(r => ({
        keys: r.keys,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }));

      this.setCache(cacheKey, rows);
      return { success: true, data: rows, error: null, source: 'gsc', cached: false };
    } catch (err) {
      return this.handleError<GSCSearchAnalyticsRow[]>(err);
    }
  }

  // -----------------------------------------------------------
  // Public — top pages
  // -----------------------------------------------------------

  async getTopPages(
    siteUrl: string,
    options: { days?: number; rowLimit?: number } = {}
  ): Promise<SEOServiceResult<GSCSearchAnalyticsRow[]>> {
    const token = await this.getAccessToken();
    if (!token) {
      return this.notConnected<GSCSearchAnalyticsRow[]>();
    }

    const days = options.days ?? 28;
    const rowLimit = options.rowLimit ?? 50;
    const cacheKey = `gsc|pages|${siteUrl}|${days}|${rowLimit}`;
    const cached = this.getFromCache<GSCSearchAnalyticsRow[]>(cacheKey);
    if (cached) {
      return { success: true, data: cached, error: null, source: 'cache', cached: true };
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    try {
      const encodedUrl = encodeURIComponent(siteUrl);
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedUrl}/searchAnalytics/query`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            startDate: startDate.toISOString().split('T')[0],
            endDate: endDate.toISOString().split('T')[0],
            dimensions: ['page'],
            rowLimit,
            dataState: 'final',
          }),
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (!response.ok) {
        return await this.apiError<GSCSearchAnalyticsRow[]>(response);
      }

      const json = (await response.json()) as GSCSearchAnalyticsResponse;
      const rows: GSCSearchAnalyticsRow[] = (json.rows ?? []).map(r => ({
        keys: r.keys,
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      }));

      this.setCache(cacheKey, rows);
      return { success: true, data: rows, error: null, source: 'gsc', cached: false };
    } catch (err) {
      return this.handleError<GSCSearchAnalyticsRow[]>(err);
    }
  }

  // -----------------------------------------------------------
  // Public — indexing status (sitemaps-based estimate)
  // -----------------------------------------------------------

  async getIndexingStatus(siteUrl: string): Promise<SEOServiceResult<GSCIndexingStatus>> {
    const token = await this.getAccessToken();
    if (!token) {
      return this.notConnected<GSCIndexingStatus>();
    }

    const cacheKey = `gsc|idx|${siteUrl}`;
    const cached = this.getFromCache<GSCIndexingStatus>(cacheKey);
    if (cached) {
      return { success: true, data: cached, error: null, source: 'cache', cached: true };
    }

    try {
      const encodedUrl = encodeURIComponent(siteUrl);
      const response = await fetch(
        `https://www.googleapis.com/webmasters/v3/sites/${encodedUrl}/sitemaps`,
        {
          headers: { Authorization: `Bearer ${token}` },
          signal: AbortSignal.timeout(15_000),
        }
      );

      if (!response.ok) {
        return await this.apiError<GSCIndexingStatus>(response);
      }

      const json = (await response.json()) as {
        sitemap?: Array<{
          contents?: Array<{ type: string; submitted: string; indexed: string }>;
          lastDownloaded?: string;
          errors?: number;
          warnings?: number;
        }>;
      };

      let indexedPages = 0;
      let totalPages = 0;
      let crawlErrors = 0;
      let lastCrawlDate: string | null = null;

      for (const sitemap of json.sitemap ?? []) {
        for (const content of sitemap.contents ?? []) {
          totalPages += parseInt(content.submitted, 10) || 0;
          indexedPages += parseInt(content.indexed, 10) || 0;
        }
        crawlErrors += sitemap.errors ?? 0;
        if (sitemap.lastDownloaded && (!lastCrawlDate || sitemap.lastDownloaded > lastCrawlDate)) {
          lastCrawlDate = sitemap.lastDownloaded;
        }
      }

      const status: GSCIndexingStatus = { indexedPages, totalPages, crawlErrors, lastCrawlDate };
      this.setCache(cacheKey, status);
      return { success: true, data: status, error: null, source: 'gsc', cached: false };
    } catch (err) {
      return this.handleError<GSCIndexingStatus>(err);
    }
  }

  // -----------------------------------------------------------
  // Token helpers — uses existing OAuth infrastructure
  // -----------------------------------------------------------

  private async getAccessToken(): Promise<string | null> {
    try {
      // Dynamically import to avoid circular deps and to stay compatible
      // with the existing OAuth token lifecycle
      const { getValidAccessToken } = await import('@/lib/integrations/oauth-service');
      const token = await getValidAccessToken(GSC_INTEGRATION_ID);
      return token;
    } catch {
      return null;
    }
  }

  // -----------------------------------------------------------
  // Error helpers
  // -----------------------------------------------------------

  private notConnected<T>(): SEOServiceResult<T> {
    return {
      success: false,
      data: null,
      error: 'Google Search Console not connected',
      source: 'gsc',
      cached: false,
    };
  }

  private async apiError<T>(response: Response): Promise<SEOServiceResult<T>> {
    const errBody = await response.text().catch(() => '');
    return {
      success: false,
      data: null,
      error: `GSC API ${response.status}: ${errBody.slice(0, 200)}`,
      source: 'gsc',
      cached: false,
    };
  }

  private handleError<T>(err: unknown): SEOServiceResult<T> {
    const msg = err instanceof Error ? err.message : 'Unknown error';
    return { success: false, data: null, error: msg, source: 'gsc', cached: false };
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

  private setCache(key: string, data: unknown): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: CACHE_TTL_MS });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: GSCService | null = null;

export function getGSCService(): GSCService {
  instance ??= new GSCService();
  return instance;
}
