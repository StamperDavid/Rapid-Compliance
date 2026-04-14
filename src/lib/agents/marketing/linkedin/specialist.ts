/**
 * LinkedIn Expert — REAL AI AGENT (Task #29 rebuild, April 11 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked tier policy for
 * leaf specialists, see Task #23.5) to produce high-performing LinkedIn
 * content with strategic metadata. No template fallbacks. If the GM is
 * missing, Brand DNA is missing, OpenRouter fails, JSON won't parse, or
 * Zod validation fails, the specialist returns a real FAILED AgentReport
 * with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager.delegateToLinkedIn — the only
 *                        caller of this specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine supported 18 actions. 17 of them had no
 * live caller anywhere in the codebase — they were dead surface pretending
 * to be a LinkedIn marketing suite. Per CLAUDE.md's no-stubs and
 * no-features-beyond-what-was-requested rules, the dead branches are not
 * rebuilt. If a future caller needs another action, it gets added then
 * with its own GM update and regression cases.
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

const FILE = 'marketing/linkedin/specialist.ts';
const SPECIALIST_ID = 'LINKEDIN_EXPERT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case LinkedIn Expert response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   LinkedInContentResultSchema worst case:
 *     post.content 3000 + hook 600 + callToAction 400 + hashtags
 *     (10 × ~25 = 250) + estimatedEngagement enum 10 + bestPostingTime 200
 *     = ~4,460 chars
 *     contentStrategy 3000
 *     alternativeAngles: 5 × (angle 400 + rationale 600 + JSON 30)
 *     = 5,150
 *     ≈ 12,610 chars total prose
 *     /3.0 chars/token = 4,203 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 5,504 tokens minimum.
 *
 *   The prior 10,000 was already comfortably above the schema-derived
 *   floor (Task #29 chose 10,000 for "carousel needs room" headroom even
 *   though the schema doesn't model carousels explicitly). LinkedIn
 *   Expert was NOT under-budgeted — but it was missing the truncation
 *   backstop, which is the more important half of this fix. Keeping the
 *   constant at 10,000 to preserve the prior generous default while
 *   documenting that the math says ~5,500 is enough.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 10000;

interface LinkedInExpertGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'LinkedIn Expert',
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
      post: { type: 'object' },
      contentStrategy: { type: 'string' },
      alternativeAngles: { type: 'array' },
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

const LinkedInContentResultSchema = z.object({
  post: z.object({
    content: z.string().min(50).max(3000),
    hook: z.string().min(10).max(600),
    callToAction: z.string().min(10).max(400),
    hashtags: z.array(z.string().min(1)).min(3).max(10),
    estimatedEngagement: z.enum(['low', 'medium', 'high', 'viral']),
    bestPostingTime: z.string().min(5).max(200),
  }),
  contentStrategy: z.string().min(50).max(3000),
  alternativeAngles: z.array(z.object({
    angle: z.string().min(10).max(400),
    rationale: z.string().min(20).max(600),
  })).min(2).max(5),
});

export type LinkedInContentResult = z.infer<typeof LinkedInContentResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: LinkedInExpertGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `LinkedIn Expert GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-linkedin-expert-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<LinkedInExpertGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `LinkedIn Expert GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: LinkedInExpertGMConfig = {
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
      `LinkedIn Expert: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
  sections.push('Produce a LinkedIn post with strategic metadata. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "post": {');
  sections.push('    "content": "<the full LinkedIn post text, ready to copy-paste, 50-3000 chars>",');
  sections.push('    "hook": "<the first 2 lines that appear before see more, 10-300 chars>",');
  sections.push('    "callToAction": "<the closing CTA, 10-200 chars>",');
  sections.push('    "hashtags": ["<3-10 hashtags without # prefix>"],');
  sections.push('    "estimatedEngagement": "<low|medium|high|viral>",');
  sections.push('    "bestPostingTime": "<recommended posting time with rationale, 5-100 chars>"');
  sections.push('  },');
  sections.push('  "contentStrategy": "<strategic rationale for the content approach, 50-2000 chars>",');
  sections.push('  "alternativeAngles": [');
  sections.push('    {');
  sections.push('      "angle": "<different approach to the same topic, 10-200 chars>",');
  sections.push('      "rationale": "<why this angle works, 20-300 chars>"');
  sections.push('    }');
  sections.push('  ]');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- The post content MUST use LinkedIn-optimized formatting: short paragraphs (1-3 sentences), liberal line breaks, white space for mobile readability.');
  sections.push('- The hook MUST stop the scroll — use a bold claim, surprising stat, counterintuitive take, or direct question. Never start with "I\'m excited to share" or "Thrilled to announce."');
  sections.push('- Use emoji sparingly and strategically — one per section at most. Never use emoji walls or emoji-heavy openings.');
  sections.push('- Structure the post hook-first: the first 2 lines are all that show before "...see more" — make them count.');
  sections.push('- Hashtags: 3-10 total. Mix broad (#Leadership, #SaaS), medium (#SalesAutomation, #B2BMarketing), and niche tags. Place at END of post, not inline.');
  sections.push('- The CTA must be specific and low-friction. Never use "Thoughts?" as a standalone CTA.');
  sections.push('- alternativeAngles MUST have 2-5 genuinely different angles (different hook, audience segment, or emotional trigger — not just rephrasing).');
  sections.push('- If seoKeywords are provided, weave the primary keyword naturally into the hook and body. Never keyword-stuff.');
  sections.push('- If brandContext.avoidPhrases are provided, never use those phrases anywhere in the output.');
  sections.push('- If brandContext.keyPhrases are provided, weave at least one naturally into the post body.');
  sections.push('- Never use "I\'m excited to share", "Thrilled to announce", "Let\'s connect", "Thoughts?" as standalone CTAs — these are LinkedIn clichés.');
  sections.push('- Do NOT fabricate engagement metrics, follower counts, or specific performance predictions.');
  sections.push('- The post must be ready to copy-paste into LinkedIn with zero editing.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<LinkedInContentResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `LinkedIn Expert output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = LinkedInContentResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`LinkedIn Expert output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// LINKEDIN EXPERT CLASS
// ============================================================================

export class LinkedInExpert extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'LinkedIn Expert initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['LinkedIn Expert: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['LinkedIn Expert: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `LinkedIn Expert does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[LinkedInExpert] Executing action=${action} taskId=${taskId}`, { file: FILE });

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
          `LinkedIn Expert generate_content: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      const data = await executeGenerateContent(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[LinkedInExpert] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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

export function createLinkedInExpert(): LinkedInExpert {
  return new LinkedInExpert();
}

let instance: LinkedInExpert | null = null;

export function getLinkedInExpert(): LinkedInExpert {
  instance ??= createLinkedInExpert();
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
  LinkedInContentResultSchema,
};
