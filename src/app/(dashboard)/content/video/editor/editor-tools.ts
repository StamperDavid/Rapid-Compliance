/**
 * Editor tools — the ONE unified editor's toolset.
 *
 * The video editor is a SINGLE CapCut-style workspace: the Preview + Timeline are
 * always on screen (stitch + edit the project), and a tool rail on the right swaps
 * which TOOL PANEL is open beside them. These are tools/functions of one editor —
 * NOT separate modes you switch between.
 *
 * Each tool panel hits its own pro-grade capability bar (internal benchmarks live
 * in project memory, never in the product) under the CapCut-style surface. Every
 * panel receives the same `EditorToolProps` contract and drives the SHARED reducer.
 */

import { SlidersHorizontal, Type, Wand2, FileText, Scissors, type LucideIcon } from 'lucide-react';
import type { EditorModeProps } from './editor-modes';

export type EditorTool = 'edit' | 'text' | 'vfx' | 'transcript' | 'clips';

/** Tool panels share the editor contract: read `state`, drive the shared reducer. */
export type EditorToolProps = EditorModeProps;

export const EDITOR_TOOL_IDS: readonly EditorTool[] = ['edit', 'text', 'vfx', 'transcript', 'clips'];

export interface EditorToolMeta {
  id: EditorTool;
  /** Function-based label shown in the rail — never a competitor name. */
  label: string;
  icon: LucideIcon;
}

export const EDITOR_TOOLS: EditorToolMeta[] = [
  { id: 'edit', label: 'Edit', icon: SlidersHorizontal },
  { id: 'text', label: 'Text & Captions', icon: Type },
  { id: 'vfx', label: 'VFX & B-Roll', icon: Wand2 },
  { id: 'transcript', label: 'Transcript', icon: FileText },
  { id: 'clips', label: 'Make Clips', icon: Scissors },
];
