/**
 * Budget Strategist Specialist (May 8, 2026)
 *
 * Reads a snapshot of the operator's per-platform marketing spend +
 * conversion data, then emits per-platform recommendations (increase /
 * decrease / hold / pause) with plain-English rationale and confidence.
 *
 * The specialist NEVER moves money itself. It only recommends. The operator
 * decides whether to act. Platforms with budget-change APIs (Google Ads,
 * Meta Ads) get a recommendation that the dashboard can later apply with a
 * two-step confirmation. Platforms WITHOUT a budget API (SEO retainers,
 * Google LSA top-ups) get a `requiresManualMissionTask` flag set so the
 * recommendation flows out as a Mission Control task instead.
 *
 * NOT to be confused with PRICING_STRATEGIST (Stripe/payment dispatcher).
 *
 * STANDING RULE #1 (binding):
 *   - Loads its Golden Master from Firestore at runtime.
 *   - Sends `gm.systemPrompt` verbatim to OpenRouter.
 *   - NO runtime Brand DNA merging. Brand DNA was baked in at seed time.
 *   - NO inline / hardcoded prompt fallback. If the GM is missing, the
 *     specialist returns FAILED with a loud diagnostic.
 *
 * STANDING RULE #2: this specialist never edits its own prompt. Operators
 * grade output in Mission Control; the Prompt Engineer translates that
 * grade into a surgical edit; humans approve before deploy.
 *
 * Production-ready scope as of ship date:
 *   - LLM call wired end-to-end with Brand-DNA-baked GM ✓
 *   - Manager registration via MARKETING_MANAGER ✓
 *   - Admin SpecialistRegistry entry ✓
 *
 * NOT YET shipped (separate work, surfaced in CONTINUATION_PROMPT):
 *   - Dashboard widget UI + full budgeting page
 *   - Hourly cron for live refresh
 *   - Google Ads / Meta Ads / Google LSA budget-shift API integrations
 *   - CRM source attribution wiring (UTM capture on every form, GA4 fallback)
 *   - Two-step Apply confirmation per the destructive-action standing rule
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';
import type {
  AnalyzeBudgetRequest,
  BudgetRecommendation,
  BudgetStrategistResult,
  PlatformSpendSnapshot,
} from '@/types/budget-strategist';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'marketing/budget/specialist.ts';
const SPECIALIST_ID = 'BUDGET_STRATEGIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['analyze_budget'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor. Worst case: 12 platforms × ~600 chars each
 * (rationale + manualMissionPrompt) + summary 800 chars = ~8000 chars.
 * /3.0 chars/token = ~2700 tokens + 25% safety = ~3400.
 * Floor at 4000 for headroom.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 4000;
/**
 * Total attributed conversions below which the strategist surfaces
 * `insufficientData=true` instead of confident recommendations.
 */
const INSUFFICIENT_DATA_CONVERSION_THRESHOLD = 10;

