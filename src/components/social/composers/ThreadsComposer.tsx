'use client';

/**
 * ThreadsComposer — Native Threads composer.
 *
 * - `post`: 500 char limit + countdown
 * - Same `---` thread chain pattern as Twitter, with thread preview cards.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { splitThread, useCharCountdownColor } from './_utils';

const MAX_POST = 500;
const meta = PLATFORM_META.threads;

export function ThreadsComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const isThread = value.contentType === 'thread';
  const countdownColor = useCharCountdownColor(value.content.length, MAX_POST);

  const setContentType = (next: 'post' | 'thread') => {
    onChange({ ...value, contentType: next });
  };

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const threadParts = isThread ? splitThread(value.content) : [];

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isThread ? 'default' : 'outline'}
          onClick={() => setContentType('post')}
          disabled={disabled}
        >
          Single post
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isThread ? 'default' : 'outline'}
          onClick={() => setContentType('thread')}
          disabled={disabled}
        >
          Thread
        </Button>
      </div>

      <div className="relative">
        <Textarea
          value={value.content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isThread
              ? 'First post…\n---\nSecond post…\n---\nThird post…'
              : 'Start a thread…'
          }
          rows={isThread ? 8 : 5}
          maxLength={isThread ? undefined : MAX_POST}
          disabled={disabled}
          className="resize-none pr-16"
          style={{ borderColor: meta.color }}
        />
        {!isThread && (
          <div className={`absolute bottom-2 right-3 text-xs font-medium ${countdownColor}`}>
            {MAX_POST - value.content.length}
          </div>
        )}
      </div>

      {isThread && threadParts.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Thread Preview ({threadParts.length} post{threadParts.length === 1 ? '' : 's'})
          </div>
          <div className="space-y-2">
            {threadParts.map((part, idx) => {
              const overLimit = part.length > MAX_POST;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-border-light bg-surface-elevated p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Post {idx + 1}/{threadParts.length}
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-foreground">{part}</p>
                    </div>
                    <div
                      className={`text-xs font-medium flex-shrink-0 ${
                        overLimit ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {part.length}/{MAX_POST}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default ThreadsComposer;
