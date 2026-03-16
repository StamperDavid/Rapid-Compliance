'use client';

import { useReducer, useCallback, useEffect, useMemo, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import SubpageNav from '@/components/ui/SubpageNav';
import { CONTENT_GENERATOR_TABS } from '@/lib/constants/subpage-nav';
import {
  Scissors,
  Loader2,
  Download,
  Save,
  Sparkles,
  Undo2,
  Redo2,
  Trash2,
  Type,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { VideoPlayer } from '../components/VideoPlayer';
import { EditorTimeline } from './components/EditorTimeline';
import { EditorMediaPanel } from './components/EditorMediaPanel';
import { EditorTextOverlays } from './components/EditorTextOverlays';
import { editorReducer, initialEditorState } from './editor-reducer';
import type { TransitionType } from '@/types/video-pipeline';

// ── Types for project fetch ─────────────────────────────────────────────────

interface SceneResult {
  sceneId: string;
  videoUrl: string | null;
  thumbnailUrl: string | null;
}

interface ProjectDetail {
  id: string;
  name: string;
  scenes: { id: string }[];
  generatedScenes: SceneResult[];
  transitionType?: TransitionType;
}

// ============================================================================
// Component
// ============================================================================

export default function VideoEditorPage() {
  const authFetch = useAuthFetch();
  const searchParams = useSearchParams();
  const [state, dispatch] = useReducer(editorReducer, initialEditorState);
  const hasLoadedParams = useRef(false);

  // ── Auto-load from URL params (?project=xxx or ?clips=[...]) ────────────
  useEffect(() => {
    if (hasLoadedParams.current) { return; }
    hasLoadedParams.current = true;

    const projectId = searchParams.get('project');
    const clipsParam = searchParams.get('clips');

    // Load clips from a video project
    if (projectId) {
      void (async () => {
        try {
          const response = await authFetch(`/api/video/project/${projectId}`);
          if (!response.ok) { return; }
          const data = (await response.json()) as { success: boolean; project: ProjectDetail };
          if (!data.success || !data.project) { return; }

          const project = data.project;
          const completedScenes = project.generatedScenes.filter((s) => s.videoUrl);

          for (const scene of completedScenes) {
            const sceneIndex = project.scenes.findIndex((s) => s.id === scene.sceneId) + 1;
            dispatch({
              type: 'ADD_CLIP',
              clip: {
                name: `${project.name} — Scene ${sceneIndex || completedScenes.indexOf(scene) + 1}`,
                url: scene.videoUrl ?? '',
                thumbnailUrl: scene.thumbnailUrl ?? null,
                duration: 5,
                source: 'project',
              },
            });
          }

          // Use the project's transition type if set
          if (project.transitionType) {
            dispatch({ type: 'SET_DEFAULT_TRANSITION', transition: project.transitionType });
          }
        } catch {
          // Silently fail — user can manually add clips
        }
      })();
    }

    // Load raw clip URLs passed directly
    if (clipsParam) {
      try {
        const urls = JSON.parse(clipsParam) as string[];
        if (Array.isArray(urls)) {
          for (const [idx, url] of urls.entries()) {
            if (typeof url === 'string' && url.startsWith('http')) {
              dispatch({
                type: 'ADD_CLIP',
                clip: {
                  name: `Clip ${idx + 1}`,
                  url,
                  thumbnailUrl: null,
                  duration: 5,
                  source: 'url',
                },
              });
            }
          }
        }
      } catch {
        // Invalid JSON — ignore
      }
    }
  }, [searchParams, authFetch]);

  const {
    clips,
    audioTracks,
    textOverlays,
    selectedClipId,
    selectedOverlayId,
    defaultTransition,
    playheadTime,
    totalDuration,
    zoomLevel,
    assembledUrl,
    isAssembling,
    isMixingAudio,
    assemblyError,
    isSaving,
    saved,
    undoStack,
    redoStack,
  } = state;

  // ── Preview URL ─────────────────────────────────────────────────────────
  const previewUrl = useMemo(() => {
    if (assembledUrl) { return assembledUrl; }
    if (selectedClipId) {
      const clip = clips.find((c) => c.id === selectedClipId);
      if (clip) { return clip.url; }
    }
    if (clips.length > 0) { return clips[0].url; }
    return null;
  }, [assembledUrl, selectedClipId, clips]);

  // ── Show/hide text overlays panel ───────────────────────────────────────
  // Text panel is visible when there are overlays or an overlay is selected

  // ========================================================================
  // Assembly
  // ========================================================================

  const handleAssemble = useCallback(async () => {
    if (clips.length === 0) { return; }
    dispatch({ type: 'SET_ASSEMBLING', assembling: true });
    dispatch({ type: 'SET_ASSEMBLY_ERROR', error: null });

    try {
      const sceneUrls = clips.map((c) => c.url);
      const transition = clips[0]?.transitionType ?? 'fade';

      const response = await authFetch('/api/video/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: `editor-${Date.now()}`,
          sceneUrls,
          transitionType: transition,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Assembly failed');
      }

      const data = await response.json() as { success: boolean; videoUrl: string };
      let finalUrl = data.videoUrl;

      // Mix audio tracks if present
      if (audioTracks.length > 0 && finalUrl) {
        dispatch({ type: 'SET_MIXING_AUDIO', mixing: true });
        try {
          // Use first audio track as background music
          const primaryTrack = audioTracks[0];
          const mixResponse = await authFetch('/api/video/audio-mix', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoUrl: finalUrl,
              backgroundMusicUrl: primaryTrack.url,
              musicVolume: primaryTrack.volume,
              voiceoverVolume: 1.0,
              duckingEnabled: true,
              duckingAmount: -14,
              normalizeLUFS: -14,
            }),
          });

          if (mixResponse.ok) {
            const mixData = await mixResponse.json() as { success: boolean; videoUrl: string };
            if (mixData.success && mixData.videoUrl) {
              finalUrl = mixData.videoUrl;
            }
          }
        } catch {
          // Audio mix failure is non-critical
        } finally {
          dispatch({ type: 'SET_MIXING_AUDIO', mixing: false });
        }
      }

      // Apply text overlays if present
      if (textOverlays.length > 0 && finalUrl) {
        try {
          const overlayResponse = await authFetch('/api/video/text-overlay', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              videoUrl: finalUrl,
              overlays: textOverlays.map((o) => ({
                text: o.text,
                position: o.position,
                fontSize: o.fontSize,
                fontColor: o.fontColor,
                backgroundColor: o.backgroundColor,
                startTime: o.startTime,
                endTime: o.endTime,
              })),
            }),
          });

          if (overlayResponse.ok) {
            const overlayData = await overlayResponse.json() as { success: boolean; videoUrl: string };
            if (overlayData.success && overlayData.videoUrl) {
              finalUrl = overlayData.videoUrl;
            }
          }
        } catch {
          // Text overlay failure is non-critical
        }
      }

      dispatch({ type: 'SET_ASSEMBLED_URL', url: finalUrl });
    } catch (err) {
      dispatch({ type: 'SET_ASSEMBLY_ERROR', error: err instanceof Error ? err.message : 'Assembly failed' });
    } finally {
      dispatch({ type: 'SET_ASSEMBLING', assembling: false });
    }
  }, [clips, audioTracks, textOverlays, authFetch]);

  // ========================================================================
  // Save to Library
  // ========================================================================

  const handleSaveToLibrary = useCallback(async () => {
    if (!assembledUrl) { return; }
    dispatch({ type: 'SET_SAVING', saving: true });
    try {
      const response = await authFetch('/api/media', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'video',
          category: 'final',
          name: `Edited Video — ${new Date().toLocaleDateString()}`,
          url: assembledUrl,
          mimeType: 'video/mp4',
          fileSize: 0,
          metadata: {
            clipCount: String(clips.length),
            audioTracks: String(audioTracks.length),
            textOverlays: String(textOverlays.length),
            source: 'editor',
          },
        }),
      });

      if (response.ok) {
        dispatch({ type: 'SET_SAVED', saved: true });
      }
    } catch {
      // Save failure shown via saved state
    } finally {
      dispatch({ type: 'SET_SAVING', saving: false });
    }
  }, [assembledUrl, clips.length, audioTracks.length, textOverlays.length, authFetch]);

  // ========================================================================
  // Keyboard Shortcuts
  // ========================================================================

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in inputs
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') {
        return;
      }

      // Ctrl/Cmd+Z = Undo
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        dispatch({ type: 'UNDO' });
        return;
      }

      // Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y = Redo
      if ((e.ctrlKey || e.metaKey) && (e.key === 'y' || (e.key === 'z' && e.shiftKey))) {
        e.preventDefault();
        dispatch({ type: 'REDO' });
        return;
      }

      // Ctrl/Cmd+D = Duplicate selected clip
      if ((e.ctrlKey || e.metaKey) && e.key === 'd') {
        e.preventDefault();
        if (selectedClipId) {
          dispatch({ type: 'DUPLICATE_CLIP', clipId: selectedClipId });
        }
        return;
      }

      // Delete/Backspace = Remove selected clip
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedClipId) {
          dispatch({ type: 'REMOVE_CLIP', clipId: selectedClipId });
        } else if (selectedOverlayId) {
          dispatch({ type: 'REMOVE_TEXT_OVERLAY', overlayId: selectedOverlayId });
        }
        return;
      }

      // Space = toggle play
      if (e.key === ' ') {
        e.preventDefault();
        dispatch({ type: 'SET_PLAYING', playing: !state.isPlaying });
        return;
      }

      // S = Split selected clip at playhead
      if (e.key === 's' && !e.ctrlKey && !e.metaKey) {
        if (selectedClipId) {
          // Calculate split time relative to clip start
          let elapsed = 0;
          for (const clip of clips) {
            const effective = (clip.duration || 5) - clip.trimStart - clip.trimEnd;
            if (clip.id === selectedClipId) {
              const splitTime = playheadTime - elapsed;
              if (splitTime > 0 && splitTime < effective) {
                dispatch({ type: 'SPLIT_CLIP', clipId: selectedClipId, splitTime });
              }
              break;
            }
            elapsed += Math.max(0, effective);
          }
        }
        return;
      }

      // Escape = deselect
      if (e.key === 'Escape') {
        dispatch({ type: 'SELECT_CLIP', clipId: null });
        dispatch({ type: 'SELECT_OVERLAY', overlayId: null });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedClipId, selectedOverlayId, state.isPlaying, playheadTime, clips]);

  // ========================================================================
  // Render
  // ========================================================================

  return (
    <div className="min-h-screen p-6 space-y-4">
      <SubpageNav items={CONTENT_GENERATOR_TABS} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Scissors className="w-7 h-7 text-amber-500" />
            Video Editor
          </h1>
          <p className="text-zinc-400 text-sm mt-1">
            Stitch clips, add audio &amp; text, and assemble videos — no pipeline required
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Undo/Redo */}
          <div className="flex items-center gap-1 mr-2">
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-zinc-500 hover:text-white"
              onClick={() => dispatch({ type: 'UNDO' })}
              disabled={undoStack.length === 0}
              title="Undo (Ctrl+Z)"
            >
              <Undo2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="ghost"
              className="h-8 w-8 p-0 text-zinc-500 hover:text-white"
              onClick={() => dispatch({ type: 'REDO' })}
              disabled={redoStack.length === 0}
              title="Redo (Ctrl+Shift+Z)"
            >
              <Redo2 className="w-4 h-4" />
            </Button>
          </div>

          {/* Clear all */}
          {clips.length > 0 && (
            <Button
              size="sm"
              variant="ghost"
              className="gap-1.5 text-zinc-500 hover:text-red-400"
              onClick={() => dispatch({ type: 'CLEAR_ALL' })}
              title="Clear all"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Add Text Overlay shortcut */}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5"
            onClick={() => dispatch({
              type: 'ADD_TEXT_OVERLAY',
              overlay: {
                text: 'New Text',
                startTime: playheadTime,
                endTime: Math.min(playheadTime + 3, Math.max(totalDuration, 3)),
                position: 'bottom',
                fontSize: 24,
                fontColor: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.5)',
              },
            })}
            title="Add text overlay"
          >
            <Type className="w-3.5 h-3.5" />
            Text
          </Button>

          {/* Assembly Controls */}
          {assembledUrl && (
            <>
              <a href={assembledUrl} download>
                <Button variant="outline" size="sm" className="gap-2">
                  <Download className="w-4 h-4" />
                  Download
                </Button>
              </a>
              <Button
                size="sm"
                variant="outline"
                className="gap-2"
                onClick={() => { void handleSaveToLibrary(); }}
                disabled={isSaving || saved}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {saved ? 'Saved' : 'Save to Library'}
              </Button>
            </>
          )}
          <Button
            size="sm"
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            onClick={() => { void handleAssemble(); }}
            disabled={clips.length < 1 || isAssembling}
          >
            {isAssembling ? (
              <><Loader2 className="w-4 h-4 animate-spin" />{isMixingAudio ? 'Mixing Audio...' : 'Assembling...'}</>
            ) : (
              <><Sparkles className="w-4 h-4" />Assemble ({clips.length} clip{clips.length !== 1 ? 's' : ''})</>
            )}
          </Button>
        </div>
      </div>

      {assemblyError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
          <p className="text-sm text-red-400">{assemblyError}</p>
        </div>
      )}

      {/* Main Layout */}
      <div className="grid grid-cols-12 gap-4">
        {/* ── Media Panel (Left) ──────────────────────────────────────── */}
        <div className="col-span-3">
          <EditorMediaPanel
            dispatch={dispatch}
            defaultTransition={defaultTransition}
          />
        </div>

        {/* ── Preview + Timeline (Center/Right) ───────────────────────── */}
        <div className="col-span-9 space-y-4">
          {/* Video Preview */}
          <Card className="bg-zinc-900/50 border-zinc-800">
            <CardContent className="p-3">
              {previewUrl ? (
                <VideoPlayer src={previewUrl} className="rounded-lg" />
              ) : (
                <div className="aspect-video bg-zinc-800/50 rounded-lg flex flex-col items-center justify-center">
                  <Scissors className="w-12 h-12 text-zinc-700 mb-3" />
                  <p className="text-zinc-500 text-sm">Add clips to get started</p>
                  <p className="text-zinc-600 text-xs mt-1">
                    Import from projects, upload files, or paste URLs
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 text-[10px] text-zinc-600">
                    <span className="px-2 py-1 bg-zinc-800 rounded">Space = Play/Pause</span>
                    <span className="px-2 py-1 bg-zinc-800 rounded">Ctrl+Z = Undo</span>
                    <span className="px-2 py-1 bg-zinc-800 rounded">Ctrl+D = Duplicate</span>
                    <span className="px-2 py-1 bg-zinc-800 rounded">S = Split at Playhead</span>
                    <span className="px-2 py-1 bg-zinc-800 rounded">Del = Remove</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Horizontal Timeline */}
          <EditorTimeline
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

          {/* Text Overlays Panel (shown when overlays exist or one is selected) */}
          {(textOverlays.length > 0 || selectedOverlayId) && (
            <EditorTextOverlays
              textOverlays={textOverlays}
              selectedOverlayId={selectedOverlayId}
              playheadTime={playheadTime}
              totalDuration={totalDuration}
              dispatch={dispatch}
            />
          )}
        </div>
      </div>

      {/* Keyboard shortcut hint (bottom bar) */}
      <div className="fixed bottom-0 left-0 right-0 bg-zinc-900/80 backdrop-blur border-t border-zinc-800 px-6 py-1.5 flex items-center justify-between text-[10px] text-zinc-600 z-10">
        <div className="flex gap-4">
          <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Space</kbd> Play/Pause</span>
          <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Ctrl+Z</kbd> Undo</span>
          <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Ctrl+Shift+Z</kbd> Redo</span>
          <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Ctrl+D</kbd> Duplicate</span>
          <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">S</kbd> Split</span>
          <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Del</kbd> Remove</span>
          <span><kbd className="px-1 py-0.5 bg-zinc-800 rounded text-zinc-400">Esc</kbd> Deselect</span>
        </div>
        <div className="text-zinc-500">
          {clips.length} clip{clips.length !== 1 ? 's' : ''} · {audioTracks.length} audio · {textOverlays.length} text
          {totalDuration > 0 && ` · ${Math.floor(totalDuration / 60)}:${String(Math.floor(totalDuration % 60)).padStart(2, '0')}`}
        </div>
      </div>
    </div>
  );
}
