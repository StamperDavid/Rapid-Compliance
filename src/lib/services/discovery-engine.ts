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
import type { WorkflowState } from '@/types/workflow-state';
import { createWorkflowState } from '@/types/workflow-state';
import { getServerSignalCoordinator } from '@/lib/orchestration/coordinator-factory-server';
import { Timestamp } from 'firebase/firestore';

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
  
  // Workflow state tracking
  workflow: WorkflowState;
}

export interface DiscoveryResult {
  company: DiscoveredCompany;
  rawData: RawScrapedData;
  fromCache: boolean;
  scrapeId: string;
}

export interface DiscoveredPerson {
  email: string;
  firstName?: string;
  lastName?: string;
  fullName?: string;
  title?: string;
  company?: string;
  location?: string;
  
  // Social profiles
  socialProfiles: {
    linkedin?: string;
    twitter?: string;
    github?: string;
    website?: string;
  };
  
  // Professional data
  currentRole?: {
    title: string;
    company: string;
    startDate?: string;
  };
  
  previousRoles?: Array<{
    title: string;
    company: string;
    startDate?: string;
    endDate?: string;
  }>;
  
  // Skills and interests
  skills?: string[];
  interests?: string[];
  
  // Metadata
  metadata: {
    discoveredAt: Date;
    expiresAt: Date;
    source: 'person-discovery';
    confidence: number;
    methods: string[]; // How we found this data (e.g., 'linkedin', 'company-website', 'github')
  };
  
  // Workflow state tracking
  workflow: WorkflowState;
}

export interface PersonDiscoveryResult {
  person: DiscoveredPerson;
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

      const company = JSON.parse(cached.scrape.cleanedContent) as DiscoveredCompany;
      
      // Emit Signal Bus signals even for cached data (lower priority)
      await emitDiscoverySignals(company, organizationId, true);

