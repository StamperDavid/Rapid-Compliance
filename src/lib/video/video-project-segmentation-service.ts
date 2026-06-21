/**
 * Video Project Segmentation Service (server-side, ADDITIVE).
 *
 * The front door of the multi-document video PROJECT flow (owner-confirmed,
 * Jun 17 2026):
 *
 *   project brief  →  SEGMENT into ordered SCENE segments (LLM)
 *                  →  author ONE full Shot Doc per segment (reuse `generateShotPlan`)
 *                  →  render that doc's STILLS only — no video (reuse `renderShotPlanAssets`)
 *                  →  persist a VideoProject (status re-derives to 'review')
 *
 * This service does ONLY step 1's LLM work itself (splitting the brief into scenes);
 * everything else is delegated to the proven planner + still-render services so the
 * per-doc authoring, casting, look bible and asset render stay identical to the
 * single-doc path. Video is generated PER DOC later, on the operator's command — this
 * service never touches video.
 *
 * Server-only: it drives an LLM and the Admin-SDK-backed `createVideoProject`.
 *
 * Robustness mirrors `script-generation-service.ts`: strip code fences, find the JSON
 * object, `JSON.parse`, Zod-validate against a strict segmentation schema, and retry
 * ONCE (feeding the validation errors back to the model) before throwing an honest error.
 */

import { z } from 'zod';

import { OpenRouterProvider } from '@/lib/ai/openrouter-provider';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { generateShotPlan, type ShotPlanReference } from '@/lib/agents/content/shot-plan/planner';
import { renderShotPlanAssets } from '@/lib/video/shot-plan-generation-service';
import { createVideoProject } from '@/lib/video/video-project-service';
import type { VideoProject } from '@/types/video-project';
import type { ShotPlan } from '@/types/shot-plan';
import type { IntentSubject } from '@/lib/content/content-intent';

const FILE = 'video/video-project-segmentation-service.ts';

/** The model used for the SEGMENTATION step (the per-doc authoring uses the planner's GM model). */
const SEGMENTATION_MODEL = 'claude-sonnet-4.6';
/** Plenty of headroom for a short ordered list of scene segments. */
const SEGMENTATION_MAX_TOKENS = 4000;
/** Keep the project legible — never explode a brief into dozens of docs. */
const MAX_SEGMENTS = 6;
/** Per-doc shot-count guardrails (the planner clamps too, this keeps the ask sane). */
const MIN_SHOTS_PER_DOC = 3;
const MAX_SHOTS_PER_DOC = 8;

// ============================================================================
// INPUT CONTRACT
// ============================================================================

export interface GenerateProjectDocsInput {
  /** The project brief, in plain language — the whole film, not one scene. */
  brief: string;
  /** Optional project title (derived from the brief when omitted). */
  title?: string;
  /** Owner of the Character Library each doc auto-casts from (passed through to the planner). */
  userId: string;
  /**
   * Optional CONFIRMED intent subjects (Content Manager path). Subjects bound to a
   * saved Character Library character (`characterId`) are threaded into EVERY doc's
   * `selectedCharacterIds`, so the planner LOCKS that saved cast into the Shot Doc's
   * `sharedChoices.cast` instead of inventing fresh people. The Projects page caller
   * passes nothing — the planner then auto-invents the cast as before.
   */
  subjects?: IntentSubject[];
  /**
   * Optional reference materials (Content Manager path) — the operator's attached
   * images/videos/docs as the planner's text-only `references`. The Projects page
   * caller passes nothing.
   */
  attachments?: ShotPlanReference[];
}

// Only the three core scalars are Zod-gated here; `subjects` / `attachments` are
// already typed by the interface and threaded through to the planner, which runs
// its own Zod validation on them (IntentSubject / ShotPlanReference). Backward-
// compatible: the Projects page caller passes neither.
const GenerateProjectDocsInputSchema = z.object({
  brief: z.string().trim().min(1),
  title: z.string().trim().max(300).optional(),
  userId: z.string().trim().min(1),
});

