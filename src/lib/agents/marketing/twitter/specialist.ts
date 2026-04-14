/**
 * Twitter/X Expert — REAL AI AGENT (Task #31 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked tier policy for
 * leaf specialists, see Task #23.5) to produce high-performing Twitter/X
 * content with strategic metadata. No template fallbacks. If the GM is
 * missing, Brand DNA is missing, OpenRouter fails, JSON won't parse, or
 * Zod validation fails, the specialist returns a real FAILED AgentReport
 * with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager — the only caller of this
 *                        specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine supported 12 actions (3 core via template
 * switch tables, 5 LISTEN stubs with zero/mock data, 4 ENGAGE stubs with
 * template replies). Two methods had real Twitter API calls (fetchMentions,
 * fetchAudience) but returned unprocessed data with no AI analysis. Per
 * CLAUDE.md's no-stubs and no-features-beyond-what-was-requested rules,
 * the dead branches are not rebuilt. If a future caller needs another action,
 * it gets added then with its own GM update and regression cases.
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

const FILE = 'marketing/twitter/specialist.ts';
const SPECIALIST_ID = 'TWITTER_X_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Twitter/X Expert response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   TwitterContentResultSchema worst case (15-tweet thread):
 *     thread: 15 × (text 280 + purpose 300 + engagementTactic 300 +
 *     position int 5 + JSON 30) = 15 × 915 = 13,725
 *     standaloneTweet 280
 *     hooks: primary 280 + 4 alternatives × 280 = 1,400
 *     hashtags (5 × ~25) = 125
 *     estimatedEngagement enum 10
 *     bestPostingTime 600
 *     ratioRiskAssessment 1000
 *     contentStrategy 3000
 *     ≈ 20,140 chars total prose
 *     /3.0 chars/token = 6,713 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 8,641 tokens minimum.
 *
 *   The prior 8,192 was slightly below the 15-tweet worst case. Setting
 *   the floor at 9,000 covers the schema with a small safety margin.
 *   The truncation backstop in callOpenRouter catches any overflow.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 9000;

interface TwitterExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Twitter/X Expert',
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
      thread: { type: 'array' },
      caption: { type: 'string' },
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
  contentType: z.string().min(1).default('thread'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const TweetSchema = z.object({
  position: z.number().int().min(1),
  text: z.string().min(10).max(280),
  purpose: z.string().min(5).max(300),
  engagementTactic: z.string().min(5).max(300),
});

const TwitterContentResultSchema = z.object({
  thread: z.array(TweetSchema).min(1).max(15),
  standaloneTweet: z.string().min(10).max(280),
  hooks: z.object({
    primary: z.string().min(10).max(280),
    alternatives: z.array(z.string().min(10).max(280)).min(2).max(4),
  }),
  hashtags: z.array(z.string().min(1)).min(0).max(5),
  estimatedEngagement: z.enum(['low', 'medium', 'high', 'viral']),
  bestPostingTime: z.string().min(5).max(600),
  ratioRiskAssessment: z.string().min(20).max(1000),
  contentStrategy: z.string().min(50).max(3000),
});

export type TwitterContentResult = z.infer<typeof TwitterContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: TwitterExpertGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Twitter/X Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-twitter-expert-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<TwitterExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Twitter/X Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: TwitterExpertGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Twitter/X Expert refuses to generate content without brand identity. ' +
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
      `Twitter/X Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
  sections.push('Produce a Twitter/X thread plus a standalone tweet with strategic metadata. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "thread": [');
  sections.push('    {');
  sections.push('      "position": 1,');
  sections.push('      "text": "<tweet text, STRICT 280 character limit>",');
  sections.push('      "purpose": "<why this tweet exists in the thread, 5-300 chars>",');
  sections.push('      "engagementTactic": "<what engagement mechanism this tweet uses, 5-300 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "standaloneTweet": "<a single standalone tweet on the same topic, 10-280 chars>",');
  sections.push('  "hooks": {');
  sections.push('    "primary": "<the thread opener / hook tweet, 10-280 chars>",');
  sections.push('    "alternatives": ["<2-4 alternative hook tweets, each 10-280 chars>"]');
  sections.push('  },');
  sections.push('  "hashtags": ["<0-5 hashtags without # prefix — Twitter uses fewer hashtags than other platforms>"],');
  sections.push('  "estimatedEngagement": "<low|medium|high|viral>",');
  sections.push('  "bestPostingTime": "<recommended posting time with rationale, 5-600 chars>",');
  sections.push('  "ratioRiskAssessment": "<assessment of potential negative reactions and how to mitigate, 20-1000 chars>",');
  sections.push('  "contentStrategy": "<strategic rationale for the content approach, 50-3000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- EVERY tweet in the thread MUST be 280 characters or fewer. This is Twitter\'s hard limit. Count carefully. No exceptions.');
  sections.push('- Tweet 1 (the hook) MUST stop the scroll. Use bold claims, contrarian takes, surprising stats, or direct questions. Never start with "Thread:" or "1/" — the platform shows thread indicators automatically.');
  sections.push('- Thread length: 3-12 tweets for most topics. Each tweet must stand alone AND flow into the next. End each tweet at a curiosity gap so readers click "Show this thread."');
  sections.push('- The final tweet MUST contain a clear CTA: follow, retweet, bookmark, reply, or link. "If this helped, follow me for more [topic]" works. "Let me know your thoughts" is weak.');
  sections.push('- standaloneTweet must work completely independently from the thread — a single punchy take on the same topic that could be posted on its own.');
  sections.push('- Hashtags: 0-3 is optimal on Twitter. More than 3 looks spammy. Use only if highly relevant. Many high-performing tweets use zero hashtags.');
  sections.push('- Ratio risk: assess whether the content could trigger negative pile-ons. Political topics, hot takes about specific companies, or dismissive language increase ratio risk. Flag it honestly.');
  sections.push('- The hook alternatives MUST use different psychological triggers (curiosity, controversy, authority, urgency, relatability). Not just rephrasing.');
  sections.push('- Write in the specified tone. Twitter rewards personality — bland corporate speak gets zero engagement.');
  sections.push('- If seoKeywords are provided, weave the primary keyword naturally into the hook tweet and standalone tweet.');
  sections.push('- If brandContext.avoidPhrases are provided, never use those phrases anywhere in the output.');
  sections.push('- If brandContext.keyPhrases are provided, weave at least one naturally into the thread.');
  sections.push('- Do NOT fabricate impression counts, engagement rates, follower counts, or specific performance predictions.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<TwitterContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Twitter/X Expert output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = TwitterContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Twitter/X Expert output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// TWITTER/X EXPERT CLASS
// ============================================================================

export class TwitterExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Twitter/X Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Twitter/X Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Twitter/X Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Twitter/X Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[TwitterExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

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
          `Twitter/X Expert generate_content: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);

      const data = await executeGenerateContent(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[TwitterExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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

export function createTwitterExpert(): TwitterExpert {
  return new TwitterExpert();
}

let instance: TwitterExpert | null = null;

export function getTwitterExpert(): TwitterExpert {
  instance ??= createTwitterExpert();
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
  TwitterContentResultSchema,
};
