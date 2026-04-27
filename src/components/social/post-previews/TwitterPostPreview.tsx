/**
 * TwitterPostPreview — evokes the X (Twitter) feed feel without cloning it.
 * Pure presentational component; no data fetching, no side effects.
 */

import * as React from 'react';
import Image from 'next/image';
import {
  MessageCircle,
  Repeat2,
  Heart,
  BarChart2,
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
  const rel = formatRelativeTime(post.publishedAt);
  if (rel) {return rel;}
  if (post.status === 'scheduled' && post.scheduledAt) {
    const sched = formatRelativeTime(post.scheduledAt);
    return sched ? `Scheduled · ${sched}` : 'Scheduled';
  }
  if (post.status === 'scheduled') {return 'Scheduled';}
  return 'Draft';
}

export function TwitterPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const meta = PLATFORM_META.twitter;
  const trimmedName = account?.accountName?.trim();
  const displayName = trimmedName && trimmedName.length > 0 ? trimmedName : 'Your Brand';
  const handleText = account?.handle?.replace(/^@/, '') ?? 'yourbrand';
  const avatarChar = getInitial(account?.accountName ?? account?.handle);
  const mediaUrl = post.mediaUrls?.[0];

  const engagement: EngagementSlot[] = [
    { key: 'reply', Icon: MessageCircle, count: post.metrics?.comments, label: 'Replies' },
    { key: 'retweet', Icon: Repeat2, count: post.metrics?.shares, label: 'Reposts' },
    { key: 'like', Icon: Heart, count: post.metrics?.likes, label: 'Likes' },
    { key: 'views', Icon: BarChart2, count: post.metrics?.impressions, label: 'Views' },
  ];

  const interactive = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'group relative w-full max-w-xl rounded-2xl border border-border-light bg-card transition-colors',
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
      <div className="flex items-start gap-3">
        {/* Avatar */}
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
          {/* Header row */}
          <div className="flex items-center gap-1 text-sm">
            <span className="truncate font-bold text-foreground">{displayName}</span>
            <span className="truncate text-muted-foreground">@{handleText}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{timestampLabel(post)}</span>
          </div>

          {/* Body */}
          <p
            className={cn(
              'mt-1 whitespace-pre-wrap leading-relaxed text-foreground',
              compact && 'line-clamp-3 text-sm',
            )}
          >
            {post.content}
          </p>

          {/* Media */}
          {mediaUrl && (
            <div className="relative mt-3 h-80 w-full overflow-hidden rounded-xl border border-border-light bg-surface-elevated">
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

          {/* Engagement row */}
          <div className="mt-3 flex items-center justify-between text-muted-foreground">
            {engagement.map(({ key, Icon, count, label }) => (
              <div
                key={key}
                className="flex items-center gap-1.5 text-xs"
                aria-label={label}
              >
                <Icon className="h-4 w-4" aria-hidden="true" />
                {typeof count === 'number' && <span>{formatCount(count)}</span>}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default TwitterPostPreview;
