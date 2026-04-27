'use client';

/**
 * FacebookComposer — Native Facebook composer.
 *
 * - `post`: generous textarea, no hard char limit (Facebook allows 63,206).
 * - `story`: 250 char overlay text with hint about overlay treatment.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_STORY = 250;
const meta = PLATFORM_META.facebook;

export function FacebookComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const isStory = value.contentType === 'story';
  const storyCountdownColor = useCharCountdownColor(value.content.length, MAX_STORY);

  const setContentType = (next: 'post' | 'story') => {
    onChange({ ...value, contentType: next });
  };

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isStory ? 'default' : 'outline'}
          onClick={() => setContentType('post')}
          disabled={disabled}
        >
          Post
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isStory ? 'default' : 'outline'}
          onClick={() => setContentType('story')}
          disabled={disabled}
        >
          Story
        </Button>
      </div>

      {isStory ? (
        <div className="space-y-2">
          <div className="text-xs text-muted-foreground">
            Story text overlay — appears on top of an attached image. Keep it short and bold.
          </div>
          <div className="relative">
            <Textarea
              value={value.content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Bold overlay text…"
              rows={4}
              maxLength={MAX_STORY}
              disabled={disabled}
              className="resize-none pr-16 text-center text-lg font-semibold"
              style={{ borderColor: meta.color }}
            />
            <div className={`absolute bottom-2 right-3 text-xs font-medium ${storyCountdownColor}`}>
              {MAX_STORY - value.content.length}
            </div>
          </div>
        </div>
      ) : (
        <Textarea
          value={value.content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's on your mind?"
          rows={6}
          disabled={disabled}
          className="resize-none"
          style={{ borderColor: meta.color }}
        />
      )}
    </div>
  );
}

export default FacebookComposer;
