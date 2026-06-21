/**
 * Shot Plan Data Model — OpenArt "Smart Shot"-style production sheet.
 *
 * The Shot Plan is the keystone, FIELD-ADDRESSABLE structure that powers a
 * director-grade, surgically-editable storyboard. It mirrors OpenArt's verified
 * 4-section production sheet:
 *
 *   1. Shared Choices  — the project-level "look bible" inherited by every shot
 *                        (cut count, palette, environment fingerprint, cast,
 *                        mood, cinematography notes, art style).
 *   2. Transition      — per-shot chaining mode: `continue` (chain from the prior
 *                        shot's last frame for an unbroken take) or `cut` (fresh).
 *   3. Shots           — the ordered cuts, every field individually editable so a
 *                        single field can be regenerated WITHOUT re-rolling the
 *                        whole plan.
 *   4. Plan envelope   — id/title/timestamps/status wrapping the above.
 *
 * ADDITIVE: this is a NEW model. It maps onto the existing `PipelineScene` /
 * `PipelineProject` pipeline via `src/lib/video/shot-plan-mapping.ts` so the
 * established generation pipeline + editor can consume a plan unchanged. Drafts
 * persist via the OPTIONAL `PipelineProject.shotPlan` field.
 *
 * Every type has a matching Zod schema so the planner output AND the API can
 * validate against the exact same contract.
 */

import { z } from 'zod';

import {
  type CinematicConfig,
  type ViewingDirection,
  CinematicConfigSchema,
  VIEWING_DIRECTIONS,
} from '@/types/creative-studio';

// ============================================================================
// Shared Choices — the project-level "look bible"
// ============================================================================

/**
 * A named color swatch in the project palette, e.g.
 * `{ name: 'cold steel blue', hex: '#1f2937' }`. The name is the human/AI
 * handle; the hex is the exact value used for consistency.
 */
export interface ShotPlanColorSwatch {
  name: string;
  hex: string;
}

/**
 * A member of the production's cast, resolved from an `AvatarProfile`
 * (+ optional `CharacterLook`). `referenceImageUrls` are the identity anchors
 * copied from the profile so the planner does not need a second lookup at
 * generation time.
 */
export interface ShotPlanCastMember {
  /** AvatarProfile id (Character Library). */
  characterId: string;
  /** CharacterLook id when a specific look/outfit/state is chosen. `null` = the
   *  planner explicitly chose no specific look (treated the same as absent). */
  lookId?: string | null;
  /** Display name, e.g. "David (civilian)". */
  name: string;
  /** Identity-anchor reference images resolved from the profile/look. */
  referenceImageUrls: string[];
  /** Free-text role, e.g. "hero", "narrator", "background extra". */
  role?: string;
  /** Doc layout weight: a `lead` gets the big block, `supporting` a smaller one. */
  billing?: 'lead' | 'supporting';
  /**
   * What kind of subject this member is. A `group` is several people shown as a
   * single block (e.g. "Cannibal Tribe Hunters"); drives adaptive doc labeling.
   */
  subjectKind?: 'person' | 'creature' | 'group';
  /**
   * Descriptive character notes — wardrobe, features, demeanor, hero props
   * (e.g. "soaked wool coat, gaunt eyes, cigarette + lighter as hero props").
   * Shown beside the palette in the character block; the planner fills it.
   */
  notes?: string;
  /** Apparent age range, e.g. "late 30s", "child ~8". */
  apparentAge?: string;
  /** Gender presentation, e.g. "male", "female", "androgynous". */
  gender?: string;
  /** Ethnicity / heritage cue for casting consistency. */
  ethnicity?: string;
  /** Body type / height, e.g. "tall, lean", "stocky, 5'6\"". */
  build?: string;
  /** Hair color, e.g. "jet black", "silver-grey". */
  hairColor?: string;
  /** Hair style, e.g. "slicked back", "shoulder-length waves". */
  hairStyle?: string;
  /** The defining outfit for this look, e.g. "soaked wool trench coat". */
  wardrobe?: string;
  /** Recurring accessories — watch, glasses, hat, bag, etc. */
  accessories?: string[];
  /**
   * Wardrobe handling across scenes. `flexible` (default) re-costumes per scene;
   * `signature` keeps the defining outfit constant for an iconic look.
   */
  wardrobeMode?: 'flexible' | 'signature';
  /**
   * AI-rendered model/turnaround sheet for this character (labeled views like
   * FRONT / 3⁄4 / PROFILE / BACK / DETAIL), generated from the reference at render
   * time so the production sheet shows a rich character reference, not just uploads.
   */
  modelSheet?: { label: string; imageUrl: string }[];
  /**
   * Operator opt-in: when true, this (invented) character is saved to the Character
   * Library at generation time — once its reference art exists — so it can be reused
   * in future videos. Already-saved (library-sourced) characters ignore this.
   */
  saveToLibrary?: boolean;
}

