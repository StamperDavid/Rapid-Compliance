'use client';

/**
 * YouTubeComposer — Native YouTube composer.
 *
 * - `video`: title (100), description (5000), tags (csv), chapter markers
 * - `short`: shorter title + script
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 5000;
const meta = PLATFORM_META.youtube;

export function YouTubeComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const isShort = value.contentType === 'short';
  const title = value.metadata.title ?? '';
  const titleColor = useCharCountdownColor(title.length, MAX_TITLE);
  const descriptionColor = useCharCountdownColor(value.content.length, MAX_DESCRIPTION);

  const setContentType = (next: 'video' | 'short') => {
    onChange({ ...value, contentType: next });
  };

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const setMetaField = (key: string, val: string) => {
    onChange({ ...value, metadata: { ...value.metadata, [key]: val } });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isShort ? 'default' : 'outline'}
          onClick={() => setContentType('video')}
          disabled={disabled}
        >
          Video
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isShort ? 'default' : 'outline'}
          onClick={() => setContentType('short')}
          disabled={disabled}
        >
          Short
        </Button>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="yt-title">
          {isShort ? 'Short title' : 'Video title'} <span className="text-destructive">*</span>
        </label>
        <div className="relative mt-1">
          <Input
            id="yt-title"
            value={title}
            onChange={(e) => setMetaField('title', e.target.value)}
            placeholder={isShort ? 'Catchy short title' : 'Compelling video title'}
            maxLength={MAX_TITLE}
            disabled={disabled}
            className="pr-14"
            style={{ borderColor: meta.color }}
          />
          <div className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-medium ${titleColor}`}>
            {MAX_TITLE - title.length}
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="yt-desc">
          {isShort ? 'Script' : 'Description'}
        </label>
        <div className="relative mt-1">
          <Textarea
            id="yt-desc"
            value={value.content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={
              isShort
                ? 'Punchy script (under 60 seconds spoken)…'
                : 'Description with timestamps, links, and context…'
            }
            rows={isShort ? 6 : 10}
            maxLength={MAX_DESCRIPTION}
            disabled={disabled}
            className="resize-none pr-16"
            style={{ borderColor: meta.color }}
          />
          <div className={`absolute bottom-2 right-3 text-xs font-medium ${descriptionColor}`}>
            {MAX_DESCRIPTION - value.content.length}
          </div>
        </div>
      </div>

      {!isShort && (
        <>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="yt-tags">
              Tags (comma-separated)
            </label>
            <Input
              id="yt-tags"
              value={value.metadata.tags ?? ''}
              onChange={(e) => setMetaField('tags', e.target.value)}
              placeholder="ai, sales, automation, b2b"
              disabled={disabled}
              className="mt-1"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground" htmlFor="yt-chapters">
              Chapter markers (one per line, format: 0:00 Title)
            </label>
            <Textarea
              id="yt-chapters"
              value={value.metadata.chapterMarkers ?? ''}
              onChange={(e) => setMetaField('chapterMarkers', e.target.value)}
              placeholder={'0:00 Intro\n1:30 Problem\n3:00 Solution\n5:00 Demo'}
              rows={4}
              disabled={disabled}
              className="mt-1 resize-none font-mono text-xs"
            />
          </div>
        </>
      )}
    </div>
  );
}

export default YouTubeComposer;
