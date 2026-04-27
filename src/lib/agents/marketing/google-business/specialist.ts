/**
 * Google Business Expert — REAL AI AGENT (LLM-backed, organic post generation)
 *
 * Composes brand-voiced posts for the brand's Google Business Profile
 * (formerly Google My Business). Posts on GBP appear in Google Search +
 * Maps and are CTA-driven (Learn More, Book, Order, Shop, Sign Up, Call).
 * GBP has no DM concept — this specialist focuses on organic content
 * generation only.
 *
 * Loads its Golden Master from Firestore (collection
 * `specialistGoldenMasters`, doc id `sgm_google_business_expert_<industry>_v<n>`).
 * Brand DNA is baked into the GM at seed time per Standing Rule #1.
 *
 * Supported actions:
 *   - generate_content    Marketing Manager's organic-post path. Produces
 *                         a primary GBP post with content + CTA, 1-2
 *                         alternative phrasings, best posting time, and
 *                         strategy reasoning. GBP posts hard-cap at 1500
 *                         chars; brand playbook target ≤300 for skim.
 *
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'marketing/google-business/specialist.ts';
const SPECIALIST_ID = 'GOOGLE_BUSINESS_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

const POST_MAX_CHARS = 1500;
const CTA_VALUES = ['LEARN_MORE', 'BOOK', 'ORDER', 'SHOP', 'SIGN_UP', 'CALL'] as const;

/**
 * Realistic max_tokens floor for the worst-case Google Business Expert
 * generate_content response.
 *
 * Derivation:
 *   primaryPost.content 1500 + ctaUrl 500 = 2000
 *   2 × alternativePosts (1500 + 500) = 4000
 *   bestPostingTime 300
 *   strategyReasoning 2000
 *   ≈ 8300 chars total prose
 *   /3.0 chars/token = 2767 tokens
 *   + JSON structure (~250 tokens)
 *   + 25% safety margin
 *   ≈ 3800 tokens minimum.
 *
 *   Setting to 5000 for headroom.
 */
const GENERATE_CONTENT_MAX_TOKENS = 5000;

interface GoogleBusinessExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Google Business Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['generate_content'],
  },
  systemPrompt: '',
  tools: ['generate_content'],
  outputSchema: {
    type: 'object',
    properties: {
      primaryPost: { type: 'object' },
      alternativePosts: { type: 'array' },
      strategyReasoning: { type: 'string' },
    },
  },
  maxTokens: GENERATE_CONTENT_MAX_TOKENS,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT — generate_content
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
  /** Operator can hint a preferred CTA. The LLM uses it if it's a fit,
   *  otherwise picks a more appropriate CTA and notes the swap. */
  preferredCta?: typeof CTA_VALUES[number];
  /** When supplied, the LLM uses this as the ctaUrl. */
  ctaUrl?: string;
  brandContext?: BrandContextInput;
  seoKeywords?: SeoKeywordsInput;
  /** When the operator provides exact post text, the LLM uses it as the
   *  primary post content rather than drafting fresh copy. */
  verbatimText?: string;
}

