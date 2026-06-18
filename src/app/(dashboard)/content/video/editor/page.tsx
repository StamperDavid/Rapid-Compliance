'use client';

/**
 * Video Editor — ONE unified CapCut-style editor.
 *
 * The Preview + Timeline are always on screen (stitch + edit the project). A tool
 * rail on the right swaps which TOOL PANEL is open beside them — Edit, Text &
 * Captions, VFX & B-Roll, Transcript, Make Clips. These are tools of ONE editor,
 * not separate modes. Content arrives from the generation flow, an upload, or the
 * Library (the "Add media" rail), all driving the same shared reducer.
 *
 * CapCut-style surface, pro-grade tools — each tool meets its own capability bar
 * (internal benchmarks live in project memory, never in the product).
 */

import { useReducer, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams } from 'next/navigation';
import { Scissors, Sparkles, CheckCircle, AlertCircle, Loader2, Upload } from 'lucide-react';

import { PageTitle } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';

import Toolbar from '@/components/video-editor/Toolbar';
import Preview from '@/components/video-editor/Preview';
import Timeline from '@/components/video-editor/Timeline';
import EffectsPanel from '@/components/video-editor/EffectsPanel';

import { editorReducer, initialEditorState } from './editor-reducer';
import { DEFAULT_CLIP_DURATION, type EditorClip } from './types';
import type { MediaItem } from '@/types/media-library';
import type { PipelineProject } from '@/types/video-pipeline';
import { takeEditorSeed } from '@/lib/video/editor-seed';
import type { EditorModeProps, ExportState } from './editor-modes';
import { EDITOR_TOOLS, type EditorTool, type EditorToolProps } from './editor-tools';
import { EditorMediaPanel } from './components/EditorMediaPanel';
import VfxToolPanel from './tools/VfxToolPanel';
import TextToolPanel from './tools/TextToolPanel';
import TranscriptToolPanel from './tools/TranscriptToolPanel';
import ClipsToolPanel from './tools/ClipsToolPanel';

