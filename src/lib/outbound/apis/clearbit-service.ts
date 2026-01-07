/**
 * Clearbit API Service
 * 
 * @deprecated This service is DEPRECATED per Hunter-Closer directive.
 * Use native discovery-engine.ts instead for 100% native data acquisition.
 * 
 * Migration path:
 * - Instead of: enrichCompanyByDomain(domain, orgId)
 * - Use: discoverCompany(domain, orgId) from @/lib/services/discovery-engine
 * 
 * Deprecation reason: Third-party data dependency violates Hunter-Closer mandate.
 * Our native discovery engine builds a proprietary 30-day cache moat.
 * 
 * This file will be removed in a future release.
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service'
import { logger } from '@/lib/logger/logger';

const CLEARBIT_API_BASE = 'https://company.clearbit.com/v2';
const CLEARBIT_PERSON_API = 'https://person.clearbit.com/v2';

export interface ClearbitCompany {
  id: string;
  name: string;
  legalName?: string;
  domain: string;
  url: string;
  category: {
    sector: string;
    industryGroup: string;
    industry: string;
    subIndustry: string;
  };
  tags: string[];
  description: string;
  foundedYear?: number;
  location: string;
  timeZone: string;
  utcOffset: number;
  geo: {
    streetNumber?: string;
    streetName?: string;
    subPremise?: string;
    city?: string;
    postalCode?: string;
    state?: string;
    stateCode?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
  };
  metrics: {
    alexaUsRank?: number;
    alexaGlobalRank?: number;
    employees?: number;
    employeesRange?: string;
    marketCap?: number;
    raised?: number;
    annualRevenue?: number;
    estimatedAnnualRevenue?: string;
    fiscalYearEnd?: number;
  };
  facebook?: {
    handle: string;
    likes: number;
  };
  linkedin?: {
    handle: string;
  };
  twitter?: {
    handle: string;
    followers: number;
    following: number;
  };
  crunchbase?: {
    handle: string;
  };
  tech: string[];
}

export interface ClearbitPerson {
  id: string;
  name: {
    fullName: string;
    givenName: string;
    familyName: string;
  };
  email: string;
  location?: string;
  timeZone?: string;
  utcOffset?: number;
  geo?: {
    city?: string;
    state?: string;
    stateCode?: string;
    country?: string;
    countryCode?: string;
    lat?: number;
    lng?: number;
  };
  bio?: string;
  site?: string;
  avatar?: string;
  employment?: {
    domain: string;
    name: string;
    title: string;
    role: string;
    subRole: string;
    seniority: string;
  };
  facebook?: {
    handle: string;
  };
  github?: {
    handle: string;
    followers: number;
  };
  twitter?: {
    handle: string;
    followers: number;
    following: number;
  };
  linkedin?: {
    handle: string;
  };
}

/**
 * Get company information by domain
 * 
 * @deprecated Use discoverCompany() from @/lib/services/discovery-engine instead
 */
export async function enrichCompanyByDomain(
  domain: string,
  organizationId: string
): Promise<ClearbitCompany | null> {
  logger.warn('[DEPRECATED] enrichCompanyByDomain is deprecated. Use discovery-engine.ts instead.', {
    domain,
    organizationId,
    migration: 'Import discoverCompany from @/lib/services/discovery-engine',
  });
  
  try {
    const apiKey = await getClearbitApiKey(organizationId);
    
    if (!apiKey) {
      logger.warn('[Clearbit] API key not configured', { file: 'clearbit-service.ts' });
      return null;
    }

    const response = await fetch(
      `${CLEARBIT_API_BASE}/companies/find?domain=${encodeURIComponent(domain)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 404) {
      logger.info('Clearbit Company not found for domain: domain}', { file: 'clearbit-service.ts' });
      return null;
    }

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('[Clearbit] API error (${response.status}):', errorText, { file: 'clearbit-service.ts' });
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('[Clearbit] Error enriching company:', error, { file: 'clearbit-service.ts' });
    return null;
  }
}

/**
 * Get company information by name (fuzzy search)
 * 
 * @deprecated Use discoverCompany() from @/lib/services/discovery-engine instead
 */
export async function searchCompanyByName(
  companyName: string,
  organizationId: string
): Promise<ClearbitCompany | null> {
  logger.warn('[DEPRECATED] searchCompanyByName is deprecated. Use discovery-engine.ts instead.', {
    companyName,
    organizationId,
  });
  
  try {
    const apiKey = await getClearbitApiKey(organizationId);
    
    if (!apiKey) {
      logger.warn('[Clearbit] API key not configured', { file: 'clearbit-service.ts' });
      return null;
    }

    // Try to guess domain first
    const domain = guessDomainFromCompanyName(companyName);
    
    // Try domain lookup
    const company = await enrichCompanyByDomain(domain, organizationId);
    
    if (company) {
      return company;
    }

    // If domain lookup fails, try autocomplete
    const autocompleteResponse = await fetch(
      `https://autocomplete.clearbit.com/v1/companies/suggest?query=${encodeURIComponent(companyName)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
        },
      }
    );

    if (!autocompleteResponse.ok) {
      return null;
    }

    const suggestions = await autocompleteResponse.json();
    
    if (suggestions && suggestions.length > 0) {
      // Use the first suggestion's domain
      return await enrichCompanyByDomain(suggestions[0].domain, organizationId);
    }

    return null;
  } catch (error) {
    logger.error('[Clearbit] Error searching company:', error, { file: 'clearbit-service.ts' });
    return null;
  }
}

