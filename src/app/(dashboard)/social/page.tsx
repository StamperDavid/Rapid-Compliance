'use client';

/**
 * Social Media Hub — single operations cockpit for the social department.
 *
 * Replaces both the old "Social Media Hub" and the deleted "Social Command
 * Center". Surfaces real cross-platform metrics (no Math.random placeholders),
 * AI activity status, a 7-day calendar mini-widget, the platform list with
 * Phase 5 state pills, and quick actions.
 *
 * All metric numbers come from real API endpoints — no fake data.
 */

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  Calendar as CalendarIcon,
  CheckCircle2,
  Ear,
  Activity,
  AlertTriangle,
  Pause,
  Bot,
  TrendingUp,
  Eye,
  Heart,
  Send,
  ChevronRight,
} from 'lucide-react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { SOCIAL_PLATFORMS, type SocialPlatform } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import {
  getPlatformConfig,
  type PlatformState,
} from '@/components/social/_platform-state';
import { PageTitle, SectionDescription, SectionTitle } from '@/components/ui/typography';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import SubpageNav from '@/components/ui/SubpageNav';
import { SOCIAL_TABS } from '@/lib/constants/subpage-nav';
import { formatCount } from '@/components/social/post-previews/_utils';

// ─── Types ──────────────────────────────────────────────────────────────────

interface SocialAccountRow {
  platform: string;
  status: 'active' | 'disconnected' | 'expired';
  accountName?: string;
  handle?: string;
  isDefault?: boolean;
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
}

interface AgentStatusResponse {
  success: boolean;
  status?: {
    agentEnabled: boolean;
    pauseOnWeekends: boolean;
    autoApprovalEnabled: boolean;
    queueDepth: number;
    scheduledCount: number;
    pendingApprovalCount: number;
    todayPublished: number;
    recentPublished: Array<{
      id: string;
      platform: string;
      content: string;
      publishedAt?: string;
      status: string;
    }>;
  };
}

interface SwarmControlResponse {
  success: boolean;
  state?: {
    globalPause: boolean;
    pausedManagers: string[];
    pausedAgents: string[];
  };
}

interface CalendarEventApi {
  id: string;
  start: string;
  platform: string;
  status: string;
}

interface CalendarResponse {
  success: boolean;
  events?: CalendarEventApi[];
}

interface ActivityEventApi {
  id: string;
  type: 'published' | 'scheduled' | 'queued' | 'approval_triggered' | 'failed' | 'cancelled';
  platform: string;
  content: string;
  reason?: string;
  timestamp: string;
}

interface ActivityResponse {
  success: boolean;
  events?: ActivityEventApi[];
}

interface MissionListResponse {
  success: boolean;
  data?: {
    missions: Array<{
      missionId: string;
      title: string;
      status: string;
    }>;
  };
}

interface PlatformRow {
  platform: SocialPlatform;
  state: PlatformState;
  connected: boolean;
  handle?: string;
  accountName?: string;
  todayPublished: number;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function startOfTodayISO(): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function dayPlusOffsetISO(offsetDays: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString();
}

function isoDayKey(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
}

function formatRelative(iso: string): string {
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) { return ''; }
  const diff = Date.now() - ms;
  const min = Math.floor(diff / 60_000);
  if (min < 1) { return 'just now'; }
  if (min < 60) { return `${min}m ago`; }
  const hr = Math.floor(min / 60);
  if (hr < 24) { return `${hr}h ago`; }
  const day = Math.floor(hr / 24);
  if (day < 7) { return `${day}d ago`; }
  return new Date(iso).toLocaleDateString();
}

interface StatusPillVisual {
  dot: string;
  label: string;
}

