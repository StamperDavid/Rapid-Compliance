/**
 * Hedra Specialist — REAL AI AGENT (June 9 2026).
 *
 * The system-wide GENERATION GATEWAY and Hedra expert. Where the Video Specialist
 * is the director (it decides the creative — scenes, arc, what's in each shot), the
 * Hedra Specialist is the operator: given a creative intent + the operator's actual
 * materials (character art, a person to clone, an environment photo, audio), it
 * reasons over Hedra's LIVE model catalog, picks the right model, maps each material
 * to the right input (start frame / reference / audio), sets the controls, and drives
 * the generation through the generalized Hedra driver.
 *
 * Standing Rule #1: loads its Golden Master from Firestore at runtime (Brand DNA baked
 * in at seed time) and uses gm.systemPrompt verbatim — no runtime Brand DNA loading.
 * No template fallbacks: if the GM is missing, the LLM fails, JSON won't parse, the
 * plan fails Zod, or the chosen model doesn't exist, it returns an honest FAILED report.
 *
 * Supported actions (live code paths only):
 *   - generate_media  (plan the optimal Hedra generation for an intent + materials,
 *                      then submit it via the driver and return the generation id)
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import {
  getHedraCatalog,
  getModelBySlug,
  describeModel,
  type HedraModel,
} from '@/lib/video/hedra-capability-service';
import { generateWithHedra } from '@/lib/video/hedra-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'content/hedra/specialist.ts';
const SPECIALIST_ID = 'HEDRA_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['generate_media'] as const;

/** The plan output is small (one model choice + role mapping + reasoning). */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 4000;