/**
 * A non-character production OBJECT / prop — a vehicle, product, weapon, creature
 * rig, set piece — that recurs across shots and needs visual consistency. The
 * `referenceImageUrls` are its appearance anchors (uploaded or library) so the
 * engine renders the SAME object every shot, exactly like cast identity anchoring.
 * This is OpenArt's "Objects" half of its "Characters & Objects" reference bucket.
 */
export interface ShotPlanObject {
  /** Stable id used by shots' `objectIds`. */
  id: string;
  /** Display name / model designation, e.g. "Weaponized drone — BARRD-9X". */
  name: string;
  /** Appearance-anchor reference images (uploaded or from the media library). */
  referenceImageUrls: string[];
  /** Whether this is an inanimate `object`/prop or a non-cast `creature` rig. */
  subjectKind?: 'object' | 'creature';
  /** Optional material-language / detail note, e.g. "matte gunmetal, scarred armor". */
  description?: string;
}

/**
 * A rendered lighting-setup swatch for the mood board — a named, thumbnail-sized
 * render of one lighting condition (e.g. "backlit smoke / tracer glow").
 */
export interface ShotPlanLightingSwatch {
  label: string;
  imageUrl: string;
}

/**
 * One distinct location/area when the video spans multiple environments. The doc
 * renders a hero image per zone plus a per-zone slice of the top-down route strip,
 * so a multi-location story reads as a sequence of clearly bounded sets.
 */
export interface ShotPlanEnvironmentZone {
  /** Stable id used by shots' route grouping and the floor-plan zone bands. */
  id: string;
  /** Human label, e.g. "Zone 1 · Workspace (Home)". */
  label: string;
  /** AI hero render establishing this zone's look. */
  heroImageUrl?: string;
  /** Bulleted set-design elements specific to this zone. */
  setDesign?: string[];
  /** Ids of the shots that occur in this zone. */
  cutIds?: string[];
}

/**
 * The project-level look bible. Every shot inherits these unless it overrides a
 * specific field. The `environmentFingerprint` is the written signature of the
 * world and the single strongest cross-shot consistency anchor.
 */
