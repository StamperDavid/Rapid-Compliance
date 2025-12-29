/**
 * Scraper Intelligence Types
 * Defines the research intelligence layer for industry-specific web scraping
 */

import { z } from 'zod';

// ============================================================================
// CORE TYPES
// ============================================================================

/**
 * Field types supported in custom extraction schemas
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'date' | 'array' | 'object';

/**
 * Platforms that can be scraped or searched
 */
export type ScrapingPlatform = 
  | 'website'           // Company website (always available)
  | 'linkedin-jobs'     // LinkedIn job postings (via API or scraping)
  | 'linkedin-company'  // LinkedIn company page (limited)
  | 'news'              // News articles (via NewsAPI)
  | 'crunchbase'        // Funding data (via API, requires key)
  | 'dns'               // DNS/WHOIS data (free)
  | 'google-business'   // Google Business Profile (requires API)
  | 'social-media';     // Generic social media (Facebook, Twitter, Instagram)

/**
 * Priority levels for signals and extraction
 */
export type SignalPriority = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

/**
 * Actions to take when a high-value signal is detected
 */
export type SignalAction = 
  | 'increase-score'     // Boost lead score
  | 'trigger-workflow'   // Start an automated workflow
  | 'add-to-segment'     // Add to a specific audience segment
  | 'notify-user'        // Send notification to user
  | 'flag-for-review';   // Mark for manual review

/**
 * Scraping frequency options
 */
export type ScrapingFrequency = 
  | 'per-lead'    // Scrape every time a lead is enriched
  | 'daily'       // Scrape once per day (for company updates)
  | 'weekly'      // Scrape once per week
  | 'on-change';  // Scrape only when website changes detected

// ============================================================================
// SCRAPING STRATEGY
// ============================================================================

/**
 * Defines which platforms to scrape and in what order
 */
export interface ScrapingStrategy {
  /**
   * Primary data source (always scraped first)
   */
  primarySource: ScrapingPlatform;

  /**
   * Secondary sources (scraped in parallel or as fallback)
   */
  secondarySources: ScrapingPlatform[];

  /**
   * How often to refresh data for this industry
   */
  frequency: ScrapingFrequency;

  /**
   * Maximum time to spend scraping (ms)
   * Used to prevent timeout for slow sites
   */
  timeoutMs?: number;

  /**
   * Whether to use cache for this industry
   * Some industries need fresh data (news), others can cache (company info)
   */
  enableCaching: boolean;

  /**
   * Cache TTL in seconds
   */
  cacheTtlSeconds?: number;
}

// Zod schema for validation
export const ScrapingStrategySchema = z.object({
  primarySource: z.enum([
    'website',
    'linkedin-jobs',
    'linkedin-company',
    'news',
    'crunchbase',
    'dns',
    'google-business',
    'social-media',
  ]),
  secondarySources: z.array(z.enum([
    'website',
    'linkedin-jobs',
    'linkedin-company',
    'news',
    'crunchbase',
    'dns',
    'google-business',
    'social-media',
  ])),
  frequency: z.enum(['per-lead', 'daily', 'weekly', 'on-change']),
  timeoutMs: z.number().positive().optional(),
  enableCaching: z.boolean(),
  cacheTtlSeconds: z.number().positive().optional(),
});

// ============================================================================
// HIGH-VALUE SIGNALS
// ============================================================================

/**
 * Defines a pattern or keyword that indicates a high-quality lead
 */
export interface HighValueSignal {
  /**
   * Unique identifier for this signal
   */
  id: string;

  /**
   * Human-readable label
   */
  label: string;

  /**
   * Description of what this signal means
   */
  description: string;

  /**
   * Keywords or phrases to search for (case-insensitive)
   */
  keywords: string[];

  /**
   * Regex pattern for more complex matching (optional)
   */
  regexPattern?: string;

  /**
   * Which platform to look for this signal
   */
  platform: ScrapingPlatform | 'any';

  /**
   * Priority level (affects lead score boost)
   */
  priority: SignalPriority;

  /**
   * What to do when this signal is detected
   */
  action: SignalAction;

