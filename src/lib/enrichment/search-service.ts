/**
 * Search Service
 * Uses cheap search APIs to find company information
 * Cost: ~$1 per 1000 searches (vs $500-1000 for Clearbit)
 */

import type { CompanySearchResult } from './types';

/**
 * Search for a company using multiple strategies
 */
export async function searchCompany(query: string): Promise<CompanySearchResult[]> {
  console.log(`[Search Service] Searching for: ${query}`);
  
  try {
    // Try Google search first (most reliable)
    const googleResults = await searchGoogle(query);
    
    if (googleResults.length > 0) {
      return googleResults;
    }
    
    // Fallback: construct likely domain
    const likelyDomain = guessDomainFromCompanyName(query);
    
    return [{
      name: query,
      website: `https://${likelyDomain}`,
      domain: likelyDomain,
      snippet: `Estimated website for ${query}`,
      source: 'domain-guess',
    }];
  } catch (error: any) {
    console.error('[Search Service] Error:', error.message);
    
    // Last resort: guess the domain
    const likelyDomain = guessDomainFromCompanyName(query);
    return [{
      name: query,
      website: `https://${likelyDomain}`,
      domain: likelyDomain,
      snippet: `Fallback domain for ${query}`,
      source: 'fallback',
    }];
  }
}

/**
 * Search Google using custom search or scraping
 * Can use: Serper API, Google Custom Search, or SerpAPI
 */
async function searchGoogle(query: string): Promise<CompanySearchResult[]> {
  const searchQuery = `${query} official website`;
  
  // Option 1: Use Serper API (if configured)
  const serperKey = process.env.SERPER_API_KEY;
  if (serperKey) {
    return await searchWithSerper(searchQuery, serperKey);
  }
  
  // Option 2: Use Google Custom Search (if configured)
  const googleApiKey = process.env.GOOGLE_SEARCH_API_KEY;
  const googleCx = process.env.GOOGLE_SEARCH_CX;
  if (googleApiKey && googleCx) {
    return await searchWithGoogleCustomSearch(searchQuery, googleApiKey, googleCx);
  }
  
  // Option 3: Direct Google search (less reliable, may get blocked)
  return await searchGoogleDirect(searchQuery);
}

/**
 * Search using Serper.dev API
 * Cost: $5 per 1000 searches
 */
async function searchWithSerper(query: string, apiKey: string): Promise<CompanySearchResult[]> {
  try {
    const response = await fetch('https://google.serper.dev/search', {
      method: 'POST',
      headers: {
        'X-API-KEY': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: query,
        num: 5,
      }),
    });
    
    if (!response.ok) {
      console.error('[Serper] API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    return (data.organic || []).slice(0, 5).map((result: any) => ({
      name: extractCompanyName(result.title),
      website: result.link,
      domain: extractDomain(result.link),
      snippet: result.snippet || '',
      source: 'serper',
    }));
  } catch (error: any) {
    console.error('[Serper] Error:', error.message);
    return [];
  }
}

/**
 * Search using Google Custom Search API
 * Cost: Free for 100 searches/day, then $5 per 1000 searches
 */
async function searchWithGoogleCustomSearch(
  query: string,
  apiKey: string,
  cx: string
): Promise<CompanySearchResult[]> {
  try {
    const url = `https://www.googleapis.com/customsearch/v1?key=${apiKey}&cx=${cx}&q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url);
    
    if (!response.ok) {
      console.error('[Google Custom Search] API error:', response.status);
      return [];
    }
    
    const data = await response.json();
    
    return (data.items || []).slice(0, 5).map((result: any) => ({
      name: extractCompanyName(result.title),
      website: result.link,
      domain: extractDomain(result.link),
      snippet: result.snippet || '',
      source: 'google-custom-search',
    }));
  } catch (error: any) {
    console.error('[Google Custom Search] Error:', error.message);
    return [];
  }
}

/**
 * Direct Google search (scraping)
 * Use with caution - may get blocked
 */
async function searchGoogleDirect(query: string): Promise<CompanySearchResult[]> {
  try {
    const url = `https://www.google.com/search?q=${encodeURIComponent(query)}`;
    
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const html = await response.text();
    
    // Basic parsing of Google results
    // This is fragile and may break, but works as last resort
    const results: CompanySearchResult[] = [];
    
    // Extract URLs from search results (simple regex)
    const urlMatches = html.matchAll(/href="(https?:\/\/[^"]+)"/g);
    
    for (const match of urlMatches) {
      const url = match[1];
      
      // Skip Google's own URLs
      if (url.includes('google.com')) continue;
      
      const domain = extractDomain(url);
      
      results.push({
        name: extractCompanyName(domain),
        website: url,
        domain,
        snippet: '',
        source: 'google-direct',
      });
      
      if (results.length >= 5) break;
    }
    
    return results;
  } catch (error: any) {
    console.error('[Google Direct] Error:', error.message);
    return [];
  }
}

