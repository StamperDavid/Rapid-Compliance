/**
 * FacebookPostPreview — evokes the Facebook News Feed feel without cloning it.
 * Pure presentational component; no data fetching, no side effects.
 */

import * as React from 'react';
import Image from 'next/image';
import {
  Globe,
  ThumbsUp,
  MessageCircle,
  Share2,
  type LucideIcon,
} from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatCount, formatRelativeTime, getInitial } from './_utils';
import type { PostPreviewProps } from './TwitterPostPreview';

interface ActionSlot {
  key: string;
  Icon: LucideIcon;
  label: string;
}

const ACTIONS: ActionSlot[] = [
  { key: 'like', Icon: ThumbsUp, label: 'Like' },
  { key: 'comment', Icon: MessageCircle, label: 'Comment' },
  { key: 'share', Icon: Share2, label: 'Share' },
];

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

export function FacebookPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const meta = PLATFORM_META.facebook;
  const trimmedName = account?.accountName?.trim();
  const displayName = trimmedName && trimmedName.length > 0 ? trimmedName : 'Your Brand';
  const avatarChar = getInitial(account?.accountName ?? account?.handle);
  const mediaUrl = post.mediaUrls?.[0];
  const interactive = typeof onClick === 'function';

  const isShortPost = post.content.trim().length > 0 && post.content.trim().length < 100;

  const reactionCount = post.metrics?.likes;
  const commentCount = post.metrics?.comments;
  const shareCount = post.metrics?.shares;
  const hasReactionSummary =
    typeof reactionCount === 'number' ||
    typeof commentCount === 'number' ||
    typeof shareCount === 'number';

  return (
    <div
      className={cn(
        'group relative w-full max-w-xl overflow-hidden rounded-lg border border-border-light bg-card transition-colors',
        compact ? 'p-3' : 'p-4',
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
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {account?.avatarUrl ? (
            <Image
              src={account.avatarUrl}
              alt={displayName}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: meta.color }}
            >
              {avatarChar}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{displayName}</div>
          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <span>{timestampLabel(post)}</span>
            <span>·</span>
            <Globe className="h-3 w-3" aria-label="Public" />
          </div>
        </div>
      </div>

      {/* Body */}
      <p
        className={cn(
          'mt-3 whitespace-pre-wrap leading-relaxed text-foreground',
          isShortPost ? 'text-lg' : 'text-sm',
          compact && 'line-clamp-3 text-sm',
        )}
      >
        {post.content}
      </p>

      {/* Media — bleeds to card edges per FB style */}
      {mediaUrl && (
        <div
          className={cn(
            'relative mt-3 w-full overflow-hidden bg-surface-elevated',
            compact ? '-mx-3 h-64 w-[calc(100%+1.5rem)]' : '-mx-4 h-80 w-[calc(100%+2rem)]',
          )}
        >
          <Image
            src={mediaUrl}
            alt=""
            fill
            unoptimized
            sizes="(max-width: 640px) 100vw, 576px"
            className="object-cover"
          />
        </div>
      )}

      {/* Reaction summary line */}
      {hasReactionSummary && (
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          {typeof reactionCount === 'number' ? (
            <div className="flex items-center gap-1">
              <span
                className="flex h-4 w-4 items-center justify-center rounded-full text-[10px] text-white"
                style={{ backgroundColor: meta.color }}
                aria-hidden="true"
              >
                <ThumbsUp className="h-2.5 w-2.5" />
              </span>
              <span>{formatCount(reactionCount)}</span>
            </div>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            {typeof commentCount === 'number' && (
              <span>{formatCount(commentCount)} comments</span>
            )}
            {typeof shareCount === 'number' && (
              <span>{formatCount(shareCount)} shares</span>
            )}
          </div>
        </div>
      )}

      {/* Divider */}
      <div className="mt-2 h-px w-full bg-border-light" />

      {/* Action row */}
      <div className="mt-1 flex items-center justify-between gap-1">
        {ACTIONS.map(({ key, Icon, label }) => (
          <Button
            key={key}
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 gap-1.5 text-xs font-medium text-muted-foreground"
            onClick={(event) => event.stopPropagation()}
            aria-label={label}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span>{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default FacebookPostPreview;
