'use client';

import { useState, useEffect } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Send,
  Calendar,
  Clock,
  CheckCircle,
  AlertCircle,
  Loader2,
  Tag,
  X,
  Play,
  ArrowLeft,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { VideoPlayer } from './VideoPlayer';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import {
  PUBLISH_PLATFORM_LABELS,
  type PublishPlatform,
  type PublishResult,
  type PublishScheduleMode,
} from '@/types/video-pipeline';

// Platform icons mapped to simple emoji/text fallbacks
const PLATFORM_ICONS: Record<PublishPlatform, string> = {
  twitter: '𝕏',
  linkedin: 'in',
  facebook: 'f',
  instagram: '📷',
  youtube: '▶',
  tiktok: '♪',
};

const PLATFORM_COLORS: Record<PublishPlatform, string> = {
  twitter: 'border-zinc-500 bg-zinc-900 text-white',
  linkedin: 'border-blue-600 bg-blue-950 text-blue-400',
  facebook: 'border-blue-500 bg-blue-950 text-blue-400',
  instagram: 'border-pink-500 bg-pink-950 text-pink-400',
  youtube: 'border-red-500 bg-red-950 text-red-400',
  tiktok: 'border-cyan-400 bg-cyan-950 text-cyan-400',
};

const PLATFORM_SELECTED: Record<PublishPlatform, string> = {
  twitter: 'border-zinc-400 bg-zinc-800 ring-2 ring-zinc-500',
  linkedin: 'border-blue-500 bg-blue-900 ring-2 ring-blue-500',
  facebook: 'border-blue-400 bg-blue-900 ring-2 ring-blue-400',
  instagram: 'border-pink-400 bg-pink-900 ring-2 ring-pink-400',
  youtube: 'border-red-400 bg-red-900 ring-2 ring-red-400',
  tiktok: 'border-cyan-300 bg-cyan-900 ring-2 ring-cyan-300',
};