  /**
   * Points to add to lead score if detected
   */
  scoreBoost: number;

  /**
   * Additional context for training/debugging
   */
  examples?: string[];
}

// Zod schema
export const HighValueSignalSchema = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  keywords: z.array(z.string()).min(1),
  regexPattern: z.string().optional(),
  platform: z.union([
    z.enum([
      'website',
      'linkedin-jobs',
      'linkedin-company',
      'news',
      'crunchbase',
      'dns',
      'google-business',
      'social-media',
    ]),
    z.literal('any'),
  ]),
  priority: z.enum(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']),
  action: z.enum([
    'increase-score',
    'trigger-workflow',
    'add-to-segment',
    'notify-user',
    'flag-for-review',
  ]),
  scoreBoost: z.number().int().min(0).max(100),
  examples: z.array(z.string()).optional(),
});

// ============================================================================
// FLUFF PATTERNS
// ============================================================================

/**
 * Defines text patterns to ignore as noise/boilerplate
 */
export interface FluffPattern {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Regex pattern to match
   */
  pattern: string;

  /**
   * Description of what this filters
   */
  description: string;

  /**
   * Where this pattern applies (optional, default: all)
   */
  context?: 'header' | 'footer' | 'sidebar' | 'body' | 'all';

  /**
   * Examples of text this pattern would match
   */
  examples?: string[];
}

// Zod schema
export const FluffPatternSchema = z.object({
  id: z.string().min(1),
  pattern: z.string().min(1),
  description: z.string().min(1),
  context: z.enum(['header', 'footer', 'sidebar', 'body', 'all']).optional(),
  examples: z.array(z.string()).optional(),
});

// ============================================================================
// SCORING RULES
// ============================================================================

/**
 * Defines conditional logic for boosting lead scores
 */
export interface ScoringRule {
  /**
   * Unique identifier
   */
  id: string;

  /**
   * Human-readable name
   */
  name: string;

  /**
   * Description of what triggers this rule
   */
  description: string;

  /**
   * Condition expression (evaluated as JavaScript)
   * Example: "careers_page_exists && hiring_count > 0"
   */
  condition: string;

  /**
   * Points to add if condition is true
   */
  scoreBoost: number;

  /**
   * Priority (rules evaluated in priority order)
   */
  priority: number;

  /**
   * Whether this rule is enabled
   */
  enabled: boolean;
}

// Zod schema
export const ScoringRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  condition: z.string().min(1),
  scoreBoost: z.number().int(),
  priority: z.number().int().min(1),
  enabled: z.boolean(),
});

// ============================================================================
// CUSTOM EXTRACTION FIELDS
// ============================================================================

/**
 * Defines a custom field to extract from scraped data
 */
export interface CustomField {
  /**
   * Field key (used in database)
   */
  key: string;

  /**
   * Human-readable label
   */
  label: string;

  /**
   * Data type
   */
  type: FieldType;

  /**
   * Description of what this field represents
   */
  description: string;

  /**
   * Keywords or patterns to identify this field's value
   */
  extractionHints: string[];

  /**
   * Whether this field is required
   */
  required: boolean;

  /**
   * Default value if not found
   */
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  defaultValue?: any;

  /**
   * Validation rule (Zod schema as string)
   */
  validation?: string;
}

// Zod schema
export const CustomFieldSchema = z.object({
  key: z.string().min(1).regex(/^[a-z_][a-z0-9_]*$/), // snake_case
  label: z.string().min(1),
  type: z.enum(['string', 'number', 'boolean', 'date', 'array', 'object']),
  description: z.string().min(1),
  extractionHints: z.array(z.string()),
  required: z.boolean(),
  defaultValue: z.any().optional(),
  validation: z.string().optional(),
});

// ============================================================================
// RESEARCH INTELLIGENCE (Main Interface)
// ============================================================================

/**
 * Complete research intelligence configuration for an industry
 * This guides the scraper on what to extract and how to score leads
 */
export interface ResearchIntelligence {
  /**
   * Scraping strategy for this industry
   */
  scrapingStrategy: ScrapingStrategy;

