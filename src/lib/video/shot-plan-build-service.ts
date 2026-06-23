/**
 * SERVER-SIDE Shot Plan build runner.
 *
 * Runs the WHOLE shot-doc build — draft the plan, then render every production
 * image — on the SERVER, in ONE long-running task, so it survives the operator
 * navigating away / refreshing / closing the tab. The browser fires ONE request
 * (POST /api/content/shot-plan/build) and then POLLS the project GET to watch the
 * doc fill in. This module owns NO HTTP — the route fires it and forgets.
 *
 * Where the state lives (GROUND TRUTH): the `/content/video` shot-doc flow stores
 * its plan inside a System-A "PipelineProject" doc at
 *   organizations/{PLATFORM_ID}/video_pipeline_projects/{projectId}
 * under the field `shotPlan`. The typed `pipeline-project-service.docToProject` does
 * NOT map `shotPlan` (or our new status fields), so we read/write the RAW doc with
 * the Admin SDK rather than fight the typed service.
 *
 * The build writes FOUR doc fields:
 *   - `shotPlan`         : the live ShotPlan (the same shape /api/video/project/save writes)
 *   - `shotPlanStatus`   : 'generating' | 'complete' | 'error'
 *   - `shotPlanProgress` : { phase, label, done, total, failed? } — plain-English progress
 *   - `shotPlanError`    : a human-readable message, only set on a fatal error
 *
 * Best-effort per render step: a single failed image is logged + skipped (the
 * failure count is surfaced in progress), never aborting the rest. Idempotent
 * where cheap: a re-trigger SKIPS work already persisted (floor-plan backdrop,
 * a shot keyframe, fully-rendered objects) so a retry resumes instead of redoing.
 */

import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { generateShotPlan } from '@/lib/agents/content/shot-plan/planner';
import {
  generateFloorPlanImage,
  generateEnvironmentHero,
  generateLightingSwatches,
  generateCharacterSheets,
  generateObjectSheets,
  generateShotKeyframe,
} from '@/lib/video/shot-plan-generation-service';
import type { TenantContext } from '@/lib/video/providers';
import type { ShotPlan } from '@/types/shot-plan';

const FILE = 'video/shot-plan-build-service.ts';

/** Doc-level lifecycle status for the build (distinct from the in-plan ShotPlan.status). */
export type ShotPlanBuildStatus = 'generating' | 'complete' | 'error';

/**
 * The build phases, in order. Plain enough that the client can map them to copy
 * without hard-coding our internals.
 */
export type ShotPlanBuildPhase =
  | 'drafting'
  | 'drafted'
  | 'floor-plan'
  | 'environment-hero'
  | 'lighting'
  | 'characters'
  | 'objects'
  | 'keyframes'
  | 'complete';

/** The progress object written to the project doc; the poller reads this verbatim. */
export interface ShotPlanBuildProgress {
  /** Coarse phase the build is in right now. */
  phase: ShotPlanBuildPhase;
  /** Plain-English label, e.g. "Rendering Dana's character sheet…". */
  label: string;
  /** Render steps finished so far (0 during drafting). */
  done: number;
  /** Total render steps the build will run (0 during drafting). */
  total: number;
  /** How many steps failed + were skipped (best-effort). Omitted while 0. */
  failed?: number;
}

export interface RunShotPlanBuildArgs {
  projectId: string;
  brief: string;
  userId: string;
  selectedLocationIds?: string[];
}

/** One ordered build step: render the LATEST plan and return the updated plan. */
interface BuildStep {
  /** Phase this step belongs to (drives the poller's coarse status). */
  phase: ShotPlanBuildPhase;
  /** Plain-English progress label shown while this step runs. */
  label: string;
  /** True when the step's output already exists — skip it (resume cheaply). */
  skip: (plan: ShotPlan) => boolean;
  /** Run the render on the LATEST plan; returns the updated plan. */
  run: (plan: ShotPlan, ctx: TenantContext) => Promise<ShotPlan>;
}

/** A friendly possessive for a label, e.g. "Dana" → "Dana's". */
function possessive(name: string): string {
  const trimmed = name.trim() || 'the character';
  return /s$/i.test(trimmed) ? `${trimmed}'` : `${trimmed}'s`;
}

/**
 * The raw project doc ref. Uses the Admin SDK + the centralized collection path
 * helper (no hardcoded PLATFORM_ID) so the multi-tenant flip only has to touch
 * `getSubCollection`.
 */
function projectDocRef(projectId: string) {
  if (!adminDb) {
    throw new Error('runShotPlanBuild: adminDb is null (Firebase Admin not initialized)');
  }
  return adminDb.collection(getSubCollection('video_pipeline_projects')).doc(projectId);
}

