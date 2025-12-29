/**
 * Native Discovery Engine
 * 
 * This service is 100% native and relies on zero third-party data APIs.
 * 
 * HUNTER-CLOSER COMPLIANCE:
 * - Replaces Clearbit, ZoomInfo, Apollo with our own scraping
 * - Checks discoveryArchive first (30-day cache)
 * - Uses BrowserController for intelligent web scraping
 * - LLM synthesis of raw data into structured Lead Objects
 * - Builds proprietary competitive moat
 * 
 * Data Extraction Targets:
 * - Team members (About, Team pages)
 * - Tech stack (footer scripts, meta tags, job postings)
 * - Press mentions (News, Press pages)
 * - Contact information
 * - Company size indicators
 * - Recent activity signals
 */

import { logger } from '@/lib/logger/logger';
import { BrowserController, createBrowserController } from './BrowserController';
import { 
  saveToDiscoveryArchive, 
  getFromDiscoveryArchiveByHash,
  calculateContentHash 
} from '@/lib/scraper-intelligence/discovery-archive-service';
import { sendUnifiedChatMessage } from '@/lib/ai/unified-ai-service';
import type { TemporaryScrape } from '@/types/scraper-intelligence';

// ============================================================================
// TYPES
// ============================================================================

export interface DiscoveredCompany {
  domain: string;
  companyName?: string;
  description?: string;
  industry?: string;
  size?: string;
  location?: string;
  
  // Team data
  teamMembers: Array<{
    name: string;
    title?: string;
    imageUrl?: string;
    linkedinUrl?: string;
    email?: string;
  }>;
  
  // Tech stack
  techStack: Array<{
    name: string;
    category: 'frontend' | 'backend' | 'analytics' | 'marketing' | 'infrastructure' | 'other';
    confidence: number;
  }>;
  
  // Press & news
  pressmentions: Array<{
    title: string;
    url?: string;
    date?: string;
    summary?: string;
  }>;
  
  // Contact info
  contactInfo: {
    email?: string;
    phone?: string;
    address?: string;
    socialMedia?: {
      linkedin?: string;
      twitter?: string;
      facebook?: string;
    };
  };
  
  // Signals
  signals: {
    isHiring: boolean;
    jobCount: number;
    recentActivity: boolean;
    fundingStage?: string;
    growthIndicators: string[];
  };
  
  // Metadata
  metadata: {
    scrapedAt: Date;
    expiresAt: Date;
    source: 'discovery-engine';
    confidence: number;
  };
}

export interface DiscoveryResult {
  company: DiscoveredCompany;
  rawData: RawScrapedData;
  fromCache: boolean;
  scrapeId: string;
}

export interface RawScrapedData {
  url: string;
  html: string;
  text: string;
  highValueAreas: Array<{
    type: string;
    content: string;
    selector: string;
  }>;
  links: Array<{
    href: string;
    text: string;
    type?: string;
  }>;
  teamMembers: Array<any>;
  techStack: Array<any>;
  careerData: any;
}

// ============================================================================
// MAIN DISCOVERY FUNCTION
// ============================================================================

/**
 * Discover company data from domain
 * 
 * This is the main entry point for company discovery.
 * Checks 30-day cache first, then scrapes if needed.
 * 
 * @param domain - Company domain (e.g., 'example.com')
 * @param organizationId - Organization requesting the discovery
 * @returns Complete discovery result with company data
 * 
 * @example
 * ```typescript
 * const result = await discoverCompany('stripe.com', 'org_123');
 * console.log(`Found ${result.company.teamMembers.length} team members`);
 * console.log(`From cache: ${result.fromCache}`);
 * ```
 */
