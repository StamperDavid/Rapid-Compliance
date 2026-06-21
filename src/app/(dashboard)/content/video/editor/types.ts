/**
 * Video Editor Types
 * Shared types for the standalone video editor
 */

import type { TransitionType } from '@/types/video-pipeline';

// ============================================================================
// Timeline Types
// ============================================================================

/**
 * Effects applied to a single clip. Every field maps to BOTH a live CSS preview
 * filter AND an FFmpeg render filter, so what the operator sees is what renders.
 * Defaults map to "no change" so an effect-less clip renders unchanged.
 *
 * Colour grade (original four):
 *  - brightness: -1.0 .. 1.0 (CSS brightness offset; 0 = none)
 *  - contrast:    0.0 .. 2.0 (CSS contrast multiplier; 1 = none)
 *  - saturation:  0.0 .. 2.0 (CSS saturate multiplier; 1 = none)
 *  - hue:        -180 .. 180 (degrees; 0 = none)
 *
 * Stylising filters (all optional — absent = off):
 *  - sepia:      0.0 .. 1.0 (mix amount; 0 = none, 1 = full sepia)
 *  - grayscale:  0.0 .. 1.0 (mix amount; 0 = colour, 1 = full B&W)
 *  - blur:       0.0 .. 20.0 (pixels of gaussian blur; 0 = sharp)
 *  - sharpen:    0.0 .. 2.0 (unsharp strength; 0 = none)
 *  - vignette:   0.0 .. 1.0 (darkened-corner strength; 0 = none)
 *  - grain:      0.0 .. 1.0 (film-grain noise strength; 0 = none)
 *
 * Playback:
 *  - speed:      0.5 .. 2.0 (playback rate multiplier; 1 = normal). A clip at
 *                2× plays in half its source time; preview + render both honour it.
 */
export interface ClipEffect {
  brightness: number;
  contrast: number;
  saturation: number;
  hue: number;
  sepia?: number;
  grayscale?: number;
  blur?: number;
  sharpen?: number;
  vignette?: number;
  grain?: number;
  speed?: number;
}

export const NEUTRAL_EFFECT: ClipEffect = {
  brightness: 0,
  contrast: 1,
  saturation: 1,
  hue: 0,
  sepia: 0,
  grayscale: 0,
  blur: 0,
  sharpen: 0,
  vignette: 0,
  grain: 0,
  speed: 1,
};

export interface EditorClip {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string | null;
  duration: number; // seconds (0 = unknown until loaded)
  trimStart: number; // seconds from start to trim
  trimEnd: number; // seconds from end to trim
  transitionType: TransitionType;
  source: 'library' | 'project' | 'upload' | 'url';
  effect?: ClipEffect;
}

export interface EditorAudioTrack {
  id: string;
  name: string;
  url: string;
  volume: number; // 0-1
  category: 'music' | 'sound' | 'voice';
}

export interface TextOverlay {
  id: string;
  text: string;
  startTime: number; // seconds
  endTime: number; // seconds
  position: 'top' | 'center' | 'bottom';
  fontSize: number;
  fontColor: string;
  backgroundColor: string;
  /** Optional canvas position as a normalized fraction (0..1) of the preview frame.
   *  When set, the overlay is rendered at this absolute spot instead of the
   *  position alias. Both client preview and ffmpeg render honour it. */
  canvasX?: number;
  canvasY?: number;
  /** Optional font family override. Defaults to a sans-serif stack. */
  fontFamily?: string;
}

// ============================================================================
// Editor State
// ============================================================================

export interface EditorSnapshot {
  clips: EditorClip[];
  audioTracks: EditorAudioTrack[];
  textOverlays: TextOverlay[];
}

export interface EditorState {
  // Timeline
  clips: EditorClip[];
  audioTracks: EditorAudioTrack[];
  textOverlays: TextOverlay[];
  selectedClipId: string | null;
  selectedOverlayId: string | null;
  defaultTransition: TransitionType;

  // Playback
  playheadTime: number; // seconds
  totalDuration: number; // computed from clips
  isPlaying: boolean;
  zoomLevel: number; // pixels per second

  // Assembly
  assembledUrl: string | null;
  isAssembling: boolean;
  isMixingAudio: boolean;
  assemblyError: string | null;
  isSaving: boolean;
  saved: boolean;

  // Undo/Redo
  undoStack: EditorSnapshot[];
  redoStack: EditorSnapshot[];
}

// ============================================================================
// Action Types
// ============================================================================

export type EditorAction =
  | { type: 'ADD_CLIP'; clip: Omit<EditorClip, 'id' | 'transitionType' | 'trimStart' | 'trimEnd'> }
  | { type: 'REMOVE_CLIP'; clipId: string }
  | { type: 'REORDER_CLIPS'; clipIds: string[] }
  | { type: 'UPDATE_CLIP'; clipId: string; updates: Partial<EditorClip> }
  | { type: 'DUPLICATE_CLIP'; clipId: string }
  | { type: 'SPLIT_CLIP'; clipId: string; splitTime: number }
  | { type: 'SET_CLIP_TRANSITION'; clipId: string; transition: TransitionType }
  | { type: 'SELECT_CLIP'; clipId: string | null }
  | { type: 'ADD_AUDIO_TRACK'; track: Omit<EditorAudioTrack, 'id'> }
  | { type: 'REMOVE_AUDIO_TRACK'; trackId: string }
  | { type: 'UPDATE_AUDIO_TRACK'; trackId: string; updates: Partial<EditorAudioTrack> }
  | { type: 'ADD_TEXT_OVERLAY'; overlay: Omit<TextOverlay, 'id'> }
  | { type: 'REMOVE_TEXT_OVERLAY'; overlayId: string }
  | { type: 'UPDATE_TEXT_OVERLAY'; overlayId: string; updates: Partial<TextOverlay> }
  | { type: 'SELECT_OVERLAY'; overlayId: string | null }
  | { type: 'SET_PLAYHEAD'; time: number }
  | { type: 'SET_PLAYING'; playing: boolean }
  | { type: 'SET_ZOOM'; level: number }
  | { type: 'SET_DEFAULT_TRANSITION'; transition: TransitionType }
  | { type: 'SET_ASSEMBLED_URL'; url: string | null }
  | { type: 'SET_ASSEMBLING'; assembling: boolean }
  | { type: 'SET_MIXING_AUDIO'; mixing: boolean }
  | { type: 'SET_ASSEMBLY_ERROR'; error: string | null }
  | { type: 'SET_SAVING'; saving: boolean }
  | { type: 'SET_SAVED'; saved: boolean }
  | { type: 'UNDO' }
  | { type: 'REDO' }
  | { type: 'CLEAR_ALL' };

// ============================================================================
// Constants
// ============================================================================

export const TRANSITIONS: { value: TransitionType; label: string; icon: string }[] = [
  { value: 'cut', label: 'Cut', icon: '|' },
  { value: 'fade', label: 'Fade', icon: '◐' },
  { value: 'dissolve', label: 'Dissolve', icon: '◑' },
];

export const MIN_ZOOM = 10; // px per second
export const MAX_ZOOM = 200; // px per second
export const DEFAULT_ZOOM = 40; // px per second

export const DEFAULT_CLIP_DURATION = 5; // seconds for clips with unknown duration
export const MAX_UNDO_STACK = 50;
