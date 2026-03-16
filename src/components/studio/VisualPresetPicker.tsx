'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { Search, X, Check } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { getPresetsByCategory, getCategoryLabel } from '@/lib/ai/cinematic-presets';
import type { PresetCategory, CinematicPreset } from '@/types/creative-studio';

// ─── Types ─────────────────────────────────────────────────────────

interface VisualPresetPickerProps {
  category: PresetCategory;
  selected?: string | string[];
  onSelect: (presetId: string) => void;
  onMultiSelect?: (presetIds: string[]) => void;
  multiSelect?: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────

/** Hash a string to an HSL hue for deterministic gradient backgrounds. */
function hashToHue(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash % 360);
}

function PresetCard({
  preset,
  isSelected,
  onClick,
  multiSelect,
}: {
  preset: CinematicPreset;
  isSelected: boolean;
  onClick: () => void;
  multiSelect?: boolean;
}) {
  const hue = hashToHue(preset.id);
  const initials = preset.name
    .split(/[\s/]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <motion.button
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-all',
        'hover:border-zinc-500 hover:bg-zinc-800/50',
        isSelected
          ? 'border-indigo-500 bg-indigo-500/10 ring-1 ring-indigo-500/50'
          : 'border-zinc-700 bg-zinc-900',
      )}
      title={preset.promptFragment}
    >
      {/* Thumbnail placeholder */}
      <div
        className="flex h-20 w-full items-center justify-center rounded-md"
        style={{
          background: `linear-gradient(135deg, hsl(${hue}, 50%, 25%), hsl(${(hue + 60) % 360}, 40%, 15%))`,
        }}
      >
        <span className="text-xl font-bold text-white/70">{initials}</span>
      </div>

      {/* Name */}
      <span className="text-center text-xs font-medium text-zinc-300 line-clamp-2">
        {preset.name}
      </span>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-indigo-500">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Multi-select checkbox area */}
      {multiSelect && !isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-zinc-600 bg-zinc-800 opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="sr-only">Select</span>
        </div>
      )}

      {/* Prompt fragment tooltip on hover */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-1 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="mx-1 rounded bg-zinc-800 border border-zinc-600 px-2 py-1 text-[10px] text-zinc-400 shadow-lg">
          {preset.promptFragment}
        </div>
      </div>
    </motion.button>
  );
}

// ─── Main Component ────────────────────────────────────────────────

export function VisualPresetPicker({
  category,
  selected,
  onSelect,
  onMultiSelect,
  multiSelect = false,
  open,
  onOpenChange,
}: VisualPresetPickerProps) {
  const [search, setSearch] = useState('');
  const [localSelection, setLocalSelection] = useState<string[]>(() => {
    if (!selected) {
      return [];
    }
    return Array.isArray(selected) ? selected : [selected];
  });

  const presets = useMemo(() => getPresetsByCategory(category), [category]);
  const categoryLabel = getCategoryLabel(category);

  const filtered = useMemo(() => {
    if (!search.trim()) {
      return presets;
    }
    const q = search.toLowerCase();
    return presets.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.tags.some((t) => t.toLowerCase().includes(q)),
    );
  }, [presets, search]);

  // Sync localSelection when selected prop changes
  React.useEffect(() => {
    if (!selected) {
      setLocalSelection([]);
    } else {
      setLocalSelection(Array.isArray(selected) ? selected : [selected]);
    }
  }, [selected]);

  // Reset search when modal opens
  React.useEffect(() => {
    if (open) {
      setSearch('');
    }
  }, [open]);

  const isSelected = useCallback(
    (presetId: string) => localSelection.includes(presetId),
    [localSelection],
  );

  const handleClick = useCallback(
    (presetId: string) => {
      if (multiSelect) {
        setLocalSelection((prev) =>
          prev.includes(presetId)
            ? prev.filter((id) => id !== presetId)
            : [...prev, presetId],
        );
      } else {
        onSelect(presetId);
        onOpenChange(false);
      }
    },
    [multiSelect, onSelect, onOpenChange],
  );

  const handleApply = useCallback(() => {
    onMultiSelect?.(localSelection);
    onOpenChange(false);
  }, [localSelection, onMultiSelect, onOpenChange]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-4xl max-h-[85vh] flex flex-col',
          'bg-zinc-900 border-zinc-700 text-white',
        )}
      >
        <DialogHeader className="flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-lg font-semibold text-white">
              {categoryLabel}
            </DialogTitle>
          </div>
          {/* Search bar */}
          <div className="relative mt-3">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder={`Search ${categoryLabel.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Preset grid */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-zinc-500">
              <Search className="h-8 w-8 mb-2 opacity-50" />
              <p className="text-sm">No presets match your search</p>
            </div>
          ) : (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-3">
              <AnimatePresence mode="popLayout">
                {filtered.map((preset) => (
                  <PresetCard
                    key={preset.id}
                    preset={preset}
                    isSelected={isSelected(preset.id)}
                    onClick={() => handleClick(preset.id)}
                    multiSelect={multiSelect}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>

        {/* Multi-select footer */}
        {multiSelect && (
          <div className="flex items-center justify-between border-t border-zinc-700 pt-4 mt-4 flex-shrink-0">
            <span className="text-sm text-zinc-400">
              {localSelection.length} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalSelection([])}
                className="text-zinc-400 hover:text-white"
              >
                Clear
              </Button>
              <Button size="sm" onClick={handleApply}>
                Apply
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

VisualPresetPicker.displayName = 'VisualPresetPicker';
