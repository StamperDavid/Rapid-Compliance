/**
 * Music/Soundtrack Planner Specialist — REAL AI AGENT
 *
 * Loads its Golden Master from Firestore at runtime and calls OpenRouter
 * (Claude Sonnet 4.6 by default) to produce soundtrack plans and music
 * style recommendations for video and audio projects. No template
 * fallbacks. If the GM is missing, OpenRouter fails, JSON won't parse,
 * or Zod validation fails, the specialist returns a real FAILED
 * AgentReport with the honest reason.
 *
 * Supported actions (live code paths only):
 *   - plan_soundtrack       (project brief → full soundtrack plan)
 *   - recommend_music_style (brand + content type → music style profile)
 *
 * @module agents/content/music/specialist
 */

import { z } from 'zod';
import { BaseSpecialist } from '../../base-specialist';
import type { AgentMessage, AgentReport, SpecialistConfig, Signal } from '../../types';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'content/music/specialist.ts';
const SPECIALIST_ID = 'MUSIC_PLANNER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';
const SUPPORTED_ACTIONS = ['plan_soundtrack', 'recommend_music_style'] as const;
type SupportedAction = (typeof SUPPORTED_ACTIONS)[number];

/**
 * Realistic max_tokens floor for the worst-case Music Planner response.
 *
 * Derivation:
 *   SoundtrackPlanResultSchema worst case:
 *     - overallMood: ~200 chars
 *     - bpmRange: 2 numbers
 *     - genre + subgenres: ~200 chars
 *     - instrumentation: 8 items × 100 chars = 800 chars
 *     - tracks: 5 items × (name ~50 + description ~300 + mood ~100 +
 *       bpm ~10 + instruments ~200 + usage ~200) ≈ 4,300 chars
 *     - transitionGuidance: ~500 chars
 *     - notes: ~300 chars
 *     Total ≈ 6,300 chars / 3 chars/token = 2,100 tokens
 *     + JSON overhead (~200 tokens)
 *     + 25% safety margin
 *     ≈ 3,000 tokens minimum
 *
 *   MusicStyleResultSchema is smaller (~2,000 chars ≈ 900 tokens).
 *   Setting floor at 6000 tokens = 2× realistic max with headroom.
 */
const MIN_OUTPUT_TOKENS_FOR_SCHEMA = 6000;

interface MusicPlannerGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
  supportedActions: string[];
}

const CONFIG: SpecialistConfig = {
  identity: {
    id: SPECIALIST_ID,
    name: 'Music/Soundtrack Planner',
    role: 'specialist',
    status: 'FUNCTIONAL',
    reportsTo: 'CONTENT_MANAGER',
    capabilities: ['plan_soundtrack', 'recommend_music_style'],
  },
  systemPrompt: '', // Loaded from Firestore Golden Master at runtime
  tools: ['plan_soundtrack', 'recommend_music_style'],
  outputSchema: {
    type: 'object',
    properties: {
      overallMood: { type: 'string' },
      bpmRange: { type: 'object' },
      genre: { type: 'string' },
      tracks: { type: 'array' },
    },
  },
  maxTokens: MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  temperature: 0.7,
};

// ============================================================================
// INPUT CONTRACTS
// ============================================================================

export interface SoundtrackPlanRequest {
  action: 'plan_soundtrack';
  projectDescription: string;
  targetAudience?: string;
  mood?: string;
  brandTone?: string;
  videoDurationSeconds?: number;
  sceneDescriptions?: Array<{ sceneId: string; description: string; durationSeconds?: number }>;
  visualStyle?: string;
  contentType?: string;
  existingMusicReferences?: string[];
}

export interface MusicStyleRequest {
  action: 'recommend_music_style';
  brandIdentity: string;
  contentType: string;
  targetAudience?: string;
  mood?: string;
  platform?: string;
  referenceArtists?: string[];
}

// ============================================================================
// OUTPUT CONTRACTS (Zod schemas — enforced on every LLM response)
// ============================================================================

const TrackDescriptionSchema = z.object({
  trackName: z.string().min(1),
  description: z.string().min(1),
  mood: z.string().min(1),
  suggestedBpm: z.number().int().min(20).max(300),
  instruments: z.array(z.string().min(1)).min(1),
  usage: z.string().min(1),
  durationAdvice: z.string().optional(),
});

const SoundtrackPlanResultSchema = z.object({
  overallMood: z.string().min(1),
  bpmRange: z.object({
    min: z.number().int().min(20).max(300),
    max: z.number().int().min(20).max(300),
  }),
  genre: z.string().min(1),
  subgenres: z.array(z.string().min(1)).min(1),
  instrumentationPalette: z.array(z.string().min(1)).min(1),
  tracks: z.array(TrackDescriptionSchema).min(3).max(7),
  transitionGuidance: z.string().min(1),
  notes: z.string().optional(),
});