/**
 * Enrich person by email
 * 
 * @deprecated Use discoverCompany() from @/lib/services/discovery-engine instead
 */
export async function enrichPersonByEmail(
  email: string,
  organizationId: string
): Promise<ClearbitPerson | null> {
  logger.warn('[DEPRECATED] enrichPersonByEmail is deprecated. Use discovery-engine.ts instead.', {
    email,
    organizationId,
  });
  
  try {
    const apiKey = await getClearbitApiKey(organizationId);
    
    if (!apiKey) {
      logger.warn('[Clearbit] API key not configured', { file: 'clearbit-service.ts' });
      return null;
    }

    const response = await fetch(
      `${CLEARBIT_PERSON_API}/people/find?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (response.status === 404) {
      logger.info('Clearbit Person not found for email: email}', { file: 'clearbit-service.ts' });
      return null;
    }

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    return data;
  } catch (error) {
    logger.error('[Clearbit] Error enriching person:', error, { file: 'clearbit-service.ts' });
    return null;
  }
}

/**
 * Combined enrichment (person + company)
 * 
 * @deprecated Use discoverCompany() from @/lib/services/discovery-engine instead
 */
export async function enrichProspect(
  email: string,
  organizationId: string
): Promise<{
  person: ClearbitPerson | null;
  company: ClearbitCompany | null;
}> {
  logger.warn('[DEPRECATED] enrichProspect is deprecated. Use discovery-engine.ts instead.', {
    email,
    organizationId,
  });
  
  try {
    const apiKey = await getClearbitApiKey(organizationId);
    
    if (!apiKey) {
      return { person: null, company: null };
    }

    const response = await fetch(
      `https://person.clearbit.com/v2/combined/find?email=${encodeURIComponent(email)}`,
      {
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return { person: null, company: null };
    }

    const data = await response.json();
    return {
      person: data.person || null,
      company: data.company || null,
    };
  } catch (error) {
    logger.error('[Clearbit] Error enriching prospect:', error, { file: 'clearbit-service.ts' });
    return { person: null, company: null };
  }
}

/**
 * Get Clearbit API key from organization settings
 */
async function getClearbitApiKey(organizationId: string): Promise<string | null> {
  try {
    // Try environment variable first
    if (process.env.CLEARBIT_API_KEY) {
      return process.env.CLEARBIT_API_KEY;
    }

    // Try organization API keys
    const keys = await apiKeyService.getKeys(organizationId);
    return keys?.enrichment?.clearbitApiKey || null;
  } catch (error) {
    logger.error('[Clearbit] Error getting API key:', error, { file: 'clearbit-service.ts' });
    return null;
  }
}

/**
 * Guess domain from company name
 */
function guessDomainFromCompanyName(companyName: string): string {
  return `${companyName
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/inc|llc|ltd|corp|corporation|company|co/g, '')
     }.com`;
}

/**
 * Format Clearbit company data for our system
 */
export function formatClearbitCompanyData(company: ClearbitCompany): {
  name: string;
  website: string;
  domain: string;
  industry: string;
  size: string;
  description: string;
  location?: string;
  founded?: string;
  employees?: number;
  revenue?: string;
  technologies?: string[];
} {
  return {
    name: company.name,
    website: company.url,
    domain: company.domain,
    industry: company.category?.industry || company.category?.sector || 'Unknown',
    size: company.metrics?.employeesRange || 
          (company.metrics?.employees ? `${company.metrics.employees} employees` : 'Unknown'),
    description: company.description || '',
    location: company.location || 
              (company.geo?.city && company.geo?.state ? 
                `${company.geo.city}, ${company.geo.state}` : undefined),
    founded: company.foundedYear?.toString(),
    employees: company.metrics?.employees,
    revenue: company.metrics?.estimatedAnnualRevenue,
    technologies: company.tech || [],
  };
}



