export interface ShotPlanSharedChoices {
  /** How many shots/cuts the plan is built for. */
  cutCount: number;
  /** Era/year the project is set in, e.g. "1947 post-war", "near-future 2090". */
  timePeriod?: string;
  /** Genre of the piece, e.g. "neo-noir", "corporate explainer". */
  genre?: string;
  /** Named palette swatches shared across every shot. */
  colorPalette: ShotPlanColorSwatch[];
  /** The written signature of the world — the consistency anchor. */
  environmentFingerprint: string;
  /** The cast available to every shot (resolved from AvatarProfile). */
  cast: ShotPlanCastMember[];
  /** Non-character objects/props available to every shot (appearance-anchored). */
  objects?: ShotPlanObject[];
  /** AI-rendered hero/establishing image of the world (production-sheet env render). */
  environmentHeroImageUrl?: string;
  /** AI-rendered lighting-setup swatches (label + thumbnail) for the mood board. */
  lightingSwatches?: ShotPlanLightingSwatch[];
  /**
   * Visual reference images for the WORLD/environment — establishing-shot anchors
   * that pin the look of the set alongside the written `environmentFingerprint`.
   * Uploaded or selected from the media library.
   */
  environmentReferenceImageUrls?: string[];
  /** Mood keywords applied across the production, e.g. ["tense", "hopeful"]. */
  moodKeywords: string[];
  /** Free-text cinematography direction notes shared across shots. */
  cinematographyNotes: string[];
  /** Overarching art style, e.g. "Pixar 3D", "gritty documentary". */
  artStyle?: string;
  /**
   * The project-level cinematic "look bible" — the deep, image-backed RenderZero
   * controls (movie look, film stock, camera body, color grade/filters,
   * photographer/videographer style, color temperature, aspect ratio, baseline
   * lighting + atmosphere). SET ONCE and inherited by every shot; this is the
   * cross-shot consistency anchor that holds a long (movie-length) chain together.
   * Reuses `CinematicConfig` so it maps 1:1 onto the existing studio pickers.
   */
  lookBible?: CinematicConfig;
  /**
   * Distinct locations when the video spans multiple environments; the doc renders
   * one hero per zone plus a per-zone slice of the top-down route strip.
   */
  environmentZones?: ShotPlanEnvironmentZone[];
  /**
   * Per-subject-kind label overrides for the doc, e.g. override "Character notes"
   * with "Material language" for creatures.
   */
  adaptiveLabels?: { characterNotes?: string };
}

// ============================================================================
// Shot transition
// ============================================================================

/**
 * How a shot begins relative to the one before it.
 *  - `continue` — chain from the prior shot's last frame (unbroken take).
 *  - `cut`      — a fresh shot, no carry-over from the previous frame.
 */
export type ShotPlanShotTransition = 'continue' | 'cut';

export const SHOT_PLAN_TRANSITIONS: readonly ShotPlanShotTransition[] = [
  'continue',
  'cut',
] as const;

// ============================================================================
// Shot
// ============================================================================

/** The lifecycle status of a single shot's generated output. */
export type ShotPlanShotGenerationStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed';

/**
 * The persisted generation result for a shot — including the saved last frame
 * that a downstream `continue` shot chains from.
 */
export interface ShotPlanShotGenerated {
  videoUrl?: string;
  /** Saved final frame — the chaining anchor for a downstream `continue` shot. */
  lastFrameUrl?: string;
  /**
   * Pre-video storyboard STILL for this shot — a cheap keyframe generated before
   * the (expensive) video so the operator can see/approve the look first. For a
   * `continue` shot this is effectively the prior shot's last frame.
   */
  keyframeUrl?: string;
  seed?: number;
  status?: ShotPlanShotGenerationStatus;
  /** Provider/job id for polling + round-trip. */
  generationId?: string;
}

/**
 * The camera package for a shot. Values are preset ids/labels drawn from
 * `cinematic-presets` (shot type, movement, lens), kept as free strings so the
 * planner can emit either an id or a human label without a hard dependency.
 */
export interface ShotPlanShotCamera {
  shotType?: string;
  movement?: string;
  /** Legacy free-text lens label (kept for back-compat). Prefer lensType + focalLength. */
  lens?: string;
  /** Preset lens type (e.g. "anamorphic", "macro") — from the cinematic preset library. */
  lensType?: string;
  /** Focal length (e.g. "35mm", "85mm"). */
  focalLength?: string;
  /** Composition rule (e.g. "rule of thirds", "centered", "leading lines"). */
  composition?: string;
  /** Camera viewing direction relative to the subject. */
  viewingDirection?: ViewingDirection;
  /** True when the subject should appear unaware of the camera (candid framing). */
  subjectUnawareOfCamera?: boolean;
}

/**
 * A per-shot continuity note for ONE character — the Script-Supervisor layer that
 * pins a character's emotional+physical or costume condition for THIS shot (e.g.
 * `{ characterId, state: "exhausted, limping" }` or `{ ..., state: "coat torn, muddy" }`).
 */