export type SoundtrackPlanResult = z.infer<typeof SoundtrackPlanResultSchema>;

const MusicStyleResultSchema = z.object({
  styleName: z.string().min(1),
  description: z.string().min(1),
  genre: z.string().min(1),
  subgenres: z.array(z.string().min(1)).min(1),
  bpmRange: z.object({
    min: z.number().int().min(20).max(300),
    max: z.number().int().min(20).max(300),
  }),
  keyCharacteristics: z.array(z.string().min(1)).min(1),
  instrumentationPalette: z.array(z.string().min(1)).min(1),
  moodKeywords: z.array(z.string().min(1)).min(1),
  referenceDescription: z.string().min(1),
  avoidElements: z.array(z.string().min(1)).min(1),
  bestFor: z.array(z.string().min(1)).min(1),
});

export type MusicStyleResult = z.infer<typeof MusicStyleResultSchema>;

// ============================================================================
// LLM INVOCATION CORE
// ============================================================================

interface LlmCallContext {
  gm: MusicPlannerGMConfig;
  resolvedSystemPrompt: string;
}

async function loadGMConfig(industryKey: string): Promise<LlmCallContext> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Music Planner GM not found for industryKey=${industryKey}. ` +
      `Run: node scripts/seed-music-planner-gm.js`,
    );
  }

  const config = gmRecord.config as Partial<MusicPlannerGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Music Planner GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  const gmMaxTokens = config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCHEMA;
  const effectiveMaxTokens = Math.max(gmMaxTokens, MIN_OUTPUT_TOKENS_FOR_SCHEMA);

  const gm: MusicPlannerGMConfig = {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.7,
    maxTokens: effectiveMaxTokens,
    supportedActions: config.supportedActions ?? [...SUPPORTED_ACTIONS],
  };
  const resolvedSystemPrompt = gm.systemPrompt;
  return { gm, resolvedSystemPrompt };
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
      `Music Planner: LLM response truncated at maxTokens=${ctx.gm.maxTokens} ` +
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
// ACTION: plan_soundtrack
// ============================================================================

function buildSoundtrackPlanUserPrompt(req: SoundtrackPlanRequest): string {
  const scenes = req.sceneDescriptions
    ? req.sceneDescriptions.map((s) =>
      `- Scene "${s.sceneId}": ${s.description}${s.durationSeconds ? ` (~${s.durationSeconds}s)` : ''}`,
    ).join('\n')
    : '(no individual scene descriptions provided — plan holistically)';

  const references = (req.existingMusicReferences ?? []).length > 0
    ? (req.existingMusicReferences ?? []).map((r) => `- ${r}`).join('\n')
    : '(none specified)';

  return [
    'ACTION: plan_soundtrack',
    '',
    `Project description: ${req.projectDescription}`,
    `Target audience: ${req.targetAudience ?? '(not specified)'}`,
    `Desired mood: ${req.mood ?? '(not specified — infer from project description)'}`,
    `Brand tone: ${req.brandTone ?? '(not specified — refer to Brand DNA)'}`,
    `Video duration: ${req.videoDurationSeconds ? `${req.videoDurationSeconds} seconds` : '(not specified)'}`,
    `Visual style: ${req.visualStyle ?? '(not specified)'}`,
    `Content type: ${req.contentType ?? '(not specified)'}`,
    '',
    'Scene breakdown:',
    scenes,
    '',
    'Existing music references (stylistic direction, not tracks to reuse):',
    references,
    '',
    'Produce a complete soundtrack plan. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "overallMood": "2-3 sentence description of the overall sonic atmosphere and emotional arc",',
    '  "bpmRange": { "min": 80, "max": 120 },',
    '  "genre": "primary genre (e.g., \'ambient electronic\', \'cinematic orchestral\', \'lo-fi hip hop\')",',
    '  "subgenres": ["1-3 complementary subgenres that inform instrumentation choices"],',
    '  "instrumentationPalette": ["list of 4-8 instruments/sound sources that define the sonic identity"],',
    '  "tracks": [',
    '    {',
    '      "trackName": "descriptive name for this track segment (e.g., \'Opening Pulse\', \'Hero Moment\')",',
    '      "description": "2-3 sentences describing what this track sounds like — tempo feel, energy, texture",',
    '      "mood": "one-line mood descriptor (e.g., \'confident and forward-moving\', \'reflective calm\')",',
    '      "suggestedBpm": 100,',
    '      "instruments": ["primary instruments/sounds for this track"],',
    '      "usage": "where and how this track should be used in the project (e.g., \'intro sequence, first 15 seconds\')",',
    '      "durationAdvice": "OPTIONAL — suggested duration or timing guidance"',
    '    }',
    '  ],',
    '  "transitionGuidance": "how tracks should flow into each other — crossfades, silence gaps, energy ramps, etc.",',
    '  "notes": "OPTIONAL — any additional creative direction, licensing considerations, or production notes"',
    '}',
    '',
    'Rules you MUST follow:',
    '- Produce 3 to 5 track descriptions (more if the project has 5+ distinct scenes, up to 7 max).',
    '- Each track must have a distinct purpose and sonic character — do not repeat the same description in different words.',
    '- suggestedBpm must be a whole number between 20 and 300.',
    '- bpmRange.min must be less than or equal to bpmRange.max.',
    '- instrumentationPalette must contain 4 to 8 entries.',
    '- Do not recommend specific copyrighted songs or named tracks. Describe what the music should SOUND like.',
    '- Match the Brand DNA tone. If the brand is "professional and authoritative," do not suggest playful ukulele.',
    '- If scene descriptions are provided, map tracks to scenes. If not, create a logical arc (intro → build → peak → resolve).',
  ].join('\n');
}

async function executeSoundtrackPlan(
  req: SoundtrackPlanRequest,
  ctx: LlmCallContext,
): Promise<SoundtrackPlanResult> {
  const userPrompt = buildSoundtrackPlanUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Music Planner output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = SoundtrackPlanResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Music Planner output did not match expected schema: ${issueSummary}`);
  }

  // Defensive: bpmRange.min must be <= bpmRange.max
  if (result.data.bpmRange.min > result.data.bpmRange.max) {
    throw new Error(
      `Music Planner output has invalid bpmRange: min (${result.data.bpmRange.min}) > max (${result.data.bpmRange.max}).`,
    );
  }

  return result.data;
}