function getStatusPill(state: PlatformState, connected: boolean): StatusPillVisual {
  if (state === 'parked') {
    return { dot: 'bg-destructive', label: 'Not Available' };
  }
  if (state === 'coming_soon') {
    return { dot: 'bg-amber-500', label: 'Coming Soon' };
  }
  if (!connected) {
    return { dot: 'bg-muted-foreground/40', label: 'Not connected, click to login' };
  }
  switch (state) {
    case 'live_full':
      return { dot: 'bg-emerald-500', label: 'Live' };
    case 'live_dm_blocked':
      return { dot: 'bg-amber-500', label: 'DM blocked' };
    case 'live_no_dm':
      return { dot: 'bg-muted-foreground/60', label: 'Posting only' };
    case 'no_specialist':
      return { dot: 'bg-amber-500', label: 'Manual only' };
  }
}

// ─── Section: AI Activity Strip ──────────────────────────────────────────────

interface AiActivityStripProps {
  loading: boolean;
  swarmPaused: boolean;
  marketingActiveMissions: number;
  pendingApprovalCount: number;
  agentEnabled: boolean;
  queueDepth: number;
  scheduledCount: number;
}

function AiActivityStrip({
  loading,
  swarmPaused,
  marketingActiveMissions,
  pendingApprovalCount,
  agentEnabled,
  queueDepth,
  scheduledCount,
}: AiActivityStripProps) {
  if (loading) {
    return (
      <div className="h-14 rounded-xl bg-surface-elevated animate-pulse" />
    );
  }

  if (swarmPaused) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl border border-destructive bg-destructive/10">
        <div className="flex items-center gap-3">
          <Pause size={18} className="text-destructive" />
          <span className="text-sm font-medium text-destructive">
            AI is globally paused — no agent will run until resumed.
          </span>
        </div>
        <Link
          href="/social/agent-rules"
          className="text-xs font-medium text-destructive hover:underline"
        >
          Resume in AI Settings
        </Link>
      </div>
    );
  }

  if (!agentEnabled) {
    return (
      <div className="flex items-center justify-between p-4 rounded-xl border border-amber-500/40 bg-amber-500/10">
        <div className="flex items-center gap-3">
          <Pause size={18} className="text-amber-500" />
          <span className="text-sm font-medium text-foreground">
            Social posting AI is disabled — drafts will queue but nothing will publish.
          </span>
        </div>
        <Link
          href="/social/agent-rules"
          className="text-xs font-medium text-primary hover:underline"
        >
          Enable in AI Settings
        </Link>
      </div>
    );
  }

  // Healthy state
  const parts: string[] = [];
  if (marketingActiveMissions > 0) {
    parts.push(
      `${marketingActiveMissions} active mission${marketingActiveMissions === 1 ? '' : 's'}`,
    );
  }
  if (pendingApprovalCount > 0) {
    parts.push(`${pendingApprovalCount} awaiting approval`);
  }
  if (parts.length === 0) {
    parts.push(`Idle — ${queueDepth} queued, ${scheduledCount} scheduled`);
  }
  const statusText = parts.join(' · ');

  const hasApprovals = pendingApprovalCount > 0;
  const wrapperClasses = hasApprovals
    ? 'border-amber-500/40 bg-amber-500/5'
    : 'border-border-light bg-card';
  const iconColor = hasApprovals ? 'text-amber-500' : 'text-emerald-500';

  return (
    <div className={`flex items-center justify-between p-4 rounded-xl border ${wrapperClasses}`}>
      <div className="flex items-center gap-3 min-w-0">
        <Bot size={18} className={iconColor} />
        <div className="min-w-0">
          <div className="text-sm font-medium text-foreground truncate">
            Marketing Manager
          </div>
          <div className="text-xs text-muted-foreground truncate">{statusText}</div>
        </div>
      </div>
      <Link
        href="/mission-control"
        className="text-xs font-medium text-primary hover:underline flex items-center gap-1"
      >
        Open Mission Control
        <ChevronRight size={12} />
      </Link>
    </div>
  );
}

// ─── Section: Cross-platform Metrics Row ─────────────────────────────────────

