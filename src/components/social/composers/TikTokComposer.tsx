'use client';

/**
 * TikTokComposer — Native TikTok composer.
 *
 * - `video`: caption (2200) + sound suggestion
 * - "Video required" callout pinned to the top with AlertCircle icon.
 */

import * as React from 'react';
import { AlertCircle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_CAPTION = 2200;
const meta = PLATFORM_META.tiktok;

export function TikTokComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const captionColor = useCharCountdownColor(value.content.length, MAX_CAPTION);

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const setMetaField = (key: string, val: string) => {
    onChange({ ...value, metadata: { ...value.metadata, [key]: val } });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3">
        <AlertCircle className="h-4 w-4 mt-0.5 flex-shrink-0 text-amber-500" />
        <div className="text-xs text-foreground">
          <span className="font-semibold">TikTok requires a video.</span>{' '}
          Upload your clip below — without one, posting stays disabled.
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="tt-caption">
          Caption
        </label>
        <div className="relative mt-1">
          <Textarea
            id="tt-caption"
            value={value.content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Hook line + #hashtags…"
            rows={5}
            maxLength={MAX_CAPTION}
            disabled={disabled}
            className="resize-none pr-16"
            style={{ borderColor: meta.color }}
          />
          <div className={`absolute bottom-2 right-3 text-xs font-medium ${captionColor}`}>
            {MAX_CAPTION - value.content.length}
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="tt-sound">
          Suggested sound
        </label>
        <Input
          id="tt-sound"
          value={value.metadata.soundSuggestion ?? ''}
          onChange={(e) => setMetaField('soundSuggestion', e.target.value)}
          placeholder="Trending sound name or 'original'"
          disabled={disabled}
          className="mt-1"
        />
      </div>
    </div>
  );
}

export default TikTokComposer;
