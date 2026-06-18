/**
 * Editor modes — the "pick your purpose" layer.
 *
 * The video editor is ONE shared core (the reducer in editor-reducer.ts: clips,
 * audio, text overlays, trim/split/transitions/effects/undo + the Preview/Timeline
 * + the export-to-Library path) with SEVERAL focused workspaces layered on top.
 * The operator picks a purpose; that mode renders its own tools against the SAME
 * project state, so the capabilities never collide in one crowded screen.
 *
 * Each capability is certified to its own competitor (parity = floor):
 *   pro    → Adobe Premiere Pro      (multi-track pro editing)
 *   quick  → CapCut                  (fast templated edits)
 *   script → Descript                (edit-by-transcript, filler/silence removal)
 *   social → Reap / OpusClip         (long → captioned vertical shorts)
 *   vfx    → our fal/Seedance engines (generative VFX + B-roll)
 *
 * EVERY mode component receives the SAME `EditorModeProps` contract and must
 * drive the shared reducer — never fork its own project state.
 */

import type { Dispatch } from 'react';
import { Clapperboard, Zap, FileText, Share2, Wand2, type LucideIcon } from 'lucide-react';
import type { EditorState, EditorAction } from './types';
import type { MediaItem } from '@/types/media-library';

export type EditorMode = 'pro' | 'quick' | 'script' | 'social' | 'vfx';

export const EDITOR_MODE_IDS: readonly EditorMode[] = ['pro', 'quick', 'script', 'social', 'vfx'];

export function isEditorMode(value: string | null | undefined): value is EditorMode {
  return value != null && (EDITOR_MODE_IDS as readonly string[]).includes(value);
}

/** Server render/export lifecycle, surfaced in the header and usable by any mode. */
export interface ExportState {
  phase: 'idle' | 'rendering' | 'done' | 'error';
  error: string | null;
  item: MediaItem | null;
}

/**
 * The contract every mode workspace implements. A mode reads `state` and drives
 * the shared reducer via `dispatch`; it must NOT hold its own copy of the project.
 */
export interface EditorModeProps {
  state: EditorState;
  dispatch: Dispatch<EditorAction>;
  authFetch: (input: string, init?: RequestInit) => Promise<Response>;
  exportState: ExportState;
  /** Render + save the current timeline to the Library. */
  onExport: () => void;
  /** Split the selected clip at the playhead. */
  onSplit: () => void;
}

export interface EditorModeMeta {
  id: EditorMode;
  label: string;
  competitor: string;
  description: string;
  icon: LucideIcon;
}

export const EDITOR_MODES: EditorModeMeta[] = [
  {
    id: 'pro',
    label: 'Professional Editing',
    competitor: 'Adobe Premiere Pro',
    description: 'Multi-track timeline, trim, split, transitions, effects, and high-res export.',
    icon: Clapperboard,
  },
  {
    id: 'quick',
    label: 'Quick Edits',
    competitor: 'CapCut',
    description: 'Fast templated edits, one-tap captions, effects, and quick export.',
    icon: Zap,
  },
  {
    id: 'script',
    label: 'Script & Podcast',
    competitor: 'Descript',
    description: 'Edit by transcript — delete words to cut video, strip filler words and silences.',
    icon: FileText,
  },
  {
    id: 'social',
    label: 'Social Repurposing',
    competitor: 'Reap / OpusClip',
    description: 'Turn a long video into captioned, vertical short clips automatically.',
    icon: Share2,
  },
  {
    id: 'vfx',
    label: 'Generative VFX & B-Roll',
    competitor: 'Our AI engines',
    description: 'Generate B-roll and generative effects from your scenes and drop them on the timeline.',
    icon: Wand2,
  },
];
