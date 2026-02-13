'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion } from 'framer-motion';
import { Layers, ArrowRight, ArrowLeft, Loader2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import type { DecompositionPlan } from '@/types/video-pipeline';

export function StepDecompose() {
  const {
    brief,
    decompositionPlan,
    setDecompositionPlan,
    setScenes,
    setStep,
    advanceStep,
  } = useVideoPipelineStore();

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasAutoDecomposed = useRef(false);

  const handleDecompose = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch('/api/video/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: brief.description,
          videoType: brief.videoType,
          platform: brief.platform,
          duration: brief.duration,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Failed to decompose video');
      }

      const data = await response.json() as { success: boolean; plan: DecompositionPlan };
      if (!data.success || !data.plan) {
        throw new Error('Invalid response from decompose API');
      }

      setDecompositionPlan(data.plan);

      // Convert plan scenes to PipelineScenes
      const pipelineScenes = data.plan.scenes.map((scene) => ({
        id: crypto.randomUUID(),
        sceneNumber: scene.sceneNumber,
        scriptText: scene.scriptText,
        screenshotUrl: null,
        avatarId: null,
        voiceId: null,
        duration: scene.suggestedDuration,
        engine: null,
        status: 'draft' as const,
      }));
      setScenes(pipelineScenes);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      setError(message);
    } finally {
      setIsLoading(false);
    }
  }, [brief, setDecompositionPlan, setScenes]);

  // Auto-decompose on mount if no plan yet
  useEffect(() => {
    if (!decompositionPlan && !hasAutoDecomposed.current) {
      hasAutoDecomposed.current = true;
      void handleDecompose();
    }
  }, [decompositionPlan, handleDecompose]);

  const handleApprove = () => {
    advanceStep();
  };

  const handleBack = () => {
    setStep('request');
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Layers className="w-5 h-5 text-amber-500" />
            AI Decomposition
          </CardTitle>
          <CardDescription>
            Jasper has analyzed your brief and created a scene-by-scene breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {isLoading && (
            <div className="flex flex-col items-center justify-center py-12 gap-4">
              <Loader2 className="w-8 h-8 text-amber-500 animate-spin" />
              <p className="text-zinc-400">Analyzing your brief and generating scene breakdown...</p>
            </div>
          )}

          {/* Error State */}
          {error && (
            <div className="flex flex-col items-center justify-center py-8 gap-4">
              <AlertCircle className="w-8 h-8 text-red-400" />
              <p className="text-red-400">{error}</p>
              <Button onClick={() => { void handleDecompose(); }} variant="outline" size="sm">
                Try Again
              </Button>
            </div>
          )}

          {/* Plan Display */}
          {decompositionPlan && !isLoading && (
            <div className="space-y-6">
              {/* Summary */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-400">Video Type</p>
                  <p className="text-sm font-medium text-white capitalize">{decompositionPlan.videoType.replace('-', ' ')}</p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-400">Total Scenes</p>
                  <p className="text-sm font-medium text-white">{decompositionPlan.scenes.length}</p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-400">Est. Duration</p>
                  <p className="text-sm font-medium text-white">{decompositionPlan.estimatedTotalDuration}s</p>
                </div>
                <div className="p-3 bg-zinc-800/50 rounded-lg">
                  <p className="text-xs text-zinc-400">Target Audience</p>
                  <p className="text-sm font-medium text-white truncate">{decompositionPlan.targetAudience}</p>
                </div>
              </div>

              {/* Key Messages */}
              {decompositionPlan.keyMessages.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">Key Messages</h3>
                  <div className="flex flex-wrap gap-2">
                    {decompositionPlan.keyMessages.map((msg, i) => (
                      <span key={i} className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs text-amber-400">
                        {msg}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Scene Breakdown */}
              <div>
                <h3 className="text-sm font-medium text-zinc-300 mb-3">Scene Breakdown</h3>
                <div className="space-y-3">
                  {decompositionPlan.scenes.map((scene, index) => (
                    <motion.div
                      key={scene.sceneNumber}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex gap-4 p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50"
                    >
                      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold">
                        {scene.sceneNumber}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-white">{scene.title}</p>
                        <p className="text-xs text-zinc-400 mt-1 line-clamp-2">{scene.scriptText}</p>
                        <p className="text-xs text-zinc-500 mt-1">{scene.visualDescription} · {scene.suggestedDuration}s</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Assets Needed */}
              {decompositionPlan.assetsNeeded.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-zinc-300 mb-2">Assets Needed</h3>
                  <div className="flex flex-wrap gap-2">
                    {decompositionPlan.assetsNeeded.map((asset, i) => (
                      <span key={i} className="px-3 py-1 bg-zinc-800 border border-zinc-700 rounded-full text-xs text-zinc-300">
                        {asset}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button onClick={handleBack} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Brief
        </Button>
        <div className="flex gap-2">
          {decompositionPlan && (
            <Button onClick={() => { void handleDecompose(); }} variant="outline" size="sm" disabled={isLoading}>
              Regenerate Plan
            </Button>
          )}
          <Button
            onClick={handleApprove}
            disabled={!decompositionPlan || isLoading}
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve Plan & Start Pre-Production
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