interface BudgetStrategistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Budget Strategist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'MARKETING_MANAGER',
    capabilities: [
      'marketing_budget_allocation',
      'cross_platform_spend_analysis',
      'conversion_attribution_review',
      'plain_english_recommendation_generation',
    ],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['analyze_budget'],
  outputSchema: {
    type: 'object',
    properties: {
      recommendations: { type: 'array' },
      summaryRationale: { type: 'string' },
      insufficientData: { type: 'boolean' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.3,
};

// ============================================================================
// OUTPUT CONTRACT (Zod schemas — enforced on every LLM response)
// ============================================================================

const ActionTypeEnum = z.enum(['increase', 'decrease', 'hold', 'pause']);
const ConfidenceEnum = z.enum(['low', 'medium', 'high']);

const RecommendationFromLlmSchema = z.object({
  platform: z.string().min(1).max(80),
  displayName: z.string().min(1).max(120),
  currentSpendUsd: z.number().nonnegative().max(10_000_000),
  recommendedSpendUsd: z.number().nonnegative().max(10_000_000),
  deltaUsd: z.number().min(-10_000_000).max(10_000_000),
  actionType: ActionTypeEnum,
  rationale: z.string().min(1).max(1200),
  confidence: ConfidenceEnum,
  requiresManualMissionTask: z.boolean(),
  // LLMs frequently send "" (empty string) instead of omitting an optional
  // field. Treat empty as absent so the optional contract holds.
  manualMissionPrompt: z
    .preprocess((v) => (typeof v === 'string' && v.trim() === '' ? undefined : v),
      z.string().min(1).max(1200).optional()),
});

const StrategistOutputSchema = z.object({
  recommendations: z.array(RecommendationFromLlmSchema).max(20),
  summaryRationale: z.string().min(1).max(1500),
  insufficientData: z.boolean(),
  insufficientDataMessage: z.string().min(1).max(600).optional(),
});

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: BudgetStrategistGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Budget Strategist GM not found for industryKey=${industryKey}. ` +
      `Run \`node scripts/seed-budget-strategist-gm.js\` to seed. ` +
      `STANDING RULE #1: a specialist without a baked-in GM is not allowed to run.`,
    );
  }

  const config = gmRecord.config as Partial<BudgetStrategistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Budget Strategist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: BudgetStrategistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.3,
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
      `Budget Strategist: LLM response truncated at maxTokens=${ctx.gm.maxTokens}. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or reduce the platform count.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// USER PROMPT BUILDER
// ============================================================================

function totalConversions(platforms: PlatformSpendSnapshot[]): number {
  return platforms.reduce((sum, p) => sum + (Number.isFinite(p.conversions) ? p.conversions : 0), 0);
}

function buildUserPrompt(req: AnalyzeBudgetRequest): string {
  const totals = totalConversions(req.platforms);
  const dataDensityNote = totals < INSUFFICIENT_DATA_CONVERSION_THRESHOLD
    ? `IMPORTANT: only ${totals} attributed conversion(s) total across all platforms in the last ${req.windowDays} days. This is below the ${INSUFFICIENT_DATA_CONVERSION_THRESHOLD}-conversion confidence threshold. Set insufficientData=true and write rationales accordingly — surface that recommendations are exploratory until more conversion data accumulates. Do NOT pretend to have high confidence.`
    : `Total attributed conversions across all platforms: ${totals}. This is sufficient for confident recommendations.`;

  const previousBlock = req.previousAllocation
    ? `\n\n## Previous allocation (for trend context)\n\n${JSON.stringify(req.previousAllocation, null, 2)}`
    : '';

  return [
    'ACTION: analyze_budget',
    '',
    `The operator wants to allocate $${req.totalBudgetUsd.toLocaleString()} across the platforms below for the next ${req.windowDays}-day window.`,
    '',
    dataDensityNote,
    '',
    '## Platform spend + conversion snapshot',
    '',
    JSON.stringify(req.platforms, null, 2),
    previousBlock,
    '',
    'Produce per-platform recommendations and a cross-platform summary in the JSON shape below.',
    'Conversion-source trust order is crm > ga4 > platform_self_reported. When a platform reports much higher conversions than CRM or GA4 attributes, treat that as a sanity-check failure and discount its self-reported numbers in your reasoning.',
    'For platforms with `requiresManualBudgetChange=true`, set `requiresManualMissionTask=true` on the recommendation AND populate `manualMissionPrompt` with the EXACT plain-English instruction the operator would send to Jasper to act on it.',
    '',
    'Respond with ONLY a valid JSON object, no markdown fences, no preamble:',
    '',
    '{',
    '  "recommendations": [',
    '    {',
    '      "platform": "<platform key from input>",',
    '      "displayName": "<friendly platform name from input>",',
    '      "currentSpendUsd": <number>,',
    '      "recommendedSpendUsd": <number>,',
    '      "deltaUsd": <recommendedSpendUsd - currentSpendUsd>,',
    '      "actionType": "increase | decrease | hold | pause",',
    '      "rationale": "<plain English: why this number, what signal drove it, what to watch for>",',
    '      "confidence": "low | medium | high",',
    '      "requiresManualMissionTask": <bool>,',
    '      "manualMissionPrompt": "<OPTIONAL: the exact text the operator sends to Jasper if requiresManualMissionTask=true>"',
    '    }',
    '  ],',
    '  "summaryRationale": "<2-4 sentences: what shifted, why, and the single highest-impact change to watch>",',
    '  "insufficientData": <bool: true if total conversions < 10>,',
    '  "insufficientDataMessage": "<OPTIONAL: 1-2 sentences telling the operator how much more data they need>"',
    '}',
    '',
    'Hard rules:',
    '- recommendedSpendUsd values across all platforms must sum to within $1 of totalBudgetUsd.',
    '- deltaUsd MUST equal recommendedSpendUsd - currentSpendUsd for every recommendation.',
    '- Order recommendations by absolute deltaUsd descending — biggest moves first.',
    '- Use the platform keys and displayNames from the input verbatim. Do NOT invent new platforms.',
    '- pause is only valid when conversions=0 over the full window AND spend was non-zero. Otherwise prefer decrease.',
    '- Plain English in every rationale — no jargon, no "leverage synergies". Cite specific numbers from the snapshot.',
    '- Keep each rationale under 1000 characters (2-4 short paragraphs max).',
    '- For platforms WITHOUT requiresManualBudgetChange=true, OMIT the manualMissionPrompt field entirely. Do NOT include an empty string.',
    '- Do NOT name competitors. Do NOT use phrases from the avoid list in the Brand DNA section above.',
  ].join('\n');
}

