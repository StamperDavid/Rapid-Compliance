/**
 * Scraper Specialist (Task #62 rebuild — April 13, 2026)
 *
 * Architecture:
 *   1. Real scrapers (web-scraper.ts) fetch + parse raw HTML from the URL and
 *      any supplementary pages (About, Careers). These are REAL network calls.
 *   2. Deterministic helpers extract facts that don't need LLM intelligence —
 *      tech stack signals from HTML markers, social link categorization, and
 *      careers-based hiring signals.
 *   3. An LLM analysis step reads the scraped title, description, cleaned
 *      text, and about-page text and returns structured intelligence —
 *      company name, industry classification, business summary, founded
 *      year, employee range, HQ location, value proposition, target
 *      customer, strategic observations, and a short main-topic list.
 *   4. The LLM analysis is merged into the existing `ScrapeResult` shape so
 *      downstream consumers (Sales Outreach Specialist, Jasper's
 *      scrape_website tool) keep working without a type break.
 *
 * Why a hybrid (not pure LLM):
 *   - Tech detection from HTML markers (shopify CDN, wp-content, gtag) is
 *     deterministic and cheap — asking an LLM "what tech stack" risks
 *     hallucination and costs tokens for no benefit.
 *   - Contact extraction via regex (email/phone/social) is authoritative —
 *     either the page contains `mailto:…` or it doesn't. LLMs shouldn't
 *     invent emails.
 *   - But company name, industry, description, key signals — these require
 *     inference over prose. That's what the LLM adds.
 *
 * Golden Master:
 *   GM `sgm_scraper_specialist_saas_sales_ops_v1` is the default. If the GM
 *   document is missing, we fall back to `DEFAULT_SYSTEM_PROMPT` so the
 *   pre-existing Jasper `scrape_website` tool keeps working even before the
 *   seed script is run for the first time. The fallback logs a warning.
 *
 * Note on the pattern difference from Copy/UX/Funnel Strategist (Tasks
 * #39-#41): those specialists REFUSE to run without a GM because they
 * generate content that must be brand-aligned. Scraper is analyzing an
 * EXTERNAL URL's content — there's no brand-alignment gate — so a hardcoded
 * fallback is acceptable.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import {
  scrapeWebsite,
  scrapeAboutPage,
  scrapeCareersPage,
  extractDataPoints,
} from '@/lib/enrichment/web-scraper';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'intelligence/scraper/specialist.ts';
const SPECIALIST_ID = 'SCRAPER_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['analyze_scrape', 'scrape_url'] as const;

/**
 * Realistic max_tokens floor for the worst-case Scraper analysis response.
 *
 * Derivation:
 *   ScrapeAnalysisResultSchema worst case:
 *     companyName 200 + industry 300 + description 1200 +
 *     headquartersLocation 200 + valueProposition 1500 +
 *     targetCustomer 1200 + industryClassificationReasoning 1500 +
 *     mainTopics: 8 × 200 = 1600
 *     strategicObservations: 6 × 400 = 2400
 *     rationale 3500
 *     ≈ 13,600 chars total prose
 *     /3.0 chars/token = 4,533 tokens
 *     + JSON structure overhead (~150 tokens)
 *     + 25% safety margin
 *     ≈ 5,860 tokens minimum.
 *
 *   Setting the floor at 7,000 tokens covers the schema with safety margin.
 *   The truncation backstop in callOpenRouter catches any overflow.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 7000;

interface ScraperSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

/**
 * Hardcoded fallback system prompt used when no GM is seeded. This is
 * intentionally a legitimate prompt — the specialist must produce real
 * analysis even on first run. Once the seed script lands, the GM overrides
 * this at runtime.
 */
