/**
 * UX/UI Specialist — REAL AI AGENT (Task #40 rebuild, April 13 2026)
 *
 * The Architect-layer UX/UI Specialist. Loads its Golden Master from Firestore
 * at runtime, injects Brand DNA, and calls OpenRouter (Claude Sonnet 4.6 by
 * default — locked tier policy for leaf specialists, see Task #23.5) to produce
 * STRATEGIC design direction for a from-scratch site or funnel. No template
 * fallbacks. If the GM is missing, Brand DNA is missing, OpenRouter fails, JSON
 * won't parse, or Zod validation fails, the specialist returns a real FAILED
 * AgentReport with the honest reason.
 *
 * THIS IS NOT THE BUILDER-LAYER UX/UI ARCHITECT. The Builder-layer specialist
 * at `src/lib/agents/builder/ux-ui/specialist.ts` (Task #35) produces concrete
 * design system tokens (hex codes, font families, spacing scales). The
 * Architect-layer UX/UI Specialist (this file) picks the upstream STRATEGY:
 * color psychology label, typography style label, color palette direction,
 * typography direction, component selection direction, layout direction,
 * responsive direction, accessibility direction, design principles, key
 * design decisions, and rationale. Different layer, different job.
 *
 * Supported actions (live code paths only):
 *   - design_page  (ArchitectManager.executeSpecialistsParallel —
 *                   dispatches `payload.action = 'design_page'` from
 *                   architect/manager.ts:1602-1612 — the only caller of
 *                   this specialist anywhere in the codebase)
 *
 * The pre-rebuild template engine had ZERO action dispatch in execute() —
 * it just called designPage() unconditionally on every payload. It also had
 * three signal-handler sub-paths (get_color_palette, get_components,
 * audit_accessibility) with zero callers anywhere. All dead surface dropped
 * per CLAUDE.md no-stubs and no-features-beyond-what-was-requested rules.
 *
 * Naming-debt note: This specialist is "UX/UI Specialist" (Architect dept)
 * and is NOT the same as "UX/UI Architect" (Builder dept, Task #35). Tracked
 * rename to `UX_UI_STRATEGIST` is Task #61, scheduled after Architect dept
 * is 3/3 real.
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

const FILE = 'architect/ux-ui/specialist.ts';
const SPECIALIST_ID = 'UX_UI_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['design_page'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case UX/UI Specialist response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   DesignPageResultSchema worst case:
 *     short labels (colorPsychology 300 + typographyStyle 200) = 500
 *     colorPaletteDirection 5000 + typographyDirection 5000 +
 *     componentSelectionDirection 10000 + layoutDirection 5000 +
 *     responsiveDirection 5000 + accessibilityDirection 5000 = 35,000
 *     designPrinciples: 6 × 800 = 4,800
 *     keyDesignDecisions: 5 × 1,000 = 5,000
 *     rationale 6000
 *     ≈ 51,300 chars total prose
 *     /3.0 chars/token = 17,100 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 21,625 tokens minimum.
 *
 *   The prior 12,000 was below the schema worst case. Setting the floor
 *   at 22,000 covers the schema with safety margin. The truncation
 *   backstop in callOpenRouter catches any overflow.
 *
 *   componentSelectionDirection at 10000 is the dominant cap (set
 *   high during Task #40 baselining because the LLM produces rich
 *   per-section guidance that scales with section count).
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 22000;

interface UXUISpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'UX/UI Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'ARCHITECT_MANAGER',
    capabilities: ['design_page'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['design_page'],
  outputSchema: {
    type: 'object',
    properties: {
      colorPsychology: { type: 'string' },
      typographyStyle: { type: 'string' },
      colorPaletteDirection: { type: 'string' },
      typographyDirection: { type: 'string' },
      componentSelectionDirection: { type: 'string' },
      layoutDirection: { type: 'string' },
      responsiveDirection: { type: 'string' },
      accessibilityDirection: { type: 'string' },
      designPrinciples: { type: 'array' },
      keyDesignDecisions: { type: 'array' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.6,
};

// ============================================================================
// INPUT CONTRACT (matches ArchitectManager dispatch at architect/manager.ts:1602-1612)
// ============================================================================

export interface DesignPageRequest {
  action: 'design_page';
  pageType: string;
  industry: string;
  toneOfVoice: string;
  funnelType: string;
  sections: string[];
  brief: string;
}

const DesignPageRequestSchema = z.object({
  action: z.literal('design_page'),
  pageType: z.string().min(2).max(80),
  industry: z.string().min(2).max(120),
  toneOfVoice: z.string().min(2).max(200),
  funnelType: z.string().min(2).max(120),
  sections: z.array(z.string().min(1).max(120)).max(20).default([]),
  brief: z.string().min(20).max(8000),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================
//
// Top-level field names `colorPsychology` and `typographyStyle` are
// deliberately chosen to match what ArchitectManager.assembleArchitecture
// already extracts from `report.data` at architect/manager.ts:1804-1805.
// This means ZERO manager edits are needed for the rebuild.
//
// All variable-length content lives in either prose strings (length deltas
// don't fail tolerance) or flat string arrays with bounds (regression-stable
// when bounds are declared in case docs). No nested arrays of objects.
//
// Prose caps are set to 3000 chars from the start (not 1500) because
// temperature 0 produces longer prose than temperature 0.6 — this lesson
// came from the Copy Specialist Task #39 baseline failure.
// ============================================================================

const DesignPageResultSchema = z.object({
  // Manager reads these two top-level fields directly. Kept SHORT phrases
  // (matching the shape of the inferColorPsychology() and inferTypographyStyle()
  // fallback strings the manager uses today).
  colorPsychology: z.string().min(20).max(300),
  typographyStyle: z.string().min(10).max(200),
  // Extended strategic direction prose for downstream Builder consumption.
  // Caps are deliberately generous — at temperature 0.6/0 with a multi-section
  // brief the LLM produces very rich per-area guidance, and truncating it
  // would lose strategically useful detail. componentSelectionDirection has
  // the highest cap because it scales with section count.
  colorPaletteDirection: z.string().min(80).max(5000),
  typographyDirection: z.string().min(80).max(5000),
  componentSelectionDirection: z.string().min(80).max(10000),
  layoutDirection: z.string().min(50).max(5000),
  responsiveDirection: z.string().min(50).max(5000),
  accessibilityDirection: z.string().min(50).max(5000),
  designPrinciples: z.array(z.string().min(10).max(800)).min(3).max(6),
  keyDesignDecisions: z.array(z.string().min(15).max(1000)).min(2).max(5),
  rationale: z.string().min(150).max(6000),
});

export type DesignPageResult = z.infer<typeof DesignPageResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: UXUISpecialistGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `UX/UI Specialist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-ux-ui-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<UXUISpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `UX/UI Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: UXUISpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.6,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. UX/UI Specialist refuses to generate design direction without brand identity. ' +
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
      `UX/UI Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: design_page
// ============================================================================

function buildDesignPageUserPrompt(req: DesignPageRequest): string {
  const sectionsLine = req.sections.length > 0
    ? req.sections.join(', ')
    : '(no sections provided — infer from page type and brief)';

  const sections: string[] = [
    'ACTION: design_page',
    '',
    'You are picking the STRATEGIC design direction for an entire from-scratch site or page.',
    'You are NOT producing concrete design tokens (hex codes, font families, spacing scales) — that happens downstream in the Builder-layer UX/UI Architect.',
    'Your job is to choose the color psychology, typography style, layout direction, component selection direction, responsive direction, accessibility direction, design principles, and key design decisions that the downstream Builder will then execute against.',
    '',
    `Page type: ${req.pageType}`,
    `Industry: ${req.industry}`,
    `Tone of voice (from caller): ${req.toneOfVoice}`,
    `Funnel type: ${req.funnelType}`,
    `Sections to design: ${sectionsLine}`,
    '',
    'Brief from the Architect Manager:',
    req.brief,
    '',
    'Produce a strategic design direction. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "colorPsychology": "<short phrase 20-300 chars naming the color psychology direction (e.g. \'trust-innovation: deep navy anchor with warm coral accent for CTAs\') — this is the headline label, the rich detail goes in colorPaletteDirection>",',
    '  "typographyStyle": "<short phrase 10-200 chars naming the typography style direction (e.g. \'modern editorial sans-serif with serif display for hero gravitas\') — headline label only, rich detail in typographyDirection>",',
    '  "colorPaletteDirection": "<extended prose 80-5000 chars describing color usage strategy: anchor color and reasoning, accent strategy, neutral palette approach, contrast philosophy, dark vs light mode posture, and how the palette serves the brand voice and funnel goals>",',
    '  "typographyDirection": "<extended prose 80-5000 chars describing typography strategy: headline font character, body font character, weight strategy, scale ratio, line-height approach, mobile vs desktop sizing posture, and how typography serves the audience reading context>",',
    '  "componentSelectionDirection": "<extended prose 80-10000 chars describing which UI components belong on this page and which DO NOT: hero treatment, social proof component choice, feature presentation pattern, pricing display approach, CTA button strategy, footer scope. Reference each section in the sections list with explicit per-section guidance — this field scales with section count>",',
    '  "layoutDirection": "<prose 50-5000 chars describing layout strategy: F-pattern vs Z-pattern vs centered hero, visual hierarchy rules, white space philosophy, fold management, scroll depth strategy>",',
    '  "responsiveDirection": "<prose 50-5000 chars describing responsive strategy: mobile-first vs desktop-first decision, breakpoint posture, what stacks vs what hides on mobile, touch target size norms, mobile-only treatments>",',
    '  "accessibilityDirection": "<prose 50-5000 chars describing accessibility strategy: WCAG AA contrast targets, focus state treatment, semantic structure approach, motion-reduction respect, form labeling discipline, screen-reader narrative>",',
    '  "designPrinciples": ["<3 to 6 short declarative design principles unique to this brief — each 10 to 800 chars — these are the rules every design decision will be measured against>"],',
    '  "keyDesignDecisions": ["<2 to 5 specific high-stakes design decisions made for this brief — each 15 to 1000 chars — each one is a real decision with a real trade-off, not a generic statement>"],',
    '  "rationale": "<full strategic rationale tying color + typography + layout + components + responsive + accessibility together into a coherent design strategy that could only fit THIS brief — 150 to 6000 chars>"',
    '}',
    '',
    'Hard rules you MUST follow:',
    '- colorPsychology MUST be a short phrase (20-300 chars), NOT a full paragraph. The headline label only. Rich detail goes in colorPaletteDirection.',
    '- typographyStyle MUST be a short phrase (10-200 chars), NOT a full paragraph. The headline label only. Rich detail goes in typographyDirection.',
    '- The colorPaletteDirection MUST anchor on the caller-provided toneOfVoice and the Brand DNA tone of voice — not on generic industry defaults. If the caller said "warm and conversational" and Brand DNA says "professional but approachable," reconcile both into a single coherent palette direction.',
    '- The typographyDirection MUST consider both the audience reading context (mobile-first scrolling vs desk-bound research vs print-heritage editorial) AND the brand voice. Sans-serif is not always right.',
    '- componentSelectionDirection MUST reference the section list when provided. Each section in the sections array deserves explicit guidance on which component pattern serves it best.',
    '- designPrinciples MUST be specific to THIS brief, not generic UX commandments. "Hick\'s Law applies" is generic. "Pricing page collapses to 2 plans not 4 because the audience is decision-fatigued from agency comparison" is specific.',
    '- keyDesignDecisions MUST name real trade-offs. For example: "Going with a single anchor color (not a multi-hue brand palette) because the audience associates color riot with consumer apps and we are selling to enterprise." Each decision must have stakes.',
    '- accessibilityDirection MUST commit to WCAG AA as the floor and describe specific tactics for THIS brief — never just "follow accessibility best practices."',
    '- Do NOT invent specific hex codes, RGB values, or font family names. You are picking the direction; the Builder layer picks the actual tokens. Use descriptive language: "a deep navy anchor", "a warm coral accent", "an editorial serif for the hero".',
    '- Do NOT invent metrics or performance predictions. The rationale is strategic reasoning, not performance forecasts.',
    '- If brandDNA.avoidPhrases contains a phrase, do NOT use it anywhere in the output.',
    '- If brandDNA.keyPhrases are provided, weave at least one naturally into the rationale or principles.',
    '- The rationale MUST explicitly tie color + typography + layout + components + responsive + accessibility together into a coherent design strategy that could only fit THIS client and THIS brief. Generic design strategies are a failure.',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences. No preamble.',
  ];

  return sections.join('\n');
}

async function executeDesignPage(
  req: DesignPageRequest,
  ctx: LlmCallContext,
): Promise<DesignPageResult> {
  const userPrompt = buildDesignPageUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `UX/UI Specialist output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = DesignPageResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`UX/UI Specialist output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// UX/UI SPECIALIST CLASS
// ============================================================================

export class UXUISpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'UX/UI Specialist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['UX/UI Specialist: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['UX/UI Specialist: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `UX/UI Specialist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[UXUISpecialist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = DesignPageRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `UX/UI Specialist design_page: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);

      const data = await executeDesignPage(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[UXUISpecialist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 440, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createUXUISpecialist(): UXUISpecialist {
  return new UXUISpecialist();
}

let instance: UXUISpecialist | null = null;

export function getUXUISpecialist(): UXUISpecialist {
  instance ??= createUXUISpecialist();
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
  buildDesignPageUserPrompt,
  stripJsonFences,
  DesignPageRequestSchema,
  DesignPageResultSchema,
};