  /**
   * High-value signals to detect
   */
  highValueSignals: HighValueSignal[];

  /**
   * Patterns to filter out as noise
   */
  fluffPatterns: FluffPattern[];

  /**
   * Scoring rules for lead qualification
   */
  scoringRules: ScoringRule[];

  /**
   * Custom fields to extract (industry-specific)
   */
  customFields: CustomField[];

  /**
   * Metadata
   */
  metadata: {
    /**
     * Last updated timestamp (ISO 8601 string format)
     */
    lastUpdated: string;

    /**
     * Version number (for migration)
     */
    version: number;

    /**
     * Who created/updated this (system or user)
     */
    updatedBy: 'system' | 'user';

    /**
     * Notes or changelog
     */
    notes?: string;
  };
}

// Zod schema
export const ResearchIntelligenceSchema = z.object({
  scrapingStrategy: ScrapingStrategySchema,
  highValueSignals: z.array(HighValueSignalSchema),
  fluffPatterns: z.array(FluffPatternSchema),
  scoringRules: z.array(ScoringRuleSchema),
  customFields: z.array(CustomFieldSchema),
  metadata: z.object({
    lastUpdated: z.string(),
    version: z.number().int().positive(),
    updatedBy: z.enum(['system', 'user']),
    notes: z.string().optional(),
  }),
});

// ============================================================================
// TYPE GUARDS
// ============================================================================

/**
 * Type guard to check if a value is a valid ResearchIntelligence object
 */
