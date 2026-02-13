'use client';

import { Loader2, CheckCircle2, XCircle, RefreshCw, Play } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { VIDEO_ENGINE_REGISTRY } from '@/lib/video/engine-registry';
import type { SceneGenerationResult } from '@/types/video-pipeline';

interface SceneProgressCardProps {
  sceneNumber: number;
  result: SceneGenerationResult;
  onRetry?: (sceneId: string) => void;
}

export function SceneProgressCard({ sceneNumber, result, onRetry }: SceneProgressCardProps) {
  const statusConfig = {
    draft: { icon: Loader2, color: 'text-zinc-400', bg: 'bg-zinc-800/50', label: 'Pending' },
    approved: { icon: Loader2, color: 'text-zinc-400', bg: 'bg-zinc-800/50', label: 'Queued' },
    generating: { icon: Loader2, color: 'text-amber-400', bg: 'bg-amber-500/10', label: 'Generating' },
    completed: { icon: CheckCircle2, color: 'text-green-400', bg: 'bg-green-500/10', label: 'Complete' },
    failed: { icon: XCircle, color: 'text-red-400', bg: 'bg-red-500/10', label: 'Failed' },
  };

  const config = statusConfig[result.status];
  const Icon = config.icon;
  const isAnimating = result.status === 'generating';

  return (
    <div className={cn('flex items-center gap-4 p-4 rounded-lg border border-zinc-700/50', config.bg)}>
      {/* Scene Number */}
      <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-zinc-700/50 text-zinc-300 text-sm font-bold">
        {sceneNumber}
      </div>

      {/* Status Icon */}
      <Icon className={cn('w-5 h-5 flex-shrink-0', config.color, isAnimating && 'animate-spin')} />

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className={cn('text-sm font-medium', config.color)}>{config.label}</span>
          <span className="text-xs text-zinc-600">
            {VIDEO_ENGINE_REGISTRY[result.provider ?? 'heygen'].label}
          </span>
        </div>

        {/* Progress Bar */}
        {result.status === 'generating' && (
          <div className="mt-2 w-full h-1.5 bg-zinc-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all duration-500"
              style={{ width: `${result.progress}%` }}
            />
          </div>
        )}

        {/* Error Message */}
        {result.status === 'failed' && result.error && (
          <p className="text-xs text-red-400 mt-1 truncate">{result.error}</p>
        )}
      </div>

      {/* Video Preview or Retry */}
      {result.status === 'completed' && result.videoUrl && (
        <a
          href={result.videoUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex-shrink-0"
        >
          <Button variant="ghost" size="sm" className="h-8 gap-1 text-green-400 hover:text-green-300">
            <Play className="w-3.5 h-3.5" />
            Preview
          </Button>
        </a>
      )}

      {result.status === 'failed' && onRetry && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => onRetry(result.sceneId)}
          className="h-8 gap-1 text-amber-400 hover:text-amber-300 flex-shrink-0"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Retry
        </Button>
      )}
    </div>
  );
}