interface HedraSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Hedra Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['generate_media'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['generate_media'],
  outputSchema: {
    type: 'object',
    properties: {
      generationId: { type: 'string' },
      modelSlug: { type: 'string' },
      reasoning: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.4,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const MATERIAL_KINDS = ['image', 'video', 'audio'] as const;

/** One material the operator supplied, with what we understood it to be. */
const MaterialSchema = z.object({
  url: z.string().url(),
  kind: z.enum(MATERIAL_KINDS),
  /** What this material is (the vision/transcript read), so the LLM maps it correctly. */
  description: z.string().optional(),
  /** Optional hint about its role: 'character' | 'person' | 'environment' | 'style' | 'voice'. */
  roleHint: z.string().optional(),
});

export type GenerationMaterial = z.infer<typeof MaterialSchema>;

const GenerateMediaRequestSchema = z.object({
  action: z.literal('generate_media'),
  /** What to make, in plain language (the creative intent / shot description). */
  intent: z.string().min(1),
  /** 'video' (default) or 'image'. */
  outputType: z.enum(['video', 'image']).optional(),
  /** The operator's actual materials — character art, a person, an environment, audio. */
  materials: z.array(MaterialSchema).default([]),
  /** Optional voiceover script (drives inline TTS for talking-character models). */
  speechText: z.string().optional(),
  aspectRatio: z.string().optional(),
  durationSeconds: z.number().min(1).max(60).optional(),
});

export type GenerateMediaRequest = z.infer<typeof GenerateMediaRequestSchema>;

// ============================================================================
// OUTPUT CONTRACT — the generation PLAN the LLM returns (Zod-enforced)
// ============================================================================

const GenerationPlanSchema = z.object({
  /** EXACT model slug from the candidate list (e.g. fal/omnihuman-15-i2v). */
  modelSlug: z.string().min(1),
  type: z.enum(['video', 'image']),
  /** The prompt for the model — concrete, brand-aligned, describing the desired result. */
  textPrompt: z.string().min(1),
  /** Which material URL is the start/primary frame (the character/person/environment). */
  startFrameUrl: z.string().url().nullable().optional(),
  /** Which material URL is the end frame (for start→end transition models). */
  endFrameUrl: z.string().url().nullable().optional(),
  /** Additional reference image URLs for character/style consistency. */
  referenceImageUrls: z.array(z.string().url()).optional(),
  /** Which material URL is the driving audio (lip-sync / motion). */
  audioUrl: z.string().url().nullable().optional(),
  /** Whether to synthesize speech inline (uses speechText) instead of an audio file. */
  useInlineTts: z.boolean().optional(),
  resolution: z.string().nullable().optional(),
  aspectRatio: z.string().nullable().optional(),
  durationMs: z.number().int().positive().nullable().optional(),
  /** Why this model + these inputs — the Specialist's expert justification. */
  reasoning: z.string().min(1),
});

export type GenerationPlan = z.infer<typeof GenerationPlanSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: HedraSpecialistGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Hedra Specialist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-hedra-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<HedraSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Hedra Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const effectiveMaxTokens = Math.max(config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA, MIN_OUTPUT_TOKENS_FOR_SCHEMA);
  const gm: HedraSpecialistGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.4,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  return { gm, resolvedSystemPrompt: gm.systemPrompt };
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
      `Hedra Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} (finish_reason='length').`,
    );
  }
  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// ACTION: generate_media
// ============================================================================

/**
 * Build the candidate-model list for the prompt. We surface the relevant slice of
 * the live catalog (by output type) so the Specialist reasons over CURRENT models —
 * never a stale hardcoded list — while keeping the prompt focused.
 */
function buildCandidateBlock(catalog: HedraModel[], outputType: 'video' | 'image'): string {
  const candidates = catalog.filter((m) => m.type === outputType);
  return candidates.map((m) => `- ${describeModel(m)}`).join('\n');
}

function buildGenerateMediaUserPrompt(req: GenerateMediaRequest, candidateBlock: string): string {
  const outputType = req.outputType ?? 'video';
  const materialsBlock = req.materials.length > 0
    ? req.materials
        .map((m, i) => `  [${i}] ${m.kind.toUpperCase()} ${m.roleHint ? `(role: ${m.roleHint})` : ''}\n      url: ${m.url}\n      what it is: ${m.description ?? '(no description)'}`)
        .join('\n')
    : '  (none provided)';

  return [
    'ACTION: generate_media',
    '',
    'You are choosing the single best Hedra model and mapping the operator\'s materials to its inputs.',
    '',
    `OUTPUT TYPE: ${outputType}`,
    `INTENT: ${req.intent}`,
    req.speechText ? `VOICEOVER SCRIPT (for talking-character models / inline TTS): ${req.speechText}` : 'VOICEOVER SCRIPT: (none)',
    req.aspectRatio ? `REQUESTED ASPECT RATIO: ${req.aspectRatio}` : '',
    req.durationSeconds ? `REQUESTED DURATION: ${req.durationSeconds}s` : '',
    '',
    'OPERATOR MATERIALS (use the EXACT url when you assign one to an input):',
    materialsBlock,
    '',
    `AVAILABLE HEDRA MODELS (${outputType}) — pick ONE by its exact slug:`,
    candidateBlock,
    '',
    'How to choose:',
    '- Full-body clone of a REAL person talking/presenting → an audio-driven character model (e.g. omnihuman / character-3); put the person image as startFrameUrl and drive it with audio (audioUrl) or inline TTS (useInlineTts + the voiceover script).',
    '- Animate / re-pose an existing CHARACTER (cartoon, mascot) from its art → an image-to-video character model with motion; put the character art as startFrameUrl, add other angles as referenceImageUrls.',
    '- Place a character/clone in a SPECIFIC uploaded environment → use the environment image as startFrameUrl (or a reference) and describe the placement in textPrompt.',
    '- Match the model\'s declared needs: if it "needs start-frame image" you MUST supply startFrameUrl; if it "needs audio" you MUST supply audioUrl or useInlineTts; never exceed its reference-image limit; pick an aspect ratio the model supports.',
    '- NEVER reinvent the operator\'s characters from text — always anchor to their actual material via startFrameUrl / referenceImageUrls.',
    '',
    'Respond with ONLY a valid JSON object (no markdown, no preamble) matching this schema:',
    '{',
    '  "modelSlug": "exact slug from the list above",',
    '  "type": "video | image",',
    '  "textPrompt": "concrete, brand-aligned prompt describing the desired result and action",',
    '  "startFrameUrl": "<one of the material urls> or null",',
    '  "endFrameUrl": "<a material url> or null",',
    '  "referenceImageUrls": ["<material urls>"] ,',
    '  "audioUrl": "<an audio material url> or null",',
    '  "useInlineTts": true | false,',
    '  "resolution": "<a resolution the model supports> or null",',
    '  "aspectRatio": "<an aspect ratio the model supports> or null",',
    '  "durationMs": <integer ms within the model max> or null,',
    '  "reasoning": "why this model + these input assignments"',
    '}',
    '',
    'Hard rules:',
    '- modelSlug MUST be one of the exact slugs listed above.',
    '- Any url you assign MUST be copied verbatim from the OPERATOR MATERIALS list.',
    '- Output ONLY the JSON object.',
  ].filter((line) => line !== '').join('\n');
}

interface GenerateMediaResult {
  generationId: string;
  modelSlug: string;
  modelId: string;
  reasoning: string;
  plan: GenerationPlan;
}

async function executeGenerateMedia(req: GenerateMediaRequest, ctx: LlmCallContext): Promise<GenerateMediaResult> {
  const outputType = req.outputType ?? 'video';
  const catalog = await getHedraCatalog();
  const candidateBlock = buildCandidateBlock(catalog, outputType);
  if (candidateBlock.length === 0) {
    throw new Error(`Hedra Specialist: no ${outputType} models available in the live catalog.`);
  }

  const userPrompt = buildGenerateMediaUserPrompt(req, candidateBlock);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(`Hedra Specialist plan was not valid JSON: ${rawContent.slice(0, 200)}`);
  }

  const planResult = GenerationPlanSchema.safeParse(parsed);
  if (!planResult.success) {
    const issues = planResult.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Hedra Specialist plan did not match schema: ${issues}`);
  }
  const plan = planResult.data;

  // Resolve the chosen model against the live catalog — the LLM must pick a real one.
  const model = await getModelBySlug(plan.modelSlug);
  if (!model) {
    throw new Error(`Hedra Specialist chose an unknown model slug '${plan.modelSlug}'. It must be one from the live catalog.`);
  }

  // Drive the generation through the generalized driver.
  const generation = await generateWithHedra({
    modelId: model.id,
    type: plan.type,
    textPrompt: plan.textPrompt,
    startFrameUrl: plan.startFrameUrl ?? undefined,
    endFrameUrl: plan.endFrameUrl ?? undefined,
    referenceImageUrls: plan.referenceImageUrls,
    audioUrl: plan.audioUrl ?? undefined,
    tts: plan.useInlineTts && req.speechText
      ? { voiceId: 'default', text: req.speechText }
      : undefined,
    resolution: plan.resolution ?? undefined,
    aspectRatio: plan.aspectRatio ?? req.aspectRatio ?? undefined,
    durationMs: plan.durationMs ?? (req.durationSeconds ? req.durationSeconds * 1000 : undefined),
  });

  logger.info('[HedraSpecialist] generation submitted', {
    modelSlug: plan.modelSlug,
    generationId: generation.generationId,
    file: FILE,
  });

  return {
    generationId: generation.generationId,
    modelSlug: plan.modelSlug,
    modelId: model.id,
    reasoning: plan.reasoning,
    plan,
  };
}

// ============================================================================
// HEDRA SPECIALIST CLASS
// ============================================================================

export class HedraSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Hedra Specialist initialized (LLM-backed, live Hedra catalog, Golden Master at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;
    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Hedra Specialist: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Hedra Specialist: no action or method specified in payload']);
      }
      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Hedra Specialist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }

      logger.info(`[HedraSpecialist] Executing action=${rawAction} taskId=${taskId}`, { file: FILE });

      const inputValidation = GenerateMediaRequestSchema.safeParse({ ...payload, action: rawAction });
      if (!inputValidation.success) {
        const issues = inputValidation.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
        return this.createReport(taskId, 'FAILED', null, [`Hedra Specialist generate_media: invalid input: ${issues}`]);
      }

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
      const data = await executeGenerateMedia(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[HedraSpecialist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 260, boilerplate: 40 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createHedraSpecialist(): HedraSpecialist {
  return new HedraSpecialist();
}

let instance: HedraSpecialist | null = null;

export function getHedraSpecialist(): HedraSpecialist {
  instance ??= createHedraSpecialist();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  loadGMConfig,
  buildGenerateMediaUserPrompt,
  buildCandidateBlock,
  stripJsonFences,
  GenerationPlanSchema,
  GenerateMediaRequestSchema,
};
