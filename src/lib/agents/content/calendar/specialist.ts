/**
 * Calendar Coordinator — REAL AI AGENT (Task #25 rebuild, April 11 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked in after the
 * regression harness proved Sonnet 4 → Sonnet 4.6 was a safe upgrade on
 * the seeded Copywriter case corpus) to produce publishing schedules that
 * map approved content items to concrete dates, times, and platforms. No
 * template fallbacks. If the GM is missing, Brand DNA is missing,
 * OpenRouter fails, JSON won't parse, or Zod validation fails, the
 * specialist returns a real FAILED AgentReport with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - plan_calendar  (ContentManager.generateContentCalendar — the only
 *                     caller of this specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine supported 4 actions. Three of them
 * (optimal_timing, cross_platform_sync, performance_tracking) had no live
 * caller anywhere in the codebase — they were dead surface pretending to
 * be a scheduling suite. Per CLAUDE.md's no-stubs and no-features-beyond-
 * what-was-requested rules, the dead branches are not rebuilt. If a
 * future caller needs another action, it gets added then with its own
 * GM update and regression cases.
 *
 * This specialist produces the EDITORIAL schedule — what to publish
 * where and when. It does NOT push to social platforms, book ad spend,
 * or touch the media library. Downstream publishing is the job of the
 * Social Coordinator and the platform adapters in src/lib/social/*.
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

const FILE = 'calendar/specialist.ts';
const SPECIALIST_ID = 'CALENDAR_COORDINATOR';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['plan_calendar'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Calendar Coordinator response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   ScheduleEntrySchema bounds rationale at min(20).max(300) chars.
 *   PlanCalendarResultSchema bounds schedule at min(3).max(200) entries.
 *   The prompt further clamps the realistic target to [10, 80] entries
 *   via the `targetMin`/`targetMax` clamping in buildPlanCalendarUserPrompt.
 *
 *   80-entry worst case (verbose rationales):
 *     per entry: contentId 30 + platform 30 + date 10 + time 5 +
 *                rationale 300 + JSON keys/quotes/commas ~50 = 425 chars
 *     80 × 425 = 34,000 chars
 *     + frequencyRecommendation (~6 platforms × 150 chars) = 900
 *     ≈ 34,900 chars total prose
 *     /3.0 chars/token = 11,633 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 14,791 tokens minimum.
 *
 *   The prior 12,000 was below the realistic 80-entry worst case. Setting
 *   the floor at 15,000 tokens covers the prompt-clamped maximum with a
 *   small safety margin. The truncation backstop in callOpenRouter
 *   catches anything that overflows.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 15000;

interface CalendarCoordinatorGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Calendar Coordinator',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['plan_calendar'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['plan_calendar'],
  outputSchema: {
    type: 'object',
    properties: {
      schedule: { type: 'array' },
      frequencyRecommendation: { type: 'object' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

export interface PlanCalendarContentItem {
  id: string;
  type: string;
  title: string;
}

export interface PlanCalendarRequest {
  action: 'plan_calendar';
  contentItems: PlanCalendarContentItem[];
  platforms: string[];
  // EITHER explicit date range OR natural-language duration (at least one required)
  startDate?: string;   // YYYY-MM-DD
  endDate?: string;     // YYYY-MM-DD
  duration?: string;    // '1 week' | '1 month' | '3 months' | 'quarter' | etc.
  timezone?: string;    // IANA tz, default 'America/New_York'
}

const PlanCalendarRequestSchema = z.object({
  action: z.literal('plan_calendar'),
  contentItems: z.array(z.object({
    id: z.string().min(1),
    type: z.string().min(1),
    title: z.string().min(1),
  })).min(1),
  platforms: z.array(z.string().min(1)).min(1),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  duration: z.string().min(1).optional(),
  timezone: z.string().min(1).optional(),
}).superRefine((data, ctx) => {
  // EITHER (startDate + endDate) OR duration must be present
  const hasExplicitRange = Boolean(data.startDate && data.endDate);
  const hasDuration = Boolean(data.duration);
  if (!hasExplicitRange && !hasDuration) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['duration'],
      message: 'plan_calendar requires EITHER both startDate+endDate OR a duration string. At least one temporal source is mandatory.',
    });
  }
  // If startDate provided, endDate must also be provided (and vice versa)
  if (Boolean(data.startDate) !== Boolean(data.endDate)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: 'If startDate is provided, endDate must also be provided (and vice versa). Partial ranges are not allowed.',
    });
  }
  // If both explicit dates provided, startDate must be <= endDate
  if (data.startDate && data.endDate && data.startDate > data.endDate) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['endDate'],
      message: `endDate (${data.endDate}) must be >= startDate (${data.startDate}).`,
    });
  }
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const ScheduleEntrySchema = z.object({
  contentId: z.string().min(1),
  platform: z.string().min(1),
  suggestedDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'suggestedDate must be YYYY-MM-DD'),
  suggestedTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'suggestedTime must be HH:MM (24h)'),
  rationale: z.string().min(20).max(300),
});

const PlanCalendarResultSchema = z.object({
  schedule: z.array(ScheduleEntrySchema).min(3).max(200),
  frequencyRecommendation: z.record(z.string(), z.string()),
}).superRefine((data, ctx) => {
  // Invariant: no literal duplicate schedule entries. Keyed on the full 4-tuple
  // (contentId, platform, date, time) so high-cadence platforms like Twitter
  // can legitimately repost the same content at different times on the same
  // day — which matches real editorial practice on Twitter/X where the same
  // asset hits different timezones throughout the day. Only forbid the exact
  // duplicate at the exact same minute.
  const seen = new Map<string, number>();
  for (let i = 0; i < data.schedule.length; i++) {
    const entry = data.schedule[i];
    if (!entry) {
      continue;
    }
    const key = `${entry.contentId}|${entry.platform}|${entry.suggestedDate}|${entry.suggestedTime}`;
    const existingIdx = seen.get(key);
    if (existingIdx !== undefined) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['schedule', i],
        message: `Duplicate (contentId=${entry.contentId}, platform=${entry.platform}, date=${entry.suggestedDate}, time=${entry.suggestedTime}). Literal duplicate schedule entry.`,
      });
    }
    seen.set(key, i);
  }
  // Invariant: every platform in frequencyRecommendation must appear in schedule
  const schedulePlatforms = new Set(data.schedule.map((e) => e.platform));
  for (const platform of Object.keys(data.frequencyRecommendation)) {
    if (!schedulePlatforms.has(platform)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['frequencyRecommendation', platform],
        message: `frequencyRecommendation mentions "${platform}" but schedule has no entries for it.`,
      });
    }
  }
});

export type PlanCalendarResult = z.infer<typeof PlanCalendarResultSchema>;
export type ScheduleEntry = z.infer<typeof ScheduleEntrySchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: CalendarCoordinatorGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Calendar Coordinator GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-calendar-coordinator-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<CalendarCoordinatorGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Calendar Coordinator GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: CalendarCoordinatorGMConfig = {
    systemPrompt,
    // Default to Sonnet 4.6 (locked tier policy for leaf specialists —
    // see Task #23.5). The GM can override this per-industry if needed.
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. Calendar Coordinator refuses to plan schedules without brand identity. ' +
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
      `Calendar Coordinator: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: plan_calendar
// ============================================================================

function buildPlanCalendarUserPrompt(req: PlanCalendarRequest): string {
  const timezone = req.timezone && req.timezone.trim().length > 0
    ? req.timezone.trim()
    : 'America/New_York';

  const contentItemsBlock = req.contentItems
    .map((item) => `  - id=${item.id} | type=${item.type} | title="${item.title}"`)
    .join('\n');

  const platformsBlock = req.platforms.map((p) => `  - ${p}`).join('\n');

  // Target a focused, curated schedule size rather than exhaustive cadence fill.
  // Rule of thumb: ~2-3 posts per (contentItem × platform), clamped to [10, 80].
  // This keeps LLM output bounded and produces a human-reviewable plan rather
  // than a machine-generated firehose.
  const rawTarget = req.contentItems.length * req.platforms.length * 3;
  const targetMin = Math.max(10, Math.floor(rawTarget * 0.6));
  const targetMax = Math.min(80, Math.ceil(rawTarget * 1.2));

  const hasExplicitRange = Boolean(req.startDate && req.endDate);
  const dateModeBlock = hasExplicitRange
    ? [
        'Date mode: EXPLICIT.',
        `Use EXACTLY this range: ${req.startDate} to ${req.endDate}.`,
        'Do NOT interpret duration — the user is in control of the window.',
        'Every suggestedDate MUST fall inside this inclusive range.',
      ].join('\n')
    : [
        'Date mode: AI-DETERMINED.',
        `Parse the duration string "${req.duration}" and choose an appropriate start date (default: next Monday in ${timezone}) and end date.`,
        'Schedule should fill the entire chosen window with appropriate cadence for each platform.',
      ].join('\n');

  return [
    'ACTION: plan_calendar',
    '',
    `Timezone: ${timezone}`,
    '',
    dateModeBlock,
    '',
    'Content items to schedule (use these exact ids in schedule[].contentId):',
    contentItemsBlock,
    '',
    'Target platforms (use these exact strings in schedule[].platform):',
    platformsBlock,
    '',
    'Produce a publishing schedule and frequency recommendations. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "schedule": [',
    '    {',
    '      "contentId": "<must exactly match one of the input content item ids>",',
    '      "platform": "<must exactly match one of the input platforms>",',
    '      "suggestedDate": "YYYY-MM-DD",',
    '      "suggestedTime": "HH:MM (24-hour clock, local to the timezone above)",',
    '      "rationale": "specific reason this slot fits the platform, audience, and content type (≥20 chars)"',
    '    }',
    '  ],',
    '  "frequencyRecommendation": {',
    '    "<platform>": "human-readable cadence guidance (e.g., \\"3 posts per week, focus on Tuesday/Thursday/Friday mornings\\")"',
    '  }',
    '}',
    '',
    'Hard rules you MUST follow:',
    `- schedule MUST contain between ${targetMin} and ${targetMax} entries. This is a focused curated plan, NOT an exhaustive cadence fill. Think strategically about which content deserves promotion on which platform on which date — do not just tile every platform-day pair.`,
    '- Every schedule[].contentId MUST exactly match one of the input content item ids listed above.',
    '- Every schedule[].platform MUST exactly match one of the input platforms listed above.',
    '- suggestedDate MUST be formatted as YYYY-MM-DD. suggestedTime MUST be formatted as HH:MM (24-hour clock).',
    '- NO literal duplicate schedule entries. The 4-tuple (contentId, platform, suggestedDate, suggestedTime) must be unique — it is OK to post the same content on Twitter at 09:00 and 17:00 the same day (different timezones), but not at 09:00 twice.',
    '- frequencyRecommendation MUST have exactly one key per platform that actually appears in your schedule. No extra platforms. No missing platforms.',
    '- Every rationale MUST be specific to the slot, between 20 and 100 characters. Concise — one sharp sentence, not a paragraph. Example: "LinkedIn peak engagement Tuesday 9am for B2B SaaS buyers checking their feed before standups."',
    '- Do NOT use any phrase from the avoid list in the Brand DNA injection.',
    '- Do NOT fabricate statistics, percentages, or engagement numbers in rationales.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences.',
  ].join('\n');
}

async function executePlanCalendar(
  req: PlanCalendarRequest,
  ctx: LlmCallContext,
): Promise<PlanCalendarResult> {
  const userPrompt = buildPlanCalendarUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Calendar Coordinator output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = PlanCalendarResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Calendar Coordinator output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// CALENDAR COORDINATOR CLASS
// ============================================================================

export class CalendarCoordinator extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Calendar Coordinator initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Calendar Coordinator: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Calendar Coordinator: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Calendar Coordinator does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[CalendarCoordinator] Executing action=${action} taskId=${taskId}`, { file: FILE });

      // Validate input at the boundary so we fail fast with a clear error
      // instead of surfacing Zod schema errors against the LLM output.
      const inputValidation = PlanCalendarRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Calendar Coordinator plan_calendar: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);

      const data = await executePlanCalendar(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[CalendarCoordinator] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 410, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createCalendarCoordinator(): CalendarCoordinator {
  return new CalendarCoordinator();
}

let instance: CalendarCoordinator | null = null;

export function getCalendarCoordinator(): CalendarCoordinator {
  instance ??= createCalendarCoordinator();
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
  buildPlanCalendarUserPrompt,
  stripJsonFences,
  PlanCalendarRequestSchema,
  PlanCalendarResultSchema,
  ScheduleEntrySchema,
};
