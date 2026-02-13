'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import { Zap, ArrowRight, Loader2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SceneProgressCard } from './SceneProgressCard';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import type { SceneGenerationResult } from '@/types/video-pipeline';

export function StepGeneration() {
  const {
    scenes,
    avatarId,
    voiceId,
    brief,
    generatedScenes,
    isGenerating,
    setGeneratedScenes,
    updateGeneratedScene,
    setIsGenerating,
    advanceStep,
  } = useVideoPipelineStore();

  const [error, setError] = useState<string | null>(null);
  const hasStarted = useRef(false);

  const allComplete = generatedScenes.length > 0 &&
    generatedScenes.every((s) => s.status === 'completed' || s.status === 'failed');
  const completedCount = generatedScenes.filter((s) => s.status === 'completed').length;
  const failedCount = generatedScenes.filter((s) => s.status === 'failed').length;
  const overallProgress = generatedScenes.length > 0
    ? Math.round((completedCount / generatedScenes.length) * 100)
    : 0;

  const startGeneration = useCallback(async () => {
    if (isGenerating || hasStarted.current) {
      return;
    }
    hasStarted.current = true;
    setIsGenerating(true);
    setError(null);

    // Initialize scene results
    const initialResults: SceneGenerationResult[] = scenes.map((s) => ({
      sceneId: s.id,
      heygenVideoId: '',
      status: 'generating' as const,
      videoUrl: null,
      thumbnailUrl: null,
      progress: 0,
      error: null,
    }));
    setGeneratedScenes(initialResults);

    try {
      const response = await fetch('/api/video/generate-scenes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'local',
          scenes: scenes.map((s) => ({
            id: s.id,
            sceneNumber: s.sceneNumber,
            scriptText: s.scriptText,
            screenshotUrl: s.screenshotUrl,
            duration: s.duration,
          })),
          avatarId,
          voiceId,
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
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Generation failed');
    } finally {
      setIsGenerating(false);
    }
  }, [scenes, avatarId, voiceId, brief.aspectRatio, isGenerating, setGeneratedScenes, setIsGenerating]);

  // Auto-start generation on mount
  useEffect(() => {
    if (generatedScenes.length === 0 && scenes.length > 0) {
      void startGeneration();
    }
  }, [generatedScenes.length, scenes.length, startGeneration]);

  const handleRetry = async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return;
    }

    updateGeneratedScene(sceneId, { status: 'generating', progress: 0, error: null });

    try {
      const response = await fetch('/api/video/regenerate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'local',
          sceneId,
          scriptText: scene.scriptText,
          screenshotUrl: scene.screenshotUrl,
          avatarId,
          voiceId,
          aspectRatio: brief.aspectRatio,
          duration: scene.duration,
        }),
      });

      if (!response.ok) {
        throw new Error('Retry failed');
      }

      const data = await response.json() as { success: boolean; result: SceneGenerationResult };
      if (data.success && data.result) {
        updateGeneratedScene(sceneId, data.result);
      }
    } catch {
      updateGeneratedScene(sceneId, { status: 'failed', error: 'Retry failed' });
    }
  };

  const handleContinue = () => {
    advanceStep();
  };

  return (
    <div className="space-y-6">
      {/* Overall Progress */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Zap className="w-5 h-5 text-amber-500" />
            Scene Generation
          </CardTitle>
          <CardDescription>
            {allComplete
              ? `All scenes processed. ${completedCount} completed, ${failedCount} failed.`
              : `Generating ${scenes.length} scenes with HeyGen...`}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Overall Progress Bar */}
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-zinc-400">Overall Progress</span>
              <span className="text-white font-medium">{overallProgress}%</span>
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

          {/* Scene Progress Cards */}
          <div className="space-y-2">
            {generatedScenes.map((result, index) => (
              <SceneProgressCard
                key={result.sceneId}
                sceneNumber={index + 1}
                result={result}
                onRetry={(sceneId) => { void handleRetry(sceneId); }}
              />
            ))}
          </div>

          {/* Error */}
          {error && (
            <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg">
              <p className="text-sm text-red-400">{error}</p>
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
        {!allComplete && isGenerating && (
          <div className="flex items-center gap-2 text-zinc-400">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">Generation in progress...</span>
          </div>
        )}
      </div>
    </div>
  );
}