export function StepPublish() {
  const authFetch = useAuthFetch();
  const {
    brief,
    projectName,
    projectId,
    finalVideoUrl,
    postProductionVideoUrl,
    publishConfig,
    publishResults,
    isPublishing,
    setPublishConfig,
    setPublishResults,
    setIsPublishing,
    setStep,
  } = useVideoPipelineStore();

  const [tagInput, setTagInput] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Auto-fill title/description/tags from brief on first load
  useEffect(() => {
    if (!publishConfig.title && brief.description) {
      setPublishConfig({
        title: projectName ?? brief.description.slice(0, 80),
        description: brief.description,
        tags: brief.talkingPoints
          ? brief.talkingPoints.split(',').map((t) => t.trim()).filter(Boolean).slice(0, 10)
          : [],
      });
    }
  }, [brief, projectName, publishConfig.title, setPublishConfig]);

  const videoUrl = postProductionVideoUrl ?? finalVideoUrl;
  const allPlatforms: PublishPlatform[] = ['twitter', 'linkedin', 'youtube', 'tiktok', 'instagram', 'facebook'];

  const togglePlatform = (platform: PublishPlatform) => {
    const current = publishConfig.platforms;
    if (current.includes(platform)) {
      setPublishConfig({ platforms: current.filter((p) => p !== platform) });
    } else {
      setPublishConfig({ platforms: [...current, platform] });
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().replace(/^#/, '');
    if (tag && !publishConfig.tags.includes(tag)) {
      setPublishConfig({ tags: [...publishConfig.tags, tag] });
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setPublishConfig({ tags: publishConfig.tags.filter((t) => t !== tag) });
  };

  const handlePublish = async () => {
    if (!videoUrl || publishConfig.platforms.length === 0) {
      setError('Select at least one platform to publish to.');
      return;
    }

    setIsPublishing(true);
    setError(null);

    try {
      const response = await authFetch('/api/video/publish', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId: projectId ?? 'local',
          videoUrl,
          platforms: publishConfig.platforms,
          title: publishConfig.title,
          description: publishConfig.description,
          tags: publishConfig.tags,
          scheduleMode: publishConfig.scheduleMode,
          scheduledAt: publishConfig.scheduledAt,
        }),
      });

      if (!response.ok) {
        const data = await response.json() as { error?: string };
        throw new Error(data.error ?? 'Publish failed');
      }

      const data = await response.json() as { success: boolean; results: PublishResult[] };
      if (data.success) {
        setPublishResults(data.results);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish video');
    } finally {
      setIsPublishing(false);
    }
  };

  const hasPublished = publishResults.length > 0;
  const allSucceeded = hasPublished && publishResults.every((r) => r.status === 'published' || r.status === 'scheduled');

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white flex items-center gap-2">
            <Send className="w-5 h-5 text-amber-500" />
            Publish & Schedule
          </h2>
          <p className="text-sm text-zinc-400 mt-1">
            Share your video across social platforms — publish now or schedule for later.
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => setStep('post-production')}
          className="gap-2 border-zinc-700"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Post-Production
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column — Video Preview */}
        <Card className="bg-zinc-900 border-zinc-800 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm text-zinc-300">Video Preview</CardTitle>
          </CardHeader>
          <CardContent>
            {videoUrl ? (
              <VideoPlayer src={videoUrl} />
            ) : (
              <div className="aspect-video bg-zinc-800 rounded-lg flex items-center justify-center">
                <Play className="w-10 h-10 text-zinc-600" />
              </div>
            )}
            <p className="text-xs text-zinc-500 mt-2 truncate">
              {projectName ?? 'Untitled Project'}
            </p>
          </CardContent>
        </Card>

        {/* Right column — Publish Form */}
        <div className="lg:col-span-2 space-y-4">
          {/* Platform Picker */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-zinc-300">Platforms</CardTitle>
              <CardDescription className="text-xs">
                Select where to publish your video
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                {allPlatforms.map((platform) => {
                  const selected = publishConfig.platforms.includes(platform);
                  return (
                    <button
                      key={platform}
                      onClick={() => togglePlatform(platform)}
                      className={`flex flex-col items-center gap-1.5 p-3 rounded-lg border transition-all ${
                        selected
                          ? PLATFORM_SELECTED[platform]
                          : `${PLATFORM_COLORS[platform]} hover:brightness-125`
                      }`}
                    >
                      <span className="text-lg font-bold">{PLATFORM_ICONS[platform]}</span>
                      <span className="text-[10px] font-medium">{PUBLISH_PLATFORM_LABELS[platform]}</span>
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Title & Description */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-zinc-300">Post Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Title</label>
                <input
                  type="text"
                  value={publishConfig.title}
                  onChange={(e) => setPublishConfig({ title: e.target.value })}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                  placeholder="Video title..."
                  maxLength={200}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">Description</label>
                <textarea
                  value={publishConfig.description}
                  onChange={(e) => setPublishConfig({ description: e.target.value })}
                  rows={3}
                  className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none resize-none"
                  placeholder="Describe your video..."
                  maxLength={2000}
                />
              </div>
              <div>
                <label className="block text-xs text-zinc-500 mb-1">
                  <Tag className="w-3 h-3 inline mr-1" />
                  Tags
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {publishConfig.tags.map((tag) => (
                    <span
                      key={tag}
                      className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 border border-amber-500/30 rounded-full text-xs text-amber-400"
                    >
                      #{tag}
                      <button onClick={() => removeTag(tag)} className="hover:text-amber-200">
                        <X className="w-3 h-3" />
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                    className="flex-1 bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-1.5 text-sm text-white placeholder-zinc-500 focus:border-amber-500 focus:outline-none"
                    placeholder="Add tag..."
                    maxLength={50}
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={addTag}
                    className="border-zinc-700"
                  >
                    Add
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Schedule */}
          <Card className="bg-zinc-900 border-zinc-800">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm text-zinc-300">Schedule</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-3 mb-3">
                <button
                  onClick={() => setPublishConfig({ scheduleMode: 'now' as PublishScheduleMode, scheduledAt: null })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-all ${
                    publishConfig.scheduleMode === 'now'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <Play className="w-4 h-4" />
                  Publish Now
                </button>
                <button
                  onClick={() => setPublishConfig({ scheduleMode: 'scheduled' as PublishScheduleMode })}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm transition-all ${
                    publishConfig.scheduleMode === 'scheduled'
                      ? 'border-amber-500 bg-amber-500/10 text-amber-400'
                      : 'border-zinc-700 text-zinc-400 hover:border-zinc-600'
                  }`}
                >
                  <Calendar className="w-4 h-4" />
                  Schedule
                </button>
              </div>

              {publishConfig.scheduleMode === 'scheduled' && (
                <div className="flex items-center gap-3">
                  <Clock className="w-4 h-4 text-zinc-500" />
                  <input
                    type="datetime-local"
                    value={publishConfig.scheduledAt?.slice(0, 16) ?? ''}
                    onChange={(e) =>
                      setPublishConfig({
                        scheduledAt: e.target.value ? new Date(e.target.value).toISOString() : null,
                      })
                    }
                    min={new Date().toISOString().slice(0, 16)}
                    className="bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white focus:border-amber-500 focus:outline-none"
                  />
                </div>
              )}
            </CardContent>
          </Card>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-red-950/50 border border-red-800 text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
              {error}
            </div>
          )}

          {/* Publish Results */}
          {hasPublished && (
            <Card className="bg-zinc-900 border-zinc-800">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-zinc-300 flex items-center gap-2">
                  {allSucceeded ? (
                    <CheckCircle className="w-4 h-4 text-green-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                  )}
                  {allSucceeded ? 'Published Successfully' : 'Publish Results'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {publishResults.map((result) => (
                    <div
                      key={result.platform}
                      className="flex items-center justify-between p-2 rounded-lg bg-zinc-800/50"
                    >
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{PLATFORM_ICONS[result.platform]}</span>
                        <span className="text-sm text-zinc-300">
                          {PUBLISH_PLATFORM_LABELS[result.platform]}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        {result.status === 'published' && (
                          <span className="text-xs text-green-400 flex items-center gap-1">
                            <CheckCircle className="w-3 h-3" />
                            Published
                          </span>
                        )}
                        {result.status === 'scheduled' && (
                          <span className="text-xs text-amber-400 flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            Scheduled
                          </span>
                        )}
                        {result.status === 'failed' && (
                          <span className="text-xs text-red-400 flex items-center gap-1">
                            <AlertCircle className="w-3 h-3" />
                            {result.error ?? 'Failed'}
                          </span>
                        )}
                        {result.postUrl && (
                          <a
                            href={result.postUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-amber-400 hover:text-amber-300 underline"
                          >
                            View Post
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Publish Button */}
          <Button
            onClick={() => { void handlePublish(); }}
            disabled={isPublishing || publishConfig.platforms.length === 0 || !videoUrl}
            className="w-full bg-amber-600 hover:bg-amber-500 text-white font-semibold py-3 gap-2"
            size="lg"
          >
            {isPublishing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                Publishing...
              </>
            ) : publishConfig.scheduleMode === 'scheduled' ? (
              <>
                <Calendar className="w-4 h-4" />
                Schedule to {publishConfig.platforms.length} Platform{publishConfig.platforms.length !== 1 ? 's' : ''}
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Publish to {publishConfig.platforms.length} Platform{publishConfig.platforms.length !== 1 ? 's' : ''}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
