'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Puzzle, ArrowLeft, ArrowRight, Film, Loader2, Play, Save, CheckCircle2, Captions, Music, Volume2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VideoPlayer } from './VideoPlayer';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { CAPTION_STYLE_LABELS, type TransitionType, type CaptionStyle } from '@/types/video-pipeline';
import { getMusicTracks, MUSIC_CATEGORY_LABELS, type MusicCategory, type MusicTrack } from '@/lib/video/music-library';

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'cut', label: 'Cut (Instant)' },
  { value: 'fade', label: 'Fade (Smooth)' },
  { value: 'dissolve', label: 'Dissolve (Gradual)' },
];

export function StepAssembly() {
  const router = useRouter();
  const authFetch = useAuthFetch();
  const {
    projectId,
    projectName,
    brief,
    scenes,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
    generatedScenes,
    finalVideoUrl,
    transitionType,
    isAssembling,
    setProjectId,
    setFinalVideoUrl,
    setTransitionType,
    setIsAssembling,
    setStep,
    advanceStep,
    updateGeneratedScene,
  } = useVideoPipelineStore();

  const [error, setError] = useState<string | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const autoSavedRef = useRef(false);

  // Caption state
  const [captionsEnabled, setCaptionsEnabled] = useState(false);
  const [captionStyle, setCaptionStyle] = useState<CaptionStyle>('bold-center');

  // Background music state
  const [musicEnabled, setMusicEnabled] = useState(false);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [musicVolume, setMusicVolume] = useState(0.15);
  const [autoDuck, setAutoDuck] = useState(true);
  const [musicCategoryFilter, setMusicCategoryFilter] = useState<MusicCategory | 'all'>('all');
  const musicTracks = useMemo(() => getMusicTracks(), []);
  const filteredTracks = useMemo(() => {
    if (musicCategoryFilter === 'all') { return musicTracks; }
    return musicTracks.filter((t) => t.category === musicCategoryFilter);
  }, [musicTracks, musicCategoryFilter]);
  const selectedTrack = useMemo(
    () => musicTracks.find((t) => t.id === selectedTrackId) ?? null,
    [musicTracks, selectedTrackId],
  );

  // Assembly progress state
  const [assemblyProgress, setAssemblyProgress] = useState<{
    phase: string;
    phaseLabel: string;
    phaseIndex: number;
    totalPhases: number;
  } | null>(null);
  const progressPollingRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const completedScenes = useMemo(
    () => generatedScenes.filter((s) => s.status === 'completed' && s.videoUrl),
    [generatedScenes],
  );

  // Poll for any scenes still generating (in case user arrived before polling finished)
  const generatingScenes = useMemo(
    () => generatedScenes.filter((s) => s.status === 'generating' && s.providerVideoId),
    [generatedScenes],
  );

  const pollStatus = useCallback(async () => {
    const toPoll = generatedScenes.filter((s) => s.status === 'generating' && s.providerVideoId);
    if (toPoll.length === 0) {
      return;
    }

    try {
      const response = await authFetch('/api/video/poll-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          scenes: toPoll.map((s) => ({
            sceneId: s.sceneId,
            providerVideoId: s.providerVideoId,
            provider: s.provider,
          })),
        }),
      });

      if (!response.ok) {
        return;
      }

      const data = await response.json() as {
        success: boolean;
        results: Array<{
          sceneId: string;
          status: 'generating' | 'completed' | 'failed';
          videoUrl: string | null;
          thumbnailUrl: string | null;
          error: string | null;
        }>;
      };

      if (data.success && data.results) {
        for (const result of data.results) {
          if (result.status !== 'generating') {
            updateGeneratedScene(result.sceneId, {
              status: result.status,
              videoUrl: result.videoUrl,
              thumbnailUrl: result.thumbnailUrl,
              error: result.error,
              progress: result.status === 'completed' ? 100 : 0,
            });
          }
        }
      }
    } catch {
      // Polling failures are non-fatal
    }
  }, [generatedScenes, authFetch, updateGeneratedScene]);

  useEffect(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    if (generatingScenes.length === 0) {
      return;
    }

    // Poll immediately, then every 5s
    void pollStatus();
    pollingRef.current = setInterval(() => { void pollStatus(); }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [generatingScenes.length, pollStatus]);

  const handleAssemble = async () => {
    setIsAssembling(true);
    setError(null);

    try {
      // Send providerVideoIds so the server resolves fresh Hedra URLs
      // (raw videoUrl values expire after ~1 hour on Hedra's CDN)
      const providerVideoIds = completedScenes
        .map((s) => s.providerVideoId)
        .filter((id): id is string => Boolean(id));

      const response = await authFetch('/api/video/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ?? 'local',
          providerVideoIds,
          transitionType,
          captions: captionsEnabled ? { enabled: true, style: captionStyle } : undefined,
          music: musicEnabled && selectedTrack ? {
            trackId: selectedTrack.id,
            storagePath: selectedTrack.storagePath,
            volume: musicVolume,
            duckingEnabled: autoDuck,
          } : undefined,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Assembly failed');
      }

      const data = await response.json() as { success: boolean; videoUrl: string };
      if (data.success && data.videoUrl) {
        setFinalVideoUrl(data.videoUrl);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Assembly failed');
    } finally {
      setIsAssembling(false);
    }
  };

  // Auto-save project to Firestore when assembly completes
  const saveProject = useCallback(async (videoUrl: string) => {
    setIsSaving(true);
    try {
      const response = await authFetch('/api/video/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ?? undefined,
          name: projectName || brief.description.slice(0, 50) || 'Untitled Video',
          brief,
          currentStep: 'assembly' as const,
          scenes: scenes.map((s) => ({
            id: s.id,
            sceneNumber: s.sceneNumber,
            scriptText: s.scriptText,
            screenshotUrl: s.screenshotUrl ?? null,
            avatarId: s.avatarId ?? null,
            voiceId: s.voiceId ?? null,
            voiceProvider: s.voiceProvider ?? null,
            duration: s.duration,
            engine: s.engine ?? null,
            backgroundPrompt: s.backgroundPrompt ?? null,
            status: s.status,
          })),
          avatarId: avatarId ?? null,
          avatarName: avatarName ?? null,
          voiceId: voiceId ?? null,
          voiceName: voiceName ?? null,
          generatedScenes: generatedScenes.map((gs) => ({
            sceneId: gs.sceneId,
            providerVideoId: gs.providerVideoId,
            provider: gs.provider,
            status: gs.status,
            videoUrl: gs.videoUrl,
            thumbnailUrl: gs.thumbnailUrl,
            progress: gs.progress ?? 100,
            error: gs.error,
          })),
          finalVideoUrl: videoUrl,
          transitionType,
          status: 'assembled' as const,
        }),
      });

      if (response.ok) {
        const data = await response.json() as { success: boolean; projectId?: string };
        if (data.success && data.projectId && !projectId) {
          setProjectId(data.projectId);
        }
        setSaved(true);
      }
    } catch {
      // Save failure is non-critical — video is still assembled
      console.warn('[StepAssembly] Auto-save failed');
    } finally {
      setIsSaving(false);
    }
  }, [authFetch, projectId, projectName, brief, scenes, avatarId, avatarName, voiceId, voiceName, generatedScenes, transitionType, setProjectId]);

  // Auto-save when finalVideoUrl is first set
  useEffect(() => {
    if (finalVideoUrl && !autoSavedRef.current) {
      autoSavedRef.current = true;
      void saveProject(finalVideoUrl);
    }
  }, [finalVideoUrl, saveProject]);

  // Poll assembly progress while assembling
  useEffect(() => {
    if (!isAssembling) {
      if (progressPollingRef.current) {
        clearInterval(progressPollingRef.current);
        progressPollingRef.current = null;
      }
      setAssemblyProgress(null);
      return;
    }

    const pid = projectId ?? 'local';
    const pollProgress = async () => {
      try {
        const res = await authFetch(`/api/video/assembly-status/${encodeURIComponent(pid)}`);
        if (res.ok) {
          const data = (await res.json()) as {
            success: boolean;
            progress: {
              phase: string;
              phaseLabel: string;
              phaseIndex: number;
              totalPhases: number;
            } | null;
          };
          if (data.progress) {
            setAssemblyProgress(data.progress);
          }
        }
      } catch {
        // Progress polling failures are non-fatal
      }
    };

    // Start polling every 2 seconds
    progressPollingRef.current = setInterval(() => { void pollProgress(); }, 2000);

    return () => {
      if (progressPollingRef.current) {
        clearInterval(progressPollingRef.current);
        progressPollingRef.current = null;
      }
    };
  }, [isAssembling, projectId, authFetch]);

  // Use proxy URL for individual scene playback so expired Hedra CDN URLs are re-resolved.
  // finalVideoUrl (from Firebase Storage after assembly) is permanent and used as-is.
  const activeScene = completedScenes[activeSceneIndex];
  const activeSceneStreamUrl = activeScene?.providerVideoId
    ? `/api/video/stream/${activeScene.providerVideoId}`
    : activeScene?.videoUrl;
  const currentVideoUrl = finalVideoUrl ?? activeSceneStreamUrl;

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Puzzle className="w-5 h-5 text-amber-500" />
            Video Assembly
          </CardTitle>
          <CardDescription>
            {finalVideoUrl
              ? (
                <span className="flex items-center gap-2">
                  Your video is assembled! Preview below.
                  {isSaving && <span className="text-amber-400 text-xs flex items-center gap-1"><Loader2 className="w-3 h-3 animate-spin" />Saving...</span>}
                  {saved && !isSaving && <span className="text-green-400 text-xs flex items-center gap-1"><CheckCircle2 className="w-3 h-3" />Saved to library</span>}
                </span>
              )
              : 'Assemble your generated scenes into a final video.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Video Preview */}
          {currentVideoUrl ? (
            <VideoPlayer
              src={currentVideoUrl}
              className="rounded-lg"
              onEnded={() => {
                if (!finalVideoUrl && activeSceneIndex < completedScenes.length - 1) {
                  setActiveSceneIndex(activeSceneIndex + 1);
                }
              }}
            />
          ) : (
            <div className="aspect-video bg-zinc-800/50 rounded-lg flex items-center justify-center">
              <p className="text-zinc-500">No video to preview</p>
            </div>
          )}

          {/* Assembly Progress */}
          {isAssembling && assemblyProgress && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-amber-400 font-medium flex items-center gap-1.5">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {assemblyProgress.phaseLabel}
                </span>
                <span className="text-zinc-500">
                  Step {assemblyProgress.phaseIndex + 1} of {assemblyProgress.totalPhases}
                </span>
              </div>
              <div className="h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                <div
                  className="h-full bg-amber-500 rounded-full transition-all duration-500"
                  style={{ width: `${((assemblyProgress.phaseIndex + 1) / assemblyProgress.totalPhases) * 100}%` }}
                />
              </div>
            </div>
          )}

          {/* Scene Timeline Strip */}
          {completedScenes.length > 0 && !finalVideoUrl && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {completedScenes.map((scene, index) => (
                <button
                  key={scene.sceneId}
                  onClick={() => setActiveSceneIndex(index)}
                  className={`flex-shrink-0 w-20 h-12 rounded border-2 flex items-center justify-center text-xs font-medium transition-colors ${
                    activeSceneIndex === index
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <Play className="w-3 h-3 mr-1" />
                  Scene {index + 1}
                </button>
              ))}
            </div>
          )}

          {/* Transition Selector */}
          {!finalVideoUrl && (
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Transition Style</label>
              <div className="flex gap-2">
                {TRANSITIONS.map((t) => (
                  <button
                    key={t.value}
                    onClick={() => setTransitionType(t.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                      transitionType === t.value
                        ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                        : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Captions Toggle */}
          {!finalVideoUrl && completedScenes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Captions className="w-4 h-4 text-amber-500" />
                  Auto-Captions
                </label>
                <button
                  onClick={() => setCaptionsEnabled(!captionsEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    captionsEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      captionsEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {captionsEnabled && (
                <div className="pl-6">
                  <p className="text-xs text-zinc-500 mb-2">
                    Captions are generated from Deepgram transcription data — no extra API cost.
                  </p>
                  <div className="flex gap-2">
                    {(Object.keys(CAPTION_STYLE_LABELS) as CaptionStyle[]).map((style) => (
                      <button
                        key={style}
                        onClick={() => setCaptionStyle(style)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                          captionStyle === style
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-400 border border-zinc-700 hover:border-zinc-600'
                        }`}
                      >
                        {CAPTION_STYLE_LABELS[style]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Background Music */}
          {!finalVideoUrl && completedScenes.length > 0 && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-300">
                  <Music className="w-4 h-4 text-amber-500" />
                  Background Music
                </label>
                <button
                  onClick={() => setMusicEnabled(!musicEnabled)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    musicEnabled ? 'bg-amber-500' : 'bg-zinc-700'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      musicEnabled ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
              {musicEnabled && (
                <div className="pl-6 space-y-3">
                  {/* Category filter */}
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setMusicCategoryFilter('all')}
                      className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                        musicCategoryFilter === 'all'
                          ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                          : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                      }`}
                    >
                      All
                    </button>
                    {(Object.keys(MUSIC_CATEGORY_LABELS) as MusicCategory[]).map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setMusicCategoryFilter(cat)}
                        className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                          musicCategoryFilter === cat
                            ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30'
                            : 'bg-zinc-800 text-zinc-500 border border-zinc-700'
                        }`}
                      >
                        {MUSIC_CATEGORY_LABELS[cat]}
                      </button>
                    ))}
                  </div>

                  {/* Track list */}
                  <div className="max-h-40 overflow-y-auto space-y-1">
                    {filteredTracks.map((track: MusicTrack) => (
                      <button
                        key={track.id}
                        onClick={() => setSelectedTrackId(track.id)}
                        className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${
                          selectedTrackId === track.id
                            ? 'bg-amber-500/10 border border-amber-500/30'
                            : 'bg-zinc-800/50 border border-transparent hover:bg-zinc-800'
                        }`}
                      >
                        <Music className="w-3 h-3 text-zinc-500 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-zinc-300 truncate">{track.name}</p>
                          <p className="text-[10px] text-zinc-500 truncate">{track.description}</p>
                        </div>
                        <span className="text-[10px] text-zinc-600 flex-shrink-0">{track.bpm} BPM</span>
                      </button>
                    ))}
                  </div>

                  {/* Volume + duck controls */}
                  {selectedTrack && (
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <Volume2 className="w-3.5 h-3.5 text-zinc-500 flex-shrink-0" />
                        <input
                          type="range"
                          min={0}
                          max={0.5}
                          step={0.01}
                          value={musicVolume}
                          onChange={(e) => setMusicVolume(Number(e.target.value))}
                          className="flex-1 h-1.5 bg-zinc-700 rounded-full appearance-none cursor-pointer accent-amber-500"
                        />
                        <span className="text-[10px] text-zinc-500 w-8 text-right tabular-nums">
                          {Math.round(musicVolume * 100)}%
                        </span>
                      </div>
                      <label className="flex items-center gap-2 text-xs text-zinc-400">
                        <input
                          type="checkbox"
                          checked={autoDuck}
                          onChange={(e) => setAutoDuck(e.target.checked)}
                          className="rounded border-zinc-600 bg-zinc-800 text-amber-500 focus:ring-amber-500/50"
                        />
                        Auto-duck (lower music during speech)
                      </label>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Scene status summary when no completed scenes */}
          {completedScenes.length === 0 && generatedScenes.length > 0 && !finalVideoUrl && (
            <div className="p-3 bg-zinc-800/50 border border-zinc-700 rounded-lg space-y-1">
              <p className="text-sm font-medium text-zinc-300">Scene Status</p>
              {generatedScenes.map((s, i) => (
                <p key={s.sceneId} className="text-xs text-zinc-400">
                  Scene {i + 1}: {s.status}
                  {s.status === 'generating' && ' (waiting for provider...)'}
                  {s.status === 'completed' && !s.videoUrl && ' (no video URL returned)'}
                  {s.status === 'completed' && s.videoUrl && ' ✓'}
                  {s.status === 'failed' && s.error && ` — ${s.error}`}
                </p>
              ))}
              {generatingScenes.length > 0 && (
                <p className="text-xs text-amber-400 flex items-center gap-1 mt-2">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  Polling for {generatingScenes.length} scene(s) still generating...
                </p>
              )}
            </div>
          )}

          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button onClick={() => setStep('generation')} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Generation
        </Button>
        <div className="flex gap-2">
          {!finalVideoUrl && (
            <Button
              onClick={() => { void handleAssemble(); }}
              disabled={isAssembling || completedScenes.length === 0}
              className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            >
              {isAssembling ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  {assemblyProgress ? assemblyProgress.phaseLabel : 'Assembling...'}
                </>
              ) : (
                <><Puzzle className="w-4 h-4" /> Assemble Video</>
              )}
            </Button>
          )}
          {finalVideoUrl && !saved && !isSaving && (
            <Button
              variant="outline"
              onClick={() => { void saveProject(finalVideoUrl); }}
              className="gap-2"
            >
              <Save className="w-4 h-4" />
              Save to Library
            </Button>
          )}
          {finalVideoUrl && (
            <Button
              variant="outline"
              onClick={() => router.push(`/content/video/editor?project=${projectId ?? ''}`)}
              className="gap-2"
            >
              <Film className="w-4 h-4" />
              Edit in Video Editor
            </Button>
          )}
          {finalVideoUrl && (
            <Button
              onClick={() => advanceStep()}
              className="gap-2 bg-green-600 hover:bg-green-700 text-white"
            >
              Continue to Post-Production
              <ArrowRight className="w-4 h-4" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
