/**
 * Video Script Data Model — the TIMED SCRIPT (Stage 1 of the video front door).
 *
 * This is the source of truth produced by the Screenwriter/Director agent
 * (VP-B) BEFORE any expensive keyframe/clip render. A human reviews + edits it
 * on the RenderZero form (VP-C); approving it hands off to the Shot Doc agent
 * (SHOT_PLAN_PLANNER) which authors the visual `ShotPlan`/Shot Doc (VP-D).
 *
 * The hierarchy (owner-approved field list, Jun 20 2026):
 *
 *   ScriptDocument            ← the whole timed script (video-level)
 *     ├─ locations: VideoLocation[]   ← REUSABLE list; scenes reference by id
 *     └─ scenes: ScriptScene[]        ← STORY BEATS (NOT locations)
 *          ├─ locationId → VideoLocation
 *          ├─ charactersPresent: ScriptSceneCharacter[]
 *          └─ shots: ScriptShot[]     ← the cuts within the beat
 *               ├─ cinematic: CinematicConfig  (REUSED — camera/lens/look)
 *               ├─ trimHandles: ScriptTrimHandles
 *               ├─ lines: ScriptLine[]         (timed spoken dialogue)
 *               ├─ onScreenText: OnScreenText[]
 *               └─ sfxCues: ScriptSfxCue[]
 *
 * KEY MODELING DECISIONS:
 *  - **Scenes are story beats, not locations.** One `VideoLocation` can host many
 *    scenes (free visual continuity); a scene carries a `locationId` REF, never an
 *    inlined location. (Spec decision #2.)
 *  - **The timed script is the source of truth for DURATION.** `totalSeconds` is
 *    DERIVED from the shots (see `deriveScriptTotalSeconds`), never a free input —
 *    runtime emerges from the script, there is no length slider. (Spec decision #5.)
 *  - **Cinematic/camera fields REUSE `CinematicConfig`** rather than re-declaring
 *    the camera/lens/look set. This mirrors how `ShotPlan` already reuses it via the
 *    look-bible (`CinematicConfigSchema.extend({ videographerStyle })`), so the deep
 *    RenderZero pickers round-trip 1:1 with no duplicate, drifting field set.
 *
 * Every interface has a matching Zod schema (the agent output AND the API validate
 * against the same contract) plus a compile-time parity guard — the exact pattern
 * used by `src/types/shot-plan.ts` and `src/types/video-project.ts`.
 */

import { z } from 'zod';

import { type CinematicConfig, CinematicConfigSchema } from '@/types/creative-studio';

// ============================================================================
// Shared: the cinematic/camera config reused at the shot level
// ============================================================================

/**
 * The shot-level cinematic config = the studio `CinematicConfigSchema` plus
 * `videographerStyle` (present on the `CinematicConfig` interface but missing from
 * the base schema). Identical reconciliation to `ShotPlanLookBibleSchema` so the
 * full deep-control set (shot type, camera, focal length, lens, lighting, film
 * stock, movie look, videographer style, composition, art style, …) round-trips
 * without loss and with NO duplicated camera-field declarations.
 */
export const ScriptCinematicConfigSchema = CinematicConfigSchema.extend({
  videographerStyle: z.string().trim().optional(),
});

// ============================================================================
// VideoLocation — REUSABLE at the video level; scenes reference these by id
// ============================================================================

/**
 * Interior vs exterior, the standard slate prefix for a shooting location.
 *  - `INT` — interior · `EXT` — exterior · `INT/EXT` — spans both (e.g. a car).
 */
export type LocationType = 'INT' | 'EXT' | 'INT/EXT';

export const LOCATION_TYPES: readonly LocationType[] = ['INT', 'EXT', 'INT/EXT'] as const;

/**
 * A reusable shooting location defined ONCE at the video level. Many scenes (story
 * beats) can share one location, which is how the production keeps free visual
 * continuity — every scene that references the same `id` inherits the same
 * environment/hero look. Scenes NEVER inline a location; they carry a `locationId`.
 */
