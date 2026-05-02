'use client';

/**
 * PlatformDashboard — unified per-platform dashboard for the Social Hub
 * redesign (Phase 5).
 *
 * One component handles all 14 connected platforms by reading
 * `getPlatformConfig(platform)` and rendering state-aware sections:
 *   • PlatformHeaderBand (always)
 *   • Body grid (skipped for `parked`):
 *       Left  ─ metrics row, AI Composer / Specialist Identity, recent posts
 *       Right ─ Specialist recent work, DM status, quick actions
 *   • Parked treatment (Truth Social) replaces the grid with a centered
 *     notice + the disabled composer (which already shows a parked banner).
 *
 * The "native feel" per platform lives in <PlatformComposer> and the
 * post-preview dispatcher — this component is the orchestration shell that
 * fetches data, hands it to those components, and wires status pills.
 */

import * as React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar as CalendarIcon,
  CheckCircle2,
  ClipboardCheck,
  Clock,
  Ear,
  type LucideIcon,
} from 'lucide-react';

import { useAuthFetch } from '@/hooks/useAuthFetch';
import type { PostMetrics, SocialMediaPost, SocialPlatform } from '@/types/social';
import type { MissionStep } from '@/lib/orchestrator/mission-persistence';
import { PLATFORM_META } from '@/lib/social/platform-config';

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Caption, SectionTitle } from '@/components/ui/typography';

import PlatformHeaderBand, {
  type PlatformHeaderStatus,
} from '@/components/social/PlatformHeaderBand';
import { PinnedDMInbox } from '@/components/social/PinnedDMInbox';
import SpecialistIdentityCard from '@/components/social/SpecialistIdentityCard';
import SpecialistRecentWork from '@/components/social/SpecialistRecentWork';
import { PlatformComposer } from '@/components/social/composers';
import EmbeddedSocialCalendar from '@/components/social/EmbeddedSocialCalendar';
import PlatformInsightsPanel from '@/components/social/PlatformInsightsPanel';
import AudienceTrajectoryPanel from '@/components/social/AudienceTrajectoryPanel';
import { InlineReviewCard } from '@/components/mission-control/InlineReviewCard';

import {
  BlueskyPostPreview,
  DiscordPostPreview,
  FacebookPostPreview,
  GoogleBusinessPostPreview,
  InstagramPostPreview,
  LinkedInPostPreview,
  MastodonPostPreview,
  PinterestPostPreview,
  RedditPostPreview,
  TelegramPostPreview,
  ThreadsPostPreview,
  TikTokPostPreview,
  TruthSocialPostPreview,
  TwitchPostPreview,
  TwitterPostPreview,
  WhatsAppBusinessPostPreview,
  YouTubePostPreview,
  formatCount,
} from '@/components/social/post-previews';

import {
  getPlatformConfig,
  type DmCapability,
  type PlatformConfig,
} from './_platform-state';

// ─── Types ───────────────────────────────────────────────────────────────────

interface PlatformDashboardProps {
  platform: SocialPlatform;
}

interface AccountSummary {
  accountName?: string;
  handle?: string;
  status: string;
}

interface AccountsResponse {
  accounts?: AccountSummary[];
}

interface MetricsTotals {
  postsToday: number;
  postsThisWeek: number;
  postsThisMonth: number;
  totalImpressions: number;
  totalEngagements: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
}

interface MetricsResponse {
  success: boolean;
  totals?: MetricsTotals;
  error?: string;
}

/**
 * Shape returned from `/api/social/posts` — mirrors the Firestore document
 * (which uses `engagement: { likes, comments, shares, views }`) rather than
 * the canonical `SocialMediaPost.metrics`. We normalize before handing to
 * the per-platform PostPreview components.
 */
interface RawSocialPostDoc {
  id: string;
  platform: string;
  content: string;
  status: string;
  scheduledFor?: string;
  publishedAt?: string;
  mediaUrls?: string[];
  hashtags?: string[];
  engagement?: {
    likes?: number;
    comments?: number;
    shares?: number;
    views?: number;
  };
  metrics?: PostMetrics;
  createdAt?: string;
  updatedAt?: string;
  createdBy?: string;
}

interface PostsResponse {
  success?: boolean;
  posts?: RawSocialPostDoc[];
  error?: string;
}

interface PendingStepResponse {
  success: boolean;
  mission: null;
  error?: string;
}

