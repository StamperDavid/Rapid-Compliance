/**
 * Shot Plan Planner — REAL AI AGENT (June 13 2026).
 *
 * The director/cinematographer that turns a plain-language creative brief into a
 * complete, contract-valid `ShotPlan` (OpenArt "Smart Shot"-style production sheet):
 * a project-level look bible (palette, environment fingerprint, mood, cinematography,
 * art style) plus an ordered set of field-addressable shots, each tagged with a
 * `continue`/`cut` transition derived from the narrative.
 *
 * It AUTO-CASTS the operator's real saved characters: it loads the operator's own
 * Character Library (`listAvatarProfiles(userId, { ownOnly: true })`), passes them to
 * the model as the available cast, and the plan binds them into
 * `sharedChoices.cast` (with identity-anchor `referenceImageUrls` resolved from each
 * profile/look) and into per-shot `castMemberIds`.
 *
 * Standing Rule #1: loads its Golden Master from Firestore at runtime (Brand DNA baked
 * in at seed time) and uses `gm.systemPrompt` VERBATIM — no runtime Brand DNA loading,
 * no `getBrandDNA()` call here. If the GM is missing, the LLM fails, the JSON won't
 * parse, or the plan fails `ShotPlanSchema`, it throws an honest error (one retry on
 * an invalid plan, feeding the zod errors back to the model).
 *
 * Standing Rule #2: there is NO self-editing/auto-improve path here. The surgical
 * `editShotPlanField` regenerates a single requested field from an operator instruction;
 * it never re-rolls the plan and never touches the GM.
 */

import { z } from 'zod';
import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { getActiveSpecialistGMByIndustry } from '@/lib/training/specialist-golden-master-service';
import { listAvatarProfiles, type AvatarProfile } from '@/lib/video/avatar-profile-service';
import { listLocationProfiles } from '@/lib/video/location-profile-service';
import type { LocationProfile } from '@/types/location';
import {
  ShotPlanSchema,
  ShotPlanSharedChoicesSchema,
  ShotPlanShotSchema,
  type ShotPlan,
  type ShotPlanCastMember,
  type ShotPlanObject,
  type ShotPlanFloorPlan,
} from '@/types/shot-plan';
import type { ShotPlanEditTarget } from '@/lib/video/shot-plan-edit';
import type { ModelName } from '@/types/ai-models';
import { logger } from '@/lib/logger/logger';

// ============================================================================
// CONFIGURATION
// ============================================================================

const FILE = 'content/shot-plan/planner.ts';
const SPECIALIST_ID = 'SHOT_PLAN_PLANNER';
const DEFAULT_INDUSTRY_KEY = 'saas_sales_ops';

/** A full multi-shot plan is a sizeable JSON object — give it room. */
// The plan JSON is large now (full look bible + per-shot deep camera + the
// auto-built floor plan with elements/cameras/routes/subject-paths), so it needs
// generous output headroom — at 8000 the JSON was truncating into invalid JSON.
const MIN_OUTPUT_TOKENS_FOR_PLAN = 16000;
/** A single-field surgical edit is small. */
const MIN_OUTPUT_TOKENS_FOR_FIELD = 2000;

interface ShotPlanPlannerGMConfig {
  systemPrompt: string;
  model: ModelName;
  temperature: number;
  maxTokens: number;
}

// ============================================================================
// INPUT CONTRACT
// ============================================================================

/**
 * A reference material the operator attached to shape the plan (uploaded or
 * picked from the media library). The LLM is text-only, so it consumes the
 * `description` (the agent's read of the file) — NOT the pixels. Image refs are
 * still flagged so the model knows to let them inform the palette / environment
 * fingerprint / art style.
 */
const ShotPlanReferenceSchema = z.object({
  /** Permanent URL of the reference asset (kept for traceability; not fetched by the LLM). */
  url: z.string().trim().url(),
  /** The agent's read of the file (vision summary / transcript / extracted text). */
  description: z.string().trim().max(4000).optional(),
  /** Coarse medium so the prompt can describe what kind of reference it is. */
  kind: z.string().trim().max(40).optional(),
});

export type ShotPlanReference = z.infer<typeof ShotPlanReferenceSchema>;

const GenerateShotPlanInputSchema = z.object({
  /** The creative brief, in plain language. */
  brief: z.string().trim().min(1),
  /** Owner of the Character Library to auto-cast from. */
  userId: z.string().trim().min(1),
  /** Optional desired number of shots (the planner still decides if omitted). */
  shotCount: z.number().int().min(1).max(50).optional(),
  /** Optional title hint for the plan. */
  title: z.string().trim().max(300).optional(),
  /** Optional reference materials that define the desired look / style / world / characters. */
  references: z.array(ShotPlanReferenceSchema).max(20).optional(),
  /**
   * Saved Character-Library characters the operator EXPLICITLY chose to cast.
   * ONLY these library characters are used; every other person/creature the brief
   * needs is INVENTED as a new profile. Omitted/empty = invent all characters.
   * (The planner never auto-pulls from the library by a name in the brief — that
   * caused name collisions and the "always the same character" bug.)
   */
  selectedCharacterIds: z.array(z.string().trim().min(1)).max(50).optional(),
  /**
   * Saved Location-Library locations (digital sets) the operator EXPLICITLY chose.
   * When provided, the plan's ENVIRONMENT is LOCKED to these sets: the planner authors
   * the environment fingerprint / zones strictly from each location's LOCKED description
   * (same furniture in the same places, same windows on the same walls, same layout) and
   * the union of their reference images is pinned as `environmentReferenceImageUrls` (the
   * set-identity anchors the generation service feeds to Seedance). Omitted/empty = the
   * planner invents the environment as before. Multiple selections map one zone per
   * location. This is the SET-equivalent of character identity-locking.
   */
  selectedLocationIds: z.array(z.string().trim().min(1)).max(20).optional(),
});

export type GenerateShotPlanInput = z.infer<typeof GenerateShotPlanInputSchema>;

