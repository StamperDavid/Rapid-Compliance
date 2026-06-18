/**
 * Shared editor contract types.
 *
 * Historically this was the "modes" layer. The editor is now ONE unified
 * workspace (see page.tsx + editor-tools.ts); every tool panel implements the
 * `EditorModeProps` contract below (re-exported as `EditorToolProps`) and drives
 * the shared reducer. These types stay here so the tool panels and the shell
 * share one definition.
 */

import type { Dispatch } from 'react';
import type { EditorState, EditorAction } from './types';
import type { MediaItem } from '@/types/media-library';

/** Server render/export lifecycle, surfaced in the header and usable by any tool. */
export interface ExportState {
  phase: 'idle' | 'rendering' | 'done' | 'error';
  error: string | null;
  item: MediaItem | null;
}

/**
 * The contract every tool panel implements. A panel reads `state` and drives the
 * shared reducer via `dispatch`; it must NOT hold its own copy of the project.
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
