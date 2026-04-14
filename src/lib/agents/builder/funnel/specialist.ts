/**
 * Funnel Engineer — REAL AI AGENT (Task #36 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6) to produce a full funnel design:
 * stages, per-stage tactics + KPIs, overall conversion target, estimated
 * CPA, bottleneck risks, A/B test roadmap, recommendations, and a written
 * rationale grounded in the brand and target audience.
 *
 * Supported actions (live code paths only):
 *   - design_funnel  (BuilderManager.executeSpecialistsParallel — the only caller)
 *
 * The pre-rebuild template engine supported 4 methods (funnel_design,
 * landing_page_structure, lead_capture_sequence, conversion_optimization).
 * Only `funnel_design` was ever called from production code (builder/manager.ts
 * line ~1098). The other three branches were dead weight. Per CLAUDE.md rules,
 * dead branches are not rebuilt.
 *
 * Output shape: `{ funnelSummary, stages[3..7], expectedOverallConversionPct,
 * estimatedCpa, keyBottleneckRisks[2..5], abTestRoadmap[3..6], recommendations,
 * rationale }`. Prose fields for `tacticsDescription`, `kpiDescription`, and
 * `optimizationNotes` on each stage (regression-stable — no nested arrays to
 * jitter across repeated runs).
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

const FILE = 'builder/funnel/specialist.ts';
const SPECIALIST_ID = 'FUNNEL_ENGINEER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['design_funnel'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Funnel Engineer response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   FunnelDesignResultSchema is dominated by the stages array (3-7 entries
 *   with prose-heavy tactics/kpi/optimization fields summing to ~6,240
 *   chars at theoretical max per stage).
 *
 *   Theoretical worst case (7 stages, every prose field at .max()):
 *     funnelSummary: 2,300
 *     stages: 7 × (name 80 + purpose 600 + tacticsDescription 2500 +
 *     kpiDescription 1500 + bottleneckRisk enum 10 + optimizationNotes
 *     1500 + JSON 50) = 7 × 6,240 = 43,680
 *     estimatedCpa 2000 + keyBottleneckRisks (5 × 800 = 4,000)
 *     abTestRoadmap: 6 × (testName 200 + hypothesis 800 + successMetric
 *     400 + priority 10 + JSON 30) = 6 × 1,440 = 8,640
 *     recommendations 6000 + rationale 6000
 *     ≈ 72,630 chars total at theoretical maximum
 *     /3.0 chars/token = 24,210 tokens
 *     + JSON overhead + 25% safety ≈ 30,500 tokens.
 *
 *   The LLM does not actually fill every field to .max() in practice.
 *   Realistic worst case (5 stages, ~60% prose fill):
 *     stages: 5 × ~3,800 = 19,000
 *     + summary + abTests + cpa + bottlenecks + recommendations + rationale
 *     ≈ 45,000 chars → ~15,000 tokens + safety = ~19,000.
 *
 *   Setting the floor at 22,000 covers realistic worst with comfortable
 *   headroom and is comfortably above the prior 10,000 baseline. Cases
 *   that approach the theoretical max trigger the truncation backstop.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 22000;

interface FunnelEngineerGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Funnel Engineer',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'BUILDER_MANAGER',
    capabilities: ['design_funnel'],
  },
  systemPrompt: '',
  tools: ['design_funnel'],
  outputSchema: {
    type: 'object',
    properties: {
      funnelSummary: { type: 'object' },
      stages: { type: 'array' },
      expectedOverallConversionPct: { type: 'number' },
      estimatedCpa: { type: 'string' },
      keyBottleneckRisks: { type: 'array' },
      abTestRoadmap: { type: 'array' },
      recommendations: { type: 'string' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.6,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

interface FunnelDesignRequirementsInput {
  funnelType?: string;
  businessModel?: string;
  targetAudience?: string;
  pricePoint?: 'low' | 'mid' | 'high';
  productName?: string;
  trafficSource?: string;
  currentConversionRate?: number;
}

export interface DesignFunnelRequest {
  action: 'design_funnel';
  context: string;
  requirements?: FunnelDesignRequirementsInput;
}

const DesignFunnelRequestSchema = z.object({
  action: z.literal('design_funnel'),
  context: z.string().min(1),
  requirements: z
    .object({
      funnelType: z.string().optional(),
      businessModel: z.string().optional(),
      targetAudience: z.string().optional(),
      pricePoint: z.enum(['low', 'mid', 'high']).optional(),
      productName: z.string().optional(),
      trafficSource: z.string().optional(),
      currentConversionRate: z.number().min(0).max(1).optional(),
    })
    .optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const FunnelSummarySchema = z.object({
  funnelType: z.string().min(2).max(400),
  businessModel: z.string().min(2).max(400),
  primaryObjective: z.string().min(20).max(1500),
});

const FunnelStageSchema = z.object({
  name: z.string().min(2).max(80),
  purpose: z.string().min(20).max(600),
  tacticsDescription: z.string().min(30).max(2500),
  kpiDescription: z.string().min(20).max(1500),
  estimatedConversionPct: z.number().min(0.1).max(100),
  bottleneckRisk: z.enum(['low', 'medium', 'high']),
  optimizationNotes: z.string().min(30).max(1500),
});

const AbTestSchema = z.object({
  testName: z.string().min(5).max(200),
  hypothesis: z.string().min(20).max(800),
  successMetric: z.string().min(10).max(400),
  priority: z.enum(['critical', 'high', 'medium', 'low']),
});

const FunnelDesignResultSchema = z.object({
  funnelSummary: FunnelSummarySchema,
  stages: z.array(FunnelStageSchema).min(3).max(7),
  expectedOverallConversionPct: z.number().min(0.1).max(60),
  estimatedCpa: z.string().min(5).max(2000),
  keyBottleneckRisks: z.array(z.string().min(10).max(800)).min(2).max(5),
  abTestRoadmap: z.array(AbTestSchema).min(3).max(6),
  recommendations: z.string().min(100).max(6000),
  rationale: z.string().min(150).max(6000),
});

export type FunnelDesignResult = z.infer<typeof FunnelDesignResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: FunnelEngineerGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Funnel Engineer GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-funnel-engineer-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<FunnelEngineerGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Funnel Engineer GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: FunnelEngineerGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.6,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Funnel Engineer refuses to design a funnel without brand identity. ' +
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
      `Funnel Engineer: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: design_funnel
// ============================================================================

function buildDesignFunnelUserPrompt(req: DesignFunnelRequest): string {
  const sections: string[] = [
    'ACTION: design_funnel',
    '',
    `Brief: ${req.context}`,
  ];

  const reqs = req.requirements;
  if (reqs) {
    sections.push('');
    sections.push('Requirements from caller:');
    if (reqs.funnelType) {sections.push(`  Funnel type: ${reqs.funnelType}`);}
    if (reqs.businessModel) {sections.push(`  Business model: ${reqs.businessModel}`);}
    if (reqs.targetAudience) {sections.push(`  Target audience: ${reqs.targetAudience}`);}
    if (reqs.pricePoint) {sections.push(`  Price point: ${reqs.pricePoint}`);}
    if (reqs.productName) {sections.push(`  Product name: ${reqs.productName}`);}
    if (reqs.trafficSource) {sections.push(`  Traffic source: ${reqs.trafficSource}`);}
    if (typeof reqs.currentConversionRate === 'number') {
      sections.push(`  Current conversion rate: ${(reqs.currentConversionRate * 100).toFixed(2)}%`);
    }
  }

  sections.push('');
  sections.push(
    'Design a complete conversion funnel rooted in the brand, audience, and product. Respond with ONLY a valid JSON object, no markdown fences. The JSON must match this exact schema:',
  );
  sections.push('');
  sections.push('{');
  sections.push('  "funnelSummary": {');
  sections.push('    "funnelType": "<TOFU/MOFU/BOFU or specific funnel archetype>",');
  sections.push('    "businessModel": "<echo the business model from input>",');
  sections.push('    "primaryObjective": "<one-sentence to one-paragraph statement of the single outcome this funnel exists to produce, 20-800 chars>"');
  sections.push('  },');
  sections.push('  "stages": [');
  sections.push('    {');
  sections.push('      "name": "<stage name, e.g. Awareness, Consideration, Decision, Retention>",');
  sections.push('      "purpose": "<what this stage does for the prospect, 20-600 chars>",');
  sections.push('      "tacticsDescription": "<PROSE string describing the specific tactics used in this stage — channels, content types, offers, hooks. Not a JSON array, a single string. Example: \'Paid LinkedIn thought-leadership posts targeting VPs of Revenue Operations in $10M-$100M SaaS, paired with an interactive ROI calculator gated behind a soft email capture. Retargeting via Meta Custom Audiences for site visitors who viewed pricing but did not start a trial.\'>",');
  sections.push('      "kpiDescription": "<PROSE string describing the KPIs tracked at this stage and what good looks like. Not a JSON array. Example: \'Primary KPI is MQL-to-SQL conversion (target 25-35%). Secondary: time-on-calculator (target 2+ minutes) and trial-start rate from calculator completers (target 12-18%).\'>",');
  sections.push('      "estimatedConversionPct": <number 0.1-100, realistic per-stage conversion percentage>,');
  sections.push('      "bottleneckRisk": "<low|medium|high>",');
  sections.push('      "optimizationNotes": "<PROSE string 30-1500 chars describing the most likely optimization levers at this stage>"');
  sections.push('    }');
  sections.push('    // 3-7 stages total, ordered top-of-funnel to retention');
  sections.push('  ],');
  sections.push('  "expectedOverallConversionPct": <number 0.1-60, end-to-end funnel conversion as a percentage>,');
  sections.push('  "estimatedCpa": "<cost-per-acquisition estimate with range and reasoning, e.g. \'$120-$180 blended across paid and organic, higher at launch due to audience discovery cost, dropping to $80-$120 at scale\'>",');
  sections.push('  "keyBottleneckRisks": ["<2-5 short risk statements, each 10-400 chars — the most likely failure modes for this specific funnel>"],');
  sections.push('  "abTestRoadmap": [');
  sections.push('    {');
  sections.push('      "testName": "<5-200 chars>",');
  sections.push('      "hypothesis": "<if we change X we expect Y to move because Z, 20-800 chars>",');
  sections.push('      "successMetric": "<what will be measured, 10-400 chars>",');
  sections.push('      "priority": "<critical|high|medium|low>"');
  sections.push('    }');
  sections.push('    // 3-6 tests, ordered by priority');
  sections.push('  ],');
  sections.push('  "recommendations": "<prose 100-4000 chars — the synthesis: the strategic moves the operator should make FIRST to stand this funnel up, the traps to avoid, the measurement setup>",');
  sections.push('  "rationale": "<prose 150-4500 chars — why THIS funnel for THIS brand and audience. Tie funnel shape to buyer psychology, stage count to sales cycle length, KPIs to business model, A/B tests to the biggest leverage points>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- stages MUST have 3-7 entries, ordered top-of-funnel to retention.');
  sections.push('- tacticsDescription, kpiDescription, and optimizationNotes are PROSE strings — not JSON arrays. Write them as flowing sentences a human reader would actually read.');
  sections.push('- estimatedConversionPct and expectedOverallConversionPct are PERCENTAGES (0.1-100 and 0.1-60), not decimal fractions. 25 means 25%, not 2500%.');
  sections.push('- keyBottleneckRisks MUST have 2-5 entries, each a short, specific risk statement. No generic "users drop off" — be specific about WHICH users and WHERE.');
  sections.push('- abTestRoadmap MUST have 3-6 entries prioritized by expected impact. Every test must have a clear "if X then Y because Z" hypothesis, not "try making the button bigger."');
  sections.push('- The rationale MUST explicitly reference the brand, target audience, and price point. Do NOT output a generic funnel that could fit any company.');
  sections.push('- If brandDNA.avoidPhrases contains a phrase, do NOT use it anywhere in the output.');
  sections.push('- If brandDNA.keyPhrases contains phrases, weave them naturally into tactics/KPIs/rationale where appropriate.');
  sections.push('- Never name competitors unless the caller specifically asks.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeDesignFunnel(
  req: DesignFunnelRequest,
  ctx: LlmCallContext,
): Promise<FunnelDesignResult> {
  const userPrompt = buildDesignFunnelUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Funnel Engineer output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const result = FunnelDesignResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Funnel Engineer output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// FUNNEL ENGINEER CLASS
// ============================================================================

export class FunnelEngineer extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Funnel Engineer initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Funnel Engineer: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Funnel Engineer: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Funnel Engineer does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[FunnelEngineer] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = DesignFunnelRequestSchema.safeParse({ ...payload, action });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Funnel Engineer design_funnel: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);
      const data = await executeDesignFunnel(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[FunnelEngineer] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
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
    return { functional: 400, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createFunnelEngineer(): FunnelEngineer {
  return new FunnelEngineer();
}

let instance: FunnelEngineer | null = null;

export function getFunnelEngineer(): FunnelEngineer {
  instance ??= createFunnelEngineer();
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
  loadGMAndBrandDNA,
  buildResolvedSystemPrompt,
  buildDesignFunnelUserPrompt,
  stripJsonFences,
  DesignFunnelRequestSchema,
  FunnelDesignResultSchema,
};
