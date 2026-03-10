'use client';

/**
 * StepStoryboard — Visual storyboard builder
 *
 * Merges the old Decompose + Pre-Production + Approval steps into one.
 * Shows a visual grid of scene cards with AI-generated preview images,
 * guided dropdowns (visual direction, background, mood), inline script
 * editing, avatar/voice selection, and cost estimation.
 */

import { useState, useCallback, useEffect, useRef } from 'react';
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
  RefreshCw,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import { AvatarPicker } from './AvatarPicker';
import { VoicePicker } from './VoicePicker';
import {
  VISUAL_DIRECTION_PRESETS,
  BACKGROUND_PRESETS,
  MOOD_PRESETS,
  type PresetOption,
} from './storyboard-presets';
import type { PipelineScene } from '@/types/video-pipeline';

// ============================================================================
// Preset Select Component
// ============================================================================

interface PresetSelectProps {
  label: string;
  value: string;
  presets: PresetOption[];
  onChange: (value: string) => void;
  placeholder?: string;
}

function PresetSelect({ label, value, presets, onChange, placeholder }: PresetSelectProps) {
  const isCustom = value !== '' && !presets.some((p) => p.value === value && p.value !== 'other');
  const [showCustom, setShowCustom] = useState(isCustom);
  const [customText, setCustomText] = useState(isCustom ? value : '');

  const handleSelectChange = (selected: string) => {
    if (selected === 'other') {
      setShowCustom(true);
      // Don't change value yet — wait for custom input
    } else {
      setShowCustom(false);
      setCustomText('');
      onChange(selected);
    }
  };

  const handleCustomBlur = () => {
    if (customText.trim()) {
      onChange(customText.trim());
    }
  };

  return (
    <div className="space-y-1">
      <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">{label}</label>
      <select
        value={showCustom ? 'other' : value}
        onChange={(e) => handleSelectChange(e.target.value)}
        className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white focus:border-amber-500 focus:outline-none"
      >
        <option value="">{placeholder ?? `Select ${label.toLowerCase()}...`}</option>
        {presets.map((p) => (
          <option key={p.value} value={p.value}>{p.label}</option>
        ))}
      </select>
      {showCustom && (
        <input
          type="text"
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          onBlur={handleCustomBlur}
          onKeyDown={(e) => { if (e.key === 'Enter') { handleCustomBlur(); } }}
          placeholder={`Describe ${label.toLowerCase()}...`}
          className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white placeholder:text-zinc-600 focus:border-amber-500 focus:outline-none"
          autoFocus
        />
      )}
    </div>
  );
}

// ============================================================================
// Scene Card Component
// ============================================================================

interface SceneCardProps {
  scene: PipelineScene;
  index: number;
  onUpdate: (updates: Partial<PipelineScene>) => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onGeneratePreview: () => void;
  isGeneratingPreview: boolean;
}

