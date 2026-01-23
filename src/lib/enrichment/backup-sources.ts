/**
 * Free Backup Data Sources
 * When web scraping fails, use these FREE sources to get partial data
 * NO paid APIs - all free tier or public data
 */

import type { CompanyEnrichmentData } from './types'
import { logger } from '../logger/logger';

// Type definitions for external API responses

interface WhoisRegistrant {
  city?: string;
  state?: string;
  country?: string;
  email?: string;
  telephone?: string;
}

interface WhoisRecord {
  registrant?: WhoisRegistrant;
}

interface WhoisResponse {
  WhoisRecord?: WhoisRecord;
}

interface CrunchbaseEntity {
  identifier: {
    uuid: string;
  };
}

interface CrunchbaseAutocompleteResponse {
  entities?: CrunchbaseEntity[];
}

interface CrunchbaseProperties {
  short_description?: string;
  founded_on?: {
    year?: number;
  };
  location_identifiers?: Array<{
    value?: string;
    location_type?: string;
  }>;
  num_employees_enum?: string;
  funding_stage?: string;
  revenue_range?: string;
}

interface CrunchbaseDetailsResponse {
  properties?: CrunchbaseProperties;
}

interface GoogleKnowledgeGraphResult {
  name?: string;
  description?: string;
  detailedDescription?: {
    articleBody?: string;
  };
  url?: string;
}

interface GoogleKnowledgeGraphItem {
  result?: GoogleKnowledgeGraphResult;
}

interface GoogleKnowledgeGraphResponse {
  itemListElement?: GoogleKnowledgeGraphItem[];
}

interface WikipediaSearchItem {
  title?: string;
}

interface WikipediaSearchResponse {
  query?: {
    search?: WikipediaSearchItem[];
  };
}

interface WikipediaPage {
  extract?: string;
}

interface WikipediaExtractResponse {
  query?: {
    pages?: Record<string, WikipediaPage>;
  };
}

// Type guards

function isWhoisResponse(data: unknown): data is WhoisResponse {
  return typeof data === 'object' && data !== null;
}

function isCrunchbaseAutocompleteResponse(data: unknown): data is CrunchbaseAutocompleteResponse {
  return typeof data === 'object' && data !== null;
}

function isCrunchbaseDetailsResponse(data: unknown): data is CrunchbaseDetailsResponse {
  return typeof data === 'object' && data !== null;
}

function isGoogleKnowledgeGraphResponse(data: unknown): data is GoogleKnowledgeGraphResponse {
  return typeof data === 'object' && data !== null;
}

function isWikipediaSearchResponse(data: unknown): data is WikipediaSearchResponse {
  return typeof data === 'object' && data !== null;
}

function isWikipediaExtractResponse(data: unknown): data is WikipediaExtractResponse {
  return typeof data === 'object' && data !== null;
}

function isWikipediaPage(data: unknown): data is WikipediaPage {
  return typeof data === 'object' && data !== null && 'extract' in data;
}

/**
 * Get company data from WHOIS (free)
 */
