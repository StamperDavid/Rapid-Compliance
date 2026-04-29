'use client';

import * as React from 'react';
import Image from 'next/image';
import { Hash, MessageSquarePlus, MoreHorizontal, Smile } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { PLATFORM_META } from '@/lib/social/platform-config';

import { formatRelativeTime, getInitial } from './_utils';

interface DiscordEmbedPreview {
  title: string;
  description: string;
  url?: string | null;
  colorHex?: string | null;
}

interface DiscordPostPreviewProps {
  post: SocialMediaPost;
  account?: {
    handle?: string;
    accountName?: string;
    avatarUrl?: string;
  };
  /** Optional channel name shown in the header (e.g. "general"). */
  channelName?: string;
  /** Optional embed rendered below the content. */
  embed?: DiscordEmbedPreview;
  /** "BOT" tag next to the bot name — defaults to true. */
  showBotTag?: boolean;
  onClick?: () => void;
  compact?: boolean;
}

/**
 * Discord channel-message preview.
 *
 * Mirrors the Bluesky preview's structural shape (avatar + name + timestamp
 * + content + media + action row). Discord-specific touches:
 *  - "BOT" tag next to the display name
 *  - Channel header strip (#channel-name) when provided
 *  - Optional embed card with left accent bar in the embed colorHex
 *  - Discord blurple border-left accent on published posts
 *  - Message actions are different from Twitter-shape (add reaction, reply)
 */
export function DiscordPostPreview({
  post,
  account,
  channelName,
  embed,
  showBotTag = true,
  onClick,
  compact: _compact = false,
}: DiscordPostPreviewProps): React.ReactElement {
  const interactive = typeof onClick === 'function';
  const displayName = account?.accountName ?? account?.handle ?? 'Bot';

  const avatarLetter = getInitial(displayName);
  const relativeTime = formatRelativeTime(post.publishedAt ?? post.createdAt);
  const mediaUrl = post.mediaUrls?.[0];
  const isPublished = post.status === 'published';
  const discordColor = PLATFORM_META.discord.color;

  const embedAccent = embed?.colorHex && /^#[0-9A-Fa-f]{6}$/.test(embed.colorHex)
    ? embed.colorHex
    : discordColor;

  return (
    <div
      className={cn(
        'bg-card rounded-xl border border-border-light overflow-hidden',
        interactive && 'cursor-pointer transition-shadow hover:shadow-md'
      )}
      style={isPublished ? { borderLeft: `2px solid ${discordColor}` } : undefined}
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
      {/* Channel strip */}
      {channelName && (
        <div className="flex items-center gap-1.5 border-b border-border-light bg-surface-elevated px-4 py-2 text-xs text-muted-foreground">
          <Hash className="h-3.5 w-3.5" />
          <span className="font-semibold text-foreground">{channelName}</span>
        </div>
      )}

      <div className="p-4">
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

          {/* Name / bot tag / time */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 text-sm flex-wrap">
              <span className="font-bold text-foreground truncate">{displayName}</span>
              {showBotTag && (
                <span
                  className="inline-flex items-center rounded px-1.5 py-0.5 text-[10px] font-bold leading-none text-white"
                  style={{ backgroundColor: discordColor }}
                >
                  BOT
                </span>
              )}
              {relativeTime && (
                <span className="text-xs text-muted-foreground">{relativeTime}</span>
              )}
            </div>

            {/* Body */}
            {post.content && (
              <div className="text-sm text-foreground mt-1 whitespace-pre-wrap break-words">
                {post.content}
              </div>
            )}

            {/* Media */}
            {mediaUrl && (
              <div className="relative mt-3 rounded-md overflow-hidden border border-border-light max-h-96">
                <Image
                  src={mediaUrl}
                  alt="Discord media"
                  width={500}
                  height={384}
                  className="w-full h-auto object-cover max-h-96"
                  unoptimized
                />
              </div>
            )}

            {/* Embed */}
            {embed && (
              <div
                className="mt-3 rounded-md bg-surface-elevated p-3"
                style={{ borderLeft: `4px solid ${embedAccent}` }}
              >
                {embed.url ? (
                  <a
                    href={embed.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm font-semibold hover:underline"
                    style={{ color: embedAccent }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    {embed.title}
                  </a>
                ) : (
                  <div className="text-sm font-semibold text-foreground">{embed.title}</div>
                )}
                <div className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap break-words">
                  {embed.description}
                </div>
              </div>
            )}

            {/* Action row */}
            <div className="flex items-center gap-4 mt-3 text-muted-foreground">
              <button
                type="button"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                onClick={(e) => e.stopPropagation()}
                aria-label="Add reaction"
              >
                <Smile className="w-4 h-4" />
              </button>
              <button
                type="button"
                className="flex items-center gap-1.5 hover:text-foreground transition-colors"
                onClick={(e) => e.stopPropagation()}
                aria-label="Reply in thread"
              >
                <MessageSquarePlus className="w-4 h-4" />
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
    </div>
  );
}
