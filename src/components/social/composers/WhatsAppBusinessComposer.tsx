'use client';

/**
 * WhatsAppBusinessComposer — Native WhatsApp Business composer.
 *
 * - `message`: 4096 char broadcast, with countdown
 * - Helper text spelling out the template-message constraint in production.
 */

import * as React from 'react';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_MESSAGE = 4096;
const meta = PLATFORM_META.whatsapp_business;

export function WhatsAppBusinessComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const countdownColor = useCharCountdownColor(value.content.length, MAX_MESSAGE);

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  return (
    <div className="space-y-3">
      <div className="rounded-xl border border-border-light bg-surface-elevated p-3 text-xs text-muted-foreground">
        WhatsApp Business broadcasts only support pre-approved template messages
        in production. Use this composer for testing — the message-template flow
        will replace it once Meta business verification is complete.
      </div>

      <div className="relative">
        <Textarea
          value={value.content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Write your broadcast message…"
          rows={8}
          maxLength={MAX_MESSAGE}
          disabled={disabled}
          className="resize-none pr-20"
          style={{ borderColor: meta.color }}
        />
        <div className={`absolute bottom-2 right-3 text-xs font-medium ${countdownColor}`}>
          {MAX_MESSAGE - value.content.length}
        </div>
      </div>
    </div>
  );
}

export default WhatsAppBusinessComposer;
