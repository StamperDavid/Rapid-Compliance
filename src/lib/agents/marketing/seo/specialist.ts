/**
 * SEO Expert — REAL AI AGENT (Task #28 rebuild, April 11 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6) to produce keyword research strategies
 * and domain SEO analyses. No template fallbacks. If the GM is missing, Brand
 * DNA is missing, OpenRouter fails, JSON won't parse, or Zod validation fails,
 * the specialist returns a real FAILED AgentReport with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - keyword_research  (MarketingManager.getSEOKeywordGuidance — default path)
 *   - domain_analysis   (MarketingManager.getSEOKeywordGuidance — domain path)
 *
 * The pre-rebuild template engine supported 8 actions. Six of them had no live
 * caller in the MarketingManager — they were dead surface. Per CLAUDE.md's
 * no-stubs and no-features-beyond-what-was-requested rules, the dead branches
 * are not rebuilt.
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { getBrandDNA, type BrandDNA } from '@/lib/brand/brand-dna-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'marketing/seo/specialist.ts';
const SPECIALIST_ID = 'SEO_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['keyword_research', 'domain_analysis'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case SEO Expert response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   The specialist supports two actions with different schemas. Computed
 *   the larger of the two and used it as the floor.
 *
 *   KeywordResearchResultSchema worst case (30 keywords):
 *     30 × (keyword ~50 + enums ~35 + contentRecommendation 300 + JSON 30)
 *     = 30 × 415 = 12,450 chars + strategy 2000 = ~14,450 chars
 *
 *   DomainAnalysisResultSchema worst case (LARGER):
 *     summary 3000 + technicalHealth (10 × 300 issues + 10 × 300 strengths
 *     = 6010) + contentGaps (15 × 390 = 5850) + recommendations
 *     (10 × 750 = 7500) + competitivePosition 3000
 *     ≈ 25,360 chars
 *     /3.0 chars/token = 8,453 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 10,816 tokens minimum.
 *
 *   The prior 6,000 was below the domain_analysis worst case. Setting the
 *   floor at 11,500 tokens covers both action paths with safety margin.
 *   The truncation backstop in callOpenRouter catches any overflow.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 11500;

interface SEOExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'SEO Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['keyword_research', 'domain_analysis'],
  },
  systemPrompt: '',
  tools: ['keyword_research', 'domain_analysis'],
  outputSchema: {
    type: 'object',
    properties: {
      keywords: { type: 'array' },
      strategy: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACTS
// ============================================================================

const KeywordResearchRequestSchema = z.object({
  action: z.literal('keyword_research'),
  seed: z.string().min(1),
  industry: z.string().min(1),
  targetCount: z.number().int().positive().optional(),
});

const DomainAnalysisRequestSchema = z.object({
  action: z.literal('domain_analysis'),
  domain: z.string().min(1),
  keywordLimit: z.number().int().positive().optional(),
});

type KeywordResearchRequest = z.infer<typeof KeywordResearchRequestSchema>;
type DomainAnalysisRequest = z.infer<typeof DomainAnalysisRequestSchema>;

// ============================================================================
// OUTPUT CONTRACTS (Zod schemas — enforced on every LLM response)
// ============================================================================

const KeywordResearchResultSchema = z.object({
  keywords: z.array(z.object({
    keyword: z.string().min(1),
    difficulty: z.enum(['low', 'medium', 'high']),
    searchIntent: z.enum(['informational', 'navigational', 'transactional', 'commercial']),
    estimatedVolume: z.enum(['low', 'medium', 'high', 'very_high']),
    contentRecommendation: z.string().min(20).max(300),
  })).min(5).max(30),
  // Cap widened from 2000 → 4000 (April 13 2026 cross-cutting fix). The
  // 2000-char cap was a Task #28 guess and was too tight for verbose
  // briefs (the SEO Expert pirate test surfaced this — pirate dialect
  // strategies legitimately exceeded 2000 chars). Same lesson the Email
  // Specialist learned at Task #43 when prose caps were widened from
  // their original guesses. Worst-case schema math in
  // MIN_OUTPUT_TOKENS_FOR_SCHEMA already accounts for the widened caps.
  strategy: z.string().min(50).max(4000),
}).superRefine((data, ctx) => {
  const seen = new Set<string>();
  for (let i = 0; i < data.keywords.length; i++) {
    const kw = data.keywords[i];
    if (!kw) { continue; }
    const lower = kw.keyword.toLowerCase();
    if (seen.has(lower)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['keywords', i, 'keyword'],
        message: `Duplicate keyword: ${kw.keyword}`,
      });
    }
    seen.add(lower);
  }
});

const DomainAnalysisResultSchema = z.object({
  summary: z.string().min(50).max(3000),
  technicalHealth: z.object({
    score: z.number().min(0).max(100),
    issues: z.array(z.string().min(10).max(300)).min(1).max(10),
    strengths: z.array(z.string().min(10).max(300)).max(10),
  }),
  contentGaps: z.array(z.object({
    topic: z.string().min(1),
    opportunity: z.string().min(20).max(300),
    priority: z.enum(['high', 'medium', 'low']),
  })).min(1).max(15),
  recommendations: z.array(z.object({
    action: z.string().min(10).max(500),
    impact: z.enum(['high', 'medium', 'low']),
    effort: z.enum(['low', 'medium', 'high']),
    timeframe: z.string().min(5).max(200),
  })).min(3).max(10),
  competitivePosition: z.string().min(30).max(3000),
});

export type KeywordResearchResult = z.infer<typeof KeywordResearchResultSchema>;
export type DomainAnalysisResult = z.infer<typeof DomainAnalysisResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: SEOExpertGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `SEO Expert GM not found for industryKey=${industryKey}. ` +
      `Run the SEO Expert GM seed script to seed.`,
    );
  }

  const config = gmRecord.config as Partial<SEOExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `SEO Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: SEOExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. SEO Expert refuses to analyze without brand identity. ' +
      'Visit /settings/ai-agents/business-setup.',
    );
  }

  const resolvedSystemPrompt = buildResolvedSystemPrompt(gm.systemPrompt, brandDNA);
  return { gm, brandDNA, resolvedSystemPrompt };
}

function buildResolvedSystemPrompt(baseSystemPrompt: string, brandDNA: BrandDNA): string {
  const keyPhrases = brandDNA.keyPhrases?.length > 0 ? brandDNA.keyPhrases.join(', ') : '(none configured)';
  const avoidPhrases = brandDNA.avoidPhrases?.length > 0 ? brandDNA.avoidPhrases.join(', ') : '(none configured)';
  const competitors = brandDNA.competitors?.length > 0 ? brandDNA.competitors.join(', ') : '(none configured)';

  const brandBlock = [
    '',
    '## Brand DNA (runtime injection — do not confuse with system prompt)',
    '',
    `Company: ${brandDNA.companyDescription}`,
    `Unique value: ${brandDNA.uniqueValue}`,
    `Target audience: ${brandDNA.targetAudience}`,
    `Tone of voice: ${brandDNA.toneOfVoice}`,
    `Communication style: ${brandDNA.communicationStyle}`,
    `Industry: ${brandDNA.industry}`,
    `Key phrases to weave in naturally: ${keyPhrases}`,
    `Phrases you are forbidden from using: ${avoidPhrases}`,
    `Competitors (never name them unless specifically asked): ${competitors}`,
  ].join('\n');

  return `${baseSystemPrompt}\n${brandBlock}`;
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

  // Truncation detection (cross-cutting fix). The OpenRouter provider was
  // hardcoding finishReason='stop' for months, silently masking length-
  // truncated responses. Now that the provider is honest, fail loudly on
  // any 'length' finish_reason instead of feeding incomplete JSON to
  // JSON.parse and surfacing a misleading "unexpected end of input".
  if (response.finishReason === 'length') {
    throw new Error(
      `SEO Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the brief. ` +
      `Realistic worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens (driven by domain_analysis).`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: keyword_research
// ============================================================================

function buildKeywordResearchUserPrompt(req: KeywordResearchRequest, targetCount: number): string {
  return [
    'ACTION: keyword_research',
    '',
    `Seed keyword/topic: ${req.seed}`,
    `Industry vertical: ${req.industry}`,
    `Target keyword count: ${targetCount}`,
    '',
    'Produce a ranked list of target keywords with a strategy summary. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "keywords": [',
    '    {',
    '      "keyword": "exact keyword phrase",',
    '      "difficulty": "low | medium | high",',
    '      "searchIntent": "informational | navigational | transactional | commercial",',
    '      "estimatedVolume": "low | medium | high | very_high",',
    '      "contentRecommendation": "Specific content piece recommendation with a concrete angle (20-300 chars)"',
    '    }',
    '  ],',
    '  "strategy": "Overall keyword strategy tying the keywords together into a coherent content plan (50-2000 chars)"',
    '}',
    '',
    'Hard rules you MUST follow:',
    `- Return exactly ${targetCount} keywords (minimum 5, maximum 30).`,
    '- ORDER keywords from highest strategic priority (broad, high-volume terms the brand should anchor on) to lowest (long-tail niche terms for supporting content). The first 3 keywords will be used as primary targets, keywords 4-8 as secondary, and the rest as long-tail opportunities. This ordering drives the entire content strategy downstream — do not randomize.',
    '- Every keyword must be unique (case-insensitive). No duplicates.',
    '- difficulty: "low" = achievable within 3 months for a new domain, "medium" = 3-6 months with consistent content, "high" = 6+ months requiring backlink authority.',
    '- searchIntent: "informational" = seeking knowledge, "navigational" = seeking a specific site, "transactional" = ready to buy, "commercial" = comparing options.',
    '- estimatedVolume: "low" = <1K monthly, "medium" = 1K-10K, "high" = 10K-100K, "very_high" = 100K+. Base on industry and keyword specificity.',
    '- contentRecommendation: Suggest a SPECIFIC content piece with a concrete angle — not "write a blog post about X" but "Write a 2,000-word comparison guide: \'[Brand] vs [competitor] for [use case]\' targeting commercial intent."',
    '- Make every recommendation specific to THIS brand and THIS industry from the Brand DNA — not generic SEO advice.',
    '- Do NOT fabricate specific traffic numbers, exact search volumes, or precise ranking positions.',
    '- Do NOT name competitors unless the Brand DNA explicitly lists them.',
    '- Do NOT use any phrase from the Brand DNA avoidPhrases list.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences.',
  ].join('\n');
}

async function executeKeywordResearch(
  req: KeywordResearchRequest,
  ctx: LlmCallContext,
): Promise<KeywordResearchResult> {
  const targetCount = req.targetCount ?? 15;
  const userPrompt = buildKeywordResearchUserPrompt(req, targetCount);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `SEO Expert keyword_research output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = KeywordResearchResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`SEO Expert keyword_research output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// ACTION: domain_analysis
// ============================================================================

function buildDomainAnalysisUserPrompt(req: DomainAnalysisRequest): string {
  const keywordLimit = req.keywordLimit ?? 20;

  return [
    'ACTION: domain_analysis',
    '',
    `Domain URL: ${req.domain}`,
    `Keyword limit for content gap analysis: ${keywordLimit}`,
    '',
    'Produce a comprehensive SEO health assessment. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "summary": "Overall assessment (50-3000 chars). Start with [ACTION REQUIRED] if there are critical issues needing immediate attention.",',
    '  "technicalHealth": {',
    '    "score": 0-100,',
    '    "issues": ["Issue description (10-300 chars each)", "..."],',
    '    "strengths": ["Strength description (10-300 chars each)", "..."]',
    '  },',
    '  "contentGaps": [',
    '    {',
    '      "topic": "Topic the domain should rank for",',
    '      "opportunity": "Why this matters for the brand (20-300 chars)",',
    '      "priority": "high | medium | low"',
    '    }',
    '  ],',
    '  "recommendations": [',
    '    {',
    '      "action": "Specific actionable recommendation (10-500 chars)",',
    '      "impact": "high | medium | low",',
    '      "effort": "low | medium | high",',
    '      "timeframe": "Estimated timeframe (5-200 chars)"',
    '    }',
    '  ],',
    '  "competitivePosition": "Where this domain stands in its industry (30-1000 chars)"',
    '}',
    '',
    'Hard rules you MUST follow:',
    '- summary: Start with "[ACTION REQUIRED]" ONLY if there are critical issues (broken SSL, no indexing, severe mobile issues, thin content on key pages). Otherwise start with a clean descriptive assessment. The downstream system reads this prefix to determine alert severity.',
    '- technicalHealth.score: Rate 0-100 based on SSL, mobile responsiveness, page speed, crawlability, structured data, canonical tags, sitemap, robots.txt. Deduct proportionally for each issue.',
    '- technicalHealth.issues: At least 1, at most 10. Each 10-300 characters.',
    '- technicalHealth.strengths: At most 10. Each 10-300 characters. Can be empty array if no strengths found.',
    '- contentGaps: 1-15 topics the domain SHOULD rank for based on its industry but currently does not. Each opportunity must explain why it matters for THIS brand specifically.',
    `- contentGaps: Limit to ${keywordLimit} most important keyword-related gaps.`,
    '- recommendations: 3-10 specific, actionable items. Not "improve your SEO" but "Add FAQ schema markup to the pricing page to capture featured snippets for \'[product] pricing\' queries."',
    '- recommendations: Each must include realistic impact, effort, and timeframe estimates.',
    '- competitivePosition: Assess challenger/leader/invisible status. Identify strongest SEO asset and biggest vulnerability.',
    '- Make every assessment specific to THIS domain and THIS industry from the Brand DNA — not generic SEO advice.',
    '- Do NOT fabricate specific traffic numbers, exact DA/DR scores, or precise ranking positions.',
    '- Do NOT name competitors unless the Brand DNA explicitly lists them.',
    '- Do NOT use any phrase from the Brand DNA avoidPhrases list.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences.',
  ].join('\n');
}

async function executeDomainAnalysis(
  req: DomainAnalysisRequest,
  ctx: LlmCallContext,
): Promise<DomainAnalysisResult> {
  const userPrompt = buildDomainAnalysisUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `SEO Expert domain_analysis output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = DomainAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`SEO Expert domain_analysis output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// SEO EXPERT CLASS
// ============================================================================

export class SEOExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'SEO Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['SEO Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['SEO Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `SEO Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[SEOExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);

      switch (action) {
        case 'keyword_research': {
          const inputValidation = KeywordResearchRequestSchema.safeParse({
            ...payload,
            action,
          });
          if (!inputValidation.success) {
            const issueSummary = inputValidation.error.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; ');
            return this.createReport(taskId, 'FAILED', null, [
              `SEO Expert keyword_research: invalid input payload: ${issueSummary}`,
            ]);
          }

          const data = await executeKeywordResearch(inputValidation.data, ctx);
          return this.createReport(taskId, 'COMPLETED', data);
        }

        case 'domain_analysis': {
          const inputValidation = DomainAnalysisRequestSchema.safeParse({
            ...payload,
            action,
          });
          if (!inputValidation.success) {
            const issueSummary = inputValidation.error.issues
              .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
              .join('; ');
            return this.createReport(taskId, 'FAILED', null, [
              `SEO Expert domain_analysis: invalid input payload: ${issueSummary}`,
            ]);
          }

          const data = await executeDomainAnalysis(inputValidation.data, ctx);
          return this.createReport(taskId, 'COMPLETED', data);
        }
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[SEOExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 440, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createSEOExpert(): SEOExpert {
  return new SEOExpert();
}

let instance: SEOExpert | null = null;

export function getSEOExpert(): SEOExpert {
  instance ??= createSEOExpert();
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
  loadGMAndBrandDNA,
  buildResolvedSystemPrompt,
  buildKeywordResearchUserPrompt,
  buildDomainAnalysisUserPrompt,
  stripJsonFences,
  KeywordResearchRequestSchema,
  KeywordResearchResultSchema,
  DomainAnalysisRequestSchema,
  DomainAnalysisResultSchema,
};
