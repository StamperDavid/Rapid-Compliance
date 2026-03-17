'use client';

/**
 * StepStoryboard — Visual storyboard builder with per-scene cinematic controls
 *
 * Each scene shows a compact card in a grid. Clicking a scene opens the full
 * CinematicControlsPanel for that scene, plus script editing, character/voice
 * assignment, and preview generation.
 */

import { useState, useCallback, useEffect, useRef, forwardRef, type SyntheticEvent } from 'react';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Layers,
  Plus,
  Trash2,
  Copy,
  GripVertical,
  ImageIcon,
  Loader2,
  ArrowLeft,
  ArrowRight,
  Sparkles,
  Users,
  Mic,
  CheckCircle2,
  AlertCircle,
  Clock,
  Wand2,
  X,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { CinematicControlsPanel } from '@/components/studio/CinematicControlsPanel';
import { AvatarPicker } from './AvatarPicker';
import { VoicePicker } from './VoicePicker';
import type { PipelineScene } from '@/types/video-pipeline';
import type { CinematicConfig } from '@/types/creative-studio';

// ============================================================================
// Scene Card (compact grid view)
// ============================================================================

interface SceneCardProps {
  scene: PipelineScene;
  index: number;
  isSelected: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGeneratePreview: () => void;
  isGeneratingPreview: boolean;
}

const SceneCard = forwardRef<HTMLDivElement, SceneCardProps>(function SceneCard({
  scene,
  index,
  isSelected,
  onSelect,
  onDelete,
  onDuplicate,
  onGeneratePreview,
  isGeneratingPreview,
}, ref) {
  const [imgBroken, setImgBroken] = useState(false);

  const handleImageError = useCallback((e: SyntheticEvent<HTMLImageElement>) => {
    e.currentTarget.style.display = 'none';
    setImgBroken(true);
  }, []);

  return (
    <motion.div
      ref={ref}
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      onClick={onSelect}
      className={`bg-zinc-900/80 border rounded-lg overflow-hidden cursor-pointer transition-all ${
        isSelected
          ? 'border-amber-500 ring-2 ring-amber-500/30'
          : 'border-zinc-800 hover:border-zinc-600'
      }`}
    >
      {/* Preview Image */}
      <div className="relative aspect-video bg-zinc-800/50 group">
        {scene.screenshotUrl && !imgBroken ? (
          <Image
            src={scene.screenshotUrl}
            alt={`Scene ${index + 1}`}
            fill
            className="object-cover"
            unoptimized
            onError={handleImageError}
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
            <ImageIcon className="w-8 h-8 mb-1" />
            <span className="text-[10px]">{imgBroken ? 'Preview expired' : 'No preview'}</span>
          </div>
        )}

        {/* Shot number badge */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded">
          Shot {index + 1}
        </div>

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onGeneratePreview(); }}
            disabled={isGeneratingPreview}
            className="bg-black/70 hover:bg-amber-600 text-white p-1.5 rounded transition-colors"
            title="Generate preview image"
          >
            {isGeneratingPreview ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Wand2 className="w-3.5 h-3.5" />
            )}
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDuplicate(); }}
            className="bg-black/70 hover:bg-zinc-600 text-white p-1.5 rounded transition-colors"
            title="Duplicate scene"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); onDelete(); }}
            className="bg-black/70 hover:bg-red-600 text-white p-1.5 rounded transition-colors"
            title="Delete scene"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Drag handle */}
        <div className="absolute bottom-2 left-2 opacity-0 group-hover:opacity-60 transition-opacity cursor-grab">
          <GripVertical className="w-4 h-4 text-white" />
        </div>

        {/* Duration badge */}
        <div className="absolute bottom-2 right-2 bg-black/70 text-zinc-300 text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1">
          <Clock className="w-2.5 h-2.5" />
          {scene.duration}s
        </div>
      </div>

      {/* Scene summary */}
      <div className="p-2.5 space-y-1">
        <p className="text-xs font-semibold text-white truncate">
          {scene.title ?? `Scene ${index + 1}`}
        </p>
        <p className="text-[10px] text-zinc-500 line-clamp-2">
          {scene.scriptText || 'No script yet'}
        </p>
        {scene.cinematicConfig && Object.keys(scene.cinematicConfig).length > 0 && (
          <div className="flex items-center gap-1 mt-1">
            <Sparkles className="w-2.5 h-2.5 text-amber-500" />
            <span className="text-[9px] text-amber-500/70">Cinematic configured</span>
          </div>
        )}
      </div>
    </motion.div>
  );
});