// ============================================================================
// SEGMENTATION SCHEMA — what the LLM returns (then drives per-doc planning)
// ============================================================================

/**
 * One SCENE segment. `sceneBrief` is a SELF-CONTAINED brief written so the Shot
 * Plan planner can author a full Shot Doc from it alone (it must restate the world,
 * cast and beat — the planner does not see the other segments). `approxShots` is a
 * hint the planner is free to refine.
 */
const SceneSegmentSchema = z.object({
  /** Short scene title / slug for the doc. */
  title: z.string().trim().min(1).max(200),
  /** A complete, standalone brief for THIS scene (the planner's only input for the doc). */
  sceneBrief: z.string().trim().min(1).max(8000),
  /** Suggested number of shots for this doc (clamped to a sane range). */
  approxShots: z.number().int().min(1).max(50),
});

const SegmentationResponseSchema = z.object({
  /** A title for the whole project (used when the operator gave none). */
  projectTitle: z.string().trim().min(1).max(300),
  /** The ORDERED scene segments — play order of the final film. */
  segments: z.array(SceneSegmentSchema).min(1).max(MAX_SEGMENTS),
});

type SegmentationResponse = z.infer<typeof SegmentationResponseSchema>;
type SceneSegment = z.infer<typeof SceneSegmentSchema>;

// ============================================================================
// PROMPTING
// ============================================================================

function buildSegmentationSystemPrompt(): string {
  return [
    'You are a film producer breaking a creative brief into an ORDERED list of SCENE segments,',
    'one segment per distinct scene. A downstream director will author a full, standalone Shot',
    'Doc (storyboard) from EACH segment in isolation — so each segment must carry everything that',
    'director needs, with no reference to the other segments.',
    '',
    'SEGMENTATION HEURISTIC (follow it):',
    '- One segment per DISTINCT SCENE.',
    '- GROUP consecutive beats that share the SAME environment AND the SAME cast into ONE segment',
    '  (do not split a single continuous scene into multiple docs).',
    '- Start a NEW segment when the location changes, the cast changes substantially, or the story',
    '  makes a clear time jump.',
    `- Aim for a LEGIBLE number of segments — at most ${MAX_SEGMENTS}. Merge thin beats rather than`,
    '  producing many tiny docs. A simple brief may be a SINGLE segment; that is correct.',
    `- Each segment should be roughly ${MIN_SHOTS_PER_DOC}-${MAX_SHOTS_PER_DOC} shots' worth of action.`,
    '',
    'WRITING EACH sceneBrief (critical):',
    '- Make it SELF-CONTAINED: restate the world/setting, who is present, and what happens in this',
    '  scene, in plain language. The director sees ONLY this sceneBrief for the doc — never the',
    '  other segments or the original brief.',
    '- Carry shared continuity forward EXPLICITLY: if a character or location recurs from an earlier',
    '  scene, describe them again here (same person, same place) so the look stays consistent.',
    '- Keep the creative intent, tone and any specific characters/details from the original brief.',
    '',
    'OUTPUT: return ONLY a JSON object (no markdown, no code fences, no prose) of this exact shape:',
    '{',
    '  "projectTitle": string,',
    '  "segments": [',
    '    { "title": string, "sceneBrief": string, "approxShots": integer }',
    '  ]',
    '}',
    'The segments array MUST be in play order.',
  ].join('\n');
}

function buildSegmentationUserPrompt(brief: string, titleHint: string | undefined, priorErrors?: string): string {
  return [
    'PROJECT BRIEF (the whole film — segment it into ordered scenes):',
    brief,
    titleHint ? `\nTITLE HINT: ${titleHint}` : '',
    '\nReturn ONLY the JSON object described in your instructions.',
    priorErrors
      ? `\nYOUR PREVIOUS ATTEMPT FAILED VALIDATION. Fix exactly these problems and return corrected JSON only:\n${priorErrors}`
      : '',
  ]
    .filter((line) => line !== '')
    .join('\n');
}

