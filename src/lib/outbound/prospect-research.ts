/**
 * Prospect Research Service
 * Researches companies and prospects to enable personalized outreach
 */

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
  console.log(`[Prospect Research] Researching ${prospect.company}...`);

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
    const insights = await generateInsights({
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
    console.error('[Prospect Research] Error:', error);
    
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
 * Get company information
 */
async function getCompanyInfo(companyName: string, orgId: string): Promise<CompanyInfo> {
  const { enrichCompanyByDomain, searchCompanyByName, formatClearbitCompanyData } = await import('./apis/clearbit-service');
  
  // Try to guess domain
  const domain = guessDomainFromCompanyName(companyName);
  
  // Try Clearbit by domain first
  let clearbitData = await enrichCompanyByDomain(domain, orgId);
  
  // If not found, try company name search
  if (!clearbitData) {
    clearbitData = await searchCompanyByName(companyName, orgId);
  }
  
  if (clearbitData) {
    const formatted = formatClearbitCompanyData(clearbitData);
    return {
      name: formatted.name,
      website: formatted.website,
      domain: formatted.domain,
      industry: formatted.industry,
      size: formatted.size,
      description: formatted.description,
      location: formatted.location,
      founded: formatted.founded,
    };
  }
  
  // Fallback to basic info
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
  return companyName
    .toLowerCase()
    .replace(/\s+/g, '')
    .replace(/[^a-z0-9]/g, '')
    .replace(/inc|llc|ltd|corp|corporation|company|co$/g, '')
    + '.com';
}

/**
 * Get recent news about the company
 */
async function getRecentNews(companyName: string, orgId: string): Promise<NewsItem[]> {
  const { getCompanyNews } = await import('./apis/news-service');
  
  const articles = await getCompanyNews(companyName, orgId, 5);
  
  return articles.map(article => ({
    title: article.title,
    url: article.url,
    publishedDate: article.publishedDate,
    source: article.source,
    summary: article.summary,
  }));
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
 * Detect technology stack
 */
async function getTechStack(companyName: string, orgId: string): Promise<string[]> {
  const { getTechStack } = await import('./apis/builtwith-service');
  
  const domain = guessDomainFromCompanyName(companyName);
  
  return await getTechStack(domain, orgId);
}

/**
 * Find hiring signals (job postings)
 */
async function getHiringSignals(companyName: string, orgId: string): Promise<JobPosting[]> {
  const { getCompanyJobs } = await import('./apis/linkedin-service');
  
  const jobs = await getCompanyJobs(companyName, orgId, 10);
  
  return jobs.map(job => ({
    title: job.title,
    department: job.department,
    url: job.url,
    postedDate: job.postedDate,
  }));
}

/**
 * Get social media presence
 */
async function getSocialPresence(companyName: string, orgId: string): Promise<SocialPresence> {
  // Try to get from Clearbit data first
  const { searchCompanyByName } = await import('./apis/clearbit-service');
  
  const clearbitData = await searchCompanyByName(companyName, orgId);
  
  if (clearbitData) {
    return {
      linkedin: clearbitData.linkedin?.handle ? `https://linkedin.com/company/${clearbitData.linkedin.handle}` : undefined,
      twitter: clearbitData.twitter?.handle ? `https://twitter.com/${clearbitData.twitter.handle}` : undefined,
      facebook: clearbitData.facebook?.handle ? `https://facebook.com/${clearbitData.facebook.handle}` : undefined,
    };
  }
  
  // Fallback: generate likely URLs
  const companySlug = companyName.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
  
  return {
    linkedin: `https://linkedin.com/company/${companySlug}`,
    twitter: `https://twitter.com/${companySlug}`,
  };
}

/**
 * Generate AI-powered insights for personalization
 */
async function generateInsights(data: {
  companyInfo: CompanyInfo;
  news: NewsItem[];
  funding?: FundingInfo;
  tech?: string[];
  hiring?: JobPosting[];
  prospect: ProspectData;
}): Promise<string[]> {
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
    const departments = [...new Set(data.hiring.map(j => j.department))];
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
    title: prospect.title || 'there',
    industry: research.companyInfo.industry,
    companySize: research.companyInfo.size,
    recentNews: research.recentNews[0]?.title || '',
    insight1: research.insights[0] || '',
    insight2: research.insights[1] || '',
    insight3: research.insights[2] || '',
  };
}




