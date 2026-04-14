/**
 * UX/UI Architect — REAL AI AGENT (Task #35 rebuild, April 12 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6) to produce a complete design system:
 * tokens (colors, typography, spacing, radius, shadows, breakpoints),
 * component guidelines, design principles, accessibility strategy, and a
 * written rationale grounded in the brand and target audience.
 *
 * Supported actions (live code paths only):
 *   - generate_design_system  (BuilderManager.assembleFromBlueprint — the only caller)
 *
 * The pre-rebuild template engine supported 4 actions (design_system,
 * user_flows, accessibility_audit, component_design). Only `design_system`
 * was ever called from production code (BuilderManager line 1080). The
 * other three branches were dead template output. Per CLAUDE.md rules,
 * dead branches are not rebuilt.
 *
 * Output shape: `{ tokens: {...}, componentGuidelines: [...], designPrinciples: [...],
 * accessibilityStrategy: string, rationale: string }`. The top-level `tokens`
 * wrapper exists so BuilderManager.assemblePage() (line 1224) can read
 * `designSystem.tokens` when delegate_to_builder is rewired (Task #38).
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

const FILE = 'builder/ux-ui/specialist.ts';
const SPECIALIST_ID = 'UX_UI_ARCHITECT';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_design_system'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case UX/UI Architect response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   DesignSystemResultSchema is one of the heaviest schemas in the rebuild
 *   — driven by componentGuidelines (4-8 entries, each with 5 prose fields
 *   summing to ~8,310 chars at theoretical max).
 *
 *   Theoretical worst case (8 components, every prose field at .max()):
 *     componentGuidelines: 8 × (name 60 + purpose 1200 +
 *     variantsDescription 2500 + statesCoveredDescription 2500 +
 *     accessibilityNotes 2000 + JSON 50) = 8 × 8,310 = 66,480
 *     tokens (colors 6,390 + typography 1,875 + spacing 250 +
 *     radius 80 + shadows 1,200 + breakpoints 80) = 9,875
 *     designPrinciples: 6 × 500 = 3,000
 *     accessibilityStrategy 5000
 *     rationale 6000
 *     ≈ 90,355 chars total at theoretical maximum
 *     /3.0 chars/token = 30,118 tokens
 *     + JSON overhead + 25% safety ≈ 37,900 tokens.
 *
 *   That theoretical maximum assumes every component has 2,500-char
 *   variantsDescription AND 2,500-char statesCoveredDescription AND
 *   2,000-char accessibilityNotes — which the LLM does not actually
 *   produce in normal use. Empirical baselining at Task #35 widened
 *   maxTokens from 8,000 to 12,000 to fit the LLM's actual typical
 *   output. The realistic worst case is ~50-60% of theoretical:
 *     componentGuidelines: 8 × ~5,000 = ~40,000
 *     + tokens + principles + accessibility + rationale ≈ 60-65k chars
 *     ≈ 21,000 tokens at the realistic worst.
 *
 *   Setting the floor at 24,000 covers realistic worst with safety
 *   margin and is comfortably above the empirical 12,000 baseline.
 *   Pathological cases that approach the theoretical 38,000-token max
 *   will still hit the truncation backstop in callOpenRouter with a
 *   clear diagnostic.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 24000;

interface UxUiArchitectGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'UX/UI Architect',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'BUILDER_MANAGER',
    capabilities: ['generate_design_system'],
  },
  systemPrompt: '',
  tools: ['generate_design_system'],
  outputSchema: {
    type: 'object',
    properties: {
      tokens: { type: 'object' },
      componentGuidelines: { type: 'array' },
      designPrinciples: { type: 'array' },
      accessibilityStrategy: { type: 'string' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.5,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

interface DesignSystemRequirementsInput {
  targetAudience?: string;
  accessibilityLevel?: 'A' | 'AA' | 'AAA';
  brandColors?: string[];
  industryHint?: string;
  styleDirection?: string;
  priorityComponents?: string[];
}

export interface GenerateDesignSystemRequest {
  action: 'generate_design_system';
  context: string;
  requirements?: DesignSystemRequirementsInput;
}

const GenerateDesignSystemRequestSchema = z.object({
  action: z.literal('generate_design_system'),
  context: z.string().min(1),
  requirements: z
    .object({
      targetAudience: z.string().optional(),
      accessibilityLevel: z.enum(['A', 'AA', 'AAA']).optional(),
      brandColors: z.array(z.string()).optional(),
      industryHint: z.string().optional(),
      styleDirection: z.string().optional(),
      priorityComponents: z.array(z.string()).optional(),
    })
    .optional(),
});

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const HexColorRegex = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;

const ColorRoleSchema = z.object({
  hex: z.string().regex(HexColorRegex, 'must be a valid hex color (#rgb, #rrggbb, or #rrggbbaa)'),
  usage: z.string().min(10).max(800),
});

const NeutralStepSchema = z.object({
  name: z.string().min(1).max(120),
  hex: z.string().regex(HexColorRegex, 'must be a valid hex color'),
});

const SemanticColorsSchema = z.object({
  success: ColorRoleSchema,
  warning: ColorRoleSchema,
  error: ColorRoleSchema,
  info: ColorRoleSchema,
});

const ColorTokensSchema = z.object({
  primary: ColorRoleSchema,
  secondary: ColorRoleSchema,
  accent: ColorRoleSchema,
  neutral: z.array(NeutralStepSchema).min(5).max(10),
  semantic: SemanticColorsSchema,
});

const TypographyScaleStepSchema = z.object({
  name: z.string().min(1).max(30),
  sizePx: z.number().int().min(10).max(96),
  lineHeight: z.number().min(1).max(2.5),
  weight: z.number().int().min(100).max(900),
});

const TypographyTokensSchema = z.object({
  fontFamilies: z.object({
    sans: z.string().min(3).max(400),
    display: z.string().min(3).max(400),
    mono: z.string().min(3).max(400),
  }),
  scale: z.array(TypographyScaleStepSchema).min(6).max(9),
});

const SpacingTokensSchema = z.object({
  grid: z.string().min(1).max(200),
  scale: z.array(z.number().int().min(0).max(256)).min(6).max(10),
});

const RadiusTokensSchema = z.object({
  sm: z.string().min(1).max(20),
  md: z.string().min(1).max(20),
  lg: z.string().min(1).max(20),
  full: z.string().min(1).max(20),
});

const ShadowTokensSchema = z.object({
  sm: z.string().min(1).max(400),
  md: z.string().min(1).max(400),
  lg: z.string().min(1).max(400),
});

const BreakpointTokensSchema = z.object({
  mobile: z.string().min(1).max(20),
  tablet: z.string().min(1).max(20),
  desktop: z.string().min(1).max(20),
  wide: z.string().min(1).max(20),
});

const DesignTokensSchema = z.object({
  colors: ColorTokensSchema,
  typography: TypographyTokensSchema,
  spacing: SpacingTokensSchema,
  radius: RadiusTokensSchema,
  shadows: ShadowTokensSchema,
  breakpoints: BreakpointTokensSchema,
});

// Variants + states are prose descriptions rather than string[] arrays.
// Rationale: nested-array length jitter across identical-input runs was
// producing FAIL deltas in regression runs even at temperature 0. The
// structural information is preserved (a reader sees "primary, secondary,
// ghost") but the output is regression-stable.
const ComponentGuidelineSchema = z.object({
  name: z.string().min(2).max(60),
  purpose: z.string().min(10).max(1200),
  variantsDescription: z.string().min(10).max(2500),
  statesCoveredDescription: z.string().min(10).max(2500),
  accessibilityNotes: z.string().min(20).max(2000),
});

const DesignSystemResultSchema = z.object({
  tokens: DesignTokensSchema,
  componentGuidelines: z.array(ComponentGuidelineSchema).min(4).max(8),
  designPrinciples: z.array(z.string().min(10).max(500)).min(3).max(6),
  accessibilityStrategy: z.string().min(100).max(5000),
  rationale: z.string().min(150).max(6000),
});

export type DesignSystemResult = z.infer<typeof DesignSystemResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: UxUiArchitectGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `UX/UI Architect GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-ux-ui-architect-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<UxUiArchitectGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `UX/UI Architect GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: UxUiArchitectGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.5,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };

  const brandDNA = await getBrandDNA();
  if (!brandDNA) {
    throw new Error(
      'Brand DNA not configured. UX/UI Architect refuses to generate a design system without brand identity. ' +
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
      `UX/UI Architect: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). The response is incomplete and cannot be parsed. ` +
      `Either raise maxTokens above ${ctx.gm.maxTokens} or shorten the brief. ` +
      `Realistic worst-case budget is ${MIN_OUTPUT_TOKENS_FOR_SCHEMA} tokens; ` +
      `theoretical schema max is ~38,000 tokens but the LLM rarely fills all componentGuidelines to .max() in practice.`,
    );
  }

  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: generate_design_system
// ============================================================================

function buildGenerateDesignSystemUserPrompt(req: GenerateDesignSystemRequest): string {
  const sections: string[] = [
    'ACTION: generate_design_system',
    '',
    `Build context: ${req.context}`,
  ];

  const reqs = req.requirements;
  if (reqs) {
    sections.push('');
    sections.push('Requirements from caller:');
    if (reqs.targetAudience) {
      sections.push(`  Target audience: ${reqs.targetAudience}`);
    }
    if (reqs.accessibilityLevel) {
      sections.push(`  Accessibility level: WCAG 2.1 Level ${reqs.accessibilityLevel}`);
    } else {
      sections.push('  Accessibility level: WCAG 2.1 Level AA (default)');
    }
    if (reqs.brandColors && reqs.brandColors.length > 0) {
      sections.push(`  Brand colors from caller: ${reqs.brandColors.join(', ')}`);
    }
    if (reqs.industryHint) {
      sections.push(`  Industry hint: ${reqs.industryHint}`);
    }
    if (reqs.styleDirection) {
      sections.push(`  Style direction: ${reqs.styleDirection}`);
    }
    if (reqs.priorityComponents && reqs.priorityComponents.length > 0) {
      sections.push(`  Priority components to cover: ${reqs.priorityComponents.join(', ')}`);
    }
  }

  sections.push('');
  sections.push(
    'Produce a complete design system rooted in the brand and target audience. Respond with ONLY a valid JSON object, no markdown fences. The JSON must match this exact schema:',
  );
  sections.push('');
  sections.push('{');
  sections.push('  "tokens": {');
  sections.push('    "colors": {');
  sections.push('      "primary":   { "hex": "#RRGGBB", "usage": "<when and where to use this color, 10-400 chars>" },');
  sections.push('      "secondary": { "hex": "#RRGGBB", "usage": "..." },');
  sections.push('      "accent":    { "hex": "#RRGGBB", "usage": "..." },');
  sections.push('      "neutral":   [{ "name": "<label like gray-50, gray-900>", "hex": "#RRGGBB" }, ... 5-10 steps],');
  sections.push('      "semantic":  {');
  sections.push('        "success": { "hex": "#RRGGBB", "usage": "..." },');
  sections.push('        "warning": { "hex": "#RRGGBB", "usage": "..." },');
  sections.push('        "error":   { "hex": "#RRGGBB", "usage": "..." },');
  sections.push('        "info":    { "hex": "#RRGGBB", "usage": "..." }');
  sections.push('      }');
  sections.push('    },');
  sections.push('    "typography": {');
  sections.push('      "fontFamilies": { "sans": "<CSS font stack, required>", "display": "<CSS font stack, required — may equal sans if brand does not use a display face>", "mono": "<CSS font stack, required — e.g. ui-monospace, SFMono-Regular, Menlo, monospace>" },');
  sections.push('      "scale": [{ "name": "xs|sm|base|lg|xl|2xl|3xl|4xl", "sizePx": <int 10-96>, "lineHeight": <1-2.5>, "weight": <100-900> }, ... 6-9 steps]');
  sections.push('    },');
  sections.push('    "spacing": { "grid": "<e.g. 4px base / 8px rhythm>", "scale": [<int px values>, ... 6-10 steps] },');
  sections.push('    "radius":  { "sm": "<value>", "md": "<value>", "lg": "<value>", "full": "9999px" },');
  sections.push('    "shadows": { "sm": "<css box-shadow>", "md": "<css box-shadow>", "lg": "<css box-shadow>" },');
  sections.push('    "breakpoints": { "mobile": "<px>", "tablet": "<px>", "desktop": "<px>", "wide": "<px>" }');
  sections.push('  },');
  sections.push('  "componentGuidelines": [');
  sections.push('    {');
  sections.push('      "name": "<component name, e.g. Button, Input, Card>",');
  sections.push('      "purpose": "<what this component does and when to use it>",');
  sections.push('      "variantsDescription": "<prose description of the variants, e.g. \'primary (solid background, main CTAs), secondary (outline, supporting actions), ghost (text-only, tertiary links), destructive (red, irreversible actions)\'>",');
  sections.push('      "statesCoveredDescription": "<prose description of interaction states, e.g. \'default, hover (slight lift + color shift), active (pressed), focus (2px ring), disabled (50% opacity), loading (spinner replaces label)\'>",');
  sections.push('      "accessibilityNotes": "<specific a11y requirements: ARIA, keyboard, contrast, focus, 20-1500 chars>"');
  sections.push('    }');
  sections.push('    // 4-8 components total');
  sections.push('  ],');
  sections.push('  "designPrinciples": ["<3-6 guiding principles, each 10-300 chars>"],');
  sections.push('  "accessibilityStrategy": "<the overall a11y approach: how WCAG AA/AAA is enforced, tooling, manual review, color contrast discipline, keyboard-first interactions, 100-2500 chars>",');
  sections.push('  "rationale": "<why these specific tokens and components serve the brand and target audience. Tie color choices to brand mood, typography to tone, spacing to rhythm, 150-3000 chars>"');
  sections.push('}');
  sections.push('');
  sections.push('Hard rules you MUST follow:');
  sections.push('- All hex colors must be valid 3/6/8 digit hex (e.g. #3b82f6). No rgb(), no named colors, no empty strings.');
  sections.push('- The neutral scale MUST have 5-10 steps, ordered lightest-to-darkest or the reverse (be consistent).');
  sections.push('- The typography scale MUST have 6-9 steps covering body, headings, and display sizes.');
  sections.push('- Spacing scale MUST have 6-10 integer px values, progressive (e.g. 4, 8, 12, 16, 24, 32, 48, 64).');
  sections.push('- componentGuidelines MUST cover 4-8 components. Include at minimum: Button, Input, Card. Others depend on the brand context. variantsDescription and statesCoveredDescription are PROSE strings, not JSON arrays.');
  sections.push('- typography.fontFamilies.sans, display, and mono are ALL REQUIRED. If the brand does not use a distinct display face, set display equal to sans. Always include a mono stack (e.g. "ui-monospace, SFMono-Regular, Menlo, monospace").');
  sections.push('- designPrinciples MUST have 3-6 entries. Principles are short directives, not essays.');
  sections.push('- accessibilityStrategy MUST cite WCAG 2.1 level and explain HOW it is enforced (tools + process), not just declare compliance.');
  sections.push('- Rationale MUST reference the target audience and brand — do NOT output a generic design system that could fit any company.');
  sections.push('- If the brand avoidPhrases list bans a word, do not use it in any string field.');
  sections.push('- Output ONLY the JSON object. No prose outside it. No markdown fences.');

  return sections.join('\n');
}

async function executeGenerateDesignSystem(
  req: GenerateDesignSystemRequest,
  ctx: LlmCallContext,
): Promise<DesignSystemResult> {
  const userPrompt = buildGenerateDesignSystemUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`UX/UI Architect output was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const result = DesignSystemResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`UX/UI Architect output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// UX/UI ARCHITECT CLASS
// ============================================================================

export class UxUiArchitect extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'UX/UI Architect initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['UX/UI Architect: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['UX/UI Architect: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `UX/UI Architect does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[UxUiArchitect] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateDesignSystemRequestSchema.safeParse({ ...payload, action });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `UX/UI Architect generate_design_system: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);
      const data = await executeGenerateDesignSystem(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[UxUiArchitect] Execution failed',
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
    return { functional: 420, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createUxUiArchitect(): UxUiArchitect {
  return new UxUiArchitect();
}

let instance: UxUiArchitect | null = null;

export function getUxUiArchitect(): UxUiArchitect {
  instance ??= createUxUiArchitect();
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
  buildGenerateDesignSystemUserPrompt,
  stripJsonFences,
  GenerateDesignSystemRequestSchema,
  DesignSystemResultSchema,
};