interface PendingStepFoundResponse {
  success: true;
  missionId: string;
  step: MissionStep;
}

type PreviewComponent = React.ComponentType<{
  post: SocialMediaPost;
  account?: { handle?: string; accountName?: string; avatarUrl?: string };
  onClick?: () => void;
  compact?: boolean;
}>;

// ─── Post-preview dispatcher ─────────────────────────────────────────────────

/**
 * Unified per-platform PostPreview lookup. Mirrors the composer dispatcher
 * pattern in <PlatformComposer>: one map keyed by SocialPlatform with the
 * type system enforcing exhaustive coverage.
 */
const PREVIEW_BY_PLATFORM: Record<SocialPlatform, PreviewComponent> = {
  twitter: TwitterPostPreview as PreviewComponent,
  linkedin: LinkedInPostPreview as PreviewComponent,
  facebook: FacebookPostPreview as PreviewComponent,
  instagram: InstagramPostPreview as PreviewComponent,
  youtube: YouTubePostPreview as PreviewComponent,
  tiktok: TikTokPostPreview as PreviewComponent,
  bluesky: BlueskyPostPreview as PreviewComponent,
  threads: ThreadsPostPreview as PreviewComponent,
  truth_social: TruthSocialPostPreview as PreviewComponent,
  mastodon: MastodonPostPreview as PreviewComponent,
  telegram: TelegramPostPreview as PreviewComponent,
  reddit: RedditPostPreview as PreviewComponent,
  pinterest: PinterestPostPreview as PreviewComponent,
  whatsapp_business: WhatsAppBusinessPostPreview as PreviewComponent,
  google_business: GoogleBusinessPostPreview as PreviewComponent,
  discord: DiscordPostPreview as PreviewComponent,
  twitch: TwitchPostPreview as PreviewComponent,
};

function getPostPreviewComponent(platform: SocialPlatform): PreviewComponent {
  return PREVIEW_BY_PLATFORM[platform];
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Normalize the raw Firestore post doc into a `SocialMediaPost` so the
 * shared PostPreview components can render it without having to know about
 * legacy field names (`engagement.views` → `metrics.impressions`).
 */
function normalizePost(
  doc: RawSocialPostDoc,
  platform: SocialPlatform,
): SocialMediaPost {
  const engagement = doc.engagement ?? {};
  const metrics: PostMetrics = doc.metrics ?? {
    likes: engagement.likes,
    comments: engagement.comments,
    shares: engagement.shares,
    impressions: engagement.views,
    engagements:
      (engagement.likes ?? 0) +
      (engagement.comments ?? 0) +
      (engagement.shares ?? 0),
  };

  const allowedStatuses: SocialMediaPost['status'][] = [
    'draft',
    'scheduled',
    'queued',
    'publishing',
    'published',
    'failed',
    'cancelled',
  ];
  const status = (allowedStatuses as string[]).includes(doc.status)
    ? (doc.status as SocialMediaPost['status'])
    : 'draft';

  return {
    id: doc.id,
    platform,
    content: doc.content,
    mediaUrls: doc.mediaUrls,
    status,
    publishedAt: doc.publishedAt ? new Date(doc.publishedAt) : undefined,
    scheduledAt: doc.scheduledFor ? new Date(doc.scheduledFor) : undefined,
    metrics,
    createdBy: doc.createdBy ?? '',
    createdAt: doc.createdAt ? new Date(doc.createdAt) : new Date(),
    updatedAt: doc.updatedAt ? new Date(doc.updatedAt) : new Date(),
  };
}

/**
 * Decide which header pill to show given the platform's config and whether
 * the operator has connected an account.
 */
function deriveHeaderStatus(
  config: PlatformConfig,
  connected: boolean | null,
): PlatformHeaderStatus {
  if (config.state === 'parked') { return 'parked'; }
  if (config.state === 'coming_soon') { return 'coming_soon'; }
  if (connected === false) { return 'available'; }
  if (config.state === 'no_specialist') { return 'no_specialist'; }
  if (config.state === 'live_no_dm') { return 'no_dm'; }
  if (config.state === 'live_dm_blocked') { return 'external_block'; }
  return 'connected';
}

// ─── Sub-components ──────────────────────────────────────────────────────────

interface MetricTileProps {
  label: string;
  value: string;
}

function MetricTile({ label, value }: MetricTileProps): React.ReactElement {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 text-center">
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="mt-1 text-xl font-bold text-foreground">{value}</div>
      </CardContent>
    </Card>
  );
}

