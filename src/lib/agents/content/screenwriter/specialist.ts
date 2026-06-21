/**
 * Screenwriter/Director — REAL AI AGENT (June 20 2026).
 *
 * Stage 1 of the video front door (VP-B). The screenwriter/director that turns a
 * plain-language creative prompt into a complete, contract-valid `ScriptDocument`:
 * a TIMED SCRIPT — the source of truth for DURATION and scene/shot structure that a
 * human reviews + edits on the RenderZero form (VP-C) BEFORE any expensive keyframe
 * render. Approving the script hands it off to the Shot Doc agent (SHOT_PLAN_PLANNER,
 * VP-D) which authors the visual ShotPlan.
 *
 * What it authors (owner-approved field list, Jun 20 2026):
 *  - The video envelope: title, objective, core message, key points, audience,
 *    platforms, tone, the look bible (palette / mood / film look), music direction, CTA.
 *  - A REUSABLE `locations[]` list (decision #2) — many scenes (story beats) may share
 *    one location; scenes carry a `locationId` REF, never an inlined location.
 *  - `scenes[]` as STORY BEATS — each references a `locationId`, lists the characters
 *    present (with per-scene wardrobe + state), and holds the ordered `shots[]` (cuts).
 *  - Per shot: the camera-grade `cinematic` package, action/blocking, `durationSec`,
 *    transitions, `trimHandles` (pre/post-roll), and the TIMED-SCRIPT layer — `lines[]`
 *    (speaker + startSec/endSec + delivery note), `onScreenText[]`, `sfxCues[]`.
 *
 * Standing Rule #1: loads its Golden Master from Firestore at runtime (Brand DNA baked
 * in at seed time) and uses `gm.systemPrompt` VERBATIM — no runtime Brand DNA loading,
 * no `getBrandDNA()` call here. If the GM is missing, the LLM fails, the JSON won't
 * parse, or the script fails `ScriptDocumentSchema`, it throws an honest error (one
 * retry on an invalid script, feeding the zod errors back to the model).
 *
 * Standing Rule #2: there is NO self-editing/auto-improve path here. It generates from
 * a brief; it never edits its own GM. Prompt changes flow ONLY through the human grade →
 * Prompt Engineer surgical edit → new GM version pipeline.
 *
 * Model: Opus tier (the most demanding reasoning task in the app — matches the Shot Plan
 * Planner's "run on Opus" note). The actual model is read from the GM config, never
 * hardcoded; the fallback below is the top-tier Opus model the codebase exposes.
 */

import { z } from 'zod';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { listAvatarProfiles, type AvatarProfile } from '@/lib/video/avatar-profile-service';
import { listLocationProfiles } from '@/lib/video/location-profile-service';
import type { LocationProfile } from '@/types/location';
import {
  ScriptDocumentSchema,
  deriveScriptTotalSeconds,
  type ScriptDocument,
  type ScriptScene,
  type ScriptShot,
  type ScriptLine,
  type ScriptSpeaker,
  type VideoLocation,
} from '@/types/video-script';
import type { CinematicConfig } from '@/types/creative-studio';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'content/screenwriter/specialist.ts';
const SPECIALIST_ID = 'SCREENWRITER_DIRECTOR';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

/**
 * A full timed script is a sizeable JSON object (every scene's beats, every shot's
 * timed lines / captions / SFX) — give it generous output headroom so the JSON does
 * not truncate into invalid JSON. Mirrors the Shot Plan Planner's headroom.
 */
const MIN_OUTPUT_TOKENS_FOR_SCRIPT = 16000;

/**
 * Top-tier Opus model fallback. The real model is read from the GM config (seeded by
 * scripts/seed-screenwriter-director-gm.js); this is only used if the GM omits it.
 * `claude-opus-4.6` is the highest Opus the ModelName union exposes and is what the
 * sibling Shot Plan Planner uses for its "run on Opus" requirement.
 */
const DEFAULT_MODEL: ModelName = 'claude-opus-4.6';

interface ScreenwriterGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
}

// ============================================================================
// INPUT CONTRACT — mirrors the Shot Plan Planner's planner-style input
// ============================================================================

