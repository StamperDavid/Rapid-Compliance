/**
 * TruthSocialPostPreview — visually mirrors Mastodon (same protocol/layout)
 * but renders an ALWAYS-VISIBLE "Posting Parked" overlay because Truth
 * Social's Cloudflare TLS-fingerprint wall blocks server-side posting.
 *
 * The underlying card is preserved (not removed) so the layout stays correct
 * if a future API path opens. The overlay sits on top so operators see at a
 * glance that this platform doesn't actually post today.
 *
 * Pure presentational, no data fetching.
 */

import * as React from 'react';
import Image from 'next/image';
import {
  MessageCircle,
  Repeat2,
  Heart,
  Bookmark,
  AlertTriangle,
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

export function TruthSocialPostPreview({
  post,
  account,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const meta = PLATFORM_META.truth_social;
  const trimmedName = account?.accountName?.trim();
  const displayName =
    trimmedName && trimmedName.length > 0 ? trimmedName : 'Your Brand';
  const handleText = account?.handle?.replace(/^@/, '') ?? 'yourbrand';
  const avatarChar = getInitial(account?.accountName ?? account?.handle);
  const mediaUrl = post.mediaUrls?.[0];

  const engagement: EngagementSlot[] = [
    { key: 'reply', Icon: MessageCircle, count: post.metrics?.comments, label: 'Replies' },
    { key: 'boost', Icon: Repeat2, count: post.metrics?.shares, label: 'Boosts' },
    { key: 'fav', Icon: Heart, count: post.metrics?.likes, label: 'Favorites' },
    { key: 'bookmark', Icon: Bookmark, count: undefined, label: 'Bookmark' },
  ];

  return (
    <div
      className={cn(
        'relative w-full max-w-xl rounded-xl border border-border-light border-l-2 bg-card',
        compact ? 'p-3' : 'p-4',
      )}
      style={{ borderLeftColor: meta.color }}
      // Click handler intentionally not wired — posting is parked.
      // Operators must not be able to act on these previews accidentally.
      aria-disabled="true"
    >
      {/* Underlying Mastodon-style card */}
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          {account?.avatarUrl ? (
            <Image
              src={account.avatarUrl}
              alt={displayName}
              width={48}
              height={48}
              className="h-12 w-12 rounded-md object-cover"
              unoptimized
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-md text-sm font-semibold text-white"
              style={{ backgroundColor: meta.color }}
            >
              {avatarChar}
            </div>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1 text-sm">
            <span className="truncate font-bold text-foreground">{displayName}</span>
            <span className="truncate text-muted-foreground">@{handleText}</span>
            <span className="text-muted-foreground">·</span>
            <span className="text-muted-foreground">{timestampLabel(post)}</span>
          </div>

          <p
            className={cn(
              'mt-1 whitespace-pre-wrap leading-relaxed text-foreground',
              compact && 'line-clamp-3 text-sm',
            )}
          >
            {post.content}
          </p>

          {mediaUrl && (
            <div className="mt-3 overflow-hidden rounded-xl border border-border-light">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={mediaUrl}
                alt=""
                className="max-h-80 w-full object-cover"
                loading="lazy"
              />
            </div>
          )}

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

      {/* PARKED OVERLAY — always visible, not hover-triggered */}
      <div
        className="absolute inset-0 z-10 flex items-center justify-center rounded-xl bg-card/80 backdrop-blur-sm"
        role="status"
        aria-label="Truth Social posting is parked"
      >
        <div className="mx-4 max-w-xs rounded-lg border border-border-light bg-card p-4 text-center shadow-lg">
          <div className="flex justify-center">
            <AlertTriangle className="h-6 w-6 text-red-500" aria-hidden="true" />
          </div>
          <div className="mt-2 text-sm font-bold text-foreground">Posting Parked</div>
          <p className="mt-1 text-xs text-foreground">
            Cloudflare TLS-fingerprint wall blocks server-side posts. No path forward without
            browser-class infra.
          </p>
          <p className="mt-2 text-[11px] text-muted-foreground">
            Code preserved for future. Re-evaluate if Truth Social opens server-side access.
          </p>
        </div>
      </div>
    </div>
  );
}

export default TruthSocialPostPreview;