export interface ShotPlanCharacterStateRef {
  /** References a `ShotPlanCastMember.characterId`. */
  characterId: string;
  /** The character's condition for this shot, e.g. "injured", "soaked", "clean". */
  state: string;
}

/**
 * A per-shot continuity note for ONE object/prop — its condition for THIS shot
 * (e.g. `{ objectId, state: "lantern lit" }` → later `{ ..., state: "lantern spent" }`).
 */
export interface ShotPlanPropStateRef {
  /** References a `ShotPlanObject.id`. */
  objectId: string;
  /** The object's condition for this shot, e.g. "full", "empty", "lit", "spent". */
  state: string;
}

/**
 * One shot/cut. EVERY field is individually addressable so a surgical edit (manual
 * or scoped-AI) can change exactly one field and regenerate only what is affected.
 */
export interface ShotPlanShot {
  id: string;
  /** Position in the ordered plan (0-based). */
  index: number;
  title: string;
  /** What happens — the forward-motion description for this shot. */
  action: string;
  /** Which cast appear — references into `ShotPlanSharedChoices.cast`. */
  castMemberIds: string[];
  /** Which objects/props appear — references into `ShotPlanSharedChoices.objects`. */
  objectIds?: string[];
  /** This shot's setting — consistent with the environment fingerprint. */
  environment: string;
  /** Time of day for this shot, e.g. "golden hour", "night", "dawn". */
  timeOfDay?: string;
  /** Weather for this shot, e.g. "heavy rain", "clear", "fog". */
  weather?: string;
  /**
   * Per-character emotional+physical state THIS shot (e.g. injured/exhausted/wet)
   * — the continuity overlay a downstream shot inherits or deliberately changes.
   */
  characterStates?: ShotPlanCharacterStateRef[];
  /** Per-character costume condition THIS shot (e.g. clean/bloodied/torn). */
  costumeStates?: ShotPlanCharacterStateRef[];
  /** Per-object condition THIS shot (e.g. lit→spent, full→empty). */
  propStates?: ShotPlanPropStateRef[];
  /** Camera package (preset ids/labels). */
  camera: ShotPlanShotCamera;
  lighting?: string;
  mood?: string;
  durationSeconds: number;
  /** How this shot begins relative to the prior shot. */
  transitionIn: ShotPlanShotTransition;
  /** Spoken line (optional — lip-sync is a later layer). */
  dialogue?: string;
  /**
   * The final prompt sent to the engine. Derived from the other fields but
   * editable/overridable — once set it is treated as the source of truth for
   * generation unless cleared.
   */
  assembledPrompt?: string;
  /** Persisted generation result + saved last frame for chaining. */
  generated?: ShotPlanShotGenerated;
  /**
   * Mission-Control-style flag: set when an upstream shot changed, so the
   * operator knows this shot may need a rerun (or an explicit "keep this").
   */
  upstreamChanged?: boolean;
}

// ============================================================================
// Floor plan / top-down blocking — the spatial choreography that DRIVES camera
// ============================================================================

/** A point on the top-down stage, in NORMALIZED [0,1] coordinates (x→right, y→down). */
export interface FloorPlanPoint {
  x: number;
  y: number;
}

/** What a placed marker on the floor plan represents. */
export type FloorPlanElementKind = 'actor' | 'object' | 'set-piece' | 'entry' | 'zone';

export const FLOOR_PLAN_ELEMENT_KINDS: readonly FloorPlanElementKind[] = [
  'actor',
  'object',
  'set-piece',
  'entry',
  'zone',
] as const;

/** A placed marker: an actor, object/prop, set piece, entry point, or labeled zone. */
export interface FloorPlanElement {
  id: string;
  kind: FloorPlanElementKind;
  /** Human label, e.g. "Bear start zone", "Drone entry". */
  label: string;
  /** Link to a cast `characterId` (kind 'actor') or object `id` (kind 'object'). */
  refId?: string;
  /** Position on the stage, normalized [0,1]. */
  x: number;
  y: number;
  /** Facing direction in degrees (0 = toward top/north, clockwise), optional. */
  facing?: number;
}

