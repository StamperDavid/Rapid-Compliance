/**
 * ThreadsPostPreview — evokes Meta's Threads feed: distinctively minimalist,
 * monochrome chrome, generous space for the body (Threads cap is 500 chars).
 * Pure presentational component; no data fetching, no side effects.
 */

import * as React from 'react';
import Image from 'next/image';
import {
  MessageCircle,
  Repeat2,
  Heart,
  Send,
  MoreHorizontal,
  type LucideIcon,
} from 'lucide-react';

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

interface EngagementSlot {
  key: string;
  Icon: LucideIcon;
  count?: number;
  label: string;
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

export function ThreadsPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const meta = PLATFORM_META.threads;
  // Threads doesn't visually distinguish display name from handle — handle is primary.
  const handleText = account?.handle?.replace(/^@/, '') ?? account?.accountName ?? 'yourbrand';
  const avatarChar = getInitial(account?.accountName ?? account?.handle);
  const mediaUrl = post.mediaUrls?.[0];

  const engagement: EngagementSlot[] = [
    { key: 'like', Icon: Heart, count: post.metrics?.likes, label: 'Likes' },
    { key: 'reply', Icon: MessageCircle, count: post.metrics?.comments, label: 'Replies' },
    { key: 'repost', Icon: Repeat2, count: post.metrics?.shares, label: 'Reposts' },
    { key: 'send', Icon: Send, count: undefined, label: 'Share' },
  ];

  const interactive = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'group relative w-full max-w-xl rounded-xl border border-border-light bg-card transition-colors',
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
              alt={handleText}
              width={40}
              height={40}
              className="h-10 w-10 rounded-full object-cover"
              unoptimized
            />
          ) : (
            // Threads is monochrome — avatar uses the platform color (black) for fidelity.
            <div
              className="flex h-10 w-10 items-center justify-center rounded-full text-sm font-semibold text-white"
              style={{ backgroundColor: meta.color }}
            >
              {avatarChar}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2 text-sm">
            <div className="flex min-w-0 items-center gap-1">
              <span className="truncate font-bold text-foreground">{handleText}</span>
              <span className="text-muted-foreground">·</span>
              <span className="text-muted-foreground">{timestampLabel(post)}</span>
            </div>
            <MoreHorizontal
              className="h-4 w-4 flex-shrink-0 text-muted-foreground"
              aria-hidden="true"
            />
          </div>

          {/* Body — generous space for 500-char cap */}
          <p
            className={cn(
              'mt-1 whitespace-pre-wrap leading-relaxed text-foreground',
              compact && 'line-clamp-4 text-sm',
            )}
          >
            {post.content}
          </p>

          {/* Media */}
          {mediaUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-border-light">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl}
                alt=""
                className="max-h-96 w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

          {/* Engagement row — 4 evenly spaced icons, monochrome */}
          <div className="mt-3 flex items-center gap-6 text-muted-foreground">
            {engagement.map(({ key, Icon, count, label }) => (
              <div
                key={key}
                className="flex items-center gap-1.5 text-xs"
                aria-label={label}
              >
                <Icon className="h-5 w-5" aria-hidden="true" />
                {typeof count === 'number' && count > 0 && <span>{formatCount(count)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ThreadsPostPreview;
