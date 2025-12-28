/**
 * LinkedIn Jobs Service
 * Detect hiring signals from job postings
 * Uses RapidAPI LinkedIn endpoints or web scraping
 */

import { apiKeyService } from '@/lib/api-keys/api-key-service'
import { logger } from '@/lib/logger/logger';;

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
  organizationId: string,
  maxResults: number = 10
): Promise<LinkedInJob[]> {
  try {
    const apiKey = await getLinkedInApiKey(organizationId);
    
    if (apiKey) {
      // Use RapidAPI LinkedIn API if available
      return await getJobsFromRapidAPI(companyName, apiKey, maxResults);
    } else {
      // Fallback to LinkedIn public job search
      return await getJobsFromPublicSearch(companyName, maxResults);
    }
  } catch (error) {
    logger.error('[LinkedIn] Error fetching jobs:', error, { file: 'linkedin-service.ts' });
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
      logger.error('[LinkedIn RapidAPI] Error: ${response.status}', new Error('[LinkedIn RapidAPI] Error: ${response.status}'), { file: 'linkedin-service.ts' });
      return [];
    }

    const data = await response.json();
    
    if (!data.data || data.data.length === 0) {
      return [];
    }

    return data.data.slice(0, maxResults).map((job: any) => ({
      title: job.title,
      department: extractDepartment(job.title),
      url: job.url || `https://www.linkedin.com/jobs/view/${job.id}`,
      postedDate: job.postedAt || new Date().toISOString(),
      location: job.location,
      jobType: job.type,
      seniority: extractSeniority(job.title),
    }));
  } catch (error) {
    logger.error('[LinkedIn RapidAPI] Error:', error, { file: 'linkedin-service.ts' });
    return [];
  }
}

/**
 * Get jobs from LinkedIn public job search (no API key needed)
 */
async function getJobsFromPublicSearch(
  companyName: string,
  maxResults: number
): Promise<LinkedInJob[]> {
  try {
    // Use LinkedIn's public job search
    const searchUrl = `https://www.linkedin.com/jobs/search/?keywords=${encodeURIComponent(companyName)}&position=1&pageNum=0`;
    
    const response = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    });

    if (!response.ok) {
      logger.info('[LinkedIn] Public search unavailable', { file: 'linkedin-service.ts' });
      return [];
    }

    const html = await response.text();
    
    // Parse job listings from HTML
    const jobs: LinkedInJob[] = [];
    const jobRegex = /<li class="result-card[^"]*"[\s\S]*?<\/li>/g;
    const matches = html.matchAll(jobRegex);
    
    for (const match of matches) {
      if (jobs.length >= maxResults) break;
      
      const jobHtml = match[0];
      
      const titleMatch = jobHtml.match(/<h3[^>]*>([\s\S]*?)<\/h3>/);
      const urlMatch = jobHtml.match(/href="([^"]*)"/);
      const locationMatch = jobHtml.match(/<span class="job-result-card__location"[^>]*>([\s\S]*?)<\/span>/);
      const dateMatch = jobHtml.match(/<time[^>]*datetime="([^"]*)"/);
      
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
  } catch (error) {
    logger.error('[LinkedIn] Public search error:', error, { file: 'linkedin-service.ts' });
    return generateFallbackJobs(companyName);
  }
}

/**
 * Generate fallback job data (when scraping fails)
 */
function generateFallbackJobs(companyName: string): LinkedInJob[] {
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
async function getLinkedInApiKey(organizationId: string): Promise<string | null> {
  try {
    // Try environment variable first
    if (process.env.RAPIDAPI_KEY) {
      return process.env.RAPIDAPI_KEY;
    }

    // Try organization API keys
    const keys = await apiKeyService.getKeys(organizationId);
    return keys?.enrichment?.rapidApiKey || null;
  } catch (error) {
    logger.error('[LinkedIn] Error getting API key:', error, { file: 'linkedin-service.ts' });
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



















