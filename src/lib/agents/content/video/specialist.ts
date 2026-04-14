/**
 * Video Specialist — REAL AI AGENT (Task #24 rebuild, April 11 2026)
 *
 * Loads its Golden Master from Firestore at runtime, injects Brand DNA, and
 * calls OpenRouter (Claude Sonnet 4.6 by default — locked in after the
 * regression harness proved Sonnet 4 → Sonnet 4.6 was a safe upgrade on
 * the seeded Copywriter case corpus) to produce shot-by-shot storyboards
 * for short-form marketing and sales videos. No template fallbacks. If the
 * GM is missing, Brand DNA is missing, OpenRouter fails, JSON won't parse,
 * or Zod validation fails, the specialist returns a real FAILED AgentReport
 * with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - script_to_storyboard  (ContentManager.generateVideoContent and
 *                            ContentManager.generatePersonalizedVideo)
 *
 * The pre-rebuild template engine supported 9 actions. Eight of them had
 * no live caller anywhere in the codebase (audio_cues, scene_breakdown,
 * thumbnail_strategy, video_seo, broll_suggestions, create_video_project,
 * render_scenes, assemble_scenes) — they were dead surface pretending to
 * be a video studio. Per CLAUDE.md's no-stubs and no-features-beyond-what-
 * was-requested rules, the dead branches are not rebuilt. If a future
 * caller needs another action, it gets added then with its own GM update
 * and regression cases.
 *
 * This specialist produces the EDITORIAL storyboard — scene scripts,
 * visual directions, durations, shot types. It does NOT pick avatars,
 * voices, or render engines — those are runtime decisions handled by the
 * Hedra render pipeline (src/lib/video/pipeline-project-service.ts and
 * the /api/video routes). Content fields emitted here (scriptText, title,
 * visualDescription, backgroundPrompt, duration) align 1:1 with the
 * PipelineScene content surface so downstream mapping is an identity
 * transform for the editorial spine.
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

const FILE = 'video/specialist.ts';
const SPECIALIST_ID = 'VIDEO_SPECIALIST';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['script_to_storyboard'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Video Specialist response.
 *
 * Derivation (cross-cutting fix, April 13 2026):
 *   StoryboardResultSchema enforces only title.max(120) plus enum fields;
 *   the per-scene prose fields (visualDescription, scriptText,
 *   backgroundPrompt, onScreenText) are unbounded. The realistic bound
 *   comes from the user prompt + the schema's max scene count of 12.
 *
 *   Per-scene realistic worst case (15-second scene, verbose style):
 *     title ≤6 words (~40 chars)
 *     visualDescription "cinematographer-ready" (~300 chars)
 *     scriptText voiceover @ ~3-4 words/sec × 15 sec (~360 chars)
 *     backgroundPrompt "text-to-image hint" (~200 chars)
 *     onScreenText caption (~100 chars)
 *     ≈ 1,000 chars per scene
 *
 *   12-scene worst case:
 *     12 × 1,000 = 12,000 chars
 *     + title 60 + productionNotes 6 × 200 = 1,200 + callToAction 150
 *     ≈ 13,400 chars total prose
 *     /3.0 chars/token = 4,467 tokens
 *     + JSON structure overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 5,833 tokens minimum.
 *
 *   The prior 6,000 was right at the realistic floor with effectively
 *   zero headroom for verbose styles. Setting the floor at 10,000 tokens
 *   gives ~70% headroom over the realistic worst case while staying
 *   comfortably under model output ceilings. The truncation backstop
 *   in callOpenRouter catches anything that still overflows.
 *
 * Cross-cutting context: this is part of the Task #45 follow-up audit
 * after the OpenRouter provider was caught hardcoding finishReason='stop'
 * and silently masking length-truncated responses across every Tasks
 * #23-#41 specialist that calls provider.chat().
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 10000;

interface VideoSpecialistGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Video Specialist',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['script_to_storyboard'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['script_to_storyboard'],
  outputSchema: {
    type: 'object',
    properties: {
      title: { type: 'string' },
      platform: { type: 'string' },
      style: { type: 'string' },
      totalDurationSec: { type: 'number' },
      sceneCount: { type: 'number' },
      scenes: { type: 'array' },
      productionNotes: { type: 'array' },
      callToAction: { type: 'string' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACT
// ============================================================================

const PLATFORMS = ['youtube', 'tiktok', 'instagram_reels', 'shorts', 'linkedin', 'generic'] as const;
const STYLES = ['talking_head', 'documentary', 'energetic', 'cinematic'] as const;

export type VideoPlatform = (typeof PLATFORMS)[number];
export type VideoStyle = (typeof STYLES)[number];

export interface ScriptToStoryboardRequest {
  action: 'script_to_storyboard';
  script?: string;
  brief?: string;
  platform: VideoPlatform;
  style: VideoStyle;
  targetDuration: number; // integer seconds, 15–150
  targetAudience?: string;
  callToAction?: string;
  tone?: string;
}

// ============================================================================
// OUTPUT CONTRACT (Zod schema — enforced on every LLM response)
// ============================================================================

const SHOT_TYPES = [
  'close_up',
  'medium',
  'wide',
  'extreme_close_up',
  'over_the_shoulder',
  'two_shot',
] as const;

const CAMERA_MOVEMENTS = [
  'static',
  'slow_push_in',
  'slow_pull_out',
  'pan_left',
  'pan_right',
  'tilt_up',
  'tilt_down',
  'handheld',
  'dolly',
] as const;

const StoryboardSceneSchema = z.object({
  sceneNumber: z.number().int().min(1),
  title: z.string().min(1).max(60),
  visualDescription: z.string().min(10),
  scriptText: z.string().min(1),
  backgroundPrompt: z.string().min(10),
  duration: z.number().int().min(3).max(15),
  shotType: z.enum(SHOT_TYPES),
  cameraMovement: z.enum(CAMERA_MOVEMENTS),
  onScreenText: z.string(), // may be empty
});

const StoryboardResultSchema = z.object({
  title: z.string().min(1).max(120),
  platform: z.string().min(1),
  style: z.string().min(1),
  totalDurationSec: z.number().int().min(15).max(150),
  sceneCount: z.number().int().min(3).max(12),
  scenes: z.array(StoryboardSceneSchema).min(3).max(12),
  productionNotes: z.array(z.string().min(1)).min(3).max(6),
  callToAction: z.string().min(1),
}).superRefine((data, ctx) => {
  if (data.scenes.length !== data.sceneCount) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['sceneCount'],
      message: `sceneCount (${data.sceneCount}) must equal scenes.length (${data.scenes.length}).`,
    });
  }
  const sumDurations = data.scenes.reduce((acc, s) => acc + s.duration, 0);
  if (sumDurations !== data.totalDurationSec) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['totalDurationSec'],
      message: `totalDurationSec (${data.totalDurationSec}) must equal sum of scene durations (${sumDurations}).`,
    });
  }
  for (let i = 0; i < data.scenes.length; i++) {
    const scene = data.scenes[i];
    if (scene && scene.sceneNumber !== i + 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['scenes', i, 'sceneNumber'],
        message: `scenes[${i}].sceneNumber must be ${i + 1} (1-indexed, sequential, no gaps).`,
      });
    }
  }
});

export type StoryboardResult = z.infer<typeof StoryboardResultSchema>;
export type StoryboardScene = z.infer<typeof StoryboardSceneSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: VideoSpecialistGMConfig;
  brandDNA: BrandDNA;
  resolvedSystemPrompt: string;
}

async function loadGMAndBrandDNA(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Video Specialist GM not found for industryKey=${industryKey}. ` +
      `Run node scripts/seed-video-specialist-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<VideoSpecialistGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Video Specialist GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  // Take max() of GM-stored value and the schema-derived minimum so old
  // GM docs honor the worst-case budget without requiring a Firestore
  // migration. We never silently downsize a GM-configured ceiling.
  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: VideoSpecialistGMConfig = {
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
      'Brand DNA not configured. Video Specialist refuses to generate storyboards without brand identity. ' +
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
  // truncated responses. Now that the provider is honest, a 'length'
  // finish_reason means the LLM hit max_tokens mid-response and the JSON
  // is incomplete. Fail loudly instead of letting JSON.parse surface a
  // confusing "unexpected end of input" error.
  if (response.finishReason === 'length') {
    throw new Error(
      `Video Specialist: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: script_to_storyboard
// ============================================================================

function buildScriptToStoryboardUserPrompt(req: ScriptToStoryboardRequest): string {
  const scriptBlock = req.script && req.script.trim().length > 0
    ? `Source script (adapt this — cut what doesn't fit the platform, split across scenes, preserve the brand voice):\n${req.script.trim()}`
    : 'Source script: (none — build the voiceover from the brief below)';

  const briefBlock = req.brief && req.brief.trim().length > 0
    ? `Brief: ${req.brief.trim()}`
    : 'Brief: (not provided — infer from script and Brand DNA)';

  const targetAudience = req.targetAudience && req.targetAudience.trim().length > 0
    ? req.targetAudience.trim()
    : '(defaults to Brand DNA targetAudience)';

  const callToAction = req.callToAction && req.callToAction.trim().length > 0
    ? req.callToAction.trim()
    : '(choose a concrete, low-friction next step appropriate for this platform and audience)';

  const tone = req.tone && req.tone.trim().length > 0
    ? req.tone.trim()
    : '(defaults to Brand DNA toneOfVoice)';

  return [
    'ACTION: script_to_storyboard',
    '',
    `Platform: ${req.platform}`,
    `Style: ${req.style}`,
    `Target duration: ${req.targetDuration} seconds`,
    `Target audience: ${targetAudience}`,
    `Call to action: ${callToAction}`,
    `Tone override: ${tone}`,
    '',
    briefBlock,
    '',
    scriptBlock,
    '',
    'Produce a shot-by-shot storyboard. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "title": "working title for the video, ≤10 words",',
    '  "platform": "echo the requested platform",',
    '  "style": "echo the requested style",',
    `  "totalDurationSec": ${req.targetDuration},`,
    '  "sceneCount": <integer 3-12, must equal scenes.length>,',
    '  "scenes": [',
    '    {',
    '      "sceneNumber": <1-indexed integer, strictly sequential>,',
    '      "title": "short human label, ≤6 words (e.g., The Hook, Problem Statement, Direct CTA)",',
    '      "visualDescription": "a cinematographer-ready shot description, ≥10 chars",',
    '      "scriptText": "non-empty voiceover for this scene",',
    '      "backgroundPrompt": "concrete text-to-image hint for the scene environment, ≥10 chars",',
    '      "duration": <integer seconds, 3-15>,',
    `      "shotType": "one of ${SHOT_TYPES.join(' | ')}",`,
    `      "cameraMovement": "one of ${CAMERA_MOVEMENTS.join(' | ')}",`,
    '      "onScreenText": "caption or lower-third, or \\"\\" if nothing on screen"',
    '    }',
    '  ],',
    '  "productionNotes": ["3-6 director notes, each a non-empty string"],',
    '  "callToAction": "the specific CTA verbalized in the closing scene"',
    '}',
    '',
    'Hard rules you MUST follow:',
    `- totalDurationSec MUST equal ${req.targetDuration} and MUST equal the sum of scene durations.`,
    '- sceneCount MUST equal scenes.length.',
    '- scenes[i].sceneNumber MUST equal i+1 (1-indexed, sequential, no gaps).',
    '- Every scene MUST have non-empty scriptText. Voiceover is the backbone — no silent scenes.',
    '- Every scene MUST have a visualDescription a cinematographer could shoot (≥10 chars).',
    '- Every scene MUST have a backgroundPrompt concrete enough for a text-to-image model (≥10 chars).',
    '- Do NOT use any phrase from the avoid list in the Brand DNA injection.',
    '- Do NOT fabricate statistics, percentages, testimonials, client names, or dollar figures.',
    '- Do NOT produce placeholder content like "[insert value prop]" or "TBD".',
    '- Output ONLY the JSON object. No prose outside it. No markdown fences.',
  ].join('\n');
}

async function executeScriptToStoryboard(
  req: ScriptToStoryboardRequest,
  ctx: LlmCallContext,
): Promise<StoryboardResult> {
  const userPrompt = buildScriptToStoryboardUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Video Specialist output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = StoryboardResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Video Specialist output did not match expected schema: ${issueSummary}`);
  }

  return result.data;
}

// ============================================================================
// INPUT VALIDATION
// ============================================================================

const ScriptToStoryboardRequestSchema = z.object({
  action: z.literal('script_to_storyboard'),
  script: z.string().optional(),
  brief: z.string().optional(),
  platform: z.enum(PLATFORMS),
  style: z.enum(STYLES),
  targetDuration: z.number().int().min(15).max(150),
  targetAudience: z.string().optional(),
  callToAction: z.string().optional(),
  tone: z.string().optional(),
});

// ============================================================================
// VIDEO SPECIALIST CLASS
// ============================================================================

export class VideoSpecialist extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Video Specialist initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Video Specialist: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Video Specialist: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Video Specialist does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[VideoSpecialist] Executing action=${action} taskId=${taskId}`, { file: FILE });

      // Validate input at the boundary so we fail fast with a clear error
      // instead of surfacing Zod schema errors against the LLM output.
      const inputValidation = ScriptToStoryboardRequestSchema.safeParse({
        ...payload,
        action,
      });
      if (!inputValidation.success) {
        const issueSummary = inputValidation.error.issues
          .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
          .join('; ');
        return this.createReport(taskId, 'FAILED', null, [
          `Video Specialist script_to_storyboard: invalid input payload: ${issueSummary}`,
        ]);
      }

      const ctx = await loadGMAndBrandDNA(DEFAULT_INDUSTRY_KEY);

      const data = await executeScriptToStoryboard(inputValidation.data, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[VideoSpecialist] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 420, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createVideoSpecialist(): VideoSpecialist {
  return new VideoSpecialist();
}

let instance: VideoSpecialist | null = null;

export function getVideoSpecialist(): VideoSpecialist {
  instance ??= createVideoSpecialist();
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
  PLATFORMS,
  STYLES,
  SHOT_TYPES,
  CAMERA_MOVEMENTS,
  loadGMAndBrandDNA,
  buildResolvedSystemPrompt,
  buildScriptToStoryboardUserPrompt,
  stripJsonFences,
  StoryboardResultSchema,
  StoryboardSceneSchema,
  ScriptToStoryboardRequestSchema,
};
