'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import Image from 'next/image';
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

const PresetCard = React.forwardRef<HTMLButtonElement, {
  preset: CinematicPreset;
  isSelected: boolean;
  onClick: () => void;
  multiSelect?: boolean;
}>(function PresetCard({
  preset,
  isSelected,
  onClick,
  multiSelect,
}, ref) {
  const initials = preset.name
    .split(/[\s/]+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <motion.button
      ref={ref}
      type="button"
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className={cn(
        'group relative flex flex-col items-center gap-2 rounded-lg border p-3 transition-all',
        'hover:border-border hover:bg-surface-elevated/50',
        isSelected
          ? 'border-primary bg-primary/10 ring-1 ring-primary/50'
          : 'border-border-strong bg-card',
      )}
      title={preset.promptFragment}
    >
      {/* Example image when available, otherwise initials */}
      <div className="relative flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-surface-elevated border border-border-strong">
        {preset.thumbnail ? (
          <Image src={preset.thumbnail} alt={preset.name} fill unoptimized className="object-cover" />
        ) : (
          <span className="text-xl font-bold text-muted-foreground">{initials}</span>
        )}
      </div>

      {/* Name */}
      <span className="text-center text-xs font-medium text-foreground line-clamp-2">
        {preset.name}
      </span>

      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary">
          <Check className="h-3 w-3 text-white" />
        </div>
      )}

      {/* Multi-select checkbox area */}
      {multiSelect && !isSelected && (
        <div className="absolute right-1.5 top-1.5 flex h-5 w-5 items-center justify-center rounded-full border border-border bg-surface-elevated opacity-0 group-hover:opacity-100 transition-opacity">
          <span className="sr-only">Select</span>
        </div>
      )}

      {/* Prompt fragment tooltip on hover */}
      <div className="pointer-events-none absolute inset-x-0 -bottom-1 translate-y-full opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <div className="mx-1 rounded bg-surface-elevated border border-border px-2 py-1 text-[10px] text-muted-foreground shadow-lg">
          {preset.promptFragment}
        </div>
      </div>
    </motion.button>
  );
});

PresetCard.displayName = 'PresetCard';

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
          'bg-card border-border-strong text-white',
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
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder={`Search ${categoryLabel.toLowerCase()}...`}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9 bg-surface-elevated border-border-strong text-white placeholder:text-muted-foreground"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </div>
        </DialogHeader>

        {/* Preset grid */}
        <div className="flex-1 overflow-y-auto mt-4 pr-1">
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
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
          <div className="flex items-center justify-between border-t border-border-strong pt-4 mt-4 flex-shrink-0">
            <span className="text-sm text-muted-foreground">
              {localSelection.length} selected
            </span>
            <div className="flex gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setLocalSelection([])}
                className="text-muted-foreground hover:text-white"
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
