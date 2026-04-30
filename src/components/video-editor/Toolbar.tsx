'use client';

/**
 * Video Editor Toolbar — top bar above the preview/timeline.
 * Houses transport controls (play/pause/restart), undo/redo, zoom, and
 * the export button. Uses the design system Button + lucide icons.
 */

import { Button } from '@/components/ui/button';
import {
  Play,
  Pause,
  SkipBack,
  Undo2,
  Redo2,
  ZoomIn,
  ZoomOut,
  Download,
  Loader2,
  Scissors,
} from 'lucide-react';

import {
  MIN_ZOOM,
  MAX_ZOOM,
  type EditorAction,
} from '@/app/(dashboard)/content/video/editor/types';

interface ToolbarProps {
  isPlaying: boolean;
  zoomLevel: number;
  canUndo: boolean;
  canRedo: boolean;
  isExporting: boolean;
  hasClips: boolean;
  selectedClipId: string | null;
  playheadTime: number;
  totalDuration: number;
  onSplit: () => void;
  onExport: () => void;
  dispatch: React.Dispatch<EditorAction>;
}

function formatTimecode(seconds: number): string {
  const safe = Math.max(0, seconds);
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  const f = Math.floor((safe % 1) * 30); // 30fps display
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}.${String(f).padStart(2, '0')}`;
}

export default function Toolbar({
  isPlaying,
  zoomLevel,
  canUndo,
  canRedo,
  isExporting,
  hasClips,
  selectedClipId,
  playheadTime,
  totalDuration,
  onSplit,
  onExport,
  dispatch,
}: ToolbarProps) {
  const zoomIn = () => {
    dispatch({ type: 'SET_ZOOM', level: Math.min(MAX_ZOOM, Math.round(zoomLevel * 1.25)) });
  };
  const zoomOut = () => {
    dispatch({ type: 'SET_ZOOM', level: Math.max(MIN_ZOOM, Math.round(zoomLevel / 1.25)) });
  };

  return (
    <div className="flex items-center justify-between gap-2 px-3 py-2 bg-zinc-900/80 border border-zinc-800 rounded-lg">
      {/* Left: transport */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={() => dispatch({ type: 'SET_PLAYHEAD', time: 0 })}
          title="Restart"
          disabled={!hasClips}
        >
          <SkipBack className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={() => dispatch({ type: 'SET_PLAYING', playing: !isPlaying })}
          title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
          disabled={!hasClips}
        >
          {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
        </Button>
        <span className="ml-2 font-mono text-xs text-zinc-400 tabular-nums">
          {formatTimecode(playheadTime)} <span className="text-zinc-600">/</span>{' '}
          {formatTimecode(totalDuration)}
        </span>
      </div>

      {/* Center: edit operations */}
      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white disabled:text-zinc-600"
          onClick={() => dispatch({ type: 'UNDO' })}
          disabled={!canUndo}
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-4 h-4" />
        </Button>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white disabled:text-zinc-600"
          onClick={() => dispatch({ type: 'REDO' })}
          disabled={!canRedo}
          title="Redo (Ctrl+Shift+Z)"
        >
          <Redo2 className="w-4 h-4" />
        </Button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <Button
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-zinc-300 hover:text-white disabled:text-zinc-600"
          onClick={onSplit}
          disabled={!selectedClipId}
          title="Split clip at playhead (S)"
        >
          <Scissors className="w-4 h-4" />
          Split
        </Button>
        <div className="w-px h-5 bg-zinc-800 mx-1" />
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={zoomOut}
          disabled={zoomLevel <= MIN_ZOOM}
          title="Zoom out timeline"
        >
          <ZoomOut className="w-4 h-4" />
        </Button>
        <span className="text-[10px] text-zinc-500 w-12 text-center tabular-nums">
          {zoomLevel}px/s
        </span>
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8 text-zinc-300 hover:text-white"
          onClick={zoomIn}
          disabled={zoomLevel >= MAX_ZOOM}
          title="Zoom in timeline"
        >
          <ZoomIn className="w-4 h-4" />
        </Button>
      </div>

      {/* Right: export */}
      <div className="flex items-center gap-2">
        <Button
          size="sm"
          className="h-8 gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          onClick={onExport}
          disabled={!hasClips || isExporting}
          title="Render and save to media library"
        >
          {isExporting ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Rendering…
            </>
          ) : (
            <>
              <Download className="w-4 h-4" />
              Export
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
