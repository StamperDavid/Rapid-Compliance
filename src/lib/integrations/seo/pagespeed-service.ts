/**
 * PageSpeed Insights Service
 *
 * Free Google API — optional key for higher quota (25k/day vs 100/day).
 * Provides real performance scores, Core Web Vitals, and Lighthouse audits.
 */

import type {
  SEOServiceResult,
  PageSpeedResult,
  CoreWebVitals,
  CacheEntry,
} from './types';

// ============================================================================
// TYPES — Raw Lighthouse JSON shapes (subset)
// ============================================================================

interface LighthouseAuditNumeric {
  score: number | null;
  numericValue?: number;
  displayValue?: string;
}

interface LighthouseCategory {
  score: number | null;
}

interface LighthouseResult {
  categories: Record<string, LighthouseCategory>;
  audits: Record<string, LighthouseAuditNumeric>;
}

interface PageSpeedAPIResponse {
  lighthouseResult?: LighthouseResult;
  loadingExperience?: {
    overall_category?: string;
    metrics?: Record<string, { percentile?: number }>;
  };
  error?: { message: string };
}

// ============================================================================
// SERVICE
// ============================================================================

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class PageSpeedService {
  private cache = new Map<string, CacheEntry<PageSpeedResult>>();

  // -----------------------------------------------------------
  // Public
  // -----------------------------------------------------------

  async analyze(
    url: string,
    strategy: 'mobile' | 'desktop' = 'desktop'
  ): Promise<SEOServiceResult<PageSpeedResult>> {
    const cacheKey = `${url}|${strategy}`;

    // 1 — cache hit?
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, error: null, source: 'cache', cached: true };
    }

    // 2 — build URL
    const apiKey = process.env.GOOGLE_PAGESPEED_API_KEY;
    const base = 'https://www.googleapis.com/pagespeedonline/v5/runPagespeed';
    const params = new URLSearchParams({
      url,
      strategy,
      category: 'performance',
    });
    // Additional categories for richer data
    params.append('category', 'accessibility');
    params.append('category', 'best-practices');
    params.append('category', 'seo');
    if (apiKey) {
      params.set('key', apiKey);
    }

    try {
      const response = await fetch(`${base}?${params.toString()}`, {
        signal: AbortSignal.timeout(30_000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return {
          success: false,
          data: null,
          error: `PageSpeed API ${response.status}: ${errBody.slice(0, 200)}`,
          source: 'pagespeed',
          cached: false,
        };
      }

      const json = (await response.json()) as PageSpeedAPIResponse;

      if (json.error) {
        return {
          success: false,
          data: null,
          error: json.error.message,
          source: 'pagespeed',
          cached: false,
        };
      }

      const result = this.mapResponse(url, strategy, json);
      this.setCache(cacheKey, result);

      return { success: true, data: result, error: null, source: 'pagespeed', cached: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, data: null, error: msg, source: 'pagespeed', cached: false };
    }
  }

  // -----------------------------------------------------------
  // Mapping
  // -----------------------------------------------------------

  private mapResponse(
    url: string,
    strategy: 'mobile' | 'desktop',
    raw: PageSpeedAPIResponse
  ): PageSpeedResult {
    const lh = raw.lighthouseResult;
    const audits = lh?.audits ?? {};
    const cats = lh?.categories ?? {};

    const num = (key: string): number => audits[key]?.numericValue ?? 0;
    const catScore = (key: string): number => Math.round((cats[key]?.score ?? 0) * 100);

    const coreWebVitals: CoreWebVitals = {
      lcp: num('largest-contentful-paint'),
      fid: num('max-potential-fid'),
      cls: audits['cumulative-layout-shift']?.numericValue ?? 0,
      fcp: num('first-contentful-paint'),
      ttfb: num('server-response-time'),
      tbt: num('total-blocking-time'),
      speedIndex: num('speed-index'),
    };

    // Pull actionable recommendations from failed audits
    const recommendations: string[] = [];
    const importantAudits = [
      'render-blocking-resources',
      'unused-css-rules',
      'unused-javascript',
      'modern-image-formats',
      'uses-optimized-images',
      'uses-text-compression',
      'uses-responsive-images',
      'efficient-animated-content',
      'offscreen-images',
    ];
    for (const key of importantAudits) {
      const audit = audits[key];
      if (audit && audit.score !== null && audit.score < 0.9 && audit.displayValue) {
        recommendations.push(`${key.replace(/-/g, ' ')}: ${audit.displayValue}`);
      }
    }

    return {
      url,
      strategy,
      performanceScore: catScore('performance'),
      accessibilityScore: catScore('accessibility'),
      bestPracticesScore: catScore('best-practices'),
      seoScore: catScore('seo'),
      coreWebVitals,
      loadTime: num('interactive') / 1000, // Time to Interactive in seconds
      totalByteWeight: num('total-byte-weight'),
      recommendations,
    };
  }

  // -----------------------------------------------------------
  // Cache helpers
  // -----------------------------------------------------------

  private getFromCache(key: string): PageSpeedResult | null {
    const entry = this.cache.get(key);
    if (!entry) {
      return null;
    }
    if (Date.now() - entry.timestamp > entry.ttl) {
      this.cache.delete(key);
      return null;
    }
    return entry.data;
  }

  private setCache(key: string, data: PageSpeedResult): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: CACHE_TTL_MS });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: PageSpeedService | null = null;

export function getPageSpeedService(): PageSpeedService {
  instance ??= new PageSpeedService();
  return instance;
}
