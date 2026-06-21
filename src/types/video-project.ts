/**
 * Video Project Data Model — the multi-document envelope.
 *
 * A VideoProject is an ORDERED collection of Shot Docs (each a full `ShotPlan`).
 * It is the layer that turns "one storyboard" into "a film": a brief is segmented
 * into several ordered Shot Docs, each authored + reviewed independently, each
 * generating ITS OWN video (the per-doc P4 stitch → `ShotPlan.finalVideoUrl`), and
 * only once every doc has its video does the whole project hand off to the editor
 * for the cross-document stitch + transitions + music.
 *
 * The flow this models (owner-confirmed, Jun 17 2026):
 *   1. Generate ALL the project's Shot Docs first — STILLS ONLY, no video.
 *   2. Review/edit each doc surgically (per-section edit, never a whole-doc re-roll).
 *   3. "Generate" a doc's video (the act of generating IS the approval) → that doc's
 *      shots render + stitch into the doc's single video, stored on the project.
 *   4. When EVERY doc has its video, the project is "assembled" → open in the editor
 *      to stitch the doc-videos together with transitions / effects / music.
 *
 * ADDITIVE: reuses `ShotPlan` verbatim as the per-doc model (so the existing
 * planner, surgical-edit, still-render and P4 stitch all apply per doc unchanged).
 */

import { z } from 'zod';

import { type ShotPlan, ShotPlanSchema } from '@/types/shot-plan';

/** Lifecycle of the whole project. */
export type VideoProjectStatus =
  /** Docs are being authored (the segmentation/planning pass is running). */
  | 'planning'
  /** All docs authored as STILLS — awaiting per-doc video generation. */
  | 'review'
  /** Some docs have their video, not all. */
  | 'generating'
  /** EVERY doc has its video — ready to open in the editor for the final stitch. */
  | 'assembled'
  /** Exported from the editor — the cross-doc final video exists. */
  | 'complete';

export const VIDEO_PROJECT_STATUSES: readonly VideoProjectStatus[] = [
  'planning',
  'review',
  'generating',
  'assembled',
  'complete',
];

export interface VideoProject {
  id: string;
  title: string;
  /** The original creative brief the project's docs were segmented from. */
  brief: string;
  /**
   * The ordered Shot Docs. Each is a full `ShotPlan`; each doc's own
   * `finalVideoUrl` (set by the P4 stitch) IS that doc's video. Order is the
   * play order in the final film.
   */
  docs: ShotPlan[];
  status: VideoProjectStatus;
  /**
   * The cross-document final video exported from the editor (the doc-videos
   * stitched together with transitions/music). Absent until the editor exports.
   */
  finalVideoUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export const VideoProjectStatusSchema = z.enum([
  'planning',
  'review',
  'generating',
  'assembled',
  'complete',
]);

export const VideoProjectSchema = z.object({
  id: z.string().trim().min(1).max(200),
  title: z.string().trim().max(300).default(''),
  brief: z.string().trim().max(20000).default(''),
  docs: z.array(ShotPlanSchema).max(100).default([]),
  status: VideoProjectStatusSchema.default('planning'),
  finalVideoUrl: z.string().trim().url().optional(),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1),
});

// Compile-time parity guard: fail tsc if the schema and interface drift.
type _ProjectParity = z.infer<typeof VideoProjectSchema> extends VideoProject ? true : false;
export const VIDEO_PROJECT_TYPE_GUARD: { _project: _ProjectParity } = { _project: true };

// ============================================================================
// Derived helpers (pure — safe on client + server)
// ============================================================================

/** True when a doc has its own generated video (the per-doc P4 stitch ran). */
export function docHasVideo(doc: ShotPlan): boolean {
  return typeof doc.finalVideoUrl === 'string' && doc.finalVideoUrl.length > 0;
}

/** Count of docs that already have their video. */
export function countDocsWithVideo(project: VideoProject): number {
  return project.docs.filter(docHasVideo).length;
}

/** True when EVERY doc has its video — the project can move to the editor. */
export function allDocsHaveVideo(project: VideoProject): boolean {
  return project.docs.length > 0 && project.docs.every(docHasVideo);
}

/**
 * The status the project SHOULD be in given its docs' generation state. The
 * service calls this after every mutation so `status` is always derivable truth,
 * never a value that drifts out of sync with the docs. ('complete' is terminal —
 * only the editor export sets it, so it is never downgraded here.)
 */
export function deriveProjectStatus(project: VideoProject): VideoProjectStatus {
  if (project.status === 'complete') {
    return 'complete';
  }
  if (project.docs.length === 0) {
    return 'planning';
  }
  const withVideo = countDocsWithVideo(project);
  if (withVideo === 0) {
    return 'review';
  }
  if (withVideo === project.docs.length) {
    return 'assembled';
  }
  return 'generating';
}