interface MetricsRowProps {
  loading: boolean;
  error: boolean;
  totals: MetricsTotals | null;
  pendingApprovalCount: number;
}

function MetricsRow({ loading, error, totals, pendingApprovalCount }: MetricsRowProps) {
  if (loading) {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-20 rounded-xl bg-surface-elevated animate-pulse" />
        ))}
      </div>
    );
  }

  if (error || !totals) {
    return (
      <div className="p-4 rounded-xl border border-border-light bg-card">
        <p className="text-sm text-muted-foreground">Couldn&apos;t load metrics. Try refreshing.</p>
      </div>
    );
  }

  const tiles: Array<{
    label: string;
    value: string;
    icon: React.ReactNode;
    accent?: string;
  }> = [
    {
      label: 'Posts Today',
      value: String(totals.postsToday),
      icon: <Send size={14} className="text-muted-foreground" />,
    },
    {
      label: 'Posts This Week',
      value: String(totals.postsThisWeek),
      icon: <Activity size={14} className="text-muted-foreground" />,
    },
    {
      label: 'Impressions',
      value: formatCount(totals.totalImpressions),
      icon: <Eye size={14} className="text-muted-foreground" />,
    },
    {
      label: 'Engagements',
      value: formatCount(totals.totalEngagements),
      icon: <Heart size={14} className="text-muted-foreground" />,
    },
    {
      label: 'Engagement Rate',
      value: `${totals.engagementRate}%`,
      icon: <TrendingUp size={14} className="text-muted-foreground" />,
    },
    {
      label: 'Pending Approvals',
      value: String(pendingApprovalCount),
      icon: <CheckCircle2 size={14} className="text-muted-foreground" />,
      accent: pendingApprovalCount > 0 ? 'text-amber-500' : undefined,
    },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {tiles.map((t) => (
        <div
          key={t.label}
          className="p-4 rounded-xl border border-border-light bg-card"
        >
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs text-muted-foreground">{t.label}</span>
            {t.icon}
          </div>
          <div className={`text-2xl font-bold text-foreground ${t.accent ?? ''}`}>{t.value}</div>
        </div>
      ))}
    </div>
  );
}

// ─── Section: 7-day calendar mini widget ─────────────────────────────────────

interface CalendarMiniProps {
  loading: boolean;
  error: boolean;
  events: CalendarEventApi[];
}

