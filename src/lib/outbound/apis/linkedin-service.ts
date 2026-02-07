/**
 * LinkedIn Jobs Service
 * Detect hiring signals from job postings
 * Uses RapidAPI LinkedIn endpoints or web scraping
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service'
import { logger } from '@/lib/logger/logger';

export interface LinkedInJob {
  title: string;
  department: string;
  url: string;
  postedDate: string;
  location?: string;
  jobType?: string; // 'full-time', 'part-time', 'contract'
  seniority?: string; // 'entry', 'mid', 'senior', 'executive'
}

/**
 * Get job postings for a company
 */
export async function getCompanyJobs(
  companyName: string,
  maxResults: number = 10
): Promise<LinkedInJob[]> {
  try {
    const apiKey = await getLinkedInApiKey();
    
    if (apiKey) {
      // Use RapidAPI LinkedIn API if available
      return await getJobsFromRapidAPI(companyName, apiKey, maxResults);
    } else {
      // Fallback to LinkedIn public job search
      return await getJobsFromPublicSearch(companyName, maxResults);
    }
  } catch (error) {
    logger.error('[LinkedIn] Error fetching jobs:', error instanceof Error ? error : new Error(String(error)), { file: 'linkedin-service.ts' });
    return [];
  }
}

/**
 * Get jobs using RapidAPI LinkedIn endpoint
 */
async function getJobsFromRapidAPI(
  companyName: string,
  apiKey: string,
  maxResults: number
): Promise<LinkedInJob[]> {
  try {
    const response = await fetch(
      `https://linkedin-data-api.p.rapidapi.com/search-jobs?keywords=${encodeURIComponent(companyName)}&locationId=&datePosted=anyTime&sort=mostRelevant`,
      {
        headers: {
          'X-RapidAPI-Key': apiKey,
          'X-RapidAPI-Host': 'linkedin-data-api.p.rapidapi.com',
        },
      }
    );

    if (!response.ok) {
      logger.error(`[LinkedIn RapidAPI] Error: ${response.status}`, new Error(`[LinkedIn RapidAPI] Error: ${response.status}`), { file: 'linkedin-service.ts' });
      return [];
    }

    const data: unknown = await response.json();

    interface RapidAPIJobResult {
      id: string;
      title: string;
      url?: string;
      postedAt?: string;
      location?: string;
      type?: string;
    }

    interface RapidAPIResponse {
      data?: RapidAPIJobResult[];
    }

    const typedData = data as RapidAPIResponse;

    if (!typedData.data || typedData.data.length === 0) {
      return [];
    }

    return typedData.data.slice(0, maxResults).map((job: RapidAPIJobResult) => ({
      title: job.title,
      department: extractDepartment(job.title),
      url: (job.url !== '' && job.url != null) ? job.url : `https://www.linkedin.com/jobs/view/${job.id}`,
      postedDate: job.postedAt ?? new Date().toISOString(),
      location: job.location,
      jobType: job.type,
      seniority: extractSeniority(job.title),
    }));
  } catch (error) {
    logger.error('[LinkedIn RapidAPI] Error:', error instanceof Error ? error : new Error(String(error)), { file: 'linkedin-service.ts' });
    return [];
  }
}

/**
 * LinkedIn CSS Selectors (Updated February 2026)
 *
 * LinkedIn's public job search uses these CSS class patterns:
 * - Job card container: div.base-card / div.base-search-card / div.job-search-card
 * - Job list items: li.jobs-search-results__list-item
 * - Title: h3.base-search-card__title
 * - Link: a.base-card__full-link
 * - Company: h4.base-search-card__subtitle / a.hidden-nested-link
 * - Location: span.job-search-card__location
 * - Date: time.job-search-card__listdate (datetime attr)
 * - Description: div.show-more-less-html__markup / div.jobs-description__content
 *
 * Authenticated/logged-in selectors (not used here):
 * - div.job-card-container
 * - h3.job-card-container__title
 * - h4.job-card-container__company-name
 * - span.job-card-container__location
 */
