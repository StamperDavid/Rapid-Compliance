'use client';

import * as React from 'react';
import Image from 'next/image';
import { Bookmark, Globe2, MessageCircle, Repeat2, Star } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { PLATFORM_META } from '@/lib/social/platform-config';

import { formatCount, formatRelativeTime, getInitial } from './_utils';

interface MastodonPostPreviewProps {
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
 * Mastodon toot preview (LIVE platform — high fidelity).
 * Larger 48px avatar, federated @user@instance handle, visibility globe,
 * Mastodon-purple left accent on published toots, boost / star / bookmark
 * (note: Mastodon uses STAR for favorites, not heart).
 */
export function MastodonPostPreview({
  post,
  account,
  onClick,
  compact: _compact = false,
}: MastodonPostPreviewProps): React.ReactElement {
  const interactive = typeof onClick === 'function';
  const displayName = account?.accountName ?? account?.handle ?? 'User';

  // Federated handle: must include the @instance suffix.
  const rawHandle = (account?.handle ?? '').replace(/^@/, '').trim();
  const handle = rawHandle.length > 0
    ? (rawHandle.includes('@') ? rawHandle : `${rawHandle}@mastodon.social`)
    : 'unknown@mastodon.social';

  const avatarLetter = getInitial(displayName);
  const relativeTime = formatRelativeTime(post.publishedAt ?? post.createdAt);
  const mediaUrl = post.mediaUrls?.[0];
  const extraMediaCount = (post.mediaUrls?.length ?? 0) - 1;
  const isPublished = post.status === 'published';
  const mastodonColor = PLATFORM_META.mastodon.color;

  const replies = post.metrics?.comments;
  const boosts = post.metrics?.shares;
  const favorites = post.metrics?.likes;

  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border-light p-4',
        interactive && 'cursor-pointer transition-shadow hover:shadow-md'
      )}
      style={isPublished ? { borderLeft: `2px solid ${mastodonColor}` } : undefined}
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
        {/* Avatar — 48px (Mastodon convention) */}
        <div className="flex-shrink-0">
          {account?.avatarUrl ? (
            <Image
              src={account.avatarUrl}
              alt={displayName}
              width={48}
              height={48}
              className="w-12 h-12 rounded-full object-cover"
              unoptimized
            />
          ) : (
            <div className="w-12 h-12 rounded-full bg-surface-elevated flex items-center justify-center text-base font-semibold text-foreground">
              {avatarLetter}
            </div>
          )}
        </div>

        {/* Name / handle / visibility / time */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-sm font-bold text-foreground truncate">{displayName}</div>
              <div className="text-xs text-muted-foreground truncate">@{handle}</div>
              <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                <Globe2 className="w-3 h-3" aria-label="Public" />
                <span>Public</span>
              </div>
            </div>
            {relativeTime && (
              <span className="text-xs text-muted-foreground flex-shrink-0">{relativeTime}</span>
            )}
          </div>

          {/* Body — Mastodon allows ~500 chars, give it more room */}
          <div className="text-sm text-foreground mt-2 whitespace-pre-wrap break-words line-clamp-6">
            {post.content}
          </div>

          {/* Media (first only, with +N badge if more) */}
          {mediaUrl && (
            <div className="relative mt-3 rounded-xl overflow-hidden border border-border-light">
              <Image
                src={mediaUrl}
                alt="Toot media"
                width={500}
                height={384}
                className="w-full h-auto object-cover max-h-96"
                unoptimized
              />
              {extraMediaCount > 0 && (
                <div className="absolute top-2 right-2 bg-black/70 text-white text-xs font-semibold px-2 py-1 rounded">
                  +{extraMediaCount} more
                </div>
              )}
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
              aria-label="Boost"
            >
              <Repeat2 className="w-4 h-4" />
              {typeof boosts === 'number' && (
                <span className="text-xs">{formatCount(boosts)}</span>
              )}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Favorite"
            >
              <Star className="w-4 h-4" />
              {typeof favorites === 'number' && (
                <span className="text-xs">{formatCount(favorites)}</span>
              )}
            </button>
            <button
              type="button"
              className="flex items-center gap-1.5 hover:text-foreground transition-colors"
              onClick={(e) => e.stopPropagation()}
              aria-label="Bookmark"
            >
              <Bookmark className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
