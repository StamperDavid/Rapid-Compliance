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
 * Seed the editor from a whole multi-document PROJECT: every shot's INDIVIDUAL clip
 * becomes one timeline clip, in play order (docs in project order, shots in shot
 * order). The engine does not stitch — the editor receives the separate clips and
 * the operator arranges / trims / reorders / scores them like a normal video editor.
 * Shots without a clip yet are skipped. Each clip's thumbnail is the shot's last
 * frame (falling back to its keyframe still).
 */
export function seedEditorFromProject(project: VideoProject): void {
  const clips: EditorSeedClip[] = [];
  let sceneNumber = 0;
  for (const doc of project.docs) {
    sceneNumber += 1;
    const ordered = [...doc.shots].sort((a, b) => a.index - b.index);
    for (const shot of ordered) {
      const url = shot.generated?.videoUrl;
      if (!url) {
        continue;
      }
      const shotTitle = shot.title?.trim();
      clips.push({
        url,
        thumbnailUrl: shot.generated?.lastFrameUrl ?? shot.generated?.keyframeUrl ?? null,
        name:
          shotTitle && shotTitle.length > 0
            ? shotTitle
            : `Scene ${sceneNumber} — Shot ${shot.index + 1}`,
        duration: shot.durationSeconds > 0 ? shot.durationSeconds : 5,
      });
    }
  }
  writeEditorSeed({ clips });
}
