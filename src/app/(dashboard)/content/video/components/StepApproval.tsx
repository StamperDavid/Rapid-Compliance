'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowLeft, Zap, DollarSign, AlertTriangle, Edit3, Eye, Palette, Video } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { estimateSceneCost, formatCostUSD } from '@/lib/video/engine-registry';

export function StepApproval() {
  const {
    scenes,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
    setStep,
    advanceStep,
    updateScene,
  } = useVideoPipelineStore();

  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);

  // Cost calculation — all scenes use Hedra
  const totalCostCents = scenes.reduce(
    (sum, s) => sum + estimateSceneCost(s.engine, s.duration),
    0,
  );
  const estimatedCost = formatCostUSD(totalCostCents);

  const missingRequirements: string[] = [];
  if (!avatarId) { missingRequirements.push('avatar'); }
  if (!voiceId) { missingRequirements.push('voice'); }
  if (scenes.length === 0) { missingRequirements.push('scenes'); }

  const handleApproveAndGenerate = () => {
    if (missingRequirements.length > 0) {
      return;
    }
    advanceStep();
  };

  const handleBack = () => {
    setStep('pre-production');
  };

  return (
    <div className="space-y-6">
      {/* Cost + Summary Banner */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
          <p className="text-xs text-zinc-400">Scenes</p>
          <p className="text-xl font-bold text-white">{scenes.length}</p>
        </div>
        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
          <p className="text-xs text-zinc-400">Total Duration</p>
          <p className="text-xl font-bold text-white">{totalDuration}s</p>
        </div>
        <div className="p-4 bg-zinc-800/50 rounded-lg border border-zinc-700/50">
          <p className="text-xs text-zinc-400">Avatar</p>
          <p className="text-sm font-medium text-white truncate">{avatarName ?? 'Not selected'}</p>
        </div>
        <div className="p-4 bg-amber-500/10 rounded-lg border border-amber-500/30">
          <p className="text-xs text-amber-400 flex items-center gap-1"><DollarSign className="w-3 h-3" />Estimated Cost</p>
          <p className="text-xl font-bold text-amber-400">{estimatedCost}</p>
          <p className="text-[10px] text-amber-400/70">via Hedra</p>
        </div>
      </div>

      {/* Storyboard Review */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <CheckCircle className="w-5 h-5 text-amber-500" />
            Storyboard Review
          </CardTitle>
          <CardDescription>
            Review every scene before generation. Click any script to edit inline.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {scenes.map((scene, index) => (
            <motion.div
              key={scene.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              className="flex gap-4 p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50"
            >
              {/* Scene Number */}
              <div className="flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 font-bold">
                {scene.sceneNumber}
              </div>

              {/* Content */}
              <div className="flex-1 min-w-0 space-y-2.5">
                {/* Title + Duration Row */}
                <div className="flex items-center gap-2">
                  {scene.title && (
                    <p className="text-sm font-semibold text-amber-400">{scene.title}</p>
                  )}
                  <span className="text-xs text-zinc-500">{scene.duration}s</span>
                  <span className="text-xs text-zinc-600">·</span>
                  <span className="text-xs text-zinc-500">Voice: {voiceName ?? 'Default'}</span>
                  <span className="text-xs text-zinc-600">·</span>
                  {/* Static engine label — Hedra is the sole engine */}
                  <span className="flex items-center gap-1 text-xs text-zinc-500">
                    <Video className="w-3 h-3" />
                    Hedra
                  </span>
                </div>

                {/* Script Text */}
                {editingSceneId === scene.id ? (
                  <textarea
                    value={scene.scriptText}
                    onChange={(e) => updateScene(scene.id, { scriptText: e.target.value })}
                    onBlur={() => setEditingSceneId(null)}
                    autoFocus
                    className="w-full h-20 px-3 py-2 bg-zinc-900 border border-amber-500/50 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
                  />
                ) : (
                  <p
                    className="text-sm text-zinc-200 cursor-pointer hover:text-white transition-colors group"
                    onClick={() => setEditingSceneId(scene.id)}
                  >
                    {scene.scriptText || <span className="text-zinc-500 italic">B-roll (no script)</span>}
                    <Edit3 className="w-3 h-3 inline ml-2 opacity-0 group-hover:opacity-50" />
                  </p>
                )}

                {/* Visual Direction */}
                {scene.visualDescription && (
                  <div className="flex gap-2 p-2.5 bg-sky-500/5 rounded-lg border border-sky-500/10">
                    <Eye className="w-3.5 h-3.5 text-sky-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-sky-400/70 font-medium mb-0.5">Visual Direction</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{scene.visualDescription}</p>
                    </div>
                  </div>
                )}

                {/* Background Prompt */}
                {scene.backgroundPrompt && (
                  <div className="flex gap-2 p-2.5 bg-violet-500/5 rounded-lg border border-violet-500/10">
                    <Palette className="w-3.5 h-3.5 text-violet-400 flex-shrink-0 mt-0.5" />
                    <div className="min-w-0">
                      <p className="text-[10px] uppercase tracking-wider text-violet-400/70 font-medium mb-0.5">Background Prompt</p>
                      <p className="text-xs text-zinc-300 leading-relaxed">{scene.backgroundPrompt}</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Screenshot Thumbnail */}
              {scene.screenshotUrl && (
                <div className="relative flex-shrink-0 w-20 h-14 rounded overflow-hidden border border-zinc-700">
                  <Image src={scene.screenshotUrl} alt="" fill className="object-cover" />
                </div>
              )}
            </motion.div>
          ))}
        </CardContent>
      </Card>

      {/* Warning */}
      <div className="flex items-start gap-3 p-4 bg-amber-500/5 border border-amber-500/20 rounded-lg">
        <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-amber-400">Ready to generate?</p>
          <p className="text-xs text-zinc-400 mt-1">
            {scenes.length} scene{scenes.length !== 1 ? 's' : ''} will be generated via Hedra.
            This will use your Hedra API credits.
            Estimated cost: {estimatedCost} for {totalDuration} seconds of video.
          </p>
        </div>
      </div>

      {/* Missing Requirements */}
      {missingRequirements.length > 0 && (
        <div className="flex items-start gap-3 p-4 bg-red-500/5 border border-red-500/20 rounded-lg">
          <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-red-400">Before you can generate</p>
            <p className="text-xs text-zinc-400 mt-1">
              Go back to Pre-Production and select {missingRequirements.join(' and ')}.
            </p>
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-between">
        <Button onClick={handleBack} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Edit Storyboard
        </Button>
        <Button
          onClick={handleApproveAndGenerate}
          disabled={missingRequirements.length > 0}
          className="gap-2 bg-green-600 hover:bg-green-700 text-white"
          size="lg"
        >
          <Zap className="w-4 h-4" />
          Approve & Generate
        </Button>
      </div>
    </div>
  );
}