/**
 * Pull the JSON object out of an LLM response — strip code fences first, then fall
 * back to the first `{ ... }` block. Mirrors the robust extraction in
 * `script-generation-service.ts`.
 */
function extractJsonObject(raw: string): string {
  let jsonStr = raw.trim();
  const fenceMatch = jsonStr.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/);
  if (fenceMatch) {
    jsonStr = fenceMatch[1].trim();
  }
  if (!jsonStr.startsWith('{')) {
    const braceStart = jsonStr.indexOf('{');
    const braceEnd = jsonStr.lastIndexOf('}');
    if (braceStart !== -1 && braceEnd > braceStart) {
      jsonStr = jsonStr.substring(braceStart, braceEnd + 1);
    }
  }
  return jsonStr;
}

// ============================================================================
// SEGMENTATION STEP — the LLM call + parse + Zod-validate + ONE retry
// ============================================================================

/**
 * Split a project brief into an ordered list of scene segments via the LLM.
 * Retries ONCE with the validation errors fed back; throws an honest error if the
 * model cannot produce a valid segmentation after two attempts.
 */
async function segmentBrief(brief: string, titleHint: string | undefined): Promise<SegmentationResponse> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const systemPrompt = buildSegmentationSystemPrompt();

  let priorErrors: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const userPrompt = buildSegmentationUserPrompt(brief, titleHint, priorErrors);

    let response: { content: string; finishReason?: string };
    try {
      response = await provider.chat({
        model: SEGMENTATION_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        temperature: 0.4,
        maxTokens: SEGMENTATION_MAX_TOKENS,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      logger.error(
        '[video-project-segmentation] LLM call failed',
        err instanceof Error ? err : new Error(message),
        { file: FILE, attempt },
      );
      // A transport failure is not something a retry prompt can fix — surface it.
      throw new Error(`Project segmentation LLM call failed: ${message}`);
    }

    const rawContent = (response.content ?? '').trim();
    if (rawContent.length === 0) {
      priorErrors = 'The model returned an empty response. Return the JSON object.';
      continue;
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(extractJsonObject(rawContent));
    } catch (parseErr) {
      priorErrors = `Output was not valid JSON (${parseErr instanceof Error ? parseErr.message : String(parseErr)}). Return ONLY the JSON object.`;
      continue;
    }

    const result = SegmentationResponseSchema.safeParse(parsed);
    if (!result.success) {
      priorErrors = result.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
      logger.warn('[video-project-segmentation] segmentation failed validation, retrying', {
        file: FILE,
        attempt,
        issues: priorErrors,
      });
      continue;
    }

    logger.info('[video-project-segmentation] brief segmented', {
      file: FILE,
      segments: result.data.segments.length,
      attempt,
    });
    return result.data;
  }

  throw new Error(
    `Project segmentation could not produce a valid result after 2 attempts. Last errors: ${priorErrors ?? 'unknown'}`,
  );
}

// ============================================================================
// PUBLIC: generateProjectDocs
// ============================================================================

/** Derive a fallback project title from the brief (first line / clause, trimmed). */
function deriveTitleFromBrief(brief: string): string {
  const firstLine = brief.split(/\r?\n/)[0]?.trim() ?? '';
  const clause = firstLine.split(/[.!?]/)[0]?.trim() || firstLine;
  const candidate = clause.length > 0 ? clause : brief.trim();
  return candidate.slice(0, 120) || 'Untitled Project';
}

/** Clamp a per-doc shot count into the sane authoring range. */
function clampShotCount(n: number): number {
  return Math.min(MAX_SHOTS_PER_DOC, Math.max(MIN_SHOTS_PER_DOC, Math.round(n)));
}

