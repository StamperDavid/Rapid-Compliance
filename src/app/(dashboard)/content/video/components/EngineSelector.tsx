'use client';

import { Video } from 'lucide-react';
import { estimateSceneCost, formatCostUSD } from '@/lib/video/engine-registry';
import type { VideoEngineId } from '@/types/video-pipeline';

interface EngineSelectorProps {
  /** Retained for call-site compatibility — ignored, Hedra is always used */
  value: VideoEngineId | null;
  /** Retained for call-site compatibility — no-op */
  onChange: (engine: VideoEngineId | null) => void;
  durationSeconds: number;
  /** Retained for call-site compatibility — unused */
  providerStatus?: Record<string, { configured: boolean }> | null;
  /** Retained for call-site compatibility — unused */
  isLoadingStatus?: boolean;
}

/**
 * Engine display badge — Hedra is the sole video engine.
 * Previously a multi-engine dropdown; now a read-only label showing Hedra and its cost estimate.
 */
export function EngineSelector({ durationSeconds }: EngineSelectorProps) {
  const cost = estimateSceneCost('hedra', durationSeconds);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 rounded-md border border-border-strong bg-surface-elevated/80 text-xs text-foreground w-fit">
      <Video className="w-3.5 h-3.5 text-primary-light flex-shrink-0" />
      <span>Hedra</span>
      <span className="text-muted-foreground">~{formatCostUSD(cost)}</span>
    </div>
  );
}
