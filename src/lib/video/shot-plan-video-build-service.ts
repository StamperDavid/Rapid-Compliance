/**
 * SERVER-SIDE Shot Plan VIDEO build runner.
 *
 * The VIDEO twin of `shot-plan-build-service.ts`. Where that runner drafts the
 * plan + renders every production STILL, this runner renders every SHOT'S VIDEO
 * CLIP (Seedance + lip-sync) on the SERVER, in ONE long-running task, so it
 * survives the operator navigating to the editor / refreshing / closing the tab.
 * The browser fires ONE request (POST /api/content/shot-plan/generate-videos)
 * and then POLLS the project GET to watch the clips land one by one. This module
 * owns NO HTTP — the route fires it and forgets.
 *
 * Where the state lives (GROUND TRUTH): the shot-doc flow stores its plan inside
 * a System-A "PipelineProject" doc at
 *   organizations/{PLATFORM_ID}/video_pipeline_projects/{projectId}
 * under the field `shotPlan`. The typed `pipeline-project-service.docToProject`
 * does NOT map `shotPlan` (or our build status fields), so we read/write the RAW
 * doc with the Admin SDK rather than fight the typed service.
 *
 * The build writes FOUR doc fields:
 *   - `shotPlan`           : the live ShotPlan, re-persisted after EACH shot so a
 *                            poller sees each clip's `generated.videoUrl` land
 *   - `videoBuildStatus`   : 'generating' | 'complete' | 'error'
 *   - `videoBuildProgress` : { phase, label, done, total, failed? } — plain English
 *   - `videoBuildError`    : a human-readable message, only set on a fatal error
 *
 * Best-effort per shot: a single failed render is logged + skipped (the failure
 * count is surfaced in progress), never aborting the rest. Idempotent where cheap:
 * a re-trigger SKIPS a shot that is already rendered (`generated.videoUrl` +
 * status 'completed') so a retry resumes instead of re-spending Fal credits.
 *
 * We do NOT auto-stitch — the clips land in the editor; the operator stitches there.
 */

import { FieldValue } from 'firebase-admin/firestore';

import { adminDb } from '@/lib/firebase/admin';
import { getSubCollection } from '@/lib/firebase/collections';
import { PLATFORM_ID } from '@/lib/constants/platform';
import { logger } from '@/lib/logger/logger';
import { generateShot } from '@/lib/video/shot-plan-generation-service';
import type { TenantContext } from '@/lib/video/providers';
import type { ShotPlan } from '@/types/shot-plan';

const FILE = 'video/shot-plan-video-build-service.ts';

/** Doc-level lifecycle status for the video build (distinct from a shot's status). */
export type VideoBuildStatus = 'generating' | 'complete' | 'error';

/** The progress object written to the project doc; the poller reads this verbatim. */
export interface VideoBuildProgress {
  /** Coarse phase: rendering clips, or done. */
  phase: 'rendering' | 'complete';
  /** Plain-English label, e.g. "Rendering shot 3 of 6…". */
  label: string;
  /** Shots rendered (or skipped-because-done) so far. */
  done: number;
  /** Total shots in the plan. */
  total: number;
  /** How many shots failed + were skipped (best-effort). Omitted while 0. */
  failed?: number;
}

export interface RunShotPlanVideoBuildArgs {
  projectId: string;
}

/**
 * The raw project doc ref. Uses the Admin SDK + the centralized collection path
 * helper (no hardcoded PLATFORM_ID) so the multi-tenant flip only has to touch
 * `getSubCollection`.
 */
function projectDocRef(projectId: string) {
  if (!adminDb) {
    throw new Error('runShotPlanVideoBuild: adminDb is null (Firebase Admin not initialized)');
  }
  return adminDb.collection(getSubCollection('video_pipeline_projects')).doc(projectId);
}

/** True when a shot's clip already exists — skip it (resume cheaply, no re-spend). */
function isShotRendered(plan: ShotPlan, shotId: string): boolean {
  const shot = plan.shots.find((s) => s.id === shotId);
  return Boolean(shot?.generated?.videoUrl) && shot?.generated?.status === 'completed';
}

/**
 * Render every shot's VIDEO clip for a project, in plan order, persisting the
 * live plan after EVERY shot so the poller sees clips land one by one. Never
 * throws — a fatal error is recorded on the doc (`videoBuildStatus: 'error'`)
 * and swallowed (logged) so the status is never left stuck on 'generating'.
 */
