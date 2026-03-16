'use client';

import { useState, useCallback, useMemo } from 'react';
import Image from 'next/image';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Loader2,
  Trash2,
  RotateCcw,
  Image as ImageIcon,
  Video,
  Copy,
  Download,
  Layers,
  Zap,
  Sparkles,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { CinematicControlsPanel } from '@/components/studio/CinematicControlsPanel';
import { ConstructedPromptDisplay } from '@/components/studio/ConstructedPromptDisplay';
import { CharacterElementsTool } from '@/components/studio/CharacterElementsTool';
import { GenerateEditToggle } from '@/components/studio/GenerateEditToggle';
import { RenderQueuePanel } from '@/components/studio/RenderQueuePanel';
import { CharacterLibraryModal } from '@/components/studio/CharacterLibraryModal';
import { PresetLibraryModal } from '@/components/studio/PresetLibraryModal';
import { buildPromptFromPresets } from '@/lib/ai/cinematic-presets';
import type {
  CinematicConfig,
  CharacterReference,
  StudioMode,
  StudioProvider,
  GenerationType,
  GenerationResult,
  RenderQueueItem,
} from '@/types/creative-studio';

// ─── Provider / Model Constants ───────────────────────────────────────

interface ModelOption {
  id: string;
  name: string;
  cost: number;
  type: GenerationType;
}

const PROVIDER_OPTIONS: { id: string; name: string }[] = [
  { id: 'auto', name: 'Auto-Select' },
  { id: 'google', name: 'Google Imagen 3' },
  { id: 'fal', name: 'Fal.ai (Flux)' },
  { id: 'openai', name: 'DALL-E 3' },
  { id: 'kling', name: 'Kling 3.0' },
];

const MODELS_BY_PROVIDER: Record<string, ModelOption[]> = {
  auto: [{ id: 'auto', name: 'Auto-select best model', cost: 0.08, type: 'image' }],
  google: [
    { id: 'imagen-3.0-generate-002', name: 'Imagen 3.0', cost: 0.08, type: 'image' },
    { id: 'imagen-3.0-fast-generate-001', name: 'Imagen 3.0 Fast', cost: 0.04, type: 'image' },
  ],
  fal: [
    { id: 'fal-ai/flux-pro', name: 'Flux Pro', cost: 0.10, type: 'image' },
    { id: 'fal-ai/flux/dev', name: 'Flux Dev', cost: 0.05, type: 'image' },
    { id: 'fal-ai/flux/schnell', name: 'Flux Schnell', cost: 0.03, type: 'image' },
    { id: 'fal-ai/flux-realism', name: 'Flux Realism', cost: 0.06, type: 'image' },
    { id: 'fal-ai/stable-diffusion-xl', name: 'SDXL', cost: 0.04, type: 'image' },
  ],
  openai: [
    { id: 'dall-e-3', name: 'DALL-E 3', cost: 0.04, type: 'image' },
    { id: 'dall-e-3-hd', name: 'DALL-E 3 HD', cost: 0.08, type: 'image' },
  ],
  kling: [
    { id: 'kling-v1-image', name: 'Kling V1 (Image)', cost: 0.014, type: 'image' },
    { id: 'kling-v1-video-5s-std', name: 'Kling 5s Standard', cost: 0.07, type: 'video' },
    { id: 'kling-v1-video-5s-pro', name: 'Kling 5s Pro', cost: 0.14, type: 'video' },
    { id: 'kling-v1-video-10s-std', name: 'Kling 10s Standard', cost: 0.14, type: 'video' },
    { id: 'kling-v1-video-10s-pro', name: 'Kling 10s Pro', cost: 0.28, type: 'video' },
  ],
};

const RESOLUTION_OPTIONS = [
  { id: '1K', label: '1K' },
  { id: '2K', label: '2K' },
  { id: '4K', label: '4K' },
];

const VIDEO_TYPE_TABS = [
  { id: 'text-to-video', label: 'Text to Video', enabled: true },
  { id: 'image-to-video', label: 'Image to Video', enabled: true },
  { id: 'audio-driven', label: 'Audio Driven Video', enabled: false },
  { id: 'multi-modal', label: 'Multi-Modal Video', enabled: false },
  { id: 'reference-to-video', label: 'Reference to Video', enabled: false },
  { id: 'start-end-frame', label: 'Start + End Frame', enabled: false },
];