export interface VideoLocation {
  /** Stable id referenced by `ScriptScene.locationId`. */
  id: string;
  /** Human label, e.g. "David's home office", "Rooftop terrace". */
  name: string;
  /** INT / EXT (+ implied locale) classification for the slate. */
  locationType: LocationType;
  /** Free-text locale note, e.g. "downtown high-rise", "rural Montana". */
  locale?: string;
  /** What the place IS — the prose description of the set. */
  description: string;
  /**
   * The environment / hero look — the establishing visual signature of this set
   * (set design, mood, defining features). The single strongest cross-scene
   * consistency anchor for everything shot here.
   */
  environmentLook: string;
  /** Optional AI-rendered hero/establishing image URL for this location. */
  heroImageUrl?: string;
  /** Default time of day for this location, e.g. "golden hour" (a scene may override). */
  defaultTimeOfDay?: string;
  /** Default weather / light quality, e.g. "clear, warm side-light" (a scene may override). */
  defaultWeather?: string;
}

// ============================================================================
// Timed-script payload (NEW) — lines, on-screen text, SFX cues
// ============================================================================

/**
 * Who delivers a spoken line. Either a cast character (by `characterId`, resolved
 * from the project cast) or the off-screen `narrator` (voiceover).
 */
export type ScriptSpeaker = { kind: 'character'; characterId: string } | { kind: 'narrator' };

/**
 * One timed spoken line. `startSec`/`endSec` are offsets WITHIN the parent shot
 * (0 = the shot's first frame). This is the per-line timing + speaker identity +
 * delivery note that voiceover lacked before (it was untracked narration).
 */
export interface ScriptLine {
  id: string;
  /** Who speaks this line. */
  speaker: ScriptSpeaker;
  /** The spoken text. */
  text: string;
  /** Line in-point, seconds from the start of the parent shot (>= 0). */
  startSec: number;
  /** Line out-point, seconds from the start of the parent shot (> startSec). */
  endSec: number;
  /** Delivery direction, e.g. "warm, conspiratorial", "clipped, urgent". */
  deliveryNote?: string;
}

/**
 * One on-screen text / caption, timed within the parent shot. Distinct from
 * spoken lines (`ScriptLine`) — this is burned-in / overlaid text.
 */
export interface OnScreenText {
  id: string;
  /** The text shown on screen. */
  text: string;
  /** Caption in-point, seconds from the start of the parent shot (>= 0). */
  startSec: number;
  /** Caption out-point, seconds from the start of the parent shot (> startSec). */
  endSec: number;
  /** Optional free-text style hint, e.g. "lower-third", "big-impact center". */
  style?: string;
}

/**
 * A timed SFX / stinger cue. `startSec` is the offset within the parent shot at
 * which the effect fires (e.g. a whoosh on a transition, a UI ding).
 */
export interface ScriptSfxCue {
  id: string;
  /** What the effect IS, e.g. "deep whoosh", "camera shutter click". */
  description: string;
  /** Cue trigger point, seconds from the start of the parent shot (>= 0). */
  startSec: number;
}

/**
 * Per-clip frame-trim handles for clean cuts + audio crossfade. The stitcher
 * trims `preRollSec` off the head and `postRollSec` off the tail of the generated
 * clip so consecutive cuts butt-join cleanly instead of being hard-joined raw.
 */
export interface ScriptTrimHandles {
  /** Seconds trimmed off the HEAD of the generated clip (>= 0). */
  preRollSec: number;
  /** Seconds trimmed off the TAIL of the generated clip (>= 0). */
  postRollSec: number;
}

// ============================================================================
// ScriptShot — a CUT within a scene
// ============================================================================

/**
 * How a shot begins/ends relative to its neighbours. Free string so the planner
 * can emit a label (e.g. "cut", "dissolve", "fade-to-black", "match-cut").
 */
export type ScriptTransition = string;

/**
 * One shot / cut within a scene. Carries the camera-grade controls (via the reused
 * `cinematic` config), the action/blocking, the timing + trim handles, and the
 * full timed-script payload (lines, on-screen text, SFX cues) for this cut.
 */