export async function getWhoisData(domain: string): Promise<Partial<CompanyEnrichmentData>> {
  try {
    logger.info('WHOIS Looking up domain}...', { file: 'backup-sources.ts' });

    // Use a free WHOIS API
    const response = await fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?domainName=${domain}&apiKey=at_00000000000000000000000000000&outputFormat=JSON`);

    if (!response.ok) {
      return {};
    }

    const rawData: unknown = await response.json();

    if (!isWhoisResponse(rawData)) {
      return {};
    }

    const registrant = rawData.WhoisRecord?.registrant;

    if (!registrant) {
      return {};
    }

    return {
      headquarters: {
        city: registrant.city,
        state: registrant.state,
        country: registrant.country,
      },
      contactEmail: registrant.email,
      contactPhone: registrant.telephone,
    };
  } catch (error: unknown) {
    const whoisError = error instanceof Error ? error : new Error(String(error));
    logger.error('[WHOIS] Error:', whoisError, { file: 'backup-sources.ts' });
    return {};
  }
}

/**
 * Get tech stack from DNS records (free)
 * Note: DNS lookups work server-side only (not in browser/edge)
 */
export async function getTechStackFromDNS(domain: string): Promise<string[]> {
  try {
    logger.info('DNS Checking tech stack for domain}...', { file: 'backup-sources.ts' });
    
    const techStack: string[] = [];
    
    // Only try DNS if we're in Node.js environment
    if (typeof process !== 'undefined' && process.versions?.node) {
      try {
        // Dynamic import to avoid edge runtime issues
        const dns = await import('dns').then(mod => mod.promises);

        // Check MX records for email provider
        try {
          const mxRecords = await dns.resolveMx(domain);

          if (mxRecords && mxRecords.length > 0) {
            const mx = mxRecords[0].exchange.toLowerCase();

            if (mx.includes('google')) {techStack.push('Google Workspace');}
            if (mx.includes('outlook') || mx.includes('microsoft')) {techStack.push('Microsoft 365');}
            if (mx.includes('mailgun')) {techStack.push('Mailgun');}
            if (mx.includes('sendgrid')) {techStack.push('SendGrid');}
          }
        } catch { /* MX records not available */ }

        // Check TXT records for verification codes
        try {
          const txtRecords = await dns.resolveTxt(domain);
          const txtString = txtRecords.flat().join(' ').toLowerCase();

          if (txtString.includes('google-site-verification')) {techStack.push('Google Analytics');}
          if (txtString.includes('facebook-domain-verification')) {techStack.push('Facebook Pixel');}
          if (txtString.includes('stripe-verification')) {techStack.push('Stripe');}
          if (txtString.includes('v=spf') && txtString.includes('mailchimp')) {techStack.push('Mailchimp');}
          if (txtString.includes('hubspot')) {techStack.push('HubSpot');}
        } catch { /* MX records not available */ }
      } catch (_error: unknown) {
        logger.warn('[DNS] DNS module not available in this environment', { file: 'backup-sources.ts' });
      }
    }

    return Array.from(new Set(techStack));
  } catch (error: unknown) {
    const dnsError = error instanceof Error ? error : new Error(String(error));
    logger.error('[DNS] Error:', dnsError, { file: 'backup-sources.ts' });
    return [];
  }
}

/**
 * Get company data from Crunchbase public API (free tier: 200/day)
 */
export async function getCrunchbaseData(companyName: string): Promise<Partial<CompanyEnrichmentData>> {
  try {
    const apiKey = process.env.CRUNCHBASE_API_KEY;

    if (!apiKey) {
      logger.warn('[Crunchbase] API key not configured', { file: 'backup-sources.ts' });
      return {};
    }

    logger.info('Crunchbase Looking up companyName}...', { file: 'backup-sources.ts' });

    const response = await fetch(
      `https://api.crunchbase.com/api/v4/autocompletes?query=${encodeURIComponent(companyName)}&collection_ids=organizations&user_key=${apiKey}`
    );

    if (!response.ok) {
      return {};
    }

    const rawData: unknown = await response.json();

    if (!isCrunchbaseAutocompleteResponse(rawData)) {
      return {};
    }

    const org = rawData.entities?.[0];

    if (!org) {
      return {};
    }

    // Get organization details
    const detailsResponse = await fetch(
      `https://api.crunchbase.com/api/v4/entities/organizations/${org.identifier.uuid}?user_key=${apiKey}`
    );

    if (!detailsResponse.ok) {
      return {};
    }

    const rawDetails: unknown = await detailsResponse.json();

    if (!isCrunchbaseDetailsResponse(rawDetails)) {
      return {};
    }

    const props = rawDetails.properties;

    if (!props) {
      return {};
    }

    return {
      description: props.short_description,
      foundedYear: props.founded_on?.year,
      headquarters: {
        city: props.location_identifiers?.[0]?.value,
        country: props.location_identifiers?.[0]?.location_type,
      },
      employeeCount: props.num_employees_enum ? parseInt(props.num_employees_enum, 10) : undefined,
      fundingStage: props.funding_stage,
      revenue: props.revenue_range,
    };
  } catch (error: unknown) {
    const crunchbaseError = error instanceof Error ? error : new Error(String(error));
    logger.error('[Crunchbase] Error:', crunchbaseError, { file: 'backup-sources.ts' });
    return {};
  }
}

