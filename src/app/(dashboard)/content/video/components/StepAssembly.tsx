'use client';

import { useState, useMemo } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Puzzle, ArrowLeft, ArrowRight, Loader2, Play } from 'lucide-react';
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
    generatedScenes,
    finalVideoUrl,
    transitionType,
    isAssembling,
    setFinalVideoUrl,
    setTransitionType,
    setIsAssembling,
    setStep,
    advanceStep,
  } = useVideoPipelineStore();

  const [error, setError] = useState<string | null>(null);
  const [activeSceneIndex, setActiveSceneIndex] = useState(0);

  const completedScenes = useMemo(
    () => generatedScenes.filter((s) => s.status === 'completed' && s.videoUrl),
    [generatedScenes],
  );

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
          projectId: 'local',
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
              ? 'Your video is assembled! Preview below.'
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
