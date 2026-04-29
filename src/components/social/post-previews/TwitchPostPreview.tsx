'use client';

import * as React from 'react';
import Image from 'next/image';
import { Heart, MessageSquare, Pin, Radio } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { formatCount, formatRelativeTime, getInitial } from './_utils';

// PLATFORM_META.twitch is added by the operator after the central Twitch
// developer app is registered. Until then we use a hard-coded Twitch
// purple as the accent so this component compiles standalone.
const TWITCH_PURPLE = '#9146FF';

interface TwitchPostPreviewProps {
  post: SocialMediaPost;
  account?: {
    handle?: string;
    accountName?: string;
    avatarUrl?: string;
  };
  onClick?: () => void;
  compact?: boolean;
}

type TwitchContentType =
  | 'stream_announcement'
  | 'chat_announcement'
  | 'clip_caption'
  | 'schedule_segment';

function readContentType(post: SocialMediaPost): TwitchContentType {
  // SocialMediaPost has no contentType field, so we look at metadata.
  // The composer/poster stores the variant on metadata.contentType.
  // Fall back to stream_announcement when missing.
  type WithMeta = SocialMediaPost & { metadata?: { contentType?: unknown } };
  const meta = (post as WithMeta).metadata;
  const raw = typeof meta?.contentType === 'string' ? meta.contentType : null;
  if (
    raw === 'stream_announcement' ||
    raw === 'chat_announcement' ||
    raw === 'clip_caption' ||
    raw === 'schedule_segment'
  ) {
    return raw;
  }
  return 'stream_announcement';
}

/**
 * Twitch post preview — Renders the four creator-track surfaces in a
 * Twitch-shaped card with the channel purple as the accent. Each
 * contentType has its own visual signature (live badge, pinned chat
 * highlight, clip play strip, schedule slot).
 */