const GenerateScriptInputSchema = z.object({
  /** The creative brief / prompt, in plain language. */
  brief: z.string().trim().min(1),
  /** Owner of the Character / Location libraries to resolve selections from. */
  userId: z.string().trim().min(1),
  /** Optional title hint for the script. */
  title: z.string().trim().max(300).optional(),
  /** Target platforms, e.g. ["youtube", "tiktok"]. The screenwriter still decides if omitted. */
  platforms: z.array(z.string().trim().min(1).max(120)).max(40).optional(),
  /** Desired tone / vibe hint, e.g. "conversational", "tech-noir cinematic". */
  tone: z.string().trim().max(500).optional(),
  /**
   * Saved Character-Library characters the operator EXPLICITLY chose to cast. ONLY
   * these are bound to real saved ids; every other character the brief needs is
   * INVENTED with a fresh id. Omitted/empty = invent all characters. (Mirrors the
   * Shot Plan Planner — never auto-pull a saved character by a name match.)
   */
  selectedCharacterIds: z.array(z.string().trim().min(1)).max(50).optional(),
  /**
   * Saved Location-Library locations the operator EXPLICITLY chose. When provided, the
   * script's locations are anchored to these saved sets (the screenwriter authors each
   * from its locked description). Omitted/empty = the screenwriter invents locations.
   */
  selectedLocationIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

export type GenerateScriptInput = z.infer<typeof GenerateScriptInputSchema>;

// ============================================================================
// LLM-FACING SCHEMAS — what the model returns (then mapped into the contract)
// ============================================================================

/** The model returns the speaker as a tagged shape we map onto `ScriptSpeaker`. */
const LlmSpeakerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('character'), characterId: z.string().trim().min(1) }),
  z.object({ kind: z.literal('narrator') }),
]);

const LlmLineSchema = z.object({
  speaker: LlmSpeakerSchema,
  text: z.string().trim().min(1),
  startSec: z.number().min(0).max(36000),
  endSec: z.number().min(0).max(36000),
  deliveryNote: z.string().trim().min(1).optional(),
});

const LlmOnScreenTextSchema = z.object({
  text: z.string().trim().min(1),
  startSec: z.number().min(0).max(36000),
  endSec: z.number().min(0).max(36000),
  style: z.string().trim().min(1).optional(),
});

const LlmSfxCueSchema = z.object({
  description: z.string().trim().min(1),
  startSec: z.number().min(0).max(36000),
});

/** The shot-level cinematic package the model returns (maps onto `CinematicConfig`). */
const LlmCinematicSchema = z.object({
  shotType: z.string().trim().min(1),
  composition: z.string().trim().min(1).optional(),
  lighting: z.string().trim().min(1).optional(),
  atmosphere: z.string().trim().min(1).optional(),
  camera: z.string().trim().min(1).optional(),
  focalLength: z.string().trim().min(1).optional(),
  lensType: z.string().trim().min(1).optional(),
  filmStock: z.string().trim().min(1).optional(),
  movieLook: z.string().trim().min(1).optional(),
  videographerStyle: z.string().trim().min(1).optional(),
  artStyle: z.string().trim().min(1).optional(),
});

const LlmShotSchema = z.object({
  cinematic: LlmCinematicSchema,
  movement: z.string().trim().min(1).optional(),
  action: z.string().trim().min(1),
  durationSec: z.number().min(0.5).max(600),
  transitionIn: z.string().trim().min(1).optional(),
  transitionOut: z.string().trim().min(1).optional(),
  trimHandles: z
    .object({
      preRollSec: z.number().min(0).max(60),
      postRollSec: z.number().min(0).max(60),
    })
    .optional(),
  lines: z.array(LlmLineSchema).max(100).default([]),
  onScreenText: z.array(LlmOnScreenTextSchema).max(100).default([]),
  sfxCues: z.array(LlmSfxCueSchema).max(100).default([]),
});

const LlmSceneCharacterSchema = z.object({
  characterId: z.string().trim().min(1),
  wardrobe: z.string().trim().min(1).optional(),
  state: z.string().trim().min(1).optional(),
});

