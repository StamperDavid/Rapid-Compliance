'use client';

import { useState, useRef, useEffect } from 'react';
import { Lock, Clock, ChevronDown, User, Film, Sparkles, Video, Clapperboard } from 'lucide-react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import {
  VIDEO_ENGINE_REGISTRY,
  ENGINE_ORDER,
  estimateSceneCost,
  formatCostUSD,
} from '@/lib/video/engine-registry';
import type { VideoEngineId } from '@/types/video-pipeline';

const ENGINE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  User,
  Film,
  Sparkles,
  Video,
  Clapperboard,
};

interface ProviderStatusEntry {
  configured: boolean;
}

interface EngineSelectorProps {
  value: VideoEngineId | null;
  onChange: (engine: VideoEngineId | null) => void;
  durationSeconds: number;
  providerStatus: Record<VideoEngineId, ProviderStatusEntry> | null;
  isLoadingStatus: boolean;
}

export function EngineSelector({
  value,
  onChange,
  durationSeconds,
  providerStatus,
  isLoadingStatus,
}: EngineSelectorProps) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const selectedEngineId = value ?? 'heygen';
  const selectedEngine = VIDEO_ENGINE_REGISTRY[selectedEngineId];
  const SelectedIcon = ENGINE_ICONS[selectedEngine.icon] ?? Video;

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
      return () => document.removeEventListener('mousedown', handleClickOutside);
    }
  }, [open]);

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-zinc-700 bg-zinc-800/80 hover:bg-zinc-700/80 transition-colors text-xs text-zinc-200"
      >
        <SelectedIcon className="w-3.5 h-3.5 text-amber-400" />
        <span>{selectedEngine.label}</span>
        <span className="text-zinc-500">
          ~{formatCostUSD(estimateSceneCost(selectedEngineId, durationSeconds))}
        </span>
        <ChevronDown className={cn('w-3 h-3 text-zinc-500 transition-transform', open && 'rotate-180')} />
      </button>

      {/* Dropdown */}
      {open && (
        <div className="absolute z-50 mt-1 w-72 rounded-lg border border-zinc-700 bg-zinc-900 shadow-xl overflow-hidden">
          {ENGINE_ORDER.map((engineId) => {
            const engine = VIDEO_ENGINE_REGISTRY[engineId];
            const Icon = ENGINE_ICONS[engine.icon] ?? Video;
            const isComingSoon = engine.integrationStatus === 'coming-soon';
            const isConfigured = providerStatus?.[engineId]?.configured ?? false;
            const needsKey = !isComingSoon && !isConfigured && !isLoadingStatus;
            const isDisabled = isComingSoon || needsKey;
            const isSelected = engineId === selectedEngineId;
            const cost = estimateSceneCost(engineId, durationSeconds);

            return (
              <div
                key={engineId}
                className={cn(
                  'px-3 py-2.5 border-b border-zinc-800 last:border-b-0 transition-colors',
                  isDisabled
                    ? 'opacity-50 cursor-default'
                    : 'cursor-pointer hover:bg-zinc-800/80',
                  isSelected && !isDisabled && 'bg-amber-500/10'
                )}
                onClick={() => {
                  if (!isDisabled) {
                    onChange(engineId === 'heygen' ? null : engineId);
                    setOpen(false);
                  }
                }}
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('w-4 h-4 flex-shrink-0', isSelected ? 'text-amber-400' : 'text-zinc-400')} />
                  <span className={cn('text-sm font-medium', isSelected ? 'text-white' : 'text-zinc-200')}>
                    {engine.label}
                  </span>

                  {/* Badges */}
                  {isComingSoon && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-zinc-700 text-zinc-400">
                      <Clock className="w-2.5 h-2.5" />
                      Coming Soon
                    </span>
                  )}
                  {needsKey && (
                    <span className="ml-auto flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded-full bg-red-500/10 text-red-400">
                      <Lock className="w-2.5 h-2.5" />
                      API key required
                    </span>
                  )}
                  {!isDisabled && (
                    <span className="ml-auto text-xs text-zinc-500">
                      ~{formatCostUSD(cost)}
                    </span>
                  )}
                </div>

                <p className="text-[11px] text-zinc-500 mt-0.5 ml-6">
                  {engine.description}
                </p>

                {/* CTA for missing API key */}
                {needsKey && (
                  <Link
                    href="/settings/api-keys"
                    className="ml-6 mt-1 inline-block text-[11px] text-amber-400 hover:text-amber-300 underline underline-offset-2"
                    onClick={(e) => e.stopPropagation()}
                  >
                    Set up in Settings
                  </Link>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
