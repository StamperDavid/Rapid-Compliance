/**
 * RedditPostPreview — evokes Reddit's distinctive layout: vote arrow stack
 * on the left, content (subreddit, title, body, media, action row) on the right.
 * Less rounded than other cards (Reddit's signature). Pure presentational.
 */

import * as React from 'react';
import {
  ArrowBigUp,
  ArrowBigDown,
  MessageSquare,
  Share2,
  Bookmark,
  MoreHorizontal,
} from 'lucide-react';

import Image from 'next/image';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { formatCount, formatRelativeTime, getInitial } from './_utils';

export interface PostPreviewAccount {
  handle?: string;
  accountName?: string;
  avatarUrl?: string;
}

export interface PostPreviewProps {
  post: SocialMediaPost;
  account?: PostPreviewAccount;
  onClick?: () => void;
  compact?: boolean;
}

/**
 * Subreddit/title hints can travel on the post under `metadata`. We treat
 * `metadata` as an opaque record (not modeled on SocialMediaPost) and pull
 * the strings safely.
 */
function readMetaString(post: SocialMediaPost, key: string): string | undefined {
  const meta = (post as { metadata?: Record<string, unknown> }).metadata;
  if (!meta) {return undefined;}
  const value = meta[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
}

function timestampLabel(post: SocialMediaPost): string {
  const rel = formatRelativeTime(post.publishedAt ?? post.createdAt);
  if (rel) {return rel;}
  if (post.status === 'scheduled' && post.scheduledAt) {
    const sched = formatRelativeTime(post.scheduledAt);
    return sched ? `Scheduled · ${sched}` : 'Scheduled';
  }
  if (post.status === 'scheduled') {return 'Scheduled';}
  return 'Draft';
}

export function RedditPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const subreddit = readMetaString(post, 'subreddit') ?? 'all';
  const handleText = account?.handle?.replace(/^@|^u\//, '') ?? 'yourbrand';
  const explicitTitle = readMetaString(post, 'title');
  const bodyContent = post.content ?? '';
  const title =
    explicitTitle ??
    (bodyContent.length > 80 ? `${bodyContent.slice(0, 80).trim()}…` : bodyContent || 'Untitled post');
  // Only render a body section when title was provided separately; otherwise the
  // title already represents the content and we'd be repeating ourselves.
  const body = explicitTitle ? bodyContent : '';
  const mediaUrl = post.mediaUrls?.[0];
  const voteCount = post.metrics?.likes;
  const commentCount = post.metrics?.comments;
  // getInitial is used in screenreader-only text to keep parity with other previews.
  const ariaInitial = getInitial(handleText);

  const interactive = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'group relative flex w-full max-w-xl flex-row overflow-hidden rounded-md border border-border-light bg-card transition-colors',
        interactive && 'cursor-pointer hover:bg-surface-elevated/50',
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
      {/* Vote stack */}
      <div className="flex w-10 flex-col items-center justify-start gap-1 bg-surface-elevated py-2">
        <ArrowBigUp className="h-5 w-5 text-muted-foreground" aria-label="Upvote" />
        <span className="text-xs font-semibold text-foreground">
          {typeof voteCount === 'number' ? formatCount(voteCount) : '—'}
        </span>
        <ArrowBigDown className="h-5 w-5 text-muted-foreground" aria-label="Downvote" />
      </div>

      {/* Right column */}
      <div className="min-w-0 flex-1 p-3">
        <div className="text-xs text-muted-foreground">
          <span className="font-medium text-foreground">r/{subreddit}</span>
          <span className="mx-1">·</span>
          <span aria-label={`Posted by user starting with ${ariaInitial}`}>
            Posted by u/{handleText}
          </span>
          <span className="mx-1">·</span>
          <span>{timestampLabel(post)}</span>
        </div>

        <h3 className="mt-1 text-base font-bold leading-snug text-foreground">{title}</h3>

        {body && (
          <p
            className={cn(
              'mt-2 whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground',
              compact && 'line-clamp-3',
            )}
          >
            {body}
          </p>
        )}

        {mediaUrl && (
          <div className="mt-3 overflow-hidden rounded-md border border-border-light">
            <Image
              src={mediaUrl}
              alt=""
              width={500}
              height={384}
              className="max-h-96 w-full object-contain"
              unoptimized
            />
          </div>
        )}

        {/* Action row */}
        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-1.5" aria-label="Comments">
            <MessageSquare className="h-4 w-4" aria-hidden="true" />
            <span>{formatCount(commentCount ?? 0)} comments</span>
          </div>
          <div className="flex items-center gap-1.5" aria-label="Share">
            <Share2 className="h-4 w-4" aria-hidden="true" />
            <span>Share</span>
          </div>
          <div className="flex items-center gap-1.5" aria-label="Save">
            <Bookmark className="h-4 w-4" aria-hidden="true" />
            <span>Save</span>
          </div>
          <MoreHorizontal className="h-4 w-4" aria-label="More" />
        </div>
      </div>
    </div>
  );
}

export default RedditPostPreview;
