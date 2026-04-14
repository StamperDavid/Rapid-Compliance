/**
 * Growth Analyst — REAL AI AGENT (Task #33 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6) to produce data-driven growth
 * analysis, experiment recommendations, and strategic insights.
 *
 * Supported actions (live code paths only):
 *   - generate_content  (MarketingManager GROWTH_LOOP — the only caller)
 *
 * The pre-rebuild template engine supported 7 actions (AGGREGATE_METRICS,
 * CALCULATE_KPIS, IDENTIFY_PATTERNS, GENERATE_MUTATIONS, TRACK_OBJECTIVES,
 * CONTENT_LIBRARY, WEEKLY_REPORT) — all using in-memory MemoryVault reads
 * with zero AI. Per CLAUDE.md rules, dead branches are not rebuilt.
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

const FILE = 'marketing/growth-analyst/specialist.ts';
const SPECIALIST_ID = 'GROWTH_ANALYST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_content'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Growth Analyst response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   GrowthAnalysisResultSchema worst case (after the kpiTargets and
 *   contentStrategy cap widenings — see schema comments below):
 *     analysis.currentState 3000 + opportunities (8 × 500 = 4,000) +
 *     risks (5 × 500 = 2,500) + competitiveInsight 2000 = 11,500
 *     experiments: 7 × (name 200 + hypothesis 600 + channel 100 +
 *     effort 10 + impact 10 + timeframe 200 + successMetric 300 +
 *     JSON 30) = 7 × 1,450 = 10,150
 *     prioritizedActions: 7 × (action 300 + priority 10 + rationale 500
 *     + JSON 30) = 7 × 840 = 5,880
 *     kpiTargets: 8 × (metric 300 + currentEstimate 300 + target 300 +
 *     timeframe 300 + JSON 30) = 8 × 1,230 = 9,840  ← all 4 caps widened
 *     contentStrategy 6000                            ← cap widened
 *     ≈ 43,370 chars total prose
 *     /3.0 chars/token = 14,457 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 18,321 tokens minimum.
 *
 *   The prior 8,192 was less than half the required budget. Setting the
 *   floor at 19,000 covers the widened schema with safety margin. The
 *   truncation backstop in callOpenRouter catches any overflow.
 *
 *   The kpiTargets.* (100/200 → 300 across all four entry fields) and
 *   contentStrategy (4000 → 6000) caps were widened in this commit
 *   because the Growth Analyst pirate test surfaced verbose pirate-
 *   dialect KPI metadata and content strategies exceeding the original
 *   Task #33 caps. Same lesson as Email Specialist Task #43. The first
 *   widening pass only touched the fields proven failing in pirate-test
 *   run #1, but run #2 surfaced the remaining KPI fields under different
 *   LLM verbosity — all four entry fields needed the same headroom.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 19000;

interface GrowthAnalystGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Growth Analyst',
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
      analysis: { type: 'object' },
      experiments: { type: 'array' },
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
  contentType: z.string().min(1).default('growth_analysis'),
  targetAudience: z.string().optional(),
  tone: z.string().optional(),
  campaignGoal: z.string().optional(),
  brandContext: z.record(z.unknown()).optional(),
  seoKeywords: z.record(z.unknown()).optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const ExperimentSchema = z.object({
  name: z.string().min(5).max(200),
  hypothesis: z.string().min(20).max(600),
  channel: z.string().min(2).max(100),
  effort: z.enum(['low', 'medium', 'high']),
  expectedImpact: z.enum(['low', 'medium', 'high']),
  timeframe: z.string().min(3).max(200),
  successMetric: z.string().min(10).max(300),
});

const GrowthAnalysisResultSchema = z.object({
  analysis: z.object({
    currentState: z.string().min(50).max(3000),
    opportunities: z.array(z.string().min(20).max(500)).min(3).max(8),
    risks: z.array(z.string().min(20).max(500)).min(1).max(5),
    competitiveInsight: z.string().min(30).max(2000),
  }),
  experiments: z.array(ExperimentSchema).min(3).max(7),
  prioritizedActions: z.array(z.object({
    action: z.string().min(10).max(300),
    priority: z.enum(['critical', 'high', 'medium', 'low']),
    rationale: z.string().min(20).max(500),
  })).min(3).max(7),
  // Caps widened across ALL four kpiTargets entry fields (April 13 2026
  // cross-cutting fix): metric/timeframe 100 → 300, currentEstimate/target
  // 200 → 300, contentStrategy 4000 → 6000. Original Task #33 caps were
  // too tight for verbose briefs — the Growth Analyst pirate test
  // surfaced this when pirate-dialect KPI metadata ("Sail this course
  // over the next 90 days, me hearties, while we plunder...") exceeded
  // the original ceilings. First widening pass only touched the fields
  // proven failing in run #1 (timeframe, metric) but the second run
  // failed on currentEstimate and target too — all four KPI-entry fields
  // are in the same class and need the same headroom for verbose styles.
  // Same lesson learned at Email Specialist Task #43. Worst-case schema
  // math in MIN_OUTPUT_TOKENS_FOR_SCHEMA accounts for all the widened caps.
  kpiTargets: z.array(z.object({
    metric: z.string().min(3).max(300),
    currentEstimate: z.string().min(2).max(300),
    target: z.string().min(2).max(300),
    timeframe: z.string().min(3).max(300),
  })).min(3).max(8),
  contentStrategy: z.string().min(50).max(6000),
});

export type GrowthAnalysisResult = z.infer<typeof GrowthAnalysisResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: GrowthAnalystGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Growth Analyst GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-growth-analyst-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<GrowthAnalystGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Growth Analyst GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: GrowthAnalystGMConfig = {
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

  // Truncation detection (cross-cutting fix). The OpenRouter provider was
  // hardcoding finishReason='stop' for months, silently masking length-
  // truncated responses. Now that the provider is honest, fail loudly on
  // any 'length' finish_reason instead of feeding incomplete JSON to
  // JSON.parse and surfacing a misleading "unexpected end of input".
  if (response.finishReason === 'length') {
    throw new Error(
      `Growth Analyst: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
    `Analysis type: ${req.contentType}`,
  ];

  if (req.targetAudience) {sections.push(`Target audience: ${req.targetAudience}`);}
  if (req.tone) {sections.push(`Tone: ${req.tone}`);}
  if (req.campaignGoal) {sections.push(`Campaign goal: ${req.campaignGoal}`);}

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
  }

  sections.push('');
  sections.push('Produce a growth analysis with experiments, prioritized actions, and KPI targets. Respond with ONLY a valid JSON object, no markdown fences. The JSON must match this exact schema:');
  sections.push('');
  sections.push('{');
  sections.push('  "analysis": {');
  sections.push('    "currentState": "<assessment of the current growth situation, 50-3000 chars>",');
  sections.push('    "opportunities": ["<3-8 specific growth opportunities, each 20-500 chars>"],');
  sections.push('    "risks": ["<1-5 risks or threats to growth, each 20-500 chars>"],');
  sections.push('    "competitiveInsight": "<analysis of competitive landscape and positioning, 30-2000 chars>"');
  sections.push('  },');
  sections.push('  "experiments": [');
  sections.push('    {');
  sections.push('      "name": "<experiment name, 5-200 chars>",');
  sections.push('      "hypothesis": "<if we do X, we expect Y because Z, 20-600 chars>",');
  sections.push('      "channel": "<marketing channel: SEO, paid social, email, content, partnerships, etc.>",');
  sections.push('      "effort": "<low|medium|high>",');
  sections.push('      "expectedImpact": "<low|medium|high>",');
  sections.push('      "timeframe": "<how long to run the experiment, 3-200 chars>",');
  sections.push('      "successMetric": "<specific measurable outcome, 10-300 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "prioritizedActions": [');
  sections.push('    {');
  sections.push('      "action": "<specific action to take, 10-300 chars>",');
  sections.push('      "priority": "<critical|high|medium|low>",');
  sections.push('      "rationale": "<why this priority ranking, 20-500 chars>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "kpiTargets": [');
  sections.push('    {');
  sections.push('      "metric": "<metric name: MRR, CAC, LTV, churn rate, etc.>",');
  sections.push('      "currentEstimate": "<estimated current value or range>",');
  sections.push('      "target": "<target value>",');
  sections.push('      "timeframe": "<when to hit the target>"');
  sections.push('    }');
  sections.push('  ],');
  sections.push('  "contentStrategy": "<overall growth strategy narrative connecting the analysis to the experiments and actions, 50-4000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- Experiments MUST have 3-7 entries. Each must be specific and actionable, not generic ("improve SEO" is bad; "Create 10 comparison landing pages targeting competitor brand keywords" is good).');
  sections.push('- Every experiment needs a clear hypothesis in "if X then Y because Z" format.');
  sections.push('- Effort/impact scoring must be honest. Not everything is high-impact/low-effort. Most real experiments are medium on both axes.');
  sections.push('- PrioritizedActions MUST have 3-7 entries ranked by priority. "Critical" means revenue or growth is at risk without it. "Low" means nice-to-have.');
  sections.push('- KPI targets MUST have 3-8 entries with realistic estimates — not aspirational fantasies. If you don\'t know the current value, say "unknown — needs measurement" rather than guessing.');
  sections.push('- Do NOT fabricate specific numbers (MRR, ARR, conversion rates, user counts) unless they are obviously illustrative ranges based on the industry context.');
  sections.push('- Competitive insights should be specific to the industry and topic, not generic advice.');
  sections.push('- The contentStrategy must tie everything together: why these experiments, why this priority order, what the growth thesis is.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateContent(
  req: GenerateContentRequest,
  ctx: LlmCallContext,
): Promise<GrowthAnalysisResult> {
  const userPrompt = buildGenerateContentUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Growth Analyst output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const result = GrowthAnalysisResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Growth Analyst output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// GROWTH ANALYST CLASS
// ============================================================================

export class GrowthAnalyst extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Growth Analyst initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Growth Analyst: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Growth Analyst: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Growth Analyst does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[GrowthAnalyst] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateContentRequestSchema.safeParse({ ...payload, action });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Growth Analyst generate_content: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const data = await executeGenerateContent(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[GrowthAnalyst] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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

export function createGrowthAnalyst(): GrowthAnalyst {
  return new GrowthAnalyst();
}

let instance: GrowthAnalyst | null = null;

export function getGrowthAnalyst(): GrowthAnalyst {
  instance ??= createGrowthAnalyst();
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
  buildGenerateContentUserPrompt,
  stripJsonFences,
  GenerateContentRequestSchema,
  GrowthAnalysisResultSchema,
};
