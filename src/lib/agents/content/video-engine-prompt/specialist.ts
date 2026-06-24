/**
 * Video Engine Prompt Specialist — REAL AI AGENT (June 21 2026).
 *
 * The LAST MILE before a clip is rendered. Other agents own the story (Screenwriter/
 * Director) and the production design (Shot Plan Planner); THIS agent owns the
 * engine-facing translation: given one shot's full intent, it (1) PICKS the best
 * generation engine/model for that shot, and (2) writes the prompt tuned to that
 * engine's idioms — so fal/Seedance (and any future engine) get the prompt in the
 * best possible way. It replaces the old static prompt mapper.
 *
 * It is engine-aware, not engine-named: it routes to whatever model fits the shot
 * (text-to-video, image-to-video continuation, reference-to-video with a cast),
 * and it is given LARGE, detailed shot intent — every captured cinematic field —
 * which it must distill into a clean, front-loaded, engine-optimal prompt without
 * dropping the meaningful detail.
 *
 * Standing Rule #1: loads its Golden Master from Firestore at runtime (Brand DNA
 * baked in at seed time) and uses `gm.systemPrompt` VERBATIM — no runtime Brand DNA
 * loading, no getBrandDNA() here. Standing Rule #2: it never edits its own GM.
 *
 * Model: Opus tier (the most demanding reasoning task — per-engine prompt craft).
 * The actual model is read from the GM config; the fallback below is the top-tier
 * Opus model the codebase exposes.
 */

import { z } from 'zod';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'content/video-engine-prompt/specialist.ts';
const SPECIALIST_ID = 'VIDEO_ENGINE_PROMPT_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

/** Engine prompts are compact, but the input intent is large — give headroom. */
const MIN_OUTPUT_TOKENS = 4000;

/**
 * Top-tier Opus fallback. The real model is read from the GM config (seeded by
 * scripts/seed-video-engine-prompt-specialist-gm.js); this is only used if the GM
 * omits it. `claude-opus-4.6` is the highest Opus the ModelName union exposes.
 */
const DEFAULT_MODEL: ModelName = 'claude-opus-4.6';

interface EnginePromptGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
}

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const GenerateEnginePromptInputSchema = z.object({
  /** The shot's full intent — every captured cinematic detail (action, framing,
   *  lens, lighting, look bible, mood, blocking, etc.). May be large; the agent
   *  distills it. */
  shotIntent: z.string().trim().min(1),
  /** Whether identity-anchor reference images of the cast will be supplied to the
   *  engine (enables reference-to-video so characters stay recognizable). */
  hasCharacterReferences: z.boolean().optional(),
  /** Whether a continuation frame (the prior shot's last frame) will be supplied
   *  (enables image-to-video chaining for a seamless "continue" shot). */
  hasContinuationFrame: z.boolean().optional(),
  /** Target aspect ratio, e.g. "16:9", "9:16". */
  aspectRatio: z.string().trim().max(20).optional(),
  /** Intended clip duration in seconds. */
  durationSec: z.number().min(0).max(600).optional(),
  /** Whether this shot carries spoken dialogue (lip-sync consideration). */
  hasDialogue: z.boolean().optional(),
  /** Optional explicit roster of candidate engines/models to choose from. When
   *  omitted, the agent chooses from the engines it knows (per its GM). */
  candidateEngines: z.array(z.string().trim().min(1)).max(40).optional(),
});

export type GenerateEnginePromptInput = z.infer<typeof GenerateEnginePromptInputSchema>;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

const GENERATION_TYPES = ['text-to-video', 'image-to-video', 'reference-to-video'] as const;

export const EnginePromptResultSchema = z.object({
  /** The chosen engine / model id (e.g. a fal/Seedance model). */
  engine: z.string().trim().min(1).max(200),
  /** How the engine is driven for this shot. */
  generationType: z.enum(GENERATION_TYPES),
  /** The engine-optimized POSITIVE prompt — front-loaded action, concrete, tuned
   *  to the chosen engine's idioms; carries the meaningful captured detail. */
  prompt: z.string().trim().min(1).max(8000),
  /** Optional engine negative prompt (what to avoid). */
  negativePrompt: z.string().trim().max(2000).optional(),
  /** Optional motion / camera-dynamics directive in the engine's phrasing. */
  motion: z.string().trim().max(1000).optional(),
  /** Short rationale: why this engine + how the prompt was tuned (for the operator). */
  rationale: z.string().trim().max(2000).optional(),
});

export type EnginePromptResult = z.infer<typeof EnginePromptResultSchema>;

// ============================================================================
// GM LOADER (Standing Rule #1 — systemPrompt VERBATIM, no Brand DNA merge)
// ============================================================================

async function loadGMConfig(industryKey: string): Promise<EnginePromptGMConfig> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Video Engine Prompt Specialist GM not found for industryKey=${industryKey}. ` +
        `Run node scripts/seed-video-engine-prompt-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<EnginePromptGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Video Engine Prompt Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  return {
    systemPrompt,
    model: config.model ?? DEFAULT_MODEL,
    temperature: config.temperature ?? 0.4,
    maxTokens: Math.max(config.maxTokens ?? MIN_OUTPUT_TOKENS, MIN_OUTPUT_TOKENS),
  };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

