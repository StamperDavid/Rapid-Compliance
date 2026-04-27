'use client';

/**
 * BlueskyComposer — Native Bluesky composer.
 *
 * - `post`: 300 char limit with countdown.
 */

import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_POST = 300;
const meta = PLATFORM_META.bluesky;

export function BlueskyComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const countdownColor = useCharCountdownColor(value.content.length, MAX_POST);

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <Textarea
          value={value.content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="What's up? (skeet up to 300 chars)"
          rows={5}
          maxLength={MAX_POST}
          disabled={disabled}
          className="resize-none pr-16"
          style={{ borderColor: meta.color }}
        />
        <div className={`absolute bottom-2 right-3 text-xs font-medium ${countdownColor}`}>
          {MAX_POST - value.content.length}
        </div>
      </div>
    </div>
  );
}

export default BlueskyComposer;
