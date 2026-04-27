/**
 * LinkedInPostPreview — evokes the LinkedIn feed feel without cloning it.
 * Pure presentational component; no data fetching, no side effects.
 */

import * as React from 'react';
import Image from 'next/image';
import {
  ThumbsUp,
  MessageCircle,
  Repeat2,
  Send,
  type LucideIcon,
} from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import { formatCount, formatRelativeTime, getInitial } from './_utils';
import type { PostPreviewProps } from './TwitterPostPreview';

interface ActionSlot {
  key: string;
  Icon: LucideIcon;
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

function renderContentWithHashtags(content: string): React.ReactNode {
  // Split on whitespace boundaries while preserving the whitespace separator
  // so we can re-emit hashtag tokens with the brand-blue accent.
  const tokens = content.split(/(\s+)/);
  return tokens.map((token, idx) => {
    if (/^#[\w-]+$/.test(token)) {
      return (
        <span key={idx} className="text-primary">
          {token}
        </span>
      );
    }
    return <React.Fragment key={idx}>{token}</React.Fragment>;
  });
}

const ACTIONS: ActionSlot[] = [
  { key: 'like', Icon: ThumbsUp, label: 'Like' },
  { key: 'comment', Icon: MessageCircle, label: 'Comment' },
  { key: 'repost', Icon: Repeat2, label: 'Repost' },
  { key: 'send', Icon: Send, label: 'Send' },
];

export function LinkedInPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const meta = PLATFORM_META.linkedin;
  const trimmedName = account?.accountName?.trim();
  const displayName = trimmedName && trimmedName.length > 0 ? trimmedName : 'Your Brand';
  const trimmedHandle = account?.handle?.replace(/^@/, '').trim();
  const headline =
    trimmedHandle && trimmedHandle.length > 0 ? trimmedHandle : 'AI-powered sales platform';
  const avatarChar = getInitial(account?.accountName ?? account?.handle);
  const mediaUrl = post.mediaUrls?.[0];

  const interactive = typeof onClick === 'function';

  const summaryParts: string[] = [];
  if (post.metrics?.likes) {summaryParts.push(`${formatCount(post.metrics.likes)} likes`);}
  if (post.metrics?.comments) {summaryParts.push(`${formatCount(post.metrics.comments)} comments`);}
  if (post.metrics?.shares) {summaryParts.push(`${formatCount(post.metrics.shares)} reposts`);}

  return (
    <div
      className={cn(
        'group relative w-full max-w-xl rounded-lg border border-border-light bg-card transition-colors',
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
              alt={displayName}
              width={48}
              height={48}
              className="h-12 w-12 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-12 w-12 items-center justify-center rounded-full text-base font-semibold text-white"
              style={{ backgroundColor: meta.color }}
            >
              {avatarChar}
            </div>
          )}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-sm font-bold text-foreground">{displayName}</div>
          <div className="truncate text-xs text-muted-foreground">{headline}</div>
          <div className="mt-0.5 text-xs text-muted-foreground">
            <span className="font-medium">1st</span>
            <span className="mx-1">·</span>
            <span>{timestampLabel(post)}</span>
          </div>
        </div>
      </div>

      {/* Body */}
      <p
        className={cn(
          'mt-3 whitespace-pre-wrap leading-relaxed text-sm text-foreground',
          compact && 'line-clamp-3',
        )}
      >
        {renderContentWithHashtags(post.content)}
      </p>

      {/* Media — LinkedIn's actual aspect ratio */}
      {mediaUrl && (
        <div className="relative mt-3 w-full overflow-hidden rounded-md border border-border-light bg-surface-elevated aspect-[1.91/1]">
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

      {/* Engagement summary line */}
      {summaryParts.length > 0 && (
        <div className="mt-3 text-xs text-muted-foreground">
          {summaryParts.join(' · ')}
        </div>
      )}

      {/* Divider */}
      <div className="mt-2 h-px w-full bg-border-light" />

      {/* Action row */}
      <div className="mt-1 flex items-center justify-between gap-1">
        {ACTIONS.map(({ key, Icon, label }) => (
          <Button
            key={key}
            type="button"
            variant="ghost"
            size="sm"
            className="flex-1 gap-1.5 text-xs font-medium text-muted-foreground"
            onClick={(event) => event.stopPropagation()}
            aria-label={label}
          >
            <Icon className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">{label}</span>
          </Button>
        ))}
      </div>
    </div>
  );
}

export default LinkedInPostPreview;