function CalendarMini({ loading, error, events }: CalendarMiniProps) {
  // Build 7 day buckets
  const days = useMemo(() => {
    const out: Array<{ date: Date; key: string; count: number }> = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() + i);
      out.push({ date: d, key: isoDayKey(d), count: 0 });
    }
    for (const ev of events) {
      const ts = new Date(ev.start);
      const k = isoDayKey(ts);
      const slot = out.find((x) => x.key === k);
      if (slot) { slot.count++; }
    }
    return out;
  }, [events]);

  const totalCount = days.reduce((sum, d) => sum + d.count, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <CalendarIcon size={14} className="text-muted-foreground" />
            Next 7 Days
          </CardTitle>
          <Link href="/social/calendar" className="text-xs font-medium text-primary hover:underline">
            Full calendar
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 7 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : error ? (
          <p className="text-sm text-muted-foreground">Couldn&apos;t load calendar.</p>
        ) : (
          <>
            <div className="grid grid-cols-7 gap-2">
              {days.map((d) => {
                const dayName = d.date.toLocaleDateString('en-US', { weekday: 'short' });
                const dayNum = d.date.getDate();
                const hasPosts = d.count > 0;
                return (
                  <Link
                    key={d.key}
                    href="/social/calendar"
                    className="block p-2 rounded-lg border border-border-light bg-card hover:bg-surface-elevated transition-colors text-center"
                  >
                    <div className="text-[10px] uppercase tracking-wide text-muted-foreground font-medium">
                      {dayName}
                    </div>
                    <div className="text-lg font-bold text-foreground mt-0.5">{dayNum}</div>
                    <div
                      className={`text-[10px] font-semibold mt-1 ${
                        hasPosts ? 'text-primary' : 'text-muted-foreground'
                      }`}
                    >
                      {d.count} {d.count === 1 ? 'post' : 'posts'}
                    </div>
                  </Link>
                );
              })}
            </div>
            {totalCount === 0 && (
              <div className="mt-4 text-center">
                <p className="text-sm text-muted-foreground">
                  Nothing scheduled in the next 7 days.{' '}
                  <Link href="/social/calendar" className="text-primary hover:underline font-medium">
                    Schedule a post
                  </Link>
                </p>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Section: Platforms List ─────────────────────────────────────────────────

interface PlatformListProps {
  loading: boolean;
  rows: PlatformRow[];
}

function PlatformList({ loading, rows }: PlatformListProps) {
  // One unified list. Each card carries its own status pill ("Live",
  // "Coming Soon", "Not Available", or "Not connected, click to login")
  // so no section sub-headers are needed. Sort order: live + connected
  // first, then implemented-but-not-signed-in (interactive), then coming
  // soon, then not available (parked).
  const sortedRows = useMemo(() => {
    const orderForCard = (r: PlatformRow): number => {
      if (r.connected) { return 0; }
      if (r.state === 'parked') { return 3; }
      if (r.state === 'coming_soon') { return 2; }
      return 1; // implemented but not signed in
    };
    return [...rows].sort((a, b) => orderForCard(a) - orderForCard(b));
  }, [rows]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm">Platforms</CardTitle>
          <Link
            href="/settings/integrations?category=social"
            className="text-xs font-medium text-primary hover:underline"
          >
            Manage accounts
          </Link>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-20 rounded-lg bg-surface-elevated animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sortedRows.map((r) => (
              <PlatformCard key={r.platform} row={r} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function PlatformCard({ row }: { row: PlatformRow }) {
  const meta = PLATFORM_META[row.platform];
  const pill = getStatusPill(row.state, row.connected);
  const isInteractive = row.state !== 'parked';

  // Per UX spec: only the icon + name section is dimmed for
  // non-connected platforms. The status pill stays at full color so
  // the user can clearly read "Coming Soon" / "Not Available" / "Not
  // connected, click to login" / "Live" against any background.
  // Owner reconsidered the full grayscale: icons keep their brand
  // color, just faded to 40% so it's obviously inactive without the
  // washed-out look.
  const greyIconAndName = !row.connected;
  const iconNameClass = greyIconAndName ? 'opacity-40' : '';

  const inner = (
    <>
      <div className={`flex items-start gap-3 ${iconNameClass}`}>
        <div
          className="w-9 h-9 rounded-lg flex items-center justify-center text-white text-sm font-bold flex-shrink-0"
          style={{ backgroundColor: meta.color }}
        >
          {meta.icon}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-foreground truncate">{meta.label}</div>
          {row.handle ? (
            <div className="text-xs text-muted-foreground truncate">@{row.handle}</div>
          ) : row.connected ? (
            <div className="text-xs text-muted-foreground truncate">
              {row.accountName ?? 'Connected'}
            </div>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-between mt-3">
        <span className="inline-flex items-center gap-2 rounded-full px-3 py-1 text-xs font-semibold bg-white/15 text-white">
          <span aria-hidden="true" className={`inline-block h-2 w-2 rounded-full ${pill.dot}`} />
          {pill.label}
        </span>
        {row.todayPublished > 0 && (
          <span className="text-xs text-muted-foreground">
            {row.todayPublished} today
          </span>
        )}
      </div>
    </>
  );

  const baseClasses = 'block p-3 rounded-xl border border-border-light bg-card transition-colors';

  if (!isInteractive) {
    return <div className={baseClasses}>{inner}</div>;
  }

  return (
    <Link
      href={`/social/platforms/${row.platform}`}
      className={`${baseClasses} hover:bg-surface-elevated`}
    >
      {inner}
    </Link>
  );
}

// ─── Section: Quick Actions ──────────────────────────────────────────────────

interface QuickActionsProps {
  pendingApprovalCount: number;
}

function QuickActions({ pendingApprovalCount }: QuickActionsProps) {
  const router = useRouter();
  const showApprovals = pendingApprovalCount > 0;
  const cols = showApprovals ? 'sm:grid-cols-2 lg:grid-cols-4' : 'sm:grid-cols-3';

  return (
    <div className={`grid grid-cols-1 ${cols} gap-3`}>
      <Button
        className="h-auto py-3 flex items-center justify-center gap-2"
        onClick={() => router.push('/dashboard?prefill=Help+me+create+something+for+social')}
      >
        <Sparkles size={16} />
        <span className="text-sm font-semibold">Create with AI</span>
      </Button>
      <Button
        variant="outline"
        className="h-auto py-3 flex items-center justify-center gap-2"
        onClick={() => router.push('/social/calendar')}
      >
        <CalendarIcon size={16} />
        <span className="text-sm font-semibold">View Calendar</span>
      </Button>
      {showApprovals && (
        <Button
          variant="outline"
          className="h-auto py-3 flex items-center justify-center gap-2"
          onClick={() => router.push('/social/approvals')}
        >
          <CheckCircle2 size={16} className="text-amber-500" />
          <span className="text-sm font-semibold">Approval Queue</span>
          <span className="text-xs px-1.5 py-0.5 rounded-full bg-amber-500/20 text-amber-600 font-bold">
            {pendingApprovalCount}
          </span>
        </Button>
      )}
      <Button
        variant="outline"
        className="h-auto py-3 flex items-center justify-center gap-2"
        onClick={() => router.push('/social/listening')}
      >
        <Ear size={16} />
        <span className="text-sm font-semibold">Listening</span>
      </Button>
    </div>
  );
}

// ─── Section: Recent Activity ────────────────────────────────────────────────

interface RecentActivityProps {
  loading: boolean;
  events: ActivityEventApi[];
}

const ACTIVITY_ICONS: Record<ActivityEventApi['type'], { icon: React.ReactNode; label: string }> = {
  published: { icon: <CheckCircle2 size={12} className="text-emerald-500" />, label: 'Published' },
  scheduled: { icon: <CalendarIcon size={12} className="text-blue-500" />, label: 'Scheduled' },
  queued: { icon: <Activity size={12} className="text-purple-500" />, label: 'Queued' },
  approval_triggered: { icon: <AlertTriangle size={12} className="text-amber-500" />, label: 'Flagged' },
  failed: { icon: <AlertTriangle size={12} className="text-destructive" />, label: 'Failed' },
  cancelled: { icon: <Pause size={12} className="text-muted-foreground" />, label: 'Cancelled' },
};

function RecentActivity({ loading, events }: RecentActivityProps) {
  if (loading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent className="pt-0 space-y-2">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="h-12 rounded bg-surface-elevated animate-pulse" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (events.length === 0) {
    return null; // Skip if no value
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm">Recent Activity</CardTitle>
      </CardHeader>
      <CardContent className="pt-0 space-y-2">
        {events.map((ev) => {
          const meta = PLATFORM_META[ev.platform as SocialPlatform];
          const cfg = ACTIVITY_ICONS[ev.type];
          return (
            <div
              key={ev.id}
              className="flex items-start gap-3 px-3 py-2 rounded-lg border border-border-light"
            >
              <span className="mt-0.5">{cfg.icon}</span>
              {meta && (
                <span
                  className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white uppercase flex-shrink-0 mt-0.5"
                  style={{ backgroundColor: meta.color }}
                >
                  {meta.label}
                </span>
              )}
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground truncate">{ev.content}</div>
                {ev.reason && (
                  <div className="text-xs text-muted-foreground mt-0.5">Reason: {ev.reason}</div>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0 whitespace-nowrap">
                {formatRelative(ev.timestamp)}
              </span>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

// ─── Marketing manager mission identification ────────────────────────────────

const MARKETING_MISSION_HINTS = [
  'social',
  'twitter',
  'bluesky',
  'mastodon',
  'linkedin',
  'facebook',
  'instagram',
  'tiktok',
  'youtube',
  'pinterest',
  'reddit',
  'threads',
  'post',
  'campaign',
  'marketing',
  'tweet',
  'dm',
];

function isMarketingMission(title: string): boolean {
  const t = title.toLowerCase();
  return MARKETING_MISSION_HINTS.some((h) => t.includes(h));
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function SocialHubPage() {
  const authFetch = useAuthFetch();

  const [accounts, setAccounts] = useState<SocialAccountRow[]>([]);
  const [metricsTotals, setMetricsTotals] = useState<MetricsTotals | null>(null);
  const [metricsError, setMetricsError] = useState(false);

  const [agentEnabled, setAgentEnabled] = useState(true);
  const [queueDepth, setQueueDepth] = useState(0);
  const [scheduledCount, setScheduledCount] = useState(0);
  const [pendingApprovalCount, setPendingApprovalCount] = useState(0);
  const [recentPublishedByPlatform, setRecentPublishedByPlatform] = useState<Record<string, number>>({});

  const [swarmPaused, setSwarmPaused] = useState(false);
  const [calendarEvents, setCalendarEvents] = useState<CalendarEventApi[]>([]);
  const [calendarError, setCalendarError] = useState(false);
  const [activityEvents, setActivityEvents] = useState<ActivityEventApi[]>([]);
  const [marketingActiveMissions, setMarketingActiveMissions] = useState(0);

  const [loading, setLoading] = useState(true);

  const loadData = useCallback(async () => {
    const calendarStart = startOfTodayISO();
    const calendarEnd = dayPlusOffsetISO(7);

    try {
      const [
        accountsRes,
        metricsRes,
        agentRes,
        swarmRes,
        calendarRes,
        activityRes,
        missionsRes,
      ] = await Promise.all([
        authFetch('/api/social/accounts'),
        authFetch('/api/social/metrics/overview'),
        authFetch('/api/social/agent-status'),
        authFetch('/api/orchestrator/swarm-control'),
        authFetch(`/api/social/calendar?start=${encodeURIComponent(calendarStart)}&end=${encodeURIComponent(calendarEnd)}`),
        authFetch('/api/social/activity?limit=5'),
        authFetch('/api/orchestrator/missions?status=IN_PROGRESS&limit=50'),
      ]);

      // Accounts
      if (accountsRes.ok) {
        const data = (await accountsRes.json()) as { accounts?: SocialAccountRow[] };
        setAccounts(data.accounts ?? []);
      }

      // Metrics
      if (metricsRes.ok) {
        const data = (await metricsRes.json()) as MetricsResponse;
        if (data.success && data.totals) {
          setMetricsTotals(data.totals);
        } else {
          setMetricsError(true);
        }
      } else {
        setMetricsError(true);
      }

      // Agent status
      if (agentRes.ok) {
        const data = (await agentRes.json()) as AgentStatusResponse;
        if (data.success && data.status) {
          setAgentEnabled(data.status.agentEnabled);
          setQueueDepth(data.status.queueDepth);
          setScheduledCount(data.status.scheduledCount);
          setPendingApprovalCount(data.status.pendingApprovalCount);

          // Aggregate today's published per platform from recentPublished
          const todayStart = new Date();
          todayStart.setHours(0, 0, 0, 0);
          const counts: Record<string, number> = {};
          for (const p of data.status.recentPublished) {
            if (!p.publishedAt) { continue; }
            if (new Date(p.publishedAt) < todayStart) { continue; }
            counts[p.platform] = (counts[p.platform] ?? 0) + 1;
          }
          setRecentPublishedByPlatform(counts);
        }
      }

      // Swarm control (admins-only — handle 403 gracefully)
      if (swarmRes.ok) {
        const data = (await swarmRes.json()) as SwarmControlResponse;
        if (data.success && data.state) {
          setSwarmPaused(data.state.globalPause);
        }
      }

      // Calendar
      if (calendarRes.ok) {
        const data = (await calendarRes.json()) as CalendarResponse;
        if (data.success && data.events) {
          setCalendarEvents(data.events);
        } else {
          setCalendarError(true);
        }
      } else {
        setCalendarError(true);
      }

      // Activity
      if (activityRes.ok) {
        const data = (await activityRes.json()) as ActivityResponse;
        if (data.success && data.events) {
          setActivityEvents(data.events);
        }
      }

      // Missions — count IN_PROGRESS missions whose title hints at marketing/social work
      if (missionsRes.ok) {
        const data = (await missionsRes.json()) as MissionListResponse;
        if (data.success && data.data?.missions) {
          const count = data.data.missions.filter(
            (m) => m.status === 'IN_PROGRESS' && isMarketingMission(m.title),
          ).length;
          setMarketingActiveMissions(count);
        }
      }
    } catch (error) {
      logger.error(
        'Failed to load social hub data',
        error instanceof Error ? error : new Error(String(error)),
      );
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Build platform rows
  const platformRows: PlatformRow[] = useMemo(() => {
    return SOCIAL_PLATFORMS.map((p) => {
      const cfg = getPlatformConfig(p);
      const account = accounts.find((a) => a.platform === p && a.status === 'active');
      return {
        platform: p,
        state: cfg.state,
        connected: Boolean(account),
        handle: account?.handle,
        accountName: account?.accountName,
        todayPublished: recentPublishedByPlatform[p] ?? 0,
      };
    });
  }, [accounts, recentPublishedByPlatform]);

  const connectedCount = platformRows.filter((r) => r.connected).length;

  return (
    <div className="p-8 space-y-6">
      <SubpageNav items={SOCIAL_TABS} />

      {/* Section 1: Header */}
      <div>
        <PageTitle>Social Media</PageTitle>
        <SectionDescription>
          {connectedCount > 0
            ? `${connectedCount} platform${connectedCount === 1 ? '' : 's'} connected`
            : 'Connect your social media accounts to get started'}
        </SectionDescription>
      </div>

      {/* Section 2: AI Activity Strip */}
      <AiActivityStrip
        loading={loading}
        swarmPaused={swarmPaused}
        marketingActiveMissions={marketingActiveMissions}
        pendingApprovalCount={pendingApprovalCount}
        agentEnabled={agentEnabled}
        queueDepth={queueDepth}
        scheduledCount={scheduledCount}
      />

      {/* Section 3: Cross-platform metrics row */}
      <div className="space-y-3">
        <SectionTitle as="h2" className="text-lg">Performance</SectionTitle>
        <MetricsRow
          loading={loading}
          error={metricsError}
          totals={metricsTotals}
          pendingApprovalCount={pendingApprovalCount}
        />
      </div>

      {/* Section 4: 7-day calendar mini widget */}
      <CalendarMini loading={loading} error={calendarError} events={calendarEvents} />

      {/* Section 5: Platforms list */}
      <PlatformList loading={loading} rows={platformRows} />

      {/* Section 6: Quick actions */}
      <div className="space-y-3">
        <SectionTitle as="h2" className="text-lg">Quick Actions</SectionTitle>
        <QuickActions pendingApprovalCount={pendingApprovalCount} />
      </div>

      {/* Recent Activity (optional — only renders if events exist) */}
      <RecentActivity loading={loading} events={activityEvents} />
    </div>
  );
}
