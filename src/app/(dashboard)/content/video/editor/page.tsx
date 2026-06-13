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

import { useReducer, useCallback, useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Scissors, Sparkles, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

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
import type { PipelineProject } from '@/types/video-pipeline';
import { takeEditorSeed } from '@/lib/video/editor-seed';

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
  const searchParams = useSearchParams();
  const projectIdParam = searchParams.get('project');
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

  // ── Project auto-load: when the editor is opened as the destination of a
  //    finished generation (`?project=<id>`), pull the project's completed
  //    scenes onto the timeline in scene order so the operator lands here with
  //    a starting cut already laid down. The lip-synced dialogue audio is baked
  //    into each scene's video, so it rides along with the clip. ───────────────
  const projectLoadedRef = useRef(false);
  const [projectLoad, setProjectLoad] = useState<'idle' | 'loading' | 'error'>('idle');

  // ── Shot Plan handoff: when the operator clicks "Open in editor" on the Shot
  //    Plan, the generated clips are passed through sessionStorage. Read + clear
  //    them once on mount and seed the timeline in plan order. One-shot so a
  //    later manual visit does not re-seed stale clips. ─────────────────────────
  const seedTakenRef = useRef(false);
  useEffect(() => {
    if (seedTakenRef.current) { return; }
    seedTakenRef.current = true;
    // Don't clobber an edit already in progress.
    if (clips.length > 0) { return; }
    const seed = takeEditorSeed();
    if (!seed || seed.clips.length === 0) { return; }
    for (const clip of seed.clips) {
      dispatch({
        type: 'ADD_CLIP',
        clip: {
          name: clip.name,
          url: clip.url,
          thumbnailUrl: clip.thumbnailUrl,
          duration: clip.duration,
          source: 'project',
        },
      });
    }
  }, [clips.length]);

  useEffect(() => {
    if (projectLoadedRef.current) { return; }
    if (!projectIdParam) { return; }
    // Never clobber an edit already in progress — only seed an empty timeline.
    if (clips.length > 0) { return; }

    projectLoadedRef.current = true;
    setProjectLoad('loading');

    void (async () => {
      try {
        const res = await authFetch(`/api/video/project/${projectIdParam}`);
        if (!res.ok) { throw new Error('Project load failed'); }
        const data = (await res.json()) as { success: boolean; project?: PipelineProject };
        if (!data.success || !data.project) { throw new Error('Project not found'); }

        const { scenes, generatedScenes } = data.project;
        const durationBySceneId = new Map(scenes.map((s) => [s.id, s.duration]));
        const numberBySceneId = new Map(scenes.map((s) => [s.id, s.sceneNumber]));

        // Only completed scenes that actually rendered a video URL become clips.
        const ready = generatedScenes
          .filter((g): g is typeof g & { videoUrl: string } =>
            g.status === 'completed' && typeof g.videoUrl === 'string' && g.videoUrl.length > 0)
          .map((g) => ({
            url: g.videoUrl,
            thumbnailUrl: g.thumbnailUrl,
            sceneNumber: numberBySceneId.get(g.sceneId) ?? Number.MAX_SAFE_INTEGER,
            duration: durationBySceneId.get(g.sceneId) ?? DEFAULT_CLIP_DURATION,
          }))
          .sort((a, b) => a.sceneNumber - b.sceneNumber);

        for (const clip of ready) {
          dispatch({
            type: 'ADD_CLIP',
            clip: {
              name: `Scene ${clip.sceneNumber}`,
              url: clip.url,
              thumbnailUrl: clip.thumbnailUrl,
              duration: clip.duration,
              source: 'project',
            },
          });
        }
        setProjectLoad('idle');
      } catch {
        setProjectLoad('error');
      }
    })();
  }, [projectIdParam, clips.length, authFetch]);

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
            <Scissors className="w-6 h-6 text-primary" />
            Video Editor
          </PageTitle>
          <SectionDescription className="mt-1 text-muted-foreground">
            Trim, stitch, light, and caption — drop clips, drag the playhead, click Export.
          </SectionDescription>
        </div>
        <div className="flex items-center gap-2">
          {projectLoad === 'loading' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-md text-xs text-primary-light">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Loading your scenes…
            </div>
          )}
          {projectLoad === 'error' && (
            <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded-md text-xs text-destructive">
              <AlertCircle className="w-3.5 h-3.5" />
              Couldn’t load that project — start from the library.
            </div>
          )}
          <ExportStatusPill state={exportState} />
        </div>
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
      <div className="text-[10px] text-muted-foreground flex flex-wrap gap-3 px-1">
        <span><kbd className="px-1 py-0.5 bg-surface-elevated rounded text-muted-foreground">Space</kbd> Play/Pause</span>
        <span><kbd className="px-1 py-0.5 bg-surface-elevated rounded text-muted-foreground">S</kbd> Split at playhead</span>
        <span><kbd className="px-1 py-0.5 bg-surface-elevated rounded text-muted-foreground">Ctrl+Z</kbd> Undo</span>
        <span><kbd className="px-1 py-0.5 bg-surface-elevated rounded text-muted-foreground">Ctrl+Shift+Z</kbd> Redo</span>
        <span><kbd className="px-1 py-0.5 bg-surface-elevated rounded text-muted-foreground">Esc</kbd> Deselect</span>
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
      <div className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-md text-xs text-primary-light">
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
        className="flex items-center gap-2 px-3 py-1.5 bg-primary/10 border border-primary/30 rounded-md text-xs text-primary hover:bg-primary/20"
      >
        <CheckCircle className="w-3.5 h-3.5" />
        Saved to Library — open
      </a>
    );
  }
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-destructive/10 border border-destructive/30 rounded-md text-xs text-destructive">
      <AlertCircle className="w-3.5 h-3.5" />
      {state.error ?? 'Render failed'}
    </div>
  );
}
