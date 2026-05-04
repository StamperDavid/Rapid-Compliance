'use client';

/**
 * MentionInbox
 *
 * Per-platform inbox of mentions / replies / quote-posts that the brand
 * account has received. Mirrors PinnedDMInbox shape:
 *   - Collapsed thin bar when 0 pending
 *   - Expanded card with rows when 1+ pending
 *   - 30s poll, paused when tab hidden
 *
 * Differences from PinnedDMInbox:
 *   - No AI draft. The operator types every reply themselves. Future work
 *     can add an `aiDraft` field per item if a mention-AI pipeline ships.
 *   - Each row has a "View on {platform}" link to the original post.
 *   - The reply path posts directly to the platform (no mission lifecycle
 *     in the middle) because there is no AI draft to grade.
 *
 * Closes the operator-side parity gap: the AI can read mentions on its own
 * timeline (specialists call pollMentions in agent flows), but the operator
 * had no UI to do the same manually until this component shipped.
 *
 * Supported platforms (the backend returns empty for the rest):
 *   twitter, bluesky, mastodon
 *
 * Design tokens only — no raw Tailwind shade numbers.
 */

import * as React from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { CheckCircle2, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';

import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Caption } from '@/components/ui/typography';
import type { SocialPlatform } from '@/types/social';

const FILE = 'components/social/MentionInbox.tsx';
const POLL_INTERVAL_MS = 30_000;
const REPLY_MAX_LEN = 500;

// ─── Types ───────────────────────────────────────────────────────────────────

interface MentionInboxItem {
  id: string;
  platformPostId: string;
  author: string;
  authorDisplay?: string;
  text: string;
  url: string;
  reason: 'mention' | 'reply' | 'quote';
  receivedAt: string;
  threadCid?: string;
}

interface InboxResponse {
  pending?: MentionInboxItem[];
  warning?: string;
}

interface ReplyResponse {
  success?: boolean;
  reason?: string;
  error?: string;
  postId?: string;
  postUrl?: string;
}

interface SkipResponse {
  success?: boolean;
  error?: string;
}

interface MentionInboxProps {
  platform: SocialPlatform;
}

const PLATFORMS_WITH_MENTIONS: ReadonlyArray<SocialPlatform> = [
  'twitter',
  'bluesky',
  'mastodon',
];

// ─── Per-platform reply body builder ─────────────────────────────────────────

type BuildReplyResult =
  | { ok: true; body: Record<string, unknown> }
  | { ok: false; error: string };

function buildReplyBody(
  platform: SocialPlatform,
  item: MentionInboxItem,
  replyText: string,
): BuildReplyResult {
  const base = { mentionId: item.id, replyText };
  switch (platform) {
    case 'twitter':
      // Twitter mention id IS the tweet id.
      return { ok: true, body: { ...base, tweetId: item.platformPostId } };
    case 'bluesky':
      // Bluesky needs both URI and CID for the strong-ref reply embed.
      if (!item.threadCid) {
        return { ok: false, error: 'Bluesky reply requires a post CID — refresh the inbox and try again.' };
      }
      return { ok: true, body: { ...base, parentUri: item.platformPostId, parentCid: item.threadCid } };
    case 'mastodon':
      return { ok: true, body: { ...base, statusId: item.platformPostId, recipientAcct: item.author.replace(/^@/, '') } };
    default:
      return { ok: false, error: `Replies on ${platform} are not yet supported` };
  }
}

// ─── Row sub-component ───────────────────────────────────────────────────────

interface MentionRowProps {
  item: MentionInboxItem;
  platform: SocialPlatform;
  onReplied: (id: string) => void;
  onSkipped: (id: string) => void;
}

