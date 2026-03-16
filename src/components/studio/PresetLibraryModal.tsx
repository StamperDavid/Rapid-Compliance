'use client';

import React, { useState, useCallback, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Loader2, Trash2, Play, Search, Save, Sparkles, FolderOpen, X } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { CinematicConfig, CustomPreset } from '@/types/creative-studio';

// ─── Types ─────────────────────────────────────────────────────────

interface PresetLibraryModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Current cinematic config to offer saving */
  currentConfig: CinematicConfig;
  /** Called when user loads a preset */
  onLoadPreset: (config: CinematicConfig) => void;
}

// ─── Main Component ────────────────────────────────────────────────

export function PresetLibraryModal({
  open,
  onOpenChange,
  currentConfig,
  onLoadPreset,
}: PresetLibraryModalProps) {
  const authFetch = useAuthFetch();

  const [presets, setPresets] = useState<CustomPreset[]>([]);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveName, setSaveName] = useState('');
  const [search, setSearch] = useState('');
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Fetch presets when modal opens
  const fetchPresets = useCallback(async () => {
    setLoading(true);
    try {
      const response = await authFetch('/api/studio/presets?custom=true');
      const data = await response.json() as {
        success: boolean;
        data?: { custom: CustomPreset[] };
      };
      if (data.success && data.data) {
        setPresets(data.data.custom);
      }
    } catch {
      // Silently fail
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    if (open) {
      void fetchPresets();
      setSaveName('');
      setSearch('');
    }
  }, [open, fetchPresets]);

  // Check if config has any meaningful presets set
  const hasPresets = Object.entries(currentConfig).some(
    ([key, val]) => {
      if (key === 'temperature') {
        return false;
      }
      if (Array.isArray(val)) {
        return val.length > 0;
      }
      return val !== undefined && val !== '';
    },
  );

  // Save current config as preset
  const handleSave = useCallback(async () => {
    if (!saveName.trim()) {
      return;
    }
    setSaving(true);
    try {
      const response = await authFetch('/api/studio/presets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: saveName.trim(),
          config: currentConfig,
          isPublic: false,
          tags: [],
        }),
      });
      const data = await response.json() as { success: boolean };
      if (data.success) {
        setSaveName('');
        void fetchPresets();
      }
    } catch {
      // Silently fail
    } finally {
      setSaving(false);
    }
  }, [saveName, currentConfig, authFetch, fetchPresets]);

  // Load preset
  const handleLoad = useCallback((preset: CustomPreset) => {
    onLoadPreset(preset.config);
    onOpenChange(false);
  }, [onLoadPreset, onOpenChange]);

  // Delete preset
  const handleDelete = useCallback(async (id: string) => {
    setDeleteId(id);
    try {
      await authFetch(`/api/studio/presets?id=${id}`, {
        method: 'DELETE',
      });
      setPresets((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // Silently fail
    } finally {
      setDeleteId(null);
    }
  }, [authFetch]);

  // Filter presets by search
  const filtered = search.trim()
    ? presets.filter((p) =>
        p.name.toLowerCase().includes(search.toLowerCase()) ||
        p.tags.some((t) => t.toLowerCase().includes(search.toLowerCase())),
      )
    : presets;

  // Count active settings in a config
  const countSettings = (config: CinematicConfig): number => {
    return Object.entries(config).filter(([key, val]) => {
      if (key === 'temperature') {
        return false;
      }
      if (Array.isArray(val)) {
        return val.length > 0;
      }
      return val !== undefined && val !== '';
    }).length;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          'max-w-lg max-h-[80vh] flex flex-col',
          'bg-zinc-900 border-zinc-700 text-white',
        )}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-white flex items-center gap-2">
            <FolderOpen className="h-5 w-5 text-amber-500" />
            Preset Library
          </DialogTitle>
        </DialogHeader>

        {/* Save Current Config */}
        {hasPresets && (
          <div className="border border-zinc-700 rounded-lg p-3 space-y-2">
            <p className="text-xs text-zinc-400">
              Save current settings (Camera, Lighting, Style, Filters) as a reusable preset:
            </p>
            <div className="flex gap-2">
              <Input
                placeholder="Name your preset..."
                value={saveName}
                onChange={(e) => setSaveName(e.target.value)}
                className="bg-zinc-800 border-zinc-600 text-white placeholder:text-zinc-500 text-sm flex-1"
                onKeyDown={(e) => { if (e.key === 'Enter') { void handleSave(); } }}
              />
              <Button
                size="sm"
                onClick={() => void handleSave()}
                disabled={saving || !saveName.trim()}
                className="bg-amber-600 hover:bg-amber-500 text-black font-semibold"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4 mr-1" />}
                Save
              </Button>
            </div>
            <p className="text-[10px] text-zinc-600">
              Presets save Camera, Lighting, Style, Filters and more. Not the subject or environment.
            </p>
          </div>
        )}

        {/* Search */}
        {presets.length > 3 && (
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-500" />
            <Input
              placeholder="Search presets..."
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
        )}

        {/* Saved Presets List */}
        <div className="flex-1 overflow-y-auto space-y-2 mt-2">
          <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
            Your Presets
          </h3>

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-6 w-6 animate-spin text-amber-500" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-12">
              <Sparkles className="h-10 w-10 mx-auto text-zinc-700 mb-3" />
              <p className="text-sm text-zinc-500">
                {presets.length === 0 ? 'No saved presets yet' : 'No presets match your search'}
              </p>
              <p className="text-xs text-zinc-600 mt-1">
                Configure your settings and save them as a preset to quickly load them later
              </p>
            </div>
          ) : (
            filtered.map((preset) => (
              <div
                key={preset.id}
                className="flex items-center gap-3 rounded-lg border border-zinc-700 bg-zinc-800/50 p-3 hover:border-zinc-600 transition-colors"
              >
                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{preset.name}</p>
                  <p className="text-[10px] text-zinc-500">
                    {countSettings(preset.config)} settings
                    {preset.description && ` — ${preset.description}`}
                  </p>
                  <p className="text-[10px] text-zinc-600 mt-0.5">
                    {new Date(preset.createdAt).toLocaleDateString()}
                  </p>
                </div>

                {/* Actions */}
                <div className="flex gap-1">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-amber-400 hover:text-amber-300"
                    onClick={() => handleLoad(preset)}
                    title="Load preset"
                  >
                    <Play className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-zinc-500 hover:text-red-400"
                    onClick={() => void handleDelete(preset.id)}
                    disabled={deleteId === preset.id}
                    title="Delete preset"
                  >
                    {deleteId === preset.id
                      ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      : <Trash2 className="h-3.5 w-3.5" />
                    }
                  </Button>
                </div>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

PresetLibraryModal.displayName = 'PresetLibraryModal';
