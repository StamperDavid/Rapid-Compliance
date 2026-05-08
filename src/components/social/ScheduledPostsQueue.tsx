'use client';

/**
 * ScheduledPostsQueue
 *
 * Per-platform editable queue of `status: 'scheduled'` posts that haven't
 * fired yet. Surfaces the same docs the calendar agenda renders, but with
 * full operator affordances:
 *
 *   • Edit content + scheduledFor (PATCH /api/social/platforms/{platform}/scheduled)
 *   • Cancel (two-step confirm — see `feedback_destructive_actions_two_step_confirmation.md`)
 *   • Post now (publishes via /api/social/post and then cancels the scheduled doc
 *     so the cron dispatcher doesn't double-fire)
 *
 * Lives BELOW the hero 3-col on PlatformDashboard. Calendar handles
 * "what's coming this week at a glance"; this component handles
 * "let me actually edit/scrap/promote a queued item." Two surfaces, same
 * underlying source.
 *
 * No new docs are written here — every action is an update on the existing
 * Firestore doc. `Post now` writes a NEW post via /api/social/post (live
 * publish), then PATCHes the scheduled doc to cancelled.
 */

import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { CalendarClock, Pencil, Send, Trash2, X as XIcon } from 'lucide-react';

import { useAuthFetch } from '@/hooks/useAuthFetch';
import { useToast } from '@/hooks/useToast';
import { logger } from '@/lib/logger/logger';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Caption } from '@/components/ui/typography';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { SocialPlatform } from '@/types/social';

const FILE = 'components/social/ScheduledPostsQueue.tsx';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ScheduledItem {
  id: string;
  platform: string;
  content: string;
  scheduledFor: string; // ISO
  mediaUrls?: string[];
  hashtags?: string[];
  createdAt?: string;
  createdBy?: string;
}

interface ListResponse {
  success: boolean;
  posts?: ScheduledItem[];
  total?: number;
  error?: string;
}

interface PatchResponse {
  success: boolean;
  error?: string;
}

interface PostNowResponse {
  success: boolean;
  postId?: string;
  platformPostId?: string;
  error?: string;
}

interface ScheduledPostsQueueProps {
  platform: SocialPlatform;
}

// ─── Default contentType per platform (mirrors PlatformComposer) ─────────────
//
// /api/social/post requires a contentType string — we fall back to the same
// per-platform defaults the composer uses so "Post now" mirrors the user
// pressing "Post" in the composer at this exact moment.
const DEFAULT_CONTENT_TYPE: Record<SocialPlatform, string> = {
  twitter: 'post',
  linkedin: 'post',
  facebook: 'post',
  instagram: 'post',
  youtube: 'video',
  tiktok: 'video',
  bluesky: 'post',
  threads: 'post',
  truth_social: 'post',
  mastodon: 'post',
  telegram: 'message',
  reddit: 'post',
  pinterest: 'pin',
  whatsapp_business: 'message',
  google_business: 'post',
  discord: 'channel_post',
  twitch: 'chat_announcement',
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Friendly relative time. We deliberately keep this tight (no full date
 * library) — anything older/further than ~6 days falls back to a locale
 * date string.
 */
function formatScheduledTime(iso: string): string {
  const target = new Date(iso);
  if (Number.isNaN(target.getTime())) { return iso; }

  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffMin = Math.round(diffMs / 60_000);
  const diffHour = Math.round(diffMs / 3_600_000);
  const diffDay = Math.round(diffMs / 86_400_000);

  const time = target.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });

  if (diffMs < 0) { return `Overdue · ${target.toLocaleString()}`; }
  if (diffMin < 60) { return `In ${diffMin} min (${time})`; }
  if (diffHour < 24 && target.getDate() === now.getDate()) {
    return `Today at ${time}`;
  }
  const tomorrow = new Date(now);
  tomorrow.setDate(now.getDate() + 1);
  if (target.getDate() === tomorrow.getDate() && diffDay <= 1) {
    return `Tomorrow at ${time}`;
  }
  if (diffDay < 7) {
    const weekday = target.toLocaleDateString([], { weekday: 'long' });
    return `${weekday} at ${time}`;
  }
  return target.toLocaleString();
}