      return {
        company,
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

    // Emit Signal Bus signals for newly discovered data
    await emitDiscoverySignals(company, organizationId, false);

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
// INDUSTRY DETECTION
// ============================================================================

/**
 * Industry-specific patterns for better data extraction
 */
const INDUSTRY_PATTERNS = {
  saas: {
    keywords: ['software', 'platform', 'api', 'cloud', 'app', 'tool', 'dashboard', 'subscription', 'saas'],
    techIndicators: ['react', 'vue', 'angular', 'stripe', 'aws', 'gcp', 'azure'],
    extractionFocus: ['pricing', 'features', 'integrations', 'api-docs', 'changelog'],
  },
  ecommerce: {
    keywords: ['shop', 'store', 'cart', 'checkout', 'product', 'buy', 'price', 'shipping', 'order'],
    techIndicators: ['shopify', 'woocommerce', 'magento', 'stripe', 'paypal'],
    extractionFocus: ['products', 'categories', 'shipping-policy', 'return-policy'],
  },
  healthcare: {
    keywords: ['health', 'medical', 'doctor', 'patient', 'clinic', 'hospital', 'telemedicine', 'wellness'],
    techIndicators: ['hipaa', 'ehr', 'emr', 'epic', 'cerner'],
    extractionFocus: ['services', 'providers', 'locations', 'insurance', 'compliance'],
  },
  fintech: {
    keywords: ['finance', 'bank', 'payment', 'invest', 'crypto', 'blockchain', 'lending', 'insurance'],
    techIndicators: ['stripe', 'plaid', 'coinbase', 'blockchain', 'encryption'],
    extractionFocus: ['security', 'compliance', 'features', 'rates', 'partners'],
  },
  manufacturing: {
    keywords: ['manufacturing', 'production', 'factory', 'industrial', 'supply chain', 'warehouse'],
    techIndicators: ['iot', 'plc', 'scada', 'erp', 'mes'],
    extractionFocus: ['products', 'capabilities', 'certifications', 'locations'],
  },
  consulting: {
    keywords: ['consulting', 'advisory', 'services', 'expert', 'professional services', 'strategy'],
    techIndicators: [],
    extractionFocus: ['services', 'team', 'case-studies', 'clients', 'expertise'],
  },
  agency: {
    keywords: ['agency', 'marketing', 'advertising', 'creative', 'digital', 'design', 'branding'],
    techIndicators: ['adobe', 'figma', 'google-analytics', 'hubspot'],
    extractionFocus: ['portfolio', 'services', 'clients', 'team', 'awards'],
  },
};

/**
 * Detect company industry from scraped data
 */
function detectIndustry(rawData: RawScrapedData): string | null {
  const textLower = rawData.text.toLowerCase();
  const techStack = rawData.techStack.map((t) => t.name.toLowerCase());

  let bestMatch: { industry: string; score: number } | null = null;

  for (const [industry, pattern] of Object.entries(INDUSTRY_PATTERNS)) {
    let score = 0;

    // Check keywords in text
    for (const keyword of pattern.keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = textLower.match(regex);
      if (matches) {
        score += matches.length * 2;
      }
    }

    // Check tech indicators
    for (const tech of pattern.techIndicators) {
      if (techStack.some((t) => t.includes(tech.toLowerCase()))) {
        score += 5;
      }
    }

    if (!bestMatch || score > bestMatch.score) {
      bestMatch = { industry, score };
    }
  }

  // Only return if confidence is reasonable
  return bestMatch && bestMatch.score > 3 ? bestMatch.industry : null;
}

// ============================================================================
// LLM SYNTHESIS
// ============================================================================

/**
 * Synthesize structured Lead Object from raw scraped data
 * 
 * Uses LLM to extract meaningful information from raw HTML/text
 * and structure it into a clean DiscoveredCompany object.
 * Now enhanced with industry-specific prompts.
 */
async function synthesizeLeadObject(
  domain: string,
  rawData: RawScrapedData
): Promise<DiscoveredCompany> {
  try {
    // Detect industry for better prompt engineering
    const detectedIndustry = detectIndustry(rawData);
    
    logger.info('Synthesizing lead object with LLM', { 
      domain,
      detectedIndustry: detectedIndustry || 'general',
    });

    // Build industry-specific prompt for LLM
    const prompt = buildSynthesisPrompt(domain, rawData, detectedIndustry);

    // Generate structured data with LLM
    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o-mini',
      messages: [
        {
          role: 'system',
          content: buildSystemPrompt(detectedIndustry),
        },
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
      
      // Initialize workflow state
      workflow: createWorkflowState('discovery', 'completed'),
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
      workflow: createWorkflowState('discovery', 'completed'),
    };
  }
}

/**
 * Build system prompt based on detected industry
 */
function buildSystemPrompt(industry: string | null): string {
  const basePrompt = `You are an expert B2B company data analyst specializing in extracting structured information from website content. Your task is to analyze website data and return accurate, well-structured JSON objects.`;

  if (!industry) {
    return basePrompt;
  }

  const industryPrompts: Record<string, string> = {
    saas: `${basePrompt} You specialize in SaaS companies. Pay special attention to:
- Pricing tiers and business model (freemium, subscription, usage-based)
- Target customer segments (SMB, mid-market, enterprise)
- Key integrations and API availability
- Product categories and features
- Growth indicators (customer count, funding, expansions)`,

    ecommerce: `${basePrompt} You specialize in e-commerce businesses. Pay special attention to:
- Product categories and catalog size
- Shipping and fulfillment capabilities
- Payment methods and checkout features
- Return policies and customer service
- Market focus (B2C, B2B, D2C)`,

    healthcare: `${basePrompt} You specialize in healthcare companies. Pay special attention to:
- Services offered (telehealth, diagnostics, treatment, etc.)
- Compliance certifications (HIPAA, FDA, etc.)
- Provider network and locations
- Insurance accepted
- Patient-focused vs. provider-focused offerings`,

    fintech: `${basePrompt} You specialize in fintech companies. Pay special attention to:
- Financial products and services
- Security and compliance measures
- Regulatory licenses and jurisdictions
- Payment methods and banking partners
- Target customer segments (consumer, business, enterprise)`,

    manufacturing: `${basePrompt} You specialize in manufacturing companies. Pay special attention to:
- Manufacturing capabilities and processes
- Product categories and materials
- Quality certifications (ISO, etc.)
- Production locations and facilities
- Supply chain and distribution capabilities`,

    consulting: `${basePrompt} You specialize in consulting firms. Pay special attention to:
- Service offerings and expertise areas
- Client industries served
- Team credentials and experience
- Case studies and success stories
- Geographic coverage`,

    agency: `${basePrompt} You specialize in creative and marketing agencies. Pay special attention to:
- Service capabilities (branding, digital, creative, etc.)
- Portfolio and notable clients
- Team size and specializations
- Awards and recognition
- Technology stack used`,
  };

  return industryPrompts[industry] || basePrompt;
}

/**
 * Build LLM prompt for data synthesis (industry-specific)
 */
function buildSynthesisPrompt(
  domain: string,
  rawData: RawScrapedData,
  industry: string | null
): string {
  const basePrompt = `Extract company information from this website data for ${domain}.

${industry ? `DETECTED INDUSTRY: ${industry.toUpperCase()}` : ''}

WEBSITE TEXT (first 5000 chars):
${rawData.text.substring(0, 5000)}

HIGH-VALUE AREAS:
${rawData.highValueAreas.map((area, i) => 
  `${i + 1}. ${area.type}: ${area.content.substring(0, 500)}`
).join('\n')}

TEAM MEMBERS FOUND: ${rawData.teamMembers.length}
TECH STACK FOUND: ${rawData.techStack.map(t => t.name).join(', ')}
CAREER OPENINGS: ${rawData.careerData?.jobCount || 0}`;

  // Add industry-specific extraction instructions
  let industryInstructions = '';
  if (industry && INDUSTRY_PATTERNS[industry as keyof typeof INDUSTRY_PATTERNS]) {
    const pattern = INDUSTRY_PATTERNS[industry as keyof typeof INDUSTRY_PATTERNS];
    industryInstructions = `

INDUSTRY-SPECIFIC FOCUS AREAS:
${pattern.extractionFocus.map((focus, i) => `${i + 1}. ${focus}`).join('\n')}

When extracting data, prioritize finding information about: ${pattern.extractionFocus.join(', ')}`;
  }

  return `${basePrompt}${industryInstructions}

Extract and return a JSON object with this structure:
{
  "companyName": "string",
  "description": "string (2-3 sentences highlighting key value proposition)",
  "industry": "string (be specific, e.g., 'B2B SaaS - Marketing Analytics' not just 'Software')",
  "size": "string (e.g., '1-10', '10-50', '50-200', '200-1000', '1000+', 'Enterprise')",
  "location": "string (headquarters city, country)",
  "contactInfo": {
    "email": "string (general contact or sales email)",
    "phone": "string",
    "address": "string (if available)",
    "socialMedia": {
      "linkedin": "string (full URL)",
      "twitter": "string (handle or URL)",
      "facebook": "string (URL)"
    }
  },
  "signals": {
    "fundingStage": "string (bootstrapped, seed, series A-F, public, acquired, etc.)",
    "growthIndicators": [
      "string array of specific growth signals like 'Recently raised Series B',
      'Expanding to 3 new markets',
      'Hiring 50+ roles',
      'Featured in TechCrunch',
      'Hit 100K users milestone'"
    ]
  },
  "pressmentions": [
    {
      "title": "string (headline)",
      "summary": "string (1-2 sentence summary)",
      "date": "string (YYYY-MM-DD or 'Month YYYY' format)",
      "url": "string (if available)"
    }
  ]
}

IMPORTANT:
- Be specific and accurate, don't make up information
- If data is not available, omit the field or use null
- Extract real quotes and facts from the website
- For growth indicators, be specific with numbers and timeframes
- Return ONLY valid JSON, no markdown formatting, no explanations`;
}

/**
 * Calculate confidence score based on data completeness
 */
function calculateConfidence(rawData: RawScrapedData, synthesized: Partial<DiscoveredCompany>): number {
  let score = 0;
  let maxScore = 0;

  // Team members found
  maxScore += 20;
  if (rawData.teamMembers.length > 0) {score += 20;}
  else if (rawData.teamMembers.length > 5) {score += 15;}
  else if (rawData.teamMembers.length > 0) {score += 10;}

  // Tech stack found
  maxScore += 15;
  if (rawData.techStack.length > 5) {score += 15;}
  else if (rawData.techStack.length > 0) {score += 10;}

  // Company info extracted
  maxScore += 30;
  if (synthesized.companyName) {score += 10;}
  if (synthesized.description) {score += 10;}
  if (synthesized.industry) {score += 5;}
  if (synthesized.size) {score += 5;}

  // Contact info found
  maxScore += 15;
  if (synthesized.contactInfo?.email) {score += 10;}
  if (synthesized.contactInfo?.phone) {score += 5;}

  // High-value areas extracted
  maxScore += 20;
  score += Math.min(20, rawData.highValueAreas.length * 4);

  return Math.round((score / maxScore) * 100) / 100;
}

/**
 * Extract company name from domain
 */
function extractDomainName(domain: string): string {
  const name = domain.replace(/^https?:\/\//, '').replace(/^www\./, '').split('.')[0];
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

// ============================================================================
// PERSON DISCOVERY
// ============================================================================

/**
 * Discover person data from email address
 * 
 * This function enriches a person's email with professional data by:
 * 1. Checking 30-day cache first
 * 2. Extracting domain and searching company website
 * 3. Finding LinkedIn profile via Google search
 * 4. Synthesizing data with LLM
 * 
 * @param email - Person's email address
 * @param organizationId - Organization requesting the discovery
 * @returns Complete person discovery result
 * 
 * @example
 * ```typescript
 * const result = await discoverPerson('john@example.com', 'org_123');
 * console.log(`Found: ${result.person.fullName} - ${result.person.title}`);
 * console.log(`LinkedIn: ${result.person.socialProfiles.linkedin}`);
 * console.log(`From cache: ${result.fromCache}`);
 * ```
 */
export async function discoverPerson(
  email: string,
  organizationId: string
): Promise<PersonDiscoveryResult> {
  try {
    logger.info('Starting person discovery', {
      email,
      organizationId,
      source: 'person-discovery',
    });

    // Validate email
    if (!email?.includes('@')) {
      throw new Error('Invalid email address');
    }

    // Step 1: Check discoveryArchive (30-day cache)
    const cacheKey = `person:${email}`;
    const contentHash = calculateContentHash(cacheKey);
    const cached = await getFromDiscoveryArchiveByHash(organizationId, contentHash);
    
    if (cached && cached.expiresAt > new Date()) {
      logger.info('Person discovery archive HIT', {
        email,
        organizationId,
        cacheAge: Date.now() - cached.createdAt.getTime(),
      });

      const person = JSON.parse(cached.cleanedContent) as DiscoveredPerson;
      
      // Emit Signal Bus signal even for cached data (lower priority)
      await emitPersonDiscoverySignals(person, organizationId, true);

      return {
        person,
        fromCache: true,
        scrapeId: cached.id,
      };
    }

    // Step 2: Cache MISS - perform discovery
    logger.info('Person discovery archive MISS - initiating search', {
      email,
      organizationId,
    });

    const person = await discoverPersonData(email, organizationId);

    // Step 3: Save to discoveryArchive (30-day TTL)
    const scrapeResult = await saveToDiscoveryArchive({
      organizationId,
      url: cacheKey,
      rawHtml: JSON.stringify({ email, discoveredAt: new Date() }),
      cleanedContent: JSON.stringify(person),
      metadata: {
        title: person.fullName || email,
        description: person.title,
        author: 'person-discovery',
      },
    });

    logger.info('Person discovery complete', {
      email,
      organizationId,
      fullName: person.fullName,
      title: person.title,
      fromCache: false,
    });

    // Emit Signal Bus signal for newly discovered person
    await emitPersonDiscoverySignals(person, organizationId, false);

    return {
      person,
      fromCache: false,
      scrapeId: scrapeResult.scrape.id,
    };
  } catch (error) {
    logger.error('Failed to discover person', error, {
      email,
      organizationId,
    });
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    throw new Error(`Failed to discover person ${email}: ${errorMessage}`);
  }
}

/**
 * Perform person data discovery
 * 
 * Multi-source discovery strategy:
 * 1. Extract domain from email
 * 2. Search company website for person
 * 3. Search LinkedIn via Google
 * 4. Search GitHub if applicable
 * 5. Synthesize with LLM
 */
async function discoverPersonData(
  email: string,
  organizationId: string
): Promise<DiscoveredPerson> {
  const controller = createBrowserController({ headless: true });
  const discoveryMethods: string[] = [];
  const personData: Partial<DiscoveredPerson> = {
    email,
    socialProfiles: {},
  };

  try {
    // Extract email parts
    const [localPart, domain] = email.split('@');
    const firstName = extractFirstName(localPart);
    const lastName = extractLastName(localPart);

    personData.firstName = firstName;
    personData.lastName = lastName;
    personData.fullName = `${firstName} ${lastName}`.trim() || email;

    // Strategy 1: Search company website
    try {
      const companyUrl = `https://${domain}`;
      await controller.navigate(companyUrl);
      
      const teamMembers = await controller.findTeamDirectory();
      const matchedMember = teamMembers.find((member) => {
        const memberName = member.name.toLowerCase();
        return (
          (firstName && memberName.includes(firstName.toLowerCase())) ||
          (lastName && memberName.includes(lastName.toLowerCase())) ||
          member.email === email
        );
      });

      if (matchedMember) {
        personData.title = matchedMember.title;
        personData.currentRole = {
          title: matchedMember.title || '',
          company: domain,
        };
        if (matchedMember.linkedinUrl) {
          personData.socialProfiles.linkedin = matchedMember.linkedinUrl;
        }
        discoveryMethods.push('company-website');
      }
    } catch (error) {
      logger.debug('Company website search failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Strategy 2: LinkedIn search via Google
    if (!personData.socialProfiles.linkedin) {
      try {
        const searchQuery = `site:linkedin.com/in "${firstName} ${lastName}" ${domain}`;
        const googleUrl = `https://www.google.com/search?q=${encodeURIComponent(searchQuery)}`;
        
        await controller.navigate(googleUrl);
        await controller.getPage()?.waitForTimeout(2000);
        
        // Extract LinkedIn URLs from search results
        const linkedinLinks = await controller.getPage()?.$$eval('a', (links) =>
          links
            .map((link) => link.getAttribute('href') || '')
            .filter((href) => href.includes('linkedin.com/in/'))
            .map((href) => {
              // Extract clean LinkedIn URL
              const match = href.match(/https?:\/\/(www\.)?linkedin\.com\/in\/[^&?]+/);
              return match ? match[0] : null;
            })
            .filter((url): url is string => url !== null)
        );

        if (linkedinLinks && linkedinLinks.length > 0) {
          personData.socialProfiles.linkedin = linkedinLinks[0];
          discoveryMethods.push('google-linkedin-search');
        }
      } catch (error) {
        logger.debug('LinkedIn search failed', {
          email,
          error: error instanceof Error ? error.message : 'Unknown',
        });
      }
    }

    // Strategy 3: GitHub search (for technical roles)
    try {
      const githubUsername = localPart.replace(/[^a-zA-Z0-9-]/g, '');
      const githubUrl = `https://github.com/${githubUsername}`;
      
      await controller.navigate(githubUrl);
      await controller.getPage()?.waitForTimeout(1000);
      
      // Check if profile exists (no 404)
      const title = await controller.getPage()?.title();
      if (title && !title.includes('Page not found')) {
        personData.socialProfiles.github = githubUrl;
        discoveryMethods.push('github');
      }
    } catch (error) {
      logger.debug('GitHub search failed', {
        email,
        error: error instanceof Error ? error.message : 'Unknown',
      });
    }

    // Strategy 4: LLM synthesis
    const synthesized = await synthesizePersonData(email, personData, discoveryMethods);

    const finalPerson: DiscoveredPerson = {
      ...personData,
      ...synthesized,
      email,
      socialProfiles: {
        ...personData.socialProfiles,
        ...synthesized.socialProfiles,
      },
      metadata: {
        discoveredAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
        source: 'person-discovery',
        confidence: calculatePersonConfidence(personData, discoveryMethods),
        methods: discoveryMethods,
      },
      workflow: createWorkflowState('discovery', 'completed'),
    };

    return finalPerson;
  } catch (error) {
    logger.error('Failed to discover person data', error, { email });
    
    // Return minimal data
    return {
      email,
      fullName: personData.fullName || email,
      socialProfiles: personData.socialProfiles || {},
      metadata: {
        discoveredAt: new Date(),
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        source: 'person-discovery',
        confidence: 0.1,
        methods: discoveryMethods,
      },
      workflow: createWorkflowState('discovery', 'failed'),
    };
  } finally {
    await controller.close();
  }
}

/**
 * Synthesize person data with LLM
 */
async function synthesizePersonData(
  email: string,
  personData: Partial<DiscoveredPerson>,
  methods: string[]
): Promise<Partial<DiscoveredPerson>> {
  try {
    const prompt = `Enrich this person's profile based on available data:

Email: ${email}
Name: ${personData.fullName || 'Unknown'}
Title: ${personData.title || 'Unknown'}
Company: ${personData.currentRole?.company || 'Unknown'}
LinkedIn: ${personData.socialProfiles?.linkedin || 'Not found'}
GitHub: ${personData.socialProfiles?.github || 'Not found'}

Discovery methods used: ${methods.join(', ')}

Based on this information, provide:
1. Inferred professional role/seniority
2. Likely skills (if technical role detected)
3. Professional interests
4. Missing profile information

Return JSON with this structure:
{
  "title": "string (if can be improved)",
  "skills": ["string array"],
  "interests": ["string array"],
  "currentRole": {
    "title": "string",
    "company": "string"
  }
}

Return ONLY valid JSON, no markdown.`;

    const response = await sendUnifiedChatMessage({
      model: 'gpt-4o-mini',
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.1,
      maxTokens: 500,
    });

    // Parse LLM response
    try {
      const content = response.text;
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0]);
      }
    } catch (parseError) {
      logger.debug('Failed to parse LLM person synthesis', {
        email,
        error: parseError instanceof Error ? parseError.message : 'Unknown',
      });
    }

    return {};
  } catch (error) {
    logger.debug('Person LLM synthesis failed', {
      email,
      error: error instanceof Error ? error.message : 'Unknown',
    });
    return {};
  }
}

/**
 * Calculate person discovery confidence score
 */
function calculatePersonConfidence(
  personData: Partial<DiscoveredPerson>,
  methods: string[]
): number {
  let score = 0;
  let maxScore = 0;

  // Name found
  maxScore += 20;
  if (personData.fullName && personData.fullName !== personData.email) {
    score += 20;
  }

  // Title found
  maxScore += 25;
  if (personData.title) {score += 25;}

  // LinkedIn found
  maxScore += 30;
  if (personData.socialProfiles?.linkedin) {score += 30;}

  // Company website match
  maxScore += 15;
  if (methods.includes('company-website')) {score += 15;}

  // Additional profiles
  maxScore += 10;
  if (personData.socialProfiles?.github) {score += 5;}
  if (personData.socialProfiles?.twitter) {score += 5;}

  return Math.round((score / maxScore) * 100) / 100;
}

/**
 * Extract first name from email local part
 */
function extractFirstName(localPart: string): string {
  // Common patterns: john.doe, john_doe, johndoe, j.doe
  const cleaned = localPart.toLowerCase().replace(/[^a-z.]/g, '');
  const parts = cleaned.split('.');
  
  if (parts.length > 0 && parts[0].length > 1) {
    return capitalize(parts[0]);
  }
  
  return '';
}

/**
 * Extract last name from email local part
 */
function extractLastName(localPart: string): string {
  const cleaned = localPart.toLowerCase().replace(/[^a-z.]/g, '');
  const parts = cleaned.split('.');
  
  if (parts.length > 1 && parts[1].length > 1) {
    return capitalize(parts[1]);
  }
  
  return '';
}

/**
 * Capitalize first letter
 */
function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Batch person discovery
 */
export async function discoverPeopleBatch(
  emails: string[],
  organizationId: string,
  options: {
    concurrency?: number;
    delayMs?: number;
  } = {}
): Promise<PersonDiscoveryResult[]> {
  const { concurrency = 3, delayMs = 2000 } = options;

  logger.info('Starting batch person discovery', {
    emailsCount: emails.length,
    concurrency,
    organizationId,
  });

  const results: PersonDiscoveryResult[] = [];
  
  // Process in batches
  for (let i = 0; i < emails.length; i += concurrency) {
    const batch = emails.slice(i, i + concurrency);
    
    const batchResults = await Promise.allSettled(
      batch.map(email => discoverPerson(email, organizationId))
    );

    for (const result of batchResults) {
      if (result.status === 'fulfilled') {
        results.push(result.value);
      } else {
        logger.error('Batch person discovery failed', result.reason);
      }
    }

    // Rate limiting delay between batches
    if (i + concurrency < emails.length) {
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }

  logger.info('Batch person discovery complete', {
    totalEmails: emails.length,
    successCount: results.length,
    failedCount: emails.length - results.length,
  });

  return results;
}

// ============================================================================
// SIGNAL BUS INTEGRATION
// ============================================================================

/**
 * Emit discovery signals to the Neural Net
 * 
 * Emits signals when company data is discovered (new or cached).
 * Triggers downstream actions like lead scoring, sequence enrollment, etc.
 */
async function emitDiscoverySignals(
  company: DiscoveredCompany,
  organizationId: string,
  fromCache: boolean
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    // Signal 1: website.discovered - Always emit when company is discovered
    await coordinator.emitSignal({
      type: 'website.discovered',
      orgId: organizationId,
      confidence: company.metadata.confidence,
      priority: fromCache ? 'Low' : 'Medium',
      metadata: {
        source: 'discovery-engine',
        domain: company.domain,
        companyName: company.companyName,
        industry: company.industry,
        size: company.size,
        location: company.location,
        teamMembersCount: company.teamMembers.length,
        techStackCount: company.techStack.length,
        fromCache,
        scrapedAt: company.metadata.scrapedAt.toISOString(),
        expiresAt: company.metadata.expiresAt.toISOString(),
      },
    });

    // Signal 2: website.technology.detected - Emit if tech stack found
    if (company.techStack.length > 0) {
      await coordinator.emitSignal({
        type: 'website.technology.detected',
        orgId: organizationId,
        confidence: 0.9, // Tech stack detection is usually accurate
        priority: 'Medium',
        metadata: {
          source: 'discovery-engine',
          domain: company.domain,
          companyName: company.companyName,
          techStack: company.techStack.map(t => ({
            name: t.name,
            category: t.category,
            confidence: t.confidence,
          })),
          techStackCount: company.techStack.length,
          categories: [...new Set(company.techStack.map(t => t.category))],
        },
      });
    }

    // Signal 3: lead.discovered - Emit for each team member found
    if (company.teamMembers.length > 0) {
      for (const member of company.teamMembers.slice(0, 10)) { // Limit to first 10 to avoid spam
        if (member.email) {
          await coordinator.emitSignal({
            type: 'lead.discovered',
            leadId: member.email, // Use email as temporary leadId
            orgId: organizationId,
            confidence: member.email ? 0.8 : 0.5,
            priority: member.email ? 'Medium' : 'Low',
            metadata: {
              source: 'discovery-engine',
              discoveryMethod: 'team-directory',
              domain: company.domain,
              companyName: company.companyName,
              personName: member.name,
              personTitle: member.title,
              personEmail: member.email,
              personLinkedIn: member.linkedinUrl,
              personImageUrl: member.imageUrl,
              companyIndustry: company.industry,
              companySize: company.size,
            },
          });
        }
      }
    }

    logger.info('Discovery signals emitted', {
      domain: company.domain,
      organizationId,
      fromCache,
      signalsEmitted: {
        websiteDiscovered: 1,
        technologyDetected: company.techStack.length > 0 ? 1 : 0,
        leadsDiscovered: Math.min(company.teamMembers.filter(m => m.email).length, 10),
      },
    });
  } catch (error) {
    // Don't fail discovery if signal emission fails
    logger.error('Failed to emit discovery signals', error, {
      domain: company.domain,
      organizationId,
    });
  }
}

/**
 * Emit person discovery signals to the Neural Net
 * 
 * Emits signals when person data is discovered.
 */
async function emitPersonDiscoverySignals(
  person: DiscoveredPerson,
  organizationId: string,
  fromCache: boolean
): Promise<void> {
  try {
    const coordinator = getServerSignalCoordinator();

    // Signal: lead.discovered
    await coordinator.emitSignal({
      type: 'lead.discovered',
      leadId: person.email,
      orgId: organizationId,
      confidence: person.metadata.confidence,
      priority: fromCache ? 'Low' : 'Medium',
      metadata: {
        source: 'person-discovery',
        discoveryMethod: 'email-enrichment',
        email: person.email,
        firstName: person.firstName,
        lastName: person.lastName,
        fullName: person.fullName,
        title: person.title,
        company: person.company,
        currentRole: person.currentRole,
        location: person.location,
        socialProfiles: person.socialProfiles,
        skills: person.skills,
        interests: person.interests,
        discoveryMethods: person.metadata.methods,
        fromCache,
        discoveredAt: person.metadata.discoveredAt.toISOString(),
        expiresAt: person.metadata.expiresAt.toISOString(),
      },
    });

    logger.info('Person discovery signal emitted', {
      email: person.email,
      organizationId,
      fullName: person.fullName,
      fromCache,
    });
  } catch (error) {
    // Don't fail person discovery if signal emission fails
    logger.error('Failed to emit person discovery signal', error, {
      email: person.email,
      organizationId,
    });
  }
}
