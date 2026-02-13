'use client';

import { GripVertical, Trash2, Copy, Image as ImageIcon } from 'lucide-react';
import Image from 'next/image';
import { Button } from '@/components/ui/button';
import type { PipelineScene } from '@/types/video-pipeline';

interface SceneEditorProps {
  scene: PipelineScene;
  onUpdate: (sceneId: string, updates: Partial<PipelineScene>) => void;
  onDelete: (sceneId: string) => void;
  onDuplicate: (scene: PipelineScene) => void;
}

export function SceneEditor({ scene, onUpdate, onDelete, onDuplicate }: SceneEditorProps) {
  return (
    <div className="flex gap-3 p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50 group">
      {/* Drag Handle */}
      <div className="flex-shrink-0 pt-1 cursor-grab opacity-30 group-hover:opacity-60 transition-opacity">
        <GripVertical className="w-5 h-5 text-zinc-400" />
      </div>

      {/* Scene Number Badge */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold">
        {scene.sceneNumber}
      </div>

      {/* Content */}
      <div className="flex-1 space-y-3">
        {/* Script */}
        <textarea
          value={scene.scriptText}
          onChange={(e) => onUpdate(scene.id, { scriptText: e.target.value })}
          placeholder="Enter scene script..."
          className="w-full h-24 px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
        />

        <div className="flex items-center gap-4">
          {/* Screenshot */}
          <div className="flex items-center gap-2">
            {scene.screenshotUrl ? (
              <div className="relative w-16 h-10 rounded overflow-hidden border border-zinc-600">
                <Image src={scene.screenshotUrl} alt="Screenshot" fill className="object-cover" />
                <button
                  onClick={() => onUpdate(scene.id, { screenshotUrl: null })}
                  className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center"
                >
                  <span className="text-[8px] text-white">✕</span>
                </button>
              </div>
            ) : (
              <label className="flex items-center gap-1.5 px-3 py-1.5 bg-zinc-800 border border-zinc-700 rounded-lg text-xs text-zinc-400 cursor-pointer hover:border-zinc-600 transition-colors">
                <ImageIcon className="w-3.5 h-3.5" />
                Add Screenshot
                <input
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const url = URL.createObjectURL(file);
                      onUpdate(scene.id, { screenshotUrl: url });
                    }
                  }}
                />
              </label>
            )}
          </div>

          {/* Duration */}
          <div className="flex items-center gap-2">
            <label className="text-xs text-zinc-400">Duration:</label>
            <input
              type="number"
              value={scene.duration}
              onChange={(e) => onUpdate(scene.id, { duration: Number(e.target.value) || 10 })}
              min={5}
              max={120}
              className="w-16 px-2 py-1 bg-zinc-900/50 border border-zinc-700 rounded text-xs text-white text-center focus:outline-none focus:ring-1 focus:ring-amber-500/50"
            />
            <span className="text-xs text-zinc-500">sec</span>
          </div>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Actions */}
          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDuplicate(scene)}
              className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
              title="Duplicate scene"
            >
              <Copy className="w-3.5 h-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => onDelete(scene.id)}
              className="h-7 w-7 p-0 text-zinc-400 hover:text-red-400"
              title="Delete scene"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
