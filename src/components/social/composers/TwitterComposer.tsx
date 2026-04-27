'use client';

/**
 * TwitterComposer — Native Twitter/X composer.
 *
 * - `post`: single tweet, 280 char limit, countdown bottom-right.
 * - `thread`: tweets separated by `---`. Live thread preview panel below
 *   the textarea showing each tweet as a numbered card with its own
 *   character count.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor, splitThread } from './_utils';

const MAX_TWEET = 280;
const meta = PLATFORM_META.twitter;

export function TwitterComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const isThread = value.contentType === 'thread';
  const charCount = isThread ? value.content.length : value.content.length;
  const countdownColor = useCharCountdownColor(charCount, MAX_TWEET);

  const setContentType = (next: 'post' | 'thread') => {
    onChange({ ...value, contentType: next });
  };

  const setContent = (content: string) => {
    onChange({ ...value, content });
  };

  const threadParts = isThread ? splitThread(value.content) : [];

  return (
    <div className="space-y-3">
      {/* Mode tabs */}
      <div className="flex gap-2">
        <Button
          type="button"
          size="sm"
          variant={!isThread ? 'default' : 'outline'}
          onClick={() => setContentType('post')}
          disabled={disabled}
        >
          Single tweet
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
              ? 'First tweet…\n---\nSecond tweet…\n---\nThird tweet…'
              : "What's happening?"
          }
          rows={isThread ? 8 : 5}
          disabled={disabled}
          maxLength={isThread ? undefined : MAX_TWEET}
          className="resize-none pr-16"
          style={{ borderColor: meta.color }}
        />
        {!isThread && (
          <div
            className={`absolute bottom-2 right-3 text-xs font-medium ${countdownColor}`}
          >
            {MAX_TWEET - charCount}
          </div>
        )}
      </div>

      {isThread && threadParts.length > 0 && (
        <div className="space-y-2">
          <div className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            Thread Preview ({threadParts.length} tweet{threadParts.length === 1 ? '' : 's'})
          </div>
          <div className="space-y-2">
            {threadParts.map((part, idx) => {
              const overLimit = part.length > MAX_TWEET;
              return (
                <div
                  key={idx}
                  className="rounded-xl border border-border-light bg-surface-elevated p-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wide mb-1">
                        Tweet {idx + 1}/{threadParts.length}
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-foreground">
                        {part}
                      </p>
                    </div>
                    <div
                      className={`text-xs font-medium flex-shrink-0 ${
                        overLimit ? 'text-destructive' : 'text-muted-foreground'
                      }`}
                    >
                      {part.length}/{MAX_TWEET}
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

export default TwitterComposer;