/**
 * A camera position for a specific shot — the numbered "cut" on the plan. Drives
 * the shot's camera-direction prompt: where the camera sits relative to the
 * subjects, where it points, and (if it moves) the route it travels.
 */
export interface FloorPlanCamera {
  /** The shot this camera node represents (matches `ShotPlanShot.id`). */
  shotId: string;
  /** Camera position on the stage, normalized [0,1]. */
  x: number;
  y: number;
  /** Direction the camera points, in degrees (0 = toward top/north, clockwise). */
  facing: number;
  /** Lens cone half-angle hint in degrees (derived from focal length), optional. */
  fovDegrees?: number;
  /** Movement route the camera travels during the shot (polyline), optional. */
  route?: FloorPlanPoint[];
}

/** A subject's movement path across the stage during a shot/scene. */
export interface FloorPlanSubjectPath {
  /** The `FloorPlanElement.id` that moves. */
  elementId: string;
  path: FloorPlanPoint[];
}

/**
 * A horizontal band on the top-down route strip that partitions it per location,
 * so a multi-zone story shows where one set ends and the next begins.
 */
export interface ShotPlanFloorPlanZone {
  /** Stable id (typically the matching `ShotPlanEnvironmentZone.id`). */
  id: string;
  /** Human label for the band, e.g. "Zone 1 · Workspace (Home)". */
  label: string;
  /** Normalized [0,1] left edge of this zone band on the strip. */
  x0: number;
  /** Normalized [0,1] right edge of this zone band on the strip. */
  x1: number;
}

/**
 * The top-down blocking diagram for the plan — OpenArt's floor plan, but
 * structured + field-addressable so it can be edited AND translated into precise
 * camera-direction prompt language at generation time (our differentiator).
 */
export interface ShotPlanFloorPlan {
  /** Optional AI-rendered top-down set image used as the canvas backdrop. */
  backdropImageUrl?: string;
  elements: FloorPlanElement[];
  /** One camera node per shot (the numbered cuts). */
  cameras: FloorPlanCamera[];
  subjectPaths: FloorPlanSubjectPath[];
  /** Per-location bands partitioning the route strip when the story spans zones. */
  zones?: ShotPlanFloorPlanZone[];
}

// ============================================================================
// Plan envelope
// ============================================================================

/** Lifecycle status of the whole plan. */
export type ShotPlanStatus = 'draft' | 'ready' | 'generating' | 'complete';

export const SHOT_PLAN_STATUSES: readonly ShotPlanStatus[] = [
  'draft',
  'ready',
  'generating',
  'complete',
] as const;

/** The complete, field-addressable Shot Plan. */
// ============================================================================
// PAGE LAYOUT — the AI DESIGNS the page composition; the renderer just paints it.
// The planner authors a `layout`: an ordered stack of rows, each row a set of
// blocks with relative width/height weights. The renderer is a generic painter —
// it lays the page out as a fixed-ratio canvas, distributes the rows by their
// height weights (so the page ALWAYS fills — no dead space), and draws each block
// by its `type`. This is "the AI constructs the page", not a hard-coded template.
// ============================================================================

/** The render primitives the AI can compose a page from. */
export type ShotPlanBlockType =
  | 'characters' // cast reference / turnaround blocks
  | 'environment' // environment hero(es) / set design (per zone)
  | 'floorplan' // top-down blocking / camera route
  | 'storyboard' // the ordered cut frames
  | 'lighting' // lighting swatches
  | 'cinematography' // look bible / camera / style fields
  | 'mood' // mood keywords + cinematography notes
  | 'palette' // color palette swatches
  | 'notes' // character / continuity notes
  | 'prompt'; // the assembled video prompt

export const SHOT_PLAN_BLOCK_TYPES: readonly ShotPlanBlockType[] = [
  'characters',
  'environment',
  'floorplan',
  'storyboard',
  'lighting',
  'cinematography',
  'mood',
  'palette',
  'notes',
  'prompt',
] as const;

