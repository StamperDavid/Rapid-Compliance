'use client';

import * as React from 'react';
import Image from 'next/image';
import { Play } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { formatCount, formatRelativeTime, getInitial } from './_utils';

interface YouTubePostPreviewProps {
  post: SocialMediaPost;
  account?: {
    handle?: string;
    accountName?: string;
    avatarUrl?: string;
  };
  onClick?: () => void;
  compact?: boolean;
}

/**
 * YouTube video preview — thumbnail card with title row, channel name,
 * view count and relative time. Evokes the YouTube grid item without
 * cloning it. Uses Lucide Play icon for the placeholder triangle.
 */
export function YouTubePostPreview({
  post,
  account,
  onClick,
  compact = false,
}: YouTubePostPreviewProps): React.ReactElement {
  const thumbnailUrl = post.mediaUrls?.[0];
  const firstContentLine = post.content.split('\n')[0]?.trim() ?? '';
  const title = firstContentLine.length > 0 ? firstContentLine : 'Untitled video';
  const channelName = account?.accountName ?? account?.handle ?? 'Channel';
  const avatarLetter = getInitial(channelName);
  const viewCount =
    typeof post.metrics?.impressions === 'number'
      ? `${formatCount(post.metrics.impressions)} views`
      : null;
  const relativeTime = formatRelativeTime(post.publishedAt ?? post.createdAt);
  const interactive = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'bg-card rounded-xl overflow-hidden border border-border-light',
        interactive && 'cursor-pointer transition-shadow hover:shadow-md',
        compact && 'max-w-sm'
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
    >
      {/* Thumbnail */}
      <div className="relative w-full aspect-video bg-surface-elevated">
        {thumbnailUrl ? (
          <Image
            src={thumbnailUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, 480px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <Play className="w-12 h-12 text-muted-foreground" fill="currentColor" />
          </div>
        )}
        {/* Duration badge — placeholder since SocialMediaPost has no duration field */}
        <div className="absolute bottom-2 right-2 bg-black/80 text-white text-xs px-1 py-0.5 rounded">
          —
        </div>
      </div>

      {/* Body row */}
      <div className="p-3 flex gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {account?.avatarUrl ? (
            <Image
              src={account.avatarUrl}
              alt={channelName}
              width={32}
              height={32}
              className="w-8 h-8 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-8 h-8 rounded-full bg-surface-elevated flex items-center justify-center text-sm font-semibold text-foreground">
              {avatarLetter}
            </div>
          )}
        </div>

        {/* Title + meta */}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground line-clamp-2">{title}</div>
          <div className="text-xs text-muted-foreground mt-1 truncate">
            {channelName}
            {viewCount && (
              <>
                <span className="mx-1">·</span>
                {viewCount}
              </>
            )}
            {relativeTime && (
              <>
                <span className="mx-1">·</span>
                {relativeTime}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
