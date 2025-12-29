/**
 * Lead Enrichment Types
 * Structured interfaces for company data extraction
 */

import type { ExtractedSignal } from '@/types/scraper-intelligence';

/**
 * Core company enrichment data structure
 * This is what we extract from ANY source (search + scrape)
 */
export interface CompanyEnrichmentData {
  // Basic Info
  name: string;
  website: string;
  domain: string;
  description: string;
  
  // Company Details
  industry: string;
  size: 'startup' | 'small' | 'medium' | 'enterprise' | 'unknown';
  employeeCount?: number;
  employeeRange?: string; // e.g., "50-200"
  
  // Location
  headquarters?: {
    city?: string;
    state?: string;
    country?: string;
    address?: string;
  };
  
  // Technology & Tools
  techStack?: string[];
  
  // Business Info
  foundedYear?: number;
  revenue?: string;
  fundingStage?: string;
  
  // Social & Contact
  socialMedia?: {
    linkedin?: string;
    twitter?: string;
    facebook?: string;
  };
  contactEmail?: string;
  contactPhone?: string;
  
  // Signals & Insights
  recentNews?: NewsItem[];
  hiringStatus?: 'actively-hiring' | 'hiring' | 'not-hiring' | 'unknown';
  jobPostings?: JobPosting[];
  
  /**
   * High-value signals detected by distillation engine (NEW)
   * These are permanent signals extracted from temporary scrapes
   */
  extractedSignals?: ExtractedSignal[];
  
  /**
   * Lead score calculated from signals and scoring rules
   */
  leadScore?: number;
  
  /**
   * Custom industry-specific fields
   */
  customFields?: Record<string, any>;
  
  // Metadata
  lastUpdated: Date;
  dataSource: 'web-scrape' | 'search-api' | 'hybrid';
  confidence: number; // 0-100
}

export interface NewsItem {
  title: string;
  url: string;
  publishedDate: string;
  source: string;
  summary?: string;
}

export interface JobPosting {
  title: string;
  department: string;
  url: string;
  postedDate: string;
  location?: string;
}

/**
 * Search result from search APIs (Serper, Tavily, etc.)
 */
export interface CompanySearchResult {
  name: string;
  website: string;
  domain: string;
  snippet: string;
  source: string;
}

/**
 * Scraped website content (cleaned)
 */
export interface ScrapedContent {
  url: string;
  title: string;
  description: string;
  cleanedText: string; // HTML stripped, markdown formatted
  rawHtml?: string;
  metadata?: {
    author?: string;
    keywords?: string[];
    ogTitle?: string;
    ogDescription?: string;
  };
}

/**
 * Enrichment request parameters
 */
export interface EnrichmentRequest {
  // Input can be company name, domain, or website
  companyName?: string;
  domain?: string;
  website?: string;
  
  // Optional context for better results
  industry?: string;
  location?: string;
  
  /**
   * Industry template ID for intelligent signal extraction (NEW)
   * If provided, uses research intelligence for that industry
   * Examples: 'hvac', 'saas-software', 'residential-real-estate'
   */
  industryTemplateId?: string;
  
  // Control what to enrich
  includeNews?: boolean;
  includeJobs?: boolean;
  includeTechStack?: boolean;
  includeSocial?: boolean;
  
  /**
   * Enable distillation engine for signal extraction (NEW)
   * Default: true if industryTemplateId is provided
   */
  enableDistillation?: boolean;
}

/**
 * Enrichment response with cost tracking
 */
export interface EnrichmentResponse {
  success: boolean;
  data?: CompanyEnrichmentData;
  error?: string;
  
  // Cost tracking
  cost: {
    searchAPICalls: number;
    scrapingCalls: number;
    aiTokensUsed: number;
    totalCostUSD: number;
  };
  
  // Performance metrics
  metrics: {
    durationMs: number;
    dataPointsExtracted: number;
    confidenceScore: number;
    
    /**
     * Storage optimization metrics (NEW)
     * Tracks distillation engine efficiency
     */
    storageMetrics?: {
      rawScrapeSize: number; // bytes
      signalsSize: number; // bytes
      reductionPercent: number;
      temporaryScrapeId?: string; // Reference to temporary_scrapes document
      contentHash?: string; // SHA-256 hash for duplicate detection
      isDuplicate: boolean; // Whether this was a cache hit on content hash
    };
  };
}

/**
 * Teaching/Learning data structure
 * Stores what the user cares about for future enrichment
 */
export interface EnrichmentPreferences {
  organizationId: string;
  userId: string;
  
  // What signals matter to this user
  priorityFields: string[]; // e.g., ['techStack', 'fundingStage', 'employeeCount']
  
  // Industry-specific preferences
  industryFocus?: string[];
  
  // Size preferences
  preferredCompanySizes?: string[];
  
  // Geography
  preferredLocations?: string[];
  
  // Examples of "good" companies (for learning)
  exampleCompanies?: Array<{
    domain: string;
    reason: string; // why this is a good example
  }>;
  
  // Feedback history
  feedback: Array<{
    companyDomain: string;
    isGoodLead: boolean;
    timestamp: Date;
    reason?: string;
  }>;
  
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Cost tracking for analytics
 */
export interface EnrichmentCostLog {
  organizationId: string;
  timestamp: Date;
  
  // What was enriched
  companyDomain: string;
  
  // Costs breakdown
  searchAPICost: number;
  scrapingCost: number;
  aiProcessingCost: number;
  totalCost: number;
  
  // Comparison
  clearbitEquivalentCost: number; // What this would have cost with Clearbit
  savings: number;
  
  // Performance
  durationMs: number;
  success: boolean;
  
  /**
   * Storage optimization tracking (NEW)
   * Monitors distillation efficiency and cost savings
   */
  storageMetrics?: {
    rawScrapeSize: number;
    signalsSize: number;
    reductionPercent: number;
    temporaryScrapeId?: string;
    contentHash?: string;
    isDuplicate: boolean;
  };
}




