'use client';

/**
 * RedditComposer — Native Reddit composer.
 *
 * - `post` (text post): subreddit + title (300) + body (markdown)
 * - `link`: subreddit + title + URL
 *
 * Subreddit picker is a free-text input prefixed with `r/` — listing the
 * user's subscribed subreddits would require an OAuth-scoped Reddit API call
 * we don't have wired yet, so v1 is text input.
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_TITLE = 300;
const meta = PLATFORM_META.reddit;

export function RedditComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const isLink = value.contentType === 'link';
  const title = value.metadata.title ?? '';
  const titleColor = useCharCountdownColor(title.length, MAX_TITLE);
  // Strip leading `r/` if user types it, store bare name in metadata.
  const subredditRaw = value.metadata.subreddit ?? '';
  const subredditDisplay = subredditRaw.replace(/^r\//, '');

  const setContentType = (next: 'post' | 'link') => {
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
          variant={!isLink ? 'default' : 'outline'}
          onClick={() => setContentType('post')}
          disabled={disabled}
        >
          Text post
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isLink ? 'default' : 'outline'}
          onClick={() => setContentType('link')}
          disabled={disabled}
        >
          Link post
        </Button>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="reddit-subreddit">
          Subreddit <span className="text-destructive">*</span>
        </label>
        <div className="relative mt-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground select-none">
            r/
          </span>
          <Input
            id="reddit-subreddit"
            value={subredditDisplay}
            onChange={(e) => setMetaField('subreddit', e.target.value.replace(/^r\//, ''))}
            placeholder="smallbusiness"
            disabled={disabled}
            className="pl-8"
            style={{ borderColor: meta.color }}
          />
        </div>
      </div>

      <div>
        <label className="text-sm font-medium text-foreground" htmlFor="reddit-title">
          Title <span className="text-destructive">*</span>
        </label>
        <div className="relative mt-1">
          <Input
            id="reddit-title"
            value={title}
            onChange={(e) => setMetaField('title', e.target.value)}
            placeholder="Post title"
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

      {isLink ? (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="reddit-url">
            URL <span className="text-destructive">*</span>
          </label>
          <Input
            id="reddit-url"
            type="url"
            value={value.metadata.url ?? ''}
            onChange={(e) => setMetaField('url', e.target.value)}
            placeholder="https://…"
            disabled={disabled}
            className="mt-1"
          />
        </div>
      ) : (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="reddit-body">
            Body (Markdown supported)
          </label>
          <Textarea
            id="reddit-body"
            value={value.content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Write your post body. Markdown welcome — **bold**, *italic*, `code`."
            rows={8}
            disabled={disabled}
            className="mt-1 resize-none font-mono text-sm"
          />
        </div>
      )}
    </div>
  );
}

export default RedditComposer;