const EditShotPlanFieldInputSchema = z.object({
  /** The plan being edited (read-only context — never re-rolled). */
  plan: ShotPlanSchema,
  /** Which level the edit targets. */
  target: z.enum(['shared', 'shot', 'plan']),
  /** Required when target === 'shot'. */
  shotId: z.string().trim().min(1).optional(),
  /** The property name on the targeted object (e.g. 'action', 'colorPalette', 'title'). */
  field: z.string().trim().min(1),
  /** The operator instruction in plain language. */
  instruction: z.string().trim().min(1),
  /** Owner (for parity with generate; not used to re-load Brand DNA). */
  userId: z.string().trim().min(1),
});

export type EditShotPlanFieldInput = z.infer<typeof EditShotPlanFieldInputSchema>;

// ============================================================================
// LLM-FACING SCHEMAS — what the model returns (then mapped into the contract)
// ============================================================================

/**
 * Cast slots the model returns — it picks from the PROVIDED characters by their
 * real `characterId` (we re-resolve `referenceImageUrls` ourselves from the
 * profile so the model can't invent image URLs).
 */
const LlmCastMemberSchema = z.object({
  characterId: z.string().trim().min(1),
  lookId: z.string().trim().min(1).optional(),
  name: z.string().trim().min(1),
  role: z.string().trim().min(1).optional(),
  billing: z.enum(['lead', 'supporting']).optional(),
  subjectKind: z.enum(['person', 'creature', 'group']).optional(),
  notes: z.string().trim().min(1).max(2000).optional(),
  // Casting & wardrobe — REQUIRED (completeness): the production team fills the
  // full physical identity + a scene-appropriate wardrobe for every cast member.
  apparentAge: z.string().trim().min(1),
  gender: z.string().trim().min(1),
  ethnicity: z.string().trim().min(1),
  build: z.string().trim().min(1),
  hairColor: z.string().trim().min(1),
  hairStyle: z.string().trim().min(1),
  wardrobe: z.string().trim().min(1),
  // Optional — not every character carries accessories.
  accessories: z.array(z.string().trim().min(1)).optional(),
  // 'flexible' (default) re-costumes per scene; 'signature' locks an iconic outfit.
  wardrobeMode: z.enum(['flexible', 'signature']).optional(),
});

/** A normalized [0,1] point on the top-down stage. */
const LlmPointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
});

/**
 * The AI-authored floor plan / blocking. Cameras reference shots by 0-based
 * `shotIndex` (the model doesn't know our generated shot ids — we remap to the
 * real shot id during assembly). All coordinates are normalized [0,1].
 */
const LlmFloorPlanSchema = z.object({
  elements: z
    .array(
      z.object({
        id: z.string().trim().min(1),
        kind: z.enum(['actor', 'object', 'set-piece', 'entry', 'zone']),
        label: z.string().trim().min(1),
        // Optional link to a cast/object id — the model often sends "" for zones/
        // entries that link to nothing, so tolerate empty and normalize in assembly.
        refId: z.string().trim().max(200).optional(),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        facing: z.number().min(0).max(360).optional(),
      }),
    )
    .default([]),
  cameras: z
    .array(
      z.object({
        shotIndex: z.number().int().min(0),
        x: z.number().min(0).max(1),
        y: z.number().min(0).max(1),
        facing: z.number().min(0).max(360),
        fovDegrees: z.number().min(1).max(180).optional(),
        route: z.array(LlmPointSchema).optional(),
      }),
    )
    .default([]),
  subjectPaths: z
    .array(
      z.object({
        elementId: z.string().trim().min(1),
        path: z.array(LlmPointSchema).default([]),
      }),
    )
    .default([]),
  // Per-location bands partitioning the route strip left→right. The model emits a
  // label + normalized [0,1] span per zone (in zone order); we assign the stable id.
  zones: z
    .array(
      z.object({
        label: z.string().trim().min(1).max(300),
        x0: z.number().min(0).max(1),
        x1: z.number().min(0).max(1),
      }),
    )
    .max(40)
    .optional(),
});

/**
 * STRICT look-bible schema for the LLM — UNLIKE the lenient storage schema
 * (`ShotPlanLookBibleSchema`, every field optional), every look dimension here is
 * REQUIRED so a sparse plan FAILS validation and the retry loop forces the model to
 * fill it. Over-detailed by design: every field is generation-grade data the engine
 * uses. Only `photographerStyle` (stills-only) and the per-shot framing fields
 * (shotType / viewingDirection / subjectUnawareOfCamera, set per shot, not project-wide)
 * stay optional at the project level.
 */
const LlmLookBibleSchema = z.object({
  movieLook: z.string().trim().min(1),
  filmStock: z.string().trim().min(1),
  camera: z.string().trim().min(1),
  lensType: z.string().trim().min(1),
  focalLength: z.string().trim().min(1),
  videographerStyle: z.string().trim().min(1),
  filters: z.array(z.string().trim().min(1)).min(1),
  temperature: z.number().min(0).max(1),
  aspectRatio: z.enum(['1:1', '16:9', '9:16', '21:9', '4:3', '3:2']),
  artStyle: z.string().trim().min(1),
  composition: z.string().trim().min(1),
  lighting: z.string().trim().min(1),
  atmosphere: z.string().trim().min(1),
  photographerStyle: z.string().trim().min(1).optional(),
});

