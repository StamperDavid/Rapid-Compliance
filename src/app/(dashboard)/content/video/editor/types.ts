/**
 * Video Editor Types
 * Shared types for the standalone video editor
 */

import type { TransitionType } from '@/types/video-pipeline';

// ============================================================================
// Timeline Types
// ============================================================================

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