const LINKEDIN_SELECTORS = {
  // Job card containers (regex patterns for HTML parsing)
  jobCard: /<div[^>]*class="[^"]*(?:base-card|base-search-card|job-search-card)[^"]*"[^>]*>[\s\S]*?(?=<div[^>]*class="[^"]*(?:base-card|base-search-card|job-search-card)[^"]*"|$)/g,
  jobCardAlt: /<li[^>]*class="[^"]*jobs-search-results__list-item[^"]*"[\s\S]*?<\/li>/g,
  // Individual field selectors
  title: /<h3[^>]*class="[^"]*base-search-card__title[^"]*"[^>]*>([\s\S]*?)<\/h3>/,
  titleFallback: /<h3[^>]*>([\s\S]*?)<\/h3>/,
  link: /<a[^>]*class="[^"]*base-card__full-link[^"]*"[^>]*href="([^"]*)"[^>]*>/,
  linkFallback: /href="(https:\/\/[^"]*linkedin\.com\/jobs\/view\/[^"]*)"/,
  location: /<span[^>]*class="[^"]*job-search-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/,
  locationFallback: /<span[^>]*class="[^"]*job-result-card__location[^"]*"[^>]*>([\s\S]*?)<\/span>/,
  date: /<time[^>]*class="[^"]*job-search-card__listdate[^"]*"[^>]*datetime="([^"]*)"/,
  dateFallback: /<time[^>]*datetime="([^"]*)"/,
  company: /<h4[^>]*class="[^"]*base-search-card__subtitle[^"]*"[^>]*>([\s\S]*?)<\/h4>/,
  // JSON-LD structured data (most reliable when present)
  jsonLd: /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g,
} as const;

/**
 * Get jobs from LinkedIn public job search (no API key needed)
 * Uses LinkedIn's guest jobs API endpoint with updated CSS selectors (Feb 2026)
 */