// ============================================================================
// Scene Detail Editor (expanded view below grid)
// ============================================================================

interface SceneDetailEditorProps {
  scene: PipelineScene;
  index: number;
  onUpdate: (updates: Partial<PipelineScene>) => void;
  onClose: () => void;
}

function SceneDetailEditor({ scene, index, onUpdate, onClose }: SceneDetailEditorProps) {
  const config = scene.cinematicConfig ?? {};

  const handleConfigChange = useCallback((newConfig: CinematicConfig) => {
    onUpdate({ cinematicConfig: newConfig });
  }, [onUpdate]);

  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.2 }}
      className="overflow-hidden"
    >
      <Card className="bg-zinc-900/80 border-amber-500/30 border">
        <CardContent className="p-0">
          {/* Editor Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Sparkles className="w-4 h-4 text-amber-500" />
              Editing Scene {index + 1}: {scene.title ?? 'Untitled'}
            </h3>
            <Button
              variant="ghost"
              size="icon"
              onClick={onClose}
              className="h-7 w-7 text-zinc-500 hover:text-white"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          {/* Two-column layout: Script + Details on left, Cinematic Controls on right */}
          <div className="flex">
            {/* Left: Script + Scene Details */}
            <div className="w-1/2 border-r border-zinc-800 p-4 space-y-4">
              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-500/80 uppercase tracking-wider font-semibold">
                  Scene Title
                </Label>
                <input
                  type="text"
                  value={scene.title ?? ''}
                  onChange={(e) => onUpdate({ title: e.target.value || undefined })}
                  placeholder={`Scene ${String(index + 1)} title...`}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Script */}
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-500/80 uppercase tracking-wider font-semibold">
                  Script / Dialogue
                </Label>
                <Textarea
                  value={scene.scriptText}
                  onChange={(e) => onUpdate({ scriptText: e.target.value })}
                  rows={6}
                  placeholder="NARRATOR: Welcome to SalesVelocity...&#10;SARAH (to camera): I used to spend hours on spreadsheets.&#10;(Sarah turns to laptop, dashboard glows)"
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 text-sm resize-y font-mono"
                />
                <p className="text-[10px] text-zinc-600">
                  Use screenplay format — CHARACTER: dialogue. Parentheses for stage directions.
                </p>
              </div>

              {/* Visual Description */}
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-500/80 uppercase tracking-wider font-semibold">
                  Visual Description
                </Label>
                <Textarea
                  value={scene.visualDescription ?? ''}
                  onChange={(e) => onUpdate({ visualDescription: e.target.value || undefined })}
                  rows={2}
                  placeholder="Modern office with sales dashboards on monitors, warm afternoon light..."
                  className="bg-zinc-800 border-zinc-700 text-white placeholder:text-zinc-600 text-sm resize-y"
                />
              </div>

              {/* Background Prompt */}
              <div className="space-y-1.5">
                <Label className="text-xs text-amber-500/80 uppercase tracking-wider font-semibold">
                  Background / Environment
                </Label>
                <input
                  type="text"
                  value={scene.backgroundPrompt ?? ''}
                  onChange={(e) => onUpdate({ backgroundPrompt: e.target.value || null })}
                  placeholder="Clean corporate office, glass walls, city skyline..."
                  className="w-full bg-zinc-800 border border-zinc-700 rounded px-3 py-2 text-sm text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
                />
              </div>

              {/* Duration */}
              <div className="flex items-center gap-3">
                <Label className="text-xs text-amber-500/80 uppercase tracking-wider font-semibold">
                  Duration
                </Label>
                <input
                  type="number"
                  value={scene.duration}
                  onChange={(e) => onUpdate({ duration: Math.max(1, Number(e.target.value)) })}
                  min={1}
                  max={120}
                  className="w-20 bg-zinc-800 border border-zinc-700 rounded px-3 py-1.5 text-sm text-white text-center focus:border-amber-500 focus:outline-none"
                />
                <span className="text-xs text-zinc-500">seconds</span>
              </div>
            </div>

            {/* Right: Cinematic Controls */}
            <div className="w-1/2 p-4 max-h-[600px] overflow-y-auto">
              <CinematicControlsPanel
                config={config}
                onChange={handleConfigChange}
                compact
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StepStoryboard() {
  const authFetch = useAuthFetch();
  const {
    projectId,
    projectName,
    brief,
    scenes,
    decompositionPlan,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
    voiceProvider,
    setDecompositionPlan,
    setScenes,
    addScene,
    updateScene,
    removeScene,
    setAvatar,
    setVoice,
    setStep,
    advanceStep,
  } = useVideoPipelineStore();

  const [isDecomposing, setIsDecomposing] = useState(false);
  const [decompositionError, setDecompositionError] = useState<string | null>(null);
  const [generatingPreviews, setGeneratingPreviews] = useState<Set<string>>(new Set());
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scenes' | 'avatar' | 'voice'>('scenes');
  const [isSaving, setIsSaving] = useState(false);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(null);
  const hasAutoDecomposed = useRef(false);

  // ── Auto-decompose on mount if no scenes yet ────────────────────────────
  useEffect(() => {
    if (
      !hasAutoDecomposed.current &&
      scenes.length === 0 &&
      !decompositionPlan &&
      brief.description.trim().length > 0
    ) {
      hasAutoDecomposed.current = true;
      void handleDecompose();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-load defaults ──────────────────────────────────────────────────
  useEffect(() => {
    if (!avatarId || !voiceId) {
      void (async () => {
        try {
          const res = await authFetch('/api/video/defaults');
          if (res.ok) {
            // Defaults available but not auto-applied — user must explicitly pick
          }
        } catch {
          // Non-critical
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);



  // ── Decompose ───────────────────────────────────────────────────────────
  const handleDecompose = useCallback(async () => {
    setIsDecomposing(true);
    setDecompositionError(null);

    try {
      const response = await authFetch('/api/video/decompose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: brief.description,
          videoType: brief.videoType,
          platform: brief.platform,
          duration: brief.duration,
          targetAudience: brief.targetAudience,
          painPoints: brief.painPoints,
          talkingPoints: brief.talkingPoints,
          tone: brief.tone,
          callToAction: brief.callToAction,
        }),
      });

      if (!response.ok) {
        const errData = (await response.json()) as { error?: string };
        throw new Error(errData.error ?? 'Decomposition failed');
      }

      const data = (await response.json()) as {
        success: boolean;
        plan: {
          scenes: {
            sceneNumber: number;
            title: string;
            scriptText: string;
            visualDescription: string;
            suggestedDuration: number;
            engine: string | null;
            backgroundPrompt: string | null;
          }[];
          [key: string]: unknown;
        };
      };

      if (data.success && data.plan) {
        setDecompositionPlan({
          videoType: brief.videoType,
          targetAudience: brief.targetAudience ?? '',
          keyMessages: [],
          scenes: data.plan.scenes.map((s) => ({ ...s, engine: 'hedra' as const })),
          assetsNeeded: [],
          avatarRecommendation: null,
          estimatedTotalDuration: data.plan.scenes.reduce((sum, s) => sum + s.suggestedDuration, 0),
          generatedBy: 'ai',
        });

        const pipelineScenes: PipelineScene[] = data.plan.scenes.map((scene) => ({
          id: crypto.randomUUID(),
          sceneNumber: scene.sceneNumber,
          title: scene.title,
          visualDescription: scene.visualDescription,
          scriptText: scene.scriptText,
          screenshotUrl: null,
          avatarId: null,
          voiceId: null,
          voiceProvider: null,
          duration: scene.suggestedDuration,
          engine: 'hedra',
          backgroundPrompt: scene.backgroundPrompt,
          status: 'draft' as const,
        }));

        setScenes(pipelineScenes);
        setSelectedSceneId(null);
      }
    } catch (err) {
      setDecompositionError(err instanceof Error ? err.message : 'Decomposition failed');
    } finally {
      setIsDecomposing(false);
    }
  }, [brief, authFetch, setDecompositionPlan, setScenes]);

  // ── Add scene manually ──────────────────────────────────────────────────
  const handleAddScene = useCallback(() => {
    addScene({
      sceneNumber: scenes.length + 1,
      title: '',
      scriptText: '',
      visualDescription: '',
      screenshotUrl: null,
      avatarId: null,
      voiceId: null,
      voiceProvider: null,
      duration: 5,
      engine: 'hedra',
      backgroundPrompt: null,
      status: 'draft',
    });
    // Auto-select the new scene for editing
    // The addScene creates with randomUUID internally, so we select after a tick
    setTimeout(() => {
      const store = useVideoPipelineStore.getState();
      const lastScene = store.scenes[store.scenes.length - 1];
      if (lastScene) {
        setSelectedSceneId(lastScene.id);
      }
    }, 50);
  }, [addScene, scenes.length]);

  // ── Generate and permanently save a preview image for a scene ─────────
  const handleGeneratePreview = useCallback(async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return;
    }

    setGeneratingPreviews((prev) => new Set(prev).add(sceneId));

    try {
      const cinematicDetails = scene.cinematicConfig
        ? Object.entries(scene.cinematicConfig)
            .filter(([key, val]) => val !== undefined && key !== 'temperature')
            .map(([, val]) => String(val))
            .join(', ')
        : '';

      const prompt = [
        'Cinematic storyboard frame, 16:9 aspect ratio.',
        scene.visualDescription ? `Shot type: ${scene.visualDescription}.` : '',
        scene.backgroundPrompt ? `Setting: ${scene.backgroundPrompt}.` : '',
        scene.title ? `Scene: ${scene.title}.` : '',
        cinematicDetails ? `Style: ${cinematicDetails}.` : '',
        'Professional video production style, photorealistic.',
      ].filter(Boolean).join(' ');

      // 1. Generate the image
      const response = await authFetch('/api/studio/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          type: 'image',
          size: '1920x1080',
          presets: { aspectRatio: '16:9', ...scene.cinematicConfig },
        }),
      });

      if (!response.ok) {
        const errorData = (await response.json().catch(() => null)) as { error?: string } | null;
        const msg = errorData?.error ?? `Preview generation failed (${response.status})`;
        setPreviewError(`Scene ${scene.sceneNumber}: ${msg}`);
        return;
      }

      const genData = (await response.json()) as { success: boolean; data?: { url?: string } };
      if (!genData.success || !genData.data?.url) {
        setPreviewError(`Scene ${scene.sceneNumber}: Preview generation returned no image`);
        return;
      }

      // 2. Save permanently to our Firestore (not dependent on provider CDN)
      const saveRes = await authFetch('/api/video/scene-preview/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          sceneId,
          projectId: projectId ?? 'unsaved',
          imageUrl: genData.data.url,
        }),
      });

      let permanentUrl = genData.data.url; // fallback to provider URL
      if (saveRes.ok) {
        const saveData = (await saveRes.json()) as { success: boolean; url?: string };
        if (saveData.success && saveData.url) {
          permanentUrl = saveData.url;
        }
      }

      // 3. Update scene in Zustand store
      updateScene(sceneId, { screenshotUrl: permanentUrl });

      // 4. Persist to Firestore project document so it survives reloads
      if (projectId) {
        authFetch(`/api/video/project/${projectId}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sceneId, updates: { screenshotUrl: permanentUrl } }),
        }).catch(() => { /* fire-and-forget */ });
      }

      setPreviewError(null);
    } catch (err) {
      setPreviewError(`Scene ${scene.sceneNumber}: ${err instanceof Error ? err.message : 'Preview generation failed'}`);
    } finally {
      setGeneratingPreviews((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  }, [scenes, authFetch, updateScene, projectId]);

  // ── Auto-generate previews for scenes that don't have one yet ─────────
  const hasAutoGenerated = useRef(false);
  useEffect(() => {
    if (hasAutoGenerated.current || scenes.length === 0) {
      return;
    }
    const needsPreview = scenes.filter((s) => !s.screenshotUrl);
    if (needsPreview.length === 0) {
      return;
    }
    hasAutoGenerated.current = true;
    void (async () => {
      for (const scene of needsPreview) {
        await handleGeneratePreview(scene.id);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scenes]);

  // ── Readiness checks ───────────────────────────────────────────────────
  const missingRequirements: string[] = [];
  if (scenes.length === 0) {
    missingRequirements.push('Add at least one scene');
  }
  if (scenes.some((s) => !s.scriptText.trim())) {
    missingRequirements.push('All scenes need scripts');
  }

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const isReady = missingRequirements.length === 0;

  // ── Save storyboard to Firestore and advance ───────────────────────────
  const handleApproveAndGenerate = useCallback(async () => {
    if (!isReady) {
      return;
    }
    setIsSaving(true);
    try {
      await authFetch('/api/video/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ?? undefined,
          name: projectName || brief.description.slice(0, 50) || 'Untitled Video',
          brief,
          currentStep: 'approval',
          scenes: scenes.map((s) => ({
            id: s.id,
            sceneNumber: s.sceneNumber,
            title: s.title,
            visualDescription: s.visualDescription,
            scriptText: s.scriptText,
            screenshotUrl: s.screenshotUrl ?? null,
            avatarId: s.avatarId ?? null,
            voiceId: s.voiceId ?? null,
            voiceProvider: s.voiceProvider ?? null,
            duration: s.duration,
            engine: s.engine ?? 'hedra',
            backgroundPrompt: s.backgroundPrompt ?? null,
            cinematicConfig: s.cinematicConfig,
            status: s.status,
          })),
          avatarId: avatarId ?? null,
          avatarName: avatarName ?? null,
          voiceId: voiceId ?? null,
          voiceName: voiceName ?? null,
          voiceProvider: voiceProvider ?? null,
          status: 'approved',
        }),
      });
    } catch {
      // Non-critical — continue to generation even if save fails
    } finally {
      setIsSaving(false);
    }
    advanceStep();
  }, [isReady, authFetch, projectId, projectName, brief, scenes, avatarId, avatarName, voiceId, voiceName, voiceProvider, advanceStep]);

  const selectedScene = selectedSceneId ? scenes.find((s) => s.id === selectedSceneId) : null;
  const selectedSceneIndex = selectedScene ? scenes.indexOf(selectedScene) : -1;

  // ════════════════════════════════════════════════════════════════════════
  // Render
  // ════════════════════════════════════════════════════════════════════════

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Layers className="w-5 h-5 text-amber-500" />
            Storyboard
          </h2>
          <p className="text-xs text-zinc-400 mt-0.5">
            Review scenes, edit scripts &amp; cinematic settings — previews generate automatically
          </p>
        </div>
        <div className="flex items-center gap-2">
          {generatingPreviews.size > 0 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-400">
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
              Generating previews ({generatingPreviews.size} remaining)
            </div>
          )}
          <Button
            size="sm"
            variant="outline"
            className="gap-1.5 text-xs"
            onClick={handleAddScene}
          >
            <Plus className="w-3.5 h-3.5" />
            Add Scene
          </Button>
        </div>
      </div>

      {/* Preview Error Banner */}
      {previewError && (
        <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-red-500/10 border border-red-500/20">
          <div className="flex items-center gap-2 text-xs text-red-400">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            {previewError}
          </div>
          <button
            type="button"
            className="text-red-400/60 hover:text-red-400 text-xs"
            onClick={() => setPreviewError(null)}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Summary Bar */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6 text-xs text-zinc-400">
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                {scenes.length} scenes
              </span>
              <span className="flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5" />
                {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5" />
                {avatarName ?? <span className="text-zinc-600">No character</span>}
              </span>
              <span className="flex items-center gap-1.5">
                <Mic className="w-3.5 h-3.5" />
                {voiceName ?? <span className="text-zinc-600">No voice</span>}
              </span>
            </div>
            <p className="text-[10px] text-zinc-600">
              Click a scene to edit its cinematic settings
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Decomposition Loading */}
      {isDecomposing && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-8 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
            <p className="text-sm text-zinc-300">AI is breaking down your concept into scenes...</p>
          </CardContent>
        </Card>
      )}

      {decompositionError && (
        <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0" />
          <p className="text-sm text-red-400">{decompositionError}</p>
          <Button size="sm" variant="ghost" onClick={() => { void handleDecompose(); }} className="ml-auto text-red-400">
            Retry
          </Button>
        </div>
      )}

      {/* Tabs: Scenes / Avatar / Voice */}
      <div className="flex gap-1 border-b border-zinc-800 pb-0">
        {[
          { id: 'scenes' as const, label: 'Scenes', icon: Layers, count: scenes.length },
          { id: 'avatar' as const, label: 'Character', icon: Users, badge: avatarName },
          { id: 'voice' as const, label: 'Voice', icon: Mic, badge: voiceName },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-1.5 px-4 py-2 text-xs font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-amber-500 text-amber-400'
                : 'border-transparent text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
            {tab.count !== undefined && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0">{tab.count}</Badge>
            )}
            {tab.badge && (
              <Badge variant="secondary" className="ml-1 text-[10px] px-1.5 py-0 bg-green-500/20 text-green-400">{tab.badge}</Badge>
            )}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'scenes' && (
        <>
          {scenes.length === 0 && !isDecomposing ? (
            <Card className="bg-zinc-900/50 border-zinc-800 border-dashed">
              <CardContent className="p-12 flex flex-col items-center text-center">
                <Layers className="w-12 h-12 text-zinc-700 mb-3" />
                <p className="text-zinc-400 text-sm mb-1">No scenes yet</p>
                <p className="text-zinc-600 text-xs mb-4">
                  Add scenes manually or go back to Studio to describe your concept for AI decomposition
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleAddScene}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Scene
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setStep('request')}>
                    <ArrowLeft className="w-3.5 h-3.5" />
                    Back to Studio
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Scene grid */}
              <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                <AnimatePresence mode="popLayout">
                  {scenes.map((scene, idx) => (
                    <SceneCard
                      key={scene.id}
                      scene={scene}
                      index={idx}
                      isSelected={selectedSceneId === scene.id}
                      onSelect={() => setSelectedSceneId(
                        selectedSceneId === scene.id ? null : scene.id,
                      )}
                      onDelete={() => {
                        removeScene(scene.id);
                        if (selectedSceneId === scene.id) {
                          setSelectedSceneId(null);
                        }
                      }}
                      onDuplicate={() => {
                        addScene({
                          ...scene,
                          sceneNumber: scenes.length + 1,
                          title: `${scene.title ?? `Scene ${idx + 1}`} (copy)`,
                          screenshotUrl: null,
                        });
                      }}
                      onGeneratePreview={() => { void handleGeneratePreview(scene.id); }}
                      isGeneratingPreview={generatingPreviews.has(scene.id)}
                    />
                  ))}
                </AnimatePresence>

                {/* Add scene card */}
                <button
                  type="button"
                  onClick={handleAddScene}
                  className="aspect-video bg-zinc-900/30 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-600 hover:text-amber-500 hover:border-amber-500/50 transition-colors"
                >
                  <Plus className="w-8 h-8 mb-1" />
                  <span className="text-xs font-medium">Add Scene</span>
                </button>
              </div>

              {/* Expanded Scene Editor */}
              <AnimatePresence>
                {selectedScene && (
                  <SceneDetailEditor
                    key={selectedScene.id}
                    scene={selectedScene}
                    index={selectedSceneIndex}
                    onUpdate={(updates) => updateScene(selectedScene.id, updates)}
                    onClose={() => setSelectedSceneId(null)}
                  />
                )}
              </AnimatePresence>
            </>
          )}
        </>
      )}

      {activeTab === 'avatar' && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <AvatarPicker
              selectedAvatarId={avatarId}
              onSelect={(id: string, name: string) => setAvatar(id, name)}
            />
          </CardContent>
        </Card>
      )}

      {activeTab === 'voice' && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-4">
            <VoicePicker
              selectedVoiceId={voiceId}
              onSelect={(id, name, provider) => setVoice(id, name, provider)}
            />
          </CardContent>
        </Card>
      )}

      {/* Readiness / Validation */}
      {missingRequirements.length > 0 && scenes.length > 0 && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-xs font-medium text-amber-400 mb-1">Before generating:</p>
          <ul className="text-xs text-amber-400/70 space-y-0.5">
            {missingRequirements.map((req) => (
              <li key={req} className="flex items-center gap-1.5">
                <AlertCircle className="w-3 h-3" />
                {req}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Footer Actions */}
      <div className="flex justify-between items-center pt-2">
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => setStep('request')}
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Studio
        </Button>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2 text-[10px] text-zinc-500">
            <span className="flex items-center gap-1">
              <Layers className="w-3 h-3" />
              {scenes.length} scenes
            </span>
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" />
              {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}
            </span>
          </div>

          <Button
            size="sm"
            className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
            disabled={!isReady || isSaving}
            onClick={() => { void handleApproveAndGenerate(); }}
          >
            {isSaving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <CheckCircle2 className="w-4 h-4" />
            )}
            {isSaving ? 'Saving...' : 'Approve & Generate'}
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
