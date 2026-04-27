'use client';

import * as React from 'react';
import Image from 'next/image';
import { Bookmark, Heart, MessageCircle, Music2, Play, Share2 } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { formatCount } from './_utils';

interface TikTokPostPreviewProps {
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
 * TikTok video preview — vertical 9:16 card with full-bleed media,
 * bottom-left caption overlay, right-side stack of action icons.
 */
export function TikTokPostPreview({
  post,
  account,
  onClick,
  compact: _compact = false,
}: TikTokPostPreviewProps): React.ReactElement {
  const mediaUrl = post.mediaUrls?.[0];
  const handle = account?.handle ?? account?.accountName ?? 'creator';
  const interactive = typeof onClick === 'function';

  const likes = post.metrics?.likes;
  const comments = post.metrics?.comments;
  const shares = post.metrics?.shares;
  // No bookmark count on PostMetrics — show icon only.

  return (
    <div
      className={cn(
        'relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-w-[280px] w-full',
        interactive && 'cursor-pointer transition-transform hover:scale-105'
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
      {/* Background media */}
      {mediaUrl ? (
        <Image
          src={mediaUrl}
          alt={post.content.slice(0, 80)}
          fill
          sizes="280px"
          className="object-cover"
          unoptimized
        />
      ) : (
        <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-500 flex items-center justify-center">
          <Play className="w-16 h-16 text-white" fill="currentColor" />
        </div>
      )}

      {/* Bottom-left caption overlay */}
      <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/80 to-transparent p-3 pr-14">
        <div className="text-white font-bold text-sm">@{handle}</div>
        <div className="text-white text-xs mt-1 line-clamp-2 leading-snug">{post.content}</div>
        <div className="flex items-center gap-1 text-white/90 text-xs mt-2">
          <Music2 className="w-3 h-3" />
          <span className="truncate">Original sound</span>
        </div>
      </div>

      {/* Right-side action stack */}
      <div className="absolute right-2 bottom-20 flex flex-col items-center gap-4">
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-white"
          onClick={(e) => e.stopPropagation()}
          aria-label="Like"
        >
          <Heart className="w-7 h-7" />
          {typeof likes === 'number' && (
            <span className="text-xs font-semibold">{formatCount(likes)}</span>
          )}
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-white"
          onClick={(e) => e.stopPropagation()}
          aria-label="Comment"
        >
          <MessageCircle className="w-7 h-7" />
          {typeof comments === 'number' && (
            <span className="text-xs font-semibold">{formatCount(comments)}</span>
          )}
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-white"
          onClick={(e) => e.stopPropagation()}
          aria-label="Share"
        >
          <Share2 className="w-7 h-7" />
          {typeof shares === 'number' && (
            <span className="text-xs font-semibold">{formatCount(shares)}</span>
          )}
        </button>
        <button
          type="button"
          className="flex flex-col items-center gap-1 text-white"
          onClick={(e) => e.stopPropagation()}
          aria-label="Bookmark"
        >
          <Bookmark className="w-7 h-7" />
        </button>
      </div>
    </div>
  );
}
