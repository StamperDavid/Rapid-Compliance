'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Loader2, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SceneProgressCard } from './SceneProgressCard';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import type { SceneGenerationResult } from '@/types/video-pipeline';

type GenerationPhase = 'submitting' | 'rendering' | 'complete';

function formatElapsed(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) { return `${secs}s`; }
  return `${mins}m ${secs}s`;
}

export function StepGeneration() {
  const authFetch = useAuthFetch();
  const {
    scenes,
    avatarId,
    voiceId,
    voiceProvider,
    brief,
    generatedScenes,
    isGenerating,
    setGeneratedScenes,
    updateGeneratedScene,
    setIsGenerating,
    advanceStep,
  } = useVideoPipelineStore();

  const [error, setError] = useState<string | null>(null);
  const [pollError, setPollError] = useState<string | null>(null);
  const [phase, setPhase] = useState<GenerationPhase>('submitting');
  const [elapsed, setElapsed] = useState(0);
  const [pollCount, setPollCount] = useState(0);
  const hasStarted = useRef(false);
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(Date.now());

  const allComplete = generatedScenes.length > 0 &&
    generatedScenes.every((s) => s.status === 'completed' || s.status === 'failed');
  const completedCount = generatedScenes.filter((s) => s.status === 'completed').length;
  const failedCount = generatedScenes.filter((s) => s.status === 'failed').length;
  const generatingCount = generatedScenes.filter((s) => s.status === 'generating').length;
  // Average progress across all scenes (each scene reports 0-100)
  const overallProgress = generatedScenes.length > 0
    ? Math.round(generatedScenes.reduce((sum, s) => sum + (s.progress ?? 0), 0) / generatedScenes.length)
    : 0;

  const engineList = 'Hedra';

  // Elapsed time timer
  useEffect(() => {
    if (allComplete) {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
      setPhase('complete');
      return;
    }

    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
    }, 1000);

    return () => {
      if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [allComplete]);

  const startGeneration = useCallback(async () => {
    if (isGenerating || hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    setIsGenerating(true);
    setError(null);
    setPhase('submitting');
    startTimeRef.current = Date.now();

    // Initialize scene results
    const initialResults: SceneGenerationResult[] = scenes.map((s) => ({
      sceneId: s.id,
      providerVideoId: '',
      provider: s.engine,
      status: 'generating' as const,
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: null,
    }));
    setGeneratedScenes(initialResults);

    try {
      const response = await authFetch('/api/video/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'local',
          scenes: scenes.map((s) => ({
            id: s.id,
            sceneNumber: s.sceneNumber,
            scriptText: s.scriptText,
            screenshotUrl: s.screenshotUrl ?? null,
            duration: s.duration,
            engine: s.engine ?? null,
            backgroundPrompt: s.backgroundPrompt ?? null,
            visualDescription: s.visualDescription ?? null,
            title: s.title ?? null,
            // Per-scene character overrides (null = use project defaults)
            avatarId: s.avatarId ?? null,
            voiceId: s.voiceId ?? null,
            voiceProvider: s.voiceProvider ?? null,
          })),
          avatarId: avatarId ?? '',
          voiceId: voiceId ?? '',
          voiceProvider: voiceProvider ?? 'elevenlabs',
          aspectRatio: brief.aspectRatio,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Generation failed');
      }

      const data = await response.json() as {
        success: boolean;
        results: SceneGenerationResult[];
      };

      if (data.success && data.results) {
        setGeneratedScenes(data.results);
        setPhase('rendering');

        // Log which scenes have provider IDs for debugging
        const withIds = data.results.filter((r) => r.providerVideoId);
        const withoutIds = data.results.filter((r) => !r.providerVideoId);
        if (withoutIds.length > 0) {
          console.warn(`[VideoGen] ${withoutIds.length} scene(s) have no providerVideoId — polling won't track them:`,
            withoutIds.map((r) => ({ sceneId: r.sceneId, status: r.status, provider: r.provider })));
        }
        if (withIds.length > 0) {
          console.info(`[VideoGen] ${withIds.length} scene(s) submitted to providers — starting poll cycle`);
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [scenes, avatarId, voiceId, voiceProvider, brief.aspectRatio, isGenerating, setGeneratedScenes, setIsGenerating, authFetch]);

  // Auto-start generation on mount
  useEffect(() => {
    if (generatedScenes.length === 0 && scenes.length > 0) {
      void startGeneration();
    } else if (generatedScenes.some((s) => s.status === 'generating' && s.providerVideoId)) {
      // Resuming — scenes already have providerVideoIds, go straight to rendering phase
      setPhase('rendering');
    }
  }, [generatedScenes.length, scenes.length, startGeneration, generatedScenes]);

  // Poll for scene status updates every 5 seconds
  useEffect(() => {
    // Clean up any existing interval
    if (pollingRef.current) {
      clearInterval(pollingRef.current);
      pollingRef.current = null;
    }

    // Poll scenes that are still generating
    const generatingScenes = generatedScenes.filter(
      (s) => s.status === 'generating' && s.providerVideoId,
    );
    if (generatingScenes.length === 0) {
      return;
    }

    const pollStatus = async () => {
      try {
        const response = await authFetch('/api/video/poll-scenes', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            projectId: 'local',
            scenes: generatingScenes.map((s) => ({
              sceneId: s.sceneId,
              providerVideoId: s.providerVideoId,
              provider: s.provider,
            })),
          }),
        });

        if (!response.ok) {
          const errorText = await response.text();
          console.warn(`[VideoGen] Poll failed (${response.status}):`, errorText);
          setPollError(`Poll error ${response.status}`);
          return;
        }

        setPollError(null);
        setPollCount((c) => c + 1);

        const data = await response.json() as {
          success: boolean;
          results: Array<{
            sceneId: string;
            status: 'generating' | 'completed' | 'failed';
            videoUrl: string | null;
            thumbnailUrl: string | null;
            error: string | null;
            progress?: number;
          }>;
        };

        if (data.success && data.results) {
          for (const result of data.results) {
            const statusLabel = `${result.status} ${result.progress ?? 0}%`;
            console.info(`[VideoGen] Scene ${result.sceneId.slice(0, 8)}... → ${statusLabel}`);

            const updates: Partial<SceneGenerationResult> = {
              status: result.status,
              videoUrl: result.videoUrl,
              thumbnailUrl: result.thumbnailUrl,
              error: result.error ?? null,
              progress: result.progress ?? (result.status === 'completed' ? 100 : 0),
            };

            updateGeneratedScene(result.sceneId, updates);
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Poll error';
        console.warn('[VideoGen] Poll exception:', msg);
        setPollError(msg);
      }
    };

    // Poll immediately, then every 5 seconds
    void pollStatus();
    pollingRef.current = setInterval(() => { void pollStatus(); }, 5000);

    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [generatedScenes, authFetch, updateGeneratedScene]);

  const regenerateScene = useCallback(async (sceneId: string, feedbackText?: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return;
    }

    updateGeneratedScene(sceneId, { status: 'generating', progress: 0, error: null });

    // If user provided feedback, append it to the visual description so the
    // prompt translator and Hedra get the corrected direction
    let visualDescription = scene.visualDescription ?? null;
    if (feedbackText) {
      visualDescription = visualDescription
        ? `${visualDescription}. REVISION DIRECTION: ${feedbackText}`
        : `REVISION DIRECTION: ${feedbackText}`;
    }

    try {
      const response = await authFetch('/api/video/regenerate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'local',
          sceneId,
          scriptText: scene.scriptText,
          screenshotUrl: scene.screenshotUrl,
          avatarId: scene.avatarId ?? avatarId ?? '',
          voiceId: scene.voiceId ?? voiceId ?? '',
          voiceProvider: scene.voiceProvider ?? voiceProvider ?? 'elevenlabs',
          aspectRatio: brief.aspectRatio,
          duration: scene.duration,
          engine: scene.engine,
          backgroundPrompt: scene.backgroundPrompt ?? null,
          visualDescription,
          title: scene.title ?? null,
        }),
      });

      if (!response.ok) {
        throw new Error('Regeneration failed');
      }

      const data = await response.json() as { success: boolean; result: SceneGenerationResult };
      if (data.success && data.result) {
        updateGeneratedScene(sceneId, data.result);
      }
    } catch {
      updateGeneratedScene(sceneId, { status: 'failed', error: 'Regeneration failed' });
    }
  }, [scenes, avatarId, voiceId, voiceProvider, brief.aspectRatio, authFetch, updateGeneratedScene]);

  const handleRetry = useCallback((sceneId: string) => {
    void regenerateScene(sceneId);
  }, [regenerateScene]);

  const handleRegenerate = useCallback((sceneId: string, feedback: string) => {
    // Record the feedback as a style correction in brand preference memory
    void authFetch('/api/video/brand-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'style_correction',
        promptPattern: scenes.find((s) => s.id === sceneId)?.visualDescription ?? '',
        feedback,
        sceneType: brief.videoType,
        sourceSceneId: sceneId,
      }),
    }).catch(() => { /* non-critical */ });

    void regenerateScene(sceneId, feedback);
  }, [regenerateScene, authFetch, scenes, brief.videoType]);

  const handleApprove = useCallback((sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene?.visualDescription) { return; }

    // Record approved prompt pattern in brand preference memory
    void authFetch('/api/video/brand-preferences', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        category: 'approved_prompt',
        promptPattern: scene.visualDescription,
        sceneType: brief.videoType,
        sourceSceneId: sceneId,
      }),
    }).catch(() => { /* non-critical */ });
  }, [authFetch, scenes, brief.videoType]);

  const handleContinue = () => {
    advanceStep();
  };

  // Phase description
  const phaseDescription = (() => {
    if (allComplete) {
      return `All scenes processed. ${completedCount} completed${failedCount > 0 ? `, ${failedCount} failed` : ''}.`;
    }
    if (phase === 'submitting') {
      return `Submitting ${scenes.length} scene${scenes.length !== 1 ? 's' : ''} to ${engineList}...`;
    }
    return `Rendering ${generatingCount} scene${generatingCount !== 1 ? 's' : ''} with ${engineList}. ${completedCount} of ${generatedScenes.length} done.`;
  })();

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Zap className="w-5 h-5 text-amber-500" />
            Scene Generation
          </CardTitle>
          <CardDescription>{phaseDescription}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Overall Progress</span>
              <div className="flex items-center gap-3">
                {!allComplete && (
                  <span className="text-xs text-zinc-500 flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    {formatElapsed(elapsed)}
                  </span>
                )}
                <span className="text-white font-medium">{overallProgress}%</span>
              </div>
            </div>
            <div className="w-full h-2 bg-zinc-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-amber-500 to-green-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${overallProgress}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Phase Indicator */}
          {!allComplete && (
            <div className="flex items-center gap-3 px-3 py-2 bg-zinc-800/50 rounded-lg text-xs">
              <Loader2 className="w-3.5 h-3.5 animate-spin text-amber-400 flex-shrink-0" />
              {phase === 'submitting' ? (
                <span className="text-zinc-400">
                  Submitting scenes to video providers... This usually takes 10-30 seconds.
                </span>
              ) : (
                <span className="text-zinc-400">
                  Waiting for Hedra to render videos. Generation typically takes 2-5 minutes per scene.
                  {pollCount > 0 && (
                    <span className="text-zinc-600"> (poll #{pollCount})</span>
                  )}
                </span>
              )}
            </div>
          )}

          {/* Scene Progress Cards */}
          <div className="space-y-2">
            {generatedScenes.map((result, index) => (
              <SceneProgressCard
                key={result.sceneId}
                sceneNumber={index + 1}
                result={result}
                onRetry={handleRetry}
                onRegenerate={handleRegenerate}
                onApprove={handleApprove}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
            </div>
          )}

          {/* Poll Error Warning */}
          {pollError && !error && (
            <div className="flex items-start gap-2 p-3 bg-amber-500/5 border border-amber-500/20 rounded-lg">
              <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs text-amber-400 font-medium">Polling issue</p>
                <p className="text-xs text-zinc-400 mt-0.5">{pollError}. Will retry automatically.</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-end">
        {allComplete && completedCount > 0 && (
          <Button
            onClick={handleContinue}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4" />
            Continue to Assembly
            <ArrowRight className="w-4 h-4" />
          </Button>
        )}
        {!allComplete && phase === 'submitting' && (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Submitting to providers...</span>
          </div>
        )}
        {!allComplete && phase === 'rendering' && (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Rendering {generatingCount} scene{generatingCount !== 1 ? 's' : ''}...</span>
          </div>
        )}
      </div>
    </div>
  );
}