// ============================================================================
// ACTION: recommend_music_style
// ============================================================================

function buildMusicStyleUserPrompt(req: MusicStyleRequest): string {
  const referenceArtists = (req.referenceArtists ?? []).length > 0
    ? (req.referenceArtists ?? []).map((a) => `- ${a}`).join('\n')
    : '(none specified)';

  return [
    'ACTION: recommend_music_style',
    '',
    `Brand identity: ${req.brandIdentity}`,
    `Content type: ${req.contentType}`,
    `Target audience: ${req.targetAudience ?? '(not specified)'}`,
    `Desired mood: ${req.mood ?? '(not specified — infer from brand identity and content type)'}`,
    `Distribution platform: ${req.platform ?? '(not specified)'}`,
    '',
    'Reference artists/styles (for directional guidance, not imitation):',
    referenceArtists,
    '',
    'Recommend a music style profile for this brand and content type. Respond with ONLY a valid JSON object, no markdown fences, no preamble, no explanation. The JSON must match this exact schema:',
    '',
    '{',
    '  "styleName": "a short, memorable name for this music style profile (e.g., \'Tech Minimalist\', \'Warm Authority\')",',
    '  "description": "2-3 sentences describing the overall sonic identity and why it fits this brand",',
    '  "genre": "primary genre",',
    '  "subgenres": ["1-3 complementary subgenres"],',
    '  "bpmRange": { "min": 80, "max": 120 },',
    '  "keyCharacteristics": ["3-5 defining sonic traits (e.g., \'clean and uncluttered\', \'subtle bass warmth\')"],',
    '  "instrumentationPalette": ["4-6 recommended instruments/sound sources"],',
    '  "moodKeywords": ["3-5 emotional keywords that define the feel (e.g., \'confident\', \'approachable\', \'focused\')"],',
    '  "referenceDescription": "describe what this music sounds like as if explaining to a composer who has never heard the brand — no copyrighted song names",',
    '  "avoidElements": ["3-5 sonic elements to stay away from (e.g., \'aggressive distortion\', \'kids instruments\', \'comedy sound effects\')"],',
    '  "bestFor": ["2-4 content formats this style works best with (e.g., \'product demo videos\', \'podcast intros\', \'social ads\')"]',
    '}',
    '',
    'Rules you MUST follow:',
    '- The style must align with the brand identity. A luxury brand does not get lo-fi beats.',
    '- bpmRange.min must be less than or equal to bpmRange.max.',
    '- Do not name specific copyrighted songs, albums, or tracks.',
    '- avoidElements must contain real sonic problems, not vague statements like "bad music."',
    '- bestFor must reference specific content formats the brand would actually produce.',
    '- Match the Brand DNA tone baked into your system prompt.',
  ].join('\n');
}

