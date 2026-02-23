/**
 * Serper SEO Service
 *
 * Uses the existing SERPER_API_KEY env var to provide:
 * - Full SERP results (organic, PAA, related searches, knowledge graph)
 * - Keyword position checking for a target domain
 */

import type {
  SEOServiceResult,
  SerperSEOResult,
  CacheEntry,
} from './types';

// ============================================================================
// RAW API RESPONSE SHAPES
// ============================================================================

interface SerperAPIOrganicItem {
  position: number;
  title: string;
  link: string;
  snippet: string;
  domain?: string;
}

interface SerperAPIPAAItem {
  question: string;
  snippet: string;
}

interface SerperAPIResponse {
  organic?: SerperAPIOrganicItem[];
  peopleAlsoAsk?: SerperAPIPAAItem[];
  relatedSearches?: Array<{ query: string }>;
  knowledgeGraph?: {
    title?: string;
    type?: string;
    description?: string;
  };
  searchInformation?: { totalResults?: number };
}

// ============================================================================
// SERVICE
// ============================================================================

const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

class SerperSEOService {
  private cache = new Map<string, CacheEntry<SerperSEOResult>>();

  // -----------------------------------------------------------
  // Public — full SERP search
  // -----------------------------------------------------------

  async searchSERP(
    query: string,
    options: { num?: number; gl?: string; hl?: string } = {}
  ): Promise<SEOServiceResult<SerperSEOResult>> {
    const apiKey = process.env.SERPER_API_KEY;
    if (!apiKey) {
      return {
        success: false,
        data: null,
        error: 'SERPER_API_KEY not configured',
        source: 'serper',
        cached: false,
      };
    }

    const cacheKey = `serp|${query}|${options.num ?? 10}|${options.gl ?? ''}`;
    const cached = this.getFromCache(cacheKey);
    if (cached) {
      return { success: true, data: cached, error: null, source: 'cache', cached: true };
    }

    try {
      const response = await fetch('https://google.serper.dev/search', {
        method: 'POST',
        headers: {
          'X-API-KEY': apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          q: query,
          num: options.num ?? 10,
          gl: options.gl,
          hl: options.hl,
        }),
        signal: AbortSignal.timeout(15_000),
      });

      if (!response.ok) {
        const errBody = await response.text();
        return {
          success: false,
          data: null,
          error: `Serper API ${response.status}: ${errBody.slice(0, 200)}`,
          source: 'serper',
          cached: false,
        };
      }

      const json = (await response.json()) as SerperAPIResponse;
      const result = this.mapResponse(query, json);
      this.setCache(cacheKey, result);

      return { success: true, data: result, error: null, source: 'serper', cached: false };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      return { success: false, data: null, error: msg, source: 'serper', cached: false };
    }
  }

  // -----------------------------------------------------------
  // Public — keyword position check
  // -----------------------------------------------------------

  async checkKeywordPosition(
    keyword: string,
    targetDomain: string,
    options: { num?: number } = {}
  ): Promise<SEOServiceResult<number | null>> {
    const serpResult = await this.searchSERP(keyword, { num: options.num ?? 30 });

    if (!serpResult.success || !serpResult.data) {
      return {
        success: serpResult.success,
        data: null,
        error: serpResult.error,
        source: serpResult.source,
        cached: serpResult.cached,
      };
    }

    const normalizedDomain = targetDomain.replace(/^https?:\/\//, '').replace(/^www\./, '').toLowerCase();

    const match = serpResult.data.organic.find(item => {
      const itemDomain = item.domain.replace(/^www\./, '').toLowerCase();
      return itemDomain === normalizedDomain || itemDomain.endsWith(`.${normalizedDomain}`);
    });

    return {
      success: true,
      data: match ? match.position : null,
      error: null,
      source: serpResult.cached ? 'cache' : 'serper',
      cached: serpResult.cached,
    };
  }

  // -----------------------------------------------------------
  // Mapping
  // -----------------------------------------------------------

  private mapResponse(query: string, raw: SerperAPIResponse): SerperSEOResult {
    const organic = (raw.organic ?? []).map(item => ({
      position: item.position,
      title: item.title,
      link: item.link,
      domain: item.domain ?? new URL(item.link).hostname,
      snippet: item.snippet,
    }));

    const peopleAlsoAsk = (raw.peopleAlsoAsk ?? []).map(item => ({
      question: item.question,
      snippet: item.snippet,
    }));

    const relatedSearches = (raw.relatedSearches ?? []).map(item => item.query);

    const kg = raw.knowledgeGraph;
    const knowledgeGraph = kg?.title
      ? { title: kg.title, type: kg.type ?? '', description: kg.description ?? '' }
      : null;

    return {
      query,
      organic,
      peopleAlsoAsk,
      relatedSearches,
      knowledgeGraph,
      totalResults: raw.searchInformation?.totalResults ?? organic.length,
    };
  }

  // -----------------------------------------------------------
  // Cache helpers
  // -----------------------------------------------------------

  private getFromCache(key: string): SerperSEOResult | null {
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

  private setCache(key: string, data: SerperSEOResult): void {
    this.cache.set(key, { data, timestamp: Date.now(), ttl: CACHE_TTL_MS });
  }
}

// ============================================================================
// SINGLETON
// ============================================================================

let instance: SerperSEOService | null = null;

export function getSerperSEOService(): SerperSEOService {
  instance ??= new SerperSEOService();
  return instance;
}