/**
 * Build a value compatible with `<input type="datetime-local">` from an
 * ISO timestamp. The input control needs `YYYY-MM-DDTHH:mm` in the *local*
 * tz, NOT a UTC ISO — otherwise the displayed time is shifted by the
 * operator's offset and edits silently land at the wrong moment.
 */
function isoToLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) { return ''; }
  const pad = (n: number): string => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Inverse of `isoToLocalInputValue` — converts the input's local value back to UTC ISO. */
function localInputValueToIso(local: string): string {
  const d = new Date(local);
  if (Number.isNaN(d.getTime())) { return ''; }
  return d.toISOString();
}

// ─── Row ─────────────────────────────────────────────────────────────────────

interface RowProps {
  item: ScheduledItem;
  platform: SocialPlatform;
  onMutated: () => void;
}

function ScheduledPostRow({ item, platform, onMutated }: RowProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const toast = useToast();

  const [editing, setEditing] = useState(false);
  const [draftContent, setDraftContent] = useState(item.content);
  const [draftWhen, setDraftWhen] = useState(isoToLocalInputValue(item.scheduledFor));
  const [saving, setSaving] = useState(false);

  const [cancelArmed, setCancelArmed] = useState(false);
  const cancelTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [cancelling, setCancelling] = useState(false);

  const [postingNow, setPostingNow] = useState(false);

  // Reset local draft when the parent feeds a new item snapshot in
  // (e.g. after a successful save, the parent re-fetches and rerenders).
  useEffect(() => {
    setDraftContent(item.content);
    setDraftWhen(isoToLocalInputValue(item.scheduledFor));
  }, [item.content, item.scheduledFor]);

  // Cleanup the disarm timer on unmount so a deferred state set doesn't
  // fire on a stale row.
  useEffect(() => {
    return () => {
      if (cancelTimerRef.current) { clearTimeout(cancelTimerRef.current); }
    };
  }, []);

  const armCancel = (): void => {
    setCancelArmed(true);
    if (cancelTimerRef.current) { clearTimeout(cancelTimerRef.current); }
    cancelTimerRef.current = setTimeout(() => {
      setCancelArmed(false);
      cancelTimerRef.current = null;
    }, 5000);
  };

  const disarmCancel = (): void => {
    setCancelArmed(false);
    if (cancelTimerRef.current) {
      clearTimeout(cancelTimerRef.current);
      cancelTimerRef.current = null;
    }
  };

  const handleSave = async (): Promise<void> => {
    const trimmed = draftContent.trim();
    if (trimmed.length === 0) {
      toast.error('Content cannot be empty');
      return;
    }
    const newIso = localInputValueToIso(draftWhen);
    if (!newIso) {
      toast.error('Pick a valid date and time');
      return;
    }
    if (new Date(newIso).getTime() <= Date.now()) {
      toast.error('Scheduled time must be in the future');
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, string> = { postId: item.id };
      if (trimmed !== item.content) { body.content = trimmed; }
      if (newIso !== item.scheduledFor) { body.scheduledFor = newIso; }

      // No-op edit guard — at least one field must differ from the source.
      if (!body.content && !body.scheduledFor) {
        toast.info('Nothing changed');
        setEditing(false);
        setSaving(false);
        return;
      }

      const res = await authFetch(
        `/api/social/platforms/${encodeURIComponent(platform)}/scheduled`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        },
      );
      const json = (await res.json()) as PatchResponse;
      if (res.ok && json.success) {
        toast.success('Scheduled post updated');
        setEditing(false);
        onMutated();
      } else {
        toast.error(json.error ?? 'Failed to update');
      }
    } catch (err) {
      logger.error(
        '[ScheduledPostsQueue] save failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, postId: item.id, platform },
      );
      toast.error('Network error while saving');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = async (): Promise<void> => {
    setCancelling(true);
    try {
      const res = await authFetch(
        `/api/social/platforms/${encodeURIComponent(platform)}/scheduled?postId=${encodeURIComponent(item.id)}`,
        { method: 'DELETE' },
      );
      const json = (await res.json()) as PatchResponse;
      if (res.ok && json.success) {
        toast.success('Scheduled post cancelled');
        disarmCancel();
        onMutated();
      } else {
        toast.error(json.error ?? 'Failed to cancel');
      }
    } catch (err) {
      logger.error(
        '[ScheduledPostsQueue] cancel failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, postId: item.id, platform },
      );
      toast.error('Network error while cancelling');
    } finally {
      setCancelling(false);
    }
  };

  const handlePostNow = async (): Promise<void> => {
    setPostingNow(true);
    try {
      // Step 1 — publish immediately via /api/social/post
      const publishRes = await authFetch('/api/social/post', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          platform,
          contentType: DEFAULT_CONTENT_TYPE[platform],
          content: item.content,
        }),
      });
      const publishJson = (await publishRes.json()) as PostNowResponse;
      if (!publishRes.ok || !publishJson.success) {
        toast.error(publishJson.error ?? 'Failed to publish');
        setPostingNow(false);
        return;
      }

      // Step 2 — soft-cancel the scheduled doc so the cron dispatcher doesn't
      // re-fire it. If this PATCH fails the post still went out, so we surface
      // the partial-success state honestly rather than retrying silently.
      try {
        await authFetch(
          `/api/social/platforms/${encodeURIComponent(platform)}/scheduled?postId=${encodeURIComponent(item.id)}`,
          { method: 'DELETE' },
        );
      } catch (cleanupErr) {
        logger.warn(
          '[ScheduledPostsQueue] published but failed to clear scheduled doc',
          {
            file: FILE,
            postId: item.id,
            platform,
            error: cleanupErr instanceof Error ? cleanupErr.message : String(cleanupErr),
          },
        );
        toast.warning('Posted, but couldn\'t clear the schedule entry — check the calendar.');
        onMutated();
        return;
      }

      toast.success(`Posted to ${PLATFORM_META[platform].label}`);
      onMutated();
    } catch (err) {
      logger.error(
        '[ScheduledPostsQueue] post-now failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, postId: item.id, platform },
      );
      toast.error('Network error while posting');
    } finally {
      setPostingNow(false);
    }
  };

  const truncated = item.content.length > 160
    ? `${item.content.slice(0, 160)}…`
    : item.content;
  const friendlyTime = formatScheduledTime(item.scheduledFor);
  const firstMedia = item.mediaUrls?.[0];

  return (
    <div className="border border-border-light rounded-lg overflow-hidden bg-card">
      {/* Collapsed row */}
      <div className="flex items-start gap-3 p-3">
        {firstMedia && (
          // We use a plain <img> instead of next/image because attached media
          // can be from arbitrary remote hosts (S3, Twilio, Imgur, etc.) that
          // would each need an explicit `images.remotePatterns` entry. The
          // queue thumbnail is small (40px) and decorative.
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={firstMedia}
            alt=""
            className="h-10 w-10 rounded-md object-cover flex-shrink-0 border border-border-light"
          />
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
            <CalendarClock className="h-3.5 w-3.5" aria-hidden />
            <span>{friendlyTime}</span>
            {item.mediaUrls && item.mediaUrls.length > 1 && (
              <span className="text-foreground/70">· {item.mediaUrls.length} files</span>
            )}
          </div>
          {!editing && (
            <p className="text-sm text-foreground whitespace-pre-wrap break-words">
              {truncated}
            </p>
          )}
        </div>
        {!editing && (
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => setEditing(true)}
              disabled={postingNow || cancelling}
              aria-label="Edit scheduled post"
            >
              <Pencil className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              Edit
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { void handlePostNow(); }}
              disabled={postingNow || cancelling}
            >
              <Send className="h-3.5 w-3.5 mr-1.5" aria-hidden />
              {postingNow ? 'Posting…' : 'Post now'}
            </Button>

            {/* Two-step cancel — first click arms, second click fires.
                Auto-disarms after 5s via armCancel(). */}
            {cancelArmed ? (
              <>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={() => { void handleCancel(); }}
                  disabled={cancelling}
                >
                  {cancelling ? 'Cancelling…' : 'Click again to confirm'}
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant="ghost"
                  onClick={disarmCancel}
                  disabled={cancelling}
                  aria-label="Cancel cancellation"
                >
                  <XIcon className="h-3.5 w-3.5" aria-hidden />
                </Button>
              </>
            ) : (
              <Button
                type="button"
                size="sm"
                variant="ghost"
                onClick={armCancel}
                disabled={postingNow || cancelling}
                className="text-muted-foreground hover:text-destructive"
                aria-label="Cancel scheduled post"
              >
                <Trash2 className="h-3.5 w-3.5" aria-hidden />
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Edit panel */}
      {editing && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border-light bg-surface-elevated">
          <div className="pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Post text
            </div>
            <textarea
              className="w-full rounded-md border border-border-light bg-card px-3 py-2 text-sm text-foreground resize-y"
              rows={4}
              value={draftContent}
              onChange={(e) => setDraftContent(e.target.value)}
              disabled={saving}
            />
            <Caption className="mt-1">
              {draftContent.length} characters
              {PLATFORM_META[platform].charLimit > 0 && (
                <> / {PLATFORM_META[platform].charLimit}</>
              )}
            </Caption>
          </div>

          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground mb-1">
              Reschedule for
            </div>
            <Input
              type="datetime-local"
              value={draftWhen}
              onChange={(e) => setDraftWhen(e.target.value)}
              disabled={saving}
              className="max-w-[260px]"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => { void handleSave(); }}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Save changes'}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="ghost"
              onClick={() => {
                setEditing(false);
                setDraftContent(item.content);
                setDraftWhen(isoToLocalInputValue(item.scheduledFor));
              }}
              disabled={saving}
            >
              Discard
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Main component ──────────────────────────────────────────────────────────

export function ScheduledPostsQueue({
  platform,
}: ScheduledPostsQueueProps): React.JSX.Element {
  const authFetch = useAuthFetch();
  const toast = useToast();
  const meta = PLATFORM_META[platform];

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [items, setItems] = useState<ScheduledItem[]>([]);

  const fetchQueue = useCallback(async (): Promise<void> => {
    try {
      setError(null);
      const res = await authFetch(
        `/api/social/platforms/${encodeURIComponent(platform)}/scheduled`,
      );
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const json = (await res.json()) as ListResponse;
      if (!json.success) {
        throw new Error(json.error ?? 'Failed to fetch');
      }
      setItems(json.posts ?? []);
    } catch (err) {
      logger.error(
        '[ScheduledPostsQueue] list failed',
        err instanceof Error ? err : new Error(String(err)),
        { file: FILE, platform },
      );
      setError(err instanceof Error ? err.message : String(err));
      // We deliberately don't toast on the initial load failure — the
      // inline error message is enough. A toast would be noisy on every
      // page load when the dev server is restarting.
    } finally {
      setLoading(false);
    }
  }, [authFetch, platform]);

  useEffect(() => {
    void fetchQueue();
  }, [fetchQueue]);

  // Re-fetch when the tab regains focus — operator may have edited a post
  // from Mission Control or the calendar in another tab.
  useEffect(() => {
    const handler = (): void => {
      if (document.visibilityState === 'visible') {
        void fetchQueue();
      }
    };
    document.addEventListener('visibilitychange', handler);
    return () => document.removeEventListener('visibilitychange', handler);
  }, [fetchQueue]);

  const headerCount = useMemo(() => {
    if (loading) { return ''; }
    if (items.length === 0) { return ''; }
    return ` (${items.length})`;
  }, [loading, items.length]);

  const handleMutated = useCallback((): void => {
    void fetchQueue();
  }, [fetchQueue]);

  // Surface a one-time toast if the operator opens an empty queue and the
  // page has been mounted long enough that they're clearly looking for
  // something — currently no-op; we keep the empty state visually quiet.
  // (Left as a comment rather than implemented to avoid noisy UX.)
  void toast;

  return (
    <Card className="border-border-light">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <CardTitle>
            Scheduled posts{headerCount}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, i) => (
              <div
                key={i}
                className="h-16 w-full rounded-lg bg-muted animate-pulse"
              />
            ))}
          </div>
        )}

        {!loading && error && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Couldn&apos;t load the schedule.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => { void fetchQueue(); }}
            >
              Retry
            </Button>
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No posts scheduled for {meta.label}.
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="space-y-2">
            {items.map((item) => (
              <ScheduledPostRow
                key={item.id}
                item={item}
                platform={platform}
                onMutated={handleMutated}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default ScheduledPostsQueue;