export interface ScriptShot {
  id: string;
  /** Position within the parent scene's `shots` (0-based). */
  index: number;
  /**
   * The camera-grade cinematic package — shot type, camera/body, focal length,
   * lens type, lighting, film stock, movie look, videographer style, composition,
   * art style. REUSES `CinematicConfig` (no duplicated camera fields).
   */
  cinematic: CinematicConfig;
  /**
   * Camera movement, e.g. "slow push-in", "handheld follow", "static". Kept
   * separate from `cinematic` because `CinematicConfig` has no movement field.
   */
  movement?: string;
  /** The action / blocking — what happens and how subjects move in this cut. */
  action: string;
  /** Intended duration of this cut, seconds (the timing source for the scene/doc). */
  durationSec: number;
  /** Transition INTO this shot (from the prior cut), e.g. "cut", "dissolve". */
  transitionIn?: ScriptTransition;
  /** Transition OUT of this shot (to the next cut). */
  transitionOut?: ScriptTransition;
  /** Frame-trim handles for clean stitching (pre-roll / post-roll). */
  trimHandles: ScriptTrimHandles;
  /** Timed spoken lines for this cut (speaker + start/end + delivery note). */
  lines: ScriptLine[];
  /** Timed on-screen text / captions for this cut. */
  onScreenText: OnScreenText[];
  /** Timed SFX / stinger cues for this cut. */
  sfxCues: ScriptSfxCue[];
}

// ============================================================================
// ScriptScene — a STORY BEAT (references a VideoLocation; NOT a location itself)
// ============================================================================

/**
 * A character present in a scene, with their per-scene wardrobe + state. References
 * a project cast member by `characterId`; the wardrobe/state overlay is the
 * continuity layer (what they wear + their condition for THIS beat).
 */
export interface ScriptSceneCharacter {
  /** References a project cast member (AvatarProfile / ShotPlan cast id). */
  characterId: string;
  /** Wardrobe for this scene, e.g. "soaked wool trench coat". */
  wardrobe?: string;
  /** Emotional + physical state for this scene, e.g. "exhausted, limping". */
  state?: string;
}

/**
 * A scene = a STORY BEAT, NOT a location. It references a `VideoLocation` by id
 * (many scenes may share one location). It carries the beat's intent, the
 * environment overrides for this beat, who is present, the mood, and the ordered
 * cuts (`shots`) that make up the beat.
 */
export interface ScriptScene {
  id: string;
  /** Position within the document's `scenes` (0-based). */
  index: number;
  /** What this beat is FOR — its narrative purpose, e.g. "the hook", "the turn". */
  purpose: string;
  /** Which reusable `VideoLocation` this beat is shot in. */
  locationId: string;
  /** Time of day for this beat (overrides the location default when set). */
  timeOfDay?: string;
  /** Weather / light for this beat (overrides the location default when set). */
  weather?: string;
  /** Who appears in this beat, with per-scene wardrobe + state. */
  charactersPresent: ScriptSceneCharacter[];
  /** Background sound bed / ambience, e.g. "quiet office hum, distant keyboards". */
  ambience?: string;
  /** The emotional register of this beat, e.g. "tense", "warm and inviting". */
  sceneMood?: string;
  /** The ordered cuts that make up this beat. */
  shots: ScriptShot[];
}

// ============================================================================
// ScriptDocument — the whole timed script (video-level)
// ============================================================================

/**
 * The video-level "look bible" carried on the script — palette + mood keywords +
 * overall film look. The Shot Doc agent inherits this when authoring visuals.
 */
export interface ScriptLookBible {
  /** Named palette colors, e.g. ["cold steel blue", "amber"]. */
  palette: string[];
  /** Mood keywords applied across the whole piece, e.g. ["tense", "hopeful"]. */
  moodKeywords: string[];
  /** The overall film look, e.g. "gritty 16mm documentary", "clean corporate 4K". */
  filmLook?: string;
}

/**
 * The complete TIMED SCRIPT — Stage 1 source of truth for the video. Authored by
 * the Screenwriter/Director agent, reviewed/edited on the form, then handed to the
 * Shot Doc agent. `totalSeconds` is DERIVED from the scenes' shots, never a free
 * input (see `deriveScriptTotalSeconds`).
 */
