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

import { PageTitle, Caption } from '@/components/ui/typography';
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

/** One shot as returned by GET /api/video/project/[projectId] (the live build contract). */
interface PollShot {
  id: string;
  index: number;
  durationSeconds: number;
  title?: string;
  generated?: {
    videoUrl?: string;
    lastFrameUrl?: string;
    keyframeUrl?: string;
    status?: string;
  };
}

/** GET /api/video/project/[projectId] response, including the live video-build fields. */
interface ProjectPollResponse {
  success: boolean;
  project?: PipelineProject;
  shotPlan?: { shots: PollShot[] } | null;
  videoBuildStatus?: 'generating' | 'complete' | 'error' | null;
  videoBuildProgress?: { phase: string; label: string; done: number; total: number; failed?: number } | null;
  videoBuildError?: string | null;
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
  // Open by DEFAULT — a video editor needs its media bin visible, like CapCut. The
  // operator can collapse it with the header toggle.
  const [mediaOpen, setMediaOpen] = useState(true);

  const { clips, textOverlays, isPlaying, selectedClipId, playheadTime } = state;

  const [exportState, setExportState] = useState<ExportState>({
    phase: 'idle',
    error: null,
    item: null,
  });

  // ── Project auto-load (`?project=<id>`): LIVE-POLL the shot plan so each rendered
  //    clip drops onto the timeline the moment the server finishes it. ───────────
  const projectLoadedRef = useRef(false);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const addedClipUrlsRef = useRef<Set<string>>(new Set());
  // Reach authFetch inside the poll WITHOUT making it an effect dependency — its
  // identity changes when the auth token refreshes, and if that (or `clips.length`)
  // were a dep, every re-render would tear the interval down and the projectLoadedRef
  // guard would never recreate it (the auto-open "clips never drop until refresh" bug).
  const authFetchRef = useRef(authFetch);
  authFetchRef.current = authFetch;
  // True once a one-shot sessionStorage seed has filled the timeline, so the poll can
  // stand down without depending on `clips.length`.
  const manualSeedRef = useRef(false);
  const [projectLoad, setProjectLoad] = useState<'idle' | 'loading' | 'error'>('idle');
  const [buildStatus, setBuildStatus] = useState<'generating' | 'complete' | 'error' | null>(null);
  const [buildProgress, setBuildProgress] = useState<{ done: number; total: number } | null>(null);
  const [buildError, setBuildError] = useState<string | null>(null);

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
    manualSeedRef.current = true;
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

  // BACKWARD COMPAT path: older projects expose finished clips on `generatedScenes`
  // (no live shot plan). Load them once, in scene order, same as the legacy behavior.
  const loadFromGeneratedScenes = useCallback(
    (project: PipelineProject | undefined) => {
      if (!project) {
        return;
      }
      const { scenes, generatedScenes } = project;
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
        if (addedClipUrlsRef.current.has(clip.url)) {
          continue;
        }
        addedClipUrlsRef.current.add(clip.url);
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
    },
    [],
  );

  useEffect(() => {
    if (projectLoadedRef.current) {
      return;
    }
    if (!projectIdParam) {
      return;
    }
    // A sessionStorage seed (manual "Open in editor") already populated the timeline —
    // don't also poll. Checked via a ref (not `clips.length`) so this effect does NOT
    // depend on clip count — otherwise adding a clip re-runs the effect, the cleanup
    // tears the interval down, and the projectLoadedRef guard never recreates it.
    if (manualSeedRef.current) {
      return;
    }

    projectLoadedRef.current = true;
    setProjectLoad('loading');

    const stopPolling = () => {
      if (pollRef.current !== null) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    // One poll tick: pull the project, drop any newly-finished clips onto the timeline
    // in plan order, surface build status, and stop once the build is done or errored.
    const poll = async () => {
      try {
        const res = await authFetchRef.current(`/api/video/project/${projectIdParam}`);
        if (!res.ok) {
          throw new Error('Project load failed');
        }
        const data = (await res.json()) as ProjectPollResponse;
        if (!data.success) {
          throw new Error('Project not found');
        }

        // BACKWARD COMPAT: older projects have no live shot plan — fall back to the
        // one-shot generatedScenes load and stop (no live build to follow).
        if (!data.shotPlan) {
          stopPolling();
          loadFromGeneratedScenes(data.project);
          setProjectLoad('idle');
          return;
        }

        setBuildStatus(data.videoBuildStatus ?? null);
        setBuildProgress(
          data.videoBuildProgress
            ? { done: data.videoBuildProgress.done, total: data.videoBuildProgress.total }
            : null,
        );
        setBuildError(data.videoBuildError ?? null);

        const ordered = [...data.shotPlan.shots].sort((a, b) => a.index - b.index);
        for (const shot of ordered) {
          const url = shot.generated?.videoUrl;
          if (
            shot.generated?.status === 'completed' &&
            typeof url === 'string' &&
            url.length > 0 &&
            !addedClipUrlsRef.current.has(url)
          ) {
            addedClipUrlsRef.current.add(url);
            const trimmedTitle = shot.title?.trim();
            dispatch({
              type: 'ADD_CLIP',
              clip: {
                name: trimmedTitle && trimmedTitle.length > 0 ? trimmedTitle : `Shot ${shot.index + 1}`,
                url,
                thumbnailUrl: shot.generated.lastFrameUrl ?? shot.generated.keyframeUrl ?? null,
                duration: shot.durationSeconds,
                source: 'project',
              },
            });
          }
        }

        setProjectLoad('idle');

        if (data.videoBuildStatus === 'complete' || data.videoBuildStatus === 'error') {
          stopPolling();
        }
      } catch {
        setProjectLoad('error');
        stopPolling();
      }
    };

    void poll();
    pollRef.current = setInterval(() => {
      void poll();
    }, 4000);

    return stopPolling;
    // Depends ONLY on the project id (+ the stable loader). authFetch is read via a ref
    // and the seed guard via manualSeedRef, so the interval is created once and survives
    // re-renders until the build finishes or the editor unmounts.
  }, [projectIdParam, loadFromGeneratedScenes]);

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

      {buildStatus === 'generating' && (
        <div className="flex items-center gap-2 rounded-md border border-primary/30 bg-primary/10 px-3 py-2 text-xs text-primary-light">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Rendering your shots — clips drop in as they finish
          {buildProgress ? ` (${buildProgress.done}/${buildProgress.total})` : ''}.
        </div>
      )}
      {buildStatus === 'error' && (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
          <AlertCircle className="h-3.5 w-3.5" />
          {buildError ?? 'Some shots didn’t finish rendering. The clips that did are on your timeline.'}
        </div>
      )}

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
          {state.clips.length === 0 && (
            <div className="rounded-xl border border-dashed border-primary/40 bg-primary/5 p-4 text-center">
              <Caption className="block">
                Your timeline is empty. Bring in footage from the{' '}
                <span className="font-medium text-foreground">Media</span> panel
                {mediaOpen ? ' on the left' : ' (the “Add media” button)'} — your{' '}
                <span className="font-medium text-foreground">Library</span>, your{' '}
                <span className="font-medium text-foreground">Projects</span> (generated scenes), or{' '}
                <span className="font-medium text-foreground">Upload</span> your own.
              </Caption>
            </div>
          )}
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
