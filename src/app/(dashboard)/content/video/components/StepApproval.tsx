'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { CheckCircle, ArrowLeft, Zap, DollarSign, AlertTriangle, Edit3 } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';

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
  const estimatedCost = (totalDuration * 0.01).toFixed(2);

  const handleApproveAndGenerate = () => {
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
          <p className="text-xl font-bold text-amber-400">${estimatedCost}</p>
          <p className="text-[10px] text-amber-400/70">HeyGen @ $0.01/sec</p>
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
            Review every scene before generation. Click any script to edit inline. Nothing renders until you approve.
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
              <div className="flex-1 min-w-0 space-y-2">
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
                    {scene.scriptText || <span className="text-zinc-500 italic">No script</span>}
                    <Edit3 className="w-3 h-3 inline ml-2 opacity-0 group-hover:opacity-50" />
                  </p>
                )}

                <div className="flex items-center gap-4 text-xs text-zinc-500">
                  <span>{scene.duration}s</span>
                  {scene.screenshotUrl && <span>Has screenshot</span>}
                  <span>Voice: {voiceName ?? 'Default'}</span>
                </div>
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
            Each scene will be sent to HeyGen for video generation. This will use your HeyGen API credits.
            Estimated cost: ${estimatedCost} for {totalDuration} seconds of video.
          </p>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button onClick={handleBack} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Edit Storyboard
        </Button>
        <Button
          onClick={handleApproveAndGenerate}
          disabled={scenes.length === 0 || !avatarId || !voiceId}
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
