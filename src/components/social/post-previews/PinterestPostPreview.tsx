'use client';

import * as React from 'react';
import Image from 'next/image';
import { ImageIcon, MoreHorizontal } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { PLATFORM_META } from '@/lib/social/platform-config';

interface PinterestPostPreviewProps {
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
 * Pinterest pin preview — tall (3:4) image card with always-visible Save
 * overlay and a footer with title + destination/account.
 */
export function PinterestPostPreview({
  post,
  account,
  onClick,
  compact: _compact = false,
}: PinterestPostPreviewProps): React.ReactElement {
  const mediaUrl = post.mediaUrls?.[0];
  // SocialMediaPost has no metadata.title — fall back to first 50 chars of content.
  const title = post.content.trim().slice(0, 80) || 'Untitled pin';
  // No metadata.destinationUrl on SocialMediaPost — fall back to account name.
  const destination = account?.accountName ?? account?.handle ?? 'Pin';
  const interactive = typeof onClick === 'function';
  const pinterestRed = PLATFORM_META.pinterest.color;

  return (
    <div
      className={cn(
        'rounded-2xl overflow-hidden bg-card border border-border-light',
        interactive && 'cursor-pointer transition-shadow hover:shadow-lg',
        'max-w-xs w-full'
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
      {/* Image with overlay */}
      <div className="relative w-full aspect-[3/4] bg-surface-elevated">
        {mediaUrl ? (
          <Image
            src={mediaUrl}
            alt={title}
            fill
            sizes="(max-width: 640px) 100vw, 320px"
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-surface-elevated to-surface-main">
            <ImageIcon className="w-12 h-12 text-muted-foreground" />
          </div>
        )}

        {/* Save button (top-right) */}
        <div className="absolute top-2 right-2">
          <button
            type="button"
            className="text-white font-semibold rounded-full px-4 py-2 text-sm shadow-md hover:opacity-90"
            style={{ backgroundColor: pinterestRed }}
            onClick={(e) => e.stopPropagation()}
          >
            Save
          </button>
        </div>

        {/* More dots (top-left) */}
        <div className="absolute top-2 left-2">
          <button
            type="button"
            className="bg-white/80 hover:bg-white text-foreground rounded-full p-1.5 shadow"
            onClick={(e) => e.stopPropagation()}
            aria-label="More"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="p-3">
        <div className="text-sm font-semibold text-foreground line-clamp-2">{title}</div>
        <div className="text-xs text-muted-foreground mt-1 truncate">{destination}</div>
      </div>
    </div>
  );
}