function SceneCard({
  scene,
  index,
  onUpdate,
  onDelete,
  onDuplicate,
  onGeneratePreview,
  isGeneratingPreview,
}: SceneCardProps) {
  const [editingScript, setEditingScript] = useState(false);

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      className="bg-zinc-900/80 border border-zinc-800 rounded-lg overflow-hidden"
    >
      {/* Preview Image */}
      <div className="relative aspect-video bg-zinc-800/50 group">
        {scene.screenshotUrl ? (
          <Image
            src={scene.screenshotUrl}
            alt={`Scene ${index + 1}`}
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-600">
            <ImageIcon className="w-8 h-8 mb-1" />
            <span className="text-[10px]">No preview</span>
          </div>
        )}

        {/* Shot number badge */}
        <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold px-2 py-0.5 rounded">
          Shot {index + 1}
        </div>

        {/* Action buttons overlay */}
        <div className="absolute top-2 right-2 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            onClick={onGeneratePreview}
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
            onClick={onDuplicate}
            className="bg-black/70 hover:bg-zinc-600 text-white p-1.5 rounded transition-colors"
            title="Duplicate scene"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={onDelete}
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
      </div>

      {/* Scene Details */}
      <div className="p-3 space-y-2">
        {/* Title */}
        <input
          type="text"
          value={scene.title ?? ''}
          onChange={(e) => onUpdate({ title: e.target.value || undefined })}
          placeholder={`Scene ${index + 1} title...`}
          className="w-full bg-transparent text-sm font-semibold text-white placeholder:text-zinc-600 focus:outline-none border-b border-transparent focus:border-amber-500/50 pb-0.5"
        />

        {/* Script */}
        <div>
          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Script</label>
          {editingScript ? (
            <textarea
              value={scene.scriptText}
              onChange={(e) => onUpdate({ scriptText: e.target.value })}
              onBlur={() => setEditingScript(false)}
              rows={3}
              className="w-full bg-zinc-800 border border-zinc-700 rounded px-2 py-1.5 text-xs text-white mt-1 focus:border-amber-500 focus:outline-none resize-none"
              autoFocus
            />
          ) : (
            <p
              onClick={() => setEditingScript(true)}
              className="text-xs text-zinc-300 mt-1 cursor-text hover:bg-zinc-800/50 rounded px-1 py-0.5 min-h-[3em] line-clamp-3"
            >
              {scene.scriptText || <span className="italic text-zinc-600">Click to add script...</span>}
            </p>
          )}
        </div>

        {/* Dropdowns */}
        <PresetSelect
          label="Visual Direction"
          value={scene.visualDescription ?? ''}
          presets={VISUAL_DIRECTION_PRESETS}
          onChange={(val) => onUpdate({ visualDescription: val })}
          placeholder="Select shot type..."
        />

        <PresetSelect
          label="Background"
          value={scene.backgroundPrompt ?? ''}
          presets={BACKGROUND_PRESETS}
          onChange={(val) => onUpdate({ backgroundPrompt: val })}
          placeholder="Select background..."
        />

        {/* Duration */}
        <div className="flex items-center gap-2">
          <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Duration</label>
          <input
            type="number"
            value={scene.duration}
            onChange={(e) => onUpdate({ duration: Math.max(1, Number(e.target.value)) })}
            min={1}
            max={60}
            className="w-16 bg-zinc-800 border border-zinc-700 rounded px-2 py-1 text-xs text-white text-center focus:border-amber-500 focus:outline-none"
          />
          <span className="text-[10px] text-zinc-500">sec</span>
        </div>
      </div>
    </motion.div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export function StepStoryboard() {
  const authFetch = useAuthFetch();
  const {
    brief,
    scenes,
    decompositionPlan,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
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
  const [activeTab, setActiveTab] = useState<'scenes' | 'avatar' | 'voice'>('scenes');
  const [projectMood, setProjectMood] = useState<string>('');
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
            const data = (await res.json()) as {
              success: boolean;
              defaults: { avatarId?: string; avatarName?: string; voiceId?: string; voiceName?: string; voiceProvider?: string };
            };
            if (data.success && data.defaults) {
              if (!avatarId && data.defaults.avatarId && data.defaults.avatarName) {
                setAvatar(data.defaults.avatarId, data.defaults.avatarName);
              }
              if (!voiceId && data.defaults.voiceId && data.defaults.voiceName) {
                setVoice(
                  data.defaults.voiceId,
                  data.defaults.voiceName,
                  (data.defaults.voiceProvider as 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra') ?? 'hedra',
                );
              }
            }
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
        // API may return a partial plan — fill required DecompositionPlan fields
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

        // Convert to PipelineScenes
        const pipelineScenes: Omit<PipelineScene, 'id'>[] = data.plan.scenes.map((scene) => ({
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

        setScenes(pipelineScenes.map((s) => ({ ...s, id: crypto.randomUUID() })));
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
  }, [addScene, scenes.length]);

  // ── Generate preview image for a scene ─────────────────────────────────
  const handleGeneratePreview = useCallback(async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) { return; }

    setGeneratingPreviews((prev) => new Set(prev).add(sceneId));

    try {
      const prompt = [
        'Cinematic storyboard frame, 16:9 aspect ratio.',
        scene.visualDescription ? `Shot type: ${scene.visualDescription}.` : '',
        scene.backgroundPrompt ? `Setting: ${scene.backgroundPrompt}.` : '',
        scene.title ? `Scene: ${scene.title}.` : '',
        projectMood ? `Mood: ${projectMood}.` : '',
        'Professional video production style, photorealistic.',
      ].filter(Boolean).join(' ');

      const response = await authFetch('/api/ai/generate-image', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          size: '1792x1024',
          quality: 'standard',
          style: 'vivid',
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as { success: boolean; imageUrl?: string };
        if (data.success && data.imageUrl) {
          updateScene(sceneId, { screenshotUrl: data.imageUrl });
        }
      }
    } catch {
      // Non-critical — preview generation failure doesn't block workflow
    } finally {
      setGeneratingPreviews((prev) => {
        const next = new Set(prev);
        next.delete(sceneId);
        return next;
      });
    }
  }, [scenes, projectMood, authFetch, updateScene]);

  // ── Readiness checks ───────────────────────────────────────────────────
  const missingRequirements: string[] = [];
  if (scenes.length === 0) { missingRequirements.push('Add at least one scene'); }
  if (!avatarId) { missingRequirements.push('Select a character'); }
  if (!voiceId) { missingRequirements.push('Select a voice'); }
  if (scenes.some((s) => !s.scriptText.trim())) { missingRequirements.push('All scenes need scripts'); }

  const totalDuration = scenes.reduce((sum, s) => sum + s.duration, 0);
  const isReady = missingRequirements.length === 0;

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
            Build your visual storyboard — add scenes, set directions, preview shots
          </p>
        </div>
        <div className="flex items-center gap-2">
          {scenes.length > 0 && (
            <Button
              size="sm"
              variant="outline"
              className="gap-1.5 text-xs"
              onClick={() => { void handleDecompose(); }}
              disabled={isDecomposing}
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isDecomposing ? 'animate-spin' : ''}`} />
              Regenerate
            </Button>
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

      {/* Project-wide Mood Selector */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardContent className="p-3">
          <div className="grid grid-cols-3 gap-3">
            <PresetSelect
              label="Project Mood"
              value={projectMood}
              presets={MOOD_PRESETS}
              onChange={setProjectMood}
              placeholder="Select overall mood..."
            />
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Scenes</label>
              <p className="text-sm text-white font-medium">{scenes.length} scenes · {Math.floor(totalDuration / 60)}:{String(Math.floor(totalDuration % 60)).padStart(2, '0')}</p>
            </div>
            <div className="space-y-1">
              <label className="text-[10px] font-medium text-zinc-500 uppercase tracking-wider">Cast</label>
              <p className="text-sm text-white font-medium">
                {avatarName ?? <span className="text-zinc-500">No character</span>}
                {' · '}
                {voiceName ?? <span className="text-zinc-500">No voice</span>}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Decomposition Loading */}
      {isDecomposing && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardContent className="p-8 flex flex-col items-center">
            <Loader2 className="w-8 h-8 animate-spin text-amber-500 mb-3" />
            <p className="text-sm text-zinc-300">AI is breaking down your brief into scenes...</p>
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
                  Add scenes manually or let AI decompose your brief
                </p>
                <div className="flex gap-2">
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={handleAddScene}>
                    <Plus className="w-3.5 h-3.5" />
                    Add Scene
                  </Button>
                  {brief.description.trim().length > 0 && (
                    <Button size="sm" className="gap-1.5 bg-amber-600 hover:bg-amber-700" onClick={() => { void handleDecompose(); }}>
                      <Sparkles className="w-3.5 h-3.5" />
                      AI Decompose
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              <AnimatePresence mode="popLayout">
                {scenes.map((scene, idx) => (
                  <SceneCard
                    key={scene.id}
                    scene={scene}
                    index={idx}
                    onUpdate={(updates) => updateScene(scene.id, updates)}
                    onDelete={() => removeScene(scene.id)}
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
                onClick={handleAddScene}
                className="aspect-video bg-zinc-900/30 border-2 border-dashed border-zinc-700 rounded-lg flex flex-col items-center justify-center text-zinc-600 hover:text-amber-500 hover:border-amber-500/50 transition-colors"
              >
                <Plus className="w-8 h-8 mb-1" />
                <span className="text-xs font-medium">Add Scene</span>
              </button>
            </div>
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
          Edit Brief
        </Button>

        <div className="flex items-center gap-3">
          {/* Summary badges */}
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
            disabled={!isReady}
            onClick={() => advanceStep()}
          >
            <CheckCircle2 className="w-4 h-4" />
            Approve &amp; Generate
            <ArrowRight className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>
    </div>
  );
}
