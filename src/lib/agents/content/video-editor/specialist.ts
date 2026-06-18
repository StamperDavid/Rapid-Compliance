/**
 * Video Editor Specialist — REAL AI AGENT (June 18 2026).
 *
 * The "auto-highlight" brain behind the editor's Make Clips tool — the OpusClip-
 * style reviewer. Given a video's TRANSCRIPT (with word-level timings) and total
 * duration, it returns the CLIPPABLE MOMENTS: the highlight-worthy spans good for
 * shorts, each with WHY it works, a suggested caption, and a 0-1 hook/virality
 * score. It finds hooks, payoffs, emotional peaks, and self-contained moments —
 * the spans that survive being cut out of the long video and posted on their own.
 *
 * Standing Rule #1: loads its Golden Master from Firestore at runtime (Brand DNA
 * baked in at seed time) and uses `gm.systemPrompt` VERBATIM — there is NO runtime
 * Brand DNA load and NO `getBrandDNA()` call here. The intelligence is a REAL LLM
 * call against the GM's systemPrompt: NOTHING about which span is clippable, why,
 * or how it scores is hardcoded — the model decides every moment. If the GM is
 * missing, the LLM fails, the JSON won't parse, or the result fails its schema, it
 * throws an honest error (one retry on an invalid result, feeding the zod errors
 * back to the model).
 *
 * Standing Rule #2: there is NO self-editing / auto-improve path here. The agent
 * never edits its own prompt and never touches the GM.
 */

import { z } from 'zod';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { TranscriptionResult } from '@/types/scene-grading';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'content/video-editor/specialist.ts';
const SPECIALIST_ID = 'VIDEO_EDITOR_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

/** The clippable-moments JSON is a modest list — give it room but cap it. */
const MIN_OUTPUT_TOKENS = 6000;
/** Cap how much transcript context we feed the model (keeps the call bounded). */
const MAX_WORDS_FOR_PROMPT = 6000;
/** Never ask for more moments than this in one pass. */
const MAX_MOMENTS = 20;

interface VideoEditorGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
}

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const FindClippableMomentsInputSchema = z.object({
  /** The video's transcript with per-word timings (from Deepgram). */
  transcription: z.object({
    transcript: z.string(),
    words: z
      .array(
        z.object({
          word: z.string(),
          start: z.number().min(0),
          end: z.number().min(0),
          confidence: z.number(),
        }),
      )
      .min(1, 'A transcript with at least one word is required to find moments.'),
    durationSeconds: z.number().min(0),
    confidence: z.number(),
  }),
  /** Total video duration in seconds (the timeline length to bound spans to). */
  durationSeconds: z.number().min(0.5),
  /** Optional desired number of moments (the agent still decides if omitted). */
  maxMoments: z.number().int().min(1).max(MAX_MOMENTS).optional(),
});

export type FindClippableMomentsInput = z.infer<typeof FindClippableMomentsInputSchema>;

// ============================================================================
// OUTPUT CONTRACT
// ============================================================================

/** One highlight-worthy span the agent surfaced for shorts. */
export interface ClippableMoment {
  /** Start of the span on the video timeline, in seconds. */
  startSec: number;
  /** End of the span on the video timeline, in seconds. */
  endSec: number;
  /** Plain-English why this span is clippable (the hook / payoff / peak). */
  reason: string;
  /** A ready-to-edit caption to prefill when the operator posts this short. */
  suggestedCaption: string;
  /** 0-1 hook/virality score — higher = stronger standalone short. */
  score: number;
}

// ============================================================================
// LLM-FACING SCHEMA — what the model returns
// ============================================================================

const LlmMomentSchema = z.object({
  startSec: z.number().min(0),
  endSec: z.number().min(0),
  reason: z.string().trim().min(1).max(600),
  suggestedCaption: z.string().trim().min(1).max(600),
  score: z.number().min(0).max(1),
});

const LlmResultSchema = z.object({
  moments: z.array(LlmMomentSchema).max(MAX_MOMENTS),
});

type LlmResult = z.infer<typeof LlmResultSchema>;

// ============================================================================
// GM LOADER (Standing Rule #1 — systemPrompt VERBATIM, no Brand DNA merge)
// ============================================================================

