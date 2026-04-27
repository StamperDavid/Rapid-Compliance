/**
 * InstagramPostPreview — evokes the Instagram feed feel without cloning it.
 * Pure presentational component; no data fetching, no side effects.
 *
 * Instagram is media-first: when no media is supplied we render an
 * obvious placeholder square so callers (and operators) can see at a
 * glance that the post needs visual content before publishing.
 */

import * as React from 'react';
import Image from 'next/image';
import {
  Heart,
  MessageCircle,
  Send,
  Bookmark,
  MoreHorizontal,
  ImageOff,
} from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatCount, formatRelativeTime, getInitial } from './_utils';
import type { PostPreviewProps } from './TwitterPostPreview';

function timestampLabel(post: SocialMediaPost): string {
  const rel = formatRelativeTime(post.publishedAt);
  if (rel) {return rel;}
  if (post.status === 'scheduled' && post.scheduledAt) {
    const sched = formatRelativeTime(post.scheduledAt);
    return sched ? `Scheduled · ${sched}` : 'Scheduled';
  }
  if (post.status === 'scheduled') {return 'Scheduled';}
  return 'Draft';
}

function fullTimestamp(post: SocialMediaPost): string {
  const source = post.publishedAt ?? post.scheduledAt;
  if (!source) {return '';}
  const date = source instanceof Date ? source : new Date(source);
  if (Number.isNaN(date.getTime())) {return '';}
  return date.toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

export function InstagramPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const meta = PLATFORM_META.instagram;
  const handleText = (account?.handle?.replace(/^@/, '') ?? account?.accountName ?? 'yourbrand').trim();
  const avatarChar = getInitial(account?.accountName ?? account?.handle);
  const mediaUrl = post.mediaUrls?.[0];
  const interactive = typeof onClick === 'function';

  const fullStamp = fullTimestamp(post);
  const fullDate = fullStamp.length > 0 ? fullStamp : timestampLabel(post);

  return (
    <div
      className={cn(
        'group relative w-full max-w-md overflow-hidden rounded-lg border border-border-light bg-card transition-colors',
        interactive && 'cursor-pointer hover:bg-surface-elevated/40',
      )}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (!interactive) {return;}
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          onClick?.();
        }
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2">
          {account?.avatarUrl ? (
            <Image
              src={account.avatarUrl}
              alt={handleText}
              width={32}
              height={32}
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold text-white"
              style={{ backgroundColor: meta.color }}
            >
              {avatarChar}
            </div>
          )}
          <div className="flex items-center gap-1 text-sm">
            <span className="font-bold text-foreground">{handleText}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{timestampLabel(post)}</span>
          </div>
        </div>
        <MoreHorizontal className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      </div>

      {/* Square media */}
      <div className="relative aspect-square w-full bg-surface-elevated">
        {mediaUrl ? (
          <Image
            src={mediaUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 448px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
            <ImageOff className="h-8 w-8" aria-hidden="true" />
            <span className="text-xs">No media</span>
          </div>
        )}
      </div>

      {/* Action row */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-3">
          <Heart className="h-6 w-6 text-foreground" aria-label="Like" />
          <MessageCircle className="h-6 w-6 text-foreground" aria-label="Comment" />
          <Send className="h-6 w-6 text-foreground" aria-label="Share" />
        </div>
        <Bookmark className="h-6 w-6 text-foreground" aria-label="Save" />
      </div>

      {/* Likes count */}
      {typeof post.metrics?.likes === 'number' && (
        <div className="px-3 text-sm font-bold text-foreground">
          {formatCount(post.metrics.likes)} likes
        </div>
      )}

      {/* Caption */}
      <div className={cn('px-3 pt-1 text-sm text-foreground', compact ? '' : '')}>
        <span className="font-bold">{handleText}</span>{' '}
        <span className={cn(compact ? 'line-clamp-1' : 'line-clamp-2')}>
          {post.content}
        </span>
      </div>

      {/* Comments preview */}
      {typeof post.metrics?.comments === 'number' && post.metrics.comments > 0 && (
        <div className="mt-1 px-3">
          <Button
            type="button"
            variant="link"
            className="h-auto p-0 text-sm font-normal text-muted-foreground hover:no-underline hover:text-foreground"
            onClick={(event) => event.stopPropagation()}
          >
            View all {formatCount(post.metrics.comments)} comments
          </Button>
        </div>
      )}

      {/* Bottom timestamp */}
      <div className="px-3 pb-3 pt-1 text-xs uppercase tracking-wide text-muted-foreground">
        {fullDate}
      </div>
    </div>
  );
}

export default InstagramPostPreview;
