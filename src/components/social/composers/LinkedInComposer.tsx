'use client';

/**
 * LinkedInComposer — Native LinkedIn composer.
 *
 * - `post`: 3000 char limit with countdown.
 * - `article`: title + body. Body shows a 2,000 char "guidance" tracker (no hard limit).
 */

import * as React from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { PlatformComposerFormProps } from './PlatformComposer';
import { useCharCountdownColor } from './_utils';

const MAX_POST = 3000;
const ARTICLE_GUIDANCE = 2000;
const meta = PLATFORM_META.linkedin;

export function LinkedInComposer({
  value,
  onChange,
  disabled,
}: PlatformComposerFormProps): React.ReactElement {
  const isArticle = value.contentType === 'article';
  const postCountdownColor = useCharCountdownColor(value.content.length, MAX_POST);
  const articleCountdownColor = useCharCountdownColor(value.content.length, ARTICLE_GUIDANCE);

  const setContentType = (next: 'post' | 'article') => {
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
          variant={!isArticle ? 'default' : 'outline'}
          onClick={() => setContentType('post')}
          disabled={disabled}
        >
          Post
        </Button>
        <Button
          type="button"
          size="sm"
          variant={isArticle ? 'default' : 'outline'}
          onClick={() => setContentType('article')}
          disabled={disabled}
        >
          Article
        </Button>
      </div>

      {isArticle && (
        <div>
          <label className="text-sm font-medium text-foreground" htmlFor="linkedin-article-title">
            Article Title <span className="text-destructive">*</span>
          </label>
          <Input
            id="linkedin-article-title"
            value={value.metadata.title ?? ''}
            onChange={(e) => setMetaField('title', e.target.value)}
            placeholder="Article headline"
            disabled={disabled}
            className="mt-1"
            style={{ borderColor: meta.color }}
          />
        </div>
      )}

      <div className="relative">
        <Textarea
          value={value.content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={
            isArticle
              ? 'Write your article. Long-form is welcome — aim for around 2,000 characters.'
              : 'Share an update, insight, or story…'
          }
          rows={isArticle ? 12 : 6}
          maxLength={isArticle ? undefined : MAX_POST}
          disabled={disabled}
          className="resize-none pr-20"
          style={{ borderColor: meta.color }}
        />
        <div
          className={`absolute bottom-2 right-3 text-xs font-medium ${
            isArticle ? articleCountdownColor : postCountdownColor
          }`}
        >
          {isArticle
            ? `${value.content.length} / ~${ARTICLE_GUIDANCE}`
            : `${MAX_POST - value.content.length}`}
        </div>
      </div>
    </div>
  );
}

export default LinkedInComposer;