/**
 * Get company data from Google Knowledge Graph (free)
 */
export async function getGoogleKnowledgeGraph(companyName: string): Promise<Partial<CompanyEnrichmentData>> {
  try {
    const apiKey = process.env.GOOGLE_KNOWLEDGE_GRAPH_API_KEY;

    if (!apiKey) {
      logger.warn('[Google KG] API key not configured', { file: 'backup-sources.ts' });
      return {};
    }

    logger.info('Google KG Looking up companyName}...', { file: 'backup-sources.ts' });

    const response = await fetch(
      `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(companyName)}&types=Organization&key=${apiKey}&limit=1`
    );

    if (!response.ok) {
      return {};
    }

    const rawData: unknown = await response.json();

    if (!isGoogleKnowledgeGraphResponse(rawData)) {
      return {};
    }

    const entity = rawData.itemListElement?.[0]?.result;

    if (!entity) {
      return {};
    }

    return {
      name: entity.name,
      description: entity.description ?? entity.detailedDescription?.articleBody,
      website: entity.url,
    };
  } catch (error: unknown) {
    const googleError = error instanceof Error ? error : new Error(String(error));
    logger.error('[Google KG] Error:', googleError, { file: 'backup-sources.ts' });
    return {};
  }
}

/**
 * Get company data from Wikipedia API (free)
 */
export async function getWikipediaData(companyName: string): Promise<Partial<CompanyEnrichmentData>> {
  try {
    logger.info('Wikipedia Looking up companyName}...', { file: 'backup-sources.ts' });

    // Search for page
    const searchResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&format=json&origin=*`
    );

    if (!searchResponse.ok) {
      return {};
    }

    const rawSearchData: unknown = await searchResponse.json();

    if (!isWikipediaSearchResponse(rawSearchData)) {
      return {};
    }

    const pageTitle = rawSearchData.query?.search?.[0]?.title;

    if (!pageTitle || typeof pageTitle !== 'string') {
      return {};
    }

    // Get page extract
    const extractResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts&exintro=true&format=json&origin=*`
    );

    if (!extractResponse.ok) {
      return {};
    }

    const rawExtractData: unknown = await extractResponse.json();

    if (!isWikipediaExtractResponse(rawExtractData)) {
      return {};
    }

    const pages = rawExtractData.query?.pages;

    if (!pages) {
      return {};
    }

    const pagesArray = Object.values(pages);

    if (pagesArray.length === 0) {
      return {};
    }

    const page = pagesArray[0];

    if (!isWikipediaPage(page) || !page.extract || typeof page.extract !== 'string') {
      return {};
    }

    // Clean HTML from extract
    const description = page.extract
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 500);

    return {
      description,
    };
  } catch (error: unknown) {
    const wikiError = error instanceof Error ? error : new Error(String(error));
    logger.error('[Wikipedia] Error:', wikiError, { file: 'backup-sources.ts' });
    return {};
  }
}

/**
 * Try all free backup sources and merge data
 */
export async function getAllBackupData(
  companyName: string,
  domain: string
): Promise<Partial<CompanyEnrichmentData>> {
  logger.info('[Backup Sources] Fetching from all free sources...', { file: 'backup-sources.ts' });
  
  // Run all in parallel
  const [whois, dns, crunchbase, google, wikipedia] = await Promise.all([
    getWhoisData(domain),
    getTechStackFromDNS(domain),
    getCrunchbaseData(companyName),
    getGoogleKnowledgeGraph(companyName),
    getWikipediaData(companyName),
  ]);
  
  // Merge data (later sources override earlier ones)
  const merged: Partial<CompanyEnrichmentData> = {
    ...whois,
    ...crunchbase,
    ...google,
    ...wikipedia,
  };
  
  // Add tech stack from DNS
  if (dns.length > 0) {
    merged.techStack = [...(merged.techStack ?? []), ...dns];
  }
  
  logger.info('[Backup Sources] Merged data from backup sources', { file: 'backup-sources.ts' });
  
  return merged;
}