/** One block the AI placed in a row, with its relative width within that row. */
export interface ShotPlanLayoutBlock {
  type: ShotPlanBlockType;
  /** Section heading the AI chose for this block (e.g. "1. Character Reference"). */
  title?: string;
  /** Relative width within the row (fr units); the renderer normalizes these. */
  widthWeight: number;
}

/** One horizontal row of the page; its height is a relative weight of the canvas. */
export interface ShotPlanLayoutRow {
  /** Relative height of this row vs the others (fr units); rows fill the canvas. */
  heightWeight: number;
  blocks: ShotPlanLayoutBlock[];
}

/** The AI-authored page composition. */
export interface ShotPlanLayout {
  rows: ShotPlanLayoutRow[];
}

export interface ShotPlan {
  id: string;
  title: string;
  sharedChoices: ShotPlanSharedChoices;
  shots: ShotPlanShot[];
  /** Top-down blocking diagram (camera positions/routes + actor/prop placement). */
  floorPlan?: ShotPlanFloorPlan;
  /** AI-authored page composition. When absent, the renderer uses a default layout. */
  layout?: ShotPlanLayout;
  createdAt: string;
  updatedAt: string;
  status: ShotPlanStatus;
  /**
   * The final, stitched deliverable video — every generated shot concatenated in
   * order into ONE playable file on OUR storage. Written by `stitchShotPlan` after
   * `generateAllShots`. Absent until the plan has been generated + stitched.
   */
  finalVideoUrl?: string;
}

// ============================================================================
// Zod Schemas — the planner output AND the API validate against these
// ============================================================================

export const ShotPlanColorSwatchSchema = z.object({
  name: z.string().trim().min(1).max(120),
  // Accept 3- or 6-digit hex, with the leading '#'.
  hex: z
    .string()
    .trim()
    .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/, 'Must be a hex color like #1f2937'),
});

export const ShotPlanCastMemberSchema = z.object({
  characterId: z.string().trim().min(1).max(200),
  lookId: z.string().trim().max(200).nullable().optional(),
  name: z.string().trim().min(1).max(200),
  referenceImageUrls: z.array(z.string().trim().url()).max(20).default([]),
  role: z.string().trim().max(200).optional(),
  billing: z.enum(['lead', 'supporting']).optional(),
  subjectKind: z.enum(['person', 'creature', 'group']).optional(),
  notes: z.string().trim().max(2000).optional(),
  apparentAge: z.string().trim().max(300).optional(),
  gender: z.string().trim().max(300).optional(),
  ethnicity: z.string().trim().max(300).optional(),
  build: z.string().trim().max(300).optional(),
  hairColor: z.string().trim().max(300).optional(),
  hairStyle: z.string().trim().max(300).optional(),
  wardrobe: z.string().trim().max(300).optional(),
  accessories: z.array(z.string().trim().min(1).max(200)).max(12).optional(),
  wardrobeMode: z.enum(['flexible', 'signature']).optional(),
  modelSheet: z
    .array(z.object({ label: z.string().trim().min(1).max(80), imageUrl: z.string().trim().url() }))
    .max(8)
    .optional(),
  saveToLibrary: z.boolean().optional(),
});