/**
 * Build the ordered render-step list + the total step count for a drafted plan.
 * Order: floor-plan → environment-hero → lighting → characters(per member) →
 * objects (only if any) → keyframes(per shot). Keyframes render AFTER characters
 * so they anchor to the freshly-rendered cast references.
 */
function buildSteps(plan: ShotPlan): BuildStep[] {
  const steps: BuildStep[] = [];

  // 1. Floor-plan backdrop — skip if it already exists.
  steps.push({
    phase: 'floor-plan',
    label: 'Rendering the floor plan…',
    skip: (p) => Boolean(p.floorPlan?.backdropImageUrl),
    run: (p, ctx) => generateFloorPlanImage(p, ctx),
  });

  // 2. Environment hero(es) — cheap to re-run (no reliable single skip flag).
  steps.push({
    phase: 'environment-hero',
    label: 'Rendering the environment…',
    skip: () => false,
    run: (p, ctx) => generateEnvironmentHero(p, ctx),
  });

  // 3. Lighting swatches — cheap to re-run.
  steps.push({
    phase: 'lighting',
    label: 'Rendering the lighting board…',
    skip: () => false,
    run: (p, ctx) => generateLightingSwatches(p, ctx),
  });

  // 4. One character sheet per cast member.
  for (const member of plan.sharedChoices.cast) {
    const memberId = member.characterId;
    steps.push({
      phase: 'characters',
      label: `Rendering ${possessive(member.name)} character sheet…`,
      // Character sheets can re-run (a re-trigger refreshes them); cheap relative to video.
      skip: () => false,
      run: (p, ctx) => generateCharacterSheets(p, ctx, memberId),
    });
  }

  // 5. Object sheets — ONE step, only when there are objects to render. Skip when
  //    every object already has reference art (fully-rendered = nothing to do).
  const objects = plan.sharedChoices.objects ?? [];
  if (objects.length > 0) {
    steps.push({
      phase: 'objects',
      label: 'Rendering object & prop references…',
      skip: (p) => {
        const objs = p.sharedChoices.objects ?? [];
        return objs.length > 0 && objs.every((o) => o.referenceImageUrls.length > 0);
      },
      run: (p, ctx) => generateObjectSheets(p, ctx),
    });
  }

  // 6. One keyframe still per shot, in plan order — skip a shot that already has one.
  const orderedShots = [...plan.shots].sort((a, b) => a.index - b.index);
  for (const shot of orderedShots) {
    const shotId = shot.id;
    const shotLabel = `Rendering shot ${shot.index + 1} still…`;
    steps.push({
      phase: 'keyframes',
      label: shotLabel,
      skip: (p) => Boolean(p.shots.find((s) => s.id === shotId)?.generated?.keyframeUrl),
      run: (p, ctx) => generateShotKeyframe(p, shotId, ctx),
    });
  }

  return steps;
}

/**
 * Run the WHOLE server-side shot-doc build for a project: draft the plan, then
 * render every production image, persisting after every step so the poller sees
 * the doc fill in live. Never throws — a fatal error is recorded on the doc
 * (`shotPlanStatus: 'error'`) and swallowed (logged) so the status is never left
 * stuck on 'generating'.
 */