const GenerateContentRequestSchema = z.object({
  action: z.literal('generate_content'),
  topic: z.string().min(1),
  contentType: z.string().min(1).default('post'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  preferredCta: z.enum(CTA_VALUES).optional(),
  ctaUrl: z.string().url().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
  verbatimText: z.string().optional(),
});

// ============================================================================
// OUTPUT CONTRACT — generate_content
// ============================================================================

const GoogleBusinessPostShapeSchema = z.object({
  /** Post body. GBP hard limit is 1500 chars; brand playbook target ≤300
   *  for skimmable Search/Maps display. */
  content: z.string().min(20).max(POST_MAX_CHARS),
  /** GBP CTA button label. CALL is special: it uses the business phone
   *  number, no ctaUrl needed. The other 5 CTAs all link out via ctaUrl. */
  callToAction: z.enum(CTA_VALUES),
  /** Optional URL the CTA button links to. Required for non-CALL CTAs;
   *  null for CALL. */
  ctaUrl: z.string().url().nullable(),
});

const GoogleBusinessContentResultSchema = z.object({
  primaryPost: GoogleBusinessPostShapeSchema,
  /** 1-2 alternative phrasings the operator can pick from. */
  alternativePosts: z.array(GoogleBusinessPostShapeSchema).min(1).max(2),
  /** Best posting window guidance for GBP — local-business-focused. */
  bestPostingTime: z.string().min(10).max(300),
  /** Honest engagement projection. GBP "engagement" = clicks/calls/directions. */
  estimatedEngagement: z.enum(['low', 'medium', 'high']),
  /** Strategy reasoning the operator reads in Mission Control. */
  strategyReasoning: z.string().min(50).max(2000),
});

export type GoogleBusinessContentResult = z.infer<typeof GoogleBusinessContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: GoogleBusinessExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Google Business Expert GM not found for industryKey=${industryKey}. ` +
      `Run npx tsx scripts/seed-google-business-expert-gm.ts to seed.`,
    );
  }
  const config = gmRecord.config as Partial<GoogleBusinessExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Google Business Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }
  const gmMaxTokens = config.maxTokens ?? GENERATE_CONTENT_MAX_TOKENS;
  const effectiveMaxTokens = Math.max(gmMaxTokens, GENERATE_CONTENT_MAX_TOKENS);
  const gm: GoogleBusinessExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  return { gm, resolvedSystemPrompt: systemPrompt };
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
  maxTokens: number,
): Promise<string> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: ctx.gm.model,
    messages: [
      { role: 'system', content: ctx.resolvedSystemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: ctx.gm.temperature,
    maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Google Business Expert: LLM response truncated at maxTokens=${maxTokens}. ` +
      'Either raise the budget or shorten the brief.',
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('Google Business Expert: OpenRouter returned empty response');
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
    `Platform: Google Business Profile (Search + Maps surface)`,
    `Topic: ${req.topic}`,
    `Content type: ${req.contentType}`,
  ];

  if (req.targetAudience) { sections.push(`Target audience: ${req.targetAudience}`); }
  if (req.tone) { sections.push(`Tone override: ${req.tone}`); }
  if (req.campaignGoal) { sections.push(`Campaign goal: ${req.campaignGoal}`); }
  if (req.preferredCta) { sections.push(`Operator-preferred CTA: ${req.preferredCta}`); }
  if (req.ctaUrl) { sections.push(`Operator-supplied CTA URL: ${req.ctaUrl}`); }

  if (req.verbatimText) {
    sections.push('');
    sections.push(`Operator-provided verbatim text (use as primary post content unless it exceeds ${POST_MAX_CHARS} chars):`);
    sections.push('"""');
    sections.push(req.verbatimText);
    sections.push('"""');
  }

  const brand = req.brandContext;
  if (brand) {
    sections.push('');
    sections.push('Brand context:');
    if (brand.industry) { sections.push(`  Industry: ${brand.industry}`); }
    if (brand.toneOfVoice) { sections.push(`  Tone of voice: ${brand.toneOfVoice}`); }
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
    sections.push('SEO keywords (GBP posts ARE indexed by Google for local search):');
    if (seo.primary) { sections.push(`  Primary: ${seo.primary}`); }
    if (seo.secondary && seo.secondary.length > 0) {
      sections.push(`  Secondary: ${seo.secondary.join(', ')}`);
    }
  }

  sections.push('');
  sections.push('Produce a complete Google Business Profile content plan. Respond with ONLY a valid JSON object — no markdown fences, no preamble. Schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "primaryPost": {');
  sections.push(`    "content": "<post body — 20-${POST_MAX_CHARS} chars; target ≤300 for skimmable Search/Maps display>",`);
  sections.push(`    "callToAction": "<one of: ${CTA_VALUES.join(' | ')}>",`);
  sections.push('    "ctaUrl": "<https URL the CTA links to, or null when callToAction=CALL>"');
  sections.push('  },');
  sections.push(`  "alternativePosts": [`);
  sections.push('    { "content": "<alt content>", "callToAction": "<CTA>", "ctaUrl": "<url or null>" }');
  sections.push('  ],');
  sections.push('  "bestPostingTime": "<window guidance, 10-300 chars; GBP local-business peaks weekday mornings/lunch>",');
  sections.push('  "estimatedEngagement": "<low | medium | high>",');
  sections.push('  "strategyReasoning": "<why this approach + CTA fits GBP + brand voice + the topic, 50-2000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules:');
  sections.push(`- content MUST be 20-${POST_MAX_CHARS} chars (GBP hard limit). Brand playbook target: ≤300 chars. GBP posts get truncated in Search/Maps display past ~150 chars; the strongest hook needs to land in the first 100 chars.`);
  sections.push('- GBP posts are local-business-focused and CTA-driven. Every post should have a clear value proposition and a single, obvious next step (the CTA button).');
  sections.push('- CTA selection logic:');
  sections.push('  - LEARN_MORE: general informational posts, blog promo, feature announcements (default for SaaS/info content)');
  sections.push('  - BOOK: appointment-based businesses (consultations, demos, services)');
  sections.push('  - ORDER: e-commerce or food/delivery offers');
  sections.push('  - SHOP: product catalogs, sales, new arrivals');
  sections.push('  - SIGN_UP: newsletter, free trial, course registration, lead-gen');
  sections.push('  - CALL: phone-driven businesses; ctaUrl MUST be null for CALL');
  sections.push('- ctaUrl: required for ALL non-CALL CTAs. Use the operator-supplied URL when provided; otherwise default to https://www.salesvelocity.ai or the most relevant brand page.');
  sections.push('- Forbidden marketing-speak: "revolutionary", "industry-leading", "game-changing", "unlock", "transform", "leverage", "synergy", "best-in-class".');
  sections.push('- No exclamation overload (zero or one ! per post).');
  sections.push('- Light emoji is acceptable for retail/hospitality brands (0-2 per post). For B2B/professional services, prefer none. Match the brand tone.');
  sections.push('- No engagement bait — GBP posts go to Search results, not a social feed.');
  sections.push('- Local-search relevance: weave the brand\'s service area or city when natural — GBP\'s ranking factors include local-keyword presence in posts.');
  sections.push('- If verbatimText was provided, primaryPost.content MUST be the verbatim text (or the closest version that fits 1500 chars). CTA + URL still chosen by the LLM.');
  sections.push('- If brandContext.avoidPhrases is provided, never use those phrases.');
  sections.push('- If brandContext.keyPhrases is provided, weave at least one in naturally (do NOT force them).');
  sections.push('- Output ONLY the JSON object.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<GoogleBusinessContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt, GENERATE_CONTENT_MAX_TOKENS);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Google Business Expert generate_content output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = GoogleBusinessContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Google Business Expert generate_content output did not match schema: ${issueSummary}`);
  }

  // Cross-field invariant: CALL CTA must have null ctaUrl; non-CALL must have a URL.
  const validatePostInvariant = (post: { callToAction: string; ctaUrl: string | null }, label: string): void => {
    if (post.callToAction === 'CALL' && post.ctaUrl !== null) {
      throw new Error(`Google Business Expert ${label}: callToAction=CALL must have ctaUrl=null (got "${post.ctaUrl}")`);
    }
    if (post.callToAction !== 'CALL' && post.ctaUrl === null) {
      throw new Error(`Google Business Expert ${label}: callToAction=${post.callToAction} requires a non-null ctaUrl`);
    }
  };
  validatePostInvariant(result.data.primaryPost, 'primaryPost');
  result.data.alternativePosts.forEach((p, i) => validatePostInvariant(p, `alternativePosts[${i}]`));

  return result.data;
}