/**
 * Turn a project brief into a persisted multi-document `VideoProject` with every
 * doc's STILLS rendered and NO video — the project lands in 'review' (status is
 * re-derived by `createVideoProject` from docs that have no video).
 *
 * Pipeline:
 *   1. SEGMENT the brief into ordered scene segments (LLM, one retry on invalid).
 *   2. For EACH segment IN ORDER: author a full Shot Doc with `generateShotPlan`,
 *      then render its stills with `renderShotPlanAssets({ tenantId: PLATFORM_ID })`.
 *   3. Persist + return via `createVideoProject` (status re-derives to 'review').
 *
 * A single-segment brief yields a one-doc project — that is correct, not an error.
 *
 * CAST BINDING (Content Manager path): when `subjects` carry saved-character
 * `characterId`s (the operator already cast their own characters in the chat),
 * those ids are threaded into EVERY doc's `selectedCharacterIds`, so the planner
 * locks that saved cast into each Shot Doc's `sharedChoices.cast` rather than
 * inventing fresh people. `attachments` ride along as the planner's references.
 * Omitting both (the Projects page caller) preserves the original behavior.
 *
 * LONG-RUNNING: per segment it authors a doc (one LLM call) and renders its stills
 * (several image generations), sequentially. That is acceptable for this flow; a
 * queue/poll split can come later without changing this signature.
 */
export async function generateProjectDocs(input: GenerateProjectDocsInput): Promise<VideoProject> {
  const validated = GenerateProjectDocsInputSchema.parse(input);

  // Cast binding (Content Manager path): the saved characters the operator already
  // bound in the chat (subjects with a `characterId`) are the ONLY library cast the
  // planner may use — it LOCKS them into every doc's `sharedChoices.cast`. Empty /
  // omitted (Projects page path) → the planner invents the cast as before.
  const selectedCharacterIds = Array.from(
    new Set((input.subjects ?? []).map((s) => s.characterId).filter((id): id is string => Boolean(id))),
  );
  // The operator's attached references, as the planner's text-only reference inputs.
  const references = input.attachments ?? [];

  logger.info('[video-project-segmentation] generateProjectDocs started', {
    file: FILE,
    userId: validated.userId,
    briefLength: validated.brief.length,
    selectedCharacters: selectedCharacterIds.length,
    references: references.length,
  });

  // 1. Segment the brief into ordered scene segments.
  const segmentation = await segmentBrief(validated.brief, validated.title);
  const segments: SceneSegment[] = segmentation.segments;

  // 2. Author + render-stills for each segment, IN ORDER.
  const docs: ShotPlan[] = [];
  for (let i = 0; i < segments.length; i += 1) {
    const segment = segments[i];
    logger.info('[video-project-segmentation] authoring doc', {
      file: FILE,
      index: i,
      total: segments.length,
      title: segment.title,
    });

    // Author the full Shot Doc from this segment's self-contained scene brief.
    // Thread the bound cast + references into EVERY doc so the operator's saved
    // characters survive into every scene's `sharedChoices.cast`.
    const authored = await generateShotPlan({
      brief: segment.sceneBrief,
      userId: validated.userId,
      shotCount: clampShotCount(segment.approxShots),
      title: segment.title,
      ...(selectedCharacterIds.length > 0 ? { selectedCharacterIds } : {}),
      ...(references.length > 0 ? { references } : {}),
    });

    // Render THIS doc's stills only (floor plan, env hero, character/object sheets,
    // keyframes) — no video. Per-asset best-effort inside the render service.
    const rendered = await renderShotPlanAssets(authored, { tenantId: PLATFORM_ID });
    docs.push(rendered);
  }

  // 3. Persist. `createVideoProject` re-derives status — docs with no video → 'review'.
  // Title precedence: operator-supplied → the model's projectTitle → brief-derived.
  // (First NON-EMPTY value wins — empty strings fall through, hence the explicit guard.)
  const titleCandidates = [validated.title?.trim(), segmentation.projectTitle.trim()];
  const projectTitle =
    titleCandidates.find((t): t is string => typeof t === 'string' && t.length > 0) ??
    deriveTitleFromBrief(validated.brief);
  const project = await createVideoProject({
    title: projectTitle,
    brief: validated.brief,
    docs,
  });

  logger.info('[video-project-segmentation] project created', {
    file: FILE,
    projectId: project.id,
    docs: project.docs.length,
    status: project.status,
  });

  return project;
}