export async function runShotPlanBuild(args: RunShotPlanBuildArgs): Promise<void> {
  const { projectId, brief, userId, selectedLocationIds } = args;
  const ref = projectDocRef(projectId);

  // Read the project doc ONCE up front to get its display name so generated assets
  // auto-file into the correct project folder in the media library.
  const projectSnap = await ref.get();
  const projectData = projectSnap.data();
  const projectName =
    (typeof projectData?.name === 'string' && projectData.name.trim()
      ? projectData.name.trim()
      : typeof projectData?.title === 'string' && projectData.title.trim()
        ? projectData.title.trim()
        : 'Project');

  const ctx: TenantContext = { tenantId: PLATFORM_ID, projectId, projectName };

  /** Write the live plan + status/progress onto the project doc (merge). */
  const persist = async (
    plan: ShotPlan,
    patch: { shotPlanStatus: ShotPlanBuildStatus; shotPlanProgress: ShotPlanBuildProgress },
  ): Promise<void> => {
    await ref.set(
      {
        shotPlan: plan,
        ...patch,
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );
  };

  try {
    logger.info('[shot-plan-build] starting build', { file: FILE, projectId, userId });

    // ── Phase 0: announce drafting BEFORE the LLM call so the poller sees it ──────
    // We can't persist a plan yet (none exists), so write just the status/progress.
    await ref.set(
      {
        shotPlanStatus: 'generating' satisfies ShotPlanBuildStatus,
        shotPlanProgress: {
          phase: 'drafting',
          label: 'Writing the shot plan…',
          done: 0,
          total: 0,
        } satisfies ShotPlanBuildProgress,
        // Clear any stale error from a prior failed attempt.
        shotPlanError: FieldValue.delete(),
        updatedAt: FieldValue.serverTimestamp(),
      },
      { merge: true },
    );

    // ── Phase 1: draft the plan (the LLM call) ───────────────────────────────────
    logger.info('[shot-plan-build] drafting plan', { file: FILE, projectId });
    const drafted = await generateShotPlan({
      brief,
      userId,
      ...(selectedLocationIds && selectedLocationIds.length > 0 ? { selectedLocationIds } : {}),
    });
    // Stamp a stable id (the projectId) if the planner left one blank — no randomness.
    let plan: ShotPlan = drafted.id ? drafted : { ...drafted, id: projectId };

    logger.info('[shot-plan-build] plan drafted', {
      file: FILE,
      projectId,
      shots: plan.shots.length,
      cast: plan.sharedChoices.cast.length,
    });

    await persist(plan, {
      shotPlanStatus: 'generating',
      shotPlanProgress: {
        phase: 'drafted',
        label: 'Shot plan written. Rendering the production sheet…',
        done: 0,
        total: 0,
      },
    });

    // ── Phase 2: render every production image, step-by-step ─────────────────────
    const steps = buildSteps(plan);
    const total = steps.length;
    let done = 0;
    let failed = 0;

    for (const step of steps) {
      // Resume cheaply: skip a step whose output already exists on the live plan.
      if (step.skip(plan)) {
        done += 1;
        logger.info('[shot-plan-build] step skipped (already done)', {
          file: FILE,
          projectId,
          phase: step.phase,
          done,
          total,
        });
        await persist(plan, {
          shotPlanStatus: 'generating',
          shotPlanProgress: {
            phase: step.phase,
            label: step.label,
            done,
            total,
            ...(failed > 0 ? { failed } : {}),
          },
        });
        continue;
      }

      // Announce the step as it STARTS (so the poller sees what's running now).
      logger.info('[shot-plan-build] step start', {
        file: FILE,
        projectId,
        phase: step.phase,
        label: step.label,
        done,
        total,
      });
      await persist(plan, {
        shotPlanStatus: 'generating',
        shotPlanProgress: {
          phase: step.phase,
          label: step.label,
          done,
          total,
          ...(failed > 0 ? { failed } : {}),
        },
      });

      // Best-effort: a failed step is logged + skipped, never aborts the rest.
      try {
        plan = await step.run(plan, ctx);
        done += 1;
        logger.info('[shot-plan-build] step persisted', {
          file: FILE,
          projectId,
          phase: step.phase,
          done,
          total,
        });
        await persist(plan, {
          shotPlanStatus: 'generating',
          shotPlanProgress: {
            phase: step.phase,
            label: step.label,
            done,
            total,
            ...(failed > 0 ? { failed } : {}),
          },
        });
      } catch (err) {
        failed += 1;
        done += 1;
        logger.error(
          '[shot-plan-build] step failed (skipping)',
          err instanceof Error ? err : new Error(String(err)),
          { file: FILE, projectId, phase: step.phase, label: step.label, failed },
        );
        // Record the advance + failure count, keeping the last-good plan.
        await persist(plan, {
          shotPlanStatus: 'generating',
          shotPlanProgress: {
            phase: step.phase,
            label: step.label,
            done,
            total,
            failed,
          },
        });
      }
    }

    // ── Phase 3: complete ────────────────────────────────────────────────────────
    logger.info('[shot-plan-build] build complete', {
      file: FILE,
      projectId,
      total,
      failed,
    });
    await persist(plan, {
      shotPlanStatus: 'complete',
      shotPlanProgress: {
        phase: 'complete',
        label: 'Done',
        done: total,
        total,
        ...(failed > 0 ? { failed } : {}),
      },
    });
  } catch (err) {
    // A FATAL error (e.g. the draft failed): record it so the status is never
    // left stuck on 'generating'. Swallow (log) — this runs fire-and-forget.
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[shot-plan-build] fatal build error',
      err instanceof Error ? err : new Error(message),
      { file: FILE, projectId },
    );
    try {
      await ref.set(
        {
          shotPlanStatus: 'error' satisfies ShotPlanBuildStatus,
          shotPlanError: message,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (writeErr) {
      logger.error(
        '[shot-plan-build] failed to record fatal error on doc',
        writeErr instanceof Error ? writeErr : new Error(String(writeErr)),
        { file: FILE, projectId },
      );
    }
  }
}