async function getJobsFromPublicSearch(
  companyName: string,
  maxResults: number
): Promise<LinkedInJob[]> {
  try {
    // Strategy 1: Try the guest API endpoint (more reliable, returns cleaner HTML)
    const guestApiJobs = await getJobsFromGuestApi(companyName, maxResults);
    if (guestApiJobs.length > 0) {
      return guestApiJobs;
    }

    // Strategy 2: Fall back to standard public search page with updated selectors
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(companyName)}&position=1&pageNum=0`;

    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      logger.info('[LinkedIn] Public search unavailable', { file: 'linkedin-service.ts' });
      return [];
    }

    const html = await response.text();

    // Strategy 2a: Try JSON-LD structured data first (most reliable)
    const jsonLdJobs = extractJobsFromJsonLd(html, maxResults);
    if (jsonLdJobs.length > 0) {
      return jsonLdJobs;
    }

    // Strategy 2b: Parse with updated CSS selector patterns
    return parseJobsFromHtml(html, maxResults);
  } catch (error) {
    logger.error('[LinkedIn] Public search error:', error instanceof Error ? error : new Error(String(error)), { file: 'linkedin-service.ts' });
    return generateFallbackJobs(companyName);
  }
}

/**
 * LinkedIn guest API endpoint - returns job listings without auth
 * Endpoint: /jobs-guest/jobs/api/seeMoreJobPostings/search
 */
async function getJobsFromGuestApi(
  companyName: string,
  maxResults: number
): Promise<LinkedInJob[]> {
  try {
    const guestApiUrl = `https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search?keywords=${encodeURIComponent(companyName)}&location=&start=0`;

    const response = await fetch(guestApiUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    });

    if (!response.ok) {
      return [];
    }

    const html = await response.text();
    return parseJobsFromHtml(html, maxResults);
  } catch (_error) {
    logger.info('[LinkedIn] Guest API unavailable, falling back to page scrape', { file: 'linkedin-service.ts' });
    return [];
  }
}

/**
 * Extract jobs from JSON-LD structured data embedded in LinkedIn pages
 */
function extractJobsFromJsonLd(html: string, maxResults: number): LinkedInJob[] {
  const jobs: LinkedInJob[] = [];
  const jsonLdMatches = html.matchAll(LINKEDIN_SELECTORS.jsonLd);

  for (const match of jsonLdMatches) {
    if (jobs.length >= maxResults) {break;}

    try {
      const data: unknown = JSON.parse(match[1]);
      const typed = data as Record<string, unknown>;

      // Handle single JobPosting
      if (typed['@type'] === 'JobPosting') {
        const job = parseJsonLdJob(typed);
        if (job) {jobs.push(job);}
      }

      // Handle ItemList containing JobPostings
      if (typed['@type'] === 'ItemList') {
        const items = typed.itemListElement as Array<Record<string, unknown>> | undefined;
        if (items) {
          for (const item of items) {
            if (jobs.length >= maxResults) {break;}
            const job = parseJsonLdJob(item);
            if (job) {jobs.push(job);}
          }
        }
      }
    } catch (_parseError) {
      // JSON-LD block wasn't valid job data, skip
    }
  }

  return jobs;
}

/**
 * Parse a single job from JSON-LD structured data
 */
function parseJsonLdJob(data: Record<string, unknown>): LinkedInJob | null {
  const title = data.title as string | undefined;
  if (!title) {return null;}

  const location = data.jobLocation as Record<string, unknown> | undefined;
  const address = location?.address as Record<string, unknown> | undefined;
  const locationStr = address?.addressLocality as string | undefined;

  return {
    title,
    department: extractDepartment(title),
    url: (data.url as string) ?? '',
    postedDate: (data.datePosted as string) ?? new Date().toISOString(),
    location: locationStr,
    seniority: extractSeniority(title),
  };
}

/**
 * Parse job listings from HTML using updated LinkedIn CSS selector patterns
 */
function parseJobsFromHtml(html: string, maxResults: number): LinkedInJob[] {
  const jobs: LinkedInJob[] = [];

  // Try primary selectors (base-card / base-search-card / job-search-card)
  let cardMatches = Array.from(html.matchAll(LINKEDIN_SELECTORS.jobCard));

  // Fall back to alternative list-item selectors
  if (cardMatches.length === 0) {
    cardMatches = Array.from(html.matchAll(LINKEDIN_SELECTORS.jobCardAlt));
  }

  for (const match of cardMatches) {
    if (jobs.length >= maxResults) {break;}

    const jobHtml = match[0];

    // Extract title: try base-search-card__title first, then generic h3
    const titleMatch = jobHtml.match(LINKEDIN_SELECTORS.title)
      ?? jobHtml.match(LINKEDIN_SELECTORS.titleFallback);

    // Extract URL: try base-card__full-link first, then LinkedIn job view URL
    const urlMatch = jobHtml.match(LINKEDIN_SELECTORS.link)
      ?? jobHtml.match(LINKEDIN_SELECTORS.linkFallback)
      ?? jobHtml.match(/href="([^"]*)"/);

    // Extract location: try job-search-card__location, then legacy job-result-card__location
    const locationMatch = jobHtml.match(LINKEDIN_SELECTORS.location)
      ?? jobHtml.match(LINKEDIN_SELECTORS.locationFallback);

    // Extract date: try job-search-card__listdate, then generic time element
    const dateMatch = jobHtml.match(LINKEDIN_SELECTORS.date)
      ?? jobHtml.match(LINKEDIN_SELECTORS.dateFallback);

    if (titleMatch && urlMatch) {
      const title = cleanHtml(titleMatch[1]);
      jobs.push({
        title,
        department: extractDepartment(title),
        url: urlMatch[1],
        postedDate: dateMatch ? dateMatch[1] : new Date().toISOString(),
        location: locationMatch ? cleanHtml(locationMatch[1]) : undefined,
        seniority: extractSeniority(title),
      });
    }
  }

  return jobs;
}

/**
 * Generate fallback job data (when scraping fails)
 */
function generateFallbackJobs(_companyName: string): LinkedInJob[] {
  // Return empty array - better than fake data
  // The prospect-research service will handle empty job arrays gracefully
  return [];
}

/**
 * Extract department from job title
 */
function extractDepartment(title: string): string {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('engineer') || titleLower.includes('developer') || titleLower.includes('software')) {
    return 'Engineering';
  }
  if (titleLower.includes('sales') || titleLower.includes('account executive') || titleLower.includes('business development')) {
    return 'Sales';
  }
  if (titleLower.includes('marketing') || titleLower.includes('content') || titleLower.includes('social media')) {
    return 'Marketing';
  }
  if (titleLower.includes('product') || titleLower.includes('pm')) {
    return 'Product';
  }
  if (titleLower.includes('design') || titleLower.includes('ux') || titleLower.includes('ui')) {
    return 'Design';
  }
  if (titleLower.includes('customer success') || titleLower.includes('support')) {
    return 'Customer Success';
  }
  if (titleLower.includes('hr') || titleLower.includes('recruiting') || titleLower.includes('people')) {
    return 'HR';
  }
  if (titleLower.includes('finance') || titleLower.includes('accounting')) {
    return 'Finance';
  }
  if (titleLower.includes('operations') || titleLower.includes('ops')) {
    return 'Operations';
  }
  
  return 'Other';
}

/**
 * Extract seniority from job title
 */
function extractSeniority(title: string): string {
  const titleLower = title.toLowerCase();
  
  if (titleLower.includes('intern') || titleLower.includes('junior') || titleLower.includes('entry')) {
    return 'entry';
  }
  if (titleLower.includes('senior') || titleLower.includes('sr.') || titleLower.includes('lead')) {
    return 'senior';
  }
  if (titleLower.includes('principal') || titleLower.includes('staff') || titleLower.includes('architect')) {
    return 'senior';
  }
  if (titleLower.includes('director') || titleLower.includes('vp') || titleLower.includes('head of') || titleLower.includes('chief')) {
    return 'executive';
  }
  
  return 'mid';
}

/**
 * Clean HTML tags and entities
 */
function cleanHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

/**
 * Get LinkedIn API key (RapidAPI)
 */
async function getLinkedInApiKey(): Promise<string | null> {
  try {
    // Try environment variable first
    if (process.env.RAPIDAPI_KEY) {
      return process.env.RAPIDAPI_KEY;
    }

    // Try organization API keys
    const keys = await apiKeyService.getKeys();
    return keys?.enrichment?.rapidApiKey ?? null;
  } catch (error) {
    logger.error('[LinkedIn] Error getting API key:', error instanceof Error ? error : new Error(String(error)), { file: 'linkedin-service.ts' });
    return null;
  }
}

/**
 * Analyze hiring signals
 */
export function analyzeHiringSignals(jobs: LinkedInJob[]): {
  isHiring: boolean;
  hiringIntensity: 'low' | 'medium' | 'high';
  departmentsHiring: string[];
  seniorityLevels: string[];
  insights: string[];
} {
  const insights: string[] = [];
  
  // Count jobs by department
  const departmentCounts: { [key: string]: number } = {};
  const senioritySet = new Set<string>();
  
  jobs.forEach(job => {
    departmentCounts[job.department] = (departmentCounts[job.department] || 0) + 1;
    if (job.seniority) {
      senioritySet.add(job.seniority);
    }
  });
  
  const departmentsHiring = Object.keys(departmentCounts);
  const seniorityLevels = Array.from(senioritySet);
  
  // Determine hiring intensity
  let hiringIntensity: 'low' | 'medium' | 'high' = 'low';
  if (jobs.length > 10) {
    hiringIntensity = 'high';
  } else if (jobs.length > 5) {
    hiringIntensity = 'medium';
  }
  
  // Generate insights
  if (jobs.length > 0) {
    insights.push(`Actively hiring with ${jobs.length} open positions`);
    
    const topDepartment = Object.entries(departmentCounts)
      .sort((a, b) => b[1] - a[1])[0];
    
    if (topDepartment && topDepartment[1] > 1) {
      insights.push(`Expanding ${topDepartment[0]} team (${topDepartment[1]} roles)`);
    }
    
    if (seniorityLevels.includes('executive')) {
      insights.push('Hiring for leadership positions - likely scaling');
    }
    
    if (departmentsHiring.length > 3) {
      insights.push(`Hiring across ${departmentsHiring.length} departments - rapid growth`);
    }
  }
  
  return {
    isHiring: jobs.length > 0,
    hiringIntensity,
    departmentsHiring,
    seniorityLevels,
    insights,
  };
}



















