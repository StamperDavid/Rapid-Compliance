/**
 * Facebook Ads Expert — REAL AI AGENT (Task #32 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked tier policy for
 * leaf specialists, see Task #23.5) to produce high-performing Facebook/Meta
 * ad content with strategic metadata. No template fallbacks.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager — the only caller of this
 *                        specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine supported 9 actions (6 FETCH stubs with
 * mock data, 2 ENGAGE stubs with template replies, 1 content generation via
 * string templates). Per CLAUDE.md's no-stubs and no-features-beyond-what-
 * was-requested rules, the dead branches are not rebuilt.
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

const FILE = 'marketing/facebook/specialist.ts';
const SPECIALIST_ID = 'FACEBOOK_ADS_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Facebook Ads Expert response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   AdVariationSchema worst case:
 *     headline 100 + primaryText 2000 + description 300 + callToAction 50
 *     + angle 300 = 2,750 chars per variation
 *
 *   FacebookAdContentResultSchema worst case (primary + 4 alternates):
 *     adCreative.primary: 2,750
 *     adCreative.variations: 4 × 2,750 = 11,000
 *     targetingRecommendation 4000
 *     adFormatRecommendation 3000
 *     estimatedPerformance enum 15
 *     bestPlacement 3000
 *     budgetGuidance 3000
 *     contentStrategy 4000
 *     ≈ 30,765 chars total prose
 *     /3.0 chars/token = 10,255 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 13,069 tokens minimum.
 *
 *   The prior 8,192 was way below the schema worst case for 4-variation
 *   ad creative. Setting the floor at 13,500 covers the schema with
 *   safety margin. The truncation backstop in callOpenRouter catches
 *   any overflow.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 13500;

interface FacebookAdsExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Facebook Ads Expert',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: ['generate_content'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_content'],
  outputSchema: {
    type: 'object',
    properties: {
      adCreative: { type: 'object' },
      contentStrategy: { type: 'string' },
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
  contentType: z.string().min(1).default('single_image_ad'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const AdVariationSchema = z.object({
  headline: z.string().min(5).max(100),
  primaryText: z.string().min(20).max(2000),
  description: z.string().min(10).max(300),
  callToAction: z.string().min(3).max(50),
  angle: z.string().min(10).max(300),
});

const FacebookAdContentResultSchema = z.object({
  adCreative: z.object({
    primary: AdVariationSchema,
    variations: z.array(AdVariationSchema).min(2).max(4),
  }),
  targetingRecommendation: z.string().min(30).max(4000),
  adFormatRecommendation: z.string().min(20).max(3000),
  estimatedPerformance: z.enum(['low', 'medium', 'high', 'exceptional']),
  bestPlacement: z.string().min(10).max(3000),
  budgetGuidance: z.string().min(20).max(3000),
  contentStrategy: z.string().min(50).max(4000),
});

export type FacebookAdContentResult = z.infer<typeof FacebookAdContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: FacebookAdsExpertGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Facebook Ads Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-facebook-ads-expert-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<FacebookAdsExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Facebook Ads Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: FacebookAdsExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Facebook Ads Expert refuses to generate content without brand identity. ' +
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
      `Facebook Ads Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
    if (brand.industry) {sections.push(`  Industry: ${brand.industry}`);}
    if (brand.toneOfVoice) {sections.push(`  Tone of voice: ${brand.toneOfVoice}`);}
    if (brand.keyPhrases && brand.keyPhrases.length > 0) {sections.push(`  Key phrases: ${brand.keyPhrases.join(', ')}`);}
    if (brand.avoidPhrases && brand.avoidPhrases.length > 0) {sections.push(`  Avoid phrases: ${brand.avoidPhrases.join(', ')}`);}
  }

  const seo = req.seoKeywords;
  if (seo) {
    sections.push('');
    sections.push('SEO keywords:');
    if (seo.primary) {sections.push(`  Primary: ${seo.primary}`);}
    if (seo.secondary && seo.secondary.length > 0) {sections.push(`  Secondary: ${seo.secondary.join(', ')}`);}
    if (seo.recommendations && seo.recommendations.length > 0) {sections.push(`  Recommendations: ${seo.recommendations.join(', ')}`);}
  }

  sections.push('');
  sections.push('Produce Facebook/Meta ad creative with variations and strategic metadata. Respond with ONLY a valid JSON object, no markdown fences, no preamble. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "adCreative": {');
  sections.push('    "primary": {');
  sections.push('      "headline": "<ad headline, 5-100 chars — appears bold above/below image>",');
  sections.push('      "primaryText": "<the main ad copy that appears above the image, 20-2000 chars>",');
  sections.push('      "description": "<link description below headline, 10-300 chars>",');
  sections.push('      "callToAction": "<CTA button text: Learn More, Sign Up, Get Started, etc., 3-50 chars>",');
  sections.push('      "angle": "<the creative angle or hook for this variation, 10-300 chars>"');
  sections.push('    },');
  sections.push('    "variations": [');
  sections.push('      { "headline": "...", "primaryText": "...", "description": "...", "callToAction": "...", "angle": "..." }');
  sections.push('    ]');
  sections.push('  },');
  sections.push('  "targetingRecommendation": "<audience targeting guidance: interests, demographics, lookalikes, custom audiences, 30-1500 chars>",');
  sections.push('  "adFormatRecommendation": "<recommended ad format with rationale: single image, carousel, video, collection, 20-2000 chars>",');
  sections.push('  "estimatedPerformance": "<low|medium|high|exceptional>",');
  sections.push('  "bestPlacement": "<recommended placements: Feed, Stories, Reels, Audience Network, Messenger, 10-1500 chars>",');
  sections.push('  "budgetGuidance": "<daily/lifetime budget recommendation with rationale, 20-1500 chars>",');
  sections.push('  "contentStrategy": "<strategic rationale for the creative approach, 50-3000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- The primary ad creative must be the strongest, most tested-looking variation. Variations must be genuinely different angles (different hook, different value prop, different emotional trigger) — not just rephrased versions.');
  sections.push('- Provide 2-4 variations in the variations array.');
  sections.push('- Headlines MUST be punchy and benefit-driven. Under 40 chars is ideal for mobile. Never use clickbait ("You Won\'t Believe..."). Facebook penalizes engagement bait.');
  sections.push('- Primary text: first 125 characters appear above "See More" on mobile — front-load the hook. Use line breaks for readability. Emoji are acceptable but not required.');
  sections.push('- CTA button text must be a real Facebook CTA option: "Learn More", "Sign Up", "Get Started", "Shop Now", "Download", "Book Now", "Contact Us", "Apply Now", "Get Offer", "Get Quote".');
  sections.push('- Facebook Ad Library compliance: no claims about personal attributes, no before/after implications, no "you" + negative trait combinations. Facebook rejects ads that violate these policies.');
  sections.push('- Targeting recommendation must be specific: name interest categories, age ranges, behaviors. Not vague "business owners."');
  sections.push('- Budget guidance should include a testing phase recommendation (e.g., "$20-50/day for 5-7 days testing before scaling").');
  sections.push('- If brandContext.avoidPhrases are provided, never use those phrases anywhere in the output.');
  sections.push('- If brandContext.keyPhrases are provided, weave at least one naturally into the primary text.');
  sections.push('- Do NOT fabricate CTR, CPC, ROAS, or specific performance metrics.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<FacebookAdContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Facebook Ads Expert output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = FacebookAdContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Facebook Ads Expert output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// FACEBOOK ADS EXPERT CLASS
// ============================================================================

export class FacebookAdsExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Facebook Ads Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Facebook Ads Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Facebook Ads Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Facebook Ads Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[FacebookAdsExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateContentRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Facebook Ads Expert generate_content: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);

      const data = await executeGenerateContent(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[FacebookAdsExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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

export function createFacebookAdsExpert(): FacebookAdsExpert {
  return new FacebookAdsExpert();
}

let instance: FacebookAdsExpert | null = null;

export function getFacebookAdsExpert(): FacebookAdsExpert {
  instance ??= createFacebookAdsExpert();
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
  buildGenerateContentUserPrompt,
  stripJsonFences,
  GenerateContentRequestSchema,
  FacebookAdContentResultSchema,
};
