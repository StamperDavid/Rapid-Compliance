/**
 * Insights Analyst Specialist (May 4, 2026)
 *
 * Reviews a snapshot of the operator's last-7-days platform activity and
 * returns two parallel arrays:
 *
 *   1. setupItems — concrete onboarding gaps the operator hasn't closed.
 *      Each carries a stable `key` so the operator's "stop reminding me"
 *      preference persists across regenerations.
 *
 *   2. insights — proactive, signal-driven recommendations.  Each insight
 *      carries a `suggestedMissionPrompt` that, if the operator accepts,
 *      becomes the verbatim text routed to Jasper as a new mission.
 *
 * The specialist NEVER does the work itself.  It only recommends.  The
 * operator decides whether to act.
 *
 * STANDING RULE #1 (binding):
 *   - Loads its Golden Master from Firestore at runtime.
 *   - Sends `gm.systemPrompt` verbatim to OpenRouter.
 *   - NO runtime Brand DNA merging.  Brand DNA was baked in at seed time.
 *   - NO inline / hardcoded prompt fallback.  If the GM is missing, the
 *     specialist returns FAILED with a loud diagnostic.  Half-shipping a
 *     Brand-DNA-less agent is worse than no agent.
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
  Insight,
  InsightsAnalystResult,
  SetupItem,
} from '@/types/jasper-insights';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'intelligence/insights-analyst/specialist.ts';
const SPECIALIST_ID = 'INSIGHTS_ANALYST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['analyze_platform_activity'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor.
 *
 * Worst case: 8 setup items + 8 insights, each ~500 chars of prose plus
 * suggestedMissionPrompt ~400 chars + signalsSeen 3 × 120 chars = ~1100 chars
 * per insight, ~250 chars per setup item.
 *   8 × 1100 + 8 × 250 = 10,800 chars prose
 *   /3.0 chars/token = 3,600 tokens
 *   + JSON overhead 200 tokens
 *   + 25 % safety margin
 *   ≈ 4,750 tokens.
 *
 * Setting the floor at 6,000 tokens covers the schema with safety margin.
 * The truncation backstop in callOpenRouter catches anything that
 * overflows.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 6000;
const INSIGHT_TTL_DAYS = 7;

interface InsightsAnalystGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Insights Analyst',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'INTELLIGENCE_MANAGER',
    capabilities: [
      'platform_activity_review',
      'setup_gap_detection',
      'proactive_recommendation_generation',
      'mission_prompt_drafting',
    ],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['analyze_platform_activity'],
  outputSchema: {
    type: 'object',
    properties: {
      setupItems: { type: 'array' },
      insights: { type: 'array' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.4,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

export interface AnalyzePlatformActivityRequest {
  action: 'analyze_platform_activity';
  /** Opaque snapshot — the LLM reads whatever shape is provided. */
  snapshot: unknown;
}

// ============================================================================
// OUTPUT CONTRACT (Zod schemas — enforced on every LLM response)
// ============================================================================

const UrgencyEnum = z.enum(['high', 'medium', 'low']);
const CategoryEnum = z.enum([
  'pipeline',
  'content',
  'social',
  'engagement',
  'platform_health',
]);

const SetupItemSchema: z.ZodType<SetupItem> = z.object({
  key: z.string().min(1).max(80).regex(/^[a-z0-9_-]+$/, {
    message: 'key must be a stable lowercase slug (a-z, 0-9, hyphen, underscore)',
  }),
  title: z.string().min(1).max(120),
  description: z.string().min(1).max(600),
  ctaLabel: z.string().min(1).max(60),
  ctaHref: z.string().min(1).max(300).optional(),
  urgency: UrgencyEnum,
});

/**
 * The LLM's per-insight payload.  We omit `id`, `generatedAt`, and
 * `expiresAt` from the LLM contract — the server stamps those after
 * validation so the LLM can't fabricate timestamps or our internal id
 * format.
 */
const InsightFromLlmSchema = z.object({
  title: z.string().min(1).max(160),
  summary: z.string().min(1).max(800),
  urgency: UrgencyEnum,
  category: CategoryEnum,
  signalsSeen: z.array(z.string().min(1).max(300)).min(1).max(8),
  suggestedMissionPrompt: z.string().min(1).max(800),
});

