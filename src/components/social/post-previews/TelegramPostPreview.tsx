/**
 * TelegramPostPreview — evokes a Telegram channel post. Thin blue accent
 * bar at top, channel header, body, optional media bleeding to card edges,
 * and a footer showing view count + edit pencil + relative time.
 * Pure presentational component; no data fetching, no side effects.
 */

import * as React from 'react';
import Image from 'next/image';
import { Eye, Pencil, Forward } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
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

export function TelegramPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const meta = PLATFORM_META.telegram;
  const trimmedName = account?.accountName?.trim();
  const trimmedHandle = account?.handle?.trim();
  const channelName =
    (trimmedName && trimmedName.length > 0 ? trimmedName : undefined) ??
    (trimmedHandle && trimmedHandle.length > 0 ? trimmedHandle : undefined) ??
    'Your Channel';
  const avatarChar = getInitial(channelName);
  const mediaUrl = post.mediaUrls?.[0];
  const viewCount = post.metrics?.impressions;

  const interactive = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'group relative w-full max-w-xl overflow-hidden rounded-xl border border-border-light bg-card transition-colors',
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
      {/* Telegram-blue accent bar */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      />

      <div className={cn(compact ? 'p-3' : 'p-4')}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {account?.avatarUrl ? (
              <Image
                src={account.avatarUrl}
                alt={channelName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
                unoptimized
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
            <div className="truncate text-sm font-bold text-foreground">{channelName}</div>
            <div className="text-xs text-muted-foreground">📡 Channel</div>
          </div>
        </div>

        {/* Body */}
        <p
          className={cn(
            'mt-3 whitespace-pre-wrap leading-relaxed text-foreground',
            compact && 'line-clamp-4 text-sm',
          )}
        >
          {post.content}
        </p>

        {/* Media — bleed to card edges */}
        {mediaUrl && (
          <div className={cn('mt-3 overflow-hidden', compact ? '-mx-3' : '-mx-4')}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={mediaUrl}
              alt=""
              className="max-h-96 w-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center gap-2">
            <Eye className="h-3.5 w-3.5" aria-hidden="true" />
            <span>{formatCount(viewCount ?? 0)}</span>
            <span>·</span>
            <Pencil className="h-3 w-3" aria-hidden="true" />
            <span>{timestampLabel(post)}</span>
          </div>
          <Forward className="h-3.5 w-3.5" aria-label="Forward" />
        </div>
      </div>
    </div>
  );
}

export default TelegramPostPreview;
