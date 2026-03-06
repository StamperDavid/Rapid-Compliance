/**
 * Apollo.io Integration Service
 * Singleton service for searching and enriching contacts/companies via Apollo's API.
 *
 * - People Search & Org Search are FREE (0 credits)
 * - Person Enrichment costs 1 credit per match
 * - Org Enrichment is FREE (0 credits)
 *
 * Auth via `x-api-key` header. Key stored in Firestore via apiKeyService.
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import type {
  ApolloPersonSearchParams,
  ApolloOrgSearchParams,
  ApolloPersonEnrichParams,
  ApolloOrgEnrichParams,
  ApolloPerson,
  ApolloOrganization,
  ApolloPersonSearchResponse,
  ApolloOrgSearchResponse,
  ApolloServiceResult,
  ApolloCreditsSnapshot,
} from './types';
import type { EnrichmentData } from '@/types/crm-entities';

const APOLLO_BASE = 'https://api.apollo.io';
const REQUEST_TIMEOUT = 15_000;
const SEARCH_RATE_LIMIT = 600; // per hour
const RATE_WINDOW_MS = 60 * 60 * 1000; // 1 hour

// ── Sliding-Window Rate Limiter ────────────────────────────────────────────

class SlidingWindowRateLimiter {
  private timestamps: number[] = [];

  constructor(
    private maxRequests: number,
    private windowMs: number,
  ) {}

  canProceed(): boolean {
    this.prune();
    return this.timestamps.length < this.maxRequests;
  }

  record(): void {
    this.timestamps.push(Date.now());
  }

  get currentCount(): number {
    this.prune();
    return this.timestamps.length;
  }

  private prune(): void {
    const cutoff = Date.now() - this.windowMs;
    while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
      this.timestamps.shift();
    }
  }
}

// ── Service ────────────────────────────────────────────────────────────────

class ApolloService {
  private searchLimiter = new SlidingWindowRateLimiter(SEARCH_RATE_LIMIT, RATE_WINDOW_MS);

  // ── API Key ────────────────────────────────────────────────────────────

  private async getApiKey(): Promise<string | null> {
    const raw = await apiKeyService.getServiceKey(PLATFORM_ID, 'apollo');
    if (typeof raw === 'string' && raw.length > 0) {return raw;}
    return null;
  }

  async isConfigured(): Promise<boolean> {
    const key = await this.getApiKey();
    return key !== null;
  }

  // ── Generic Request Helper ─────────────────────────────────────────────

  private async request<T>(
    method: 'GET' | 'POST',
    path: string,
    body?: Record<string, unknown>,
    query?: Record<string, string>,
  ): Promise<{ ok: boolean; data: T | null; status: number; error: string | null }> {
    const apiKey = await this.getApiKey();
    if (!apiKey) {
      return { ok: false, data: null, status: 0, error: 'Apollo API key not configured. Add it in Settings > API Keys.' };
    }

    let url = `${APOLLO_BASE}${path}`;
    if (query) {
      const qs = new URLSearchParams(query);
      url += `?${qs.toString()}`;
    }

    const headers: Record<string, string> = {
      'x-api-key': apiKey,
      'Content-Type': 'application/json',
      'Cache-Control': 'no-cache',
    };

    try {
      const response = await fetch(url, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT),
      });

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        logger.warn('[Apollo] API error', { status: response.status, path, error: errorText });
        return { ok: false, data: null, status: response.status, error: `Apollo API ${response.status}: ${errorText}` };
      }

      const data = (await response.json()) as T;
      return { ok: true, data, status: response.status, error: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error('[Apollo] Request failed', err instanceof Error ? err : new Error(msg), { path });
      return { ok: false, data: null, status: 0, error: msg };
    }
  }

  // ── Credit Logging ─────────────────────────────────────────────────────

  private async logCredits(action: string, credits: number): Promise<void> {
    if (credits === 0) {return;}
    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      if (!adminDb) {return;}
      const { getSubCollection } = await import('@/lib/firebase/collections');
      const path = getSubCollection('apollo-credits');
      const docId = `${action}-${Date.now()}`;
      await adminDb.collection(path).doc(docId).set({
        action,
        credits,
        timestamp: new Date().toISOString(),
        date: new Date().toISOString().slice(0, 10), // YYYY-MM-DD
      });
    } catch (err) {
      logger.warn('[Apollo] Failed to log credits', { error: err instanceof Error ? err.message : String(err) });
    }
  }

  // ── People Search (FREE) ──────────────────────────────────────────────

  async searchPeople(params: ApolloPersonSearchParams): Promise<ApolloServiceResult<ApolloPersonSearchResponse>> {
    if (!this.searchLimiter.canProceed()) {
      return { success: false, data: null, error: 'Search rate limit reached (600/hr). Try again later.', creditsUsed: 0, cached: false };
    }

    const body: Record<string, unknown> = {
      page: params.page ?? 1,
      per_page: Math.min(params.per_page ?? 25, 100),
    };
    if (params.q_person_titles?.length) {body.q_person_titles = params.q_person_titles;}
    if (params.person_seniorities?.length) {body.person_seniorities = params.person_seniorities;}
    if (params.q_person_locations?.length) {body.q_person_locations = params.q_person_locations;}
    if (params.q_organization_domains?.length) {body.q_organization_domains = params.q_organization_domains;}
    if (params.organization_num_employees_ranges?.length) {body.organization_num_employees_ranges = params.organization_num_employees_ranges;}
    if (params.q_keywords) {body.q_keywords = params.q_keywords;}

    this.searchLimiter.record();
    const result = await this.request<ApolloPersonSearchResponse>('POST', '/api/v1/mixed_people/search', body);

    if (!result.ok || !result.data) {
      return { success: false, data: null, error: result.error, creditsUsed: 0, cached: false };
    }

    return { success: true, data: result.data, error: null, creditsUsed: 0, cached: false };
  }

  // ── Org Search (FREE) ─────────────────────────────────────────────────

  async searchOrganizations(params: ApolloOrgSearchParams): Promise<ApolloServiceResult<ApolloOrgSearchResponse>> {
    if (!this.searchLimiter.canProceed()) {
      return { success: false, data: null, error: 'Search rate limit reached (600/hr). Try again later.', creditsUsed: 0, cached: false };
    }

    const body: Record<string, unknown> = {
      page: params.page ?? 1,
      per_page: Math.min(params.per_page ?? 25, 100),
    };
    if (params.q_organization_keyword_tags?.length) {body.q_organization_keyword_tags = params.q_organization_keyword_tags;}
    if (params.organization_num_employees_ranges?.length) {body.organization_num_employees_ranges = params.organization_num_employees_ranges;}
    if (params.q_organization_locations?.length) {body.q_organization_locations = params.q_organization_locations;}
    if (params.q_keywords) {body.q_keywords = params.q_keywords;}

    this.searchLimiter.record();
    const result = await this.request<ApolloOrgSearchResponse>('POST', '/api/v1/mixed_companies/search', body);

    if (!result.ok || !result.data) {
      return { success: false, data: null, error: result.error, creditsUsed: 0, cached: false };
    }

    return { success: true, data: result.data, error: null, creditsUsed: 0, cached: false };
  }

  // ── Person Enrichment (1 credit) ──────────────────────────────────────

  async enrichPerson(params: ApolloPersonEnrichParams): Promise<ApolloServiceResult<ApolloPerson>> {
    const body: Record<string, unknown> = {};
    if (params.first_name) {body.first_name = params.first_name;}
    if (params.last_name) {body.last_name = params.last_name;}
    if (params.email) {body.email = params.email;}
    if (params.domain) {body.domain = params.domain;}
    if (params.organization_name) {body.organization_name = params.organization_name;}
    if (params.linkedin_url) {body.linkedin_url = params.linkedin_url;}

    const result = await this.request<{ person: ApolloPerson }>('POST', '/api/v1/people/match', body);

    if (!result.ok || !result.data?.person) {
      return { success: false, data: null, error: result.error ?? 'No matching person found', creditsUsed: 0, cached: false };
    }

    void this.logCredits('enrichPerson', 1);
    return { success: true, data: result.data.person, error: null, creditsUsed: 1, cached: false };
  }

  // ── Org Enrichment (FREE) ─────────────────────────────────────────────

  async enrichOrganization(params: ApolloOrgEnrichParams): Promise<ApolloServiceResult<ApolloOrganization>> {
    const result = await this.request<{ organization: ApolloOrganization }>(
      'GET',
      '/api/v1/organizations/enrich',
      undefined,
      { domain: params.domain },
    );

    if (!result.ok || !result.data?.organization) {
      return { success: false, data: null, error: result.error ?? 'Organization not found', creditsUsed: 0, cached: false };
    }

    return { success: true, data: result.data.organization, error: null, creditsUsed: 0, cached: false };
  }

  // ── Bulk Person Enrichment (1 credit each, max 10) ────────────────────

  async bulkEnrichPeople(paramsList: ApolloPersonEnrichParams[]): Promise<ApolloServiceResult<ApolloPerson[]>> {
    if (paramsList.length === 0) {
      return { success: true, data: [], error: null, creditsUsed: 0, cached: false };
    }
    if (paramsList.length > 10) {
      return { success: false, data: null, error: 'Bulk enrich limited to 10 people per request', creditsUsed: 0, cached: false };
    }

    const details = paramsList.map(p => {
      const detail: Record<string, unknown> = {};
      if (p.first_name) {detail.first_name = p.first_name;}
      if (p.last_name) {detail.last_name = p.last_name;}
      if (p.email) {detail.email = p.email;}
      if (p.domain) {detail.domain = p.domain;}
      if (p.organization_name) {detail.organization_name = p.organization_name;}
      if (p.linkedin_url) {detail.linkedin_url = p.linkedin_url;}
      return detail;
    });

    const result = await this.request<{ matches: ApolloPerson[] }>('POST', '/api/v1/people/bulk_match', { details });

    if (!result.ok || !result.data?.matches) {
      return { success: false, data: null, error: result.error ?? 'Bulk enrichment failed', creditsUsed: 0, cached: false };
    }

    const matchCount = result.data.matches.length;
    void this.logCredits('bulkEnrichPeople', matchCount);
    return { success: true, data: result.data.matches, error: null, creditsUsed: matchCount, cached: false };
  }

  // ── Credits Snapshot ──────────────────────────────────────────────────

  async getCreditsSnapshot(): Promise<ApolloCreditsSnapshot> {
    const snapshot: ApolloCreditsSnapshot = {
      creditsUsedToday: 0,
      creditsUsedThisMonth: 0,
      searchCallsThisHour: this.searchLimiter.currentCount,
      lastUpdated: new Date().toISOString(),
    };

    try {
      const { adminDb } = await import('@/lib/firebase/admin');
      if (!adminDb) {return snapshot;}
      const { getSubCollection } = await import('@/lib/firebase/collections');
      const path = getSubCollection('apollo-credits');

      const today = new Date().toISOString().slice(0, 10);
      const monthStart = today.slice(0, 7); // YYYY-MM

      const todayDocs = await adminDb
        .collection(path)
        .where('date', '==', today)
        .get();

      let todayCredits = 0;
      todayDocs.forEach(doc => {
        const data = doc.data();
        todayCredits += typeof data.credits === 'number' ? data.credits : 0;
      });

      const monthDocs = await adminDb
        .collection(path)
        .where('date', '>=', `${monthStart}-01`)
        .where('date', '<=', `${monthStart}-31`)
        .get();

      let monthCredits = 0;
      monthDocs.forEach(doc => {
        const data = doc.data();
        monthCredits += typeof data.credits === 'number' ? data.credits : 0;
      });

      snapshot.creditsUsedToday = todayCredits;
      snapshot.creditsUsedThisMonth = monthCredits;
    } catch (err) {
      logger.warn('[Apollo] Failed to read credits', { error: err instanceof Error ? err.message : String(err) });
    }

    return snapshot;
  }

  // ── Data Converters (instance wrappers for static functions) ────────

  toEnrichmentData(org: ApolloOrganization, person?: ApolloPerson): Partial<EnrichmentData> {
    return toEnrichmentData(org, person);
  }

  mergeEnrichmentData(scraperData: Partial<EnrichmentData>, apolloData: Partial<EnrichmentData>): Partial<EnrichmentData> {
    return mergeEnrichmentData(scraperData, apolloData);
  }
}

// ── Standalone Data Converters (exported for direct use) ───────────────────

/**
 * Convert Apollo org + optional person data to the platform's EnrichmentData shape.
 */
