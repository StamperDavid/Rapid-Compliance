'use client';

import { useState } from 'react';
import { GripVertical, Trash2, Copy, Image as ImageIcon, ChevronDown, ChevronUp, Eye, Palette } from 'lucide-react';
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
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="p-4 bg-zinc-800/30 rounded-xl border border-zinc-700/50 group space-y-3">
      {/* Header Row */}
      <div className="flex items-start gap-3">
        {/* Drag Handle */}
        <div className="flex-shrink-0 pt-1 cursor-grab opacity-30 group-hover:opacity-60 transition-opacity">
          <GripVertical className="w-5 h-5 text-zinc-400" />
        </div>

        {/* Scene Number Badge */}
        <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold">
          {scene.sceneNumber}
        </div>

        {/* Title Row */}
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={scene.title ?? ''}
            onChange={(e) => onUpdate(scene.id, { title: e.target.value || undefined })}
            placeholder="Scene title (e.g., The Hook, CTA)"
            className="w-full px-2 py-1 bg-transparent border-b border-zinc-700/50 text-sm font-semibold text-amber-400 placeholder-zinc-600 focus:outline-none focus:border-amber-500/50 truncate"
          />
        </div>

        {/* Expand/Collapse */}
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setExpanded(!expanded)}
          className="h-7 w-7 p-0 text-zinc-400 hover:text-white"
          title={expanded ? 'Collapse' : 'Expand details'}
        >
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </Button>
      </div>

      {/* Script Text */}
      <div className="ml-16">
        <textarea
          value={scene.scriptText}
          onChange={(e) => onUpdate(scene.id, { scriptText: e.target.value })}
          placeholder="Enter scene script..."
          className="w-full h-20 px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 resize-none"
        />
      </div>

      {/* Visual Description - always visible when present */}
      {scene.visualDescription && (
        <div className="ml-16 flex gap-2 p-2.5 bg-zinc-900/30 rounded-lg border border-zinc-700/30">
          <Eye className="w-4 h-4 text-sky-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-sky-400/70 font-medium mb-0.5">Visual Direction</p>
            <p className="text-xs text-zinc-300 leading-relaxed">{scene.visualDescription}</p>
          </div>
        </div>
      )}

      {/* Background Prompt - always visible when present */}
      {scene.backgroundPrompt && (
        <div className="ml-16 flex gap-2 p-2.5 bg-zinc-900/30 rounded-lg border border-zinc-700/30">
          <Palette className="w-4 h-4 text-violet-400 flex-shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            <p className="text-[10px] uppercase tracking-wider text-violet-400/70 font-medium mb-0.5">Background Prompt</p>
            <p className="text-xs text-zinc-300 leading-relaxed">{scene.backgroundPrompt}</p>
          </div>
        </div>
      )}

      {/* Expanded Details */}
      {expanded && (
        <div className="ml-16 space-y-3 pt-1">
          {/* Visual Description Edit */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1">
              Visual Direction
            </label>
            <textarea
              value={scene.visualDescription ?? ''}
              onChange={(e) => onUpdate(scene.id, { visualDescription: e.target.value || undefined })}
              placeholder="Describe the visual style: lighting, camera angle, mood, colors, setting..."
              rows={2}
              className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-sky-500/50 resize-none"
            />
          </div>

          {/* Background Prompt Edit */}
          <div>
            <label className="block text-[10px] uppercase tracking-wider text-zinc-500 font-medium mb-1">
              Background Prompt
            </label>
            <textarea
              value={scene.backgroundPrompt ?? ''}
              onChange={(e) => onUpdate(scene.id, { backgroundPrompt: e.target.value || null })}
              placeholder="AI background generation prompt (e.g., Modern office with floor-to-ceiling windows, soft natural light...)"
              rows={2}
              className="w-full px-3 py-2 bg-zinc-900/50 border border-zinc-700 rounded-lg text-xs text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-violet-500/50 resize-none"
            />
          </div>
        </div>
      )}

      {/* Footer Row */}
      <div className="ml-16 flex items-center gap-4">
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
              Add Image
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
  );
}
