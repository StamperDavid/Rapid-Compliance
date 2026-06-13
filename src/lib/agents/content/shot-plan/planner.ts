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
import {
  ShotPlanSchema,
  ShotPlanSharedChoicesSchema,
  ShotPlanShotSchema,
  ShotPlanLookBibleSchema,
  type ShotPlan,
  type ShotPlanCastMember,
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
});

/** The plan body the model returns (envelope fields id/createdAt/updatedAt are ours). */
const LlmShotPlanSchema = z.object({
  title: z.string().trim().min(1),
  sharedChoices: z.object({
    cutCount: z.number().int().min(1).max(50),
    colorPalette: z
      .array(
        z.object({
          name: z.string().trim().min(1),
          hex: z.string().trim().regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/),
        }),
      )
      .min(1),
    environmentFingerprint: z.string().trim().min(1),
    cast: z.array(LlmCastMemberSchema).default([]),
    moodKeywords: z.array(z.string().trim().min(1)).default([]),
    cinematographyNotes: z.array(z.string().trim().min(1)).default([]),
    artStyle: z.string().trim().min(1).optional(),
    // The deep, SET-ONCE cinematic look bible — the model MUST fill it.
    lookBible: ShotPlanLookBibleSchema,
  }),
  shots: z
    .array(
      z.object({
        title: z.string().trim().min(1),
        action: z.string().trim().min(1),
        castMemberIds: z.array(z.string().trim().min(1)).default([]),
        environment: z.string().trim().min(1),
        camera: z.object({
          shotType: z.string().trim().min(1).optional(),
          movement: z.string().trim().min(1).optional(),
          lens: z.string().trim().min(1).optional(),
          lensType: z.string().trim().min(1).optional(),
          focalLength: z.string().trim().min(1).optional(),
          composition: z.string().trim().min(1).optional(),
          viewingDirection: z.enum(['front', 'back', 'left', 'right']).optional(),
          subjectUnawareOfCamera: z.boolean().optional(),
        }),
        lighting: z.string().trim().min(1).optional(),
        mood: z.string().trim().min(1).optional(),
        durationSeconds: z.number().min(1).max(120),
        transitionIn: z.enum(['continue', 'cut']),
        dialogue: z.string().trim().min(1).optional(),
      }),
    )
    .min(1),
  // The AI-authored top-down blocking (camera cuts + routes + actor placement).
  floorPlan: LlmFloorPlanSchema,
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
    return '  (the operator has no saved characters — cast = [] and describe people generically in shot actions)';
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

/**
 * Map the model's cast picks back onto the contract, re-resolving referenceImageUrls
 * from the real profiles (the model never supplies image URLs). Picks that don't match
 * a real characterId are dropped, and matching per-shot castMemberIds are pruned to the
 * survivors so the plan stays internally consistent.
 */
function resolveCast(
  llmCast: LlmShotPlan['sharedChoices']['cast'],
  profiles: AvatarProfile[],
): ShotPlanCastMember[] {
  const byId = new Map(profiles.map((p) => [p.id, p]));
  const resolved: ShotPlanCastMember[] = [];
  for (const member of llmCast) {
    const profile = byId.get(member.characterId);
    if (!profile) {
      logger.warn('[ShotPlanPlanner] dropping cast pick with unknown characterId', {
        characterId: member.characterId,
        file: FILE,
      });
      continue;
    }
    resolved.push({
      characterId: member.characterId,
      lookId: member.lookId,
      name: member.name || profile.name,
      referenceImageUrls: resolveReferenceImageUrls(profile, member.lookId),
      role: member.role,
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
    'AVAILABLE CHARACTERS (the operator\'s saved cast — AUTO-CAST these by their EXACT characterId; never invent characters):',
    availableCastBlock,
    '',
    'OUTPUT CONTRACT — return ONLY this JSON object (no markdown, no preamble):',
    '{',
    '  "title": string,',
    '  "sharedChoices": {',
    '    "cutCount": integer (= number of shots),',
    '    "colorPalette": [ { "name": string, "hex": "#rrggbb" } ]  // 2-6 named swatches, the look bible,',
    '    "environmentFingerprint": string  // the written signature of the world — the single strongest cross-shot consistency anchor,',
    '    "cast": [ { "characterId": "<exact id from AVAILABLE CHARACTERS>", "lookId": "<optional exact lookId>", "name": string, "role": string } ],',
    '    "moodKeywords": [string],',
    '    "cinematographyNotes": [string],',
    '    "artStyle": string',
    '  },',
    '  "shots": [',
    '    {',
    '      "title": string,',
    '      "action": string  // the forward-motion description of what happens,',
    '      "castMemberIds": [ "<characterId values that appear in this shot, from sharedChoices.cast>" ],',
    '      "environment": string  // consistent with environmentFingerprint,',
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
    '- Auto-cast the operator\'s real characters: any character that appears must be in sharedChoices.cast with its EXACT characterId, and referenced per-shot in castMemberIds by that same id. Do NOT output referenceImageUrls — those are resolved from the profile automatically.',
    '- cutCount MUST equal the number of items in shots.',
    '- environmentFingerprint + colorPalette are the look bible — keep every shot visually consistent with them.',
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

/** Assemble the contract-valid ShotPlan from the model body + resolved cast. */
function assembleShotPlan(
  body: LlmShotPlan,
  cast: ShotPlanCastMember[],
  titleHint: string | undefined,
): ShotPlan {
  const now = isoNow();
  const validCastIds = new Set(cast.map((c) => c.characterId));

  const shots = body.shots.map((shot, index) => ({
    id: makeShotId(index),
    index,
    title: shot.title,
    action: shot.action,
    // Keep only cast ids that survived resolution; the first shot can never "continue".
    castMemberIds: shot.castMemberIds.filter((id) => validCastIds.has(id)),
    environment: shot.environment,
    camera: shot.camera,
    lighting: shot.lighting,
    mood: shot.mood,
    durationSeconds: shot.durationSeconds,
    transitionIn: index === 0 ? ('cut' as const) : shot.transitionIn,
    dialogue: shot.dialogue,
  }));

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
  };

  const candidate: ShotPlan = {
    id: `splan_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    title: titleHint ?? body.title,
    sharedChoices: {
      cutCount: shots.length,
      colorPalette: body.sharedChoices.colorPalette,
      environmentFingerprint: body.sharedChoices.environmentFingerprint,
      cast,
      moodKeywords: body.sharedChoices.moodKeywords,
      cinematographyNotes: body.sharedChoices.cinematographyNotes,
      artStyle: body.sharedChoices.artStyle,
      lookBible: body.sharedChoices.lookBible,
    },
    shots,
    floorPlan,
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

  // Auto-cast source: the operator's OWN created characters only.
  const profiles = await listAvatarProfiles(validated.userId, { ownOnly: true });
  const availableCastBlock = buildAvailableCastBlock(profiles);

  let priorZodErrors: string | undefined;
  for (let attempt = 0; attempt < 2; attempt++) {
    const userPrompt = buildGenerateUserPrompt(validated, availableCastBlock, priorZodErrors);
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
    const candidate = assembleShotPlan(bodyResult.data, cast, validated.title);

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