export interface ScriptDocument {
  id: string;
  title: string;
  /** The objective / goal of the video — what it must achieve. */
  objective: string;
  /** The single core message the video drives home. */
  coreMessage: string;
  /** The supporting key points to land. */
  keyPoints: string[];
  /** Who the video is FOR (the target viewer). */
  audience: string;
  /** Target platforms, e.g. ["youtube", "tiktok"]. Free strings (platform-agnostic). */
  platforms: string[];
  /** Tone / vibe of the piece, e.g. "conversational", "tech-noir cinematic". */
  tone?: string;
  /** The video-level look bible (palette / mood / film look). */
  lookBible: ScriptLookBible;
  /** Music direction, e.g. "warm underscore building to the CTA". */
  musicDirection?: string;
  /** The call to action the video closes on. */
  callToAction?: string;
  /** The cast available to the video — project cast member ids. */
  cast: string[];
  /** REUSABLE locations; scenes reference these by id (decision #2). */
  locations: VideoLocation[];
  /** The ordered story beats. */
  scenes: ScriptScene[];
  /**
   * DERIVED total runtime in seconds — the sum of every shot's `durationSec`
   * across every scene. NOT a free input: callers compute it via
   * `deriveScriptTotalSeconds(doc)` so runtime always emerges from the script
   * (there is no length slider). Persisted for fast display/sorting; treat
   * `deriveScriptTotalSeconds` as authoritative.
   */
  totalSeconds: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Authoritative runtime derivation: sum every shot's `durationSec` across every
 * scene. This is the single definition of "how long is the video" — `totalSeconds`
 * on a persisted doc is just a cached copy of this. Pure; safe on client + server.
 */
export function deriveScriptTotalSeconds(doc: Pick<ScriptDocument, 'scenes'>): number {
  return doc.scenes.reduce(
    (docSum, scene) => docSum + scene.shots.reduce((sceneSum, shot) => sceneSum + shot.durationSec, 0),
    0,
  );
}

// ============================================================================
// Zod Schemas — the agent output AND the API validate against these
// ============================================================================

export const LocationTypeSchema = z.enum(['INT', 'EXT', 'INT/EXT']);

export const VideoLocationSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  locationType: LocationTypeSchema,
  locale: z.string().trim().max(500).optional(),
  description: z.string().trim().max(4000).default(''),
  environmentLook: z.string().trim().max(4000).default(''),
  heroImageUrl: z.string().trim().url().optional(),
  defaultTimeOfDay: z.string().trim().max(200).optional(),
  defaultWeather: z.string().trim().max(200).optional(),
});

export const ScriptSpeakerSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('character'), characterId: z.string().trim().min(1).max(200) }),
  z.object({ kind: z.literal('narrator') }),
]);

export const ScriptLineSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    speaker: ScriptSpeakerSchema,
    text: z.string().trim().max(4000).default(''),
    startSec: z.number().min(0).max(36000),
    endSec: z.number().min(0).max(36000),
    deliveryNote: z.string().trim().max(1000).optional(),
  })
  .refine((l) => l.endSec > l.startSec, {
    message: 'endSec must be greater than startSec',
    path: ['endSec'],
  });

export const OnScreenTextSchema = z
  .object({
    id: z.string().trim().min(1).max(200),
    text: z.string().trim().max(2000).default(''),
    startSec: z.number().min(0).max(36000),
    endSec: z.number().min(0).max(36000),
    style: z.string().trim().max(200).optional(),
  })
  .refine((t) => t.endSec > t.startSec, {
    message: 'endSec must be greater than startSec',
    path: ['endSec'],
  });

export const ScriptSfxCueSchema = z.object({
  id: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(''),
  startSec: z.number().min(0).max(36000),
});

export const ScriptTrimHandlesSchema = z.object({
  preRollSec: z.number().min(0).max(60),
  postRollSec: z.number().min(0).max(60),
});

export const ScriptTransitionSchema = z.string().trim().max(200);

