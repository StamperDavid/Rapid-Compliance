'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { cn } from '@/lib/utils';
import {
  ChevronDown,
  ChevronUp,
  Camera,
  Sun,
  Aperture,
  Palette,
  User,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { VisualPresetPicker } from './VisualPresetPicker';
import { SimpleStylePicker } from './SimpleStylePicker';
import { getPresetById } from '@/lib/ai/cinematic-presets';
import {
  ASPECT_RATIOS,
  VIEWING_DIRECTIONS,
  type CinematicConfig,
  type PresetCategory,
  type ViewingDirection,
  type AspectRatio,
} from '@/types/creative-studio';

// ─── Types ─────────────────────────────────────────────────────────

type StudioMode = 'simple' | 'advanced';

interface CinematicControlsPanelProps {
  config: CinematicConfig;
  onChange: (config: CinematicConfig) => void;
  compact?: boolean;
  className?: string;
  /** Subject & Action text — rendered in Section 01 when provided */
  subject?: string;
  onSubjectChange?: (value: string) => void;
  /** Environment description — rendered in Section 01 when provided */
  environment?: string;
  onEnvironmentChange?: (value: string) => void;
  /** Custom content for Section 05 (Elements Tool) — replaces disabled placeholder */
  renderElements?: React.ReactNode;
  /** Simple (preset cards) or Advanced (full controls). Defaults to reading from localStorage. */
  studioMode?: StudioMode;
  /** Called when the user toggles between simple and advanced mode */
  onStudioModeChange?: (mode: StudioMode) => void;
}

// ─── Helpers ───────────────────────────────────────────────────────

const VIEWING_DIRECTION_ICONS: Record<ViewingDirection, React.ReactNode> = {
  front: <ArrowUp className="h-4 w-4" />,
  back: <ArrowDown className="h-4 w-4" />,
  left: <ArrowLeft className="h-4 w-4" />,
  right: <ArrowRight className="h-4 w-4" />,
};

const VIEWING_DIRECTION_LABELS: Record<ViewingDirection, string> = {
  front: 'Front',
  back: 'Back',
  left: 'Left',
  right: 'Right',
};

interface SectionHeaderProps {
  number: string;
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  compact: boolean;
  onToggle: () => void;
}

function SectionHeader({ number, title, icon, isOpen, compact, onToggle }: SectionHeaderProps) {
  if (!compact) {
    return (
      <div className="flex items-center gap-3 mb-4">
        <span className="flex h-8 w-8 items-center justify-center rounded-md bg-indigo-500/20 text-xs font-bold text-indigo-400">
          {number}
        </span>
        <div className="flex items-center gap-2 text-white">
          {icon}
          <h3 className="text-sm font-semibold">{title}</h3>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-3 hover:bg-zinc-800 transition-colors"
    >
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-md bg-indigo-500/20 text-xs font-bold text-indigo-400">
          {number}
        </span>
        <div className="flex items-center gap-2 text-zinc-300">
          {icon}
          <span className="text-sm font-semibold">{title}</span>
        </div>
      </div>
      {isOpen ? (
        <ChevronUp className="h-4 w-4 text-zinc-500" />
      ) : (
        <ChevronDown className="h-4 w-4 text-zinc-500" />
      )}
    </button>
  );
}

// ─── Preset Selector Button ────────────────────────────────────────

interface PresetSelectorProps {
  label: string;
  presetId: string | undefined;
  category: PresetCategory;
  onOpen: () => void;
}

function PresetSelector({ label, presetId, onOpen }: PresetSelectorProps) {
  // Try exact preset ID match first, then display raw value as fallback
  const preset = presetId ? getPresetById(presetId) : undefined;
  const displayName = preset?.name
    ?? (presetId ? presetId.replace(/[-_]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : undefined);

  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-zinc-400">{label}</Label>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={onOpen}
        className={cn(
          'w-full justify-start text-left font-normal',
          'border-zinc-700 bg-zinc-800 hover:bg-zinc-700',
          displayName ? 'text-white' : 'text-zinc-500',
        )}
      >
        {displayName ?? 'Select...'}
      </Button>
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────

const STUDIO_MODE_KEY = 'sv-studio-mode';

function getPersistedStudioMode(): StudioMode {
  if (typeof window === 'undefined') { return 'simple'; }
  const stored = localStorage.getItem(STUDIO_MODE_KEY);
  return stored === 'advanced' ? 'advanced' : 'simple';
}

export function CinematicControlsPanel({
  config,
  onChange,
  compact = false,
  className,
  subject,
  onSubjectChange,
  environment,
  onEnvironmentChange,
  renderElements,
  studioMode: controlledMode,
  onStudioModeChange,
}: CinematicControlsPanelProps) {
  // Internal mode state (used when not controlled externally)
  const [internalMode, setInternalMode] = useState<StudioMode>(getPersistedStudioMode);
  const activeMode = controlledMode ?? internalMode;

  const handleModeChange = useCallback((mode: StudioMode) => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(STUDIO_MODE_KEY, mode);
    }
    setInternalMode(mode);
    onStudioModeChange?.(mode);
  }, [onStudioModeChange]);

  // Section open/close state (for compact mode)
  const [openSections, setOpenSections] = useState<Record<string, boolean>>({
    '01': true,
    '02': true,
    '03': true,
    '04': true,
    '05': true,
  });

  // Picker modal state
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerCategory, setPickerCategory] = useState<PresetCategory>('shotType');
  const [pickerMulti, setPickerMulti] = useState(false);

  const toggleSection = useCallback((key: string) => {
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }, []);

  const isSectionOpen = useCallback(
    (key: string) => !compact || openSections[key] !== false,
    [compact, openSections],
  );

  // Update a single config field
  const updateConfig = useCallback(
    <K extends keyof CinematicConfig>(key: K, value: CinematicConfig[K]) => {
      onChange({ ...config, [key]: value });
    },
    [config, onChange],
  );

  // Open the picker for a given category
  const openPicker = useCallback((category: PresetCategory, multi = false) => {
    setPickerCategory(category);
    setPickerMulti(multi);
    setPickerOpen(true);
  }, []);

  // Handle preset selection
  const handlePresetSelect = useCallback(
    (presetId: string) => {
      const categoryToConfigKey: Record<PresetCategory, keyof CinematicConfig> = {
        shotType: 'shotType',
        camera: 'camera',
        focalLength: 'focalLength',
        lensType: 'lensType',
        lighting: 'lighting',
        filmStock: 'filmStock',
        photographerStyle: 'photographerStyle',
        movieLook: 'movieLook',
        filter: 'filters',
        artStyle: 'artStyle',
        composition: 'composition',
      };
      const key = categoryToConfigKey[pickerCategory];
      if (key === 'filters') {
        // Single-select for filters still just toggles one
        const current = config.filters ?? [];
        const updated = current.includes(presetId)
          ? current.filter((id) => id !== presetId)
          : [...current, presetId];
        updateConfig('filters', updated);
      } else {
        updateConfig(key, presetId);
      }
    },
    [pickerCategory, config.filters, updateConfig],
  );

  const handleMultiSelect = useCallback(
    (presetIds: string[]) => {
      updateConfig('filters', presetIds);
    },
    [updateConfig],
  );

  // Currently selected value for picker
  const pickerSelected = useMemo(() => {
    const categoryToConfigKey: Record<PresetCategory, keyof CinematicConfig> = {
      shotType: 'shotType',
      camera: 'camera',
      focalLength: 'focalLength',
      lensType: 'lensType',
      lighting: 'lighting',
      filmStock: 'filmStock',
      photographerStyle: 'photographerStyle',
      movieLook: 'movieLook',
      filter: 'filters',
      artStyle: 'artStyle',
      composition: 'composition',
    };
    const key = categoryToConfigKey[pickerCategory];
    if (key === 'filters') {
      return config.filters ?? [];
    }
    return (config[key] as string | undefined) ?? undefined;
  }, [pickerCategory, config]);

  // Temperature slider value display
  const tempDisplay = config.temperature !== undefined ? config.temperature.toFixed(1) : '1.0';

  // If in simple mode, render the SimpleStylePicker instead of the full panel
  if (activeMode === 'simple') {
    return (
      <div className={cn('space-y-4', className)}>
        <SimpleStylePicker
          config={config}
          onChange={onChange}
          onSwitchToAdvanced={() => handleModeChange('advanced')}
        />
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      {/* Mode toggle — switch back to simple */}
      <div className="flex justify-end">
        <button
          type="button"
          onClick={() => handleModeChange('simple')}
          className="text-xs text-amber-400 hover:text-amber-300 hover:underline transition-colors"
        >
          Switch to Simple Mode
        </button>
      </div>

      {/* ─── 01. Subject & Framing ────────────────────────────────── */}
      <section>
        <SectionHeader
          number="01"
          title="Subject & Framing"
          icon={<User className="h-4 w-4" />}
          isOpen={isSectionOpen('01')}
          compact={compact}
          onToggle={() => toggleSection('01')}
        />
        <AnimatePresence initial={false}>
          {isSectionOpen('01') && (
            <motion.div
              initial={compact ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={compact ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={cn('space-y-4', compact && 'pt-3 pl-2')}>
                {/* Subject & Action (when in full studio mode) */}
                {onSubjectChange !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-amber-500/80 uppercase tracking-wider font-semibold">
                      Subject & Action
                    </Label>
                    <Textarea
                      placeholder="E.g. A woman in a trench coat checking her phone..."
                      value={subject ?? ''}
                      onChange={(e) => onSubjectChange(e.target.value)}
                      rows={3}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500 text-sm resize-y"
                    />
                  </div>
                )}

                {/* Shot Type */}
                <PresetSelector
                  label="Shot Type"
                  presetId={config.shotType}
                  category="shotType"
                  onOpen={() => openPicker('shotType')}
                />

                {/* Viewing Direction */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Viewing Direction</Label>
                  <div className="grid grid-cols-4 gap-2">
                    {VIEWING_DIRECTIONS.map((dir) => (
                      <button
                        key={dir}
                        type="button"
                        onClick={() =>
                          updateConfig(
                            'viewingDirection',
                            config.viewingDirection === dir ? undefined : dir,
                          )
                        }
                        className={cn(
                          'flex flex-col items-center gap-1 rounded-lg border p-2 transition-all text-xs',
                          config.viewingDirection === dir
                            ? 'border-indigo-500 bg-indigo-500/10 text-indigo-400'
                            : 'border-zinc-700 bg-zinc-800 text-zinc-400 hover:border-zinc-500',
                        )}
                      >
                        {VIEWING_DIRECTION_ICONS[dir]}
                        <span>{VIEWING_DIRECTION_LABELS[dir]}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Subject unaware */}
                <div className="flex items-center gap-2">
                  <Checkbox
                    checked={config.subjectUnawareOfCamera ?? false}
                    onChange={(e) =>
                      updateConfig(
                        'subjectUnawareOfCamera',
                        (e.target as HTMLInputElement).checked,
                      )
                    }
                  />
                  <Label className="text-xs text-zinc-400 cursor-pointer">
                    Subject unaware of camera
                  </Label>
                </div>

                {/* Environment (when in full studio mode) */}
                {onEnvironmentChange !== undefined && (
                  <div className="space-y-1.5">
                    <Label className="text-xs text-amber-500/80 uppercase tracking-wider font-semibold">
                      Environment
                    </Label>
                    <Input
                      placeholder="E.g. at a rainy London bus stop at night..."
                      value={environment ?? ''}
                      onChange={(e) => onEnvironmentChange(e.target.value)}
                      className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                    />
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── 02. Lighting & Mood ──────────────────────────────────── */}
      <section>
        <SectionHeader
          number="02"
          title="Lighting & Mood"
          icon={<Sun className="h-4 w-4" />}
          isOpen={isSectionOpen('02')}
          compact={compact}
          onToggle={() => toggleSection('02')}
        />
        <AnimatePresence initial={false}>
          {isSectionOpen('02') && (
            <motion.div
              initial={compact ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={compact ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={cn('space-y-4', compact && 'pt-3 pl-2')}>
                <PresetSelector
                  label="Lighting Setup"
                  presetId={config.lighting}
                  category="lighting"
                  onOpen={() => openPicker('lighting')}
                />
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Atmosphere</Label>
                  <Input
                    placeholder="moody, cinematic, gritty..."
                    value={config.atmosphere ?? ''}
                    onChange={(e) => updateConfig('atmosphere', e.target.value || undefined)}
                    className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-500"
                  />
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── 03. Camera Gear ──────────────────────────────────────── */}
      <section>
        <SectionHeader
          number="03"
          title="Camera Gear"
          icon={<Camera className="h-4 w-4" />}
          isOpen={isSectionOpen('03')}
          compact={compact}
          onToggle={() => toggleSection('03')}
        />
        <AnimatePresence initial={false}>
          {isSectionOpen('03') && (
            <motion.div
              initial={compact ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={compact ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={cn('space-y-4', compact && 'pt-3 pl-2')}>
                <div className="grid grid-cols-2 gap-4">
                  <PresetSelector
                    label="Camera Body"
                    presetId={config.camera}
                    category="camera"
                    onOpen={() => openPicker('camera')}
                  />
                  <PresetSelector
                    label="Focal Length"
                    presetId={config.focalLength}
                    category="focalLength"
                    onOpen={() => openPicker('focalLength')}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <PresetSelector
                    label="Lens Type"
                    presetId={config.lensType}
                    category="lensType"
                    onOpen={() => openPicker('lensType')}
                  />
                  <PresetSelector
                    label="Film Stock"
                    presetId={config.filmStock}
                    category="filmStock"
                    onOpen={() => openPicker('filmStock')}
                  />
                </div>
                {/* Aspect Ratio */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">Aspect Ratio</Label>
                  <Select
                    value={config.aspectRatio ?? ''}
                    onValueChange={(val) =>
                      updateConfig('aspectRatio', (val || undefined) as AspectRatio | undefined)
                    }
                  >
                    <SelectTrigger className="bg-zinc-800 border-zinc-700 text-white">
                      <SelectValue placeholder="Select ratio..." />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-800 border-zinc-700">
                      {ASPECT_RATIOS.map((ratio) => (
                        <SelectItem key={ratio} value={ratio} className="text-zinc-300">
                          {ratio}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── 04. Style & Aesthetics ───────────────────────────────── */}
      <section>
        <SectionHeader
          number="04"
          title="Style & Aesthetics"
          icon={<Palette className="h-4 w-4" />}
          isOpen={isSectionOpen('04')}
          compact={compact}
          onToggle={() => toggleSection('04')}
        />
        <AnimatePresence initial={false}>
          {isSectionOpen('04') && (
            <motion.div
              initial={compact ? { height: 0, opacity: 0 } : false}
              animate={{ height: 'auto', opacity: 1 }}
              exit={compact ? { height: 0, opacity: 0 } : undefined}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className={cn('space-y-4', compact && 'pt-3 pl-2')}>
                {/* Temperature slider */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs text-zinc-400">
                      Temperature (Creativity)
                    </Label>
                    <span className="text-xs font-mono text-indigo-400">{tempDisplay}</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.1"
                    value={config.temperature ?? 1.0}
                    onChange={(e) => updateConfig('temperature', parseFloat(e.target.value))}
                    className="w-full accent-indigo-500"
                  />
                  <div className="flex justify-between text-[10px] text-zinc-600">
                    <span>Focused</span>
                    <span>Creative</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <PresetSelector
                    label="Art Style"
                    presetId={config.artStyle}
                    category="artStyle"
                    onOpen={() => openPicker('artStyle')}
                  />
                  <PresetSelector
                    label="Photographer Style"
                    presetId={config.photographerStyle}
                    category="photographerStyle"
                    onOpen={() => openPicker('photographerStyle')}
                  />
                </div>

                <PresetSelector
                  label="Movie Look"
                  presetId={config.movieLook}
                  category="movieLook"
                  onOpen={() => openPicker('movieLook')}
                />

                {/* Filters (multi-select) */}
                <div className="space-y-1.5">
                  <Label className="text-xs text-zinc-400">
                    Filters{' '}
                    <span className="text-zinc-600">(stackable, multi-select)</span>
                  </Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => openPicker('filter', true)}
                    className={cn(
                      'w-full justify-start text-left font-normal',
                      'border-zinc-700 bg-zinc-800 hover:bg-zinc-700',
                      config.filters && config.filters.length > 0
                        ? 'text-white'
                        : 'text-zinc-500',
                    )}
                  >
                    {config.filters && config.filters.length > 0
                      ? `${config.filters.length} filter${config.filters.length > 1 ? 's' : ''} selected`
                      : 'Select filters...'}
                  </Button>
                  {/* Show selected filter chips */}
                  {config.filters && config.filters.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 mt-1.5">
                      {config.filters.map((filterId) => {
                        const preset = getPresetById(filterId);
                        return (
                          <span
                            key={filterId}
                            className="inline-flex items-center gap-1 rounded-full bg-indigo-500/20 px-2 py-0.5 text-[10px] text-indigo-300"
                          >
                            {preset?.name ?? filterId}
                            <button
                              type="button"
                              onClick={() =>
                                updateConfig(
                                  'filters',
                                  config.filters?.filter((id) => id !== filterId),
                                )
                              }
                              className="ml-0.5 hover:text-white"
                              aria-label={`Remove ${preset?.name ?? filterId}`}
                            >
                              &times;
                            </button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                </div>

                <PresetSelector
                  label="Composition"
                  presetId={config.composition}
                  category="composition"
                  onOpen={() => openPicker('composition')}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* ─── 05. Elements Tool ──────────────────────────────────── */}
      <section>
        {renderElements ? (
          <>
            <SectionHeader
              number="05"
              title="Elements Tool (Images)"
              icon={<Aperture className="h-4 w-4" />}
              isOpen={isSectionOpen('05')}
              compact={compact}
              onToggle={() => toggleSection('05')}
            />
            <AnimatePresence initial={false}>
              {isSectionOpen('05') && (
                <motion.div
                  initial={compact ? { height: 0, opacity: 0 } : false}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={compact ? { height: 0, opacity: 0 } : undefined}
                  transition={{ duration: 0.2 }}
                  className="overflow-hidden"
                >
                  <div className={cn('space-y-4', compact && 'pt-3 pl-2')}>
                    {renderElements}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </>
        ) : (
          <div className="flex items-center gap-3 opacity-50">
            <span className="flex h-8 w-8 items-center justify-center rounded-md bg-zinc-800 text-xs font-bold text-zinc-500">
              05
            </span>
            <div className="flex items-center gap-2 text-zinc-500">
              <Aperture className="h-4 w-4" />
              <h3 className="text-sm font-semibold">
                Elements{' '}
                <span className="text-xs font-normal">(Character Elements Tool)</span>
              </h3>
            </div>
          </div>
        )}
      </section>

      {/* ─── Shared Picker Modal ──────────────────────────────────── */}
      <VisualPresetPicker
        category={pickerCategory}
        selected={pickerSelected}
        onSelect={handlePresetSelect}
        onMultiSelect={handleMultiSelect}
        multiSelect={pickerMulti}
        open={pickerOpen}
        onOpenChange={setPickerOpen}
      />
    </div>
  );
}

CinematicControlsPanel.displayName = 'CinematicControlsPanel';