async function executeMusicStyle(
  req: MusicStyleRequest,
  ctx: LlmCallContext,
): Promise<MusicStyleResult> {
  const userPrompt = buildMusicStyleUserPrompt(req);
  const rawContent = await callOpenRouter(ctx, userPrompt);

  let parsed: unknown;
  try {
    parsed = JSON.parse(stripJsonFences(rawContent));
  } catch {
    throw new Error(
      `Music Planner style output was not valid JSON: ${rawContent.slice(0, 200)}`,
    );
  }

  const result = MusicStyleResultSchema.safeParse(parsed);
  if (!result.success) {
    const issueSummary = result.error.issues
      .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
      .join('; ');
    throw new Error(`Music Planner style output did not match expected schema: ${issueSummary}`);
  }

  if (result.data.bpmRange.min > result.data.bpmRange.max) {
    throw new Error(
      `Music Planner style output has invalid bpmRange: min (${result.data.bpmRange.min}) > max (${result.data.bpmRange.max}).`,
    );
  }

  return result.data;
}

// ============================================================================
// MUSIC PLANNER CLASS
// ============================================================================

export class MusicPlanner extends BaseSpecialist {
  constructor() {
    super(CONFIG);
  }

  async initialize(): Promise<void> {
    await Promise.resolve();
    this.isInitialized = true;
    this.log('INFO', 'Music Planner initialized (LLM-backed, Golden Master loaded at runtime)');
  }

  async execute(message: AgentMessage): Promise<AgentReport> {
    const taskId = message.id;

    try {
      const payload = message.payload as Record<string, unknown> | null;
      if (payload === null || typeof payload !== 'object') {
        return this.createReport(taskId, 'FAILED', null, ['Music Planner: payload must be an object']);
      }

      const rawAction = payload.action ?? payload.method;
      if (typeof rawAction !== 'string') {
        return this.createReport(taskId, 'FAILED', null, ['Music Planner: no action or method specified in payload']);
      }

      if (!(SUPPORTED_ACTIONS as readonly string[]).includes(rawAction)) {
        return this.createReport(taskId, 'FAILED', null, [
          `Music Planner does not support action '${rawAction}'. Supported: ${SUPPORTED_ACTIONS.join(', ')}`,
        ]);
      }
      const action = rawAction as SupportedAction;

      logger.info(`[MusicPlanner] Executing action=${action} taskId=${taskId}`, { file: FILE });

      const ctx = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

      if (action === 'plan_soundtrack') {
        const req = payload as unknown as SoundtrackPlanRequest;
        if (typeof req.projectDescription !== 'string' || req.projectDescription.length === 0) {
          return this.createReport(taskId, 'FAILED', null, [
            'Music Planner plan_soundtrack: projectDescription is required',
          ]);
        }
        const data = await executeSoundtrackPlan(req, ctx);
        return this.createReport(taskId, 'COMPLETED', data);
      }

      // action === 'recommend_music_style'
      const styleReq = payload as unknown as MusicStyleRequest;
      if (typeof styleReq.brandIdentity !== 'string' || typeof styleReq.contentType !== 'string') {
        return this.createReport(taskId, 'FAILED', null, [
          'Music Planner recommend_music_style: brandIdentity and contentType are required',
        ]);
      }
      const data = await executeMusicStyle(styleReq, ctx);
      return this.createReport(taskId, 'COMPLETED', data);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      logger.error('[MusicPlanner] Execution failed', error instanceof Error ? error : new Error(errorMessage), { file: FILE });
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
    return { functional: 350, boilerplate: 50 };
  }
}

// ============================================================================
// FACTORY / SINGLETON
// ============================================================================

export function createMusicPlanner(): MusicPlanner {
  return new MusicPlanner();
}

let instance: MusicPlanner | null = null;

export function getMusicPlanner(): MusicPlanner {
  instance ??= createMusicPlanner();
  return instance;
}

// ============================================================================
// INTERNAL TEST HELPERS (exported for the proof-of-life harness)
// ============================================================================

export const __internal = {
  SPECIALIST_ID,
  DEFAULT_INDUSTRY_KEY,
  SUPPORTED_ACTIONS,
  MIN_OUTPUT_TOKENS_FOR_SCHEMA,
  loadGMConfig,
  buildSoundtrackPlanUserPrompt,
  buildMusicStyleUserPrompt,
  stripJsonFences,
  SoundtrackPlanResultSchema,
  MusicStyleResultSchema,
};
