/**
 * Prompt Engineer Specialist — Phase 3 manager rebuild, April 14, 2026
 *
 * The Prompt Engineer is a meta-specialist whose only job is to take a
 * human correction on another specialist's output and produce a SURGICAL
 * edit to that specialist's system prompt. It is the mechanism that
 * translates short, often-vague human grades ("too vague", "wrong tone",
 * "missing key phrases") into precise rewrites of the target specialist's
 * Golden Master system prompt — so the specialist learns from the grade
 * WITHOUT corrective instructions being stacked on top of each other.
 *
 * Why surgical: Every time a correction is appended as a new instruction,
 * the prompt becomes longer, more contradictory, and harder for the
 * specialist to follow. After 10 corrections, you have a prompt full of
 * conflicts. Surgical rewrites preserve coherence.
 *
 * Why this matters: This is the beating heart of the "no grades = no GM
 * changes" standing rule. Without the Prompt Engineer, grades either get
 * appended verbatim (bad — prompt drift) or ignored (worse — no learning).
 * With the Prompt Engineer, grades produce versioned prompt edits that a
 * human reviews and approves before deploy.
 *
 * Hard rules the Prompt Engineer follows:
 *   1. Never touch Brand DNA. Baked in at seed time from Settings.
 *   2. Never add new sections. Rewrite existing sections only.
 *   3. Never rewrite more than ONE section per edit. Surgical.
 *   4. Never lose the specialist's identity (opening paragraph sacred).
 *   5. Preserve formatting (## headings, bullets, etc.).
 *   6. Interpret intent, not literal words. Human says "too vague" →
 *      find WHICH section governs specificity and rewrite THAT section,
 *      not append "Do not be vague."
 *   7. If the correction conflicts with existing instructions, return a
 *      CLARIFICATION_NEEDED response instead of proposing an edit.
 *
 * Supported action (single):
 *   - propose_prompt_edit — read target specialist's current GM prompt
 *     + a human correction + the specific output that triggered it,
 *     produce either an EDIT_PROPOSED response (with before/after diff
 *     structure) or a CLARIFICATION_NEEDED response (with questions).
 *
 * Golden Master is REQUIRED (no fallback prompt) — this specialist's
 * output drives Firestore writes on approval, so it must never run
 * without an operator-configured Golden Master.
 *
 * Model: Claude Opus 4.6 — best reasoning for instruction editing per
 * the original Phase 2 spec in CONTINUATION_PROMPT.md. Low-frequency
 * usage so cost is negligible.
 *
 * @module agents/prompt-engineer/specialist
 */

import { z } from 'zod';
import { BaseSpecialist } from '../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'prompt-engineer/specialist.ts';
const SPECIALIST_ID = 'PROMPT_ENGINEER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['propose_prompt_edit'] as const;

