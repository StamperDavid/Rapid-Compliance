'use client';

import * as React from 'react';
import Image from 'next/image';
import { Heart, MessageCircle, MoreHorizontal, Repeat2 } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { PLATFORM_META } from '@/lib/social/platform-config';

import { formatCount, formatRelativeTime, getInitial } from './_utils';

interface BlueskyPostPreviewProps {
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
 * Bluesky skeet preview (LIVE platform — high fidelity).
 * Tweet-shaped card with the Bluesky-blue left accent on published posts,
 * federated handle (@user.bsky.social), and engagement icons (reply,
 * repost, like, more).
 */
export function BlueskyPostPreview({
  post,
  account,
  onClick,
  compact: _compact = false,
}: BlueskyPostPreviewProps): React.ReactElement {
  const interactive = typeof onClick === 'function';
  const displayName = account?.accountName ?? account?.handle ?? 'User';

  // Bluesky handles always include the domain; default to .bsky.social if not present.
  const rawHandle = (account?.handle ?? '').replace(/^@/, '').trim();
  const handle = rawHandle.length > 0
    ? (rawHandle.includes('.') ? rawHandle : `${rawHandle}.bsky.social`)
    : 'unknown.bsky.social';

  const avatarLetter = getInitial(displayName);
  const relativeTime = formatRelativeTime(post.publishedAt ?? post.createdAt);
  const mediaUrl = post.mediaUrls?.[0];
  const isPublished = post.status === 'published';
  const blueskyColor = PLATFORM_META.bluesky.color;

  const replies = post.metrics?.comments;
  const reposts = post.metrics?.shares;
  const likes = post.metrics?.likes;

  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border-light p-4',
        interactive && 'cursor-pointer transition-shadow hover:shadow-md'
      )}
      style={isPublished ? { borderLeft: `2px solid ${blueskyColor}` } : undefined}
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
      {/* Header row */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="flex-shrink-0">
          {account?.avatarUrl ? (
            <Image
              src={account.avatarUrl}
              alt={displayName}
              width={40}
              height={40}
              className="w-10 h-10 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-10 h-10 rounded-full bg-surface-elevated flex items-center justify-center text-sm font-semibold text-foreground">
              {avatarLetter}
            </div>
          )}
        </div>

        {/* Name / handle / time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1 text-sm flex-wrap">
            <span className="font-bold text-foreground truncate">{displayName}</span>
            <span className="text-muted-foreground truncate">@{handle}</span>
            {relativeTime && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{relativeTime}</span>
              </>
            )}
          </div>

          {/* Body */}
          <div className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
            {post.content}
          </div>

          {/* Media */}
          {mediaUrl && (
            <div className="relative mt-3 rounded-xl overflow-hidden border border-border-light max-h-96">
              <Image
                src={mediaUrl}
                alt="Skeet media"
                width={500}
                height={384}
                className="w-full h-auto object-cover max-h-96"
                unoptimized
              />
            </div>
          )}

          {/* Engagement row */}
          <div className="flex items-center justify-between mt-3 max-w-md text-muted-foreground">
            <button
              type="button"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Reply"
            >
              <MessageCircle className="w-4 h-4" />
              {typeof replies === 'number' && (
                <span className="text-xs">{formatCount(replies)}</span>
              )}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Repost"
            >
              <Repeat2 className="w-4 h-4" />
              {typeof reposts === 'number' && (
                <span className="text-xs">{formatCount(reposts)}</span>
              )}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Like"
            >
              <Heart className="w-4 h-4" />
              {typeof likes === 'number' && (
                <span className="text-xs">{formatCount(likes)}</span>
              )}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="More"
            >
              <MoreHorizontal className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
