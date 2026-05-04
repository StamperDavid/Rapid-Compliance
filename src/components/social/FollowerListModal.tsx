'use client';

/**
 * FollowerListModal
 *
 * Manual follower-browsing surface for the per-platform Social Hub.
 * Closes a UI-parity gap: the AI swarm can research engaged users via
 * Intelligence/Sales managers, but the operator had no way to manually
 * scroll their own follower list.
 *
 * Open from the AudienceTrajectoryPanel "Followers" delta tile (made
 * clickable for live platforms).
 *
 * Pagination uses the opaque platform-native cursor returned by
 * `/api/social/platforms/{platform}/followers`. The modal calls "Load
 * more" to append the next page until no `nextCursor` comes back.
 *
 * Empty / restricted states:
 *   - 200 with 0 followers   → "No followers yet"
 *   - 403 + tierRestricted   → upgrade-required notice (X v2 Basic tier)
 *   - 501 + unsupported      → "Follower browsing isn't available on
 *                                this platform at the consumer tier"
 *   - other 4xx/5xx          → generic error with Retry button
 */

import * as React from 'react';
import { ExternalLink, Loader2, Users } from 'lucide-react';

import { useAuthFetch } from '@/hooks/useAuthFetch';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { PLATFORM_META } from '@/lib/social/platform-config';
import type { SocialPlatform } from '@/types/social';

// ─── Types ───────────────────────────────────────────────────────────────────

interface FollowerSummary {
  handle: string;
  displayName: string;
  avatarUrl?: string;
  bio?: string;
  profileUrl: string;
  followsBack?: boolean;
}

interface FollowerListResponse {
  success: boolean;
  followers?: FollowerSummary[];
  nextCursor?: string;
  tierRestricted?: boolean;
  unsupported?: boolean;
  error?: string;
}

interface FollowerListModalProps {
  platform: SocialPlatform;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Optional total followers count to render in the modal header. Pulled
   * from AudienceTrajectoryPanel so the operator sees "Followers (1,247)"
   * even before the first page resolves.
   */
  totalCount?: number;
}

// ─── Row ────────────────────────────────────────────────────────────────────

function Initials({ name }: { name: string }): React.ReactElement {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || '?';
  return (
    <div
      className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-surface-elevated text-xs font-semibold text-muted-foreground"
      aria-hidden
    >
      {initials}
    </div>
  );
}