export async function discoverCompany(
  domain: string,
  organizationId: string
): Promise<DiscoveryResult> {
  try {
    logger.info('Starting company discovery', {
      domain,
      organizationId,
      source: 'native-discovery-engine',
    });

    // Step 1: Check discoveryArchive (30-day cache)
    const cached = await checkDiscoveryArchive(domain, organizationId);
    if (cached) {
      logger.info('Discovery archive HIT - serving from cache', {
        domain,
        organizationId,
        cacheAge: Date.now() - cached.scrape.createdAt.getTime(),
        message: 'Cost savings achieved - no scraping needed',
      });

      return {
        company: JSON.parse(cached.scrape.cleanedContent) as DiscoveredCompany,
        rawData: JSON.parse(cached.scrape.rawHtml) as RawScrapedData,
        fromCache: true,
        scrapeId: cached.scrape.id,
      };
    }

    // Step 2: Cache MISS - perform native scraping
    logger.info('Discovery archive MISS - initiating scrape', {
      domain,
      organizationId,
      message: 'Building proprietary moat',
    });

    const rawData = await scrapeCompanyData(domain);

    // Step 3: Synthesize structured data with LLM
    const company = await synthesizeLeadObject(domain, rawData);

    // Step 4: Save to discoveryArchive (30-day TTL)
    const scrapeResult = await saveToArchive(domain, organizationId, company, rawData);

    logger.info('Company discovery complete', {
      domain,
      organizationId,
      teamMembersFound: company.teamMembers.length,
      techStackFound: company.techStack.length,
      fromCache: false,
    });

    return {
      company,
      rawData,
      fromCache: false,
      scrapeId: scrapeResult.scrape.id,
    };
  } catch (error) {
    logger.error('Failed to discover company', error, {
      domain,
      organizationId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to discover company ${domain}: ${errorMessage}`);
  }
}

// ============================================================================
// CACHE CHECKING
// ============================================================================

/**
 * Check if company data exists in discoveryArchive (30-day cache)
 */
async function checkDiscoveryArchive(
  domain: string,
  organizationId: string
): Promise<{ scrape: TemporaryScrape } | null> {
  try {
    // We'll use URL as the cache key
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    const contentHash = calculateContentHash(url);

    const cached = await getFromDiscoveryArchiveByHash(organizationId, contentHash);
    
    if (!cached) {
      return null;
    }

    // Check if still valid (not expired)
    if (cached.expiresAt < new Date()) {
      logger.info('Discovery archive entry expired', {
        domain,
        expiresAt: cached.expiresAt,
      });
      return null;
    }

    return { scrape: cached };
  } catch (error) {
    logger.warn('Failed to check discovery archive', {
      domain,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
}

// ============================================================================
// WEB SCRAPING
// ============================================================================

/**
 * Scrape company data using BrowserController
 * 
 * Orchestrates Playwright browser to visit domain and extract data.
 * Uses stealth mode to avoid detection.
 */
async function scrapeCompanyData(domain: string): Promise<RawScrapedData> {
  const controller = createBrowserController({ headless: true });
  
  try {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;
    
    logger.info('Starting web scrape', { domain, url });

    // Navigate to domain
    await controller.navigate(url);

    // Extract high-value areas
    const highValueAreas = await controller.identifyHighValueAreas();
    
    // Extract detailed data from each area
    const areaContents = await Promise.all(
      highValueAreas.slice(0, 10).map(async (area) => {
        try {
          const extracted = await controller.extractFromArea(area);
          return {
            type: area.type,
            content: typeof extracted.content === 'string' 
              ? extracted.content 
              : JSON.stringify(extracted.content),
            selector: area.selector,
          };
        } catch (error) {
          logger.warn('Failed to extract from area', {
            type: area.type,
            error: error instanceof Error ? error.message : 'Unknown',
          });
          return null;
        }
      })
    );

    // Get links
    const links = await controller.findFooterLinks();

    // Get team members
    const teamMembers = await controller.findTeamDirectory();

    // Get tech stack
    const techStack = await controller.extractTechStack();

    // Get career data
    const careerData = await controller.findCareerPortal();

    // Get full HTML and text
    const html = await controller.getContent();
    const text = await controller.getTextContent();

    logger.info('Web scrape complete', {
      domain,
      highValueAreas: areaContents.filter(a => a !== null).length,
      linksFound: links.length,
      teamMembersFound: teamMembers.length,
      techStackFound: techStack.length,
    });

    return {
      url,
      html: html.substring(0, 100000), // Limit size
      text: text.substring(0, 50000),
      highValueAreas: areaContents.filter((a): a is NonNullable<typeof a> => a !== null),
      links,
      teamMembers,
      techStack,
      careerData,
    };
  } catch (error) {
    logger.error('Failed to scrape company data', error, { domain });
    throw error;
  } finally {
    await controller.close();
  }
}

// ============================================================================
// LLM SYNTHESIS
// ============================================================================

/**
 * Synthesize structured Lead Object from raw scraped data
 * 
 * Uses LLM to extract meaningful information from raw HTML/text
 * and structure it into a clean DiscoveredCompany object.
 */
async function synthesizeLeadObject(
  domain: string,
  rawData: RawScrapedData
): Promise<DiscoveredCompany> {
  try {
    logger.info('Synthesizing lead object with LLM', { domain });

    // Build prompt for LLM
    const prompt = buildSynthesisPrompt(domain, rawData);

    // Generate structured data with LLM
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
      temperature: 0.1, // Low temperature for consistent extraction
      maxTokens: 2000,
    });

    // Parse LLM response
    let synthesized: Partial<DiscoveredCompany>;
    try {
      // Try to extract JSON from response text
      const content = response.text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        synthesized = JSON.parse(jsonMatch[0]);
      } else {
        synthesized = JSON.parse(content);
      }
    } catch (parseError) {
      logger.warn('Failed to parse LLM response, using defaults', {
        domain,
        error: parseError instanceof Error ? parseError.message : 'Unknown',
      });
      synthesized = {};
    }

    // Merge with raw data
    const company: DiscoveredCompany = {
      domain,
      companyName: synthesized.companyName || extractDomainName(domain),
      description: synthesized.description,
      industry: synthesized.industry,
      size: synthesized.size,
      location: synthesized.location,
      
      teamMembers: rawData.teamMembers.length > 0 
        ? rawData.teamMembers 
        : (synthesized.teamMembers || []),
      
      techStack: rawData.techStack.length > 0 
        ? rawData.techStack 
        : (synthesized.techStack || []),
      
      pressmentions: synthesized.pressmentions || [],
      
      contactInfo: synthesized.contactInfo || {
        socialMedia: {},
      },
      
      signals: {
        isHiring: (rawData.careerData?.jobCount || 0) > 0,
        jobCount: rawData.careerData?.jobCount || 0,
        recentActivity: true,
        fundingStage: synthesized.signals?.fundingStage,
        growthIndicators: synthesized.signals?.growthIndicators || [],
      },
      
      metadata: {
        scrapedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        source: 'discovery-engine',
        confidence: calculateConfidence(rawData, synthesized),
      },
    };

    logger.info('LLM synthesis complete', {
      domain,
      confidence: company.metadata.confidence,
    });

    return company;
  } catch (error) {
    logger.error('Failed to synthesize lead object', error, { domain });
    
    // Fallback to raw data only
    return {
      domain,
      companyName: extractDomainName(domain),
      teamMembers: rawData.teamMembers || [],
      techStack: rawData.techStack || [],
      pressmentions: [],
      contactInfo: { socialMedia: {} },
      signals: {
        isHiring: (rawData.careerData?.jobCount || 0) > 0,
        jobCount: rawData.careerData?.jobCount || 0,
        recentActivity: false,
        growthIndicators: [],
      },
      metadata: {
        scrapedAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        source: 'discovery-engine',
        confidence: 0.5,
      },
    };
  }
}

/**
 * Build LLM prompt for data synthesis
 */
function buildSynthesisPrompt(domain: string, rawData: RawScrapedData): string {
  return `Extract company information from this website data for ${domain}.

WEBSITE TEXT (first 5000 chars):
${rawData.text.substring(0, 5000)}

HIGH-VALUE AREAS:
${rawData.highValueAreas.map((area, i) => 
  `${i + 1}. ${area.type}: ${area.content.substring(0, 500)}`
).join('\n')}

TEAM MEMBERS FOUND: ${rawData.teamMembers.length}
TECH STACK FOUND: ${rawData.techStack.map(t => t.name).join(', ')}
CAREER OPENINGS: ${rawData.careerData?.jobCount || 0}

Extract and return a JSON object with this structure:
{
  "companyName": "string",
  "description": "string (1-2 sentences)",
  "industry": "string",
  "size": "string (e.g., '10-50', '50-200', '200-1000', '1000+')",
  "location": "string (city, country)",
  "contactInfo": {
    "email": "string",
    "phone": "string",
    "socialMedia": {
      "linkedin": "string",
      "twitter": "string"
    }
  },
  "signals": {
    "fundingStage": "string (seed, series A, B, C, public, etc.)",
    "growthIndicators": ["string array of growth signals"]
  },
  "pressmentions": [
    {
      "title": "string",
      "summary": "string",
      "date": "string"
    }
  ]
}

Return ONLY valid JSON, no markdown formatting.`;
}

/**
 * Calculate confidence score based on data completeness
 */
function calculateConfidence(rawData: RawScrapedData, synthesized: Partial<DiscoveredCompany>): number {
  let score = 0;
  let maxScore = 0;

  // Team members found
  maxScore += 20;
  if (rawData.teamMembers.length > 0) score += 20;
  else if (rawData.teamMembers.length > 5) score += 15;
  else if (rawData.teamMembers.length > 0) score += 10;

  // Tech stack found
  maxScore += 15;
  if (rawData.techStack.length > 5) score += 15;
  else if (rawData.techStack.length > 0) score += 10;

  // Company info extracted
  maxScore += 30;
  if (synthesized.companyName) score += 10;
  if (synthesized.description) score += 10;
  if (synthesized.industry) score += 5;
  if (synthesized.size) score += 5;

  // Contact info found
  maxScore += 15;
  if (synthesized.contactInfo?.email) score += 10;
  if (synthesized.contactInfo?.phone) score += 5;

  // High-value areas extracted
  maxScore += 20;
  score += Math.min(20, rawData.highValueAreas.length * 4);

  return Math.round((score / maxScore) * 100) / 100;
}

/**
 * Extract company name from domain
 */
function extractDomainName(domain: string): string {
  let name = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
  return name.charAt(0).toUpperCase() + name.slice(1);
}

// ============================================================================
// ARCHIVE STORAGE
// ============================================================================

/**
 * Save discovered data to discoveryArchive with 30-day TTL
 */
async function saveToArchive(
  domain: string,
  organizationId: string,
  company: DiscoveredCompany,
  rawData: RawScrapedData
): Promise<{ scrape: TemporaryScrape; isNew: boolean }> {
  try {
    const url = domain.startsWith('http') ? domain : `https://${domain}`;

    const result = await saveToDiscoveryArchive({
      organizationId,
      url,
      rawHtml: JSON.stringify(rawData),
      cleanedContent: JSON.stringify(company),
      metadata: {
        title: company.companyName || extractDomainName(domain),
        description: company.description,
        author: 'discovery-engine',
      },
    });

    logger.info('Saved to discovery archive', {
      domain,
      organizationId,
      scrapeId: result.scrape.id,
      isNew: result.isNew,
      expiresAt: result.scrape.expiresAt,
    });

    return result;
  } catch (error) {
    logger.error('Failed to save to discovery archive', error, {
      domain,
      organizationId,
    });
    throw error;
  }
}

// ============================================================================
// BATCH DISCOVERY
// ============================================================================

/**
 * Discover multiple companies in batch
 * 
 * Rate-limited to avoid overwhelming target sites.
 * 
 * @param domains - Array of domains to discover
 * @param organizationId - Organization requesting discovery
 * @param options - Batch options
 * @returns Array of discovery results
 */
export async function discoverCompaniesBatch(
  domains: string[],
  organizationId: string,
  options: {
    concurrency?: number;
    delayMs?: number;
  } = {}
): Promise<DiscoveryResult[]> {
  const { concurrency = 3, delayMs = 2000 } = options;

  logger.info('Starting batch discovery', {
    domainsCount: domains.length,
    concurrency,
    organizationId,
  });

  const results: DiscoveryResult[] = [];
  
  // Process in batches
  for (let i = 0; i < domains.length; i += concurrency) {
    const batch = domains.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(domain => discoverCompany(domain, organizationId))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error('Batch discovery failed for domain', result.reason);
      }
    }

    // Rate limiting delay between batches
    if (i + concurrency < domains.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  logger.info('Batch discovery complete', {
    totalDomains: domains.length,
    successCount: results.length,
    failedCount: domains.length - results.length,
  });

  return results;
}
