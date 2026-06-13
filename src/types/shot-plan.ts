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
  /** CharacterLook id when a specific look/outfit/state is chosen. */
  lookId?: string;
  /** Display name, e.g. "David (civilian)". */
  name: string;
  /** Identity-anchor reference images resolved from the profile/look. */
  referenceImageUrls: string[];
  /** Free-text role, e.g. "hero", "narrator", "background extra". */
  role?: string;
}

/**
 * The project-level look bible. Every shot inherits these unless it overrides a
 * specific field. The `environmentFingerprint` is the written signature of the
 * world and the single strongest cross-shot consistency anchor.
 */
export interface ShotPlanSharedChoices {
  /** How many shots/cuts the plan is built for. */
  cutCount: number;
  /** Named palette swatches shared across every shot. */
  colorPalette: ShotPlanColorSwatch[];
  /** The written signature of the world — the consistency anchor. */
  environmentFingerprint: string;
  /** The cast available to every shot (resolved from AvatarProfile). */
  cast: ShotPlanCastMember[];
  /** Mood keywords applied across the production, e.g. ["tense", "hopeful"]. */
  moodKeywords: string[];
  /** Free-text cinematography direction notes shared across shots. */
  cinematographyNotes: string[];
  /** Overarching art style, e.g. "Pixar 3D", "gritty documentary". */
  artStyle?: string;
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
  lens?: string;
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
  /** This shot's setting — consistent with the environment fingerprint. */
  environment: string;
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
export interface ShotPlan {
  id: string;
  title: string;
  sharedChoices: ShotPlanSharedChoices;
  shots: ShotPlanShot[];
  createdAt: string;
  updatedAt: string;
  status: ShotPlanStatus;
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
  lookId: z.string().trim().max(200).optional(),
  name: z.string().trim().min(1).max(200),
  referenceImageUrls: z.array(z.string().trim().url()).max(20).default([]),
  role: z.string().trim().max(200).optional(),
});

export const ShotPlanSharedChoicesSchema = z.object({
  cutCount: z.number().int().min(0).max(200),
  colorPalette: z.array(ShotPlanColorSwatchSchema).max(40).default([]),
  environmentFingerprint: z.string().trim().max(4000).default(''),
  cast: z.array(ShotPlanCastMemberSchema).max(40).default([]),
  moodKeywords: z.array(z.string().trim().min(1).max(120)).max(40).default([]),
  cinematographyNotes: z.array(z.string().trim().min(1).max(2000)).max(40).default([]),
  artStyle: z.string().trim().max(2000).optional(),
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
  seed: z.number().int().optional(),
  status: ShotPlanShotGenerationStatusSchema.optional(),
  generationId: z.string().trim().max(200).optional(),
});

export const ShotPlanShotCameraSchema = z.object({
  shotType: z.string().trim().max(200).optional(),
  movement: z.string().trim().max(200).optional(),
  lens: z.string().trim().max(200).optional(),
});

export const ShotPlanShotSchema = z.object({
  id: z.string().trim().min(1).max(200),
  index: z.number().int().min(0),
  title: z.string().trim().max(300).default(''),
  action: z.string().trim().max(4000).default(''),
  castMemberIds: z.array(z.string().trim().min(1).max(200)).max(40).default([]),
  environment: z.string().trim().max(4000).default(''),
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

export const ShotPlanStatusSchema = z.enum(['draft', 'ready', 'generating', 'complete']);

export const ShotPlanSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().max(300).default(''),
  sharedChoices: ShotPlanSharedChoicesSchema,
  shots: z.array(ShotPlanShotSchema).max(200).default([]),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
  status: ShotPlanStatusSchema.default('draft'),
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