const AnalystOutputSchema = z.object({
  setupItems: z.array(SetupItemSchema).max(12),
  insights: z.array(InsightFromLlmSchema).max(12),
});

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: InsightsAnalystGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Insights Analyst GM not found for industryKey=${industryKey}. ` +
      `Run \`node scripts/seed-insights-analyst-gm.js\` to seed. ` +
      `STANDING RULE #1: a specialist without a baked-in GM is not allowed to run.`,
    );
  }

  const config = gmRecord.config as Partial<InsightsAnalystGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Insights Analyst GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: InsightsAnalystGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.4,
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
      `Insights Analyst: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shrink the snapshot. ` +
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
// USER PROMPT BUILDER
// ============================================================================

function buildUserPrompt(snapshot: unknown): string {
  let snapshotJson: string;
  try {
    snapshotJson = JSON.stringify(snapshot, null, 2);
  } catch (err) {
    const reason = err instanceof Error ? err.message : String(err);
    throw new Error(`Insights Analyst: failed to JSON-stringify snapshot: ${reason}`);
  }

  // Soft cap to keep the prompt within reasonable bounds.  If the snapshot is
  // larger we truncate with a clear marker — better than silently dropping
  // signal.
  const MAX_SNAPSHOT_CHARS = 60_000;
  const trimmedSnapshot =
    snapshotJson.length > MAX_SNAPSHOT_CHARS
      ? `${snapshotJson.slice(0, MAX_SNAPSHOT_CHARS)}\n...[truncated, ${snapshotJson.length - MAX_SNAPSHOT_CHARS} more chars]`
      : snapshotJson;

  return [
    'ACTION: analyze_platform_activity',
    '',
    'Below is a JSON snapshot of the operator\'s last-7-days platform activity. Read it carefully and produce two parallel arrays:',
    '',
    '  1. setupItems — concrete onboarding gaps the operator has NOT closed yet.',
    '     Examples: a calendar provider not connected, no SendGrid sender verified,',
    '     Twilio toll-free not yet approved, no Brand DNA filled in, zero social',
    '     accounts connected, no products in the catalog. Each must have a stable,',
    '     hand-readable `key` (lowercase slug) so the operator\'s "stop reminding me"',
    '     preference persists across regenerations. Pick keys that describe the gap',
    '     itself ("connect-microsoft", "verify-twilio-tfn", "add-first-product"),',
    '     not random ids.',
    '',
    '  2. insights — proactive, signal-driven recommendations. Each insight cites the',
    '     SPECIFIC data signals you observed (e.g. "3 leads stalled in Demo Booked",',
    '     "no social posts published in 7 days", "calendar event with John tomorrow',
    '     has no prep doc"), the urgency, and a `suggestedMissionPrompt` that is',
    '     the EXACT text the operator would send to Jasper if they accept the',
    '     insight. Write that prompt as if YOU are the operator dictating to Jasper:',
    '     plain English, action-oriented, specific names/numbers from the snapshot.',
    '',
    'NEVER recommend missions for things that have already completed in the snapshot.',
    'NEVER fabricate signals — every signalsSeen entry must trace to data in the snapshot.',
    'If the snapshot is empty or near-empty, surface that as a setup gap, not as zero output.',
    '',
    'Respond with ONLY a valid JSON object, no markdown fences, no preamble:',
    '',
    '{',
    '  "setupItems": [',
    '    {',
    '      "key": "stable-lowercase-slug",',
    '      "title": "Short title (under 120 chars)",',
    '      "description": "Plain-English description of the gap and why it matters (under 600 chars)",',
    '      "ctaLabel": "Button label like \\"Connect Microsoft\\"",',
    '      "ctaHref": "OPTIONAL — internal link like \\"/settings/integrations/microsoft\\"",',
    '      "urgency": "high | medium | low"',
    '    }',
    '  ],',
    '  "insights": [',
    '    {',
    '      "title": "Short headline (under 160 chars)",',
    '      "summary": "What you observed and why it matters (under 800 chars)",',
    '      "urgency": "high | medium | low",',
    '      "category": "pipeline | content | social | engagement | platform_health",',
    '      "signalsSeen": ["concrete signal #1 quoted/paraphrased from snapshot", "..."],',
    '      "suggestedMissionPrompt": "The EXACT prompt the operator would send to Jasper to act on this insight"',
    '    }',
    '  ]',
    '}',
    '',
    'Hard rules:',
    '- 0-8 setupItems, 0-8 insights. Quality over quantity.',
    '- Every insight must cite at least 1 and at most 8 concrete signals from the snapshot.',
    '- suggestedMissionPrompt must be plain English, ready to send to Jasper as-is.',
    '- key fields must be stable slugs — same gap = same key across regenerations.',
    '- Do not name competitors. Do not use phrases from the avoid list in the Brand DNA section above.',
    '- Do not fabricate counts, names, or events. Cite only what is in the snapshot.',
    '',
    '## Snapshot (JSON)',
    '',
    trimmedSnapshot,
  ].join('\n');
}