export function toEnrichmentData(org: ApolloOrganization, person?: ApolloPerson): Partial<EnrichmentData> {
  const data: Partial<EnrichmentData> = {
    companyName: org.name,
    domain: org.domain ?? undefined,
    website: org.website_url ?? undefined,
    industry: org.industry ?? undefined,
    employeeCount: org.estimated_num_employees ?? undefined,
    city: org.city ?? undefined,
    state: org.state ?? undefined,
    country: org.country ?? undefined,
    foundedYear: org.founded_year ?? undefined,
    revenue: org.annual_revenue_printed ?? undefined,
    fundingStage: org.latest_funding_stage ?? undefined,
    linkedInUrl: org.linkedin_url ?? undefined,
    twitterHandle: org.twitter_url ?? undefined,
    description: org.short_description ?? undefined,
    techStack: org.technologies?.length ? org.technologies : undefined,
    dataSource: 'apollo' as EnrichmentData['dataSource'],
    confidence: 85,
  };

  if (person) {
    data.contactEmail = person.email ?? undefined;
    data.contactPhone = person.phone_numbers?.[0]?.sanitized_number ?? undefined;
    data.title = person.title ?? undefined;
  }

  return data;
}

/**
 * Merge scraper data with Apollo data. Apollo wins for structured fields,
 * scraper wins for real-time signals. Combined result is 'hybrid'.
 */