const LlmSceneSchema = z.object({
  purpose: z.string().trim().min(1),
  /** References a `locations[]` entry by the model's OWN locationId (we remap to stable ids). */
  locationId: z.string().trim().min(1),
  timeOfDay: z.string().trim().min(1).optional(),
  weather: z.string().trim().min(1).optional(),
  charactersPresent: z.array(LlmSceneCharacterSchema).max(40).default([]),
  ambience: z.string().trim().min(1).optional(),
  sceneMood: z.string().trim().min(1).optional(),
  shots: z.array(LlmShotSchema).min(1).max(60),
});

const LlmLocationSchema = z.object({
  /** The model's own id for this location, referenced by `scenes[].locationId`. */
  id: z.string().trim().min(1),
  name: z.string().trim().min(1),
  locationType: z.enum(['INT', 'EXT', 'INT/EXT']),
  locale: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1),
  environmentLook: z.string().trim().min(1),
  defaultTimeOfDay: z.string().trim().min(1).optional(),
  defaultWeather: z.string().trim().min(1).optional(),
});

const LlmLookBibleSchema = z.object({
  palette: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
  moodKeywords: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
  filmLook: z.string().trim().min(1).optional(),
});

/** The script body the model returns (envelope id/createdAt/updatedAt + ids are ours). */
const LlmScriptSchema = z.object({
  title: z.string().trim().min(1),
  objective: z.string().trim().min(1),
  coreMessage: z.string().trim().min(1),
  keyPoints: z.array(z.string().trim().min(1)).min(1).max(40),
  audience: z.string().trim().min(1),
  platforms: z.array(z.string().trim().min(1).max(120)).min(1).max(40),
  tone: z.string().trim().min(1).optional(),
  lookBible: LlmLookBibleSchema,
  musicDirection: z.string().trim().min(1).optional(),
  callToAction: z.string().trim().min(1).optional(),
  locations: z.array(LlmLocationSchema).min(1).max(40),
  scenes: z.array(LlmSceneSchema).min(1).max(200),
});

type LlmScript = z.infer<typeof LlmScriptSchema>;

// ============================================================================
// GM LOADER (Standing Rule #1 — systemPrompt VERBATIM, no Brand DNA merge)
// ============================================================================

async function loadGMConfig(industryKey: string): Promise<ScreenwriterGMConfig> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Screenwriter/Director GM not found for industryKey=${industryKey}. ` +
        `Run node scripts/seed-screenwriter-director-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<ScreenwriterGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Screenwriter/Director GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  return {
    systemPrompt,
    model: config.model ?? DEFAULT_MODEL,
    temperature: config.temperature ?? 0.6,
    maxTokens: Math.max(config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_SCRIPT, MIN_OUTPUT_TOKENS_FOR_SCRIPT),
  };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

async function callOpenRouter(
  gm: ScreenwriterGMConfig,
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
      `Screenwriter/Director: LLM response truncated at maxTokens=${maxTokens} (finish_reason='length').`,
    );
  }
  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// CAST / LOCATION RESOLUTION (the real saved assets the operator selected)
// ============================================================================

/** Describe the SELECTED saved characters for the model — real ids only, no invented data. */
function buildAvailableCastBlock(profiles: AvatarProfile[]): string {
  if (profiles.length === 0) {
    return '  (NONE selected — the operator picked no saved character. INVENT every character the brief needs as a NEW cast member with a FRESH unique id like "new_1", "new_2". Do NOT use any saved character id.)';
  }
  return profiles
    .map((p) => {
      const looks =
        p.looks.length > 0
          ? p.looks
              .map((l) => `        - lookId "${l.id}" = "${l.name}" (${l.outfitDescription || 'no description'})`)
              .join('\n')
          : '        (no alternate looks)';
      return [
        `  - characterId "${p.id}" = "${p.name}" [role: ${p.role}, style: ${p.styleTag}]`,
        p.description ? `      description: ${p.description}` : '',
        '      looks:',
        looks,
      ]
        .filter((line) => line !== '')
        .join('\n');
    })
    .join('\n');
}

/** Describe the SELECTED saved locations for the model — author each from its locked description. */
function buildSelectedLocationsBlock(locations: LocationProfile[]): string {
  if (locations.length === 0) {
    return '  (NONE selected — no location is locked. INVENT the locations from the brief: author each VideoLocation freely.)';
  }
  return locations
    .map((loc, i) => {
      const desc = loc.description.trim() || '(no description was captured for this set)';
      return [
        `  ${i + 1}. SAVED LOCATION "${loc.name}" (locationId "${loc.id}")`,
        `       LOCKED SET DESCRIPTION (author this location's description + environmentLook STRICTLY from this — same furniture, windows, layout): ${desc}`,
        '       Use this EXACT locationId as the VideoLocation.id so scenes can reference it.',
      ].join('\n');
    })
    .join('\n');
}