// ============================================================================
// EXECUTION
// ============================================================================

function validateAllocationMath(
  recommendations: BudgetRecommendation[],
  totalBudgetUsd: number,
): string | null {
  const sum = recommendations.reduce((acc, r) => acc + r.recommendedSpendUsd, 0);
  if (Math.abs(sum - totalBudgetUsd) > 1) {
    return `Recommended spend sums to $${sum.toFixed(2)} but operator's total budget is $${totalBudgetUsd.toFixed(2)}. The LLM's math is off by $${(sum - totalBudgetUsd).toFixed(2)}.`;
  }
  for (const r of recommendations) {
    const expectedDelta = r.recommendedSpendUsd - r.currentSpendUsd;
    if (Math.abs(expectedDelta - r.deltaUsd) > 0.5) {
      return `Recommendation for ${r.platform}: deltaUsd=$${r.deltaUsd.toFixed(2)} but recommendedSpendUsd - currentSpendUsd = $${expectedDelta.toFixed(2)}.`;
    }
  }
  return null;
}

async function executeAnalyzeBudget(
  req: AnalyzeBudgetRequest,
  ctx: LlmCallContext,
): Promise<BudgetStrategistResult> {
  if (!Array.isArray(req.platforms) || req.platforms.length === 0) {
    throw new Error('Budget Strategist analyze_budget: platforms[] must be non-empty');
  }
  if (!Number.isFinite(req.totalBudgetUsd) || req.totalBudgetUsd <= 0) {
    throw new Error('Budget Strategist analyze_budget: totalBudgetUsd must be a positive number');
  }
  if (!Number.isFinite(req.windowDays) || req.windowDays <= 0) {
    throw new Error('Budget Strategist analyze_budget: windowDays must be a positive integer');
  }

  const userPrompt = buildUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Budget Strategist output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = StrategistOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `Budget Strategist output did not match expected schema: ${issueSummary}`,
    );
  }

  const mathError = validateAllocationMath(result.data.recommendations, req.totalBudgetUsd);
  if (mathError) {
    throw new Error(`Budget Strategist allocation math invalid: ${mathError}`);
  }

  return {
    recommendations: result.data.recommendations,
    summaryRationale: result.data.summaryRationale,
    insufficientData: result.data.insufficientData,
    insufficientDataMessage: result.data.insufficientDataMessage,
  };
}

// ============================================================================
// PUBLIC ENTRY POINT (for non-swarm callers — dashboard widget, cron, etc.)
// ============================================================================

/**
 * Run the Budget Strategist directly with a request payload.
 *
 * The dashboard widget and the hourly refresh cron (when those ship) will
 * call this. Internally, the BaseSpecialist message dispatch path uses the
 * same code.
 */
export async function runBudgetStrategist(
  req: AnalyzeBudgetRequest,
): Promise<BudgetStrategistResult> {
  const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
  return executeAnalyzeBudget(req, ctx);
}

// ============================================================================
// SPECIALIST CLASS (Signal Bus / Manager dispatch)
// ============================================================================

export class BudgetStrategist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Budget Strategist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, [
          'Budget Strategist: payload must be an object',
        ]);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, [
          'Budget Strategist: no action or method specified in payload',
        ]);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Budget Strategist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[BudgetStrategist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      // action === 'analyze_budget'
      const req = payload as unknown as AnalyzeBudgetRequest;
      const data = await executeAnalyzeBudget(req, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[BudgetStrategist] Execution failed',
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
    return { functional: 280, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createBudgetStrategist(): BudgetStrategist {
  return new BudgetStrategist();
}

let instance: BudgetStrategist | null = null;

export function getBudgetStrategist(): BudgetStrategist {
  instance ??= createBudgetStrategist();
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
  INSUFFICIENT_DATA_CONVERSION_THRESHOLD,
  loadGMConfig,
  buildUserPrompt,
  stripJsonFences,
  validateAllocationMath,
  StrategistOutputSchema,
};
