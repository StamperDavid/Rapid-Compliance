/**
 * Prospect Research Service
 * Researches companies and prospects to enable personalized outreach
 */

import { logger } from '../logger/logger';

export interface ProspectResearch {
  companyInfo: CompanyInfo;
  recentNews: NewsItem[];
  fundingInfo?: FundingInfo;
  techStack?: string[];
  hiringSignals?: JobPosting[];
  socialPresence: SocialPresence;
  insights: string[]; // AI-generated insights for personalization
}

export interface CompanyInfo {
  name: string;
  website: string;
  domain: string;
  industry: string;
  size: string;
  description: string;
  location?: string;
  founded?: string;
}

export interface NewsItem {
  title: string;
  url: string;
  publishedDate: string;
  source: string;
  summary?: string;
}

export interface FundingInfo {
  totalFunding?: string;
  lastRound?: {
    amount: string;
    roundType: string;
    date: string;
    investors?: string[];
  };
}

export interface JobPosting {
  title: string;
  department: string;
  url: string;
  postedDate: string;
}

export interface SocialPresence {
  linkedin?: string;
  twitter?: string;
  facebook?: string;
}

export interface ProspectData {
  name: string;
  company: string;
  title?: string;
  email?: string;
  linkedin?: string;
}

/**
 * Research a prospect's company and extract insights for personalization
 */
export async function researchProspect(
  prospect: ProspectData,
  organizationId: string = 'default'
): Promise<ProspectResearch> {
  logger.info('Prospect Research Researching prospect.company}...', { file: 'prospect-research.ts' });

  try {
    // Run research tasks in parallel
    const [companyInfo, news, funding, tech, hiring, social] = await Promise.all([
      getCompanyInfo(prospect.company, organizationId),
      getRecentNews(prospect.company, organizationId),
      getFundingInfo(prospect.company, organizationId),
      getTechStack(prospect.company, organizationId),
      getHiringSignals(prospect.company, organizationId),
      getSocialPresence(prospect.company, organizationId),
    ]);

    // Generate AI insights from the research
    const insights = generateInsights({
      companyInfo,
      news,
      funding,
      tech,
      hiring,
      prospect,
    });

    return {
      companyInfo,
      recentNews: news,
      fundingInfo: funding,
      techStack: tech,
      hiringSignals: hiring,
      socialPresence: social,
      insights,
    };
  } catch (error) {
    logger.error('[Prospect Research] Error:', error instanceof Error ? error : undefined, { file: 'prospect-research.ts' });

    // Return minimal data on error
    return {
      companyInfo: {
        name: prospect.company,
        website: '',
        domain: '',
        industry: 'Unknown',
        size: 'Unknown',
        description: '',
      },
      recentNews: [],
      socialPresence: {},
      insights: [`Researching ${prospect.company}`],
    };
  }
}

/**
 * Get company information using NEW enrichment service (no Clearbit!)
 * Cost: ~$0.001 per lead (vs $0.50-$1.00 with Clearbit)
 */
async function getCompanyInfo(companyName: string, orgId: string): Promise<CompanyInfo> {
  const { enrichCompany } = await import('../enrichment/enrichment-service');
  
  try {
    // Use our new enrichment service
    const result = await enrichCompany(
      {
        companyName,
        includeNews: false, // We get news separately
        includeJobs: false, // We get hiring signals separately
        includeSocial: false, // We get social separately
      },
      orgId
    );
    
    if (result.success && result.data) {
      const data = result.data;
      return {
        name: data.name,
        website: data.website,
        domain: data.domain,
        industry: data.industry,
        size:data.employeeRange ?? data.size,
        description: data.description,
        location: data.headquarters?.city && data.headquarters?.state
          ? `${data.headquarters.city}, ${data.headquarters.state}`
          : undefined,
        founded: data.foundedYear?.toString(),
      };
    }
  } catch (error) {
    logger.error('[getCompanyInfo] Enrichment error:', error instanceof Error ? error : undefined, { file: 'prospect-research.ts' });
  }

  // Fallback to basic info if enrichment fails
  const domain = guessDomainFromCompanyName(companyName);
  return {
    name: companyName,
    website: `https://${domain}`,
    domain,
    industry: 'Unknown',
    size: 'Unknown',
    description: '',
  };
}

function guessDomainFromCompanyName(companyName: string): string {
  return `${companyName
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/inc|llc|ltd|corp|corporation|company|co$/g, '')
     }.com`;
}

/**
 * Get recent news about the company
 */
async function getRecentNews(companyName: string, _orgId: string): Promise<NewsItem[]> {
  const { searchCompanyNews } = await import('../enrichment/search-service');
  
  return searchCompanyNews(companyName, 5);
}

/**
 * Get funding information
 */
async function getFundingInfo(companyName: string, orgId: string): Promise<FundingInfo | undefined> {
  const { searchOrganization, formatFundingData } = await import('./apis/crunchbase-service');
  
  const organization = await searchOrganization(companyName, orgId);
  
  if (!organization) {
    return undefined;
  }
  
  const formatted = formatFundingData(organization);
  
  if (!formatted.totalFunding && !formatted.lastRound) {
    return undefined;
  }
  
  return {
    totalFunding: formatted.totalFunding,
    lastRound: formatted.lastRound ? {
      amount: formatted.lastRound.amount,
      roundType: formatted.lastRound.roundType,
      date: formatted.lastRound.date,
      investors: formatted.lastRound.investors,
    } : undefined,
  };
}