function MetricSkeleton(): React.ReactElement {
  return (
    <Card>
      <CardContent className="pt-4 pb-4 space-y-2">
        <div className="mx-auto h-3 w-16 rounded bg-muted animate-pulse" />
        <div className="mx-auto h-5 w-12 rounded bg-muted animate-pulse" />
      </CardContent>
    </Card>
  );
}

interface MetricsRowProps {
  platform: SocialPlatform;
  connected: boolean | null;
}

function MetricsRow({ platform, connected }: MetricsRowProps): React.ReactElement {
  const authFetch = useAuthFetch();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totals, setTotals] = useState<MetricsTotals | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/api/social/metrics/${platform}`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as MetricsResponse;
        if (!body.success || !body.totals) {
          throw new Error(body.error ?? 'Missing totals payload');
        }
        if (!cancelled) { setTotals(body.totals); }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setTotals(null);
        }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [authFetch, platform]);

  if (connected === false) {
    return (
      <Card className="border-border-light">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Connect to start collecting metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <MetricSkeleton key={i} />
        ))}
      </div>
    );
  }

  if (error || !totals) {
    return (
      <Card className="border-border-light">
        <CardContent className="py-4">
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load metrics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      <MetricTile label="Posts Today" value={String(totals.postsToday)} />
      <MetricTile label="Posts (week)" value={String(totals.postsThisWeek)} />
      <MetricTile label="Total Impressions" value={formatCount(totals.totalImpressions)} />
      <MetricTile label="Total Engagements" value={formatCount(totals.totalEngagements)} />
      <MetricTile label="Engagement Rate" value={`${totals.engagementRate}%`} />
    </div>
  );
}

interface RecentPostsListProps {
  platform: SocialPlatform;
  account: { handle?: string; accountName?: string } | undefined;
}

function RecentPostsList({ platform, account }: RecentPostsListProps): React.ReactElement {
  const authFetch = useAuthFetch();
  const meta = PLATFORM_META[platform];
  const Preview = getPostPreviewComponent(platform);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [posts, setPosts] = useState<SocialMediaPost[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load(): Promise<void> {
      setLoading(true);
      setError(null);
      try {
        const res = await authFetch(`/api/social/posts?platform=${platform}&limit=10`);
        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }
        const body = (await res.json()) as PostsResponse;
        const raw = body.posts ?? [];
        const sliced = raw.slice(0, 10);
        const normalized = sliced.map((doc) => normalizePost(doc, platform));
        if (!cancelled) { setPosts(normalized); }
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : String(e));
          setPosts([]);
        }
      } finally {
        if (!cancelled) { setLoading(false); }
      }
    }

    void load();
    return () => { cancelled = true; };
  }, [authFetch, platform]);

  return (
    <Card className="border-border-light">
      <CardHeader>
        <CardTitle>Recent posts</CardTitle>
      </CardHeader>
      <CardContent>
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-20 w-full rounded-2xl bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!loading && error && (
          <p className="text-sm text-muted-foreground">
            Couldn&apos;t load recent posts.
          </p>
        )}

        {!loading && !error && posts.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No posts yet on {meta.label}.
          </p>
        )}

        {!loading && !error && posts.length > 0 && (
          <div className="space-y-4">
            {posts.map((post) => (
              <Preview
                key={post.id}
                post={post}
                account={account}
                compact
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

interface MissingSpecialistCardProps {
  platform: SocialPlatform;
}

function MissingSpecialistCard({ platform }: MissingSpecialistCardProps): React.ReactElement {
  const meta = PLATFORM_META[platform];
  return (
    <Card className="border-border-light w-full h-full flex flex-col">
      <CardHeader className="flex-shrink-0">
        <div className="flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-muted-foreground" aria-hidden />
          <CardTitle>AI specialist coming soon</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-sm text-muted-foreground">
          We don&apos;t have an AI specialist for {meta.label} yet. You can
          post manually below.
        </p>
      </CardContent>
    </Card>
  );
}

interface ComingSoonCardProps {
  platform: SocialPlatform;
  config: PlatformConfig;
}

function ComingSoonCard({ platform, config }: ComingSoonCardProps): React.ReactElement {
  const meta = PLATFORM_META[platform];
  return (
    <Card className="border-warning/30 bg-warning/5">
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-warning" aria-hidden />
          <CardTitle>{config.specialistName ?? `${meta.label} specialist`} — coming soon</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {config.blockReason && (
          <p className="text-sm text-foreground">{config.blockReason}</p>
        )}
        {config.unblockAction && (
          <p className="text-xs text-muted-foreground">
            <span className="font-medium text-foreground">What unblocks:</span>{' '}
            {config.unblockAction}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

interface DmStatusCardProps {
  capability: DmCapability;
  blockReason?: string;
  unblockAction?: string;
}

function DmStatusCard({
  capability,
  blockReason,
  unblockAction,
}: DmStatusCardProps): React.ReactElement | null {
  if (capability === 'na') { return null; }

  let dotClass = '';
  let title = '';
  if (capability === 'live') {
    dotClass = 'bg-success';
    title = 'Inbound DM auto-reply active';
  } else if (capability === 'blocked') {
    dotClass = 'bg-warning';
    title = 'DM externally blocked';
  } else if (capability === 'pending') {
    dotClass = 'bg-warning';
    title = 'DM specialist pending';
  } else {
    dotClass = 'bg-muted-foreground/40';
    title = 'DM deferred';
  }

  return (
    <Card className="border-border-light">
      <CardHeader>
        <div className="flex items-center gap-2">
          <span
            aria-hidden
            className={`inline-block h-2.5 w-2.5 rounded-full ${dotClass}`}
          />
          <CardTitle>{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {capability === 'live' ? (
          <>
            <p className="text-sm text-muted-foreground">
              New direct messages route through Jasper into Mission Control
              for review before reply.
            </p>
            <Link
              href="/social/listening"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open Listening →
            </Link>
          </>
        ) : (
          <>
            {blockReason && (
              <p className="text-sm text-foreground">{blockReason}</p>
            )}
            {unblockAction && (
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground">What unblocks:</span>{' '}
                {unblockAction}
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

interface QuickActionLinkProps {
  href: string;
  label: string;
  Icon: LucideIcon;
}

function QuickActionLink({
  href,
  label,
  Icon,
}: QuickActionLinkProps): React.ReactElement {
  return (
    <Link
      href={href}
      className="flex items-center gap-2 rounded-md border border-border-light bg-card px-3 py-2 text-sm font-medium text-foreground transition-colors hover:bg-surface-elevated"
    >
      <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      {label}
    </Link>
  );
}

interface QuickActionsCardProps {
  showApprovals: boolean;
}

function QuickActionsCard({ showApprovals }: QuickActionsCardProps): React.ReactElement {
  return (
    <Card className="border-border-light">
      <CardHeader>
        <CardTitle>Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <QuickActionLink
          href="/social/calendar"
          label="View schedule"
          Icon={CalendarIcon}
        />
        {showApprovals && (
          <QuickActionLink
            href="/social/approvals"
            label="Approval queue"
            Icon={ClipboardCheck}
          />
        )}
        <QuickActionLink
          href="/social/listening"
          label="Listening"
          Icon={Ear}
        />
      </CardContent>
    </Card>
  );
}

interface ParkedNoticeProps {
  platform: SocialPlatform;
  config: PlatformConfig;
}

function ParkedNotice({ platform, config }: ParkedNoticeProps): React.ReactElement {
  const meta = PLATFORM_META[platform];
  return (
    <Card className="border-destructive/30 bg-destructive/5">
      <CardContent className="py-10 text-center space-y-3">
        <div className="flex justify-center">
          <span
            aria-hidden
            className="inline-flex items-center justify-center rounded-full bg-destructive/10 p-3"
          >
            <AlertCircle className="h-8 w-8 text-destructive" />
          </span>
        </div>
        <SectionTitle className="text-2xl font-bold">
          {meta.label} is parked
        </SectionTitle>
        {config.blockReason && (
          <p className="mx-auto max-w-2xl text-sm text-muted-foreground">
            {config.blockReason}
          </p>
        )}
        <p className="mx-auto max-w-2xl text-xs text-muted-foreground">
          The composer below is disabled. We&apos;ll reopen this platform if a
          viable integration path emerges.
        </p>
      </CardContent>
    </Card>
  );
}

// ─── Account fetcher ─────────────────────────────────────────────────────────

interface UseAccountResult {
  account: AccountSummary | null;
  connected: boolean | null;
}

function useAccount(platform: SocialPlatform): UseAccountResult {
  const authFetch = useAuthFetch();
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [connected, setConnected] = useState<boolean | null>(null);

  const load = useCallback(async (): Promise<void> => {
    try {
      const res = await authFetch(`/api/social/accounts?platform=${platform}`);
      if (!res.ok) {
        setConnected(false);
        setAccount(null);
        return;
      }
      const data = (await res.json()) as AccountsResponse;
      const accounts = data.accounts ?? [];
      const active = accounts.find((a) => a.status === 'active');
      setAccount(active ?? accounts[0] ?? null);
      setConnected(Boolean(active));
    } catch {
      setConnected(false);
      setAccount(null);
    }
  }, [authFetch, platform]);

  useEffect(() => {
    void load();
  }, [load]);

  return { account, connected };
}

// ─── Main component ──────────────────────────────────────────────────────────

export function PlatformDashboard({
  platform,
}: PlatformDashboardProps): React.ReactElement {
  const config = useMemo(() => getPlatformConfig(platform), [platform]);
  const { account, connected } = useAccount(platform);
  const authFetch = useAuthFetch();
  const router = useRouter();

  const headerStatus = deriveHeaderStatus(config, connected);
  const headerAccount = account
    ? {
        handle: account.handle ?? '',
        accountName: account.accountName,
      }
    : undefined;

  // ─── PENDING MISSION STEP ─────────────────────────────────────────────────
  // Fetch the most-recent AWAITING_APPROVAL mission for this platform and
  // surface it as an InlineReviewCard so the operator can act without
  // navigating to Mission Control.
  const [pendingMissionId, setPendingMissionId] = useState<string | null>(null);
  const [pendingStep, setPendingStep] = useState<MissionStep | null>(null);

  const fetchPendingStep = useCallback(async () => {
    try {
      const res = await authFetch(`/api/social/platforms/${platform}/pending-mission-step`);
      if (!res.ok) { return; }
      const body = (await res.json()) as PendingStepResponse | PendingStepFoundResponse;
      if (!body.success) { return; }
      if ('missionId' in body) {
        setPendingMissionId(body.missionId);
        setPendingStep(body.step);
      } else {
        setPendingMissionId(null);
        setPendingStep(null);
      }
    } catch {
      // Silent fail — pending step is non-critical
    }
  }, [authFetch, platform]);

  useEffect(() => {
    void fetchPendingStep();
  }, [fetchPendingStep]);

  // Re-fetch when the tab regains focus (operator may have acted in another tab)
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void fetchPendingStep();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [fetchPendingStep]);

  // ─── PARKED ───────────────────────────────────────────────────────────────
  if (config.state === 'parked') {
    return (
      <div className="p-8 space-y-6">
        <PlatformHeaderBand
          platform={platform}
          account={headerAccount}
          status={headerStatus}
          blockReason={config.blockReason}
        />
        <PinnedDMInbox platform={platform} />
        <ParkedNotice platform={platform} config={config} />
        <PlatformComposer platform={platform} />
      </div>
    );
  }

  // ─── ALL OTHER STATES ─────────────────────────────────────────────────────
  const showSpecialistCard =
    config.state === 'live_full' ||
    config.state === 'live_dm_blocked' ||
    config.state === 'live_no_dm';

  return (
    <div className="p-8 space-y-6">
      <PlatformHeaderBand
        platform={platform}
        account={headerAccount}
        status={headerStatus}
        blockReason={config.blockReason}
      />

      {/* DM inbox — always visible; collapses to a thin bar when empty */}
      <PinnedDMInbox platform={platform} />

      {/* Connect-first nudge — only when the operator hasn't linked an account */}
      {connected === false && (
        <Card className="border-border-light">
          <CardContent className="flex items-center justify-between gap-4 py-4">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-warning" aria-hidden />
              <p className="text-sm text-foreground">
                Connect your {PLATFORM_META[platform].label} account in
                Settings to enable posting and metrics.
              </p>
            </div>
            <Link
              href="/settings/integrations"
              className="text-sm font-medium text-primary hover:underline"
            >
              Open Settings →
            </Link>
          </CardContent>
        </Card>
      )}

      {connected === null && (
        <Caption>Checking connection…</Caption>
      )}

      <MetricsRow platform={platform} connected={connected} />

      {/* Audience growth — baseline at connect time + sparkline of recent days */}
      <AudienceTrajectoryPanel platform={platform} />

      {/* ─── INLINE REVIEW ────────────────────────────────────────────────
          When Jasper has a halted mission for this platform, show an
          InlineReviewCard so the operator can review without leaving
          the hub. Renders nothing when there is no pending mission.
       */}
      {pendingStep !== null && pendingMissionId !== null && (
        <InlineReviewCard
          step={pendingStep}
          missionId={pendingMissionId}
          platform={platform}
          onOpenFullMode={() => {
            router.push(
              `/mission-control?mission=${pendingMissionId}&step=${pendingStep.stepId}`,
            );
          }}
          onGradeSubmitted={() => { void fetchPendingStep(); }}
        />
      )}

      {/* ─── HERO 3-COL: Insights | Calendar | Composer ───────────────────
          Row is locked to a fixed 680px height so verbose AI Insights
          output doesn't blow the layout up. Each column scrolls
          internally when its content exceeds the row.
       */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:h-[680px]">
        {/* Col 1 — AI Insights (or specialist gap explainer) */}
        <div className="h-full min-h-0 flex">
          {config.specialistId && (
            <PlatformInsightsPanel platform={platform} />
          )}
          {config.state === 'no_specialist' && (
            <MissingSpecialistCard platform={platform} />
          )}
        </div>

        {/* Col 2 — Platform-scoped calendar (agenda view by default) */}
        <Card className="border-border-light h-full min-h-0 flex flex-col">
          <CardHeader className="flex-shrink-0">
            <div className="flex items-center justify-between">
              <CardTitle>{PLATFORM_META[platform].label} schedule</CardTitle>
              <Link
                href="/social/calendar"
                className="text-xs font-medium text-primary hover:underline"
              >
                Full calendar
              </Link>
            </div>
          </CardHeader>
          <CardContent className="flex-1 min-h-0 overflow-y-auto">
            <EmbeddedSocialCalendar
              lockedPlatform={platform}
              height={520}
            />
          </CardContent>
        </Card>

        {/* Col 3 — Composer (or coming-soon pacifier) */}
        <div className="h-full min-h-0 flex">
          {config.state === 'coming_soon' ? (
            <Card className="border-border-light w-full h-full flex flex-col">
              <CardHeader className="flex-shrink-0">
                <CardTitle>Composer</CardTitle>
              </CardHeader>
              <CardContent className="flex-1 py-5 overflow-y-auto">
                <p className="text-sm text-muted-foreground">
                  Composer will activate when{' '}
                  <span className="font-medium text-foreground">
                    {config.specialistName ?? `${PLATFORM_META[platform].label} specialist`}
                  </span>{' '}
                  is ready.
                </p>
              </CardContent>
            </Card>
          ) : (
            <PlatformComposer platform={platform} />
          )}
        </div>
      </div>

      {/* ─── Coming-soon block (full width, only in coming_soon state) ───── */}
      {config.state === 'coming_soon' && (
        <ComingSoonCard platform={platform} config={config} />
      )}

      {/* ─── CONTEXT STRIP: Identity | DM | Recent Work | Quick Actions ──── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {showSpecialistCard && config.specialistId ? (
          <SpecialistIdentityCard
            specialistId={config.specialistId}
            platform={platform}
          />
        ) : (
          <DmStatusCard
            capability={config.dmCapability}
            blockReason={config.blockReason}
            unblockAction={config.unblockAction}
          />
        )}

        {showSpecialistCard && (
          <DmStatusCard
            capability={config.dmCapability}
            blockReason={config.blockReason}
            unblockAction={config.unblockAction}
          />
        )}

        {config.specialistId && (
          <SpecialistRecentWork
            specialistId={config.specialistId}
            limit={5}
          />
        )}

        <QuickActionsCard showApprovals={Boolean(config.specialistId)} />
      </div>

      {/* ─── Recent posts (full width) ─────────────────────────────────── */}
      <RecentPostsList platform={platform} account={headerAccount} />

      {connected === true && (
        <Card className="border-border-light">
          <CardContent className="flex items-center gap-2 py-3">
            <CheckCircle2 className="h-4 w-4 text-success" aria-hidden />
            <span className="text-sm text-foreground">
              Account connected
            </span>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

export default PlatformDashboard;