async function callOpenRouter(
  gm: EnginePromptGMConfig,
  userPrompt: string,
  maxTokens: number,
): Promise<string> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const response = await provider.chat({
    model: gm.model,
    messages: [
      { role: 'system', content: gm.systemPrompt },
      { role: 'user', content: userPrompt },
    ],
    temperature: gm.temperature,
    maxTokens,
  });

  if (response.finishReason === 'length') {
    throw new Error(
      `Video Engine Prompt Specialist: LLM response truncated at maxTokens=${maxTokens} (finish_reason='length').`,
    );
  }
  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildUserPrompt(input: GenerateEnginePromptInput, priorErrors?: string): string {
  const engineLine =
    input.candidateEngines && input.candidateEngines.length > 0
      ? `CANDIDATE ENGINES (choose the single best for THIS shot): ${input.candidateEngines.join(', ')}`
      : 'CANDIDATE ENGINES: choose the best engine you know for this shot (see your system prompt).';

  return [
    'TASK: Turn the shot intent below into the OPTIMAL engine prompt as STRICT JSON.',
    'Pick the best engine for this specific shot, then write the prompt tuned to that engine.',
    '',
    engineLine,
    `HAS CHARACTER REFERENCE IMAGES: ${input.hasCharacterReferences ? 'yes' : 'no'}`,
    `HAS CONTINUATION FRAME (prior shot last frame): ${input.hasContinuationFrame ? 'yes' : 'no'}`,
    `HAS SPOKEN DIALOGUE: ${input.hasDialogue ? 'yes' : 'no'}`,
    input.aspectRatio ? `ASPECT RATIO: ${input.aspectRatio}` : '',
    input.durationSec ? `DURATION: ${input.durationSec}s` : '',
    '',
    'SHOT INTENT (every captured detail — distill it; drop nothing meaningful):',
    input.shotIntent,
    '',
    'OUTPUT CONTRACT — return ONLY this JSON object (no markdown, no preamble):',
    '{',
    '  "engine": string,                       // the chosen engine/model id',
    '  "generationType": "text-to-video" | "image-to-video" | "reference-to-video",',
    '  "prompt": string,                       // engine-optimal POSITIVE prompt — front-load the action',
    '  "negativePrompt": string,               // what to avoid (omit if the engine has no negative prompt)',
    '  "motion": string,                       // camera/motion directive in the engine\'s phrasing',
    '  "rationale": string                     // why this engine + how you tuned the prompt',
    '}',
    '',
    'HARD RULES:',
    '- Choose generationType to match the inputs: reference-to-video when cast reference images are present; image-to-video when a continuation frame is present; otherwise text-to-video. If BOTH a continuation frame and cast refs are present, prefer the engine path that honors both (state it in rationale).',
    '- FRONT-LOAD THE ACTION: the concrete thing that happens goes first; then supporting detail. Engines weight the front of the prompt most.',
    '- Keep the prompt CONCRETE and FOCUSED — physical, visual language. Carry the meaningful cinematic detail (framing, lens, lighting, look, mood) but do not bloat with redundant adjectives or restate the same idea twice.',
    '- Tune phrasing to the chosen engine\'s idioms (see your system prompt). Use a negative prompt only if that engine supports one.',
    '- Stay on-brand (the Brand DNA in your system prompt). Never invent logos, statistics, or claims. Never use a forbidden phrase.',
    '- Output ONLY the JSON object.',
    priorErrors
      ? `\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix exactly these problems and return corrected JSON only:\n${priorErrors}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ============================================================================
// PUBLIC: generateEnginePrompt
// ============================================================================

/**
 * Pick the best engine for a shot and produce the engine-optimal prompt. Retries
 * once with the zod errors fed back if the first result fails the contract.
 */
export async function generateEnginePrompt(
  input: GenerateEnginePromptInput,
): Promise<EnginePromptResult> {
  const validated = GenerateEnginePromptInputSchema.parse(input);
  const gm = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

  let priorErrors: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = buildUserPrompt(validated, priorErrors);
    const rawContent = await callOpenRouter(gm, userPrompt, gm.maxTokens);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripJsonFences(rawContent));
    } catch {
      priorErrors = `Output was not valid JSON: ${rawContent.slice(0, 200)}`;
      continue;
    }

    const result = EnginePromptResultSchema.safeParse(parsedJson);
    if (!result.success) {
      priorErrors = result.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      continue;
    }

    logger.info('[VideoEnginePrompt] engine prompt generated', {
      engine: result.data.engine,
      generationType: result.data.generationType,
      promptChars: result.data.prompt.length,
      file: FILE,
    });
    return result.data;
  }

  throw new Error(
    `Video Engine Prompt Specialist could not produce a valid result after 2 attempts. Last errors: ${priorErrors ?? 'unknown'}`,
  );
}

// ============================================================================
// INTERNAL TEST HELPERS
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  loadGMConfig,
  stripJsonFences,
  buildUserPrompt,
  GenerateEnginePromptInputSchema,
  EnginePromptResultSchema,
};
