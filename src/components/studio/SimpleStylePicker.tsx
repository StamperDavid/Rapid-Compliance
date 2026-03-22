'use client';

import { useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check } from 'lucide-react';
import {
  getSimpleStyleBundles,
  type SimpleStyleBundle,
} from '@/lib/ai/cinematic-presets';
import type { CinematicConfig } from '@/types/creative-studio';

interface SimpleStylePickerProps {
  config: CinematicConfig;
  onChange: (config: CinematicConfig) => void;
  onSwitchToAdvanced: () => void;
}

/**
 * A grid of 10 visual style cards. Clicking a card fills ALL cinematic
 * config fields at once (shot type, lighting, camera, film stock, etc.).
 * Designed for users who want quick results without understanding
 * cinematography terminology.
 */
export function SimpleStylePicker({
  config,
  onChange,
  onSwitchToAdvanced,
}: SimpleStylePickerProps) {
  const bundles = useMemo(() => getSimpleStyleBundles(), []);

  // Determine which bundle is currently selected (if any) by matching artStyle
  const selectedBundleId = useMemo(() => {
    if (!config.artStyle) { return null; }
    const match = bundles.find((b) => b.config.artStyle === config.artStyle);
    return match?.id ?? null;
  }, [config.artStyle, bundles]);

  const handleSelect = useCallback(
    (bundle: SimpleStyleBundle) => {
      // Apply the bundle's complete config, preserving any user-set aspect ratio
      const merged: CinematicConfig = {
        ...bundle.config,
        // Preserve aspect ratio if user already set one
        aspectRatio: bundle.config.aspectRatio ?? config.aspectRatio,
      };
      onChange(merged);
    },
    [onChange, config.aspectRatio],
  );

  // Deterministic gradient from bundle ID
  function bundleGradient(id: string): string {
    let hash = 0;
    for (let i = 0; i < id.length; i++) {
      hash = id.charCodeAt(i) + ((hash << 5) - hash);
    }
    const h1 = Math.abs(hash) % 360;
    const h2 = (h1 + 40) % 360;
    return `linear-gradient(135deg, hsl(${h1}, 45%, 25%) 0%, hsl(${h2}, 55%, 15%) 100%)`;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-sm font-medium text-zinc-200">Visual Style</h3>
          <p className="text-xs text-zinc-500 mt-0.5">
            Pick a style — all cinematic settings are applied automatically
          </p>
        </div>
        <button
          onClick={onSwitchToAdvanced}
          className="text-xs text-amber-400 hover:text-amber-300 hover:underline transition-colors"
        >
          Advanced Controls
        </button>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2">
        {bundles.map((bundle) => {
          const isSelected = selectedBundleId === bundle.id;
          return (
            <button
              key={bundle.id}
              onClick={() => handleSelect(bundle)}
              className={cn(
                'relative flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-left',
                isSelected
                  ? 'border-amber-500 ring-1 ring-amber-500/30 bg-amber-500/10'
                  : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-500 hover:bg-zinc-800',
              )}
            >
              {/* Thumbnail swatch */}
              <div
                className="w-full h-16 rounded-lg flex items-center justify-center text-2xl"
                style={{ background: bundleGradient(bundle.id) }}
              >
                {bundle.emoji}
              </div>

              <span className="text-xs font-medium text-zinc-200 text-center w-full truncate">
                {bundle.name}
              </span>
              <span className="text-[10px] text-zinc-500 text-center w-full line-clamp-1">
                {bundle.description}
              </span>

              {/* Selected checkmark */}
              {isSelected && (
                <div className="absolute top-1.5 right-1.5 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center">
                  <Check className="w-3 h-3 text-black" />
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