export function isResearchIntelligence(value: unknown): value is ResearchIntelligence {
  try {
    ResearchIntelligenceSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for HighValueSignal
 */
export function isHighValueSignal(value: unknown): value is HighValueSignal {
  try {
    HighValueSignalSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for FluffPattern
 */
export function isFluffPattern(value: unknown): value is FluffPattern {
  try {
    FluffPatternSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Calculate total possible score boost from all signals
 */
export function calculateMaxScore(research: ResearchIntelligence): number {
  const signalScore = research.highValueSignals.reduce(
    (sum, signal) => sum + signal.scoreBoost,
    0
  );
  const ruleScore = research.scoringRules
    .filter((rule) => rule.enabled)
    .reduce((sum, rule) => sum + rule.scoreBoost, 0);

  return signalScore + ruleScore;
}

/**
 * Get all keywords across all high-value signals
 */
export function getAllKeywords(research: ResearchIntelligence): string[] {
  const keywords = research.highValueSignals.flatMap((signal) => signal.keywords);
  return Array.from(new Set(keywords.map((k) => k.toLowerCase())));
}

/**
 * Get all fluff patterns as compiled RegExp objects
 * Invalid regex patterns are silently skipped
 */
export function getFluffRegexes(research: ResearchIntelligence): RegExp[] {
  return research.fluffPatterns
    .map((pattern) => {
      try {
        return new RegExp(pattern.pattern, 'gi');
      } catch {
        // Invalid regex pattern - skip it
        return null;
      }
    })
    .filter((regex): regex is RegExp => regex !== null);
}

// ============================================================================
// DISTILLATION & TTL ARCHITECTURE
// ============================================================================

/**
 * Temporary scrape record (auto-deleted after 7 days)
 * Stores raw HTML/content for verification, then discarded
 * 
 * This implements the "Distillation Architecture" to prevent storage cost explosion:
 * - Raw scrapes are temporary (7 day TTL)
 * - Only extracted signals are saved permanently
 * - Content hashing prevents duplicate storage
 * - 95%+ storage cost reduction vs storing raw HTML forever
 */
export interface TemporaryScrape {
  /**
   * Unique ID for this scrape
   */
  id: string;

  /**
   * Organization that initiated the scrape
   */
  organizationId: string;

  /**
   * Workspace context (if applicable)
   */
  workspaceId?: string;

  /**
   * URL that was scraped
   */
  url: string;

  /**
   * Raw HTML content
   */
  rawHtml: string;

  /**
   * Cleaned/processed content (markdown)
   */
  cleanedContent: string;

  /**
   * SHA-256 hash of rawHtml (for duplicate detection)
   * Always 64 hex characters
   */
  contentHash: string;

  /**
   * When this scrape was first created
   */
  createdAt: Date;

  /**
   * When this scrape was last seen (same content hash)
   * Updated when duplicate content is scraped
   */
  lastSeen: Date;

  /**
   * When this scrape expires and will be auto-deleted
   * Set to createdAt + 7 days
   */
  expiresAt: Date;

  /**
   * How many times we've seen this exact content
   * Incremented when duplicate content is scraped
   */
  scrapeCount: number;

  /**
   * Extracted metadata
   */
  metadata: {
    title?: string;
    description?: string;
    author?: string;
    keywords?: string[];
  };

  /**
   * Size of rawHtml in bytes (for cost tracking)
   */
  sizeBytes: number;

  /**
   * Whether this has been verified by client in Training Center
   */
  verified: boolean;

  /**
   * If verified, when was it verified
   */
  verifiedAt?: Date;

  /**
   * Flag for immediate deletion (set when client verifies)
   * Cleanup job deletes these immediately
   */
  flaggedForDeletion: boolean;

  /**
   * Related lead/company ID (if extracted)
   */
  relatedRecordId?: string;
}

// Zod schema for TemporaryScrape
export const TemporaryScrapeSchema = z.object({
  id: z.string().min(1),
  organizationId: z.string().min(1),
  workspaceId: z.string().optional(),
  url: z.string().url(),
  rawHtml: z.string(),
  cleanedContent: z.string(),
  contentHash: z.string().length(64), // SHA-256 is always 64 hex chars
  createdAt: z.date(),
  lastSeen: z.date(),
  expiresAt: z.date(),
  scrapeCount: z.number().int().positive(),
  metadata: z.object({
    title: z.string().optional(),
    description: z.string().optional(),
    author: z.string().optional(),
    keywords: z.array(z.string()).optional(),
  }),
  sizeBytes: z.number().int().positive(),
  verified: z.boolean(),
  verifiedAt: z.date().optional(),
  flaggedForDeletion: z.boolean(),
  relatedRecordId: z.string().optional(),
});

/**
 * Extracted signal (saved permanently to CRM)
 * 
 * This is the "refined metal" from the "ore" of raw scrapes.
 * Only high-value signals are saved permanently (~2KB vs 500KB raw HTML).
 */
export interface ExtractedSignal {
  /**
   * Which high-value signal was detected
   */
  signalId: string;

  /**
   * Label from the signal definition
   */
  signalLabel: string;

  /**
   * Where the signal was found (snippet of text)
   * Limited to 500 chars to save space
   */
  sourceText: string;

  /**
   * Confidence score (0-100)
   */
  confidence: number;

  /**
   * Platform where it was found
   */
  platform: ScrapingPlatform;

  /**
   * When it was extracted
   */
  extractedAt: Date;

  /**
   * Source scrape ID (link to temporary_scrapes)
   * This link becomes broken after 7 days when temp scrape is deleted
   */
  sourceScrapeId: string;
}

// Zod schema for ExtractedSignal
export const ExtractedSignalSchema = z.object({
  signalId: z.string().min(1),
  signalLabel: z.string().min(1),
  sourceText: z.string().max(500), // Limit to 500 chars
  confidence: z.number().min(0).max(100),
  platform: z.enum([
    'website',
    'linkedin-jobs',
    'linkedin-company',
    'news',
    'crunchbase',
    'dns',
    'google-business',
    'social-media',
  ]),
  extractedAt: z.date(),
  sourceScrapeId: z.string().min(1),
});

/**
 * Type guard for TemporaryScrape
 */
export function isTemporaryScrape(value: unknown): value is TemporaryScrape {
  try {
    TemporaryScrapeSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Type guard for ExtractedSignal
 */
export function isExtractedSignal(value: unknown): value is ExtractedSignal {
  try {
    ExtractedSignalSchema.parse(value);
    return true;
  } catch {
    return false;
  }
}