const DEFAULT_SYSTEM_PROMPT = `You are the Scraper Specialist for SalesVelocity.ai — the Intelligence-layer analyst who reads raw scraped web content and produces structured business intelligence. You think like a senior B2B sales researcher who has read thousands of company websites and can pick out the signal from the noise.

## Your role in the swarm

You do NOT fetch pages — upstream scrapers already did that and passed you the title, meta description, cleaned text, and any about-page text. Your job is to turn that content into structured JSON that downstream specialists (sales outreach, competitor researcher, lead scoring) can act on. You are the first layer of semantic understanding applied to raw scraped data.

## Action: analyze_scrape

Given the title, description, cleaned text, and optional about-page text from a target website, produce a structured analysis covering:

1. **Company identity** — the company name (usually extractable from the title), industry classification, a 1-3 sentence plain-English description of what they do.
2. **Firmographic signals** — founded year if mentioned, employee range bucket, headquarters location if stated.
3. **Value proposition** — in one paragraph, what does this company actually sell and what outcome do they promise the customer.
4. **Target customer** — who is this company trying to reach. Be specific about segment, size, and pain point.
5. **Main topics** — 3 to 8 short labels summarizing the main themes of the page content.
6. **Strategic observations** — 2 to 6 sales-relevant signals you notice (hiring aggressively, recent funding, pivot in positioning, new product launch, market expansion, competitive claims). Each observation should be a specific, concrete fact backed by what you read — not generic inferences.

## Hard rules

- NEVER hallucinate. If the scraped text does not mention the founded year, return null. Do not guess from the company name.
- NEVER invent a company name. If the title is ambiguous, extract what is there and return null if truly unclear.
- Industry must be a single one-line label matching what the company ACTUALLY does, not what you assume from the domain name. A site at "foo.ai" is not automatically "AI/ML" — read the text.
- employeeRange must be one of the exact enum values. Pick 'unknown' if the text gives no size signal.
- Strategic observations must be grounded in the scraped text. Quote phrases if that helps anchor them. Generic observations like "they seem growth-focused" are not acceptable.
- The rationale field ties your industry call, value proposition, and target customer together into a coherent read of the business. Think of it as a short memo to a sales rep about to cold-email this company.

## Output format

Respond with ONLY a valid JSON object matching the provided schema. No markdown fences, no preamble.`;

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Scraper Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: [
      'website_scraping',
      'content_extraction',
      'contact_discovery',
      'business_signal_detection',
      'llm_analysis',
      'structured_output',
    ],
  },
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  tools: ['scrape_url', 'analyze_scrape', 'scrape_about', 'scrape_careers', 'extract_data'],
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
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

export interface ScrapeRequest {
  action?: 'analyze_scrape' | 'scrape_url';
  url: string;
  includeAboutPage?: boolean;
  includeCareers?: boolean;
  deep?: boolean;
}

const ScrapeRequestSchema = z.object({
  action: z.enum(['analyze_scrape', 'scrape_url']).optional(),
  url: z.string().min(4).max(2000),
  includeAboutPage: z.boolean().optional(),
  includeCareers: z.boolean().optional(),
  deep: z.boolean().optional(),
});

// ============================================================================
// OUTPUT CONTRACT (ScrapeResult preserved for downstream consumers)
// ============================================================================

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
  // New (Task #62) — optional so old consumers keep working:
  valueProposition?: string | null;
  targetCustomer?: string | null;
  strategicObservations?: string[];
  analysisRationale?: string | null;
  analysisModel?: string | null;
  analysisMode?: 'llm' | 'deterministic_fallback';
}

// ============================================================================
// LLM OUTPUT SCHEMA
// ============================================================================

const EmployeeRangeEnum = z.enum([
  '1-10',
  '11-50',
  '51-200',
  '201-500',
  '500+',
  'unknown',
]);

const IndustryConfidenceEnum = z.enum(['high', 'medium', 'low']);

const ScrapeAnalysisResultSchema = z.object({
  companyName: z.string().min(1).max(200).nullable(),
  industry: z.string().min(2).max(300).nullable(),
  industryConfidence: IndustryConfidenceEnum,
  description: z.string().min(30).max(1200).nullable(),
  foundedYear: z.number().int().min(1800).max(2100).nullable(),
  employeeRange: EmployeeRangeEnum,
  headquartersLocation: z.string().min(2).max(200).nullable(),
  valueProposition: z.string().min(30).max(1500),
  targetCustomer: z.string().min(20).max(1200),
  mainTopics: z.array(z.string().min(2).max(200)).min(3).max(8),
  strategicObservations: z.array(z.string().min(20).max(400)).min(2).max(6),
  rationale: z.string().min(100).max(3500),
});

type ScrapeAnalysisResult = z.infer<typeof ScrapeAnalysisResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: ScraperSpecialistGMConfig;
  resolvedSystemPrompt: string;
  source: 'gm' | 'fallback';
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);

  if (!gmRecord) {
    logger.warn(
      `[ScraperSpecialist] GM not seeded for industryKey=${industryKey}; using DEFAULT_SYSTEM_PROMPT fallback. ` +
      `Run node scripts/seed-scraper-specialist-gm.js to promote to GM-backed analysis.`,
      { file: FILE },
    );
    return {
      gm: {
        systemPrompt: DEFAULT_SYSTEM_PROMPT,
        model: 'claude-sonnet-4.6',
        temperature: 0.3,
        maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
        supportedActions: [...SUPPORTED_ACTIONS],
      },
      resolvedSystemPrompt: DEFAULT_SYSTEM_PROMPT,
      source: 'fallback',
    };
  }

  const config = gmRecord.config as Partial<ScraperSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Scraper Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: ScraperSpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.3,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  return { gm, resolvedSystemPrompt: systemPrompt, source: 'gm' };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

