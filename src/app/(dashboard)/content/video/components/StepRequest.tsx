'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { Video, ArrowRight, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useVideoPipelineStore } from '@/lib/stores/video-pipeline-store';
import type { VideoType, TargetPlatform } from '@/types/video-pipeline';
import type { VideoAspectRatio, VideoResolution } from '@/types/video';

const VIDEO_TYPES: { value: VideoType; label: string; icon: string; description: string }[] = [
  { value: 'tutorial', label: 'Tutorial', icon: '📚', description: 'Step-by-step walkthrough of a feature or process' },
  { value: 'explainer', label: 'Explainer', icon: '💡', description: 'Explain a concept, product, or service' },
  { value: 'product-demo', label: 'Product Demo', icon: '🖥️', description: 'Showcase product features and capabilities' },
  { value: 'sales-pitch', label: 'Sales Pitch', icon: '🎯', description: 'Persuasive pitch to drive conversions' },
  { value: 'testimonial', label: 'Testimonial', icon: '⭐', description: 'Customer success story or review' },
  { value: 'social-ad', label: 'Social Ad', icon: '📱', description: 'Short-form ad for social media' },
];

const PLATFORMS: { value: TargetPlatform; label: string }[] = [
  { value: 'youtube', label: '▶️ YouTube' },
  { value: 'tiktok', label: '🎵 TikTok' },
  { value: 'instagram', label: '📸 Instagram' },
  { value: 'linkedin', label: '💼 LinkedIn' },
  { value: 'website', label: '🌐 Website' },
];

const ASPECT_RATIOS: { value: VideoAspectRatio; label: string }[] = [
  { value: '16:9', label: '16:9 (Landscape)' },
  { value: '9:16', label: '9:16 (Portrait)' },
  { value: '1:1', label: '1:1 (Square)' },
  { value: '4:3', label: '4:3 (Standard)' },
];

const RESOLUTIONS: { value: VideoResolution; label: string }[] = [
  { value: '720p', label: '720p' },
  { value: '1080p', label: '1080p (Recommended)' },
  { value: '4k', label: '4K' },
];

export function StepRequest() {
  const { brief, setBrief, advanceStep, canAdvanceTo } = useVideoPipelineStore();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleGenerate = async () => {
    if (!canAdvanceTo('decompose')) {
      return;
    }
    setIsSubmitting(true);
    // Small delay for UX
    await new Promise<void>((resolve) => {
      setTimeout(resolve, 300);
    });
    advanceStep();
    setIsSubmitting(false);
  };

  return (
    <div className="space-y-6">
      <Card className="bg-zinc-900/50 border-zinc-800">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-white">
            <Video className="w-5 h-5 text-amber-500" />
            Video Brief
          </CardTitle>
          <CardDescription>
            Describe what video you want to create. Be specific about the topic and goals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-2">
              What should the video be about?
            </label>
            <textarea
              value={brief.description}
              onChange={(e) => setBrief({ description: e.target.value })}
              placeholder="e.g., Create a tutorial showing how to set up an email campaign in SalesVelocity..."
              className="w-full h-28 px-4 py-3 bg-zinc-800 border border-zinc-700 rounded-lg text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-amber-500/50 focus:border-amber-500 resize-none"
            />
          </div>

          {/* Video Type */}
          <div>
            <label className="block text-sm font-medium text-zinc-300 mb-3">
              Video Type
            </label>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {VIDEO_TYPES.map((type) => (
                <motion.button
                  key={type.value}
                  onClick={() => setBrief({ videoType: type.value })}
                  className={`p-3 rounded-lg border text-left transition-colors ${
                    brief.videoType === type.value
                      ? 'border-amber-500 bg-amber-500/10'
                      : 'border-zinc-700 bg-zinc-800/50 hover:border-zinc-600'
                  }`}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  <span className="text-lg">{type.icon}</span>
                  <p className="text-sm font-medium text-white mt-1">{type.label}</p>
                  <p className="text-xs text-zinc-400 mt-0.5">{type.description}</p>
                </motion.button>
              ))}
            </div>
          </div>

          {/* Platform & Settings Row */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Platform */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Platform</label>
              <select
                value={brief.platform}
                onChange={(e) => setBrief({ platform: e.target.value as TargetPlatform })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {PLATFORMS.map((p) => (
                  <option key={p.value} value={p.value}>{p.label}</option>
                ))}
              </select>
            </div>

            {/* Duration */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Duration (sec)</label>
              <input
                type="number"
                value={brief.duration}
                onChange={(e) => setBrief({ duration: Number(e.target.value) || 60 })}
                min={10}
                max={600}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              />
            </div>

            {/* Aspect Ratio */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Aspect Ratio</label>
              <select
                value={brief.aspectRatio}
                onChange={(e) => setBrief({ aspectRatio: e.target.value as VideoAspectRatio })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {ASPECT_RATIOS.map((ar) => (
                  <option key={ar.value} value={ar.value}>{ar.label}</option>
                ))}
              </select>
            </div>

            {/* Resolution */}
            <div>
              <label className="block text-sm font-medium text-zinc-300 mb-2">Resolution</label>
              <select
                value={brief.resolution}
                onChange={(e) => setBrief({ resolution: e.target.value as VideoResolution })}
                className="w-full px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-amber-500/50"
              >
                {RESOLUTIONS.map((r) => (
                  <option key={r.value} value={r.value}>{r.label}</option>
                ))}
              </select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Action */}
      <div className="flex justify-end">
        <Button
          onClick={() => { void handleGenerate(); }}
          disabled={!canAdvanceTo('decompose') || isSubmitting}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white"
          size="lg"
        >
          {isSubmitting ? (
            <>
              <Sparkles className="w-4 h-4 animate-spin" />
              Generating Plan...
            </>
          ) : (
            <>
              Generate Plan
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