// ============================================================================
// EXECUTION
// ============================================================================

function generateInsightId(): string {
  return `ins_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
}

async function executeAnalyzePlatformActivity(
  req: AnalyzePlatformActivityRequest,
  ctx: LlmCallContext,
): Promise<InsightsAnalystResult> {
  const userPrompt = buildUserPrompt(req.snapshot);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Insights Analyst output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = AnalystOutputSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(
      `Insights Analyst output did not match expected schema: ${issueSummary}`,
    );
  }

  // Server-side stamping of identity / time fields the LLM is not trusted with.
  const now = Date.now();
  const expiresAt = new Date(now + INSIGHT_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
  const generatedAt = new Date(now).toISOString();

  const insights: Insight[] = result.data.insights.map((i) => ({
    id: generateInsightId(),
    title: i.title,
    summary: i.summary,
    urgency: i.urgency,
    category: i.category,
    signalsSeen: i.signalsSeen,
    suggestedMissionPrompt: i.suggestedMissionPrompt,
    generatedAt,
    expiresAt,
  }));

  return {
    setupItems: result.data.setupItems,
    insights,
  };
}

// ============================================================================
// PUBLIC ENTRY POINT (for non-swarm callers)
// ============================================================================

/**
 * Run the Insights Analyst against an arbitrary platform-activity snapshot.
 *
 * This is the contract surface other agents and routes can call directly
 * without going through the Signal Bus / BaseSpecialist message dispatch.
 * The same code path is used internally by `InsightsAnalyst.execute`.
 */
export async function runInsightsAnalyst(snapshot: unknown): Promise<InsightsAnalystResult> {
  const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
  return executeAnalyzePlatformActivity(
    { action: 'analyze_platform_activity', snapshot },
    ctx,
  );
}

// ============================================================================
// SPECIALIST CLASS (Signal Bus / Manager dispatch)
// ============================================================================

export class InsightsAnalyst extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Insights Analyst initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, [
          'Insights Analyst: payload must be an object',
        ]);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, [
          'Insights Analyst: no action or method specified in payload',
        ]);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Insights Analyst does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[InsightsAnalyst] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      // action === 'analyze_platform_activity'
      const req = payload as unknown as AnalyzePlatformActivityRequest;
      if (typeof req.snapshot === 'undefined') {
        return this.createReport(taskId, 'FAILED', null, [
          'Insights Analyst analyze_platform_activity: snapshot is required',
        ]);
      }
      const data = await executeAnalyzePlatformActivity(req, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[InsightsAnalyst] Execution failed',
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
    return { functional: 250, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createInsightsAnalyst(): InsightsAnalyst {
  return new InsightsAnalyst();
}

let instance: InsightsAnalyst | null = null;

export function getInsightsAnalyst(): InsightsAnalyst {
  instance ??= createInsightsAnalyst();
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
  INSIGHT_TTL_DAYS,
  loadGMConfig,
  buildUserPrompt,
  stripJsonFences,
  AnalystOutputSchema,
};
