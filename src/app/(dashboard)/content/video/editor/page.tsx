'use client';

/**
 * Video Editor — CapCut-feel layout for the YC demo.
 *
 *  ┌──────────────────────────────────────────────────────────────────────┐
 *  │  Toolbar  (transport, undo/redo, split, zoom, export)                │
 *  ├────────────────────────────────────────────────┬─────────────────────┤
 *  │                                                 │                     │
 *  │  Preview  (live with effects + draggable text) │  EffectsPanel       │
 *  │                                                 │  (clip / overlay /  │
 *  │                                                 │   upload context)   │
 *  │                                                 │                     │
 *  ├────────────────────────────────────────────────┴─────────────────────┤
 *  │  Timeline  (V / T / A tracks, ruler, playhead, drag-reorder, trim)   │
 *  └──────────────────────────────────────────────────────────────────────┘
 *
 * Design system: PageTitle / Card / Button. Tailwind classes only — no
 * inline `style` blocks for static values. Two-step delete confirmations
 * live inside EffectsPanel via `<ConfirmDialog>`.
 */

import { useReducer, useCallback, useEffect, useState } from 'react';
import { Scissors, Sparkles, CheckCircle, AlertCircle } from 'lucide-react';

import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';

import Toolbar from '@/components/video-editor/Toolbar';
import Preview from '@/components/video-editor/Preview';
import Timeline from '@/components/video-editor/Timeline';
import EffectsPanel from '@/components/video-editor/EffectsPanel';

import { editorReducer, initialEditorState } from './editor-reducer';
import {
  DEFAULT_CLIP_DURATION,
  type EditorClip,
} from './types';
import type { MediaItem } from '@/types/media-library';

interface RenderResponse {
  success: boolean;
  item?: MediaItem;
  error?: string;
}

function effectiveDuration(clip: EditorClip): number {
  const raw = clip.duration || DEFAULT_CLIP_DURATION;
  return Math.max(0.1, raw - clip.trimStart - clip.trimEnd);
}

export default function VideoEditorPage() {
  const authFetch = useAuthFetch();
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);

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

  // ── Export state (separate from the legacy isAssembling — different endpoint) ─
  const [exportState, setExportState] = useState<ExportState>({
    phase: 'idle',
    error: null,
    item: null,
  });

  // ── Split at playhead — reused by toolbar + keyboard ────────────────────
  const splitAtPlayhead = useCallback(() => {
    if (!selectedClipId) { return; }
    let elapsed = 0;
    for (const clip of clips) {
      const dur = effectiveDuration(clip);
      if (clip.id === selectedClipId) {
        const splitTime = playheadTime - elapsed;
        if (splitTime > 0 && splitTime < dur) {
          dispatch({ type: 'SPLIT_CLIP', clipId: selectedClipId, splitTime });
        }
        return;
      }
      elapsed += dur;
    }
  }, [selectedClipId, clips, playheadTime]);

  // ── Export to /api/video/editor/render ──────────────────────────────────
  const handleExport = useCallback(async () => {
    if (clips.length === 0) { return; }
    setExportState({ phase: 'rendering', error: null, item: null });
    try {
      const body = {
        name: `Edited Video — ${new Date().toLocaleDateString()}`,
        clips: clips.map((c) => ({
          id: c.id,
          url: c.url,
          trimStart: c.trimStart,
          trimEnd: c.trimEnd,
          transitionType: c.transitionType,
          effect: c.effect,
        })),
        textOverlays: textOverlays.map((o) => ({
          text: o.text,
          startTime: o.startTime,
          endTime: o.endTime,
          position: o.position,
          fontSize: o.fontSize,
          fontColor: o.fontColor,
          backgroundColor: o.backgroundColor,
          canvasX: o.canvasX,
          canvasY: o.canvasY,
          fontFamily: o.fontFamily,
        })),
        transition: clips[0]?.transitionType ?? 'fade',
        resolution: '1080p' as const,
      };
      const res = await authFetch('/api/video/editor/render', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as RenderResponse;
      if (!res.ok || !data.success || !data.item) {
        throw new Error(data.error ?? 'Render failed');
      }
      setExportState({ phase: 'done', error: null, item: data.item });
    } catch (e) {
      setExportState({
        phase: 'error',
        error: e instanceof Error ? e.message : 'Render failed',
        item: null,
      });
    }
  }, [clips, textOverlays, authFetch, setExportState]);

  // ── Keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.tagName === 'SELECT' ||
        target.isContentEditable
      ) {
        return;
      }

      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'SET_PLAYING', playing: !isPlaying });
        return;
      }
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        splitAtPlayhead();
        return;
      }
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_CLIP', clipId: null });
        dispatch({ type: 'SELECT_OVERLAY', overlayId: null });
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isPlaying, splitAtPlayhead]);

  const exportingNow = exportState.phase === 'rendering';

  // ── Render ──────────────────────────────────────────────────────────────
  return (
    <div className="p-6 space-y-4">
      <SubpageNav items={CONTENT_GENERATOR_TABS} />

      <header className="flex items-center justify-between">
        <div>
          <PageTitle className="text-2xl flex items-center gap-2">
            <Scissors className="w-6 h-6 text-amber-500" />
            Video Editor
          </PageTitle>
          <SectionDescription className="mt-1 text-zinc-400">
            Trim, stitch, light, and caption — drop clips, drag the playhead, click Export.
          </SectionDescription>
        </div>
        <ExportStatusPill state={exportState} />
      </header>

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
        onSplit={splitAtPlayhead}
        onExport={() => { void handleExport(); }}
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

      {/* Footer keyboard hint */}
      <div className="text-[10px] text-zinc-600 flex flex-wrap gap-3 px-1">
        <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">S</kbd> Split at playhead</span>
        <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Ctrl+Z</kbd> Undo</span>
        <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Ctrl+Shift+Z</kbd> Redo</span>
        <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Esc</kbd> Deselect</span>
      </div>
    </div>
  );
}

// ============================================================================
// Local types & sub-components
// ============================================================================

interface ExportState {
  phase: 'idle' | 'rendering' | 'done' | 'error';
  error: string | null;
  item: MediaItem | null;
}

function ExportStatusPill({ state }: { state: ExportState }) {
  if (state.phase === 'idle') { return null; }

  if (state.phase === 'rendering') {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 border border-amber-500/30 rounded-md text-xs text-amber-300">
        <Sparkles className="w-3.5 h-3.5 animate-pulse" />
        Rendering on the server…
      </div>
    );
  }
  if (state.phase === 'done' && state.item) {
    return (
      <a
        href={state.item.url}
        target="_blank"
        rel="noreferrer"
        className="flex items-center gap-2 px-3 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-md text-xs text-emerald-300 hover:bg-emerald-500/20"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        Saved to Library — open
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 border border-red-500/30 rounded-md text-xs text-red-300">
      <AlertCircle className="w-3.5 h-3.5" />
      {state.error ?? 'Render failed'}
    </div>
  );
}
