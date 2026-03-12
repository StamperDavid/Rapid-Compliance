'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { motion } from 'framer-motion';
import { Film, ArrowRight, ArrowLeft, Plus, CheckCircle2, Star, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { SceneEditor } from './SceneEditor';
import { AvatarPicker } from './AvatarPicker';
import { AvatarUpload } from './AvatarUpload';
import { GreenScreenClipManager } from './GreenScreenClipManager';
import { VoicePicker } from './VoicePicker';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import type { PipelineScene } from '@/types/video-pipeline';

interface VideoDefaultsData {
  avatarId: string | null;
  avatarName: string | null;
  voiceId: string | null;
  voiceName: string | null;
  voiceProvider: 'elevenlabs' | 'unrealspeech' | 'custom' | 'hedra' | null;
}

export function StepPreProduction() {
  const authFetch = useAuthFetch();
  const {
    scenes,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
    voiceProvider,
    updateScene,
    removeScene,
    addScene,
    setAvatar,
    setVoice,
    setStep,
    advanceStep,
    canAdvanceTo,
  } = useVideoPipelineStore();

  const [activeTab, setActiveTab] = useState<'scenes' | 'avatar' | 'voice'>('scenes');
  const [savingDefault, setSavingDefault] = useState(false);
  const [defaultSaved, setDefaultSaved] = useState(false);

  // Track selected avatar profile's green screen clips for clip manager
  const [selectedProfileClips, setSelectedProfileClips] = useState<
    Array<{ id: string; videoUrl: string; thumbnailUrl: string | null; script: string; duration: number; createdAt: string }>
  >([]);
  const [selectedProfileTier, setSelectedProfileTier] = useState<'premium' | 'standard'>('standard');

  // Auto-load defaults when no avatar/voice is selected
  const loadDefaults = useCallback(async () => {
    if (avatarId || voiceId) { return; } // Already have selections

    try {
      const response = await authFetch('/api/video/defaults');
      if (!response.ok) { return; }

      const data = await response.json() as { success: boolean; defaults: VideoDefaultsData };
      if (!data.success || !data.defaults) { return; }

      // Do NOT auto-select avatar or voice. Prompt-only mode (no avatar) lets
      // Hedra generate characters from the text descriptions. The user must
      // explicitly pick an avatar/voice if they want Character 3 mode.
      const _d = data.defaults; // Defaults available but not auto-applied
    } catch {
      // Defaults are optional — don't break the flow
    }
  }, [avatarId, voiceId, authFetch]);

  useEffect(() => {
    void loadDefaults();
  }, [loadDefaults]);

  const handleSaveDefaults = async () => {
    setSavingDefault(true);
    setDefaultSaved(false);
    try {
      const response = await authFetch('/api/video/defaults', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          avatarId,
          avatarName,
          voiceId,
          voiceName,
          voiceProvider,
        }),
      });
      if (response.ok) {
        setDefaultSaved(true);
        setTimeout(() => setDefaultSaved(false), 3000);
      }
    } catch {
      // Silent fail for defaults
    } finally {
      setSavingDefault(false);
    }
  };

  const handleAddScene = () => {
    const newScene: PipelineScene = {
      id: crypto.randomUUID(),
      sceneNumber: scenes.length + 1,
      scriptText: '',
      screenshotUrl: null,
      avatarId: null,
      voiceId: null,
      voiceProvider: null,
      duration: 15,
      engine: null,
      backgroundPrompt: null,
      status: 'draft',
    };
    addScene(newScene);
  };

  const handleDuplicate = (scene: PipelineScene) => {
    const newScene: PipelineScene = {
      ...scene,
      id: crypto.randomUUID(),
      sceneNumber: scenes.length + 1,
      status: 'draft',
    };
    addScene(newScene);
  };

  const handleBack = () => {
    setStep('decompose');
  };

  const handleFinalize = () => {
    advanceStep();
  };

  const tabs = [
    { key: 'scenes' as const, label: 'Scenes', count: scenes.length },
    { key: 'avatar' as const, label: 'Avatar', selected: avatarName },
    { key: 'voice' as const, label: 'Voice', selected: voiceName },
  ];

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Film className="w-5 h-5 text-amber-500" />
            Pre-Production
          </CardTitle>
          <CardDescription>
            Edit your scenes, choose an avatar presenter, and select a voice.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 bg-zinc-800/50 rounded-lg w-fit">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                  activeTab === tab.key
                    ? 'bg-zinc-700 text-white'
                    : 'text-zinc-400 hover:text-zinc-300'
                }`}
              >
                {tab.label}
                {'count' in tab && (
                  <span className="ml-1.5 px-1.5 py-0.5 bg-zinc-600 rounded-full text-xs">{tab.count}</span>
                )}
                {'selected' in tab && tab.selected && (
                  <span className="ml-1.5 text-xs text-amber-400">({tab.selected})</span>
                )}
              </button>
            ))}
          </div>

          {/* Scenes Tab */}
          {activeTab === 'scenes' && (
            <div className="space-y-3">
              {scenes.map((scene) => (
                <motion.div
                  key={scene.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                >
                  <SceneEditor
                    scene={scene}
                    onUpdate={updateScene}
                    onDelete={removeScene}
                    onDuplicate={handleDuplicate}
                  />
                </motion.div>
              ))}
              <Button
                variant="outline"
                onClick={handleAddScene}
                className="w-full border-dashed border-zinc-700 text-zinc-400 hover:text-white hover:border-zinc-600 gap-2"
              >
                <Plus className="w-4 h-4" />
                Add Scene
              </Button>
            </div>
          )}

          {/* Avatar Tab */}
          {activeTab === 'avatar' && (
            <div>
              <p className="text-sm text-zinc-400 mb-4">
                Select an AI avatar to present your video — this is your main character.
                {avatarName && (
                  <span className="text-amber-400"> Selected: {avatarName}</span>
                )}
                {selectedProfileTier === 'premium' && (
                  <span className="ml-1 text-purple-400">(Premium)</span>
                )}
              </p>
              <AvatarPicker
                selectedAvatarId={avatarId}
                onSelect={(id, name) => setAvatar(id, name)}
                onProfileLoaded={(profile) => {
                  setSelectedProfileClips(profile.greenScreenClips ?? []);
                  setSelectedProfileTier(profile.tier ?? 'standard');
                }}
              />

              {/* Green Screen Clip Manager — shown when a profile is selected */}
              {avatarId && (
                <div className="mt-6">
                  <GreenScreenClipManager
                    profileId={avatarId}
                    profileName={avatarName ?? 'Avatar'}
                    clips={selectedProfileClips}
                    onClipsChange={(newClips) => {
                      setSelectedProfileClips(newClips);
                      setSelectedProfileTier(newClips.length > 0 ? 'premium' : 'standard');
                    }}
                  />
                </div>
              )}

              <div className="mt-6">
                <AvatarUpload
                  onAvatarCreated={(id, name) => setAvatar(id, name)}
                />
              </div>
            </div>
          )}

          {/* Voice Tab */}
          {activeTab === 'voice' && (
            <div>
              <p className="text-sm text-zinc-400 mb-4">
                Choose a voice for your avatar. {voiceName && (
                  <span className="text-amber-400">Selected: {voiceName}</span>
                )}
              </p>
              <VoicePicker
                selectedVoiceId={voiceId}
                onSelect={(id, name, provider) => setVoice(id, name, provider)}
              />
            </div>
          )}
        </CardContent>
      </Card>

      {/* Validation Summary */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-800/30 rounded-lg border border-zinc-700/50">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${scenes.length > 0 ? 'bg-green-500' : 'bg-zinc-600'}`} />
            <span className="text-xs text-zinc-400">{scenes.length} scenes</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${avatarId ? 'bg-green-500' : 'bg-zinc-600'}`} />
            <span className="text-xs text-zinc-400">{avatarId ? 'Avatar selected' : 'No avatar'}</span>
          </div>
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${voiceId ? 'bg-green-500' : 'bg-zinc-600'}`} />
            <span className="text-xs text-zinc-400">{voiceId ? 'Voice selected' : 'No voice'}</span>
          </div>
        </div>

        {/* Set as Default */}
        {(avatarId ?? voiceId) && (
          <Button
            variant="ghost"
            size="sm"
            onClick={() => { void handleSaveDefaults(); }}
            disabled={savingDefault}
            className="gap-1.5 text-xs text-zinc-400 hover:text-amber-400"
          >
            {savingDefault ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : defaultSaved ? (
              <CheckCircle2 className="w-3 h-3 text-green-400" />
            ) : (
              <Star className="w-3 h-3" />
            )}
            {defaultSaved ? 'Defaults saved!' : 'Set as Default'}
          </Button>
        )}
      </div>

      {/* Actions */}
      <div className="flex justify-between">
        <Button onClick={handleBack} variant="outline" className="gap-2">
          <ArrowLeft className="w-4 h-4" />
          Back to Plan
        </Button>
        <Button
          onClick={handleFinalize}
          disabled={!canAdvanceTo('approval')}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
        >
          <CheckCircle2 className="w-4 h-4" />
          Finalize Storyboard
          <ArrowRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
