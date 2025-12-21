/**
 * Free Backup Data Sources
 * When web scraping fails, use these FREE sources to get partial data
 * NO paid APIs - all free tier or public data
 */

import type { CompanyEnrichmentData } from './types';

/**
 * Get company data from WHOIS (free)
 */
export async function getWhoisData(domain: string): Promise<Partial<CompanyEnrichmentData>> {
  try {
    console.log(`[WHOIS] Looking up ${domain}...`);
    
    // Use a free WHOIS API
    const response = await fetch(`https://www.whoisxmlapi.com/whoisserver/WhoisService?domainName=${domain}&apiKey=at_00000000000000000000000000000&outputFormat=JSON`);
    
    if (!response.ok) {
      return {};
    }
    
    const data = await response.json();
    const registrant = data.WhoisRecord?.registrant || {};
    
    return {
      headquarters: {
        city: registrant.city,
        state: registrant.state,
        country: registrant.country,
      },
      contactEmail: registrant.email,
      contactPhone: registrant.telephone,
    };
  } catch (error) {
    console.error('[WHOIS] Error:', error);
    return {};
  }
}

/**
 * Get tech stack from DNS records (free)
 * Note: DNS lookups work server-side only (not in browser/edge)
 */
export async function getTechStackFromDNS(domain: string): Promise<string[]> {
  try {
    console.log(`[DNS] Checking tech stack for ${domain}...`);
    
    const techStack: string[] = [];
    
    // Only try DNS if we're in Node.js environment
    if (typeof process !== 'undefined' && process.versions && process.versions.node) {
      try {
        // Dynamic import to avoid edge runtime issues
        const dns = await import('dns').then(mod => mod.promises);
        
        // Check MX records for email provider
        try {
          const mxRecords = await dns.resolveMx(domain);
          
          if (mxRecords && mxRecords.length > 0) {
            const mx = mxRecords[0].exchange.toLowerCase();
            
            if (mx.includes('google')) techStack.push('Google Workspace');
            if (mx.includes('outlook') || mx.includes('microsoft')) techStack.push('Microsoft 365');
            if (mx.includes('mailgun')) techStack.push('Mailgun');
            if (mx.includes('sendgrid')) techStack.push('SendGrid');
          }
        } catch {}
        
        // Check TXT records for verification codes
        try {
          const txtRecords = await dns.resolveTxt(domain);
          const txtString = txtRecords.flat().join(' ').toLowerCase();
          
          if (txtString.includes('google-site-verification')) techStack.push('Google Analytics');
          if (txtString.includes('facebook-domain-verification')) techStack.push('Facebook Pixel');
          if (txtString.includes('stripe-verification')) techStack.push('Stripe');
          if (txtString.includes('v=spf') && txtString.includes('mailchimp')) techStack.push('Mailchimp');
          if (txtString.includes('hubspot')) techStack.push('HubSpot');
        } catch {}
      } catch (error) {
        console.warn('[DNS] DNS module not available in this environment');
      }
    }
    
    return [...new Set(techStack)];
  } catch (error) {
    console.error('[DNS] Error:', error);
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
      console.warn('[Crunchbase] API key not configured');
      return {};
    }
    
    console.log(`[Crunchbase] Looking up ${companyName}...`);
    
    const response = await fetch(
      `https://api.crunchbase.com/api/v4/autocompletes?query=${encodeURIComponent(companyName)}&collection_ids=organizations&user_key=${apiKey}`
    );
    
    if (!response.ok) {
      return {};
    }
    
    const data = await response.json();
    const org = data.entities?.[0];
    
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
    
    const details = await detailsResponse.json();
    const props = details.properties || {};
    
    return {
      description: props.short_description,
      foundedYear: props.founded_on?.year,
      headquarters: {
        city: props.location_identifiers?.[0]?.value,
        country: props.location_identifiers?.[0]?.location_type,
      },
      employeeCount: props.num_employees_enum,
      fundingStage: props.funding_stage,
      revenue: props.revenue_range,
    };
  } catch (error) {
    console.error('[Crunchbase] Error:', error);
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
      console.warn('[Google KG] API key not configured');
      return {};
    }
    
    console.log(`[Google KG] Looking up ${companyName}...`);
    
    const response = await fetch(
      `https://kgsearch.googleapis.com/v1/entities:search?query=${encodeURIComponent(companyName)}&types=Organization&key=${apiKey}&limit=1`
    );
    
    if (!response.ok) {
      return {};
    }
    
    const data = await response.json();
    const entity = data.itemListElement?.[0]?.result;
    
    if (!entity) {
      return {};
    }
    
    return {
      name: entity.name,
      description: entity.description || entity.detailedDescription?.articleBody,
      website: entity.url,
    };
  } catch (error) {
    console.error('[Google KG] Error:', error);
    return {};
  }
}

/**
 * Get company data from Wikipedia API (free)
 */
export async function getWikipediaData(companyName: string): Promise<Partial<CompanyEnrichmentData>> {
  try {
    console.log(`[Wikipedia] Looking up ${companyName}...`);
    
    // Search for page
    const searchResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(companyName)}&format=json&origin=*`
    );
    
    if (!searchResponse.ok) {
      return {};
    }
    
    const searchData = await searchResponse.json();
    const pageTitle = searchData.query?.search?.[0]?.title;
    
    if (!pageTitle) {
      return {};
    }
    
    // Get page extract
    const extractResponse = await fetch(
      `https://en.wikipedia.org/w/api.php?action=query&titles=${encodeURIComponent(pageTitle)}&prop=extracts&exintro=true&format=json&origin=*`
    );
    
    if (!extractResponse.ok) {
      return {};
    }
    
    const extractData = await extractResponse.json();
    const pages = extractData.query?.pages || {};
    const page = Object.values(pages)[0] as any;
    
    if (!page || !page.extract) {
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
  } catch (error) {
    console.error('[Wikipedia] Error:', error);
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
  console.log('[Backup Sources] Fetching from all free sources...');
  
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
    merged.techStack = [...(merged.techStack || []), ...dns];
  }
  
  console.log('[Backup Sources] Merged data from backup sources');
  
  return merged;
}