/** The plan body the model returns (envelope fields id/createdAt/updatedAt are ours). */
const LlmShotPlanSchema = z.object({
  title: z.string().trim().min(1),
  sharedChoices: z.object({
    cutCount: z.number().int().min(1).max(50),
    // Period & genre — REQUIRED: every department's detail must be consistent with these.
    timePeriod: z.string().trim().min(1),
    genre: z.string().trim().min(1),
    colorPalette: z
      .array(
        z.object({
          name: z.string().trim().min(1),
          hex: z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        }),
      )
      .min(2),
    environmentFingerprint: z.string().trim().min(1),
    cast: z.array(LlmCastMemberSchema).default([]),
    moodKeywords: z.array(z.string().trim().min(1)).min(3),
    cinematographyNotes: z.array(z.string().trim().min(1)).min(2),
    artStyle: z.string().trim().min(1).optional(),
    // The deep, SET-ONCE cinematic look bible — every field REQUIRED (strict schema).
    lookBible: LlmLookBibleSchema,
    // Consolidated ordered set of locations. The model references shots by 0-based
    // cutIndices; we remap those to real shot ids and assign each zone its stable id.
    environmentZones: z
      .array(
        z.object({
          label: z.string().trim().min(1).max(200),
          setDesign: z.array(z.string().trim().min(1).max(2000)).min(3).max(8),
          cutIndices: z.array(z.number().int().min(0)).min(1),
        }),
      )
      .max(12)
      .optional(),
    // Adaptive doc labels (e.g. "Material language" instead of "Character notes").
    adaptiveLabels: z.object({ characterNotes: z.string().trim().max(80).optional() }).optional(),
    // Non-human subjects the story is ABOUT (animals, creatures, vehicles, robots,
    // signature props) — anchored like cast. Each gets a fresh id + a model-sheet-grade
    // description; reference art is GENERATED (no referenceImageUrls from the model).
    objects: z
      .array(
        z.object({
          id: z.string().trim().min(1),
          name: z.string().trim().min(1),
          subjectKind: z.enum(['object', 'creature']).optional(),
          description: z.string().trim().max(2000).optional(),
        }),
      )
      .max(40)
      .optional(),
  }),
  shots: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        action: z.string().trim().min(1),
        castMemberIds: z.array(z.string().trim().min(1)).default([]),
        objectIds: z.array(z.string().trim().min(1)).optional(),
        environment: z.string().trim().min(1),
        // Continuity (Script Supervisor) — REQUIRED per beat, consistent within a scene/zone.
        timeOfDay: z.string().trim().min(1),
        weather: z.string().trim().min(1),
        // Per-character emotional+physical state + costume condition for this beat,
        // and per-prop condition — optional continuity overlays the engine inherits.
        characterStates: z
          .array(
            z.object({
              characterId: z.string().trim().min(1),
              state: z.string().trim().min(1),
            }),
          )
          .optional(),
        costumeStates: z
          .array(
            z.object({
              characterId: z.string().trim().min(1),
              state: z.string().trim().min(1),
            }),
          )
          .optional(),
        propStates: z
          .array(
            z.object({
              objectId: z.string().trim().min(1),
              state: z.string().trim().min(1),
            }),
          )
          .optional(),
        camera: z.object({
          // Required per-beat framing — these populate the storyboard caption + drive the cut.
          shotType: z.string().trim().min(1),
          movement: z.string().trim().min(1),
          // Optional per-shot overrides of the look bible (fall back to lookBible when omitted).
          lens: z.string().trim().min(1).optional(),
          lensType: z.string().trim().min(1).optional(),
          focalLength: z.string().trim().min(1).optional(),
          composition: z.string().trim().min(1).optional(),
          viewingDirection: z.enum(['front', 'back', 'left', 'right']).optional(),
          subjectUnawareOfCamera: z.boolean().optional(),
        }),
        // Required per-beat ACCENTS (on top of the baseline lookBible lighting/mood).
        lighting: z.string().trim().min(1),
        mood: z.string().trim().min(1),
        durationSeconds: z.number().min(1).max(120),
        transitionIn: z.enum(['continue', 'cut']),
        dialogue: z.string().trim().min(1).optional(),
      }),
    )
    .min(1),
  // The AI-authored top-down blocking (camera cuts + routes + actor placement).
  floorPlan: LlmFloorPlanSchema,
  // The AI-authored PAGE COMPOSITION — the planner designs the production sheet
  // itself: an ordered stack of rows, each row a set of blocks with relative
  // width/height weights. REQUIRED so the AI always designs the page (the renderer
  // is a generic painter; if for any reason it's absent the renderer falls back to
  // a default). Matches the ShotPlanLayout contract 1:1 so it passes through as-is.
  layout: z.object({
    rows: z
      .array(
        z.object({
          heightWeight: z.number().min(0.1).max(100),
          blocks: z
            .array(
              z.object({
                type: z.enum([
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
                ]),
                title: z.string().trim().max(120).optional(),
                widthWeight: z.number().min(0.1).max(100),
              }),
            )
            .min(1)
            .max(8),
        }),
      )
      .min(1)
      .max(12),
  }),
});

type LlmShotPlan = z.infer<typeof LlmShotPlanSchema>;

// ============================================================================
// GM LOADER (Standing Rule #1 — systemPrompt VERBATIM, no Brand DNA merge)
// ============================================================================

async function loadGMConfig(industryKey: string): Promise<ShotPlanPlannerGMConfig> {
  const gmRecord = await getActiveSpecialistGMByIndustry(SPECIALIST_ID, industryKey);
  if (!gmRecord) {
    throw new Error(
      `Shot Plan Planner GM not found for industryKey=${industryKey}. ` +
        `Run node scripts/seed-shot-plan-planner-gm.js to seed.`,
    );
  }

  const config = gmRecord.config as Partial<ShotPlanPlannerGMConfig>;
  const systemPrompt = config.systemPrompt ?? gmRecord.systemPromptSnapshot;
  if (!systemPrompt || systemPrompt.length < 100) {
    throw new Error(
      `Shot Plan Planner GM ${gmRecord.id} has no usable systemPrompt (length=${systemPrompt?.length ?? 0}).`,
    );
  }

  return {
    systemPrompt,
    model: config.model ?? 'claude-sonnet-4.6',
    temperature: config.temperature ?? 0.5,
    maxTokens: Math.max(config.maxTokens ?? MIN_OUTPUT_TOKENS_FOR_PLAN, MIN_OUTPUT_TOKENS_FOR_PLAN),
  };
}

