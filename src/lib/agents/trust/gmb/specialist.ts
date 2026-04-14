/**
 * GMB Specialist — REAL AI AGENT (Task #52 rebuild, April 14 2026)
 *
 * Before the rebuild, this specialist was a 2644-LOC hardcoded
 * Google Business Profile optimization engine. 10 actions
 * (draftLocalUpdate, draftPhotoPost, optimizeForMapPack,
 * generatePostingSchedule, analyzeLocalCompetitors, auditNAPConsistency,
 * optimizeCategories, generate30DayPosts, generateQADatabase,
 * generateBusinessDescription) each backed by hand-coded local SEO
 * heuristics, hardcoded keyword libraries, template interpolation, and
 * deterministic scoring. Zero LLM calls.
 *
 * GMB Specialist has a LIVE caller:
 * `ReputationManager.handleGMB` at `reputation/manager.ts:1323` calls
 * `delegateToSpecialist('GMB_SPECIALIST', message)` with
 * `{ location, issue, priority, action?, ... }` payloads. The rebuild
 * consolidates the 10 pre-rebuild actions into 3 discriminated-union
 * actions that match the real use cases and preserve the live caller
 * contract.
 *
 * Supported actions (discriminated union on `action`):
 *   - draft_post — local update OR photo post (unified)
 *   - audit_profile — NAP consistency + category optimization +
 *     map-pack readiness + local competitor analysis (unified audit)
 *   - generate_content_plan — posting schedule + 30-day post ideas +
 *     Q&A database + business description (unified content calendar)
 *
 * Pattern matches Task #65 Sentiment Analyst (discriminatedUnion multi-
 * action) + Task #51 Review Specialist (REQUIRED GM for customer-facing
 * content, constructor accepts optional SpecialistConfig arg).
 *
 * @module agents/trust/gmb/specialist
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

const FILE = 'trust/gmb/specialist.ts';
const SPECIALIST_ID = 'GMB_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['draft_post', 'audit_profile', 'generate_content_plan'] as const;

/**
 * Realistic max_tokens floor for the worst-case GMB Specialist response.
 *
 * Derivation: generate_content_plan is the largest.
 *   posts: 30 × (content 800 + keywords 150 + rationale 200) = 30 × 1150 = 34,500
 *   qaDatabase: 15 × (question 150 + answer 500 + rationale 100) = 11,250
 *   businessDescription 1500
 *   schedule 2000
 *   rationale 3000
 *   ≈ 52,250 chars
 *   /3.0 = 17,417 tokens + overhead + margin ≈ 22,500 tokens.
 *
 *   Floor: 25,000 tokens.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 25000;

interface GMBSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'GMB Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'REPUTATION_MANAGER',
    capabilities: [
      'local_seo',
      'gmb_posting',
      'map_pack_optimization',
      'nap_audit',
      'local_competitor_analysis',
    ],
  },
  systemPrompt: '',
  tools: ['draft_post', 'audit_profile', 'generate_content_plan'],
  outputSchema: {
    type: 'object',
    properties: {
      action: { type: 'string' },
      data: { type: 'object' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.5,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const BusinessSchema = z.object({
  id: z.string().min(1).max(300),
  name: z.string().min(1).max(300),
  category: z.string().min(1).max(200),
  address: z.string().min(1).max(500),
  city: z.string().min(1).max(200),
  state: z.string().min(1).max(100),
  zip: z.string().min(2).max(20),
  phone: z.string().max(50).optional(),
  website: z.string().max(500).optional(),
  description: z.string().max(2000).optional(),
  foundedYear: z.number().int().min(1800).max(2100).optional(),
  attributes: z.array(z.string().min(1).max(100)).max(30).optional(),
  currentCategories: z.array(z.string().min(1).max(200)).max(20).optional(),
});

const DraftPostPayloadSchema = z.object({
  action: z.literal('draft_post'),
  business: BusinessSchema,
  postType: z.enum(['local_update', 'offer', 'event', 'product', 'photo_post']),
  topic: z.string().min(3).max(500).optional(),
  keywords: z.array(z.string().min(1).max(100)).max(20).optional(),
  callToAction: z.string().max(200).optional(),
});

const AuditProfilePayloadSchema = z.object({
  action: z.literal('audit_profile'),
  business: BusinessSchema,
  localCompetitors: z.array(z.object({
    name: z.string().min(1).max(300),
    rating: z.number().min(0).max(5).optional(),
    reviewCount: z.number().int().min(0).max(1_000_000).optional(),
    categories: z.array(z.string().min(1).max(200)).max(10).optional(),
  })).max(10).optional(),
  issue: z.string().max(1000).optional(),
  priority: z.enum(['LOW', 'NORMAL', 'HIGH', 'CRITICAL']).optional(),
});

const GenerateContentPlanPayloadSchema = z.object({
  action: z.literal('generate_content_plan'),
  business: BusinessSchema,
  planDurationDays: z.number().int().min(7).max(30).optional().default(30),
  includeQADatabase: z.boolean().optional().default(true),
  includeBusinessDescription: z.boolean().optional().default(true),
  postingFrequencyPerWeek: z.number().int().min(1).max(7).optional().default(3),
});

const GMBPayloadSchema = z.discriminatedUnion('action', [
  DraftPostPayloadSchema,
  AuditProfilePayloadSchema,
  GenerateContentPlanPayloadSchema,
]);

export type GMBPayload = z.infer<typeof GMBPayloadSchema>;
export type Business = z.infer<typeof BusinessSchema>;

// ============================================================================
// OUTPUT CONTRACT (per-action)
// ============================================================================

const DraftPostResultSchema = z.object({
  action: z.literal('draft_post'),
  postType: z.enum(['local_update', 'offer', 'event', 'product', 'photo_post']),
  title: z.string().min(3).max(150).optional(),
  content: z.string().min(20).max(1500),
  callToAction: z.string().min(3).max(200),
  targetKeywords: z.array(z.string().min(1).max(100)).min(2).max(8),
  localRelevanceScore: z.number().min(0).max(1),
  seoScore: z.number().min(0).max(1),
  estimatedReach: z.object({
    min: z.number().int().min(0),
    max: z.number().int().min(0),
  }),
  bestPostingDay: z.string().min(3).max(30),
  bestPostingTime: z.string().min(3).max(30),
  rationale: z.string().min(50).max(2000),
});

const AuditProfileResultSchema = z.object({
  action: z.literal('audit_profile'),
  overallHealthScore: z.number().int().min(0).max(100),
  napConsistency: z.object({
    consistent: z.boolean(),
    issues: z.array(z.string().min(5).max(400)).max(5),
    recommendedActions: z.array(z.string().min(10).max(300)).max(5),
  }),
  categoryOptimization: z.object({
    primaryCategoryRecommendation: z.string().min(3).max(200),
    additionalCategoryRecommendations: z.array(z.string().min(3).max(200)).max(5),
    rationale: z.string().min(20).max(1500),
  }),
  mapPackReadiness: z.object({
    score: z.number().min(0).max(1),
    strengths: z.array(z.string().min(5).max(300)).min(1).max(5),
    weaknesses: z.array(z.string().min(5).max(300)).max(5),
    topImprovements: z.array(z.string().min(10).max(300)).min(1).max(5),
  }),
  competitiveAnalysis: z.object({
    marketPosition: z.enum(['leader', 'challenger', 'follower', 'niche']),
    differentiators: z.array(z.string().min(5).max(300)).max(5),
    gapsVsCompetitors: z.array(z.string().min(5).max(400)).max(5),
  }),
  priorityActions: z.array(z.string().min(10).max(400)).min(3).max(8),
  rationale: z.string().min(100).max(3000),
});

const ContentCalendarPostSchema = z.object({
  day: z.number().int().min(1).max(30),
  postType: z.enum(['local_update', 'offer', 'event', 'product', 'photo_post']),
  title: z.string().min(3).max(150),
  content: z.string().min(20).max(800),
  targetKeywords: z.array(z.string().min(1).max(100)).max(5),
  rationale: z.string().min(10).max(300),
});

const QAEntrySchema = z.object({
  question: z.string().min(5).max(300),
  answer: z.string().min(10).max(500),
  category: z.string().min(3).max(100),
});

const GenerateContentPlanResultSchema = z.object({
  action: z.literal('generate_content_plan'),
  schedule: z.object({
    postingFrequencyPerWeek: z.number().int().min(1).max(7),
    bestDays: z.array(z.string().min(3).max(30)).min(1).max(7),
    bestTimes: z.array(z.string().min(3).max(30)).min(1).max(5),
    cadenceRationale: z.string().min(20).max(1500),
  }),
  posts: z.array(ContentCalendarPostSchema).min(5).max(30),
  qaDatabase: z.array(QAEntrySchema).max(15).optional(),
  businessDescription: z.string().min(50).max(1500).optional(),
  rationale: z.string().min(100).max(3000),
});

const GMBResultSchema = z.discriminatedUnion('action', [
  DraftPostResultSchema,
  AuditProfileResultSchema,
  GenerateContentPlanResultSchema,
]);

export type GMBResult = z.infer<typeof GMBResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: GMBSpecialistGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `GMB Specialist GM not found for industryKey=${industryKey}. ` +
      `Customer-facing content generation requires a Golden Master. ` +
      `Run node scripts/seed-gmb-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<GMBSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(`GMB Specialist GM ${gmRecord.id} has no usable systemPrompt`);
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. GMB Specialist refuses to draft Google Business Profile content without brand identity. ' +
      'Visit /settings/ai-agents/business-setup to configure.',
    );
  }

  return {
    gm: {
      systemPrompt,
      model: config.model ?? 'claude-sonnet-4.6',
      temperature: config.temperature ?? 0.5,
      maxTokens: effectiveMaxTokens,
      supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
    },
    brandDNA,
    resolvedSystemPrompt: buildResolvedSystemPrompt(systemPrompt, brandDNA),
  };
}

function buildResolvedSystemPrompt(baseSystemPrompt: string, brandDNA: BrandDNA): string {
  const keyPhrases = brandDNA.keyPhrases?.length > 0 ? brandDNA.keyPhrases.join(', ') : '(none configured)';
  const avoidPhrases = brandDNA.avoidPhrases?.length > 0 ? brandDNA.avoidPhrases.join(', ') : '(none configured)';
  const competitors = brandDNA.competitors?.length > 0 ? brandDNA.competitors.join(', ') : '(none configured)';

  const brandBlock = [
    '',
    '## Brand DNA (runtime injection — the tenant-specific identity)',
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

async function callOpenRouter(ctx: LlmCallContext, userPrompt: string): Promise<string> {
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
      `GMB Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} (finish_reason='length'). ` +
      `Worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

function formatBusiness(b: Business): string {
  const lines = [
    `Name: ${b.name}`,
    `Category: ${b.category}`,
    `Location: ${b.address}, ${b.city}, ${b.state} ${b.zip}`,
  ];
  if (b.phone) { lines.push(`Phone: ${b.phone}`); }
  if (b.website) { lines.push(`Website: ${b.website}`); }
  if (b.description) { lines.push(`Description: ${b.description}`); }
  if (b.foundedYear) { lines.push(`Founded: ${b.foundedYear}`); }
  if (b.attributes && b.attributes.length > 0) {
    lines.push(`Attributes: ${b.attributes.join(', ')}`);
  }
  if (b.currentCategories && b.currentCategories.length > 0) {
    lines.push(`Current GMB categories: ${b.currentCategories.join(', ')}`);
  }
  return lines.join('\n');
}

function buildDraftPostPrompt(req: z.infer<typeof DraftPostPayloadSchema>): string {
  return [
    'ACTION: draft_post',
    '',
    `Post type: ${req.postType}`,
    req.topic ? `Topic: ${req.topic}` : '',
    req.keywords && req.keywords.length > 0 ? `Keyword hints: ${req.keywords.join(', ')}` : '',
    req.callToAction ? `Preferred CTA: ${req.callToAction}` : '',
    '',
    '## Business',
    formatBusiness(req.business),
    '',
    '---',
    '',
    `Draft a ${req.postType} GMB post for this business. Respond with ONLY a valid JSON object:`,
    '',
    '{',
    '  "action": "draft_post",',
    `  "postType": "${req.postType}",`,
    '  "title": "<3-150 chars — required for offer/event/product, optional for local_update/photo_post>",',
    '  "content": "<20-1500 chars — the actual post body, plain text>",',
    '  "callToAction": "<3-200 chars — primary CTA with action-oriented verb>",',
    '  "targetKeywords": ["<2-8 local SEO keywords woven into the content>"],',
    '  "localRelevanceScore": <0-1>,',
    '  "seoScore": <0-1>,',
    '  "estimatedReach": { "min": <int>, "max": <int> },',
    '  "bestPostingDay": "<day of week>",',
    '  "bestPostingTime": "<HH:MM local>",',
    '  "rationale": "<50-2000 chars>"',
    '}',
    '',
    'Hard rules: Plain text, no markdown. Use actual business name and location. targetKeywords must reference the local market (city + category + service).',
  ].filter((line) => line !== '').join('\n');
}

function buildAuditProfilePrompt(req: z.infer<typeof AuditProfilePayloadSchema>): string {
  const competitorBlock = req.localCompetitors && req.localCompetitors.length > 0
    ? req.localCompetitors
        .map((c) => `  - ${c.name}${c.rating !== undefined ? ` (${c.rating}★${c.reviewCount ? `, ${c.reviewCount} reviews` : ''})` : ''}${c.categories ? ` | ${c.categories.join(', ')}` : ''}`)
        .join('\n')
    : '(no local competitors provided)';

  return [
    'ACTION: audit_profile',
    '',
    req.issue ? `Reported issue: ${req.issue}` : '',
    req.priority ? `Priority: ${req.priority}` : '',
    '',
    '## Business',
    formatBusiness(req.business),
    '',
    '## Local competitors',
    competitorBlock,
    '',
    '---',
    '',
    'Audit this GMB profile for local SEO health. Respond with ONLY a valid JSON object:',
    '',
    '{',
    '  "action": "audit_profile",',
    '  "overallHealthScore": <0-100>,',
    '  "napConsistency": { "consistent": <bool>, "issues": [], "recommendedActions": [] },',
    '  "categoryOptimization": { "primaryCategoryRecommendation": "<specific GMB category>", "additionalCategoryRecommendations": [], "rationale": "<20-1500>" },',
    '  "mapPackReadiness": { "score": <0-1>, "strengths": [], "weaknesses": [], "topImprovements": [] },',
    '  "competitiveAnalysis": { "marketPosition": "<leader|challenger|follower|niche>", "differentiators": [], "gapsVsCompetitors": [] },',
    '  "priorityActions": ["<3-8 specific, executable actions ranked by impact>"],',
    '  "rationale": "<100-3000 chars>"',
    '}',
    '',
    'Hard rules: primaryCategoryRecommendation must be a real GMB category name. priorityActions must be executable (not "improve SEO" but "add 5 photos tagged with \'[city] [service]\' to the Interior category").',
  ].filter((line) => line !== '').join('\n');
}

function buildGenerateContentPlanPrompt(req: z.infer<typeof GenerateContentPlanPayloadSchema>): string {
  const durationDays = req.planDurationDays;
  const expectedPosts = Math.min(30, Math.max(5, Math.ceil((durationDays / 7) * req.postingFrequencyPerWeek)));

  return [
    'ACTION: generate_content_plan',
    '',
    `Plan duration: ${durationDays} days`,
    `Posting frequency: ${req.postingFrequencyPerWeek} posts per week`,
    `Expected post count: ${expectedPosts}`,
    `Include Q&A database: ${req.includeQADatabase}`,
    `Include business description: ${req.includeBusinessDescription}`,
    '',
    '## Business',
    formatBusiness(req.business),
    '',
    '---',
    '',
    `Generate a ${durationDays}-day GMB content calendar. Respond with ONLY a valid JSON object:`,
    '',
    '{',
    '  "action": "generate_content_plan",',
    '  "schedule": {',
    `    "postingFrequencyPerWeek": ${req.postingFrequencyPerWeek},`,
    '    "bestDays": ["<1-7 days of week ranked by local engagement data>"],',
    '    "bestTimes": ["<1-5 HH:MM slots>"],',
    '    "cadenceRationale": "<20-1500 chars>"',
    '  },',
    `  "posts": [EXACTLY ${expectedPosts} entries with { "day" (1-${durationDays}), "postType", "title", "content" (20-800 chars), "targetKeywords" (max 5), "rationale" (10-300) }],`,
    req.includeQADatabase ? '  "qaDatabase": [up to 15 { "question", "answer", "category" } entries],' : '',
    req.includeBusinessDescription ? '  "businessDescription": "<50-1500 chars — fresh GMB business description optimized for discovery>",' : '',
    '  "rationale": "<100-3000 chars>"',
    '}',
    '',
    `Hard rules: posts array must have EXACTLY ${expectedPosts} entries (downstream validation enforces this). day values must be 1-${durationDays} and cover the window evenly. Each post uses real local keywords (city + category). Q&A pairs must answer real questions prospects ask about this business category.`,
  ].filter((line) => line !== '').join('\n');
}

function buildUserPrompt(payload: GMBPayload): string {
  switch (payload.action) {
    case 'draft_post': return buildDraftPostPrompt(payload);
    case 'audit_profile': return buildAuditProfilePrompt(payload);
    case 'generate_content_plan': return buildGenerateContentPlanPrompt(payload);
  }
}

async function executeGMBAction(
  payload: GMBPayload,
  ctx: LlmCallContext,
): Promise<GMBResult> {
  const userPrompt = buildUserPrompt(payload);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`GMB Specialist output was not valid JSON: ${rawContent.slice(0, 300)}`);
  }

  const result = GMBResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`GMB Specialist output did not match expected schema: ${issueSummary}`);
  }

  const data = result.data;

  // Enforce expected post count for generate_content_plan
  if (payload.action === 'generate_content_plan' && data.action === 'generate_content_plan') {
    const expected = Math.min(30, Math.max(5, Math.ceil((payload.planDurationDays / 7) * payload.postingFrequencyPerWeek)));
    if (data.posts.length !== expected) {
      throw new Error(
        `GMB Specialist: posts array has ${data.posts.length} entries but expected ${expected} (duration=${payload.planDurationDays}d × frequency=${payload.postingFrequencyPerWeek}/wk)`,
      );
    }
  }

  return data;
}

// ============================================================================
// GMB SPECIALIST CLASS
// ============================================================================

export class GMBSpecialist extends BaseSpecialist {
  constructor(_config?: SpecialistConfig) {
    // Accept optional config for backward compatibility with ReputationManager's
    // local factory at trust/reputation/manager.ts:114.
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'GMB Specialist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const rawPayload = message.payload as Record<string, unknown> | null;
      if (rawPayload === null || typeof rawPayload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['GMB Specialist: payload must be an object']);
      }

      const normalized = this.normalizePayload(rawPayload);

      const inputValidation = GMBPayloadSchema.safeParse(normalized);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `GMB Specialist: invalid input payload: ${issueSummary}`,
        ]);
      }

      const payload = inputValidation.data;
      logger.info(
        `[GMBSpecialist] Executing action=${payload.action} taskId=${taskId} business=${payload.business.name}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeGMBAction(payload, ctx);

      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[GMBSpecialist] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  /**
   * Accept legacy payloads from ReputationManager.handleGMB:
   *   { location, issue, priority, action?, business? }
   * If `business` is missing, synthesize a minimal Business from `location` + `issue`.
   * Map legacy action strings (draftLocalUpdate/optimizeForMapPack/etc.) to the
   * new 3-action vocabulary.
   */
  private normalizePayload(raw: Record<string, unknown>): Record<string, unknown> {
    const legacyActionMap: Record<string, 'draft_post' | 'audit_profile' | 'generate_content_plan'> = {
      'draft_post': 'draft_post',
      'audit_profile': 'audit_profile',
      'generate_content_plan': 'generate_content_plan',
      'draftLocalUpdate': 'draft_post',
      'draftPhotoPost': 'draft_post',
      'optimizeForMapPack': 'audit_profile',
      'analyzeLocalCompetitors': 'audit_profile',
      'auditNAPConsistency': 'audit_profile',
      'optimizeCategories': 'audit_profile',
      'generatePostingSchedule': 'generate_content_plan',
      'generate30DayPosts': 'generate_content_plan',
      'generateQADatabase': 'generate_content_plan',
      'generateBusinessDescription': 'generate_content_plan',
    };

    const rawAction = typeof raw.action === 'string' ? raw.action : 'audit_profile';
    const mappedAction = legacyActionMap[rawAction] ?? 'audit_profile';

    // Synthesize a Business from the legacy flat payload if needed.
    let business: Record<string, unknown>;
    if (raw.business !== undefined && typeof raw.business === 'object' && raw.business !== null) {
      business = raw.business as Record<string, unknown>;
    } else {
      const location = typeof raw.location === 'string' ? raw.location : 'Unknown Location';
      const [city = 'Unknown', state = 'Unknown'] = location.split(',').map((s) => s.trim());
      business = {
        id: (raw.businessId as string | undefined) ?? `legacy_${Date.now()}`,
        name: (raw.businessName as string | undefined) ?? 'Unknown Business',
        category: (raw.category as string | undefined) ?? 'General',
        address: location,
        city,
        state,
        zip: '00000',
      };
    }

    const normalized: Record<string, unknown> = {
      action: mappedAction,
      business,
    };

    if (mappedAction === 'draft_post') {
      normalized.postType = (raw.postType as string | undefined) ?? (rawAction === 'draftPhotoPost' ? 'photo_post' : 'local_update');
      normalized.topic = raw.topic ?? raw.issue;
      normalized.keywords = raw.keywords;
      normalized.callToAction = raw.callToAction;
    } else if (mappedAction === 'audit_profile') {
      normalized.localCompetitors = raw.localCompetitors ?? raw.competitors;
      normalized.issue = raw.issue;
      normalized.priority = raw.priority;
    } else {
      normalized.planDurationDays = raw.planDurationDays ?? 30;
      normalized.postingFrequencyPerWeek = raw.postingFrequencyPerWeek ?? 3;
      normalized.includeQADatabase = raw.includeQADatabase ?? true;
      normalized.includeBusinessDescription = raw.includeBusinessDescription ?? true;
    }

    return normalized;
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const message: AgentMessage = {
      id: signal.id,
      timestamp: signal.createdAt,
      from: signal.origin,
      to: this.identity.id,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: signal.payload.payload,
      requiresResponse: true,
      traceId: signal.id,
    };
    return this.execute(message);
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 720, boilerplate: 100 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createGMBSpecialist(): GMBSpecialist {
  return new GMBSpecialist();
}

let instance: GMBSpecialist | null = null;

export function getGMBSpecialist(): GMBSpecialist {
  instance ??= createGMBSpecialist();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  loadGMConfig,
  stripJsonFences,
  buildUserPrompt,
  executeGMBAction,
  GMBPayloadSchema,
  GMBResultSchema,
};
