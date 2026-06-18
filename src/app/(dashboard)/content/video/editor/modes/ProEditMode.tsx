'use client';

/**
 * Edit & Stitch mode — the full multi-track editing workspace.
 *
 * The full multi-track workspace: transport/undo/redo/split/zoom/export toolbar,
 * a live preview with draggable text, the V/T/A timeline, and a context-sensitive
 * effects panel. This is the original editor layout, now plugged into the shared
 * EditorModeProps contract so it coexists with the other modes on one project.
 */

import Toolbar from '@/components/video-editor/Toolbar';
import Preview from '@/components/video-editor/Preview';
import Timeline from '@/components/video-editor/Timeline';
import EffectsPanel from '@/components/video-editor/EffectsPanel';
import type { EditorModeProps } from '../editor-modes';

export default function ProEditMode({ state, dispatch, exportState, onExport, onSplit }: EditorModeProps) {
  const {
    clips,
    audioTracks,
    textOverlays,
    selectedClipId,
    selectedOverlayId,
    playheadTime,
    totalDuration,
    zoomLevel,
    isPlaying,
    undoStack,
    redoStack,
  } = state;

  const exportingNow = exportState.phase === 'rendering';

  return (
    <div className="space-y-4">
      <Toolbar
        isPlaying={isPlaying}
        zoomLevel={zoomLevel}
        canUndo={undoStack.length > 0}
        canRedo={redoStack.length > 0}
        isExporting={exportingNow}
        hasClips={clips.length > 0}
        selectedClipId={selectedClipId}
        playheadTime={playheadTime}
        totalDuration={totalDuration}
        onSplit={onSplit}
        onExport={onExport}
        dispatch={dispatch}
      />

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
        {/* Preview — center/left, takes most of the width */}
        <div className="lg:col-span-9 space-y-4">
          <Preview
            clips={clips}
            textOverlays={textOverlays}
            selectedOverlayId={selectedOverlayId}
            playheadTime={playheadTime}
            isPlaying={isPlaying}
            totalDuration={totalDuration}
            dispatch={dispatch}
          />
          <Timeline
            clips={clips}
            audioTracks={audioTracks}
            textOverlays={textOverlays}
            selectedClipId={selectedClipId}
            selectedOverlayId={selectedOverlayId}
            playheadTime={playheadTime}
            totalDuration={totalDuration}
            zoomLevel={zoomLevel}
            dispatch={dispatch}
          />
        </div>

        {/* EffectsPanel — right column */}
        <div className="lg:col-span-3">
          <EffectsPanel
            clips={clips}
            textOverlays={textOverlays}
            selectedClipId={selectedClipId}
            selectedOverlayId={selectedOverlayId}
            playheadTime={playheadTime}
            totalDuration={totalDuration}
            dispatch={dispatch}
          />
        </div>
      </div>
    </div>
  );
}