export function TwitchPostPreview({
  post,
  account,
  onClick,
  compact: _compact = false,
}: TwitchPostPreviewProps): React.ReactElement {
  const interactive = typeof onClick === 'function';
  const displayName = account?.accountName ?? account?.handle ?? 'Channel';
  const handle = (account?.handle ?? 'channel').replace(/^@/, '').trim();
  const avatarLetter = getInitial(displayName);
  const relativeTime = formatRelativeTime(post.publishedAt ?? post.createdAt);
  const mediaUrl = post.mediaUrls?.[0];
  const isPublished = post.status === 'published';
  const contentType = readContentType(post);

  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border-light p-4',
        interactive && 'cursor-pointer transition-shadow hover:shadow-md',
      )}
      style={isPublished ? { borderLeft: `3px solid ${TWITCH_PURPLE}` } : undefined}
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
      {/* ── Header row ──────────────────────────────────────────────────── */}
      <div className="flex items-start gap-3">
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
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold text-white"
              style={{ backgroundColor: TWITCH_PURPLE }}
            >
              {avatarLetter}
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-sm flex-wrap">
            <span className="font-bold text-foreground truncate">{displayName}</span>
            <span className="text-muted-foreground truncate">@{handle}</span>
            {contentType === 'stream_announcement' && isPublished && (
              <span
                className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-white px-2 py-0.5 rounded"
                style={{ backgroundColor: '#EB0400' }}
              >
                <Radio className="w-3 h-3" />
                LIVE NOW
              </span>
            )}
            {relativeTime && (
              <>
                <span className="text-muted-foreground">·</span>
                <span className="text-muted-foreground">{relativeTime}</span>
              </>
            )}
          </div>

          {/* ── Surface-specific body ───────────────────────────────────── */}
          {contentType === 'stream_announcement' && (
            <StreamAnnouncementBody post={post} />
          )}
          {contentType === 'chat_announcement' && (
            <ChatAnnouncementBody post={post} />
          )}
          {contentType === 'clip_caption' && (
            <ClipCaptionBody post={post} mediaUrl={mediaUrl} />
          )}
          {contentType === 'schedule_segment' && (
            <ScheduleSegmentBody post={post} />
          )}

          {/* ── Engagement strip (chat + clip + announcement only) ─────── */}
          {contentType !== 'schedule_segment' && (
            <EngagementStrip post={post} />
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Surface-specific body components ────────────────────────────────────────

function StreamAnnouncementBody({ post }: { post: SocialMediaPost }): React.ReactElement {
  type WithMeta = SocialMediaPost & { metadata?: { category?: unknown } };
  const meta = (post as WithMeta).metadata;
  const category = typeof meta?.category === 'string' ? meta.category : null;
  return (
    <div className="mt-1">
      <div className="text-base font-semibold text-foreground whitespace-pre-wrap break-words">
        {post.content}
      </div>
      {category && (
        <div className="text-xs text-muted-foreground mt-1">
          Playing <span className="font-medium text-foreground">{category}</span>
        </div>
      )}
    </div>
  );
}

function ChatAnnouncementBody({ post }: { post: SocialMediaPost }): React.ReactElement {
  type WithMeta = SocialMediaPost & { metadata?: { color?: unknown } };
  const meta = (post as WithMeta).metadata;
  const colorKey = typeof meta?.color === 'string' ? meta.color : 'primary';
  const colorMap: Record<string, string> = {
    primary: TWITCH_PURPLE,
    blue: '#1F69FF',
    green: '#00C851',
    orange: '#FF8800',
    purple: '#9146FF',
  };
  const stripeColor = colorMap[colorKey] ?? TWITCH_PURPLE;
  return (
    <div
      className="mt-2 rounded-md border-l-4 px-3 py-2 bg-surface-elevated"
      style={{ borderLeftColor: stripeColor }}
    >
      <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide font-semibold text-muted-foreground mb-1">
        <Pin className="w-3 h-3" />
        Pinned chat announcement
      </div>
      <div className="text-sm text-foreground whitespace-pre-wrap break-words">
        {post.content}
      </div>
    </div>
  );
}

function ClipCaptionBody({
  post,
  mediaUrl,
}: {
  post: SocialMediaPost;
  mediaUrl: string | undefined;
}): React.ReactElement {
  return (
    <div className="mt-2">
      <div
        className="relative rounded-md overflow-hidden border border-border-light bg-black"
        style={{ aspectRatio: '16 / 9' }}
      >
        {mediaUrl ? (
          <Image
            src={mediaUrl}
            alt="Clip thumbnail"
            fill
            className="object-cover"
            unoptimized
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-white/60 text-xs">
            Clip thumbnail
          </div>
        )}
        <div className="absolute bottom-2 left-2 text-xs text-white bg-black/60 px-1.5 py-0.5 rounded">
          CLIP
        </div>
      </div>
      <div className="text-sm text-foreground mt-2 whitespace-pre-wrap break-words">
        {post.content}
      </div>
    </div>
  );
}

function ScheduleSegmentBody({ post }: { post: SocialMediaPost }): React.ReactElement {
  type WithMeta = SocialMediaPost & {
    metadata?: { segmentTitle?: unknown; durationMinutes?: unknown };
  };
  const meta = (post as WithMeta).metadata;
  const segmentTitle = typeof meta?.segmentTitle === 'string' ? meta.segmentTitle : null;
  const durationRaw = meta?.durationMinutes;
  const durationMinutes =
    typeof durationRaw === 'number'
      ? durationRaw
      : typeof durationRaw === 'string' && /^\d+$/.test(durationRaw)
        ? parseInt(durationRaw, 10)
        : null;

  return (
    <div
      className="mt-2 rounded-md border px-3 py-2"
      style={{ borderColor: TWITCH_PURPLE }}
    >
      <div className="flex items-center justify-between gap-2 mb-1">
        <div className="text-xs uppercase tracking-wide font-semibold text-muted-foreground">
          Schedule segment
        </div>
        {durationMinutes !== null && (
          <div className="text-xs text-muted-foreground">
            {durationMinutes} min
          </div>
        )}
      </div>
      {segmentTitle && (
        <div className="text-sm font-semibold text-foreground">
          {segmentTitle}
        </div>
      )}
      <div className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
        {post.content}
      </div>
    </div>
  );
}

function EngagementStrip({ post }: { post: SocialMediaPost }): React.ReactElement {
  const likes = post.metrics?.likes;
  const comments = post.metrics?.comments;
  return (
    <div className="flex items-center gap-4 mt-3 max-w-md text-muted-foreground">
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
        aria-label="Reply"
      >
        <MessageSquare className="w-4 h-4" />
        {typeof comments === 'number' && (
          <span className="text-xs">{formatCount(comments)}</span>
        )}
      </button>
    </div>
  );
}