// ============================================================================
// GOOGLE BUSINESS EXPERT CLASS
// ============================================================================

export class GoogleBusinessExpert extends BaseSpecialist {
  constructor() { super(CONFIG); }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Google Business Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Google Business Expert: payload must be an object']);
      }
      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Google Business Expert: no action specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Google Business Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;
      logger.info(`[GoogleBusinessExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'generate_content') {
        const validation = GenerateContentRequestSchema.safeParse({ ...payload, action });
        if (!validation.success) {
          const issueSummary = validation.error.issues
            .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
            .join('; ');
          return this.createReport(taskId, 'FAILED', null, [
            `Google Business Expert generate_content: invalid input payload: ${issueSummary}`,
          ]);
        }
        const data = await executeGenerateContent(validation.data, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      const _exhaustive: never = action;
      return this.createReport(taskId, 'FAILED', null, [
        `Google Business Expert: action '${_exhaustive}' has no handler in execute()`,
      ]);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[GoogleBusinessExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const taskId = signal.id;
    if (signal.payload.type === 'COMMAND') { return this.execute(signal.payload); }
    return this.createReport(taskId, 'COMPLETED', { acknowledged: true });
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean { return true; }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 290, boilerplate: 50 };
  }
}

let instance: GoogleBusinessExpert | null = null;
export function getGoogleBusinessExpert(): GoogleBusinessExpert {
  instance ??= new GoogleBusinessExpert();
  return instance;
}

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  GENERATE_CONTENT_MAX_TOKENS,
  POST_MAX_CHARS,
  CTA_VALUES,
  loadGMConfig,
  buildGenerateContentUserPrompt,
  executeGenerateContent,
  GenerateContentRequestSchema,
  GoogleBusinessContentResultSchema,
  GoogleBusinessPostShapeSchema,
};
