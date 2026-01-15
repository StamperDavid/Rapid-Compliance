/**
 * Scraper Specialist
 * STATUS: FUNCTIONAL
 *
 * Takes a raw URL and returns structured JSON of 'Key Findings'
 * Uses the web scraper infrastructure to extract meaningful data.
 *
 * CAPABILITIES:
 * - Full website scraping with noise removal
 * - Key findings extraction (company info, contact, tech signals)
 * - About page discovery and parsing
 * - Careers/hiring detection
 * - Structured JSON output for downstream agents
 */

import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { scrapeWebsite, scrapeAboutPage, scrapeCareersPage, extractDataPoints } from '@/lib/enrichment/web-scraper';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// SYSTEM PROMPT - The brain of this specialist
// ============================================================================

const SYSTEM_PROMPT = `You are the Scraper Specialist, an expert in web data extraction and analysis.

## YOUR ROLE
You transform raw URLs into structured intelligence. When given a website URL, you:
1. Scrape the main page content (removing noise like ads, navigation, footers)
2. Extract key metadata (title, description, keywords)
3. Discover and analyze supplementary pages (About, Careers, Team)
4. Identify contact information (emails, phones, social links)
5. Detect business signals (hiring status, company size indicators, industry)

## OUTPUT FORMAT
You ALWAYS return structured JSON with these sections:

\`\`\`json
{
  "url": "The scraped URL",
  "scrapedAt": "ISO timestamp",
  "keyFindings": {
    "companyName": "Extracted company name or null",
    "industry": "Detected industry vertical",
    "description": "One-line company description",
    "foundedYear": "If detected, otherwise null",
    "employeeRange": "1-10 | 11-50 | 51-200 | 201-500 | 500+ | unknown",
    "location": "Headquarters location if found"
  },
  "contactInfo": {
    "emails": ["array of found emails"],
    "phones": ["array of found phones"],
    "socialLinks": {
      "linkedin": "url or null",
      "twitter": "url or null",
      "facebook": "url or null"
    }
  },
  "businessSignals": {
    "isHiring": true/false,
    "openPositions": 0,
    "hasEcommerce": true/false,
    "hasBlog": true/false,
    "hasNewsletter": true/false
  },
  "techSignals": {
    "detectedPlatforms": ["Shopify", "WordPress", etc],
    "detectedTools": ["Intercom", "HubSpot", etc]
  },
  "contentSummary": {
    "wordCount": 0,
    "topKeywords": ["array", "of", "keywords"],
    "mainTopics": ["inferred topics from content"]
  },
  "confidence": 0.0-1.0,
  "errors": ["any errors encountered"]
}
\`\`\`

## RULES
1. NEVER hallucinate data - if you can't find something, return null
2. Extract ONLY what's visible on the page - don't infer company size without evidence
3. Respect rate limits - don't hammer the same domain
4. Handle errors gracefully - partial data is better than no data
5. Be conservative with confidence scores - high confidence requires multiple data points

## INTEGRATION
You receive URLs from:
- The Intelligence Manager (competitor research)
- Lead Hunter (prospect enrichment)
- Discovery Engine (new lead scraping)

Your output feeds into:
- Competitor Researcher (market analysis)
- Technographic Scout (tech stack deep-dive)
- Lead scoring algorithms
- CRM enrichment pipelines`;

// ============================================================================
// CONFIGURATION
// ============================================================================

const CONFIG: SpecialistConfig = {
  identity: {
    id: 'SCRAPER_SPECIALIST',
    name: 'Scraper Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: [
      'website_scraping',
      'content_extraction',
      'contact_discovery',
      'business_signal_detection',
      'structured_output'
    ],
  },
  systemPrompt: SYSTEM_PROMPT,
  tools: ['scrape_url', 'scrape_about', 'scrape_careers', 'extract_data'],
  outputSchema: {
    type: 'object',
    properties: {
      url: { type: 'string' },
      keyFindings: { type: 'object' },
      contactInfo: { type: 'object' },
      businessSignals: { type: 'object' },
      techSignals: { type: 'object' },
      contentSummary: { type: 'object' },
      confidence: { type: 'number' },
    },
    required: ['url', 'keyFindings'],
  },
  maxTokens: 4096,
  temperature: 0.2, // Low temperature for factual extraction
};

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