export const ScriptShotSchema = z.object({
  id: z.string().trim().min(1).max(200),
  index: z.number().int().min(0),
  cinematic: ScriptCinematicConfigSchema.default({}),
  movement: z.string().trim().max(500).optional(),
  action: z.string().trim().max(4000).default(''),
  durationSec: z.number().min(0).max(600),
  transitionIn: ScriptTransitionSchema.optional(),
  transitionOut: ScriptTransitionSchema.optional(),
  trimHandles: ScriptTrimHandlesSchema.default({ preRollSec: 0, postRollSec: 0 }),
  lines: z.array(ScriptLineSchema).max(100).default([]),
  onScreenText: z.array(OnScreenTextSchema).max(100).default([]),
  sfxCues: z.array(ScriptSfxCueSchema).max(100).default([]),
});

export const ScriptSceneCharacterSchema = z.object({
  characterId: z.string().trim().min(1).max(200),
  wardrobe: z.string().trim().max(2000).optional(),
  state: z.string().trim().max(2000).optional(),
});

export const ScriptSceneSchema = z.object({
  id: z.string().trim().min(1).max(200),
  index: z.number().int().min(0),
  purpose: z.string().trim().max(2000).default(''),
  locationId: z.string().trim().min(1).max(200),
  timeOfDay: z.string().trim().max(200).optional(),
  weather: z.string().trim().max(200).optional(),
  charactersPresent: z.array(ScriptSceneCharacterSchema).max(40).default([]),
  ambience: z.string().trim().max(2000).optional(),
  sceneMood: z.string().trim().max(2000).optional(),
  shots: z.array(ScriptShotSchema).max(200).default([]),
});

export const ScriptLookBibleSchema = z.object({
  palette: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  moodKeywords: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  filmLook: z.string().trim().max(2000).optional(),
});

export const ScriptDocumentSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().max(300).default(''),
  objective: z.string().trim().max(4000).default(''),
  coreMessage: z.string().trim().max(4000).default(''),
  keyPoints: z.array(z.string().trim().min(1).max(2000)).max(40).default([]),
  audience: z.string().trim().max(2000).default(''),
  platforms: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  tone: z.string().trim().max(500).optional(),
  lookBible: ScriptLookBibleSchema.default({ palette: [], moodKeywords: [] }),
  musicDirection: z.string().trim().max(2000).optional(),
  callToAction: z.string().trim().max(2000).optional(),
  cast: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  locations: z.array(VideoLocationSchema).max(40).default([]),
  scenes: z.array(ScriptSceneSchema).max(200).default([]),
  totalSeconds: z.number().min(0).max(360000).default(0),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
});

// ============================================================================
// Inferred-type parity guards
// ============================================================================
// These assignments make tsc fail if a schema and its interface ever drift.
// They are compile-time-only and erased at build (the exact pattern used by
// `src/types/shot-plan.ts` and `src/types/video-project.ts`).

type _VideoLocationParity = z.infer<typeof VideoLocationSchema> extends VideoLocation
  ? VideoLocation extends z.infer<typeof VideoLocationSchema>
    ? true
    : false
  : false;
type _ScriptLineParity = z.infer<typeof ScriptLineSchema> extends ScriptLine
  ? ScriptLine extends z.infer<typeof ScriptLineSchema>
    ? true
    : false
  : false;
type _ScriptShotParity = z.infer<typeof ScriptShotSchema> extends ScriptShot ? true : false;
type _ScriptSceneParity = z.infer<typeof ScriptSceneSchema> extends ScriptScene ? true : false;
type _ScriptDocumentParity = z.infer<typeof ScriptDocumentSchema> extends ScriptDocument
  ? true
  : false;

// Reference the guards so unused-type lint does not fire.
export const VIDEO_SCRIPT_TYPE_GUARDS: {
  videoLocation: _VideoLocationParity;
  scriptLine: _ScriptLineParity;
  scriptShot: _ScriptShotParity;
  scriptScene: _ScriptSceneParity;
  scriptDocument: _ScriptDocumentParity;
} = {
  videoLocation: true,
  scriptLine: true,
  scriptShot: true,
  scriptScene: true,
  scriptDocument: true,
};
