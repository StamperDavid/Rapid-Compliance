/**
 * Crunchbase API Service
 * Company funding and investor information
 * https://data.crunchbase.com/docs
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service'
import { logger } from '@/lib/logger/logger';;

const CRUNCHBASE_API_BASE = 'https://api.crunchbase.com/api/v4';

export interface CrunchbaseFundingRound {
  id: string;
  type: string; // 'seed', 'series_a', 'series_b', etc.
  announced_on: string;
  money_raised: {
    value: number;
    currency: string;
    value_usd: number;
  };
  num_investors: number;
  lead_investors?: Array<{
    name: string;
    permalink: string;
  }>;
  investors?: Array<{
    name: string;
    permalink: string;
  }>;
}

export interface CrunchbaseOrganization {
  uuid: string;
  name: string;
  legal_name?: string;
  permalink: string;
  description?: string;
  short_description?: string;
  founded_on?: string;
  website_url?: string;
  facebook_url?: string;
  linkedin_url?: string;
  twitter_url?: string;
  num_employees_enum?: string;
  location_identifiers?: Array<{
    location_type: string;
    value: string;
  }>;
  funding_total?: {
    value: number;
    currency: string;
    value_usd: number;
  };
  num_funding_rounds?: number;
  last_funding_at?: string;
  last_funding_type?: string;
  funding_rounds?: CrunchbaseFundingRound[];
  investors?: Array<{
    name: string;
    permalink: string;
  }>;
}

/**
 * Search for organization by name
 */
export async function searchOrganization(
  companyName: string,
  organizationId: string
): Promise<CrunchbaseOrganization | null> {
  try {
    const apiKey = await getCrunchbaseApiKey(organizationId);
    
    if (!apiKey) {
      logger.warn('[Crunchbase] API key not configured', { file: 'crunchbase-service.ts' });
      return null;
    }

    // Use autocomplete endpoint to find the organization
    const searchResponse = await fetch(
      `${CRUNCHBASE_API_BASE}/autocompletes?query=${encodeURIComponent(companyName)}&collection_ids=organizations`,
      {
        headers: {
          'X-cb-user-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!searchResponse.ok) {
      logger.error('[Crunchbase] Search failed: ${searchResponse.status}', new Error('[Crunchbase] Search failed: ${searchResponse.status}'), { file: 'crunchbase-service.ts' });
      return null;
    }

    const searchData = await searchResponse.json();
    
    if (!searchData.entities || searchData.entities.length === 0) {
      logger.info('Crunchbase No results found for: companyName}', { file: 'crunchbase-service.ts' });
      return null;
    }

    // Get the first match's permalink
    const permalink = searchData.entities[0].identifier.permalink;
    
    // Fetch full organization data
    return await getOrganizationByPermalink(permalink, organizationId);
  } catch (error) {
    logger.error('[Crunchbase] Error searching organization:', error, { file: 'crunchbase-service.ts' });
    return null;
  }
}

/**
 * Get organization by permalink
 */
export async function getOrganizationByPermalink(
  permalink: string,
  organizationId: string
): Promise<CrunchbaseOrganization | null> {
  try {
    const apiKey = await getCrunchbaseApiKey(organizationId);
    
    if (!apiKey) {
      return null;
    }

    const response = await fetch(
      `${CRUNCHBASE_API_BASE}/entities/organizations/${permalink}?field_ids=name,legal_name,short_description,description,founded_on,website_url,facebook_url,linkedin_url,twitter_url,num_employees_enum,location_identifiers,funding_total,num_funding_rounds,last_funding_at,last_funding_type`,
      {
        headers: {
          'X-cb-user-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      logger.error('[Crunchbase] Get organization failed: ${response.status}', new Error('[Crunchbase] Get organization failed: ${response.status}'), { file: 'crunchbase-service.ts' });
      return null;
    }

    const data = await response.json();
    
    // Get funding rounds separately
    const fundingRounds = await getFundingRounds(permalink, organizationId);
    
    return {
      ...data.properties,
      uuid: data.uuid,
      permalink: permalink,
      funding_rounds: fundingRounds,
    };
  } catch (error) {
    logger.error('[Crunchbase] Error getting organization:', error, { file: 'crunchbase-service.ts' });
    return null;
  }
}

/**
 * Get funding rounds for an organization
 */
export async function getFundingRounds(
  permalink: string,
  organizationId: string
): Promise<CrunchbaseFundingRound[]> {
  try {
    const apiKey = await getCrunchbaseApiKey(organizationId);
    
    if (!apiKey) {
      return [];
    }

    const response = await fetch(
      `${CRUNCHBASE_API_BASE}/entities/organizations/${permalink}/funding_rounds?field_ids=announced_on,investment_type,money_raised,num_investors,lead_investors,investors`,
      {
        headers: {
          'X-cb-user-key': apiKey,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.cards?.funding_rounds || [];
  } catch (error) {
    logger.error('[Crunchbase] Error getting funding rounds:', error, { file: 'crunchbase-service.ts' });
    return [];
  }
}

/**
 * Get Crunchbase API key
 */
async function getCrunchbaseApiKey(organizationId: string): Promise<string | null> {
  try {
    // Try environment variable first
    if (process.env.CRUNCHBASE_API_KEY) {
      return process.env.CRUNCHBASE_API_KEY;
    }

    // Try organization API keys
    const keys = await apiKeyService.getKeys(organizationId);
    return keys?.enrichment?.crunchbaseApiKey || null;
  } catch (error) {
    logger.error('[Crunchbase] Error getting API key:', error, { file: 'crunchbase-service.ts' });
    return null;
  }
}

/**
 * Format funding data for display
 */
export function formatFundingData(org: CrunchbaseOrganization): {
  totalFunding?: string;
  lastRound?: {
    amount: string;
    roundType: string;
    date: string;
    investors?: string[];
  };
} {
  const result: any = {};

  if (org.funding_total?.value_usd) {
    result.totalFunding = formatCurrency(org.funding_total.value_usd);
  }

  if (org.funding_rounds && org.funding_rounds.length > 0) {
    // Get most recent round
    const latestRound = org.funding_rounds.sort((a, b) => 
      new Date(b.announced_on).getTime() - new Date(a.announced_on).getTime()
    )[0];

    result.lastRound = {
      amount: formatCurrency(latestRound.money_raised?.value_usd || 0),
      roundType: formatRoundType(latestRound.type),
      date: latestRound.announced_on,
      investors: latestRound.investors?.map(i => i.name).slice(0, 5),
    };
  }

  return result;
}

/**
 * Format round type for display
 */
function formatRoundType(type: string): string {
  const typeMap: Record<string, string> = {
    'seed': 'Seed',
    'series_a': 'Series A',
    'series_b': 'Series B',
    'series_c': 'Series C',
    'series_d': 'Series D',
    'series_e': 'Series E',
    'venture': 'Venture',
    'angel': 'Angel',
    'pre_seed': 'Pre-Seed',
    'equity_crowdfunding': 'Equity Crowdfunding',
    'private_equity': 'Private Equity',
    'debt_financing': 'Debt Financing',
  };

  return typeMap[type] || type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
}

/**
 * Format currency
 */
function formatCurrency(amount: number): string {
  if (amount >= 1_000_000_000) {
    return `$${(amount / 1_000_000_000).toFixed(1)}B`;
  }
  if (amount >= 1_000_000) {
    return `$${(amount / 1_000_000).toFixed(1)}M`;
  }
  if (amount >= 1_000) {
    return `$${(amount / 1_000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}



