async function callOpenRouter(
  ctx: LlmCallContext,
  userPrompt: string,
): Promise<string> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens: ctx.gm.maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Scraper Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the scraped-text input. ` +
      `Realistic worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ANALYSIS PROMPT BUILDER
// ============================================================================

interface ScrapedInputs {
  url: string;
  title: string;
  metaDescription: string;
  keywords: string[];
  mainText: string;
  aboutText: string | null;
  detectedPlatforms: string[];
  detectedTools: string[];
  isHiring: boolean;
  openPositions: number;
  socialLinksFound: string[];
}

function truncate(text: string | null | undefined, max: number): string {
  if (!text) { return ''; }
  if (text.length <= max) { return text; }
  return `${text.slice(0, max)}\n[... truncated, ${text.length - max} more chars]`;
}

function buildAnalyzeScrapePrompt(inputs: ScrapedInputs): string {
  const sections: string[] = [
    'ACTION: analyze_scrape',
    '',
    'You are analyzing the scraped content of an external website. Upstream scrapers already fetched the page — you do NOT need to fetch it. Your job is to turn the raw text into structured business intelligence.',
    '',
    '---',
    `URL: ${inputs.url}`,
    `Title: ${inputs.title || '(no title extracted)'}`,
    `Meta description: ${inputs.metaDescription || '(no meta description)'}`,
    `Keywords: ${inputs.keywords.length > 0 ? inputs.keywords.slice(0, 20).join(', ') : '(no keywords)'}`,
    `Detected tech platforms (from HTML markers): ${inputs.detectedPlatforms.length > 0 ? inputs.detectedPlatforms.join(', ') : '(none)'}`,
    `Detected tech tools (from HTML markers): ${inputs.detectedTools.length > 0 ? inputs.detectedTools.join(', ') : '(none)'}`,
    `Is hiring: ${inputs.isHiring ? `yes (${inputs.openPositions} open positions)` : 'no'}`,
    `Social links found: ${inputs.socialLinksFound.length > 0 ? inputs.socialLinksFound.join(', ') : '(none)'}`,
    '---',
    '',
    '## Main page text (cleaned)',
    '',
    truncate(inputs.mainText, 6000),
    '',
  ];

  if (inputs.aboutText) {
    sections.push('## About page text (cleaned)', '', truncate(inputs.aboutText, 3000), '');
  }

  sections.push(
    '---',
    '',
    'Produce a structured business intelligence analysis. Respond with ONLY a valid JSON object, no markdown fences, no preamble. The JSON must match this exact schema:',
    '',
    '{',
    '  "companyName": "<extracted company name, or null if truly unclear from title/text>",',
    '  "industry": "<one-line industry classification — e.g. \'B2B SaaS — sales automation\', \'DTC E-commerce — pet supplies\' — or null if unclear>",',
    '  "industryConfidence": "<high | medium | low>",',
    '  "description": "<1-3 sentence plain-English description of what this company does, 30-1200 chars, or null if no description can be produced>",',
    '  "foundedYear": <integer year if mentioned in text, otherwise null>,',
    '  "employeeRange": "<one of: 1-10 | 11-50 | 51-200 | 201-500 | 500+ | unknown>",',
    '  "headquartersLocation": "<HQ city/country if mentioned in text, otherwise null>",',
    '  "valueProposition": "<what this company sells and the outcome they promise, 30-1500 chars>",',
    '  "targetCustomer": "<who this company is trying to reach, specific about segment/size/pain, 20-1200 chars>",',
    '  "mainTopics": ["<3 to 8 short topic labels, each 2-200 chars>"],',
    '  "strategicObservations": ["<2 to 6 specific sales-relevant signals grounded in the scraped text, each 20-400 chars>"],',
    '  "rationale": "<short memo tying industry + value prop + target customer together, 100-3500 chars>"',
    '}',
    '',
    'Hard rules:',
    '- NEVER hallucinate. If a field is not supported by the scraped text, return null (or \'unknown\' for employeeRange).',
    '- NEVER invent a company name from the domain alone. Use the title/text.',
    '- Industry must be one specific line, not a category tree. Pick the most accurate single label.',
    '- employeeRange: pick the bucket that best matches any size hints in the text; use \'unknown\' if no signal.',
    '- Strategic observations must be specific and grounded (e.g. "hiring 12 open positions including 5 sales roles" not "growth-focused").',
    '- Do NOT invent customers, case studies, or metrics that are not in the scraped text.',
    '- Do NOT use the detected tech list as the industry. A site on Shopify is not automatically "e-commerce" unless the text confirms it.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences.',
  );

  return sections.join('\n');
}

