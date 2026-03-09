'use client';

import { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Puzzle, ArrowLeft, ArrowRight, Loader2, Play, Save, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VideoPlayer } from './VideoPlayer';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import type { TransitionType } from '@/types/video-pipeline';

const TRANSITIONS: { value: TransitionType; label: string }[] = [
  { value: 'cut', label: 'Cut (Instant)' },
  { value: 'fade', label: 'Fade (Smooth)' },
  { value: 'dissolve', label: 'Dissolve (Gradual)' },
];

export function StepAssembly() {
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
      const sceneUrls = completedScenes
        .map((s) => s.videoUrl)
        .filter((url): url is string => url !== null);

      const response = await authFetch('/api/video/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ?? 'local',
          sceneUrls,
          transitionType,
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

  const currentVideoUrl = finalVideoUrl ?? completedScenes[activeSceneIndex]?.videoUrl;

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
                <><Loader2 className="w-4 h-4 animate-spin" /> Assembling...</>
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
