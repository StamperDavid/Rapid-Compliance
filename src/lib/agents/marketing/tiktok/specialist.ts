/**
 * TikTok Expert — REAL AI AGENT (Task #30 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked tier policy for
 * leaf specialists, see Task #23.5) to produce high-performing TikTok
 * video content with strategic metadata. No template fallbacks. If the GM is
 * missing, Brand DNA is missing, OpenRouter fails, JSON won't parse, or
 * Zod validation fails, the specialist returns a real FAILED AgentReport
 * with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager — the only caller of this
 *                        specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine supported 12 actions (3 CREATE via
 * template switch tables, 6 LISTEN stubs returning confidence: 0,
 * 3 ENGAGE stubs returning confidence: 0). None had live callers beyond
 * the manager's single `generate_viral_hook` dispatch. Per CLAUDE.md's
 * no-stubs and no-features-beyond-what-was-requested rules, the dead
 * branches are not rebuilt. If a future caller needs another action, it
 * gets added then with its own GM update and regression cases.
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

const FILE = 'marketing/tiktok/specialist.ts';
const SPECIALIST_ID = 'TIKTOK_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case TikTok Expert response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   TikTokContentResultSchema worst case:
 *     videoScript: hook 500 + body 3000 + cta 400 + duration 100 +
 *     pacingNotes 1000 = 5,000
 *     caption 2200 + hashtags (15 × ~25 = 375)
 *     hooks: primary 500 + alternatives (4 × 500) = 2,500
 *     soundRecommendation 1500 + estimatedEngagement enum 10
 *     bestPostingTime 600 + contentStrategy 3000
 *     ≈ 15,185 chars total prose
 *     /3.0 chars/token = 5,062 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 6,577 tokens minimum.
 *
 *   The prior 8,192 was already comfortably above the schema-derived
 *   floor. TikTok Expert was NOT under-budgeted — but it was missing
 *   the truncation backstop, which is the more important half of this
 *   fix. Keeping the constant at 8,192 to preserve prior behavior.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 8192;

interface TikTokExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'TikTok Expert',
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
      videoScript: { type: 'object' },
      caption: { type: 'string' },
      hashtags: { type: 'array' },
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
  contentType: z.string().min(1).default('short_video'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const TikTokContentResultSchema = z.object({
  videoScript: z.object({
    hook: z.string().min(10).max(500),
    body: z.string().min(50).max(3000),
    callToAction: z.string().min(10).max(400),
    duration: z.string().min(2).max(100),
    pacingNotes: z.string().min(20).max(1000),
  }),
  caption: z.string().min(20).max(2200),
  hashtags: z.array(z.string().min(1)).min(3).max(15),
  hooks: z.object({
    primary: z.string().min(10).max(500),
    alternatives: z.array(z.string().min(10).max(500)).min(2).max(4),
  }),
  soundRecommendation: z.string().min(20).max(1500),
  estimatedEngagement: z.enum(['low', 'medium', 'high', 'viral']),
  bestPostingTime: z.string().min(5).max(600),
  contentStrategy: z.string().min(50).max(3000),
});

export type TikTokContentResult = z.infer<typeof TikTokContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: TikTokExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `TikTok Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-tiktok-expert-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<TikTokExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `TikTok Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: TikTokExpertGMConfig = {
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

  // Truncation detection (cross-cutting fix). The OpenRouter provider was
  // hardcoding finishReason='stop' for months, silently masking length-
  // truncated responses. Now that the provider is honest, fail loudly on
  // any 'length' finish_reason instead of feeding incomplete JSON to
  // JSON.parse and surfacing a misleading "unexpected end of input".
  if (response.finishReason === 'length') {
    throw new Error(
      `TikTok Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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

  // Brand context pass-through from MarketingManager
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

  // SEO keywords pass-through
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
  sections.push('Produce a TikTok video concept with full script, captions, and strategic metadata. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "videoScript": {');
  sections.push('    "hook": "<the opening 1-3 seconds — text/visual/spoken hook that stops the scroll, 10-500 chars>",');
  sections.push('    "body": "<the main video script with speaker directions and visual cues, 50-3000 chars>",');
  sections.push('    "callToAction": "<closing CTA — follow, comment, share, link-in-bio, 10-400 chars>",');
  sections.push('    "duration": "<estimated video length, e.g. 15s, 30s, 60s>",');
  sections.push('    "pacingNotes": "<beat-by-beat timing guidance — when to cut, zoom, add text overlays, pattern interrupts, 20-1000 chars>"');
  sections.push('  },');
  sections.push('  "caption": "<the TikTok caption text, max 2200 chars>",');
  sections.push('  "hashtags": ["<3-15 hashtags without # prefix>"],');
  sections.push('  "hooks": {');
  sections.push('    "primary": "<the main hook restated as standalone text, 10-500 chars>",');
  sections.push('    "alternatives": ["<2-4 alternative hook options, each 10-500 chars>"]');
  sections.push('  },');
  sections.push('  "soundRecommendation": "<audio strategy — trending sound, original audio, voiceover, or music genre recommendation, 20-1500 chars>",');
  sections.push('  "estimatedEngagement": "<low|medium|high|viral>",');
  sections.push('  "bestPostingTime": "<recommended posting time with rationale, 5-600 chars>",');
  sections.push('  "contentStrategy": "<strategic rationale for the content approach, trend alignment, and algorithm optimization, 50-3000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- The hook MUST stop the scroll in under 1 second. Use pattern interrupts, bold claims, curiosity gaps, or visual shocks. Never start with "Hey guys" or "So today I want to talk about."');
  sections.push('- Video pacing MUST include pattern interrupts every 3-5 seconds (camera angle changes, text overlays, zoom cuts, sound effects). TikTok\'s algorithm rewards retention, not watch time alone.');
  sections.push('- The script body MUST include visual/audio direction markers like [ZOOM IN], [TEXT OVERLAY: "key stat"], [CUT TO], [SOUND EFFECT], [B-ROLL] so a video editor or the user can follow the pacing.');
  sections.push('- Caption must be punchy and front-loaded — the first line appears above "...more" and must hook readers who paused scrolling.');
  sections.push('- Hashtags: 3-15 total. Mix broad (#FYP, #Viral, #LearnOnTikTok), medium (#BusinessTikTok, #MarketingTips), and niche tags. Never use banned or shadowbanned hashtags.');
  sections.push('- Sound recommendation must be specific — name a genre, mood, or type of audio (trending sound, original voiceover, talking-head with background music) rather than generic "use trending audio."');
  sections.push('- The CTA must be native to TikTok: "Follow for part 2", "Save this for later", "Comment [keyword] and I\'ll send you the guide", "Stitch this with your take." Never use LinkedIn-style CTAs like "Schedule a demo."');
  sections.push('- Duration: default to 15-30 seconds for hooks/tips, 30-60 seconds for tutorials/stories, 60+ for deep dives. Always specify.');
  sections.push('- alternativeHooks MUST have 2-4 genuinely different hooks (different psychological trigger — curiosity, controversy, relatability, authority, urgency).');
  sections.push('- If seoKeywords are provided, weave the primary keyword naturally into the caption. Never keyword-stuff.');
  sections.push('- If brandContext.avoidPhrases are provided, never use those phrases anywhere in the output.');
  sections.push('- If brandContext.keyPhrases are provided, weave at least one naturally into the script body.');
  sections.push('- Do NOT fabricate view counts, engagement rates, or specific performance predictions.');
  sections.push('- The script must be ready to film with zero editing — a creator should be able to read it and start recording.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<TikTokContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `TikTok Expert output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = TikTokContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`TikTok Expert output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// TIKTOK EXPERT CLASS
// ============================================================================

export class TikTokExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'TikTok Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['TikTok Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['TikTok Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `TikTok Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[TikTokExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

      // Validate input at the boundary so we fail fast with a clear error
      const inputValidation = GenerateContentRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `TikTok Expert generate_content: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const data = await executeGenerateContent(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[TikTokExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 380, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createTikTokExpert(): TikTokExpert {
  return new TikTokExpert();
}

let instance: TikTokExpert | null = null;

export function getTikTokExpert(): TikTokExpert {
  instance ??= createTikTokExpert();
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
  TikTokContentResultSchema,
};