function stripJsonFences(raw: string): string {
  return raw
    .replace(/^[\s\S]*?```(?:json)?\s*\n?/i, (match) => (match.includes('```') ? '' : match))
    .replace(/\n?\s*```[\s\S]*$/i, '')
    .trim();
}

async function callOpenRouter(
  gm: ShotPlanPlannerGMConfig,
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
      `Shot Plan Planner: LLM response truncated at maxTokens=${maxTokens} (finish_reason='length').`,
    );
  }
  const rawContent = response.content ?? '';
  if (rawContent.trim().length === 0) {
    throw new Error('OpenRouter returned empty response');
  }
  return rawContent;
}

// ============================================================================
// CAST RESOLUTION (the real characters available for auto-casting)
// ============================================================================

/** Identity-anchor reference images for a profile (+ a specific look when chosen). */
function resolveReferenceImageUrls(profile: AvatarProfile, lookId?: string): string[] {
  const urls: string[] = [];
  if (lookId) {
    const look = profile.looks.find((l) => l.id === lookId);
    if (look) {
      urls.push(...look.imageUrls);
    }
  }
  // Always include the base identity anchors so the character stays recognizable.
  if (profile.frontalImageUrl) {
    urls.push(profile.frontalImageUrl);
  }
  urls.push(...profile.additionalImageUrls);
  if (urls.length === 0) {
    // Fall back to the primary look's images if the profile had no top-level anchors.
    const primary = profile.looks.find((l) => l.isPrimary) ?? profile.looks[0];
    if (primary) {
      urls.push(...primary.imageUrls);
    }
  }
  // De-dupe while preserving order, cap at the contract max (20).
  return Array.from(new Set(urls)).slice(0, 20);
}

/** Describe the available cast for the model — real ids + looks, no invented data. */
function buildAvailableCastBlock(profiles: AvatarProfile[]): string {
  if (profiles.length === 0) {
    return '  (NONE selected — the operator picked no saved character. INVENT every character the brief needs as a NEW cast member: give each a FRESH unique id like "new_1", "new_2", fill its full casting card, and put non-human subjects (animals, creatures, vehicles, robots) in sharedChoices.objects. Do NOT use any saved character.)';
  }
  return profiles
    .map((p) => {
      const looks = p.looks.length > 0
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

// ============================================================================
// LOCATION RESOLUTION (the LOCKED digital sets the operator selected)
// ============================================================================

/** A bare-http(s) URL is the only thing the contract's environmentReferenceImageUrls accepts. */
function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value.trim());
}

/**
 * The union of every SELECTED location's reference images — the ENVIRONMENT identity
 * anchors. These are pinned onto `sharedChoices.environmentReferenceImageUrls`, which the
 * generation service feeds into Seedance as the set anchors so the room renders the SAME
 * way in every shot. De-duped, order-preserving, filtered to valid URLs, capped at the
 * contract max (20).
 */
function collectEnvironmentReferenceImageUrls(locations: LocationProfile[]): string[] {
  const urls: string[] = [];
  for (const loc of locations) {
    for (const url of loc.referenceImageUrls) {
      if (isHttpUrl(url)) {
        urls.push(url.trim());
      }
    }
  }
  return Array.from(new Set(urls)).slice(0, 20);
}

/**
 * Describe the SELECTED, LOCKED locations for the model. The planner MUST author the
 * environment (environmentFingerprint + each environmentZone) STRICTLY from these locked
 * descriptions — same furniture in the same places, same windows on the same walls, same
 * layout — and may NEVER invent, add, remove, or move a set element. With multiple
 * locations selected, each becomes ONE environment zone anchored to its own description.
 */
function buildSelectedLocationsBlock(locations: LocationProfile[]): string {
  if (locations.length === 0) {
    return '  (NONE selected — no location is locked. INVENT the environment from the brief as before: author the environmentFingerprint and environmentZones freely.)';
  }
  const lines = locations.map((loc, i) => {
    const desc = loc.description.trim() || '(no description was captured for this set)';
    return [
      `  ${i + 1}. LOCKED LOCATION "${loc.name}" (locationId "${loc.id}")`,
      `       LOCKED SET DESCRIPTION (render EXACTLY this room every shot here — do NOT alter): ${desc}`,
    ].join('\n');
  });
  const multi = locations.length > 1;
  return [
    ...lines,
    '',
    multi
      ? `  The environment is LOCKED to these ${locations.length} sets. Map EACH location to its OWN environmentZone (one zone per location, in this order), and author that zone's setDesign STRICTLY from that location's LOCKED SET DESCRIPTION — same furniture in the same places, same windows on the same walls, same layout, same materials and lighting. NEVER add, remove, move, or change a set element between shots in the same location. Do NOT invent a different set. The environmentFingerprint must summarize these locked sets, not a new one.`
      : '  The environment is LOCKED to this one set. Author the environmentFingerprint AND (if you use zones) the single environmentZone STRICTLY from its LOCKED SET DESCRIPTION — same furniture in the same places, same windows on the same walls, same layout, same materials and lighting. EVERY shot set here describes the EXACT same room. NEVER add, remove, move, or change a set element between shots. Do NOT invent a different set.',
  ].join('\n');
}

/**
 * Map the model's cast picks back onto the contract. A pick that matches a SELECTED
 * saved profile re-resolves its referenceImageUrls from that profile (the model never
 * supplies image URLs). A pick with NO matching profile is an INVENTED character —
 * kept with empty referenceImageUrls (its reference art is generated later from the
 * casting card), never dropped. This is what lets a brief author brand-new people /
 * creatures instead of being forced onto a saved character.
 */
function resolveCast(
  llmCast: LlmShotPlan['sharedChoices']['cast'],
  profiles: AvatarProfile[],
): ShotPlanCastMember[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const resolved: ShotPlanCastMember[] = [];
  for (const member of llmCast) {
    const profile = byId.get(member.characterId);
    resolved.push({
      characterId: member.characterId,
      lookId: member.lookId,
      name: member.name.trim() ? member.name : (profile?.name ?? 'Unnamed'),
      referenceImageUrls: profile ? resolveReferenceImageUrls(profile, member.lookId) : [],
      role: member.role,
      billing: member.billing,
      subjectKind: member.subjectKind,
      notes: member.notes,
      apparentAge: member.apparentAge,
      gender: member.gender,
      ethnicity: member.ethnicity,
      build: member.build,
      hairColor: member.hairColor,
      hairStyle: member.hairStyle,
      wardrobe: member.wardrobe,
      ...(member.accessories ? { accessories: member.accessories } : {}),
      wardrobeMode: member.wardrobeMode ?? 'flexible',
    });
  }
  return resolved;
}

// ============================================================================
// PROMPT BUILDERS
// ============================================================================

/**
 * Describe the operator's attached reference materials for the text-only model.
 * The model consumes the DESCRIPTIONS (the agent's read of each file), not the
 * pixels. Image references are explicitly noted as inputs to the palette /
 * environment fingerprint / art style so the plan is SHAPED by them.
 */
function buildReferencesBlock(references: ShotPlanReference[] | undefined): string {
  if (!references || references.length === 0) {
    return '';
  }
  const items = references
    .map((ref, i) => {
      const kind = (ref.kind ?? 'reference').toLowerCase();
      const trimmedDesc = ref.description?.trim();
      const desc =
        trimmedDesc && trimmedDesc.length > 0
          ? trimmedDesc
          : '(no description was captured for this file)';
      const imageNote =
        kind === 'image'
          ? ' (this is an IMAGE reference — let it inform the colorPalette, environmentFingerprint, and artStyle)'
          : '';
      return `  ${i + 1}. [${kind}]${imageNote}: ${desc}`;
    })
    .join('\n');
  return [
    'REFERENCE MATERIALS (study these — they define the desired look / style / world / characters):',
    items,
    'Shape the ENTIRE plan around these references: the colorPalette, environmentFingerprint, moodKeywords, cinematographyNotes, artStyle, and every shot must reflect them. These descriptions are an AI read of the operator\'s attached files (you cannot see the pixels) — honor what they describe.',
    '',
  ].join('\n');
}

function buildGenerateUserPrompt(
  input: GenerateShotPlanInput,
  availableCastBlock: string,
  selectedLocationsBlock: string,
  hasSelectedLocations: boolean,
  priorZodErrors?: string,
): string {
  return [
    'TASK: Turn the creative brief below into ONE complete Shot Plan as STRICT JSON.',
    '',
    `CREATIVE BRIEF: ${input.brief}`,
    input.title ? `TITLE HINT: ${input.title}` : '',
    input.shotCount ? `DESIRED SHOT COUNT: ${input.shotCount}` : 'DESIRED SHOT COUNT: you decide (typically 2-6 for an ad).',
    '',
    buildReferencesBlock(input.references),
    'SELECTED SAVED CHARACTERS — the operator EXPLICITLY chose these to appear. Cast each by its EXACT characterId where the story calls for it. For ANY other person/creature/object the brief needs, INVENT a NEW profile with a fresh unique id (e.g. "new_1") and a FULL casting card — never reach into the library on your own, never reuse a saved id you were not given here:',
    availableCastBlock,
    '',
    'SELECTED LOCATIONS (LOCKED DIGITAL SETS) — the operator EXPLICITLY chose these. The environment is LOCKED to them: author the environmentFingerprint and every environmentZone STRICTLY from each location\'s LOCKED SET DESCRIPTION below — same furniture in the same places, same windows on the same walls, same layout, same materials and lighting. NEVER add, remove, move, or change a set element between shots in the same location, and NEVER invent a different set. When NONE are selected, invent the environment from the brief as before:',
    selectedLocationsBlock,
    '',
    hasSelectedLocations
      ? 'ENVIRONMENT IS LOCKED — because locations were selected above, the SELECTED LOCATIONS are the authoritative environment. environmentFingerprint and environmentZones MUST be authored only from their LOCKED SET DESCRIPTIONS (one zone per location, in the order listed). Every shot\'s "environment" field must describe the EXACT same room as its location with the same furniture/windows/layout. Do NOT invent or alter the set.'
      : '',
    'OUTPUT CONTRACT — return ONLY this JSON object (no markdown, no preamble):',
    '{',
    '  "title": string,',
    '  "sharedChoices": {',
    '    "cutCount": integer (= number of shots),',
    '    "timePeriod": string  // era/year the piece is set in (REQUIRED),',
    '    "genre": string  // genre of the piece (REQUIRED),',
    '    "colorPalette": [ { "name": string, "hex": "#rrggbb" } ]  // 2-6 named swatches, the look bible,',
    '    "environmentFingerprint": string  // the written signature of the world — the single strongest cross-shot consistency anchor,',
    '    "cast": [ { "characterId": "<exact id from AVAILABLE CHARACTERS>", "lookId": "<optional exact lookId>", "name": string, "role": string, "notes": string, "apparentAge": string, "gender": string, "ethnicity": string, "build": string, "hairColor": string, "hairStyle": string, "wardrobe": string, "accessories": [string] (optional), "wardrobeMode": "flexible" | "signature" (optional) } ],  // fill the FULL identity + scene-appropriate wardrobe for every member,',
    '    "objects": [ { "id": "<fresh unique id, e.g. obj_1>", "name": string, "subjectKind": "object" | "creature", "description": string } ],  // REQUIRED whenever a NON-human subject matters to the story (an animal, creature, vehicle, robot, weapon, signature prop). Give each a model-sheet-grade physical description (materials, scale, distinguishing features). Omit referenceImageUrls — they are generated. Use [] only when the story has no such subject.',
    '    "moodKeywords": [string],',
    '    "cinematographyNotes": [string],',
    '    "artStyle": string',
    '  },',
    '  "shots": [',
    '    {',
    '      "title": string,',
    '      "action": string  // the forward-motion description of what happens,',
    '      "castMemberIds": [ "<characterId values that appear in this shot, from sharedChoices.cast>" ],',
    '      "objectIds": [ "<object ids from sharedChoices.objects that appear in this shot>" ],  // include every non-human subject present in the shot,',
    '      "environment": string  // consistent with environmentFingerprint,',
    '      "timeOfDay": string  // REQUIRED, consistent within a scene/zone,',
    '      "weather": string  // REQUIRED, consistent within a scene/zone,',
    '      "characterStates": [ { "characterId": string, "state": string } ]  // optional emotional+physical state per character present,',
    '      "costumeStates": [ { "characterId": string, "state": string } ]  // optional costume condition per character,',
    '      "propStates": [ { "objectId": string, "state": string } ]  // optional key-prop condition,',
    '      "camera": { "shotType": string, "movement": string, "lens": string },',
    '      "lighting": string,',
    '      "mood": string,',
    '      "durationSeconds": number,',
    '      "transitionIn": "continue" | "cut",',
    '      "dialogue": string (optional)',
    '    }',
    '  ]',
    '}',
    '',
    'HARD RULES:',
    '- Cast the SELECTED saved characters by their EXACT characterId. INVENT every OTHER character the story needs as a new sharedChoices.cast member with a FRESH unique id (e.g. "new_1", "new_2") and a full casting card; put non-human subjects (animals, creatures, vehicles, robots, signature props) in sharedChoices.objects with subjectKind. Reference every character per-shot in castMemberIds by its id. Do NOT output referenceImageUrls — they are resolved from a saved profile, or generated for an invented character.',
    '- NON-HUMAN SUBJECTS ARE NOT OPTIONAL: if the brief features an animal, creature, vehicle, robot, weapon, or signature prop, it MUST appear in sharedChoices.objects with its own id, a model-sheet-grade description, and be referenced per-shot via objectIds. A war-bear, a drone, a muscle car are SUBJECTS — never leave them only in prose. Treat them as seriously as cast.',
    '- For every cast member write "notes": a vivid 1-2 sentence description (build, face, wardrobe, demeanor) that a director would read off the production sheet. Never leave it blank.',
    '- For EVERY cast member also fill the full casting card: apparentAge, gender, ethnicity, build, hairColor, hairStyle, and a scene-appropriate "wardrobe" (+ accessories when fitting). Wardrobe + hair must suit timePeriod and genre. Default wardrobeMode to "flexible"; use "signature" only when the outfit IS the identity (uniform, superhero suit, mascot).',
    '- Always set sharedChoices.timePeriod and sharedChoices.genre, and keep every department consistent with them.',
    '- EVERY shot must set timeOfDay and weather (consistent within a scene/zone). For each character present, add a characterStates entry (emotional+physical) and a costumeStates entry when wardrobe condition matters; give propStates for key props. On a "continue" shot, state must follow logically from the prior shot.',
    '- cutCount MUST equal the number of items in shots.',
    '- environmentFingerprint + colorPalette are the look bible — keep every shot visually consistent with them.',
    '- DESIGN THE PAGE: include a "layout" (rows of side-by-side blocks with relative height/width weights) that composes a balanced, COMPLETELY FULL landscape page (see "YOU DESIGN THE PAGE" in your system prompt). Include every block type that has content; storyboard near the bottom; prompt last.',
    '- transitionIn: use "continue" when the shot is continuous action in the SAME place/time as the prior shot (an unbroken take); use "cut" when it is a NEW location or a time jump. The FIRST shot is always "cut".',
    '- Stay on-brand (see the Brand DNA in your system prompt). Never use any forbidden phrase. Never fabricate logos, statistics, or claims.',
    '- Output ONLY the JSON object.',
    priorZodErrors
      ? `\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix exactly these problems and return corrected JSON only:\n${priorZodErrors}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

// ============================================================================
// PUBLIC: generateShotPlan
// ============================================================================

function isoNow(): string {
  return new Date().toISOString();
}

function makeShotId(index: number): string {
  return `shot_${index + 1}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Clamp a number into the normalized [0,1] range. */
function clamp01(n: number): number {
  return Math.min(1, Math.max(0, n));
}

/** Assemble the contract-valid ShotPlan from the model body + resolved cast. */
function assembleShotPlan(
  body: LlmShotPlan,
  cast: ShotPlanCastMember[],
  titleHint: string | undefined,
  environmentReferenceImageUrls: string[],
): ShotPlan {
  const now = isoNow();
  const validCastIds = new Set(cast.map((c) => c.characterId));
  // Non-human subjects the model authored (war-bear, drone, vehicle…). Reference art
  // is generated later (referenceImageUrls start empty), exactly like invented cast.
  const objects: ShotPlanObject[] = (body.sharedChoices.objects ?? []).map((o) => ({
    id: o.id,
    name: o.name,
    referenceImageUrls: [],
    ...(o.subjectKind ? { subjectKind: o.subjectKind } : {}),
    ...(o.description ? { description: o.description } : {}),
  }));
  const validObjectIds = new Set(objects.map((o) => o.id));

  const shots = body.shots.map((shot, index) => {
    // Per-character continuity overlays — keep only references to cast that survived.
    const characterStates = shot.characterStates?.filter((s) => validCastIds.has(s.characterId));
    const costumeStates = shot.costumeStates?.filter((s) => validCastIds.has(s.characterId));
    // Per-prop continuity overlays — keep only references to known objects.
    const propStates = shot.propStates?.filter((s) => validObjectIds.has(s.objectId));
    // Per-shot object presence — keep only ids that resolve to a real object.
    const objectIds = shot.objectIds?.filter((id) => validObjectIds.has(id));
    return {
      id: makeShotId(index),
      index,
      title: shot.title,
      action: shot.action,
      // Keep only cast ids that survived resolution; the first shot can never "continue".
      castMemberIds: shot.castMemberIds.filter((id) => validCastIds.has(id)),
      ...(objectIds && objectIds.length > 0 ? { objectIds } : {}),
      environment: shot.environment,
      timeOfDay: shot.timeOfDay,
      weather: shot.weather,
      ...(characterStates && characterStates.length > 0 ? { characterStates } : {}),
      ...(costumeStates && costumeStates.length > 0 ? { costumeStates } : {}),
      ...(propStates && propStates.length > 0 ? { propStates } : {}),
      camera: shot.camera,
      lighting: shot.lighting,
      mood: shot.mood,
      durationSeconds: shot.durationSeconds,
      transitionIn: index === 0 ? ('cut' as const) : shot.transitionIn,
      dialogue: shot.dialogue,
    };
  });

  // Remap the AI floor plan's camera nodes from 0-based shotIndex → real shot id.
  const floorPlan: ShotPlanFloorPlan = {
    elements: body.floorPlan.elements.map((e) => ({
      ...e,
      refId: e.refId?.trim() ? e.refId.trim() : undefined,
    })),
    cameras: body.floorPlan.cameras
      .map((c) => {
        const target = shots[c.shotIndex];
        if (!target) {
          return null;
        }
        return {
          shotId: target.id,
          x: c.x,
          y: c.y,
          facing: c.facing,
          ...(c.fovDegrees !== undefined ? { fovDegrees: c.fovDegrees } : {}),
          ...(c.route ? { route: c.route } : {}),
        };
      })
      .filter((c): c is NonNullable<typeof c> => c !== null),
    subjectPaths: body.floorPlan.subjectPaths,
    // Per-location bands: assign each LLM zone a stable id, clamp the span, and
    // ensure x0 < x1 (swap if the model returned them reversed).
    ...(body.floorPlan.zones && body.floorPlan.zones.length > 0
      ? {
          zones: body.floorPlan.zones.map((z, i) => {
            const a = clamp01(z.x0);
            const b = clamp01(z.x1);
            return {
              id: `fz-${i}`,
              label: z.label,
              x0: Math.min(a, b),
              x1: Math.max(a, b),
            };
          }),
        }
      : {}),
  };

  // Consolidated environment zones: remap each LLM zone's 0-based cutIndices to the
  // real generated shot ids (mirrors the floor-plan camera shotIndex→shotId remap).
  // heroImageUrl is left undefined (rendered later). Omit the field if none returned.
  const environmentZones =
    body.sharedChoices.environmentZones && body.sharedChoices.environmentZones.length > 0
      ? body.sharedChoices.environmentZones.map((zone, i) => ({
          id: `zone-${i}`,
          label: zone.label,
          ...(zone.setDesign ? { setDesign: zone.setDesign } : {}),
          cutIds: (zone.cutIndices ?? [])
            .map((idx) => shots[idx]?.id)
            .filter((id): id is string => Boolean(id)),
        }))
      : undefined;

  const candidate: ShotPlan = {
    id: `splan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: titleHint ?? body.title,
    sharedChoices: {
      cutCount: shots.length,
      timePeriod: body.sharedChoices.timePeriod,
      genre: body.sharedChoices.genre,
      colorPalette: body.sharedChoices.colorPalette,
      environmentFingerprint: body.sharedChoices.environmentFingerprint,
      cast,
      // When the operator LOCKED the environment to selected locations, pin their union
      // of reference images as the set-identity anchors the generation service feeds into
      // Seedance (so the room renders the SAME way in every shot). Omit when none selected.
      ...(environmentReferenceImageUrls.length > 0 ? { environmentReferenceImageUrls } : {}),
      moodKeywords: body.sharedChoices.moodKeywords,
      cinematographyNotes: body.sharedChoices.cinematographyNotes,
      artStyle: body.sharedChoices.artStyle,
      lookBible: body.sharedChoices.lookBible,
      ...(objects.length > 0 ? { objects } : {}),
      ...(environmentZones ? { environmentZones } : {}),
      ...(body.sharedChoices.adaptiveLabels
        ? { adaptiveLabels: body.sharedChoices.adaptiveLabels }
        : {}),
    },
    shots,
    floorPlan,
    // The AI-designed page composition passes through as-is — it already matches the
    // ShotPlanLayout contract. Omit the field if (defensively) absent.
    ...(body.layout ? { layout: body.layout } : {}),
    createdAt: now,
    updatedAt: now,
    status: 'draft',
  };

  return candidate;
}

/**
 * Generate a complete, contract-valid ShotPlan from a creative brief, auto-casting
 * the operator's own saved characters. Retries once with the zod errors fed back if
 * the first assembled plan fails `ShotPlanSchema`.
 */
export async function generateShotPlan(input: GenerateShotPlanInput): Promise<ShotPlan> {
  const validated = GenerateShotPlanInputSchema.parse(input);
  const gm = await loadGMConfig(DEFAULT_INDUSTRY_KEY);

  // ONLY the characters the operator EXPLICITLY selected are real saved cast.
  // Everyone else the brief needs is invented fresh — the planner never auto-pulls
  // the whole library (that forced the same character into every video and risked
  // name collisions). No selection → no saved characters offered → invent all.
  const selectedIds = new Set(validated.selectedCharacterIds ?? []);
  const profiles =
    selectedIds.size > 0
      ? (await listAvatarProfiles(validated.userId, { ownOnly: true })).filter((p) => selectedIds.has(p.id))
      : [];
  const availableCastBlock = buildAvailableCastBlock(profiles);

  // SET-CONSISTENCY: ONLY the locations the operator EXPLICITLY selected LOCK the
  // environment. Their LOCKED descriptions become the authoritative set the planner must
  // author from (never invent/alter), and the union of their reference images is pinned as
  // the environment identity anchors. No selection → no locked set → invent the world.
  const selectedLocationIds = validated.selectedLocationIds ?? [];
  const locations =
    selectedLocationIds.length > 0
      ? (await listLocationProfiles(validated.userId, { ownOnly: true })).filter((l) =>
          selectedLocationIds.includes(l.id),
        )
      : [];
  const selectedLocationsBlock = buildSelectedLocationsBlock(locations);
  const environmentReferenceImageUrls = collectEnvironmentReferenceImageUrls(locations);

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

    const bodyResult = LlmShotPlanSchema.safeParse(parsedJson);
    if (!bodyResult.success) {
      priorZodErrors = bodyResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      continue;
    }

    const cast = resolveCast(bodyResult.data.sharedChoices.cast, profiles);
    const candidate = assembleShotPlan(
      bodyResult.data,
      cast,
      validated.title,
      environmentReferenceImageUrls,
    );

    const finalResult = ShotPlanSchema.safeParse(candidate);
    if (!finalResult.success) {
      priorZodErrors = finalResult.error.issues
        .map((i) => `${i.path.join('.')}: ${i.message}`)
        .join('; ');
      continue;
    }

    logger.info('[ShotPlanPlanner] plan generated', {
      shots: finalResult.data.shots.length,
      castSize: finalResult.data.sharedChoices.cast.length,
      file: FILE,
    });
    return finalResult.data;
  }

  throw new Error(
    `Shot Plan Planner could not produce a valid ShotPlan after 2 attempts. Last errors: ${priorZodErrors ?? 'unknown'}`,
  );
}

// ============================================================================
// PUBLIC: editShotPlanField — SURGICAL single-field regeneration
// ============================================================================

/**
 * Build the minimal look-bible context the surgical edit needs to stay consistent
 * (palette + cast + environment fingerprint), without dumping the whole plan.
 */
function buildLookBibleContext(plan: ShotPlan): string {
  const palette = plan.sharedChoices.colorPalette
    .map((s) => `${s.name} (${s.hex})`)
    .join(', ');
  const cast = plan.sharedChoices.cast
    .map((c) => `${c.name}${c.role ? ` [${c.role}]` : ''}`)
    .join(', ');
  return [
    `PALETTE: ${palette || '(none)'}`,
    `CAST: ${cast || '(none)'}`,
    `ENVIRONMENT FINGERPRINT: ${plan.sharedChoices.environmentFingerprint || '(none)'}`,
    `ART STYLE: ${plan.sharedChoices.artStyle ?? '(none)'}`,
  ].join('\n');
}

/** The current value of the field being edited, for the model to revise. */
function getCurrentFieldValue(
  plan: ShotPlan,
  target: ShotPlanEditTarget,
  field: string,
  shotId?: string,
): unknown {
  if (target === 'plan') {
    return (plan as unknown as Record<string, unknown>)[field];
  }
  if (target === 'shared') {
    return (plan.sharedChoices as unknown as Record<string, unknown>)[field];
  }
  const shot = plan.shots.find((s) => s.id === shotId);
  if (!shot) {
    throw new Error(`editShotPlanField: shot not found: ${shotId}`);
  }
  return (shot as unknown as Record<string, unknown>)[field];
}

/**
 * Regenerate ONLY the requested field of a Shot Plan from an operator instruction.
 * Returns just the NEW field value — the caller applies it via `applyShotPlanEdit`.
 * NEVER re-rolls the whole plan and NEVER edits the GM (Standing Rule #2).
 */
export async function editShotPlanField(input: EditShotPlanFieldInput): Promise<unknown> {
  const validated = EditShotPlanFieldInputSchema.parse(input);
  if (validated.target === 'shot' && !validated.shotId) {
    throw new Error('editShotPlanField: shotId is required when target is "shot".');
  }

  const gm = await loadGMConfig(DEFAULT_INDUSTRY_KEY);
  const currentValue = getCurrentFieldValue(
    validated.plan,
    validated.target,
    validated.field,
    validated.shotId,
  );

  const userPrompt = [
    'TASK: Revise EXACTLY ONE field of an existing Shot Plan based on the operator instruction.',
    'Return ONLY the new value for that single field as JSON — no wrapping object, no prose, no markdown.',
    '',
    'LOOK-BIBLE CONTEXT (keep the new value consistent with this — do NOT change anything else):',
    buildLookBibleContext(validated.plan),
    '',
    `FIELD TO REVISE: ${validated.target}.${validated.field}${validated.shotId ? ` (shot ${validated.shotId})` : ''}`,
    `CURRENT VALUE: ${JSON.stringify(currentValue)}`,
    `OPERATOR INSTRUCTION: ${validated.instruction}`,
    '',
    'RULES:',
    '- Output ONLY the new value, as valid JSON matching the SAME type/shape as CURRENT VALUE (string -> a JSON string, array -> a JSON array, etc.).',
    '- Keep it consistent with the look bible and on-brand (see Brand DNA in your system prompt).',
    '- Do not return any other field. Do not re-roll the plan.',
  ].join('\n');

  const rawContent = await callOpenRouter(gm, userPrompt, MIN_OUTPUT_TOKENS_FOR_FIELD);
  const stripped = stripJsonFences(rawContent);

  // The value may be a bare JSON value (string/number/array/object). Try JSON first;
  // if that fails and the current value is a string, treat the raw text as the string.
  try {
    return JSON.parse(stripped);
  } catch {
    if (typeof currentValue === 'string') {
      return stripped;
    }
    throw new Error(
      `editShotPlanField: model output was not valid JSON for a non-string field: ${stripped.slice(0, 200)}`,
    );
  }
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
  collectEnvironmentReferenceImageUrls,
  buildReferencesBlock,
  buildGenerateUserPrompt,
  buildLookBibleContext,
  resolveReferenceImageUrls,
  resolveCast,
  assembleShotPlan,
  LlmShotPlanSchema,
  GenerateShotPlanInputSchema,
  EditShotPlanFieldInputSchema,
  // Re-export contract schemas used in tests for convenience.
  ShotPlanSchema,
  ShotPlanSharedChoicesSchema,
  ShotPlanShotSchema,
};