/** The non-Edit tool panels (Edit uses EffectsPanel directly). */
const TOOL_PANELS: Record<Exclude<EditorTool, 'edit'>, ComponentType<EditorToolProps>> = {
  text: TextToolPanel,
  vfx: VfxToolPanel,
  transcript: TranscriptToolPanel,
  clips: ClipsToolPanel,
};

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
  // The open tool on the right rail (the timeline is always visible).
  const [tool, setTool] = useState<EditorTool>('edit');
  // The Add-media rail (upload / library / projects / characters / URL import) is a
  // SHARED on-ramp: bring in your own footage, an earlier video, or a project's scenes.
  const [mediaOpen, setMediaOpen] = useState(false);

  const { clips, textOverlays, isPlaying, selectedClipId, playheadTime } = state;

  const [exportState, setExportState] = useState<ExportState>({
    phase: 'idle',
    error: null,
    item: null,
  });

  // ── Project auto-load (`?project=<id>`): seed the timeline with the project's
  //    completed scenes in order. ──────────────────────────────────────────────
  const projectLoadedRef = useRef(false);
  const [projectLoad, setProjectLoad] = useState<'idle' | 'loading' | 'error'>('idle');

  // ── Shot Plan handoff via sessionStorage ("Open in editor"). ────────────────
  const seedTakenRef = useRef(false);
  useEffect(() => {
    if (seedTakenRef.current) {
      return;
    }
    seedTakenRef.current = true;
    if (clips.length > 0) {
      return;
    }
    const seed = takeEditorSeed();
    if (!seed || seed.clips.length === 0) {
      return;
    }
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
    if (projectLoadedRef.current) {
      return;
    }
    if (!projectIdParam) {
      return;
    }
    if (clips.length > 0) {
      return;
    }

    projectLoadedRef.current = true;
    setProjectLoad('loading');

    void (async () => {
      try {
        const res = await authFetch(`/api/video/project/${projectIdParam}`);
        if (!res.ok) {
          throw new Error('Project load failed');
        }
        const data = (await res.json()) as { success: boolean; project?: PipelineProject };
        if (!data.success || !data.project) {
          throw new Error('Project not found');
        }

        const { scenes, generatedScenes } = data.project;
        const durationBySceneId = new Map(scenes.map((s) => [s.id, s.duration]));
        const numberBySceneId = new Map(scenes.map((s) => [s.id, s.sceneNumber]));

        const ready = generatedScenes
          .filter(
            (g): g is typeof g & { videoUrl: string } =>
              g.status === 'completed' && typeof g.videoUrl === 'string' && g.videoUrl.length > 0,
          )
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
    if (!selectedClipId) {
      return;
    }
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
    if (clips.length === 0) {
      return;
    }
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
  }, [clips, textOverlays, authFetch]);

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

  // ── Shared contract handed to every tool panel ──────────────────────────
  const toolProps: EditorModeProps = {
    state,
    dispatch,
    authFetch,
    exportState,
    onExport: () => {
      void handleExport();
    },
    onSplit: splitAtPlayhead,
  };

  const ActivePanel = tool === 'edit' ? null : TOOL_PANELS[tool];

  const mainGridClass = mediaOpen
    ? 'grid grid-cols-1 lg:grid-cols-[320px_minmax(0,1fr)_380px] gap-4'
    : 'grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_380px] gap-4';

  return (
    <div className="p-6 space-y-4">
      <SubpageNav items={CONTENT_GENERATOR_TABS} />

      <header className="flex flex-wrap items-center justify-between gap-3">
        <PageTitle className="text-2xl flex items-center gap-2">
          <Scissors className="w-6 h-6 text-primary" />
          Video Editor
        </PageTitle>

        <div className="flex items-center gap-2">
          <Button
            variant={mediaOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setMediaOpen((open) => !open)}
            className="gap-1.5"
          >
            <Upload className="w-4 h-4" />
            Add media
          </Button>
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
        isPlaying={state.isPlaying}
        zoomLevel={state.zoomLevel}
        canUndo={state.undoStack.length > 0}
        canRedo={state.redoStack.length > 0}
        isExporting={exportState.phase === 'rendering'}
        hasClips={state.clips.length > 0}
        selectedClipId={state.selectedClipId}
        playheadTime={state.playheadTime}
        totalDuration={state.totalDuration}
        onSplit={splitAtPlayhead}
        onExport={() => {
          void handleExport();
        }}
        dispatch={dispatch}
      />

      <div className={mainGridClass}>
        {mediaOpen && (
          <aside className="h-fit lg:sticky lg:top-4">
            <EditorMediaPanel dispatch={dispatch} defaultTransition={state.defaultTransition} />
          </aside>
        )}

        {/* Always-on core: Preview + Timeline */}
        <div className="min-w-0 space-y-4">
          <Preview
            clips={state.clips}
            textOverlays={state.textOverlays}
            selectedOverlayId={state.selectedOverlayId}
            playheadTime={state.playheadTime}
            isPlaying={state.isPlaying}
            totalDuration={state.totalDuration}
            dispatch={dispatch}
          />
          <Timeline
            clips={state.clips}
            audioTracks={state.audioTracks}
            textOverlays={state.textOverlays}
            selectedClipId={state.selectedClipId}
            selectedOverlayId={state.selectedOverlayId}
            playheadTime={state.playheadTime}
            totalDuration={state.totalDuration}
            zoomLevel={state.zoomLevel}
            dispatch={dispatch}
          />
        </div>

        {/* Tool column: the rail + the open tool's panel */}
        <div className="min-w-0 space-y-3">
          <div className="flex flex-wrap gap-1.5">
            {EDITOR_TOOLS.map((t) => {
              const Icon = t.icon;
              const active = tool === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTool(t.id)}
                  className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
                    active
                      ? 'bg-primary/15 text-primary'
                      : 'text-muted-foreground hover:bg-surface-elevated hover:text-foreground'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {tool === 'edit' || ActivePanel === null ? (
            <EffectsPanel
              clips={state.clips}
              textOverlays={state.textOverlays}
              selectedClipId={state.selectedClipId}
              selectedOverlayId={state.selectedOverlayId}
              playheadTime={state.playheadTime}
              totalDuration={state.totalDuration}
              dispatch={dispatch}
            />
          ) : (
            <ActivePanel {...toolProps} />
          )}
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Local sub-components
// ============================================================================

function ExportStatusPill({ state }: { state: ExportState }) {
  if (state.phase === 'idle') {
    return null;
  }
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