export function mergeEnrichmentData(
  scraperData: Partial<EnrichmentData>,
  apolloData: Partial<EnrichmentData>,
): Partial<EnrichmentData> {
  const merged: Partial<EnrichmentData> = { ...scraperData };

  // Apollo wins for these structured/verified fields
  const apolloWins: (keyof EnrichmentData)[] = [
    'companyName', 'employeeCount', 'revenue', 'fundingStage',
    'foundedYear', 'contactEmail', 'contactPhone', 'linkedInUrl',
    'city', 'state', 'country', 'industry',
  ];

  for (const field of apolloWins) {
    const apolloValue = apolloData[field];
    if (apolloValue !== undefined && apolloValue !== null) {
      (merged as Record<string, unknown>)[field] = apolloValue;
    }
  }

  // techStack: union of both
  const scraperTech = Array.isArray(scraperData.techStack) ? scraperData.techStack : [];
  const apolloTech = Array.isArray(apolloData.techStack) ? apolloData.techStack : [];
  if (scraperTech.length > 0 || apolloTech.length > 0) {
    merged.techStack = [...new Set([...scraperTech, ...apolloTech])];
  }

  // description: longer one wins
  if (apolloData.description && scraperData.description) {
    merged.description = apolloData.description.length > scraperData.description.length
      ? apolloData.description
      : scraperData.description;
  } else {
    merged.description = apolloData.description ?? scraperData.description;
  }

  // Scraper wins for real-time signals (hiringStatus already in scraperData)

  // confidence: take max
  const scraperConf = typeof scraperData.confidence === 'number' ? scraperData.confidence : 0;
  const apolloConf = typeof apolloData.confidence === 'number' ? apolloData.confidence : 0;
  merged.confidence = Math.max(scraperConf, apolloConf);

  // Both contributed
  merged.dataSource = 'hybrid';

  return merged;
}

// ── Singleton Export ────────────────────────────────────────────────────────

let instance: ApolloService | null = null;

export function getApolloService(): ApolloService {
  instance ??= new ApolloService();
  return instance;
}

export const apolloService = getApolloService();