/**
 * Search for company news using NewsAPI or similar
 */
export async function searchCompanyNews(companyName: string, limit: number = 5): Promise<Array<{
  title: string;
  url: string;
  publishedDate: string;
  source: string;
  summary?: string;
}>> {
  try {
    const newsApiKey = process.env.NEWS_API_KEY;
    
    if (!newsApiKey) {
      console.warn('[Search Service] NEWS_API_KEY not configured');
      return [];
    }
    
    const response = await fetch(
      `https://newsapi.org/v2/everything?q=${encodeURIComponent(companyName)}&sortBy=publishedAt&pageSize=${limit}&apiKey=${newsApiKey}`
    );
    
    if (!response.ok) {
      return [];
    }
    
    const data = await response.json();
    
    return (data.articles || []).map((article: any) => ({
      title: article.title,
      url: article.url,
      publishedDate: article.publishedAt,
      source: article.source.name,
      summary: article.description,
    }));
  } catch (error: any) {
    console.error('[Search Service] News search error:', error.message);
    return [];
  }
}

/**
 * Guess domain from company name
 */
export function guessDomainFromCompanyName(companyName: string): string {
  return companyName
    .toLowerCase()
    .replace(/\s+/g, '') // Remove spaces
    .replace(/[^a-z0-9]/g, '') // Remove special chars
    .replace(/inc|llc|ltd|corp|corporation|company|co$/g, '') // Remove business suffixes
    + '.com';
}

/**
 * Extract domain from URL
 */
function extractDomain(url: string): string {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace('www.', '');
  } catch {
    return url;
  }
}

/**
 * Extract company name from title or domain
 */
function extractCompanyName(text: string): string {
  // Remove common suffixes
  return text
    .replace(/\s*-\s*.*$/, '') // Remove everything after dash
    .replace(/\|.*$/, '') // Remove everything after pipe
    .replace(/\s*\(.*\)$/, '') // Remove parenthetical
    .replace(/\s*(Inc|LLC|Ltd|Corp|Corporation|Company|Co)\s*$/i, '')
    .trim();
}

/**
 * Search for company on LinkedIn
 */
export async function searchLinkedIn(companyName: string): Promise<string | null> {
  // LinkedIn company URL format: linkedin.com/company/company-slug
  const slug = companyName
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
  
  const possibleUrl = `https://www.linkedin.com/company/${slug}`;
  
  try {
    // Check if URL exists
    const response = await fetch(possibleUrl, {
      method: 'HEAD',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (response.ok) {
      return possibleUrl;
    }
  } catch {
    // URL doesn't exist
  }
  
  return null;
}

/**
 * Search for company tech stack using BuiltWith alternative
 * (We can scrape this from the website directly)
 */
export async function detectTechStack(domain: string): Promise<string[]> {
  try {
    const response = await fetch(`https://${domain}`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });
    
    if (!response.ok) {
      return [];
    }
    
    const html = await response.text();
    const techStack: string[] = [];
    
    // Detect common technologies from HTML
    if (html.includes('react')) techStack.push('React');
    if (html.includes('vue')) techStack.push('Vue.js');
    if (html.includes('angular')) techStack.push('Angular');
    if (html.includes('next')) techStack.push('Next.js');
    if (html.includes('shopify')) techStack.push('Shopify');
    if (html.includes('wordpress')) techStack.push('WordPress');
    if (html.includes('wix')) techStack.push('Wix');
    if (html.includes('squarespace')) techStack.push('Squarespace');
    if (html.includes('stripe')) techStack.push('Stripe');
    if (html.includes('paypal')) techStack.push('PayPal');
    if (html.includes('google-analytics') || html.includes('gtag')) techStack.push('Google Analytics');
    if (html.includes('hubspot')) techStack.push('HubSpot');
    if (html.includes('salesforce')) techStack.push('Salesforce');
    if (html.includes('intercom')) techStack.push('Intercom');
    if (html.includes('segment')) techStack.push('Segment');
    
    // Check headers for server tech
    const serverHeader = response.headers.get('server');
    if (serverHeader) {
      if (serverHeader.includes('nginx')) techStack.push('Nginx');
      if (serverHeader.includes('Apache')) techStack.push('Apache');
      if (serverHeader.includes('cloudflare')) techStack.push('Cloudflare');
    }
    
    return [...new Set(techStack)]; // Remove duplicates
  } catch (error) {
    return [];
  }
}

