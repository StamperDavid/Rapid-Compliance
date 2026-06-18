'use client';

/**
 * Video Editor — purpose-first shell.
 *
 * The editor is ONE shared core (the reducer below: clips, audio, text overlays,
 * trim/split/transitions/effects/undo + the generation handoff + the
 * export-to-Library path) with SEVERAL focused workspaces ("modes") layered on
 * top. The operator first picks a purpose (EditorModeSelector); that mode renders
 * its own tools against the SAME project, so the capabilities never collide in one
 * crowded screen. Switching modes never loses the project.
 *
 * Modes + their parity floors live in editor-modes.ts:
 *   pro · quick · script · social · vfx  → Premiere · CapCut · Descript · OpusClip · our AI
 */

import { useReducer, useCallback, useEffect, useRef, useState, type ComponentType } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { Scissors, Sparkles, CheckCircle, AlertCircle, Loader2, LayoutGrid } from 'lucide-react';

import { PageTitle, SectionDescription } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';

import { editorReducer, initialEditorState } from './editor-reducer';
import { DEFAULT_CLIP_DURATION, type EditorClip } from './types';
import type { MediaItem } from '@/types/media-library';
import type { PipelineProject } from '@/types/video-pipeline';
import { takeEditorSeed } from '@/lib/video/editor-seed';
import {
  EDITOR_MODES,
  isEditorMode,
  type EditorMode,
  type EditorModeProps,
  type ExportState,
} from './editor-modes';
import EditorModeSelector from './EditorModeSelector';
import ProEditMode from './modes/ProEditMode';
import QuickEditMode from './modes/QuickEditMode';
import ScriptPodcastMode from './modes/ScriptPodcastMode';
import SocialRepurposeMode from './modes/SocialRepurposeMode';
import GenerativeVfxMode from './modes/GenerativeVfxMode';

const MODE_COMPONENTS: Record<EditorMode, ComponentType<EditorModeProps>> = {
  pro: ProEditMode,
  quick: QuickEditMode,
  script: ScriptPodcastMode,
  social: SocialRepurposeMode,
  vfx: GenerativeVfxMode,
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
  const router = useRouter();
  const projectIdParam = searchParams.get('project');
  const modeParam = searchParams.get('mode');
  const mode: EditorMode | null = isEditorMode(modeParam) ? modeParam : null;

  const [state, dispatch] = useReducer(editorReducer, initialEditorState);

  const { clips, textOverlays, isPlaying, selectedClipId, playheadTime } = state;

  // ── Export state (separate from the legacy isAssembling — different endpoint) ─
  const [exportState, setExportState] = useState<ExportState>({
    phase: 'idle',
    error: null,
    item: null,
  });

  // ── Switch / clear the active mode (preserves other query params, e.g. project) ─
  const setMode = useCallback(
    (next: EditorMode | null) => {
      const params = new URLSearchParams(searchParams.toString());
      if (next) {
        params.set('mode', next);
      } else {
        params.delete('mode');
      }
      const qs = params.toString();
      router.replace(qs ? `/content/video/editor?${qs}` : '/content/video/editor');
    },
    [router, searchParams],
  );

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
    if (seedTakenRef.current) {
      return;
    }
    seedTakenRef.current = true;
    // Don't clobber an edit already in progress.
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
    // Never clobber an edit already in progress — only seed an empty timeline.
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

        // Only completed scenes that actually rendered a video URL become clips.
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

  // ── Shared contract handed to every mode workspace ──────────────────────
  const modeProps: EditorModeProps = {
    state,
    dispatch,
    authFetch,
    exportState,
    onExport: () => {
      void handleExport();
    },
    onSplit: splitAtPlayhead,
  };

  const activeMeta = mode ? EDITOR_MODES.find((m) => m.id === mode) : null;
  const ActiveMode = mode ? MODE_COMPONENTS[mode] : null;

  return (
    <div className="p-6 space-y-4">
      <SubpageNav items={CONTENT_GENERATOR_TABS} />

      <header className="flex items-center justify-between gap-4">
        <div>
          <PageTitle className="text-2xl flex items-center gap-2">
            <Scissors className="w-6 h-6 text-primary" />
            Video Editor
          </PageTitle>
          <SectionDescription className="mt-1 text-muted-foreground">
            {activeMeta
              ? `${activeMeta.label} — matches ${activeMeta.competitor}.`
              : 'Pick how you want to edit — each mode gives you the right tools for the job.'}
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
          {activeMeta && (
            <Button variant="outline" size="sm" onClick={() => setMode(null)} className="gap-1.5">
              <LayoutGrid className="w-4 h-4" />
              Change mode
            </Button>
          )}
          <ExportStatusPill state={exportState} />
        </div>
      </header>

      {mode === null || ActiveMode === null ? (
        <EditorModeSelector onSelect={setMode} hasClips={clips.length > 0} />
      ) : (
        <ActiveMode {...modeProps} />
      )}
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