// ============================================================================
// PROMPT BUILDER
// ============================================================================

function buildGenerateUserPrompt(
  input: GenerateScriptInput,
  availableCastBlock: string,
  selectedLocationsBlock: string,
  hasSelectedLocations: boolean,
  priorZodErrors?: string,
): string {
  return [
    'TASK: Turn the creative brief below into ONE complete, TIMED video SCRIPT as STRICT JSON.',
    '',
    `CREATIVE BRIEF: ${input.brief}`,
    input.title ? `TITLE HINT: ${input.title}` : '',
    input.platforms && input.platforms.length > 0
      ? `TARGET PLATFORMS: ${input.platforms.join(', ')}`
      : 'TARGET PLATFORMS: you decide from the brief.',
    input.tone ? `TONE HINT: ${input.tone}` : '',
    '',
    'SELECTED SAVED CHARACTERS — the operator EXPLICITLY chose these to appear. Bind each by its EXACT characterId where the story calls for it. For ANY other character the brief needs, INVENT a NEW one with a fresh unique id (e.g. "new_1") — never reach into the library on your own, never reuse a saved id you were not given:',
    availableCastBlock,
    '',
    'SELECTED LOCATIONS — saved digital sets the operator EXPLICITLY chose. Author each as a VideoLocation using its EXACT locationId, with its description + environmentLook authored STRICTLY from the locked description. When NONE are selected, invent the locations from the brief:',
    selectedLocationsBlock,
    '',
    hasSelectedLocations
      ? 'LOCATIONS ARE ANCHORED — author one VideoLocation per selected location above, reusing its exact locationId, and make every scene shot there reference that locationId.'
      : '',
    'OUTPUT CONTRACT — return ONLY this JSON object (no markdown, no preamble):',
    '{',
    '  "title": string,',
    '  "objective": string,                 // what the video must achieve',
    '  "coreMessage": string,               // the single core message',
    '  "keyPoints": [string],               // supporting points to land',
    '  "audience": string,                  // who the video is FOR',
    '  "platforms": [string],               // target platforms (free strings)',
    '  "tone": string,                      // tone / vibe of the piece',
    '  "lookBible": { "palette": [string], "moodKeywords": [string], "filmLook": string },',
    '  "musicDirection": string,            // music direction for the whole piece',
    '  "callToAction": string,              // the CTA the video closes on',
    '  "locations": [                       // REUSABLE list; scenes reference by id. Many scenes may share one location.',
    '    { "id": "<unique id, e.g. loc_1>", "name": string, "locationType": "INT" | "EXT" | "INT/EXT", "locale": string, "description": string, "environmentLook": string, "defaultTimeOfDay": string, "defaultWeather": string }',
    '  ],',
    '  "scenes": [                          // ordered STORY BEATS (NOT locations); a scene references a location by id',
    '    {',
    '      "purpose": string,               // what this beat is FOR (e.g. "the hook", "the turn")',
    '      "locationId": "<id from locations[]>",',
    '      "timeOfDay": string,             // overrides the location default when set',
    '      "weather": string,               // overrides the location default when set',
    '      "charactersPresent": [ { "characterId": string, "wardrobe": string, "state": string } ],',
    '      "ambience": string,              // background sound bed / ambience',
    '      "sceneMood": string,             // emotional register of the beat',
    '      "shots": [                       // the ordered CUTS within the beat',
    '        {',
    '          "cinematic": { "shotType": string, "composition": string, "lighting": string, "atmosphere": string, "camera": string, "focalLength": string, "lensType": string, "filmStock": string, "movieLook": string, "videographerStyle": string, "artStyle": string },',
    '          "movement": string,          // camera movement (e.g. "slow push-in", "static")',
    '          "action": string,            // the action / blocking — what happens in this cut',
    '          "durationSec": number,       // intended duration of this cut (the timing source)',
    '          "transitionIn": string,      // e.g. "cut", "dissolve" (first shot = "cut")',
    '          "transitionOut": string,',
    '          "trimHandles": { "preRollSec": number, "postRollSec": number },  // frames trimmed for clean stitching',
    '          "lines": [ { "speaker": { "kind": "character", "characterId": string } | { "kind": "narrator" }, "text": string, "startSec": number, "endSec": number, "deliveryNote": string } ],  // TIMED spoken lines; startSec/endSec are offsets WITHIN this shot',
    '          "onScreenText": [ { "text": string, "startSec": number, "endSec": number, "style": string } ],  // timed captions, offsets within this shot',
    '          "sfxCues": [ { "description": string, "startSec": number } ]  // timed SFX / stingers, offset within this shot',
    '        }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    'HARD RULES:',
    '- YOU decide how many SCENES (story beats) and how many SHOTS per scene the story needs. A scene is a BEAT, not a location — multiple scenes MAY share one location (reuse its locationId). Author the locations[] list ONCE and reference it.',
    '- The TIMED SCRIPT is the source of truth for DURATION. Set every shot\'s durationSec; total runtime emerges from the shots (there is no length slider).',
    '- TIMING IS PER-SHOT-RELATIVE: every line/caption/SFX startSec and endSec is measured from the START of its parent shot (0 = the shot\'s first frame), and must fall within that shot\'s durationSec. For every line and caption, endSec MUST be greater than startSec.',
    '- Give EVERY spoken line a speaker (a cast characterId that is present in the scene, or the off-screen narrator), the text, startSec, endSec, and a deliveryNote. A shot with no dialogue simply has an empty "lines": [].',
    '- SPEAKING shots should be framed medium-or-tighter (lip-sync on a small face is unreadable) — set cinematic.shotType accordingly; wides/establishing shots carry NO dialogue.',
    '- Bind the SELECTED saved characters by their EXACT characterId. INVENT every other character with a fresh unique id (e.g. "new_1"). Reference characters per-scene in charactersPresent and per-line via the line\'s speaker.',
    '- Author one VideoLocation per SELECTED location (reuse its exact locationId); invent the rest. EVERY scene\'s locationId MUST exist in locations[].',
    '- transitionIn: the FIRST shot of the FIRST scene is "cut"; use "cut" for a new location or a time jump, otherwise a continuous transition (e.g. "continue", "match-cut").',
    '- Fill the lookBible (palette + mood keywords + film look) and keep every scene/shot consistent with it. Stay on-brand (see the Brand DNA in your system prompt). Never use any forbidden phrase. Never fabricate logos, statistics, or claims.',
    '- Output ONLY the JSON object.',
    priorZodErrors
      ? `\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix exactly these problems and return corrected JSON only:\n${priorZodErrors}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ============================================================================
// ASSEMBLY — map the LLM body onto the ScriptDocument contract
// ============================================================================

function isoNow(): string {
  return new Date().toISOString();
}

function randomSuffix(): string {
  return Math.random().toString(36).slice(2, 8);
}

/** Map an LLM cinematic package onto `CinematicConfig`, dropping empty optionals. */
function mapCinematic(llm: LlmScript['scenes'][number]['shots'][number]['cinematic']): CinematicConfig {
  const out: CinematicConfig = { shotType: llm.shotType };
  if (llm.composition) { out.composition = llm.composition; }
  if (llm.lighting) { out.lighting = llm.lighting; }
  if (llm.atmosphere) { out.atmosphere = llm.atmosphere; }
  if (llm.camera) { out.camera = llm.camera; }
  if (llm.focalLength) { out.focalLength = llm.focalLength; }
  if (llm.lensType) { out.lensType = llm.lensType; }
  if (llm.filmStock) { out.filmStock = llm.filmStock; }
  if (llm.movieLook) { out.movieLook = llm.movieLook; }
  if (llm.videographerStyle) { out.videographerStyle = llm.videographerStyle; }
  if (llm.artStyle) { out.artStyle = llm.artStyle; }
  return out;
}

function mapSpeaker(llm: z.infer<typeof LlmSpeakerSchema>): ScriptSpeaker {
  return llm.kind === 'character'
    ? { kind: 'character', characterId: llm.characterId }
    : { kind: 'narrator' };
}

/**
 * Assemble the contract-valid `ScriptDocument` from the model body + the resolved
 * saved-character / location ids. Locations keep the model's own ids (so scenes that
 * reference them still resolve); scene/shot/line ids are generated. `cast` is the union
 * of selected saved ids + every characterId the script actually uses.
 */
function assembleScript(
  body: LlmScript,
  titleHint: string | undefined,
  selectedCharacterIds: Set<string>,
): ScriptDocument {
  const now = isoNow();

  const locations: VideoLocation[] = body.locations.map((loc) => ({
    id: loc.id,
    name: loc.name,
    locationType: loc.locationType,
    ...(loc.locale ? { locale: loc.locale } : {}),
    description: loc.description,
    environmentLook: loc.environmentLook,
    ...(loc.defaultTimeOfDay ? { defaultTimeOfDay: loc.defaultTimeOfDay } : {}),
    ...(loc.defaultWeather ? { defaultWeather: loc.defaultWeather } : {}),
  }));
  const validLocationIds = new Set(locations.map((l) => l.id));

  // Collect every characterId the script references so `cast` is complete (selected
  // saved ids + every invented id the screenwriter actually used).
  const usedCharacterIds = new Set<string>(selectedCharacterIds);

  const scenes: ScriptScene[] = body.scenes.map((scene, sceneIndex) => {
    for (const cp of scene.charactersPresent) {
      usedCharacterIds.add(cp.characterId);
    }
    const shots: ScriptShot[] = scene.shots.map((shot, shotIndex) => {
      const lines: ScriptLine[] = shot.lines.map((line, lineIndex) => {
        const speaker = mapSpeaker(line.speaker);
        if (speaker.kind === 'character') {
          usedCharacterIds.add(speaker.characterId);
        }
        return {
          id: `line_${sceneIndex + 1}_${shotIndex + 1}_${lineIndex + 1}_${randomSuffix()}`,
          speaker,
          text: line.text,
          startSec: line.startSec,
          endSec: line.endSec,
          ...(line.deliveryNote ? { deliveryNote: line.deliveryNote } : {}),
        };
      });
      const onScreenText = shot.onScreenText.map((t, i) => ({
        id: `ost_${sceneIndex + 1}_${shotIndex + 1}_${i + 1}_${randomSuffix()}`,
        text: t.text,
        startSec: t.startSec,
        endSec: t.endSec,
        ...(t.style ? { style: t.style } : {}),
      }));
      const sfxCues = shot.sfxCues.map((c, i) => ({
        id: `sfx_${sceneIndex + 1}_${shotIndex + 1}_${i + 1}_${randomSuffix()}`,
        description: c.description,
        startSec: c.startSec,
      }));
      const isFirstShotOverall = sceneIndex === 0 && shotIndex === 0;
      return {
        id: `shot_${sceneIndex + 1}_${shotIndex + 1}_${randomSuffix()}`,
        index: shotIndex,
        cinematic: mapCinematic(shot.cinematic),
        ...(shot.movement ? { movement: shot.movement } : {}),
        action: shot.action,
        durationSec: shot.durationSec,
        // The very first cut can never continue from anything — force a clean cut.
        transitionIn: isFirstShotOverall ? 'cut' : (shot.transitionIn ?? 'cut'),
        ...(shot.transitionOut ? { transitionOut: shot.transitionOut } : {}),
        trimHandles: shot.trimHandles ?? { preRollSec: 0, postRollSec: 0 },
        lines,
        onScreenText,
        sfxCues,
      };
    });

    return {
      id: `scene_${sceneIndex + 1}_${randomSuffix()}`,
      index: sceneIndex,
      purpose: scene.purpose,
      // Keep only a location reference that resolves; fall back to the first location.
      locationId: validLocationIds.has(scene.locationId)
        ? scene.locationId
        : (locations[0]?.id ?? scene.locationId),
      ...(scene.timeOfDay ? { timeOfDay: scene.timeOfDay } : {}),
      ...(scene.weather ? { weather: scene.weather } : {}),
      charactersPresent: scene.charactersPresent.map((cp) => ({
        characterId: cp.characterId,
        ...(cp.wardrobe ? { wardrobe: cp.wardrobe } : {}),
        ...(cp.state ? { state: cp.state } : {}),
      })),
      ...(scene.ambience ? { ambience: scene.ambience } : {}),
      ...(scene.sceneMood ? { sceneMood: scene.sceneMood } : {}),
      shots,
    };
  });

  const candidate: ScriptDocument = {
    id: `script_${Date.now()}_${randomSuffix()}`,
    title: titleHint ?? body.title,
    objective: body.objective,
    coreMessage: body.coreMessage,
    keyPoints: body.keyPoints,
    audience: body.audience,
    platforms: body.platforms,
    ...(body.tone ? { tone: body.tone } : {}),
    lookBible: {
      palette: body.lookBible.palette,
      moodKeywords: body.lookBible.moodKeywords,
      ...(body.lookBible.filmLook ? { filmLook: body.lookBible.filmLook } : {}),
    },
    ...(body.musicDirection ? { musicDirection: body.musicDirection } : {}),
    ...(body.callToAction ? { callToAction: body.callToAction } : {}),
    cast: Array.from(usedCharacterIds),
    locations,
    scenes,
    totalSeconds: deriveScriptTotalSeconds({ scenes }),
    createdAt: now,
    updatedAt: now,
  };

  return candidate;
}

// ============================================================================
// PUBLIC: generateScript
// ============================================================================

/**
 * Generate a complete, contract-valid `ScriptDocument` (timed script) from a creative
 * brief. Binds the operator's EXPLICITLY-selected saved characters / locations and
 * invents the rest. Retries once with the zod errors fed back if the first assembled
 * script fails `ScriptDocumentSchema`.
 */
export async function generateScript(input: GenerateScriptInput): Promise<ScriptDocument> {
  const validated = GenerateScriptInputSchema.parse(input);
  const gm = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

  // ONLY the characters the operator EXPLICITLY selected are real saved cast; everyone
  // else is invented fresh (mirrors the Shot Plan Planner — no auto-pull by name).
  const selectedIds = new Set(validated.selectedCharacterIds ?? []);
  const profiles =
    selectedIds.size > 0
      ? (await listAvatarProfiles(validated.userId, { ownOnly: true })).filter((p) => selectedIds.has(p.id))
      : [];
  const availableCastBlock = buildAvailableCastBlock(profiles);

  // ONLY the locations the operator EXPLICITLY selected anchor the environment.
  const selectedLocationIds = validated.selectedLocationIds ?? [];
  const locations =
    selectedLocationIds.length > 0
      ? (await listLocationProfiles(validated.userId, { ownOnly: true })).filter((l) =>
          selectedLocationIds.includes(l.id),
        )
      : [];
  const selectedLocationsBlock = buildSelectedLocationsBlock(locations);

  let priorZodErrors: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = buildGenerateUserPrompt(
      validated,
      availableCastBlock,
      selectedLocationsBlock,
      locations.length > 0,
      priorZodErrors,
    );
    const rawContent = await callOpenRouter(gm, userPrompt, gm.maxTokens);

    let parsedJson: unknown;
    try {
      parsedJson = JSON.parse(stripJsonFences(rawContent));
    } catch {
      priorZodErrors = `Output was not valid JSON: ${rawContent.slice(0, 200)}`;
      continue;
    }

    const bodyResult = LlmScriptSchema.safeParse(parsedJson);
    if (!bodyResult.success) {
      priorZodErrors = bodyResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      continue;
    }

    const candidate = assembleScript(bodyResult.data, validated.title, selectedIds);

    const finalResult = ScriptDocumentSchema.safeParse(candidate);
    if (!finalResult.success) {
      priorZodErrors = finalResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      continue;
    }

    logger.info('[ScreenwriterDirector] script generated', {
      scenes: finalResult.data.scenes.length,
      totalSeconds: finalResult.data.totalSeconds,
      castSize: finalResult.data.cast.length,
      file: FILE,
    });
    return finalResult.data;
  }

  throw new Error(
    `Screenwriter/Director could not produce a valid ScriptDocument after 2 attempts. Last errors: ${priorZodErrors ?? 'unknown'}`,
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
  buildAvailableCastBlock,
  buildSelectedLocationsBlock,
  buildGenerateUserPrompt,
  mapCinematic,
  mapSpeaker,
  assembleScript,
  LlmScriptSchema,
  GenerateScriptInputSchema,
  ScriptDocumentSchema,
};
