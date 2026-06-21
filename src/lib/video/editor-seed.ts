/**
 * Editor seed handoff (ADDITIVE, client-side).
 *
 * The Shot Plan is the sole video-creation flow. Once its shots are generated,
 * the operator opens the generated clips in the existing Video Editor for final
 * stitching/edit. Rather than coupling the Shot Plan to the legacy project
 * save route, the generated clips are handed to the editor through a small,
 * typed sessionStorage payload: the Shot Plan writes it, navigates to the
 * editor, and the editor reads + clears it on mount and seeds its timeline.
 *
 * No I/O, no generation — data + a tiny read/write helper only.
 */

import type { VideoProject } from '@/types/video-project';

/** sessionStorage key the Shot Plan writes and the editor reads (then clears). */
export const EDITOR_SEED_STORAGE_KEY = 'video-editor-seed';

/** One generated clip handed to the editor, in plan order. */
export interface EditorSeedClip {
  /** Permanent (our-storage) clip URL. */
  url: string;
  /** Saved keyframe (last frame) used as the clip thumbnail, when present. */
  thumbnailUrl: string | null;
  /** Display name, e.g. "Shot 1 — The hook". */
  name: string;
  /** Clip duration in seconds. */
  duration: number;
}

/** The full editor-seed payload written to sessionStorage. */
export interface EditorSeed {
  clips: EditorSeedClip[];
}

/**
 * Write the editor seed to sessionStorage. Safe no-op when storage is
 * unavailable (SSR / privacy mode) — the caller still navigates and the editor
 * simply starts empty.
 */
export function writeEditorSeed(seed: EditorSeed): void {
  try {
    sessionStorage.setItem(EDITOR_SEED_STORAGE_KEY, JSON.stringify(seed));
  } catch {
    /* best-effort — an empty editor is an acceptable fallback */
  }
}

/**
 * Read AND clear the editor seed from sessionStorage. Returns null when there is
 * no seed or it cannot be parsed. Clearing makes the handoff one-shot so a later
 * manual visit to the editor does not re-seed stale clips.
 */
export function takeEditorSeed(): EditorSeed | null {
  try {
    const raw = sessionStorage.getItem(EDITOR_SEED_STORAGE_KEY);
    if (!raw) {
      return null;
    }
    sessionStorage.removeItem(EDITOR_SEED_STORAGE_KEY);
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === 'object' &&
      'clips' in parsed &&
      Array.isArray((parsed as { clips: unknown }).clips)
    ) {
      const clips = (parsed as { clips: unknown[] }).clips.filter(
        (c): c is EditorSeedClip =>
          Boolean(c) &&
          typeof c === 'object' &&
          typeof (c as EditorSeedClip).url === 'string' &&
          typeof (c as EditorSeedClip).name === 'string' &&
          typeof (c as EditorSeedClip).duration === 'number',
      );
      return { clips };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Seed the editor from a whole multi-document PROJECT: each doc that already has its
 * own generated video becomes ONE clip, in project order, so the editor opens with
 * the full film laid out and ready to stitch / add transitions / score. Docs without
 * a video yet are skipped. The clip thumbnail is the doc's first available keyframe /
 * last frame; the clip duration is the sum of the doc's shot durations.
 */
export function seedEditorFromProject(project: VideoProject): void {
  const clips: EditorSeedClip[] = [];
  for (const doc of project.docs) {
    const url = doc.finalVideoUrl;
    if (!url) {
      continue;
    }
    const ordered = [...doc.shots].sort((a, b) => a.index - b.index);
    let duration = 0;
    let thumbnailUrl: string | null = null;
    for (const shot of ordered) {
      duration += shot.durationSeconds;
      thumbnailUrl ??= shot.generated?.keyframeUrl ?? shot.generated?.lastFrameUrl ?? null;
    }
    clips.push({
      url,
      thumbnailUrl,
      name: doc.title.trim() ? doc.title : 'Scene',
      duration: duration > 0 ? duration : 5,
    });
  }
  writeEditorSeed({ clips });
}