async function loadGMConfig(industryKey: string): Promise<VideoEditorGMConfig> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Video Editor Specialist GM not found for industryKey=${industryKey}. ` +
        `Run node scripts/seed-video-editor-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<VideoEditorGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Video Editor Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  return {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
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
  gm: VideoEditorGMConfig,
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
      `Video Editor Specialist: LLM response truncated at maxTokens=${maxTokens} (finish_reason='length').`,
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

/**
 * Render the transcript as `[mm:ss] word word word …` lines so the model can
 * point at precise spans by time. We group words into ~one-line chunks and
 * stamp each chunk with its start time. Capped at MAX_WORDS_FOR_PROMPT words.
 */
function buildTimedTranscriptBlock(transcription: TranscriptionResult): string {
  const words = transcription.words.slice(0, MAX_WORDS_FOR_PROMPT);
  if (words.length === 0) {
    return '(empty transcript)';
  }

  const lines: string[] = [];
  let chunk: string[] = [];
  let chunkStart = words[0].start;

  const flush = (): void => {
    if (chunk.length === 0) {
      return;
    }
    const mm = Math.floor(chunkStart / 60);
    const ss = Math.floor(chunkStart % 60)
      .toString()
      .padStart(2, '0');
    lines.push(`[${mm}:${ss}] ${chunk.join(' ')}`);
    chunk = [];
  };

  for (const w of words) {
    if (chunk.length === 0) {
      chunkStart = w.start;
    }
    chunk.push(w.word);
    // Roughly one timestamped line per ~12 words for readability.
    if (chunk.length >= 12) {
      flush();
    }
  }
  flush();

  const truncatedNote =
    transcription.words.length > MAX_WORDS_FOR_PROMPT
      ? `\n(transcript truncated to the first ${MAX_WORDS_FOR_PROMPT} words for analysis)`
      : '';

  return lines.join('\n') + truncatedNote;
}

function buildUserPrompt(
  input: FindClippableMomentsInput,
  priorZodErrors?: string,
): string {
  const desired = input.maxMoments ?? 'you decide (typically 3-8 for a few-minute video)';
  return [
    'TASK: Review the transcript of a video below and return its CLIPPABLE MOMENTS as STRICT JSON — the spans that would make strong standalone short videos.',
    '',
    `VIDEO DURATION: ${input.durationSeconds.toFixed(1)} seconds.`,
    `HOW MANY MOMENTS: ${desired}. Return at most ${MAX_MOMENTS}. Quality over quantity — only return spans that genuinely stand on their own.`,
    '',
    'TIMESTAMPED TRANSCRIPT (each line is "[m:ss] words spoken from that time"):',
    buildTimedTranscriptBlock(input.transcription),
    '',
    'OUTPUT CONTRACT — return ONLY this JSON object (no markdown, no preamble):',
    '{',
    '  "moments": [',
    '    {',
    '      "startSec": number,  // start of the span on the video timeline, in seconds (>= 0, < endSec)',
    '      "endSec": number,    // end of the span on the video timeline, in seconds (<= video duration)',
    '      "reason": string,    // plain-English WHY this span is clippable (the hook, payoff, or emotional peak)',
    '      "suggestedCaption": string,  // a ready-to-post caption for this short, on-brand (see Brand DNA in your system prompt)',
    '      "score": number      // 0-1 hook/virality score; higher = a stronger standalone short',
    '    }',
    '  ]',
    '}',
    '',
    'HARD RULES:',
    `- Every startSec and endSec MUST fall inside [0, ${input.durationSeconds.toFixed(1)}] seconds, and endSec MUST be greater than startSec.`,
    '- Prefer SELF-CONTAINED spans: a moment a stranger could watch with no other context — a complete thought, a hook + its payoff, a punchline, a strong claim, an emotional beat.',
    '- A good short is usually ~8-60 seconds. Do not return micro-spans of a second or two, and do not return the whole video.',
    '- score reflects standalone hook strength: a gripping opener / surprising claim / emotional peak scores high; filler, throat-clearing, and mid-sentence fragments score low (and usually should not be returned at all).',
    '- suggestedCaption must be on-brand (honor the Brand DNA in your system prompt), never use a forbidden phrase, and never fabricate logos, statistics, or claims not supported by what was actually said.',
    '- If the transcript genuinely has NO clip-worthy moment, return "moments": []. NEVER invent a moment to fill space.',
    '- Output ONLY the JSON object.',
    priorZodErrors
      ? `\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix exactly these problems and return corrected JSON only:\n${priorZodErrors}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ============================================================================
// ASSEMBLY
// ============================================================================

/**
 * Map the model's raw moments onto the contract, clamping spans into the real
 * video duration and dropping any span that collapses to nothing after clamping.
 * Nothing is fabricated — invalid spans are dropped, never patched into a moment.
 */
function assembleMoments(
  body: LlmResult,
  durationSeconds: number,
): ClippableMoment[] {
  const clamp = (n: number): number => Math.min(durationSeconds, Math.max(0, n));
  const moments: ClippableMoment[] = [];
  for (const m of body.moments) {
    const startSec = clamp(m.startSec);
    const endSec = clamp(m.endSec);
    if (endSec <= startSec) {
      continue;
    }
    moments.push({
      startSec: Number(startSec.toFixed(2)),
      endSec: Number(endSec.toFixed(2)),
      reason: m.reason,
      suggestedCaption: m.suggestedCaption,
      score: Number(Math.min(1, Math.max(0, m.score)).toFixed(3)),
    });
  }
  // Strongest hooks first.
  moments.sort((a, b) => b.score - a.score);
  return moments;
}

// ============================================================================
// PUBLIC: findClippableMoments
// ============================================================================

/**
 * Analyze a video's transcript and return its clippable moments. Real LLM call
 * against the GM's systemPrompt — no hardcoded scoring or span detection. Retries
 * once with the zod errors fed back if the first result fails its schema.
 */
export async function findClippableMoments(
  input: FindClippableMomentsInput,
): Promise<ClippableMoment[]> {
  const validated = FindClippableMomentsInputSchema.parse(input);
  const gm = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

  let priorZodErrors: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = buildUserPrompt(validated, priorZodErrors);
    const rawContent = await callOpenRouter(gm, userPrompt, gm.maxTokens);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripJsonFences(rawContent));
    } catch {
      priorZodErrors = `Output was not valid JSON: ${rawContent.slice(0, 200)}`;
      continue;
    }

    const bodyResult = LlmResultSchema.safeParse(parsedJson);
    if (!bodyResult.success) {
      priorZodErrors = bodyResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      continue;
    }

    const moments = assembleMoments(bodyResult.data, validated.durationSeconds);
    logger.info('[VideoEditorSpecialist] clippable moments found', {
      momentCount: moments.length,
      durationSeconds: Math.round(validated.durationSeconds),
      file: FILE,
    });
    return moments;
  }

  throw new Error(
    `Video Editor Specialist could not produce valid clippable moments after 2 attempts. Last errors: ${priorZodErrors ?? 'unknown'}`,
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
  buildTimedTranscriptBlock,
  buildUserPrompt,
  assembleMoments,
  callOpenRouter,
  LlmResultSchema,
  FindClippableMomentsInputSchema,
};
