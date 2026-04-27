/**
 * GoogleBusinessPostPreview — evokes a Google Business Profile update card.
 * Thin Google-blue accent bar at top, verified business header, body
 * (line-clamped at 5 lines), optional 4:3 media, optional CTA button.
 * Pure presentational, no data fetching.
 */

import * as React from 'react';
import Image from 'next/image';
import { Eye } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { Button } from '@/components/ui/button';
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

const CTA_LABELS: Record<string, string> = {
  LEARN_MORE: 'Learn more',
  BOOK: 'Book',
  ORDER: 'Order online',
  SHOP: 'Shop',
  SIGN_UP: 'Sign up',
  CALL: 'Call now',
};

function readMetaString(post: SocialMediaPost, key: string): string | undefined {
  const meta = (post as { metadata?: Record<string, unknown> }).metadata;
  if (!meta) {return undefined;}
  const value = meta[key];
  return typeof value === 'string' && value.trim().length > 0 ? value : undefined;
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

export function GoogleBusinessPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const meta = PLATFORM_META.google_business;
  const trimmedName = account?.accountName?.trim();
  const trimmedHandle = account?.handle?.trim();
  const businessName =
    (trimmedName && trimmedName.length > 0 ? trimmedName : undefined) ??
    (trimmedHandle && trimmedHandle.length > 0 ? trimmedHandle : undefined) ??
    'Your Business';
  const avatarChar = getInitial(businessName);
  const mediaUrl = post.mediaUrls?.[0];
  const ctaRaw = readMetaString(post, 'callToAction');
  const ctaLabel = ctaRaw ? CTA_LABELS[ctaRaw] ?? null : null;
  const viewCount = post.metrics?.impressions;

  const interactive = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'group relative w-full max-w-xl overflow-hidden rounded-xl border border-border-light bg-card transition-colors',
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
      {/* Google-blue accent bar */}
      <div
        className="h-0.5 w-full"
        style={{ backgroundColor: meta.color }}
        aria-hidden="true"
      />

      <div className={cn(compact ? 'p-3' : 'p-4')}>
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {account?.avatarUrl ? (
              <Image
                src={account.avatarUrl}
                alt={businessName}
                width={40}
                height={40}
                className="h-10 w-10 rounded-full object-cover"
                unoptimized
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
            <div className="truncate text-sm font-bold text-foreground">{businessName}</div>
            <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
              <span
                className="inline-block h-2 w-2 rounded-full bg-green-500"
                aria-hidden="true"
              />
              <span>Verified</span>
            </div>
          </div>
        </div>

        {/* Body */}
        <p
          className={cn(
            'mt-3 whitespace-pre-wrap text-sm leading-relaxed text-foreground',
            compact && 'line-clamp-5',
          )}
        >
          {post.content}
        </p>

        {/* Media */}
        {mediaUrl && (
          <div className="relative mt-3 aspect-[4/3] overflow-hidden rounded-md bg-surface-elevated">
            <Image
              src={mediaUrl}
              alt=""
              fill
              className="object-cover"
              unoptimized
            />
          </div>
        )}

        {/* CTA */}
        {ctaLabel && (
          <div className="mt-3">
            <Button variant="outline" size="sm">
              {ctaLabel}
            </Button>
          </div>
        )}

        {/* Footer */}
        <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
          {typeof viewCount === 'number' && (
            <>
              <Eye className="h-3.5 w-3.5" aria-hidden="true" />
              <span>{formatCount(viewCount)}</span>
              <span>·</span>
            </>
          )}
          <span>{timestampLabel(post)}</span>
        </div>
      </div>
    </div>
  );
}

export default GoogleBusinessPostPreview;
