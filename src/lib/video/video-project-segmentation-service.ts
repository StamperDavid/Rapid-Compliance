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
import {
  createVideoProject,
  appendProjectDoc,
  setProjectBuild,
  setProjectTitle,
} from '@/lib/video/video-project-service';
import type { VideoProject } from '@/types/video-project';
import type { ShotPlan } from '@/types/shot-plan';
import type { IntentSubject } from '@/lib/content/content-intent';
import {
  type ScriptDocument,
  type ScriptScene,
  type VideoLocation,
  deriveScriptTotalSeconds,
} from '@/types/video-script';

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
/** A single shot doc covers up to ~this many seconds of story; longer videos need more docs. */
const SECONDS_PER_DOC = 30;

/**
 * How many shot docs a video of the given length needs: one doc per ~30s of story.
 * A 30-second video = 1 doc; 90s ≈ 3; capped at MAX_SEGMENTS. Unknown length → 1.
 */
function targetDocCount(durationSeconds: number | undefined): number {
  const secs = durationSeconds && durationSeconds > 0 ? durationSeconds : SECONDS_PER_DOC;
  return Math.max(1, Math.min(MAX_SEGMENTS, Math.ceil(secs / SECONDS_PER_DOC)));
}

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

function buildSegmentationUserPrompt(
  brief: string,
  titleHint: string | undefined,
  targetDocs: number | undefined,
  priorErrors?: string,
): string {
  return [
    'PROJECT BRIEF (the whole film — segment it into ordered scenes):',
    brief,
    titleHint ? `\nTITLE HINT: ${titleHint}` : '',
    // When the caller knows the video's LENGTH, the doc count is fixed (~30s of story per
    // doc). Honor it — do NOT over-segment a short video into many tiny docs.
    targetDocs
      ? `\nThis video needs EXACTLY ${targetDocs} segment${targetDocs === 1 ? '' : 's'} ` +
        `(one shot doc per ~30 seconds of story). Return exactly ${targetDocs}.`
      : '',
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
async function segmentBrief(
  brief: string,
  titleHint: string | undefined,
  targetDocs?: number,
): Promise<SegmentationResponse> {
  const provider = new OpenRouterProvider(PLATFORM_ID);
  const systemPrompt = buildSegmentationSystemPrompt();

  let priorErrors: string | undefined;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const userPrompt = buildSegmentationUserPrompt(brief, titleHint, targetDocs, priorErrors);

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

    // Hard safety net against over-segmentation: when the length fixes the count, never
    // return more docs than that, even if the model ignored the instruction.
    const trimmed: SegmentationResponse =
      targetDocs && result.data.segments.length > targetDocs
        ? { ...result.data, segments: result.data.segments.slice(0, targetDocs) }
        : result.data;

    logger.info('[video-project-segmentation] brief segmented', {
      file: FILE,
      segments: trimmed.segments.length,
      targetDocs,
      attempt,
    });
    return trimmed;
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
    createdByUid: validated.userId,
  });

  logger.info('[video-project-segmentation] project created', {
    file: FILE,
    projectId: project.id,
    docs: project.docs.length,
    status: project.status,
  });

  return project;
}

// ============================================================================
// PUBLIC: buildProjectDocsIntoProject (Content Manager FAST-HANDOFF background build)
// ============================================================================

export interface BuildProjectDocsIntoProjectInput {
  /** The already-created project SHELL to fill (so the chat can hand off instantly). */
  projectId: string;
  /** The project brief — the whole film, not one scene. */
  brief: string;
  /** Owner of the Character Library each doc auto-casts from. */
  userId: string;
  /** Optional title hint (a better one may come from segmentation). */
  title?: string;
  /** Target video length in seconds — decides the doc count (~30s per shot doc). */
  durationSeconds?: number;
  /** Confirmed intent subjects (saved-character bindings thread into every doc). */
  subjects?: IntentSubject[];
  /** Operator's attached references (the planner's text-only reference inputs). */
  attachments?: ShotPlanReference[];
}

/**
 * Fill an EXISTING project shell with its Shot Docs IN THE BACKGROUND, persisting each doc
 * the moment it is authored + rendered and writing plain-English `build` progress as it
 * goes. This is the fast-handoff counterpart to `generateProjectDocs`: the Content Manager
 * creates the shell, hands the operator off to the review page immediately, and calls this
 * (fire-and-forget) so the docs stream in instead of blocking the chat for the whole render.
 *
 * Resilient by design: one doc failing to author/render is logged and SKIPPED (a partial
 * project beats a total failure); only a fatal error (e.g. segmentation failed) marks the
 * whole build 'error'. Never throws to its caller — it owns its own error reporting via the
 * project's `build` field, which the review page polls.
 */