export const ShotPlanObjectSchema = z.object({
  id: z.string().trim().min(1).max(200),
  name: z.string().trim().min(1).max(200),
  referenceImageUrls: z.array(z.string().trim().url()).max(20).default([]),
  subjectKind: z.enum(['object', 'creature']).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const ShotPlanLightingSwatchSchema = z.object({
  label: z.string().trim().min(1).max(200),
  imageUrl: z.string().trim().url(),
});

/**
 * The Look Bible schema = the studio `CinematicConfigSchema` extended with
 * `videographerStyle` (present on the `CinematicConfig` interface but missing
 * from the base schema), so the full deep-control set round-trips without loss.
 */
export const ShotPlanLookBibleSchema = CinematicConfigSchema.extend({
  videographerStyle: z.string().trim().optional(),
});

export const ShotPlanEnvironmentZoneSchema = z.object({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().min(1).max(200),
  heroImageUrl: z.string().trim().url().optional(),
  setDesign: z.array(z.string().trim().min(1).max(2000)).max(12).optional(),
  cutIds: z.array(z.string().trim().min(1).max(200)).optional(),
});

export const ShotPlanSharedChoicesSchema = z.object({
  cutCount: z.number().int().min(0).max(200),
  timePeriod: z.string().trim().max(200).optional(),
  genre: z.string().trim().max(200).optional(),
  colorPalette: z.array(ShotPlanColorSwatchSchema).max(40).default([]),
  environmentFingerprint: z.string().trim().max(4000).default(''),
  cast: z.array(ShotPlanCastMemberSchema).max(40).default([]),
  objects: z.array(ShotPlanObjectSchema).max(40).optional(),
  environmentReferenceImageUrls: z.array(z.string().trim().url()).max(20).optional(),
  environmentHeroImageUrl: z.string().trim().url().optional(),
  lightingSwatches: z.array(ShotPlanLightingSwatchSchema).max(12).optional(),
  moodKeywords: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  cinematographyNotes: z.array(z.string().trim().min(1).max(2000)).max(40).default([]),
  artStyle: z.string().trim().max(2000).optional(),
  lookBible: ShotPlanLookBibleSchema.optional(),
  environmentZones: z.array(ShotPlanEnvironmentZoneSchema).max(12).optional(),
  adaptiveLabels: z.object({ characterNotes: z.string().trim().max(80).optional() }).optional(),
});

export const ShotPlanShotTransitionSchema = z.enum(['continue', 'cut']);

export const ShotPlanShotGenerationStatusSchema = z.enum([
  'pending',
  'processing',
  'completed',
  'failed',
]);

export const ShotPlanShotGeneratedSchema = z.object({
  videoUrl: z.string().trim().url().optional(),
  lastFrameUrl: z.string().trim().url().optional(),
  keyframeUrl: z.string().trim().url().optional(),
  seed: z.number().int().optional(),
  status: ShotPlanShotGenerationStatusSchema.optional(),
  generationId: z.string().trim().max(200).optional(),
});

export const ShotPlanShotCameraSchema = z.object({
  shotType: z.string().trim().max(200).optional(),
  movement: z.string().trim().max(200).optional(),
  lens: z.string().trim().max(200).optional(),
  lensType: z.string().trim().max(200).optional(),
  focalLength: z.string().trim().max(200).optional(),
  composition: z.string().trim().max(200).optional(),
  viewingDirection: z.enum(VIEWING_DIRECTIONS).optional(),
  subjectUnawareOfCamera: z.boolean().optional(),
});

export const ShotPlanCharacterStateRefSchema = z.object({
  characterId: z.string().trim().min(1).max(200),
  state: z.string().trim().min(1).max(500),
});

export const ShotPlanPropStateRefSchema = z.object({
  objectId: z.string().trim().min(1).max(200),
  state: z.string().trim().min(1).max(500),
});

export const ShotPlanShotSchema = z.object({
  id: z.string().trim().min(1).max(200),
  index: z.number().int().min(0),
  title: z.string().trim().max(300).default(''),
  action: z.string().trim().max(4000).default(''),
  castMemberIds: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  objectIds: z.array(z.string().trim().min(1).max(200)).max(40).optional(),
  environment: z.string().trim().max(4000).default(''),
  timeOfDay: z.string().trim().max(200).optional(),
  weather: z.string().trim().max(200).optional(),
  characterStates: z.array(ShotPlanCharacterStateRefSchema).max(40).optional(),
  costumeStates: z.array(ShotPlanCharacterStateRefSchema).max(40).optional(),
  propStates: z.array(ShotPlanPropStateRefSchema).max(40).optional(),
  camera: ShotPlanShotCameraSchema.default({}),
  lighting: z.string().trim().max(2000).optional(),
  mood: z.string().trim().max(2000).optional(),
  durationSeconds: z.number().min(0).max(600),
  transitionIn: ShotPlanShotTransitionSchema.default('cut'),
  dialogue: z.string().trim().max(4000).optional(),
  assembledPrompt: z.string().trim().max(8000).optional(),
  generated: ShotPlanShotGeneratedSchema.optional(),
  upstreamChanged: z.boolean().optional(),
});

export const FloorPlanPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

export const FloorPlanElementSchema = z.object({
  id: z.string().trim().min(1).max(200),
  kind: z.enum(['actor', 'object', 'set-piece', 'entry', 'zone']),
  label: z.string().trim().max(300).default(''),
  refId: z.string().trim().max(200).optional(),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  facing: z.number().min(0).max(360).optional(),
});

export const FloorPlanCameraSchema = z.object({
  shotId: z.string().trim().min(1).max(200),
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  facing: z.number().min(0).max(360),
  fovDegrees: z.number().min(1).max(180).optional(),
  route: z.array(FloorPlanPointSchema).max(100).optional(),
});

export const FloorPlanSubjectPathSchema = z.object({
  elementId: z.string().trim().min(1).max(200),
  path: z.array(FloorPlanPointSchema).max(100).default([]),
});

export const ShotPlanFloorPlanZoneSchema = z.object({
  id: z.string().trim().min(1).max(200),
  label: z.string().trim().max(300).default(''),
  x0: z.number().min(0).max(1),
  x1: z.number().min(0).max(1),
});

export const ShotPlanFloorPlanSchema = z.object({
  backdropImageUrl: z.string().trim().url().optional(),
  elements: z.array(FloorPlanElementSchema).max(100).default([]),
  cameras: z.array(FloorPlanCameraSchema).max(200).default([]),
  subjectPaths: z.array(FloorPlanSubjectPathSchema).max(100).default([]),
  zones: z.array(ShotPlanFloorPlanZoneSchema).max(40).optional(),
});

export const ShotPlanStatusSchema = z.enum(['draft', 'ready', 'generating', 'complete']);

export const ShotPlanBlockTypeSchema = z.enum([
  'characters',
  'environment',
  'floorplan',
  'storyboard',
  'lighting',
  'cinematography',
  'mood',
  'palette',
  'notes',
  'prompt',
]);

export const ShotPlanLayoutBlockSchema = z.object({
  type: ShotPlanBlockTypeSchema,
  title: z.string().trim().max(120).optional(),
  widthWeight: z.number().min(0.1).max(100),
});

export const ShotPlanLayoutRowSchema = z.object({
  heightWeight: z.number().min(0.1).max(100),
  blocks: z.array(ShotPlanLayoutBlockSchema).min(1).max(8),
});

export const ShotPlanLayoutSchema = z.object({
  rows: z.array(ShotPlanLayoutRowSchema).min(1).max(12),
});

export const ShotPlanSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().max(300).default(''),
  sharedChoices: ShotPlanSharedChoicesSchema,
  shots: z.array(ShotPlanShotSchema).max(200).default([]),
  floorPlan: ShotPlanFloorPlanSchema.optional(),
  layout: ShotPlanLayoutSchema.optional(),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  status: ShotPlanStatusSchema.default('draft'),
  finalVideoUrl: z.string().trim().url().optional(),
});

// ============================================================================
// Inferred-type parity guards
// ============================================================================
// These assignments make tsc fail if a schema and its interface ever drift.
// They are compile-time-only and erased at build.

type _ColorSwatchParity = z.infer<typeof ShotPlanColorSwatchSchema> extends ShotPlanColorSwatch
  ? ShotPlanColorSwatch extends z.infer<typeof ShotPlanColorSwatchSchema>
    ? true
    : false
  : false;
type _ShotParity = z.infer<typeof ShotPlanShotSchema> extends ShotPlanShot
  ? true
  : false;
type _PlanParity = z.infer<typeof ShotPlanSchema> extends ShotPlan ? true : false;

// Reference the guards so unused-type lint does not fire.
export const SHOT_PLAN_TYPE_GUARDS: {
  colorSwatch: _ColorSwatchParity;
  shot: _ShotParity;
  plan: _PlanParity;
} = { colorSwatch: true, shot: true, plan: true };
