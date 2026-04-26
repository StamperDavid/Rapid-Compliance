/**
 * Pinterest Expert — REAL AI AGENT
 *
 * Loads its Golden Master from Firestore at runtime and calls OpenRouter
 * (Claude Sonnet 4.6 by default — locked tier policy for leaf specialists)
 * to produce Pinterest-optimized content: pin descriptions, board strategy,
 * keyword-rich titles, seasonal content calendars, rich pin optimization,
 * idea pin scripts, and product pin copy. No template fallbacks. If the
 * GM is missing, Brand DNA is missing, OpenRouter fails, JSON won't parse,
 * or Zod validation fails, the specialist returns a real FAILED AgentReport
 * with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager.delegateToPinterest — the only
 *                        caller of this specialist anywhere in the codebase)
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import {
  ComposeDmReplyRequestSchema,
  executeComposeDmReply,
  type ComposeDmReplyResult,
} from '@/lib/agents/social/compose-dm-reply-shared';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'marketing/pinterest/specialist.ts';
const SPECIALIST_ID = 'PINTEREST_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content', 'compose_dm_reply'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const DM_REPLY_OPTIONS = {
  platformLabel: 'Pinterest',
  maxReplyChars: 2200,
  playbookCharsTarget: 300,
  brandUrl: 'https://www.salesvelocity.ai',
  forbidEmoji: true,
} as const;

/**
 * Realistic max_tokens floor for the worst-case Pinterest Expert response.
 *
 * Derivation:
 *   PinterestContentResultSchema worst case:
 *     pinTitle 200 + pinDescription 500 +
 *     keywords (20 × 40 = 800) +
 *     boardStrategy.boardName 100 + boardDescription 500 +
 *       suggestedBoards 5×100 = 500 + boardCategoryTips 3×200 = 600 +
 *     richPinOptimization.type 20 + metadata 5×(key 30 + value 100) = 650 +
 *       seoTips 3×200 = 600 +
 *     ideaPinScript: 5 × (pageNumber + content 400 + visualDirection 300 +
 *       textOverlay 200 + duration 20) = 5 × 930 = 4650 +
 *     productPinCopy.title 200 + description 500 + priceContext 200 +
 *       availabilityNote 200 + callToAction 200 +
 *     seasonalStrategy.currentSeason 50 + trendingThemes 5×100 = 500 +
 *       contentCalendar 4×(month 20 + theme 100 + pinIdea 200) = 4×320 = 1280 +
 *       timingTip 300
 *     ≈ 11,950 chars total prose
 *     /3.0 chars/token = 3,983 tokens
 *     + JSON structure overhead (~300 tokens)
 *     + 25% safety margin
 *     ≈ 5,354 tokens minimum.
 *
 *   Setting to 10000 for comfortable headroom.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 10000;

interface PinterestExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Pinterest Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['generate_content', 'compose_dm_reply'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_content', 'compose_dm_reply'],
  outputSchema: {
    type: 'object',
    properties: {
      pinTitle: { type: 'string' },
      pinDescription: { type: 'string' },
      keywords: { type: 'array' },
      boardStrategy: { type: 'object' },
      richPinOptimization: { type: 'object' },
      ideaPinScript: { type: 'array' },
      productPinCopy: { type: 'object' },
      seasonalStrategy: { type: 'object' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

interface BrandContextInput {
  industry?: string;
  toneOfVoice?: string;
  keyPhrases?: string[];
  avoidPhrases?: string[];
}

interface SeoKeywordsInput {
  primary?: string;
  secondary?: string[];
  recommendations?: string[];
}

export interface GenerateContentRequest {
  action: 'generate_content';
  topic: string;
  contentType: string;
  targetAudience?: string;
  tone?: string;
  campaignGoal?: string;
  brandContext?: BrandContextInput;
  seoKeywords?: SeoKeywordsInput;
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.string().min(1).default('pin'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const PinterestContentResultSchema = z.object({
  pinTitle: z.string().min(10).max(200),
  pinDescription: z.string().min(30).max(500),
  keywords: z.array(z.string().min(1)).min(5).max(20),
  boardStrategy: z.object({
    boardName: z.string().min(3).max(100),
    boardDescription: z.string().min(20).max(500),
    suggestedBoards: z.array(z.string().min(3)).min(2).max(5),
    boardCategoryTips: z.array(z.string().min(10)).min(1).max(3),
  }),
  richPinOptimization: z.object({
    type: z.enum(['article', 'product', 'recipe', 'app']),
    metadata: z.array(z.object({
      key: z.string().min(1),
      value: z.string().min(1),
    })).min(2).max(8),
    seoTips: z.array(z.string().min(10)).min(1).max(5),
  }),
  ideaPinScript: z.array(z.object({
    pageNumber: z.number().int().min(1),
    content: z.string().min(10).max(400),
    visualDirection: z.string().min(10).max(300),
    textOverlay: z.string().max(200).optional(),
    estimatedDuration: z.string().max(20).optional(),
  })).min(3).max(10),
  productPinCopy: z.object({
    title: z.string().min(5).max(200),
    description: z.string().min(20).max(500),
    priceContext: z.string().min(5).max(200),
    availabilityNote: z.string().min(5).max(200),
    callToAction: z.string().min(5).max(200),
  }),
  seasonalStrategy: z.object({
    currentSeason: z.string().min(3).max(50),
    trendingThemes: z.array(z.string().min(3)).min(2).max(5),
    contentCalendar: z.array(z.object({
      month: z.string().min(3).max(20),
      theme: z.string().min(5).max(100),
      pinIdea: z.string().min(10).max(1000),
    })).min(3).max(6),
    timingTip: z.string().min(10).max(1000),
  }),
});

export type PinterestContentResult = z.infer<typeof PinterestContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: PinterestExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Pinterest Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-pinterest-expert-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<PinterestExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Pinterest Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: PinterestExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  const resolvedSystemPrompt = gm.systemPrompt;
  return { gm, resolvedSystemPrompt };
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
      `Pinterest Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the brief. ` +
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
// ACTION: generate_content
// ============================================================================

function buildGenerateContentUserPrompt(req: GenerateContentRequest): string {
  const sections: string[] = [
    'ACTION: generate_content',
    '',
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) {
    sections.push(`Target audience: ${req.targetAudience}`);
  }
  if (req.tone) {
    sections.push(`Tone: ${req.tone}`);
  }
  if (req.campaignGoal) {
    sections.push(`Campaign goal: ${req.campaignGoal}`);
  }

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context from caller:');
    if (brand.industry) {
      sections.push(`  Industry: ${brand.industry}`);
    }
    if (brand.toneOfVoice) {
      sections.push(`  Tone of voice: ${brand.toneOfVoice}`);
    }
    if (brand.keyPhrases && brand.keyPhrases.length > 0) {
      sections.push(`  Key phrases: ${brand.keyPhrases.join(', ')}`);
    }
    if (brand.avoidPhrases && brand.avoidPhrases.length > 0) {
      sections.push(`  Avoid phrases: ${brand.avoidPhrases.join(', ')}`);
    }
  }

  const seo = req.seoKeywords;
  if (seo) {
    sections.push('');
    sections.push('SEO keywords:');
    if (seo.primary) {
      sections.push(`  Primary: ${seo.primary}`);
    }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
    if (seo.recommendations && seo.recommendations.length > 0) {
      sections.push(`  Recommendations: ${seo.recommendations.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete Pinterest content plan. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "pinTitle": "<keyword-rich pin title, 10-200 chars>",');
  sections.push('  "pinDescription": "<SEO-optimized pin description, 30-500 chars>",');
  sections.push('  "keywords": ["<5-20 search keywords for Pinterest SEO>"],');
  sections.push('  "boardStrategy": {');
  sections.push('    "boardName": "<primary board name, 3-100 chars>",');
  sections.push('    "boardDescription": "<board description with keywords, 20-500 chars>",');
  sections.push('    "suggestedBoards": ["<2-5 additional boards to pin to>"],');
  sections.push('    "boardCategoryTips": ["<1-3 tips for board organization>"]');
  sections.push('  },');
  sections.push('  "richPinOptimization": {');
  sections.push('    "type": "<article|product|recipe|app>",');
  sections.push('    "metadata": [');
  sections.push('      { "key": "<metadata field name>", "value": "<metadata value>" }');
  sections.push('    ],');
  sections.push('    "seoTips": ["<1-5 tips for rich pin SEO optimization>"]');
  sections.push('  },');
  sections.push('  "ideaPinScript": [');
  sections.push('    {');
  sections.push('      "pageNumber": 1,');
  sections.push('      "content": "<what this page covers, 10-400 chars>",');
  sections.push('      "visualDirection": "<art direction for this page, 10-300 chars>",');
  sections.push('      "textOverlay": "<optional text to overlay on the image>",');
  sections.push('      "estimatedDuration": "<e.g. 5s for video pages>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "productPinCopy": {');
  sections.push('    "title": "<product pin title, 5-200 chars>",');
  sections.push('    "description": "<product description optimized for Pinterest, 20-500 chars>",');
  sections.push('    "priceContext": "<how to position price/value, 5-200 chars>",');
  sections.push('    "availabilityNote": "<urgency/scarcity messaging, 5-200 chars>",');
  sections.push('    "callToAction": "<what action to drive, 5-200 chars>"');
  sections.push('  },');
  sections.push('  "seasonalStrategy": {');
  sections.push('    "currentSeason": "<current seasonal context, 3-50 chars>",');
  sections.push('    "trendingThemes": ["<2-5 trending Pinterest themes right now>"],');
  sections.push('    "contentCalendar": [');
  sections.push('      {');
  sections.push('        "month": "<month name>",');
  sections.push('        "theme": "<seasonal theme, 5-100 chars>",');
  sections.push('        "pinIdea": "<specific pin idea for that month, 10-200 chars>"');
  sections.push('      }');
  sections.push('    ],');
  sections.push('    "timingTip": "<when to publish for maximum reach, 10-300 chars>"');
  sections.push('  }');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- Pinterest is a SEARCH ENGINE first, social network second. Every field must be keyword-optimized.');
  sections.push('- Pin title MUST contain the primary keyword naturally. Use title case. No clickbait — Pinterest penalizes it.');
  sections.push('- Pin description MUST read naturally while incorporating 2-3 keywords. Include a clear CTA. Use complete sentences, not hashtag lists.');
  sections.push('- Keywords: include a mix of broad (1-2 word) and long-tail (3-5 word) search terms. Think about what users type into Pinterest search.');
  sections.push('- Board strategy MUST include the primary board AND 2-5 relevant secondary boards. Board descriptions should be keyword-rich.');
  sections.push('- Rich pin type MUST match the content (article for blog posts, product for e-commerce, recipe for food content).');
  sections.push('- Idea pin script MUST have 3-10 pages that tell a complete story or tutorial. Page 1 is the hook — make it visually striking.');
  sections.push('- Product pin copy MUST include value-oriented language. Focus on benefits, not features.');
  sections.push('- Seasonal strategy: Pinterest users plan 2-3 months ahead. Content calendar should reflect FUTURE seasons, not current.');
  sections.push('- If seoKeywords are provided, the primary keyword MUST appear in the pin title, description, and first keyword.');
  sections.push('- If brandContext.avoidPhrases are provided, never use those phrases anywhere in the output.');
  sections.push('- If brandContext.keyPhrases are provided, weave at least one naturally into the pin description.');
  sections.push('- Do NOT use hashtags in pin descriptions — Pinterest deprecated hashtag functionality.');
  sections.push('- Do NOT fabricate engagement metrics, impression counts, or specific performance predictions.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<PinterestContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Pinterest Expert output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = PinterestContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Pinterest Expert output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// PINTEREST EXPERT CLASS
// ============================================================================

export class PinterestExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Pinterest Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Pinterest Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Pinterest Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Pinterest Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[PinterestExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const inputValidation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!inputValidation.success) {
          const issueSummary = inputValidation.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
          return this.createReport(taskId, 'FAILED', null, [`Pinterest Expert generate_content: invalid input payload: ${issueSummary}`]);
        }
        const data = await executeGenerateContent(inputValidation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      if (action === 'compose_dm_reply') {
        const inputValidation = ComposeDmReplyRequestSchema.safeParse({ ...payload, action });
        if (!inputValidation.success) {
          const issueSummary = inputValidation.error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('; ');
          return this.createReport(taskId, 'FAILED', null, [`Pinterest Expert compose_dm_reply: invalid input payload: ${issueSummary}`]);
        }
        const data: ComposeDmReplyResult = await executeComposeDmReply(
          inputValidation.data,
          { resolvedSystemPrompt: ctx.resolvedSystemPrompt, model: ctx.gm.model, temperature: ctx.gm.temperature, maxTokens: 1200 },
          DM_REPLY_OPTIONS,
        );
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [`Pinterest Expert: action '${_exhaustive}' has no handler in execute()`]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[PinterestExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 370, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createPinterestExpert(): PinterestExpert {
  return new PinterestExpert();
}

let instance: PinterestExpert | null = null;

export function getPinterestExpert(): PinterestExpert {
  instance ??= createPinterestExpert();
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
  loadGMConfig,
  buildGenerateContentUserPrompt,
  stripJsonFences,
  GenerateContentRequestSchema,
  PinterestContentResultSchema,
};
