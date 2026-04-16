/**
 * Instagram Expert — REAL AI AGENT
 *
 * Loads its Golden Master from Firestore at runtime and calls OpenRouter
 * (Claude Sonnet 4.6 by default — locked tier policy for leaf specialists)
 * to produce Instagram-optimized content: carousel copy, reel scripts,
 * story sequences, hashtag strategy, caption optimization, bio link
 * strategy, and format recommendations (Reels vs Stories vs Feed).
 * No template fallbacks. If the GM is missing, Brand DNA is missing,
 * OpenRouter fails, JSON won't parse, or Zod validation fails, the
 * specialist returns a real FAILED AgentReport with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager.delegateToInstagram — the only
 *                        caller of this specialist anywhere in the codebase)
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

const FILE = 'marketing/instagram/specialist.ts';
const SPECIALIST_ID = 'INSTAGRAM_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Instagram Expert response.
 *
 * Derivation:
 *   InstagramContentResultSchema worst case:
 *     caption 2200 + hookLine 300 +
 *     hashtags (30 × 30 = 900) +
 *     formatRecommendation.format 20 + rationale 500 + bestPractices 5×200 = 1000 +
 *     carouselSlides: 10 × (slideNumber + text 500 + visualDirection 300 + cta 200)
 *       = 10 × 1010 = 10100 +
 *     reelScript.hook 300 + body 1500 + closingCTA 300 + audioSuggestion 200 +
 *       duration 20 + trendReference 200 = 2520 +
 *     storySequence: 5 × (storyNumber + content 300 + visualType 50 + interactiveElement 200 + duration 20)
 *       = 5 × 580 = 2900 +
 *     bioLinkStrategy.callToAction 200 + landingPageTip 300 + linkInBioText 200
 *     ≈ 21,140 chars total prose
 *     /3.0 chars/token = 7,047 tokens
 *     + JSON structure overhead (~300 tokens)
 *     + 25% safety margin
 *     ≈ 9,184 tokens minimum.
 *
 *   Setting to 12000 for comfortable headroom.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 12000;

interface InstagramExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Instagram Expert',
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
      caption: { type: 'string' },
      hashtags: { type: 'array' },
      formatRecommendation: { type: 'object' },
      carouselSlides: { type: 'array' },
      reelScript: { type: 'object' },
      storySequence: { type: 'array' },
      bioLinkStrategy: { type: 'object' },
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
  contentType: z.string().min(1).default('post'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const InstagramContentResultSchema = z.object({
  caption: z.string().min(20).max(2200),
  hookLine: z.string().min(5).max(300),
  hashtags: z.array(z.string().min(1)).min(5).max(30),
  formatRecommendation: z.object({
    format: z.enum(['reel', 'carousel', 'single_image', 'story', 'live']),
    rationale: z.string().min(20).max(500),
    bestPractices: z.array(z.string().min(5)).min(2).max(5),
  }),
  carouselSlides: z.array(z.object({
    slideNumber: z.number().int().min(1),
    text: z.string().min(10).max(500),
    visualDirection: z.string().min(10).max(300),
    callToAction: z.string().max(500).nullish(),
  })).min(3).max(10).optional(),
  reelScript: z.object({
    hook: z.string().min(10).max(800),
    body: z.string().min(20).max(3000),
    closingCTA: z.string().min(5).max(800),
    audioSuggestion: z.string().min(5).max(500),
    estimatedDuration: z.string().min(2).max(20),
    trendReference: z.string().max(500).nullish(),
  }).optional(),
  storySequence: z.array(z.object({
    storyNumber: z.number().int().min(1),
    content: z.string().min(10).max(800),
    visualType: z.enum(['image', 'video', 'boomerang', 'text', 'poll', 'quiz', 'countdown']),
    interactiveElement: z.string().max(500).nullish(),
    estimatedDuration: z.string().max(20).nullish(),
  })).min(2).max(10).optional(),
  bioLinkStrategy: z.object({
    callToAction: z.string().min(5).max(500),
    landingPageTip: z.string().min(10).max(1000),
    linkInBioText: z.string().min(5).max(500),
  }),
});

export type InstagramContentResult = z.infer<typeof InstagramContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: InstagramExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Instagram Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-instagram-expert-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<InstagramExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Instagram Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: InstagramExpertGMConfig = {
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
      `Instagram Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
  sections.push('Produce a complete Instagram content plan. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "caption": "<Instagram caption, ready to copy-paste, 20-2200 chars>",');
  sections.push('  "hookLine": "<first line that stops the scroll, 5-300 chars>",');
  sections.push('  "hashtags": ["<5-30 hashtags without # prefix>"],');
  sections.push('  "formatRecommendation": {');
  sections.push('    "format": "<reel|carousel|single_image|story|live>",');
  sections.push('    "rationale": "<why this format works best for the topic, 20-500 chars>",');
  sections.push('    "bestPractices": ["<2-5 platform-specific tips for this format>"]');
  sections.push('  },');
  sections.push('  "carouselSlides": [');
  sections.push('    {');
  sections.push('      "slideNumber": 1,');
  sections.push('      "text": "<text content for this slide, 10-500 chars>",');
  sections.push('      "visualDirection": "<what the visual should look like, 10-300 chars>",');
  sections.push('      "callToAction": "<optional CTA for this slide>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "reelScript": {');
  sections.push('    "hook": "<first 1-3 seconds, 10-300 chars>",');
  sections.push('    "body": "<main content, 20-1500 chars>",');
  sections.push('    "closingCTA": "<end CTA, 5-300 chars>",');
  sections.push('    "audioSuggestion": "<trending sound or music recommendation, 5-200 chars>",');
  sections.push('    "estimatedDuration": "<e.g. 15s, 30s, 60s>",');
  sections.push('    "trendReference": "<optional trending format this follows>"');
  sections.push('  },');
  sections.push('  "storySequence": [');
  sections.push('    {');
  sections.push('      "storyNumber": 1,');
  sections.push('      "content": "<what this story frame shows/says, 10-300 chars>",');
  sections.push('      "visualType": "<image|video|boomerang|text|poll|quiz|countdown>",');
  sections.push('      "interactiveElement": "<optional interactive sticker/element>",');
  sections.push('      "estimatedDuration": "<e.g. 5s>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "bioLinkStrategy": {');
  sections.push('    "callToAction": "<what to say in caption to drive bio link clicks, 5-200 chars>",');
  sections.push('    "landingPageTip": "<what the link should lead to, 10-300 chars>",');
  sections.push('    "linkInBioText": "<suggested link-in-bio text, 5-200 chars>"');
  sections.push('  }');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- The caption MUST front-load the hook — Instagram truncates after 125 chars in feed. The first line is everything.');
  sections.push('- Use line breaks and spacing strategically. Short paragraphs, not walls of text.');
  sections.push('- Hashtags: mix mega (1M+ posts), mid (100K-1M), and niche (<100K) hashtags. Place in a comment block or at the end — never inline in the caption body.');
  sections.push('- ALWAYS provide carouselSlides (3-10 slides) AND reelScript AND storySequence regardless of format recommendation — the user may choose a different format.');
  sections.push('- Carousel slide 1 MUST be a scroll-stopper (bold claim, question, or surprising stat). Last slide MUST have a CTA.');
  sections.push('- Reel hook MUST capture attention in under 3 seconds. Use pattern interrupts, text overlays, or unexpected visuals.');
  sections.push('- Story sequence should build narrative tension across frames and use at least one interactive element (poll, quiz, slider, question box).');
  sections.push('- Bio link strategy must connect the content to a measurable action (sign up, download, buy, book).');
  sections.push('- If seoKeywords are provided, weave the primary keyword naturally into the caption and hashtags.');
  sections.push('- If brandContext.avoidPhrases are provided, never use those phrases anywhere in the output.');
  sections.push('- If brandContext.keyPhrases are provided, weave at least one naturally into the caption.');
  sections.push('- Never use "Link in bio" as the entire CTA — be specific about WHAT the link leads to.');
  sections.push('- Do NOT fabricate engagement metrics, follower counts, or specific performance predictions.');
  sections.push('- The caption must be ready to copy-paste into Instagram with zero editing.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<InstagramContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Instagram Expert output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = InstagramContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Instagram Expert output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// INSTAGRAM EXPERT CLASS
// ============================================================================

export class InstagramExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Instagram Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Instagram Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Instagram Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Instagram Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[InstagramExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateContentRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Instagram Expert generate_content: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const data = await executeGenerateContent(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[InstagramExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 400, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createInstagramExpert(): InstagramExpert {
  return new InstagramExpert();
}

let instance: InstagramExpert | null = null;

export function getInstagramExpert(): InstagramExpert {
  instance ??= createInstagramExpert();
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
  InstagramContentResultSchema,
};
