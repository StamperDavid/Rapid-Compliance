/**
 * Video Editor State Reducer
 * Manages timeline state with undo/redo support
 */

import {
  DEFAULT_ZOOM,
  DEFAULT_CLIP_DURATION,
  MAX_UNDO_STACK,
  type EditorState,
  type EditorAction,
  type EditorSnapshot,
  type EditorClip,
} from './types';

// ============================================================================
// Helpers
// ============================================================================

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function snapshot(state: EditorState): EditorSnapshot {
  return {
    clips: state.clips.map((c) => ({ ...c })),
    audioTracks: state.audioTracks.map((t) => ({ ...t })),
    textOverlays: state.textOverlays.map((o) => ({ ...o })),
  };
}

function computeTotalDuration(clips: EditorClip[]): number {
  return clips.reduce((sum, clip) => {
    const effective = (clip.duration || DEFAULT_CLIP_DURATION) - clip.trimStart - clip.trimEnd;
    return sum + Math.max(0, effective);
  }, 0);
}

/** Push an undo snapshot, clearing redo stack (new action invalidates redo history) */
function pushUndo(state: EditorState): EditorState {
  const undoStack = [...state.undoStack, snapshot(state)].slice(-MAX_UNDO_STACK);
  return { ...state, undoStack, redoStack: [] };
}

// ============================================================================
// Initial State
// ============================================================================

export const initialEditorState: EditorState = {
  clips: [],
  audioTracks: [],
  textOverlays: [],
  selectedClipId: null,
  selectedOverlayId: null,
  defaultTransition: 'fade',

  playheadTime: 0,
  totalDuration: 0,
  isPlaying: false,
  zoomLevel: DEFAULT_ZOOM,

  assembledUrl: null,
  isAssembling: false,
  isMixingAudio: false,
  assemblyError: null,
  isSaving: false,
  saved: false,

  undoStack: [],
  redoStack: [],
};