/**
 * Detect technology stack using our free scraper
 */
async function getTechStack(companyName: string, _orgId: string): Promise<string[]> {
  const { detectTechStack } = await import('../enrichment/search-service');
  
  const domain = guessDomainFromCompanyName(companyName);
  
  return detectTechStack(domain);
}

/**
 * Find hiring signals (job postings) by scraping careers page
 */
async function getHiringSignals(companyName: string, _orgId: string): Promise<JobPosting[]> {
  const { scrapeCareersPage } = await import('../enrichment/web-scraper');
  
  try {
    const domain = guessDomainFromCompanyName(companyName);
    const careers = await scrapeCareersPage(`https://${domain}`);
    
    return careers.jobs.map(job => ({
      title: job.title,
      department: 'Unknown',
      url: job.url,
      postedDate: new Date().toISOString(),
    }));
  } catch (_error) {
    return [];
  }
}

/**
 * Get social media presence by scraping the company website
 */
async function getSocialPresence(companyName: string, _orgId: string): Promise<SocialPresence> {
  const { searchLinkedIn } = await import('../enrichment/search-service');
  const { scrapeWebsite, extractDataPoints } = await import('../enrichment/web-scraper');
  
  try {
    // Scrape website to find social links
    const domain = guessDomainFromCompanyName(companyName);
    const content = await scrapeWebsite(`https://${domain}`);
    const dataPoints = extractDataPoints(content);
    
    // Also search for LinkedIn profile
    const linkedinUrl = await searchLinkedIn(companyName);
    
    return {
      linkedin:linkedinUrl ?? dataPoints.socialLinks.find(link => link.includes('linkedin.com')),
      twitter: dataPoints.socialLinks.find(link => link.includes('twitter.com') || link.includes('x.com')),
      facebook: dataPoints.socialLinks.find(link => link.includes('facebook.com')),
    };
  } catch (_error) {
    // Fallback: generate likely URLs
    const companySlug = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    return {
      linkedin: `https://linkedin.com/company/${companySlug}`,
      twitter: `https://twitter.com/${companySlug}`,
    };
  }
}

/**
 * Generate AI-powered insights for personalization
 */
function generateInsights(data: {
  companyInfo: CompanyInfo;
  news: NewsItem[];
  funding?: FundingInfo;
  tech?: string[];
  hiring?: JobPosting[];
  prospect: ProspectData;
}): string[] {
  const insights: string[] = [];

  // Company size insight
  if (data.companyInfo.size) {
    insights.push(`${data.companyInfo.name} is a ${data.companyInfo.size} company`);
  }

  // Recent news insight
  if (data.news && data.news.length > 0) {
    insights.push(`Recently in the news: ${data.news[0].title}`);
  }

  // Funding insight
  if (data.funding?.lastRound) {
    insights.push(`Raised ${data.funding.lastRound.amount} in ${data.funding.lastRound.roundType}`);
  }

  // Hiring insight
  if (data.hiring && data.hiring.length > 0) {
    const departments = Array.from(new Set(data.hiring.map(j => j.department)));
    insights.push(`Actively hiring in ${departments.join(', ')}`);
  }

  // Tech stack insight
  if (data.tech && data.tech.length > 0) {
    insights.push(`Uses ${data.tech.slice(0, 3).join(', ')}`);
  }

  // Industry insight
  if (data.companyInfo.industry) {
    insights.push(`Operating in ${data.companyInfo.industry} industry`);
  }

  return insights;
}

/**
 * Extract pain points based on research
 */
export function extractPainPoints(research: ProspectResearch): string[] {
  const painPoints: string[] = [];
  
  // Hiring signals = scaling challenges
  if (research.hiringSignals && research.hiringSignals.length > 2) {
    painPoints.push('Scaling their team rapidly');
  }
  
  // Recent funding = need to show ROI
  if (research.fundingInfo?.lastRound) {
    painPoints.push('Need to demonstrate growth and ROI to investors');
  }
  
  // Industry-specific pain points
  if (research.companyInfo.industry.toLowerCase().includes('saas')) {
    painPoints.push('Customer acquisition costs');
    painPoints.push('Improving conversion rates');
  }
  
  if (research.companyInfo.industry.toLowerCase().includes('ecommerce')) {
    painPoints.push('Cart abandonment');
    painPoints.push('Customer retention');
  }
  
  return painPoints;
}

/**
 * Generate personalization tokens for email templates
 */
export function generatePersonalizationTokens(
  prospect: ProspectData,
  research: ProspectResearch
): Record<string, string> {
  return {
    firstName: prospect.name.split(' ')[0],
    lastName: prospect.name.split(' ').slice(1).join(' '),
    fullName: prospect.name,
    company: research.companyInfo.name,
    title:(prospect.title !== '' && prospect.title != null) ? prospect.title : 'there',
    industry: research.companyInfo.industry,
    companySize: research.companyInfo.size,
    recentNews: research.recentNews[0]?.title || '',
    insight1: research.insights[0] || '',
    insight2: research.insights[1] || '',
    insight3: research.insights[2] || '',
  };
}