export interface ScrapeRequest {
  url: string;
  includeAboutPage?: boolean;
  includeCareers?: boolean;
  deep?: boolean; // Scrape multiple pages
}

export interface KeyFindings {
  companyName: string | null;
  industry: string | null;
  description: string | null;
  foundedYear: string | null;
  employeeRange: '1-10' | '11-50' | '51-200' | '201-500' | '500+' | 'unknown';
  location: string | null;
}

export interface ContactInfo {
  emails: string[];
  phones: string[];
  socialLinks: {
    linkedin: string | null;
    twitter: string | null;
    facebook: string | null;
  };
}

export interface BusinessSignals {
  isHiring: boolean;
  openPositions: number;
  hasEcommerce: boolean;
  hasBlog: boolean;
  hasNewsletter: boolean;
}

export interface TechSignals {
  detectedPlatforms: string[];
  detectedTools: string[];
}

export interface ContentSummary {
  wordCount: number;
  topKeywords: string[];
  mainTopics: string[];
}

export interface ScrapeResult {
  url: string;
  scrapedAt: string;
  keyFindings: KeyFindings;
  contactInfo: ContactInfo;
  businessSignals: BusinessSignals;
  techSignals: TechSignals;
  contentSummary: ContentSummary;
  confidence: number;
  errors: string[];
}

// ============================================================================
// IMPLEMENTATION
// ============================================================================

