'use client';

/**
 * TelegramComposer — Native Telegram composer.
 *
 * - `message`: large textarea, no hard limit (Telegram allows 4096).
 * - Channel target field stored in metadata.channel.
 */

import * as React from 'react';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';

const meta = PLATFORM_META.telegram;

export function TelegramComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const setMetaField = (key: string, val: string) => {
    onChange({ ...value, metadata: { ...value.metadata, [key]: val } });
  };

  return (
    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="telegram-channel">
          Channel <span className="text-destructive">*</span>
        </label>
        <Input
          id="telegram-channel"
          value={value.metadata.channel ?? ''}
          onChange={(e) => setMetaField('channel', e.target.value)}
          placeholder="Channel name or @handle"
          disabled={disabled}
          className="mt-1"
          style={{ borderColor: meta.color }}
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="telegram-message">
          Message
        </label>
        <Textarea
          id="telegram-message"
          value={value.content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Send to your channel — Markdown supported."
          rows={8}
          disabled={disabled}
          className="mt-1 resize-none"
          style={{ borderColor: meta.color }}
        />
      </div>
    </div>
  );
}

export default TelegramComposer;