/**
 * max_tokens floor for the Prompt Engineer's worst-case response.
 *
 * Derivation:
 *   EditProposedSchema worst case:
 *     currentText 4000 (up to 4000 chars of the target section)
 *     proposedText 4000
 *     rationale 2000
 *     conflictsWithOtherSections: 5 × 500 = 2500
 *     targetSection.reasoning 500
 *     targetSection.headingOrLocation 200
 *     ≈ 13,200 chars prose
 *     /3.0 chars/token = 4,400 tokens
 *     + JSON overhead ~150 tokens
 *     + 25% safety margin
 *     ≈ 5,688 tokens minimum
 *
 *   Setting floor at 6,500 tokens.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 6500;

interface PromptEngineerGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Prompt Engineer',
    role: 'standalone',
    status: 'FUNCTIONAL',
    reportsTo: null,
    capabilities: ['prompt_editing', 'correction_interpretation', 'surgical_rewrite'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['propose_prompt_edit'],
  outputSchema: {
    type: 'object',
    properties: {
      status: { type: 'string' },
      targetSection: { type: 'object' },
      currentText: { type: 'string' },
      proposedText: { type: 'string' },
      rationale: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.2,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const GradeEnum = z.enum(['reject', 'request_revision', 'approve_with_notes']);

const ProposePromptEditPayloadSchema = z.object({
  action: z.literal('propose_prompt_edit'),
  targetSpecialistId: z.string().min(1).max(100),
  targetSpecialistName: z.string().min(1).max(200),
  currentSystemPrompt: z.string().min(100).max(60000),
  correctedReportExcerpt: z.string().min(1).max(20000),
  humanCorrection: z.object({
    grade: GradeEnum,
    explanation: z.string().min(5).max(5000),
  }),
  priorVersionCount: z.number().int().min(0).max(1000),
});

export type ProposePromptEditPayload = z.infer<typeof ProposePromptEditPayloadSchema>;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const TargetSectionSchema = z.object({
  headingOrLocation: z.string().min(1).max(500),
  reasoning: z.string().min(20).max(1500),
});

const EditProposedSchema = z.object({
  status: z.literal('EDIT_PROPOSED'),
  targetSection: TargetSectionSchema,
  currentText: z.string().min(1).max(8000),
  proposedText: z.string().min(1).max(8000),
  rationale: z.string().min(30).max(3000),
  confidence: z.number().int().min(0).max(100),
  conflictsWithOtherSections: z.array(z.string().min(1).max(600)).max(10),
  preservesBrandDna: z.boolean(),
});

const ClarificationNeededSchema = z.object({
  status: z.literal('CLARIFICATION_NEEDED'),
  questions: z.array(z.string().min(5).max(1000)).min(1).max(5),
  conflictsDetected: z.array(z.string().min(1).max(800)).max(10),
  rationale: z.string().min(20).max(2000),
});

const ProposePromptEditResultSchema = z.discriminatedUnion('status', [
  EditProposedSchema,
  ClarificationNeededSchema,
]);

export type EditProposedResult = z.infer<typeof EditProposedSchema>;
export type ClarificationNeededResult = z.infer<typeof ClarificationNeededSchema>;
export type ProposePromptEditResult = z.infer<typeof ProposePromptEditResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: PromptEngineerGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Prompt Engineer GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-prompt-engineer-gm.js to seed. ` +
      `Prompt Engineer REQUIRES a Golden Master — no fallback prompt.`,
    );
  }

  const config = gmRecord.config as Partial<PromptEngineerGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Prompt Engineer GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: PromptEngineerGMConfig = {
    systemPrompt,
    // Default to Opus for best instruction-editing reasoning per CONTINUATION_PROMPT.md
    // spec. GM can override per-industry if needed.
    model: config.model ?? 'claude-opus-4.6',
    temperature: config.temperature ?? 0.2,
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

  if (response.finishReason === 'length') {
    throw new Error(
      `Prompt Engineer: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
      `(finish_reason='length'). Raise maxTokens above ${ctx.gm.maxTokens} or ` +
      `reduce the size of currentSystemPrompt sent to the specialist. ` +
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
// ACTION: propose_prompt_edit
// ============================================================================

function truncate(text: string, max: number): string {
  if (text.length <= max) { return text; }
  return `${text.slice(0, max)}...[truncated, ${text.length - max} more chars]`;
}

function buildProposePromptEditPrompt(req: ProposePromptEditPayload): string {
  return [
    'ACTION: propose_prompt_edit',
    '',
    `Target specialist: ${req.targetSpecialistName} (id=${req.targetSpecialistId})`,
    `Prior Golden Master versions for this specialist: ${req.priorVersionCount}`,
    '',
    '## The human grader said',
    `Grade: ${req.humanCorrection.grade}`,
    'Explanation:',
    truncate(req.humanCorrection.explanation, 4500),
    '',
    '## The specific specialist output the grader flagged',
    truncate(req.correctedReportExcerpt, 18000),
    '',
    '## The specialist\'s CURRENT Golden Master system prompt (in full)',
    '```',
    truncate(req.currentSystemPrompt, 55000),
    '```',
    '',
    '---',
    '',
    'Your task:',
    '1. Read the current system prompt carefully.',
    '2. Read the human correction and the flagged output excerpt.',
    '3. Identify WHICH section of the current prompt is most responsible for the behavior the grader flagged. Refer to the section by its ## heading (if one exists) or by a brief description of its location.',
    '4. Produce ONE of two responses:',
    '',
    '   **Option A — EDIT_PROPOSED** (when the correction is clear and you can produce a surgical rewrite):',
    '',
    '   ```json',
    '   {',
    '     "status": "EDIT_PROPOSED",',
    '     "targetSection": {',
    '       "headingOrLocation": "<the ## heading you are editing, or a clear location description>",',
    '       "reasoning": "<20-1500 chars — why this section is the root cause of the flagged behavior>"',
    '     },',
    '     "currentText": "<the exact text of that section, copied verbatim from the current system prompt>",',
    '     "proposedText": "<the rewritten section, same structural position and format, different content>",',
    '     "rationale": "<30-3000 chars — why this edit addresses the correction, referencing specific phrases from the human\'s explanation>",',
    '     "confidence": <integer 0-100 — how confident you are this edit will fix the behavior>,',
    '     "conflictsWithOtherSections": [<0-10 strings naming other sections that may now contradict this edit>],',
    '     "preservesBrandDna": true',
    '   }',
    '   ```',
    '',
    '   **Option B — CLARIFICATION_NEEDED** (when the correction is ambiguous or conflicts with existing instructions):',
    '',
    '   ```json',
    '   {',
    '     "status": "CLARIFICATION_NEEDED",',
    '     "questions": [<1-5 specific questions to ask the human>],',
    '     "conflictsDetected": [<0-10 strings naming existing instructions that conflict with the correction>],',
    '     "rationale": "<20-2000 chars — why you cannot propose a clean edit without clarification>"',
    '   }',
    '   ```',
    '',
    '## Hard rules',
    '- NEVER edit the Brand DNA block (the "## Brand DNA" section at the bottom of the prompt). Brand DNA is baked in at seed time from the Settings page — edits go through Settings, not through you. If the correction implies a Brand DNA change, return CLARIFICATION_NEEDED.',
    '- NEVER add a new section. Edit an existing section only. If none of the existing sections cover the correction topic, expand the most relevant existing section.',
    '- NEVER rewrite more than ONE section. Surgical, one thing at a time.',
    '- NEVER change the specialist\'s identity (opening paragraph) unless the correction explicitly asks for it.',
    '- PRESERVE formatting. Use the same ## headings, same bullet style, same heading hierarchy as the current prompt.',
    '- Interpret INTENT, not literal words. "Too vague" → rewrite the specificity rules. Don\'t append "Do not be vague."',
    '- preservesBrandDna must be true in every EDIT_PROPOSED response — if your edit would touch Brand DNA, return CLARIFICATION_NEEDED instead.',
    '- currentText must be copied VERBATIM from the current system prompt — do not paraphrase. The diff UI will reject a currentText that does not match exactly.',
    '- proposedText must be the SAME section rewritten — same responsibility, different wording.',
    '',
    'Respond with ONLY a valid JSON object. No markdown fences. No preamble. No prose outside the JSON.',
  ].join('\n');
}

async function executeProposePromptEdit(
  req: ProposePromptEditPayload,
  ctx: LlmCallContext,
): Promise<ProposePromptEditResult> {
  const userPrompt = buildProposePromptEditPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Prompt Engineer output was not valid JSON: ${rawContent.slice(0, 300)}`,
    );
  }

  const result = ProposePromptEditResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Prompt Engineer output did not match expected schema: ${issueSummary}`);
  }

  // Post-parse invariants: EDIT_PROPOSED currentText must be found verbatim in
  // the currentSystemPrompt. If the LLM hallucinated the section text, fail
  // loudly — the diff UI would silently reject a mismatched currentText anyway.
  const data = result.data;
  if (data.status === 'EDIT_PROPOSED') {
    if (!req.currentSystemPrompt.includes(data.currentText)) {
      throw new Error(
        `Prompt Engineer produced an EDIT_PROPOSED whose currentText does not appear verbatim in the target specialist's current system prompt. ` +
        `This means the LLM hallucinated or paraphrased the section — retry or escalate.`,
      );
    }
    if (!data.preservesBrandDna) {
      throw new Error(
        `Prompt Engineer produced an EDIT_PROPOSED with preservesBrandDna=false. Brand DNA edits must go through Settings, not through the Prompt Engineer. This is a hard rule violation.`,
      );
    }
  }

  return data;
}

// ============================================================================
// PROMPT ENGINEER CLASS
// ============================================================================

export class PromptEngineer extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Prompt Engineer initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Prompt Engineer: payload must be an object']);
      }

      const rawAction = payload.action;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Prompt Engineer: payload.action is required']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Prompt Engineer does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }

      const inputValidation = ProposePromptEditPayloadSchema.safeParse(payload);
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Prompt Engineer: invalid input payload: ${issueSummary}`,
        ]);
      }

      logger.info(
        `[PromptEngineer] Executing propose_prompt_edit taskId=${taskId} target=${inputValidation.data.targetSpecialistId}`,
        { file: FILE },
      );

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const result = await executeProposePromptEdit(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', result);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error(
        '[PromptEngineer] Execution failed',
        error instanceof Error ? error : new Error(errorMessage),
        { file: FILE },
      );
      return this.createReport(taskId, 'FAILED', null, [errorMessage]);
    }
  }

  async handleSignal(signal: Signal): Promise<AgentReport> {
    const message: AgentMessage = {
      id: signal.id,
      timestamp: signal.createdAt,
      from: signal.origin,
      to: this.identity.id,
      type: 'COMMAND',
      priority: 'NORMAL',
      payload: signal.payload.payload,
      requiresResponse: true,
      traceId: signal.id,
    };
    return this.execute(message);
  }

  generateReport(taskId: string, data: unknown): AgentReport {
    return this.createReport(taskId, 'COMPLETED', data);
  }

  hasRealLogic(): boolean {
    return true;
  }

  getFunctionalLOC(): { functional: number; boilerplate: number } {
    return { functional: 380, boilerplate: 60 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createPromptEngineer(): PromptEngineer {
  return new PromptEngineer();
}

let instance: PromptEngineer | null = null;

export function getPromptEngineer(): PromptEngineer {
  instance ??= createPromptEngineer();
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
  stripJsonFences,
  buildProposePromptEditPrompt,
  executeProposePromptEdit,
  ProposePromptEditPayloadSchema,
  ProposePromptEditResultSchema,
  EditProposedSchema,
  ClarificationNeededSchema,
};