function MentionRow({ item, platform, onReplied, onSkipped }: MentionRowProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [expanded, setExpanded] = useState(false);
  const [reply, setReply] = useState('');
  const [sending, setSending] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const formattedTime = (() => {
    try { return new Date(item.receivedAt).toLocaleString(); } catch { return item.receivedAt; }
  })();

  const reasonLabel = item.reason === 'mention'
    ? 'Mention'
    : item.reason === 'reply'
      ? 'Reply'
      : 'Quote';

  const handleSend = async (): Promise<void> => {
    const text = reply.trim();
    if (text.length === 0) {
      toast.error('Reply text is empty');
      return;
    }
    if (text.length > REPLY_MAX_LEN) {
      toast.error(`Reply too long (${text.length}/${REPLY_MAX_LEN})`);
      return;
    }

    const built = buildReplyBody(platform, item, text);
    if (!built.ok) {
      toast.error(built.error);
      return;
    }

    setSending(true);
    try {
      const resp = await authFetch(
        `/api/social/platforms/${encodeURIComponent(platform)}/mention-inbox/reply`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(built.body),
        },
      );
      const json = (await resp.json()) as ReplyResponse;

      if (resp.ok && json.success === true) {
        toast.success(item.author ? `Reply sent to ${item.author}` : 'Reply sent');
        onReplied(item.id);
        return;
      }

      if (resp.status === 409 && json.reason === 'already_handled') {
        toast.info('This mention was already handled.');
        onReplied(item.id);
        return;
      }

      toast.error(json.error ?? 'Failed to send reply');
      setSending(false);
    } catch (err) {
      logger.error(
        'MentionInbox: send failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, mentionId: item.id, platform },
      );
      toast.error('Network error while sending reply');
      setSending(false);
    }
  };

  const handleSkip = async (): Promise<void> => {
    setSkipping(true);
    try {
      const resp = await authFetch(
        `/api/social/platforms/${encodeURIComponent(platform)}/mention-inbox/skip`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ mentionId: item.id }),
        },
      );
      const json = (await resp.json()) as SkipResponse;
      if (resp.ok && json.success === true) {
        toast.info('Mention marked as resolved');
        onSkipped(item.id);
        return;
      }
      toast.error(json.error ?? 'Failed to mark mention resolved');
      setSkipping(false);
    } catch (err) {
      logger.error(
        'MentionInbox: skip failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, mentionId: item.id, platform },
      );
      toast.error('Network error while marking resolved');
      setSkipping(false);
    }
  };

  const truncated = item.text.length > 80
    ? `${item.text.slice(0, 80)}…`
    : item.text;

  return (
    <div className="border border-border-light rounded-lg overflow-hidden">
      {/* Collapsed row */}
      <button
        type="button"
        className="w-full flex items-center gap-3 px-4 py-3 text-left bg-card hover:bg-surface-elevated transition-colors"
        onClick={() => setExpanded((prev) => !prev)}
        aria-expanded={expanded}
      >
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-foreground mr-2">
            {item.author}
          </span>
          <span className="text-xs uppercase tracking-wide text-muted-foreground mr-2">
            {reasonLabel}
          </span>
          <span className="text-sm text-muted-foreground truncate">{truncated}</span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={(e) => { e.stopPropagation(); setExpanded(true); }}
          >
            Reply
          </Button>
          {expanded
            ? <ChevronUp className="h-4 w-4 text-muted-foreground" aria-hidden />
            : <ChevronDown className="h-4 w-4 text-muted-foreground" aria-hidden />}
        </div>
      </button>

      {/* Expanded panel */}
      {expanded && (
        <div className="px-4 pb-4 pt-2 bg-surface-elevated space-y-3 border-t border-border-light">
          {/* Mention body */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1 flex items-center gap-2">
              <span>{reasonLabel} from {item.author}</span>
              <span className="font-normal normal-case">{formattedTime}</span>
              {item.url && (
                <a
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-primary hover:underline normal-case font-normal"
                >
                  View on {platform === 'twitter' ? 'X' : platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}
                  <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              )}
            </div>
            <div className="rounded-md border border-border-light bg-card px-3 py-2 text-sm text-foreground whitespace-pre-wrap">
              {item.text}
            </div>
          </div>

          {/* Reply textarea */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Your reply
            </div>
            <textarea
              className="w-full rounded-md border border-border-light bg-card px-3 py-2 text-sm text-foreground resize-y"
              rows={3}
              maxLength={REPLY_MAX_LEN}
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              placeholder={`Reply as your brand account on ${platform === 'twitter' ? 'X' : platform === 'bluesky' ? 'Bluesky' : 'Mastodon'}…`}
              disabled={sending}
            />
            <Caption className="mt-1">{reply.length} / {REPLY_MAX_LEN}</Caption>
          </div>

          {/* Actions */}
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => { void handleSend(); }}
              disabled={sending || skipping || reply.trim().length === 0}
            >
              {sending ? 'Sending…' : 'Send reply'}
            </Button>

            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => { void handleSkip(); }}
              disabled={sending || skipping}
              className="text-muted-foreground"
            >
              {skipping ? 'Marking…' : 'Skip / mark resolved'}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function MentionInbox({ platform }: MentionInboxProps): React.JSX.Element | null {
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<MentionInboxItem[]>([]);
  const [warning, setWarning] = useState<string | null>(null);

  // Stable ref of mention ids the operator has just acted on; excludes them
  // from re-appearing in the local state before the next poll catches up.
  const handledIdsRef = useRef(new Set<string>());

  const isSupported = PLATFORMS_WITH_MENTIONS.includes(platform);

  const fetchInbox = useCallback(async (): Promise<void> => {
    if (!isSupported) {
      setLoading(false);
      return;
    }
    try {
      const resp = await authFetch(
        `/api/social/platforms/${encodeURIComponent(platform)}/mention-inbox`,
      );
      if (!resp.ok) {
        logger.warn('[MentionInbox] inbox fetch non-OK', {
          file: FILE,
          status: resp.status,
          platform,
        });
        return;
      }
      const json = (await resp.json()) as InboxResponse;
      const pending = json.pending ?? [];
      const fresh = pending.filter((i) => !handledIdsRef.current.has(i.id));
      setItems(fresh);
      setWarning(json.warning ?? null);
    } catch (err) {
      logger.error(
        '[MentionInbox] fetch failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, platform },
      );
      toast.error('Failed to refresh mention inbox');
    } finally {
      setLoading(false);
    }
  }, [authFetch, platform, toast, isSupported]);

  useEffect(() => {
    void fetchInbox();
    const intervalId = setInterval(() => { void fetchInbox(); }, POLL_INTERVAL_MS);
    const handleVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') {
        void fetchInbox();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => {
      clearInterval(intervalId);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [fetchInbox]);

  const handleReplied = useCallback((id: string): void => {
    handledIdsRef.current.add(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
    void fetchInbox();
  }, [fetchInbox]);

  const handleSkipped = useCallback((id: string): void => {
    handledIdsRef.current.add(id);
    setItems((prev) => prev.filter((i) => i.id !== id));
  }, []);

  // ── Unsupported platform — render nothing rather than a noisy bar.
  // The dashboard already shows a DM inbox; another empty bar is clutter.
  if (!isSupported) {
    return null;
  }

  // ── 0 pending — collapsed thin bar
  if (!loading && items.length === 0) {
    return (
      <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg border border-border-light bg-card">
        <CheckCircle2 className="h-4 w-4 text-muted-foreground" aria-hidden />
        <Caption>{warning ?? 'No mentions waiting'}</Caption>
      </div>
    );
  }

  // ── Loading
  if (loading) {
    return <div className="h-10 rounded-lg bg-muted animate-pulse" />;
  }

  // ── 1+ pending
  return (
    <Card className="border-info/40 bg-info/5">
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <span
            className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-info text-xs font-bold text-white"
            aria-label={`${items.length} mentions waiting`}
          >
            {items.length}
          </span>
          <CardTitle>
            {items.length === 1 ? '1 mention waiting' : `${items.length} mentions waiting`}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2 pt-0">
        {items.map((item) => (
          <MentionRow
            key={item.id}
            item={item}
            platform={platform}
            onReplied={handleReplied}
            onSkipped={handleSkipped}
          />
        ))}
      </CardContent>
    </Card>
  );
}

export default MentionInbox;