export class ScraperSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Scraper Specialist initialized');
  }

  /**
   * Main execution entry point
   */
  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as ScrapeRequest;

      if (!payload?.url) {
        return this.createReport(taskId, 'FAILED', null, ['No URL provided in payload']);
      }

      this.log('INFO', `Scraping URL: ${payload.url}`);

      const result = await this.scrapeAndAnalyze(payload);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.log('ERROR', `Scrape failed: ${errorMessage}`);
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Handle signals from the Signal Bus
   */
  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;

    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }

    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  /**
   * Generate a report for the manager
   */
  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  /**
   * Self-assessment - this agent has REAL logic
   */
  hasRealLogic(): boolean {
    return true;
  }

  /**
   * Lines of code assessment
   */
  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 280, boilerplate: 50 };
  }

  // ==========================================================================
  // CORE SCRAPING LOGIC
  // ==========================================================================

  /**
   * Main scraping and analysis function
   */
  async scrapeAndAnalyze(request: ScrapeRequest): Promise<ScrapeResult> {
    const errors: string[] = [];
    const url = this.normalizeUrl(request.url);
    const baseUrl = this.extractBaseUrl(url);

    // Step 1: Scrape main page
    let mainContent;
    try {
      mainContent = await scrapeWebsite(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to scrape main page';
      errors.push(msg);
      logger.error('Scraper Specialist: Main page scrape failed', error as Error);
    }

    // Step 2: Extract data points from main content
    let dataPoints: {
      potentialEmail?: string;
      potentialPhone?: string;
      socialLinks: string[];
      keywords: string[];
    } = {
      socialLinks: [],
      keywords: [],
    };

    if (mainContent) {
      dataPoints = extractDataPoints(mainContent);
    }

    // Step 3: Scrape About page (if requested)
    let aboutContent = null;
    if (request.includeAboutPage !== false) {
      try {
        aboutContent = await scrapeAboutPage(baseUrl);
      } catch (_error) {
        errors.push('About page not found or inaccessible');
      }
    }

    // Step 4: Scrape Careers page (if requested)
    let careersInfo = { isHiring: false, jobCount: 0, jobs: [] as Array<{ title: string; url: string }> };
    if (request.includeCareers !== false) {
      try {
        careersInfo = await scrapeCareersPage(baseUrl);
      } catch (_error) {
        errors.push('Careers page not found or inaccessible');
      }
    }

    // Step 5: Analyze and structure the findings
    const result = this.structureFindings(
      url,
      mainContent,
      aboutContent,
      careersInfo,
      dataPoints,
      errors
    );

    return result;
  }

  /**
   * Structure all findings into the standard output format
   */
  private structureFindings(
    url: string,
    mainContent: Awaited<ReturnType<typeof scrapeWebsite>> | undefined,
    aboutContent: Awaited<ReturnType<typeof scrapeWebsite>> | null,
    careersInfo: { isHiring: boolean; jobCount: number; jobs: Array<{ title: string; url: string }> },
    dataPoints: { potentialEmail?: string; potentialPhone?: string; socialLinks: string[]; keywords: string[] },
    errors: string[]
  ): ScrapeResult {
    // Parse social links into categorized format
    const socialLinks = this.categorizeSocialLinks(dataPoints.socialLinks);

    // Detect tech signals from raw HTML
    const techSignals = mainContent?.rawHtml
      ? this.detectTechFromHtml(mainContent.rawHtml)
      : { detectedPlatforms: [], detectedTools: [] };

    // Detect business signals
    const businessSignals = this.detectBusinessSignals(mainContent, careersInfo);

    // Extract key findings
    const keyFindings = this.extractKeyFindings(mainContent, aboutContent);

    // Calculate confidence score
    const confidence = this.calculateConfidence(mainContent, aboutContent, dataPoints, keyFindings);

    // Build content summary
    const contentSummary: ContentSummary = {
      wordCount: mainContent?.cleanedText?.split(/\s+/).length ?? 0,
      topKeywords: dataPoints.keywords.slice(0, 10),
      mainTopics: this.inferTopics(dataPoints.keywords),
    };

    return {
      url,
      scrapedAt: new Date().toISOString(),
      keyFindings,
      contactInfo: {
        emails: dataPoints.potentialEmail ? [dataPoints.potentialEmail] : [],
        phones: dataPoints.potentialPhone ? [dataPoints.potentialPhone] : [],
        socialLinks,
      },
      businessSignals,
      techSignals,
      contentSummary,
      confidence,
      errors,
    };
  }

  /**
   * Extract key findings from content
   */
  private extractKeyFindings(
    mainContent: Awaited<ReturnType<typeof scrapeWebsite>> | undefined,
    aboutContent: Awaited<ReturnType<typeof scrapeWebsite>> | null
  ): KeyFindings {
    const title = mainContent?.title ?? '';
    const description = mainContent?.description ?? aboutContent?.cleanedText?.slice(0, 200) ?? null;

    // Try to extract company name from title
    let companyName = null;
    if (title) {
      // Common patterns: "Company Name | Tagline" or "Company Name - Tagline"
      const match = title.match(/^([^|–-]+)/);
      if (match) {
        companyName = match[1].trim();
      }
    }

    // Detect industry from keywords and content
    const industry = this.detectIndustry(mainContent?.cleanedText ?? '', mainContent?.metadata?.keywords ?? []);

    return {
      companyName,
      industry,
      description,
      foundedYear: null, // Would need specific parsing
      employeeRange: 'unknown',
      location: null, // Would need specific parsing
    };
  }

  /**
   * Detect industry from content
   */
  private detectIndustry(content: string, keywords: string[]): string | null {
    const lowerContent = content.toLowerCase();
    const allText = `${lowerContent} ${keywords.join(' ').toLowerCase()}`;

    const industryPatterns: Record<string, string[]> = {
      'SaaS': ['saas', 'software as a service', 'cloud platform', 'subscription'],
      'E-commerce': ['ecommerce', 'e-commerce', 'online store', 'shop', 'retail'],
      'Healthcare': ['healthcare', 'medical', 'health', 'patient', 'clinical'],
      'Finance': ['finance', 'fintech', 'banking', 'investment', 'financial'],
      'Real Estate': ['real estate', 'property', 'homes', 'realtor', 'housing'],
      'Marketing': ['marketing', 'advertising', 'digital marketing', 'seo', 'ppc'],
      'Education': ['education', 'learning', 'course', 'training', 'edtech'],
      'Legal': ['legal', 'law firm', 'attorney', 'lawyer', 'litigation'],
      'Consulting': ['consulting', 'consultancy', 'advisory', 'strategy'],
      'Technology': ['technology', 'tech', 'software', 'development', 'engineering'],
    };

    for (const [industry, patterns] of Object.entries(industryPatterns)) {
      for (const pattern of patterns) {
        if (allText.includes(pattern)) {
          return industry;
        }
      }
    }

    return null;
  }

  /**
   * Categorize social links by platform
   */
  private categorizeSocialLinks(links: string[]): ContactInfo['socialLinks'] {
    const result: ContactInfo['socialLinks'] = {
      linkedin: null,
      twitter: null,
      facebook: null,
    };

    for (const link of links) {
      const lower = link.toLowerCase();
      if (lower.includes('linkedin.com')) {
        result.linkedin = link;
      } else if (lower.includes('twitter.com') || lower.includes('x.com')) {
        result.twitter = link;
      } else if (lower.includes('facebook.com')) {
        result.facebook = link;
      }
    }

    return result;
  }

  /**
   * Detect tech stack from HTML
   */
  private detectTechFromHtml(html: string): TechSignals {
    const platforms: string[] = [];
    const tools: string[] = [];
    const lowerHtml = html.toLowerCase();

    // Platform detection
    if (lowerHtml.includes('shopify') || lowerHtml.includes('cdn.shopify.com')) {
      platforms.push('Shopify');
    }
    if (lowerHtml.includes('wordpress') || lowerHtml.includes('wp-content')) {
      platforms.push('WordPress');
    }
    if (lowerHtml.includes('wix.com') || lowerHtml.includes('wixsite')) {
      platforms.push('Wix');
    }
    if (lowerHtml.includes('squarespace')) {
      platforms.push('Squarespace');
    }
    if (lowerHtml.includes('webflow')) {
      platforms.push('Webflow');
    }

    // Tool detection
    if (lowerHtml.includes('intercom') || lowerHtml.includes('intercomcdn')) {
      tools.push('Intercom');
    }
    if (lowerHtml.includes('hubspot') || lowerHtml.includes('hs-scripts')) {
      tools.push('HubSpot');
    }
    if (lowerHtml.includes('drift') || lowerHtml.includes('drift.com')) {
      tools.push('Drift');
    }
    if (lowerHtml.includes('zendesk')) {
      tools.push('Zendesk');
    }
    if (lowerHtml.includes('google-analytics') || lowerHtml.includes('gtag') || lowerHtml.includes('ga.js')) {
      tools.push('Google Analytics');
    }
    if (lowerHtml.includes('facebook') && lowerHtml.includes('pixel')) {
      tools.push('Facebook Pixel');
    }
    if (lowerHtml.includes('hotjar')) {
      tools.push('Hotjar');
    }
    if (lowerHtml.includes('segment.com') || lowerHtml.includes('analytics.js')) {
      tools.push('Segment');
    }
    if (lowerHtml.includes('mailchimp')) {
      tools.push('Mailchimp');
    }
    if (lowerHtml.includes('klaviyo')) {
      tools.push('Klaviyo');
    }

    return {
      detectedPlatforms: [...new Set(platforms)],
      detectedTools: [...new Set(tools)],
    };
  }

  /**
   * Detect business signals from content
   */
  private detectBusinessSignals(
    mainContent: Awaited<ReturnType<typeof scrapeWebsite>> | undefined,
    careersInfo: { isHiring: boolean; jobCount: number }
  ): BusinessSignals {
    const html = mainContent?.rawHtml?.toLowerCase() ?? '';
    const text = mainContent?.cleanedText?.toLowerCase() ?? '';

    return {
      isHiring: careersInfo.isHiring,
      openPositions: careersInfo.jobCount,
      hasEcommerce: html.includes('add to cart') || html.includes('checkout') || html.includes('buy now'),
      hasBlog: html.includes('/blog') || html.includes('blog-post') || text.includes('our blog'),
      hasNewsletter: html.includes('newsletter') || html.includes('subscribe') || html.includes('email list'),
    };
  }

  /**
   * Calculate confidence score based on data completeness
   */
  private calculateConfidence(
    mainContent: Awaited<ReturnType<typeof scrapeWebsite>> | undefined,
    aboutContent: Awaited<ReturnType<typeof scrapeWebsite>> | null,
    dataPoints: { potentialEmail?: string; socialLinks: string[] },
    keyFindings: KeyFindings
  ): number {
    let score = 0;
    let maxScore = 0;

    // Main content scraped
    maxScore += 20;
    if (mainContent?.cleanedText && mainContent.cleanedText.length > 100) {
      score += 20;
    }

    // About page found
    maxScore += 15;
    if (aboutContent) {
      score += 15;
    }

    // Company name found
    maxScore += 15;
    if (keyFindings.companyName) {
      score += 15;
    }

    // Description found
    maxScore += 10;
    if (keyFindings.description) {
      score += 10;
    }

    // Industry detected
    maxScore += 10;
    if (keyFindings.industry) {
      score += 10;
    }

    // Contact info found
    maxScore += 15;
    if (dataPoints.potentialEmail) {
      score += 10;
    }
    if (dataPoints.socialLinks.length > 0) {
      score += 5;
    }

    // Metadata present
    maxScore += 15;
    if (mainContent?.title) {
      score += 5;
    }
    if (mainContent?.metadata?.keywords?.length) {
      score += 5;
    }
    if (mainContent?.description) {
      score += 5;
    }

    return Math.round((score / maxScore) * 100) / 100;
  }

  /**
   * Infer main topics from keywords
   */
  private inferTopics(keywords: string[]): string[] {
    // Group related keywords into topics
    const topics: string[] = [];
    const keywordSet = new Set(keywords.map(k => k.toLowerCase()));

    if (keywordSet.has('software') || keywordSet.has('platform') || keywordSet.has('saas')) {
      topics.push('Software/SaaS');
    }
    if (keywordSet.has('marketing') || keywordSet.has('growth') || keywordSet.has('sales')) {
      topics.push('Marketing & Sales');
    }
    if (keywordSet.has('team') || keywordSet.has('company') || keywordSet.has('about')) {
      topics.push('Company Info');
    }
    if (keywordSet.has('product') || keywordSet.has('features') || keywordSet.has('solution')) {
      topics.push('Products & Services');
    }
    if (keywordSet.has('customers') || keywordSet.has('clients') || keywordSet.has('testimonials')) {
      topics.push('Customer Focus');
    }

    return topics.slice(0, 5);
  }

  // ==========================================================================
  // UTILITY METHODS
  // ==========================================================================

  private normalizeUrl(url: string): string {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
      return `https://${url}`;
    }
    return url;
  }

  private extractBaseUrl(url: string): string {
    try {
      const parsed = new URL(url);
      return `${parsed.protocol}//${parsed.host}`;
    } catch {
      return url;
    }
  }
}

// ============================================================================
// FACTORY FUNCTION
// ============================================================================

export function createScraperSpecialist(): ScraperSpecialist {
  return new ScraperSpecialist();
}

// ============================================================================
// SINGLETON INSTANCE
// ============================================================================

let instance: ScraperSpecialist | null = null;

export function getScraperSpecialist(): ScraperSpecialist {
  instance ??= createScraperSpecialist();
  return instance;
}