function FollowerRow({ follower }: { follower: FollowerSummary }): React.ReactElement {
  return (
    <a
      href={follower.profileUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-start gap-3 rounded-lg border border-border-light bg-card p-3 transition-colors hover:bg-surface-elevated focus:outline-none focus:ring-2 focus:ring-ring"
    >
      {follower.avatarUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={follower.avatarUrl}
          alt=""
          className="h-10 w-10 flex-shrink-0 rounded-full object-cover"
          loading="lazy"
        />
      ) : (
        <Initials name={follower.displayName} />
      )}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-semibold text-foreground">
            {follower.displayName}
          </span>
          {follower.followsBack && (
            <span className="inline-flex items-center rounded-full bg-success/10 px-2 py-0.5 text-[10px] font-medium text-success">
              Follows you
            </span>
          )}
        </div>
        <div className="truncate text-xs text-muted-foreground">
          @{follower.handle}
        </div>
        {follower.bio && (
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">
            {follower.bio}
          </p>
        )}
      </div>
      <ExternalLink className="mt-1 h-4 w-4 flex-shrink-0 text-muted-foreground" aria-hidden />
    </a>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────

export function FollowerListModal({
  platform,
  open,
  onOpenChange,
  totalCount,
}: FollowerListModalProps): React.ReactElement {
  const authFetch = useAuthFetch();
  const meta = PLATFORM_META[platform];

  const [followers, setFollowers] = React.useState<FollowerSummary[]>([]);
  const [cursor, setCursor] = React.useState<string | undefined>(undefined);
  const [loading, setLoading] = React.useState(false);
  const [loadingMore, setLoadingMore] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [tierRestricted, setTierRestricted] = React.useState(false);
  const [unsupported, setUnsupported] = React.useState(false);

  const loadPage = React.useCallback(
    async (nextCursor: string | undefined, append: boolean) => {
      if (append) {
        setLoadingMore(true);
      } else {
        setLoading(true);
        setError(null);
        setTierRestricted(false);
        setUnsupported(false);
      }

      try {
        const url = new URL(
          `/api/social/platforms/${platform}/followers`,
          window.location.origin,
        );
        if (nextCursor) { url.searchParams.set('cursor', nextCursor); }
        url.searchParams.set('limit', '50');

        const res = await authFetch(url.pathname + url.search);
        const body = (await res.json()) as FollowerListResponse;

        if (!res.ok || !body.success) {
          if (body.unsupported) { setUnsupported(true); }
          if (body.tierRestricted) { setTierRestricted(true); }
          setError(body.error ?? `HTTP ${res.status}`);
          if (!append) { setFollowers([]); }
          return;
        }

        const page = body.followers ?? [];
        setFollowers((prev) => (append ? [...prev, ...page] : page));
        setCursor(body.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load followers');
        if (!append) { setFollowers([]); }
      } finally {
        if (append) {
          setLoadingMore(false);
        } else {
          setLoading(false);
        }
      }
    },
    [authFetch, platform],
  );

  // Reset + load when the modal opens.
  React.useEffect(() => {
    if (!open) { return; }
    setFollowers([]);
    setCursor(undefined);
    void loadPage(undefined, false);
  }, [open, loadPage]);

  const handleLoadMore = React.useCallback(() => {
    if (!cursor || loadingMore) { return; }
    void loadPage(cursor, true);
  }, [cursor, loadingMore, loadPage]);

  const handleRetry = React.useCallback(() => {
    setFollowers([]);
    setCursor(undefined);
    void loadPage(undefined, false);
  }, [loadPage]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Users className="h-5 w-5 text-muted-foreground" aria-hidden />
            {meta.label} followers
            {typeof totalCount === 'number' && (
              <span className="text-sm font-normal text-muted-foreground">
                · {totalCount.toLocaleString()}
              </span>
            )}
          </DialogTitle>
          <DialogDescription>
            Browse the people who follow your {meta.label} brand account. Click any
            row to open their profile in a new tab.
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[60vh] overflow-y-auto pr-1">
          {/* Loading (initial) */}
          {loading && (
            <div className="space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-16 w-full animate-pulse rounded-lg bg-surface-elevated"
                />
              ))}
            </div>
          )}

          {/* Unsupported platform */}
          {!loading && unsupported && (
            <div className="rounded-lg border border-border-light bg-surface-elevated p-6 text-sm text-muted-foreground">
              <p className="font-medium text-foreground">
                Follower browsing isn&apos;t available on {meta.label}.
              </p>
              <p className="mt-2">
                {meta.label} doesn&apos;t expose a follower-list endpoint at the
                consumer API tier we&apos;re on. The aggregate count above is
                still tracked from the profile API.
              </p>
            </div>
          )}

          {/* Tier-restricted (X v2 Basic) */}
          {!loading && tierRestricted && !unsupported && (
            <div className="rounded-lg border border-warning/30 bg-warning/5 p-6 text-sm">
              <p className="font-medium text-foreground">
                {meta.label} requires a paid API tier for follower browsing.
              </p>
              <p className="mt-2 text-muted-foreground">
                X&apos;s follower list endpoint is gated behind the Basic tier
                (~$100/mo). The aggregate follower count above continues to
                update from the profile metrics endpoint, which is open at the
                Free tier.
              </p>
            </div>
          )}

          {/* Generic error */}
          {!loading && error && !tierRestricted && !unsupported && (
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
              <p className="text-destructive">Couldn&apos;t load followers: {error}</p>
              <Button
                variant="outline"
                size="sm"
                className="mt-3"
                onClick={handleRetry}
              >
                Try again
              </Button>
            </div>
          )}

          {/* Empty (success but 0 followers) */}
          {!loading && !error && followers.length === 0 && (
            <p className="rounded-lg border border-border-light bg-card p-6 text-center text-sm text-muted-foreground">
              No followers yet on {meta.label}.
            </p>
          )}

          {/* List */}
          {!loading && !error && followers.length > 0 && (
            <div className="space-y-2">
              {followers.map((f) => (
                <FollowerRow key={`${f.handle}-${f.profileUrl}`} follower={f} />
              ))}

              {cursor && (
                <div className="pt-3 text-center">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleLoadMore}
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading…
                      </>
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}

              {!cursor && followers.length > 0 && (
                <p className="pt-2 text-center text-xs text-muted-foreground">
                  End of follower list.
                </p>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default FollowerListModal;