// ─── Helper: random shot types for Queue Scene ──────────────────────

const SCENE_SHOT_TYPES = [
  'close-up', 'wide-shot', 'medium-shot', 'dutch-angle',
  'low-angle-shot', 'high-angle-shot', 'over-the-shoulder', 'establishing-shot',
  'birds-eye-view', 'worms-eye-view', 'tracking-shot', 'cowboy-shot',
];

function pickRandomShotTypes(count: number): string[] {
  const shuffled = [...SCENE_SHOT_TYPES].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count);
}

// ─── Component ──────────────────────────────────────────────────────

export function StudioModePanel() {
  const authFetch = useAuthFetch();

  // ── Core prompt state ───────────────────────────────────────────
  const [subject, setSubject] = useState('');
  const [environment, setEnvironment] = useState('');
  const [cinematicConfig, setCinematicConfig] = useState<CinematicConfig>({});

  // ── Character / reference state ─────────────────────────────────
  const [characters, setCharacters] = useState<CharacterReference[]>([]);
  const [globalReference, setGlobalReference] = useState<string | undefined>();
  const [additionalReferences, setAdditionalReferences] = useState<string[]>([]);
  const [narrativeAnglePrompting, setNarrativeAnglePrompting] = useState(false);
  const [studioMode, setStudioMode] = useState<StudioMode>('generate');

  // ── Provider / model state ──────────────────────────────────────
  const [selectedProvider, setSelectedProvider] = useState('auto');
  const [selectedModel, setSelectedModel] = useState('auto');
  const [resolution, setResolution] = useState('1K');

  // ── Generation state ────────────────────────────────────────────
  const [renderQueue, setRenderQueue] = useState<RenderQueueItem[]>([]);
  const [primaryRender, setPrimaryRender] = useState<GenerationResult | null>(null);
  const [sceneVariations, setSceneVariations] = useState<GenerationResult[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [editedPrompt, setEditedPrompt] = useState<string | null>(null);

  // ── Video section state ─────────────────────────────────────────
  const [videoProvider, setVideoProvider] = useState('kling');
  const [videoType, setVideoType] = useState('text-to-video');

  // ── Modal state ────────────────────────────────────────────────
  const [showCharacterLibrary, setShowCharacterLibrary] = useState(false);
  const [showPresetLibrary, setShowPresetLibrary] = useState(false);

  // ── Derived values ──────────────────────────────────────────────
  const fullPrompt = useMemo(() => {
    const base = environment ? `${subject}, set in ${environment}` : subject;
    return base;
  }, [subject, environment]);

  const assembledPrompt = useMemo(
    () => buildPromptFromPresets(editedPrompt ?? fullPrompt, cinematicConfig),
    [editedPrompt, fullPrompt, cinematicConfig],
  );

  const availableModels = useMemo(
    () => MODELS_BY_PROVIDER[selectedProvider] ?? MODELS_BY_PROVIDER.auto,
    [selectedProvider],
  );

  const estimatedCost = useMemo(() => {
    if (selectedProvider === 'auto') {
      return 0.08;
    }
    const model = availableModels.find((m) => m.id === selectedModel);
    return model?.cost ?? 0.08;
  }, [selectedProvider, selectedModel, availableModels]);

  const activeProviderLabel = useMemo(() => {
    const prov = PROVIDER_OPTIONS.find((p) => p.id === selectedProvider);
    const model = availableModels.find((m) => m.id === selectedModel);
    if (selectedProvider === 'auto') {
      return 'Auto-select (best provider for your style)';
    }
    return `${prov?.name ?? selectedProvider} (${model?.name ?? 'auto'})`;
  }, [selectedProvider, selectedModel, availableModels]);

  // ── Handlers ────────────────────────────────────────────────────

  const handleClearAll = useCallback(() => {
    setSubject('');
    setEnvironment('');
    setCinematicConfig({});
    setCharacters([]);
    setGlobalReference(undefined);
    setAdditionalReferences([]);
    setNarrativeAnglePrompting(false);
    setStudioMode('generate');
    setEditedPrompt(null);
    setPrimaryRender(null);
    setSceneVariations([]);
  }, []);

  const handleProviderChange = useCallback((provider: string) => {
    setSelectedProvider(provider);
    setSelectedModel(provider === 'auto' ? 'auto' : (MODELS_BY_PROVIDER[provider]?.[0]?.id ?? 'auto'));
  }, []);

  const submitGeneration = useCallback(async (
    overrideConfig?: Partial<CinematicConfig>,
    genType: GenerationType = 'image',
  ): Promise<GenerationResult | null> => {
    if (!subject.trim()) {
      return null;
    }

    const config = overrideConfig ? { ...cinematicConfig, ...overrideConfig } : cinematicConfig;
    const prompt = editedPrompt ?? fullPrompt;

    const queueId = `pending-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const providerForQueue = (selectedProvider === 'auto' ? 'google' : selectedProvider) as StudioProvider;

    const queueItem: RenderQueueItem = {
      id: queueId,
      status: 'processing',
      prompt: prompt.slice(0, 80),
      provider: providerForQueue,
      model: selectedModel === 'auto' ? 'auto' : selectedModel,
      type: genType,
      createdAt: new Date().toISOString(),
      estimatedCost,
    };
    setRenderQueue((prev) => [queueItem, ...prev]);

    try {
      const response = await authFetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          type: genType,
          provider: selectedProvider === 'auto' ? undefined : selectedProvider,
          model: selectedModel === 'auto' ? undefined : selectedModel,
          presets: config,
          characters: characters.length > 0 ? characters : undefined,
          globalReference,
          referenceImages: additionalReferences.filter(Boolean).length > 0
            ? additionalReferences.filter(Boolean)
            : undefined,
          narrativeAnglePrompting,
          mode: studioMode,
          size: resolution,
        }),
      });

      const data = await response.json() as {
        success: boolean;
        data?: GenerationResult & { generationId?: string };
        error?: string;
      };

      if (data.success && data.data) {
        const result = data.data;
        setRenderQueue((prev) =>
          prev.map((item) =>
            item.id === queueId
              ? {
                  ...item,
                  id: result.id,
                  status: 'completed' as const,
                  result,
                  provider: result.provider,
                  model: result.model,
                }
              : item,
          ),
        );
        return result;
      }

      setRenderQueue((prev) =>
        prev.map((item) =>
          item.id === queueId
            ? { ...item, status: 'failed' as const, error: data.error ?? 'Generation failed' }
            : item,
        ),
      );
      return null;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Generation failed';
      setRenderQueue((prev) =>
        prev.map((item) =>
          item.id === queueId ? { ...item, status: 'failed' as const, error: msg } : item,
        ),
      );
      return null;
    }
  }, [
    subject, fullPrompt, editedPrompt, cinematicConfig, selectedProvider,
    selectedModel, resolution, characters, globalReference, additionalReferences,
    narrativeAnglePrompting, studioMode, estimatedCost, authFetch,
  ]);

  const handleQueueImage = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await submitGeneration();
      if (result) {
        setPrimaryRender(result);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [submitGeneration]);

  const handleQueueScene = useCallback(async () => {
    if (!subject.trim()) {
      return;
    }
    setIsGenerating(true);
    setSceneVariations([]);

    try {
      const shotTypes = pickRandomShotTypes(4);
      const results = await Promise.allSettled(
        shotTypes.map((shotType) => submitGeneration({ shotType })),
      );

      const successful: GenerationResult[] = [];
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value) {
          successful.push(r.value);
        }
      }

      setSceneVariations(successful);
      if (successful.length > 0) {
        setPrimaryRender(successful[0]);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [subject, submitGeneration]);

  const handleQueueVideo = useCallback(async () => {
    setIsGenerating(true);
    try {
      const result = await submitGeneration(undefined, 'video');
      if (result) {
        setPrimaryRender(result);
      }
    } finally {
      setIsGenerating(false);
    }
  }, [submitGeneration]);

  const handleReuseAsReference = useCallback(() => {
    if (primaryRender?.url) {
      setGlobalReference(primaryRender.url);
    }
  }, [primaryRender]);

  const handleLoadCharacter = useCallback((character: CharacterReference) => {
    if (characters.length === 0) {
      setCharacters([character]);
    } else {
      setCharacters((prev) => prev.map((c, i) => (i === 0 ? character : c)));
    }
  }, [characters.length]);

  const handleLoadPreset = useCallback((config: CinematicConfig) => {
    setCinematicConfig(config);
    setEditedPrompt(null);
  }, []);

  const handleCopySceneJson = useCallback(() => {
    const sceneData = {
      subject,
      environment,
      presets: cinematicConfig,
      provider: selectedProvider,
      model: selectedModel,
      resolution,
      mode: studioMode,
    };
    void navigator.clipboard.writeText(JSON.stringify(sceneData, null, 2));
  }, [subject, environment, cinematicConfig, selectedProvider, selectedModel, resolution, studioMode]);

  const handleQueueCancel = useCallback((id: string) => {
    setRenderQueue((prev) =>
      prev.map((item) =>
        item.id === id && (item.status === 'queued' || item.status === 'processing')
          ? { ...item, status: 'cancelled' as const }
          : item,
      ),
    );
  }, []);

  const handleQueueSelect = useCallback((id: string) => {
    const item = renderQueue.find((i) => i.id === id);
    if (item?.result) {
      setPrimaryRender(item.result);
    }
  }, [renderQueue]);

  // ── Render ──────────────────────────────────────────────────────

  return (
    <>
      {/* ── Top Toolbar ──────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-6 py-3 border-b border-zinc-800">
        <div>
          <p className="text-xs text-zinc-500">
            Using provider: {activeProviderLabel}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearAll}
            className="border-zinc-700 text-zinc-400 hover:text-white"
          >
            <RotateCcw className="h-3.5 w-3.5 mr-1.5" />
            Clear All
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPresetLibrary(true)}
            className="border-zinc-700 text-zinc-400 hover:text-white"
          >
            <Sparkles className="h-3.5 w-3.5 mr-1.5" />
            Presets
          </Button>
          <Badge
            variant="outline"
            className="border-green-600/50 text-green-400 px-3 py-1 text-xs"
          >
            <Zap className="h-3 w-3 mr-1" />
            API Ready
          </Badge>
        </div>
      </div>

      {/* ── Main Two-Column Layout ───────────────────────────────── */}
      <div className="flex">
        {/* ── Left Panel — Controls ─────────────────────────────── */}
        <div className="w-[460px] flex-shrink-0 border-r border-zinc-800 h-[calc(100vh-200px)] overflow-y-auto">
          <div className="p-5 space-y-2">
            <CinematicControlsPanel
              config={cinematicConfig}
              onChange={setCinematicConfig}
              subject={subject}
              onSubjectChange={setSubject}
              environment={environment}
              onEnvironmentChange={setEnvironment}
              renderElements={
                <>
                  <CharacterElementsTool
                    characters={characters}
                    onChange={setCharacters}
                    globalReference={globalReference}
                    onGlobalReferenceChange={setGlobalReference}
                    additionalReferences={additionalReferences}
                    onAdditionalReferencesChange={setAdditionalReferences}
                    onLibraryClick={() => setShowCharacterLibrary(true)}
                  />
                  <div className="border-t border-zinc-800 pt-4">
                    <GenerateEditToggle
                      mode={studioMode}
                      onModeChange={setStudioMode}
                      narrativeAnglePrompting={narrativeAnglePrompting}
                      onNarrativeAnglePromptingChange={setNarrativeAnglePrompting}
                    />
                  </div>
                </>
              }
            />
          </div>
        </div>

        {/* ── Right Panel — Output ──────────────────────────────── */}
        <div className="flex-1 h-[calc(100vh-200px)] overflow-y-auto">
          <div className="p-5 space-y-5">
            {/* ── Constructed Prompt ──────────────────────────────── */}
            <ConstructedPromptDisplay
              basePrompt={fullPrompt}
              config={cinematicConfig}
              onEdit={(text) => setEditedPrompt(text)}
              onReset={() => {
                setEditedPrompt(null);
              }}
              onCopy={() => void navigator.clipboard.writeText(assembledPrompt)}
              onSavePreset={() => setShowPresetLibrary(true)}
            />

            {/* ── Generation Controls Row ────────────────────────── */}
            <div className="flex items-end gap-3 flex-wrap">
              {/* Provider */}
              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Model
                </Label>
                <Select value={selectedProvider} onValueChange={handleProviderChange}>
                  <SelectTrigger className="w-40 bg-zinc-900 border-zinc-700 text-white text-xs h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-zinc-900 border-zinc-700">
                    {PROVIDER_OPTIONS.map((p) => (
                      <SelectItem key={p.id} value={p.id} className="text-zinc-300 text-xs">
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Model (when not auto) */}
              {selectedProvider !== 'auto' && (
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Variant
                  </Label>
                  <Select value={selectedModel} onValueChange={setSelectedModel}>
                    <SelectTrigger className="w-44 bg-zinc-900 border-zinc-700 text-white text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      {availableModels.map((m) => (
                        <SelectItem key={m.id} value={m.id} className="text-zinc-300 text-xs">
                          {m.name} — ${m.cost.toFixed(3)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Resolution */}
              <div className="space-y-1">
                <Label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                  Resolution
                </Label>
                <div className="flex gap-1">
                  {RESOLUTION_OPTIONS.map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => setResolution(r.id)}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                        resolution === r.id
                          ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40'
                          : 'bg-zinc-900 text-zinc-500 border border-zinc-700 hover:border-zinc-500'
                      }`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Copy Scene JSON */}
              <Button
                variant="ghost"
                size="sm"
                onClick={handleCopySceneJson}
                className="text-zinc-500 hover:text-white h-9"
                title="Copy scene configuration as JSON"
              >
                <Copy className="h-3.5 w-3.5 mr-1" />
                Copy Scene JSON
              </Button>

              {/* Cost + Queue Image */}
              <div className="ml-auto flex items-center gap-3">
                <span className="text-xs text-zinc-500">
                  est. <span className="text-amber-400 font-mono">${estimatedCost.toFixed(2)}</span>
                </span>
                <Button
                  onClick={() => void handleQueueImage()}
                  disabled={!subject.trim() || isGenerating}
                  className="bg-amber-600 hover:bg-amber-500 text-black font-bold px-6 h-9"
                >
                  {isGenerating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  <ImageIcon className="h-4 w-4 mr-1.5" />
                  QUEUE IMAGE
                </Button>
              </div>
            </div>

            {/* ── Queue Scene Button ──────────────────────────────── */}
            <button
              type="button"
              onClick={() => void handleQueueScene()}
              disabled={!subject.trim() || isGenerating}
              className="w-full rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-2.5 text-sm font-semibold text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Layers className="h-4 w-4" />
              QUEUE SCENE (4 RANDOM ANGLES, CONSISTENT CHARACTER)
              <span className="text-amber-500/60 text-xs ml-2">
                ${(estimatedCost * 4).toFixed(2)}
              </span>
            </button>

            {/* ── Primary Render ──────────────────────────────────── */}
            <div className="relative rounded-lg border border-zinc-800 bg-zinc-900/50 min-h-[400px] flex items-center justify-center overflow-hidden">
              {primaryRender ? (
                <>
                  {primaryRender.metadata?.format?.startsWith('video') ? (
                    <video
                      src={primaryRender.url}
                      controls
                      className="max-w-full max-h-[600px] rounded"
                    />
                  ) : (
                    <Image
                      src={primaryRender.url}
                      alt="Generated content"
                      unoptimized
                      width={0}
                      height={0}
                      sizes="100vw"
                      className="rounded object-contain"
                      style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '600px' }}
                    />
                  )}
                  {/* Overlay actions */}
                  <div className="absolute top-3 right-3 flex gap-1.5">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={handleReuseAsReference}
                      className="h-8 w-8 bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
                      title="Reuse as reference"
                    >
                      <ImageIcon className="h-4 w-4" />
                    </Button>
                    <a
                      href={primaryRender.url}
                      download
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-black/50 backdrop-blur-sm text-white hover:bg-black/70"
                      title="Download"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </div>
                  {/* Metadata bar */}
                  <div className="absolute bottom-0 left-0 right-0 bg-black/60 backdrop-blur-sm px-4 py-2 flex items-center gap-3 text-[10px] text-zinc-400">
                    <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">
                      {primaryRender.provider}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] border-zinc-600 text-zinc-400">
                      {primaryRender.model}
                    </Badge>
                    <span>
                      {primaryRender.metadata?.width}x{primaryRender.metadata?.height}
                    </span>
                    <span className="text-amber-400">
                      ${primaryRender.cost.toFixed(3)}
                    </span>
                  </div>
                </>
              ) : (
                <div className="text-center">
                  <ImageIcon className="h-12 w-12 mx-auto text-zinc-700 mb-3" />
                  <p className="text-sm text-zinc-600">No image generated</p>
                  <p className="text-xs text-zinc-700 mt-1">
                    Configure your scene and click Queue Image to generate
                  </p>
                </div>
              )}
            </div>

            {/* ── Scene Variations ────────────────────────────────── */}
            {sceneVariations.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-2">
                  Scene Variations ({sceneVariations.length}/4)
                </h3>
                <div className="grid grid-cols-4 gap-2">
                  {sceneVariations.map((variation) => (
                    <button
                      key={variation.id}
                      type="button"
                      onClick={() => setPrimaryRender(variation)}
                      className={`relative aspect-video rounded-lg border overflow-hidden transition-all hover:ring-2 hover:ring-amber-500/50 ${
                        primaryRender?.id === variation.id
                          ? 'border-amber-500 ring-2 ring-amber-500/50'
                          : 'border-zinc-700'
                      }`}
                    >
                      <Image
                        src={variation.url}
                        alt="Scene variation"
                        fill
                        unoptimized
                        className="object-cover"
                      />
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── 06. Video Section ──────────────────────────────── */}
            <div className="border-t border-zinc-800 pt-5">
              <div className="flex items-center gap-3 mb-4">
                <span className="flex h-8 w-8 items-center justify-center rounded-md bg-amber-500/20 text-xs font-bold text-amber-400">
                  06
                </span>
                <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                  <Video className="h-4 w-4" />
                  Video
                </h3>
              </div>

              {/* Video API Provider */}
              <div className="space-y-3">
                <div className="space-y-1">
                  <Label className="text-[10px] text-zinc-500 uppercase tracking-wider">
                    Video API Provider
                  </Label>
                  <Select value={videoProvider} onValueChange={setVideoProvider}>
                    <SelectTrigger className="w-full bg-zinc-900 border-zinc-700 text-white text-xs h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-zinc-900 border-zinc-700">
                      <SelectItem value="kling" className="text-zinc-300 text-xs">Kling 3.0</SelectItem>
                      <SelectItem value="google" className="text-zinc-300 text-xs">Google AI Studio</SelectItem>
                      <SelectItem value="fal" className="text-zinc-300 text-xs">Fal.ai</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Video Type Tabs */}
                <div className="flex flex-wrap gap-1.5">
                  {VIDEO_TYPE_TABS.map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => tab.enabled && setVideoType(tab.id)}
                      disabled={!tab.enabled}
                      className={`px-3 py-1.5 rounded text-xs font-medium transition-all ${
                        videoType === tab.id && tab.enabled
                          ? 'bg-amber-600/20 text-amber-400 border border-amber-500/40'
                          : tab.enabled
                            ? 'bg-zinc-900 text-zinc-400 border border-zinc-700 hover:border-zinc-500'
                            : 'bg-zinc-900/50 text-zinc-600 border border-zinc-800 cursor-not-allowed'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Video action */}
                {(videoType === 'text-to-video' || videoType === 'image-to-video') ? (
                  <Button
                    onClick={() => void handleQueueVideo()}
                    disabled={!subject.trim() || isGenerating}
                    className="w-full bg-amber-600 hover:bg-amber-500 text-black font-bold h-9"
                  >
                    {isGenerating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                    <Video className="h-4 w-4 mr-1.5" />
                    QUEUE VIDEO
                  </Button>
                ) : (
                  <p className="text-xs text-zinc-600 text-center py-3">
                    Select a video type to configure model and prompt settings.
                  </p>
                )}

                <p className="text-[10px] text-zinc-600 text-center">
                  Using provider: {videoProvider === 'kling' ? 'Kling 3.0' : videoProvider === 'google' ? 'Google AI Studio' : 'Fal.ai'}
                </p>
              </div>
            </div>

            {/* ── Render Queue ────────────────────────────────────── */}
            <div className="border-t border-zinc-800 pt-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-xs font-semibold text-zinc-400 uppercase tracking-wider">
                  Render Queue
                </h3>
                {renderQueue.length > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setRenderQueue([])}
                    className="text-zinc-600 hover:text-zinc-400 h-6 text-[10px]"
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Clear
                  </Button>
                )}
              </div>
              <RenderQueuePanel
                items={renderQueue}
                onCancel={handleQueueCancel}
                onSelect={handleQueueSelect}
              />
            </div>
          </div>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────── */}
      <CharacterLibraryModal
        open={showCharacterLibrary}
        onOpenChange={setShowCharacterLibrary}
        currentCharacter={characters[0]}
        onLoadCharacter={handleLoadCharacter}
      />

      <PresetLibraryModal
        open={showPresetLibrary}
        onOpenChange={setShowPresetLibrary}
        currentConfig={cinematicConfig}
        onLoadPreset={handleLoadPreset}
      />
    </>
  );
}
