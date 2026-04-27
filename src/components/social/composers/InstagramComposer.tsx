'use client';

/**
 * InstagramComposer — Native Instagram composer.
 *
 * Media-first layout: large square preview placeholder is rendered above the
 * caption (the actual MediaUploader still lives in the wrapper, but we render
 * a visible "media required" hero block here so the operator instantly sees
 * the IG-style layout).
 *
 * - `post`: caption (max 2200) + hashtag tracker (12 / 30)
 * - `carousel`: caption + slide count + slide descriptions
 * - `reel`: script textarea + suggested audio
 */

import * as React from 'react';
import { ImagePlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { countHashtags, useCharCountdownColor } from './_utils';

const MAX_CAPTION = 2200;
const MAX_HASHTAGS = 30;
const meta = PLATFORM_META.instagram;

export function InstagramComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const captionCountdownColor = useCharCountdownColor(value.content.length, MAX_CAPTION);
  const hashtagCount = countHashtags(value.content);

  const setContentType = (next: 'post' | 'carousel' | 'reel') => {
    onChange({ ...value, contentType: next });
  };

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const setMetaField = (key: string, val: string) => {
    onChange({ ...value, metadata: { ...value.metadata, [key]: val } });
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {(['post', 'carousel', 'reel'] as const).map((mode) => (
          <Button
            key={mode}
            type="button"
            size="sm"
            variant={value.contentType === mode ? 'default' : 'outline'}
            onClick={() => setContentType(mode)}
            disabled={disabled}
          >
            {mode === 'post' ? 'Feed Post' : mode === 'carousel' ? 'Carousel' : 'Reel'}
          </Button>
        ))}
      </div>

      {/* Media-first square preview hero */}
      <div className="aspect-square w-full max-w-sm mx-auto rounded-2xl border-2 border-dashed border-border-light bg-surface-elevated flex flex-col items-center justify-center text-muted-foreground">
        <ImagePlus className="h-10 w-10 mb-2" />
        <div className="text-sm font-medium">Image required</div>
        <div className="text-xs mt-1 text-center px-4">
          Upload your photo / video below — Instagram is media-first.
        </div>
      </div>

      {value.contentType === 'carousel' && (
        <>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="ig-slide-count">
              Number of slides
            </label>
            <Input
              id="ig-slide-count"
              type="number"
              min={2}
              max={10}
              value={value.metadata.slideCount ?? ''}
              onChange={(e) => setMetaField('slideCount', e.target.value)}
              placeholder="5"
              disabled={disabled}
              className="mt-1 w-32"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="ig-slide-desc">
              Slide descriptions
            </label>
            <Textarea
              id="ig-slide-desc"
              value={value.metadata.slideDescriptions ?? ''}
              onChange={(e) => setMetaField('slideDescriptions', e.target.value)}
              placeholder={'Slide 1: Hook\nSlide 2: Problem\nSlide 3: Solution\nSlide 4: Proof\nSlide 5: CTA'}
              rows={5}
              disabled={disabled}
              className="mt-1 resize-none"
            />
          </div>
        </>
      )}

      {value.contentType === 'reel' && (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="ig-audio">
            Suggested audio
          </label>
          <Input
            id="ig-audio"
            value={value.metadata.audioSuggestion ?? ''}
            onChange={(e) => setMetaField('audioSuggestion', e.target.value)}
            placeholder="Trending sound name or original audio"
            disabled={disabled}
            className="mt-1"
          />
        </div>
      )}

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="ig-caption">
          {value.contentType === 'reel' ? 'Reel script' : 'Caption'}
        </label>
        <div className="relative mt-1">
          <Textarea
            id="ig-caption"
            value={value.content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              value.contentType === 'reel'
                ? 'Hook line…\n\nThe story…\n\nCTA'
                : 'Write a caption… use #hashtags freely (up to 30).'
            }
            rows={6}
            maxLength={MAX_CAPTION}
            disabled={disabled}
            className="resize-none pr-20"
            style={{ borderColor: meta.color }}
          />
          <div className={`absolute bottom-2 right-3 text-xs font-medium ${captionCountdownColor}`}>
            {MAX_CAPTION - value.content.length}
          </div>
        </div>
        <div className="flex items-center justify-between mt-1.5">
          <span
            className={`text-xs ${
              hashtagCount > MAX_HASHTAGS ? 'text-destructive' : 'text-muted-foreground'
            }`}
          >
            {hashtagCount} / {MAX_HASHTAGS} hashtags
          </span>
        </div>
      </div>
    </div>
  );
}

export default InstagramComposer;