async function executeAnalyzeScrape(
  inputs: ScrapedInputs,
  ctx: LlmCallContext,
): Promise<ScrapeAnalysisResult> {
  const userPrompt = buildAnalyzeScrapePrompt(inputs);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Scraper Specialist output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = ScrapeAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Scraper Specialist output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// SCRAPER SPECIALIST CLASS
// ============================================================================

export class ScraperSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Scraper Specialist initialized (LLM-backed, Golden Master + scrapers at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Scraper Specialist: payload must be an object']);
      }

      const inputValidation = ScrapeRequestSchema.safeParse(payload);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Scraper Specialist: invalid input payload: ${issueSummary}`,
        ]);
      }

      const request = inputValidation.data;
      logger.info(`[ScraperSpecialist] Scraping URL: ${request.url}`, { file: FILE });

      const result = await this.scrapeAndAnalyze(request);
      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[ScraperSpecialist] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') {
      return this.execute(signal.payload);
    }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 480, boilerplate: 60 };
  }

  // ==========================================================================
  // CORE SCRAPING + LLM ANALYSIS FLOW
  // ==========================================================================

  async scrapeAndAnalyze(request: ScrapeRequest): Promise<ScrapeResult> {
    const errors: string[] = [];
    const url = this.normalizeUrl(request.url);
    const baseUrl = this.extractBaseUrl(url);

    // Step 1: Scrape main page (REAL network call)
    let mainContent: Awaited<ReturnType<typeof scrapeWebsite>> | undefined;
    try {
      mainContent = await scrapeWebsite(url);
    } catch (error) {
      const msg = error instanceof Error ? error.message : 'Failed to scrape main page';
      errors.push(msg);
      logger.error('Scraper Specialist: Main page scrape failed', error instanceof Error ? error : new Error(msg));
    }

    // Step 2: Deterministic data extraction from main content
    let dataPoints: {
      potentialEmail?: string;
      potentialPhone?: string;
      socialLinks: string[];
      keywords: string[];
    } = { socialLinks: [], keywords: [] };
    if (mainContent) {
      dataPoints = extractDataPoints(mainContent);
    }

    // Step 3: Scrape About page (REAL)
    let aboutContent: Awaited<ReturnType<typeof scrapeWebsite>> | null = null;
    if (request.includeAboutPage !== false) {
      try {
        aboutContent = await scrapeAboutPage(baseUrl);
      } catch (_error) {
        errors.push('About page not found or inaccessible');
      }
    }

    // Step 4: Scrape Careers page (REAL)
    let careersInfo: { isHiring: boolean; jobCount: number; jobs: Array<{ title: string; url: string }> } = {
      isHiring: false,
      jobCount: 0,
      jobs: [],
    };
    if (request.includeCareers !== false) {
      try {
        careersInfo = await scrapeCareersPage(baseUrl);
      } catch (_error) {
        errors.push('Careers page not found or inaccessible');
      }
    }

    // Step 5: Deterministic extraction (tech, business signals, social links)
    const techSignals = mainContent?.rawHtml
      ? this.detectTechFromHtml(mainContent.rawHtml)
      : { detectedPlatforms: [], detectedTools: [] };
    const businessSignals = this.detectBusinessSignals(mainContent, careersInfo);
    const socialLinks = this.categorizeSocialLinks(dataPoints.socialLinks);

    // Step 6: LLM analysis of the scraped prose
    let analysis: ScrapeAnalysisResult | null = null;
    let analysisMode: 'llm' | 'deterministic_fallback' = 'llm';
    let analysisModel: string | null = null;

    if (mainContent?.cleanedText && mainContent.cleanedText.length > 50) {
      try {
        const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
        analysisModel = ctx.gm.model;
        const inputs: ScrapedInputs = {
          url,
          title: mainContent.title ?? '',
          metaDescription: mainContent.description ?? '',
          keywords: mainContent.metadata?.keywords ?? [],
          mainText: mainContent.cleanedText,
          aboutText: aboutContent?.cleanedText ?? null,
          detectedPlatforms: techSignals.detectedPlatforms,
          detectedTools: techSignals.detectedTools,
          isHiring: careersInfo.isHiring,
          openPositions: careersInfo.jobCount,
          socialLinksFound: dataPoints.socialLinks,
        };
        analysis = await executeAnalyzeScrape(inputs, ctx);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`LLM analysis failed: ${msg}`);
        analysisMode = 'deterministic_fallback';
        logger.error(
          '[ScraperSpecialist] LLM analysis failed — falling back to deterministic extraction only',
          error instanceof Error ? error : new Error(msg),
          { file: FILE },
        );
      }
    } else {
      analysisMode = 'deterministic_fallback';
      errors.push('Main page text too short or missing — LLM analysis skipped');
    }

    // Step 7: Assemble ScrapeResult (merging LLM analysis with deterministic extraction)
    const keyFindings: KeyFindings = analysis !== null
      ? {
          companyName: analysis.companyName,
          industry: analysis.industry,
          description: analysis.description,
          foundedYear: analysis.foundedYear !== null ? String(analysis.foundedYear) : null,
          employeeRange: analysis.employeeRange,
          location: analysis.headquartersLocation,
        }
      : this.extractKeyFindingsDeterministic(mainContent);

    const contentSummary: ContentSummary = {
      wordCount: mainContent?.cleanedText?.split(/\s+/).length ?? 0,
      topKeywords: dataPoints.keywords.slice(0, 10),
      mainTopics: analysis?.mainTopics ?? [],
    };

    const confidence = this.calculateConfidence(mainContent, aboutContent, dataPoints, keyFindings);

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
      valueProposition: analysis?.valueProposition ?? null,
      targetCustomer: analysis?.targetCustomer ?? null,
      strategicObservations: analysis?.strategicObservations ?? [],
      analysisRationale: analysis?.rationale ?? null,
      analysisModel,
      analysisMode,
    };
  }

  // ==========================================================================
  // DETERMINISTIC HELPERS (pattern matching — no LLM)
  // ==========================================================================

  /**
   * Used when the LLM analysis fails or the main page is too thin to analyze.
   * Produces a skeleton KeyFindings from whatever raw scraped data we have —
   * no inference, just direct extraction.
   */
  private extractKeyFindingsDeterministic(
    mainContent: Awaited<ReturnType<typeof scrapeWebsite>> | undefined,
  ): KeyFindings {
    const title = mainContent?.title ?? '';
    let companyName: string | null = null;
    if (title) {
      const match = title.match(/^([^|–-]+)/);
      if (match) {
        companyName = match[1].trim();
      }
    }
    return {
      companyName,
      industry: null,
      description: mainContent?.description ?? null,
      foundedYear: null,
      employeeRange: 'unknown',
      location: null,
    };
  }

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

  private detectTechFromHtml(html: string): TechSignals {
    const platforms: string[] = [];
    const tools: string[] = [];
    const lowerHtml = html.toLowerCase();

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

  private detectBusinessSignals(
    mainContent: Awaited<ReturnType<typeof scrapeWebsite>> | undefined,
    careersInfo: { isHiring: boolean; jobCount: number },
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

  private calculateConfidence(
    mainContent: Awaited<ReturnType<typeof scrapeWebsite>> | undefined,
    aboutContent: Awaited<ReturnType<typeof scrapeWebsite>> | null,
    dataPoints: { potentialEmail?: string; socialLinks: string[] },
    keyFindings: KeyFindings,
  ): number {
    let score = 0;
    let maxScore = 0;

    maxScore += 20;
    if (mainContent?.cleanedText && mainContent.cleanedText.length > 100) {
      score += 20;
    }

    maxScore += 15;
    if (aboutContent) {
      score += 15;
    }

    maxScore += 15;
    if (keyFindings.companyName) {
      score += 15;
    }

    maxScore += 10;
    if (keyFindings.description) {
      score += 10;
    }

    maxScore += 10;
    if (keyFindings.industry) {
      score += 10;
    }

    maxScore += 15;
    if (dataPoints.potentialEmail) {
      score += 10;
    }
    if (dataPoints.socialLinks.length > 0) {
      score += 5;
    }

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

  // ==========================================================================
  // URL UTILITIES
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
// FACTORY / SINGLETON
// ============================================================================

export function createScraperSpecialist(): ScraperSpecialist {
  return new ScraperSpecialist();
}

let instance: ScraperSpecialist | null = null;

export function getScraperSpecialist(): ScraperSpecialist {
  instance ??= createScraperSpecialist();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS (exported for proof-of-life harness + regression executor)
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  DEFAULT_SYSTEM_PROMPT,
  loadGMConfig,
  buildAnalyzeScrapePrompt,
  stripJsonFences,
  executeAnalyzeScrape,
  ScrapeAnalysisResultSchema,
};