// ============================================================================
// Reducer
// ============================================================================

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    // ── Clips ───────────────────────────────────────────────────────────
    case 'ADD_CLIP': {
      const withUndo = pushUndo(state);
      const newClip: EditorClip = {
        ...action.clip,
        id: `clip-${generateId()}`,
        transitionType: state.defaultTransition,
        trimStart: 0,
        trimEnd: 0,
      };
      const clips = [...withUndo.clips, newClip];
      return {
        ...withUndo,
        clips,
        totalDuration: computeTotalDuration(clips),
        assembledUrl: null,
        saved: false,
      };
    }

    case 'REMOVE_CLIP': {
      const withUndo = pushUndo(state);
      const clips = withUndo.clips.filter((c) => c.id !== action.clipId);
      return {
        ...withUndo,
        clips,
        selectedClipId: withUndo.selectedClipId === action.clipId ? null : withUndo.selectedClipId,
        totalDuration: computeTotalDuration(clips),
        assembledUrl: null,
        saved: false,
      };
    }

    case 'REORDER_CLIPS': {
      const withUndo = pushUndo(state);
      const clipMap = new Map(withUndo.clips.map((c) => [c.id, c]));
      const reordered = action.clipIds
        .map((id) => clipMap.get(id))
        .filter((c): c is EditorClip => c !== undefined);
      return {
        ...withUndo,
        clips: reordered,
        assembledUrl: null,
        saved: false,
      };
    }

    case 'UPDATE_CLIP': {
      const withUndo = pushUndo(state);
      const clips = withUndo.clips.map((c) =>
        c.id === action.clipId ? { ...c, ...action.updates } : c,
      );
      return {
        ...withUndo,
        clips,
        totalDuration: computeTotalDuration(clips),
        assembledUrl: null,
        saved: false,
      };
    }

    case 'DUPLICATE_CLIP': {
      const withUndo = pushUndo(state);
      const sourceIndex = withUndo.clips.findIndex((c) => c.id === action.clipId);
      if (sourceIndex === -1) { return state; }
      const source = withUndo.clips[sourceIndex];
      const dupe: EditorClip = {
        ...source,
        id: `clip-${generateId()}`,
        name: `${source.name} (copy)`,
      };
      const clips = [
        ...withUndo.clips.slice(0, sourceIndex + 1),
        dupe,
        ...withUndo.clips.slice(sourceIndex + 1),
      ];
      return {
        ...withUndo,
        clips,
        selectedClipId: dupe.id,
        totalDuration: computeTotalDuration(clips),
        assembledUrl: null,
        saved: false,
      };
    }

    case 'SPLIT_CLIP': {
      const withUndo = pushUndo(state);
      const idx = withUndo.clips.findIndex((c) => c.id === action.clipId);
      if (idx === -1) { return state; }
      const clip = withUndo.clips[idx];
      const effectiveDuration = (clip.duration || DEFAULT_CLIP_DURATION) - clip.trimStart - clip.trimEnd;
      if (action.splitTime <= 0 || action.splitTime >= effectiveDuration) { return state; }

      const clipA: EditorClip = {
        ...clip,
        id: `clip-${generateId()}`,
        name: `${clip.name} (A)`,
        trimEnd: clip.trimEnd + (effectiveDuration - action.splitTime),
      };
      const clipB: EditorClip = {
        ...clip,
        id: `clip-${generateId()}`,
        name: `${clip.name} (B)`,
        trimStart: clip.trimStart + action.splitTime,
      };
      const clips = [
        ...withUndo.clips.slice(0, idx),
        clipA,
        clipB,
        ...withUndo.clips.slice(idx + 1),
      ];
      return {
        ...withUndo,
        clips,
        selectedClipId: clipA.id,
        totalDuration: computeTotalDuration(clips),
        assembledUrl: null,
        saved: false,
      };
    }

    case 'SET_CLIP_TRANSITION': {
      const clips = state.clips.map((c) =>
        c.id === action.clipId ? { ...c, transitionType: action.transition } : c,
      );
      return { ...state, clips, assembledUrl: null, saved: false };
    }

    case 'SELECT_CLIP':
      return { ...state, selectedClipId: action.clipId, selectedOverlayId: null };

    // ── Audio ───────────────────────────────────────────────────────────
    case 'ADD_AUDIO_TRACK': {
      const withUndo = pushUndo(state);
      const track = { ...action.track, id: `audio-${generateId()}` };
      return {
        ...withUndo,
        audioTracks: [...withUndo.audioTracks, track],
        assembledUrl: null,
        saved: false,
      };
    }

    case 'REMOVE_AUDIO_TRACK': {
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        audioTracks: withUndo.audioTracks.filter((t) => t.id !== action.trackId),
        assembledUrl: null,
        saved: false,
      };
    }

    case 'UPDATE_AUDIO_TRACK': {
      const audioTracks = state.audioTracks.map((t) =>
        t.id === action.trackId ? { ...t, ...action.updates } : t,
      );
      return { ...state, audioTracks };
    }

    // ── Text Overlays ──────────────────────────────────────────────────
    case 'ADD_TEXT_OVERLAY': {
      const withUndo = pushUndo(state);
      const overlay = { ...action.overlay, id: `text-${generateId()}` };
      return {
        ...withUndo,
        textOverlays: [...withUndo.textOverlays, overlay],
        selectedOverlayId: overlay.id,
        selectedClipId: null,
        assembledUrl: null,
        saved: false,
      };
    }

    case 'REMOVE_TEXT_OVERLAY': {
      const withUndo = pushUndo(state);
      return {
        ...withUndo,
        textOverlays: withUndo.textOverlays.filter((o) => o.id !== action.overlayId),
        selectedOverlayId: withUndo.selectedOverlayId === action.overlayId ? null : withUndo.selectedOverlayId,
        assembledUrl: null,
        saved: false,
      };
    }

    case 'UPDATE_TEXT_OVERLAY': {
      const textOverlays = state.textOverlays.map((o) =>
        o.id === action.overlayId ? { ...o, ...action.updates } : o,
      );
      return { ...state, textOverlays, assembledUrl: null, saved: false };
    }

    case 'SELECT_OVERLAY':
      return { ...state, selectedOverlayId: action.overlayId, selectedClipId: null };

    // ── Playback ────────────────────────────────────────────────────────
    case 'SET_PLAYHEAD':
      return { ...state, playheadTime: action.time };

    case 'SET_PLAYING':
      return { ...state, isPlaying: action.playing };

    case 'SET_ZOOM':
      return { ...state, zoomLevel: action.level };

    case 'SET_DEFAULT_TRANSITION':
      return { ...state, defaultTransition: action.transition };

    // ── Assembly ────────────────────────────────────────────────────────
    case 'SET_ASSEMBLED_URL':
      return { ...state, assembledUrl: action.url };

    case 'SET_ASSEMBLING':
      return { ...state, isAssembling: action.assembling };

    case 'SET_MIXING_AUDIO':
      return { ...state, isMixingAudio: action.mixing };

    case 'SET_ASSEMBLY_ERROR':
      return { ...state, assemblyError: action.error };

    case 'SET_SAVING':
      return { ...state, isSaving: action.saving };

    case 'SET_SAVED':
      return { ...state, saved: action.saved };

    // ── Undo / Redo ─────────────────────────────────────────────────────
    case 'UNDO': {
      if (state.undoStack.length === 0) { return state; }
      const prev = state.undoStack[state.undoStack.length - 1];
      const redoStack = [...state.redoStack, snapshot(state)];
      return {
        ...state,
        ...prev,
        undoStack: state.undoStack.slice(0, -1),
        redoStack,
        totalDuration: computeTotalDuration(prev.clips),
        assembledUrl: null,
        saved: false,
      };
    }

    case 'REDO': {
      if (state.redoStack.length === 0) { return state; }
      const next = state.redoStack[state.redoStack.length - 1];
      const undoStack = [...state.undoStack, snapshot(state)];
      return {
        ...state,
        ...next,
        undoStack,
        redoStack: state.redoStack.slice(0, -1),
        totalDuration: computeTotalDuration(next.clips),
        assembledUrl: null,
        saved: false,
      };
    }

    case 'CLEAR_ALL':
      return { ...initialEditorState };

    default:
      return state;
  }
}
