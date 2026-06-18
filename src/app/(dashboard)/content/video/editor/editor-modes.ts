/**
 * Editor modes — the "pick your purpose" layer.
 *
 * The video editor is ONE shared core (the reducer in editor-reducer.ts: clips,
 * audio, text overlays, trim/split/transitions/effects/undo + the Preview/Timeline
 * + the export-to-Library path) with SEVERAL focused workspaces layered on top.
 * The operator picks a purpose; that mode renders its own tools against the SAME
 * project state, so the capabilities never collide in one crowded screen.
 *
 * Modes are named by WHAT THEY DO — never by competitor software. We never
 * surface another product's name to operators or clients. (Our internal parity
 * benchmarks per mode live in project memory, not in the product.)
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
  /** Function-based name shown in the UI — never a competitor product name. */
  label: string;
  /** Short "what it does" line (competitor-free). */
  description: string;
  icon: LucideIcon;
}

export const EDITOR_MODES: EditorModeMeta[] = [
  {
    id: 'pro',
    label: 'Edit & Stitch',
    description: 'Multi-track timeline — trim, split, transitions, effects, and high-res export.',
    icon: Clapperboard,
  },
  {
    id: 'quick',
    label: 'Quick Edits',
    description: 'Fast edits, one-tap captions, look filters, transitions, and quick export.',
    icon: Zap,
  },
  {
    id: 'script',
    label: 'Script & Podcast',
    description: 'Edit by transcript — delete words to cut video, strip filler words and silences.',
    icon: FileText,
  },
  {
    id: 'social',
    label: 'Clipping & Shorts',
    description: 'Turn a long video into captioned, vertical short clips.',
    icon: Share2,
  },
  {
    id: 'vfx',
    label: 'VFX & B-Roll',
    description: 'Generate B-roll and effects from your scenes and drop them on the timeline.',
    icon: Wand2,
  },
];