export async function runShotPlanVideoBuild(args: RunShotPlanVideoBuildArgs): Promise<void> {
  const { projectId } = args;
  const ctx: TenantContext = { tenantId: PLATFORM_ID };
  const ref = projectDocRef(projectId);

  /** Write the live plan + status/progress onto the project doc (merge). */
  const persist = async (
    plan: ShotPlan,
    patch: { videoBuildStatus: VideoBuildStatus; videoBuildProgress: VideoBuildProgress },
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
    logger.info('[shot-plan-video-build] starting build', { file: FILE, projectId });

    // ── Load the plan off the raw doc ────────────────────────────────────────────
    const snap = await ref.get();
    const data = snap.data();
    const rawPlan = data?.shotPlan as ShotPlan | undefined;
    if (!rawPlan || !Array.isArray(rawPlan.shots)) {
      const message = 'No shot plan to render — build the shot plan first.';
      logger.warn('[shot-plan-video-build] no shotPlan on doc', { file: FILE, projectId });
      await ref.set(
        {
          videoBuildStatus: 'error' satisfies VideoBuildStatus,
          videoBuildError: message,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
      return;
    }

    // Order shots by their plan index so clips render front-to-back.
    let plan: ShotPlan = rawPlan;
    const orderedShots = [...plan.shots].sort((a, b) => a.index - b.index);
    const total = orderedShots.length;
    let done = 0;
    let failed = 0;

    // ── Announce the build BEFORE the first render so the first poll sees it ──────
    await persist(plan, {
      videoBuildStatus: 'generating',
      videoBuildProgress: {
        phase: 'rendering',
        label: total > 0 ? 'Rendering shot 1…' : 'No shots to render',
        done: 0,
        total,
      },
    });

    // ── Render every shot's clip, in order ───────────────────────────────────────
    for (const shot of orderedShots) {
      const shotId = shot.id;
      const humanNumber = done + 1;

      // Resume cheaply: skip a shot whose clip already exists.
      if (isShotRendered(plan, shotId)) {
        done += 1;
        logger.info('[shot-plan-video-build] shot skipped (already rendered)', {
          file: FILE,
          projectId,
          shotId,
          done,
          total,
        });
        await persist(plan, {
          videoBuildStatus: 'generating',
          videoBuildProgress: {
            phase: 'rendering',
            label: `Shot ${humanNumber} already rendered`,
            done,
            total,
            ...(failed > 0 ? { failed } : {}),
          },
        });
        continue;
      }

      // Announce the shot as it STARTS (so the poller sees what's rendering now).
      logger.info('[shot-plan-video-build] shot render start', {
        file: FILE,
        projectId,
        shotId,
        done,
        total,
      });
      await persist(plan, {
        videoBuildStatus: 'generating',
        videoBuildProgress: {
          phase: 'rendering',
          label: `Rendering shot ${humanNumber} of ${total}…`,
          done,
          total,
          ...(failed > 0 ? { failed } : {}),
        },
      });

      // Best-effort: a thrown shot is logged + skipped, never aborts the rest.
      try {
        plan = await generateShot(plan, shotId, ctx);
        done += 1;
        logger.info('[shot-plan-video-build] shot rendered + persisted', {
          file: FILE,
          projectId,
          shotId,
          done,
          total,
        });
        await persist(plan, {
          videoBuildStatus: 'generating',
          videoBuildProgress: {
            phase: 'rendering',
            label: `Rendered shot ${humanNumber} of ${total}`,
            done,
            total,
            ...(failed > 0 ? { failed } : {}),
          },
        });
      } catch (err) {
        failed += 1;
        done += 1;
        logger.error(
          '[shot-plan-video-build] shot render failed (skipping)',
          err instanceof Error ? err : new Error(String(err)),
          { file: FILE, projectId, shotId, failed },
        );
        // Record the advance + failure count, keeping the last-good plan.
        await persist(plan, {
          videoBuildStatus: 'generating',
          videoBuildProgress: {
            phase: 'rendering',
            label: `Shot ${humanNumber} failed — continuing`,
            done,
            total,
            failed,
          },
        });
      }
    }

    // ── Complete ─────────────────────────────────────────────────────────────────
    logger.info('[shot-plan-video-build] build complete', {
      file: FILE,
      projectId,
      total,
      failed,
    });
    await persist(plan, {
      videoBuildStatus: 'complete',
      videoBuildProgress: {
        phase: 'complete',
        label: 'Done',
        done: total,
        total,
        ...(failed > 0 ? { failed } : {}),
      },
    });
  } catch (err) {
    // A FATAL error: record it so the status is never left stuck on 'generating'.
    // Swallow (log) — this runs fire-and-forget.
    const message = err instanceof Error ? err.message : String(err);
    logger.error(
      '[shot-plan-video-build] fatal build error',
      err instanceof Error ? err : new Error(message),
      { file: FILE, projectId },
    );
    try {
      await ref.set(
        {
          videoBuildStatus: 'error' satisfies VideoBuildStatus,
          videoBuildError: message,
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
    } catch (writeErr) {
      logger.error(
        '[shot-plan-video-build] failed to record fatal error on doc',
        writeErr instanceof Error ? writeErr : new Error(String(writeErr)),
        { file: FILE, projectId },
      );
    }
  }
}