export async function buildProjectDocsIntoProject(
  input: BuildProjectDocsIntoProjectInput,
): Promise<void> {
  const { projectId } = input;
  const selectedCharacterIds = Array.from(
    new Set((input.subjects ?? []).map((s) => s.characterId).filter((id): id is string => Boolean(id))),
  );
  const references = input.attachments ?? [];

  try {
    await setProjectBuild(projectId, {
      status: 'running',
      phase: 'Planning the scenes for your video…',
      done: 0,
      total: 0,
    });

    const targetDocs = targetDocCount(input.durationSeconds);
    const segmentation = await segmentBrief(input.brief, input.title, targetDocs);
    const segments: SceneSegment[] = segmentation.segments;
    const total = segments.length;

    // Adopt the model's project title when the caller didn't supply a strong one.
    const betterTitle = [input.title?.trim(), segmentation.projectTitle.trim()].find(
      (t): t is string => typeof t === 'string' && t.length > 0,
    );
    if (betterTitle) {
      await setProjectTitle(projectId, betterTitle);
    }

    logger.info('[video-project-segmentation] background build started', {
      file: FILE,
      projectId,
      total,
      selectedCharacters: selectedCharacterIds.length,
      references: references.length,
    });

    let done = 0;
    for (let i = 0; i < segments.length; i += 1) {
      const segment = segments[i];
      await setProjectBuild(projectId, {
        status: 'running',
        phase: `Writing scene ${i + 1} of ${total}: ${segment.title}`,
        done,
        total,
      });
      try {
        const authored = await generateShotPlan({
          brief: segment.sceneBrief,
          userId: input.userId,
          shotCount: clampShotCount(segment.approxShots),
          title: segment.title,
          ...(selectedCharacterIds.length > 0 ? { selectedCharacterIds } : {}),
          ...(references.length > 0 ? { references } : {}),
        });
        const rendered = await renderShotPlanAssets(authored, { tenantId: PLATFORM_ID });
        await appendProjectDoc(projectId, rendered);
        done += 1;
        await setProjectBuild(projectId, {
          status: 'running',
          phase: `Finished scene ${i + 1} of ${total}`,
          done,
          total,
        });
      } catch (docErr) {
        // One scene failing must NOT kill the whole project — skip it and keep going.
        logger.warn('[video-project-segmentation] scene build failed — skipping', {
          file: FILE,
          projectId,
          index: i,
          error: docErr instanceof Error ? docErr.message : String(docErr),
        });
      }
    }

    if (done === 0) {
      await setProjectBuild(projectId, {
        status: 'error',
        phase: 'We could not build any scenes for this video. Please try again.',
        done: 0,
        total,
        error: 'Every scene failed to build.',
      });
      return;
    }

    await setProjectBuild(projectId, {
      status: 'complete',
      phase: `All ${done} ${done === 1 ? 'scene is' : 'scenes are'} ready to review.`,
      done,
      total,
    });
    logger.info('[video-project-segmentation] background build complete', {
      file: FILE,
      projectId,
      built: done,
      total,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[video-project-segmentation] background build failed',
      err instanceof Error ? err : new Error(message),
      { file: FILE, projectId },
    );
    // Best-effort: surface the failure on the project so the review page never lies.
    try {
      await setProjectBuild(projectId, {
        status: 'error',
        phase: 'Something went wrong while building your video.',
        done: 0,
        total: 0,
        error: message,
      });
    } catch {
      /* swallow — the original error is already logged */
    }
  }
}

// ============================================================================
// PUBLIC: generateProjectDocsFromScript (VP-D handoff)
// ============================================================================

/**
 * Input for the script → project handoff. The operator has already written +
 * edited a timed `ScriptDocument` on the front-door form (VP-C); approving it
 * builds the multi-document `VideoProject` from it (VP-D).
 */
export interface GenerateProjectDocsFromScriptInput {
  /** The operator-approved (possibly edited) timed script — the source of truth. */
  script: ScriptDocument;
  /** Owner of the Character Library each doc casts from (threaded to the planner). */
  userId: string;
  /**
   * Of the script's cast, the ids that are REAL saved Character-Library characters
   * the operator picked UP FRONT. Only these are locked into a doc's
   * `sharedChoices.cast` (per scene, for the characters actually present). Invented
   * story characters carry descriptive ids and are NOT in this set, so the planner
   * is free to author them. Empty / omitted → the planner invents everyone.
   */
  savedCharacterIds?: string[];
  /**
   * Optional id → display-name map (the form knows the names of the saved
   * characters it offered). Used ONLY to make the per-scene brief readable; the
   * real casting binding rides on `savedCharacterIds`.
   */
  characterNames?: Record<string, string>;
}

/** Render one reusable location as a plain-language line for a scene brief. */
function describeLocation(loc: VideoLocation | undefined): string {
  if (!loc) {
    return '';
  }
  const parts = [
    `Location: ${loc.name} (${loc.locationType}${loc.locale ? `, ${loc.locale}` : ''}).`,
    loc.description ? `The set: ${loc.description}.` : '',
    loc.environmentLook ? `Established look: ${loc.environmentLook}.` : '',
  ];
  return parts.filter((p) => p.length > 0).join(' ');
}

/**
 * Assemble a SELF-CONTAINED, plain-language brief for ONE scene out of the
 * structured script. The Shot Doc planner sees ONLY this string for the doc, so it
 * restates the world, who is present, and every shot (action, movement, timed
 * dialogue, on-screen text, SFX) — mirroring the contract `segmentBrief` produces,
 * but DETERMINISTICALLY from the script (no second LLM segmentation call).
 */
function buildSceneBriefFromScript(
  script: ScriptDocument,
  scene: ScriptScene,
  characterNames: Record<string, string>,
): string {
  const nameFor = (id: string): string => characterNames[id]?.trim() || id;

  const loc = script.locations.find((l) => l.id === scene.locationId);
  const lines: string[] = [];

  lines.push(`This is one scene of a video titled "${script.title || 'Untitled video'}".`);
  if (script.coreMessage) {
    lines.push(`Overall message of the whole video: ${script.coreMessage}.`);
  }
  if (script.tone) {
    lines.push(`Tone: ${script.tone}.`);
  }
  if (script.lookBible?.filmLook) {
    lines.push(`Film look: ${script.lookBible.filmLook}.`);
  }
  if (script.lookBible?.palette?.length) {
    lines.push(`Color palette: ${script.lookBible.palette.join(', ')}.`);
  }

  lines.push('');
  lines.push(`SCENE PURPOSE: ${scene.purpose || 'advance the story'}.`);

  const locDesc = describeLocation(loc);
  if (locDesc) {
    lines.push(locDesc);
  }
  const timeOfDay = scene.timeOfDay ?? loc?.defaultTimeOfDay;
  const weather = scene.weather ?? loc?.defaultWeather;
  if (timeOfDay) {
    lines.push(`Time of day: ${timeOfDay}.`);
  }
  if (weather) {
    lines.push(`Weather / light: ${weather}.`);
  }
  if (scene.sceneMood) {
    lines.push(`Mood: ${scene.sceneMood}.`);
  }
  if (scene.ambience) {
    lines.push(`Ambient sound: ${scene.ambience}.`);
  }

  if (scene.charactersPresent.length > 0) {
    lines.push('');
    lines.push('CHARACTERS PRESENT (keep them consistent):');
    for (const c of scene.charactersPresent) {
      const detail = [c.wardrobe ? `wearing ${c.wardrobe}` : '', c.state ?? '']
        .filter((d) => d.length > 0)
        .join('; ');
      lines.push(`- ${nameFor(c.characterId)}${detail ? ` — ${detail}` : ''}`);
    }
  }

  lines.push('');
  lines.push('SHOTS (in order):');
  const ordered = [...scene.shots].sort((a, b) => a.index - b.index);
  ordered.forEach((shot, i) => {
    const head = [`${i + 1}. ${shot.action || 'action beat'} (~${Math.round(shot.durationSec)}s).`];
    if (shot.movement) {
      head.push(`Camera: ${shot.movement}.`);
    }
    lines.push(head.join(' '));
    for (const line of shot.lines) {
      const who = line.speaker.kind === 'narrator' ? 'Narrator' : nameFor(line.speaker.characterId);
      lines.push(`   ${who}: "${line.text}"${line.deliveryNote ? ` (${line.deliveryNote})` : ''}`);
    }
    for (const t of shot.onScreenText) {
      lines.push(`   On-screen text: "${t.text}"`);
    }
    for (const s of shot.sfxCues) {
      lines.push(`   Sound effect: ${s.description}`);
    }
  });

  const isLastScene = scene.index >= script.scenes.length - 1;
  if (script.callToAction && isLastScene) {
    lines.push('');
    lines.push(`Close the scene on this call to action: ${script.callToAction}.`);
  }

  return lines.join('\n');
}

/** A short, human doc title for a scene. */
function deriveSceneDocTitle(scene: ScriptScene): string {
  const purpose = scene.purpose.trim();
  const tail = purpose.length > 0 ? `: ${purpose.slice(0, 60)}` : '';
  return `Scene ${scene.index + 1}${tail}`;
}

/**
 * Build a persisted multi-document `VideoProject` directly from an operator-approved
 * timed `ScriptDocument` (VP-D). This is the script-first counterpart to
 * `generateProjectDocs` (brief-first):
 *
 *   script  →  for EACH scene IN ORDER: assemble a self-contained scene brief
 *           →  author a full Shot Doc with `generateShotPlan`
 *              (locking the scene's PRESENT saved characters into its cast)
 *           →  render that doc's STILLS only (no video)
 *           →  persist + return via `createVideoProject` (status → 'review')
 *
 * The expensive segmentation LLM call is NOT needed here — the script already IS the
 * segmentation (one scene = one doc), so each scene brief is assembled
 * deterministically from the structured script. Video is generated PER DOC later, on
 * the operator's command. LONG-RUNNING for the same reason as `generateProjectDocs`
 * (one authoring LLM call + several still renders per scene, sequentially).
 */
export async function generateProjectDocsFromScript(
  input: GenerateProjectDocsFromScriptInput,
): Promise<VideoProject> {
  const { script, userId } = input;
  if (!userId.trim()) {
    throw new Error('A user id is required to build the project.');
  }
  if (script.scenes.length === 0) {
    throw new Error('This script has no scenes yet — add at least one scene before building the videos.');
  }

  const savedSet = new Set((input.savedCharacterIds ?? []).filter((id) => id.trim().length > 0));
  const characterNames = input.characterNames ?? {};

  logger.info('[video-project-segmentation] generateProjectDocsFromScript started', {
    file: FILE,
    userId,
    scenes: script.scenes.length,
    savedCharacters: savedSet.size,
    totalSeconds: deriveScriptTotalSeconds(script),
  });

  const orderedScenes = [...script.scenes].sort((a, b) => a.index - b.index);
  const docs: ShotPlan[] = [];

  for (let i = 0; i < orderedScenes.length; i += 1) {
    const scene = orderedScenes[i];

    // Lock ONLY the saved characters actually PRESENT in this scene into its cast —
    // invented story characters (not in the saved set) are left to the planner.
    const sceneSavedIds = Array.from(
      new Set(
        scene.charactersPresent
          .map((c) => c.characterId)
          .filter((id) => savedSet.has(id)),
      ),
    );

    const sceneBrief = buildSceneBriefFromScript(script, scene, characterNames);

    logger.info('[video-project-segmentation] authoring doc from script scene', {
      file: FILE,
      index: i,
      total: orderedScenes.length,
      lockedSavedCharacters: sceneSavedIds.length,
    });

    const authored = await generateShotPlan({
      brief: sceneBrief,
      userId,
      shotCount: clampShotCount(scene.shots.length || MIN_SHOTS_PER_DOC),
      title: deriveSceneDocTitle(scene),
      ...(sceneSavedIds.length > 0 ? { selectedCharacterIds: sceneSavedIds } : {}),
    });

    const rendered = await renderShotPlanAssets(authored, { tenantId: PLATFORM_ID });
    docs.push(rendered);
  }

  const projectTitle =
    script.title.trim().length > 0 ? script.title.trim() : deriveTitleFromBrief(script.objective || script.coreMessage);
  // Keep a readable brief on the project for context (the script is the real source).
  const projectBrief =
    [script.objective, script.coreMessage].find((t) => t.trim().length > 0)?.trim() ?? projectTitle;

  const project = await createVideoProject({
    title: projectTitle,
    brief: projectBrief,
    docs,
    createdByUid: userId,
  });

  logger.info('[video-project-segmentation] project created from script', {
    file: FILE,
    projectId: project.id,
    docs: project.docs.length,
    status: project.status,
  });

  return project;
}
