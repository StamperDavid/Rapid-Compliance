'use client';

import { useState } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { Wand2, Download, Save, RefreshCw, Play, Edit3, Loader2, CheckCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VideoPlayer } from './VideoPlayer';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';

export function StepPostProduction() {
  const authFetch = useAuthFetch();
  const {
    projectId,
    projectName,
    scenes,
    generatedScenes,
    finalVideoUrl,
    avatarId,
    avatarName,
    voiceId,
    voiceName,
    brief,
    transitionType,
    updateScene,
    updateGeneratedScene,
    setFinalVideoUrl,
    setStep,
    setProjectId,
  } = useVideoPipelineStore();

  const [editingSceneId, setEditingSceneId] = useState<string | null>(null);
  const [regenerating, setRegenerating] = useState<string | null>(null);
  const [reassembling, setReassembling] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleRegenerateScene = async (sceneId: string) => {
    const scene = scenes.find((s) => s.id === sceneId);
    if (!scene) {
      return;
    }

    setRegenerating(sceneId);
    updateGeneratedScene(sceneId, { status: 'generating', progress: 0 });

    try {
      const response = await authFetch('/api/video/regenerate-scene', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'local',
          sceneId,
          scriptText: scene.scriptText,
          screenshotUrl: scene.screenshotUrl,
          avatarId,
          voiceId,
          aspectRatio: brief.aspectRatio,
          duration: scene.duration,
        }),
      });

      if (!response.ok) {
        throw new Error('Regeneration failed');
      }

      const data = await response.json() as { success: boolean; result: { status: string; videoUrl: string | null; error: string | null } };
      if (data.success) {
        updateGeneratedScene(sceneId, {
          status: data.result.status === 'completed' ? 'completed' : 'failed',
          videoUrl: data.result.videoUrl,
          error: data.result.error,
        });
      }
    } catch {
      updateGeneratedScene(sceneId, { status: 'failed', error: 'Regeneration failed' });
    } finally {
      setRegenerating(null);
    }
  };

  const handleReassemble = async () => {
    setReassembling(true);
    try {
      const sceneUrls = generatedScenes
        .filter((s) => s.status === 'completed' && s.videoUrl)
        .map((s) => s.videoUrl)
        .filter((url): url is string => url !== null);

      const response = await authFetch('/api/video/assemble', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: 'local',
          sceneUrls,
          transitionType: 'fade',
        }),
      });

      if (!response.ok) {
        throw new Error('Reassembly failed');
      }

      const data = await response.json() as { success: boolean; videoUrl: string };
      if (data.success) {
        setFinalVideoUrl(data.videoUrl);
      }
    } catch {
      // Error silently handled
    } finally {
      setReassembling(false);
    }
  };

  const handleSaveToLibrary = async () => {
    setSaving(true);
    setSaved(false);

    try {
      const response = await authFetch('/api/video/project/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ?? undefined,
          name: projectName || brief.description.slice(0, 50) || 'Untitled Video',
          brief,
          currentStep: 'post-production',
          scenes,
          avatarId,
          avatarName,
          voiceId,
          voiceName,
          generatedScenes,
          finalVideoUrl,
          transitionType,
          status: finalVideoUrl ? 'completed' : 'assembled',
        }),
      });

      if (!response.ok) {
        throw new Error('Save failed');
      }

      const data = await response.json() as { success: boolean; projectId: string };
      if (data.success && data.projectId) {
        setProjectId(data.projectId);
        setSaved(true);
        // Reset saved indicator after 3 seconds
        setTimeout(() => { setSaved(false); }, 3000);
      }
    } catch {
      // Save error silently — button returns to default state
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Final Video Preview */}
      {finalVideoUrl && (
        <Card className="bg-zinc-900/50 border-zinc-800">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-white">
              <Wand2 className="w-5 h-5 text-amber-500" />
              Final Video
            </CardTitle>
          </CardHeader>
          <CardContent>
            <VideoPlayer src={finalVideoUrl} className="rounded-lg" />
          </CardContent>
        </Card>
      )}

      {/* Scene Timeline Editor */}
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="text-white text-lg">Scene Timeline</CardTitle>
          <CardDescription>
            Edit scripts, re-generate individual scenes, or reorder them.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {scenes.map((scene, index) => {
            const genResult = generatedScenes.find((g) => g.sceneId === scene.id);
            const isRegenerating = regenerating === scene.id;

            return (
              <div
                key={scene.id}
                className="flex items-start gap-4 p-4 bg-zinc-800/30 rounded-lg border border-zinc-700/50"
              >
                {/* Scene Number */}
                <div className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-full bg-amber-500/20 text-amber-400 text-sm font-bold">
                  {index + 1}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0 space-y-2">
                  {editingSceneId === scene.id ? (
                    <div className="space-y-2">
                      <textarea
                        value={scene.scriptText}
                        onChange={(e) => updateScene(scene.id, { scriptText: e.target.value })}
                        className="w-full h-20 px-3 py-2 bg-zinc-900 border border-amber-500/50 rounded-lg text-sm text-white focus:outline-none resize-none"
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setEditingSceneId(null)}
                          className="text-xs"
                        >
                          Done
                        </Button>
                        <Button
                          size="sm"
                          onClick={() => { setEditingSceneId(null); void handleRegenerateScene(scene.id); }}
                          disabled={isRegenerating}
                          className="text-xs bg-amber-600 hover:bg-amber-700 gap-1"
                        >
                          <RefreshCw className="w-3 h-3" />
                          Save & Re-generate
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p
                      className="text-sm text-zinc-200 cursor-pointer hover:text-white group"
                      onClick={() => setEditingSceneId(scene.id)}
                    >
                      {scene.scriptText}
                      <Edit3 className="w-3 h-3 inline ml-2 opacity-0 group-hover:opacity-50" />
                    </p>
                  )}

                  <div className="flex items-center gap-3 text-xs text-zinc-500">
                    <span>{scene.duration}s</span>
                    {genResult && (
                      <span className={genResult.status === 'completed' ? 'text-green-400' : genResult.status === 'failed' ? 'text-red-400' : 'text-amber-400'}>
                        {genResult.status}
                      </span>
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex-shrink-0 flex items-center gap-1">
                  {genResult?.videoUrl && (
                    <a href={genResult.videoUrl} target="_blank" rel="noopener noreferrer">
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-zinc-400 hover:text-white">
                        <Play className="w-4 h-4" />
                      </Button>
                    </a>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => { void handleRegenerateScene(scene.id); }}
                    disabled={isRegenerating}
                    className="h-8 w-8 p-0 text-zinc-400 hover:text-amber-400"
                  >
                    {isRegenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Actions */}
      <div className="flex justify-between">
        <Button onClick={() => setStep('assembly')} variant="outline" className="gap-2">
          Back to Assembly
        </Button>
        <div className="flex gap-2">
          <Button
            onClick={() => { void handleReassemble(); }}
            disabled={reassembling}
            variant="outline"
            className="gap-2"
          >
            {reassembling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Re-assemble
          </Button>
          {finalVideoUrl && (
            <a href={finalVideoUrl} download>
              <Button className="gap-2 bg-green-600 hover:bg-green-700 text-white">
                <Download className="w-4 h-4" />
                Download Video
              </Button>
            </a>
          )}
          <Button
            variant="outline"
            className={`gap-2 ${saved ? 'border-green-500 text-green-400' : ''}`}
            onClick={() => { void handleSaveToLibrary(); }}
            disabled={saving}
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : saved ? (
              <CheckCircle className="w-4 h-4 text-green-400" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save to Library'}
          </Button>
        </div>
      </div>
    </div>
  );
}
