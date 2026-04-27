/**
 * WhatsAppBusinessPostPreview — evokes a WhatsApp Business broadcast/template
 * message rendered as an outgoing chat bubble (right-aligned, classic
 * #DCF8C6 green). Pure presentational, no data fetching.
 */

import * as React from 'react';
import Image from 'next/image';
import { BadgeCheck, CheckCheck } from 'lucide-react';

import type { SocialMediaPost } from '@/types/social';
import { cn } from '@/lib/utils';

import { formatRelativeTime } from './_utils';

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

/**
 * WhatsApp's outgoing chat bubble background. Documented exception to the
 * "no inline hex" rule — there is no Tailwind token that matches this color
 * and using the wrong green breaks the visual recognition.
 */
const WHATSAPP_OUTGOING_BUBBLE = '#DCF8C6';

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

export function WhatsAppBusinessPostPreview({
  post,
  account,
  onClick,
  compact = false,
}: PostPreviewProps): React.ReactElement {
  const trimmedName = account?.accountName?.trim();
  const trimmedHandle = account?.handle?.trim();
  const businessName =
    (trimmedName && trimmedName.length > 0 ? trimmedName : undefined) ??
    (trimmedHandle && trimmedHandle.length > 0 ? trimmedHandle : undefined) ??
    'Your Business';
  const mediaUrl = post.mediaUrls?.[0];
  const interactive = typeof onClick === 'function';

  return (
    <div
      className={cn(
        'group relative w-full max-w-xl rounded-xl border border-border-light bg-card transition-colors',
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
      {/* Outgoing chat bubble — right-aligned */}
      <div
        className="ml-auto max-w-[80%] rounded-2xl rounded-tr-sm p-3 shadow-sm"
        // Documented exception: WhatsApp's signature bubble color.
        style={{ backgroundColor: WHATSAPP_OUTGOING_BUBBLE }}
      >
        {/* Media at top of bubble */}
        {mediaUrl && (
          <div className="mb-2 overflow-hidden rounded-md">
            <Image
              src={mediaUrl}
              alt=""
              width={500}
              height={288}
              className="max-h-72 w-full object-cover"
              unoptimized
            />
          </div>
        )}

        {/* Business header — always render in a near-black for legibility on the green bubble */}
        <div className="flex items-center gap-1 text-xs font-bold text-zinc-900">
          <span className="truncate">{businessName}</span>
          <BadgeCheck
            className="h-3.5 w-3.5 flex-shrink-0 text-green-600"
            aria-label="Verified business"
          />
        </div>

        {/* Body — same dark text on green */}
        <p
          className={cn(
            'mt-1 whitespace-pre-wrap text-sm leading-relaxed text-zinc-900',
            compact && 'line-clamp-4',
          )}
        >
          {post.content}
        </p>

        {/* Footer — time + read receipt */}
        <div className="mt-1 flex items-center justify-end gap-1 text-[10px] text-zinc-600">
          <span>{timestampLabel(post)}</span>
          <CheckCheck className="h-3 w-3 text-blue-500" aria-label="Read" />
        </div>
      </div>
    </div>
  );
}

export default WhatsAppBusinessPostPreview;
