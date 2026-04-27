'use client';

/**
 * PinterestComposer — Native Pinterest composer.
 *
 * - `pin`: title (100) + description (500) + destination URL + board (text)
 * - Media-first square preview hero (image required)
 */

import * as React from 'react';
import { ImagePlus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_TITLE = 100;
const MAX_DESCRIPTION = 500;
const meta = PLATFORM_META.pinterest;

export function PinterestComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const title = value.metadata.title ?? '';
  const titleColor = useCharCountdownColor(title.length, MAX_TITLE);
  const descColor = useCharCountdownColor(value.content.length, MAX_DESCRIPTION);

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const setMetaField = (key: string, val: string) => {
    onChange({ ...value, metadata: { ...value.metadata, [key]: val } });
  };

  return (
    <div className="space-y-4">
      {/* Media-first hero */}
      <div className="aspect-[2/3] w-full max-w-xs mx-auto rounded-2xl border-2 border-dashed border-border-light bg-surface-elevated flex flex-col items-center justify-center text-muted-foreground">
        <ImagePlus className="h-10 w-10 mb-2" />
        <div className="text-sm font-medium">Pin image required</div>
        <div className="text-xs mt-1 text-center px-4">
          Vertical (2:3) images perform best on Pinterest.
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="pin-title">
          Pin title <span className="text-destructive">*</span>
        </label>
        <div className="relative mt-1">
          <Input
            id="pin-title"
            value={title}
            onChange={(e) => setMetaField('title', e.target.value)}
            placeholder="Catchy pin title"
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
        <label className="text-sm font-medium text-foreground" htmlFor="pin-description">
          Description
        </label>
        <div className="relative mt-1">
          <Textarea
            id="pin-description"
            value={value.content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Describe your pin — what it is, why it matters, who it's for."
            rows={4}
            maxLength={MAX_DESCRIPTION}
            disabled={disabled}
            className="resize-none pr-16"
            style={{ borderColor: meta.color }}
          />
          <div className={`absolute bottom-2 right-3 text-xs font-medium ${descColor}`}>
            {MAX_DESCRIPTION - value.content.length}
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="pin-url">
          Destination URL
        </label>
        <Input
          id="pin-url"
          type="url"
          value={value.metadata.destinationUrl ?? ''}
          onChange={(e) => setMetaField('destinationUrl', e.target.value)}
          placeholder="https://your-site.com/page"
          disabled={disabled}
          className="mt-1"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="pin-board">
          Board
        </label>
        <Input
          id="pin-board"
          value={value.metadata.boardName ?? ''}
          onChange={(e) => setMetaField('boardName', e.target.value)}
          placeholder="Board name"
          disabled={disabled}
          className="mt-1"
        />
      </div>
    </div>
  );
}

export default PinterestComposer;
