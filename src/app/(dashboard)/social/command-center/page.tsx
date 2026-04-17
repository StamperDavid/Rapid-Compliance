'use client';

/**
 * Social Dashboard
 * Live social media performance, activity feed, and AI automation controls.
 *
 * Follows the "Tesla Autopilot" model — AI drives by default,
 * user can grab the wheel at any moment.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';
import { SOCIAL_PLATFORMS } from '@/types/social';
import { PLATFORM_META } from '@/lib/social/platform-config';
import { PageTitle, SectionDescription } from '@/components/ui/typography';

// ─── Types ───────────────────────────────────────────────────────────────────

interface VelocityUsage {
  postsToday: number;
  maxDailyPosts: number;
  postVelocityLimit: number;
  replyVelocityLimit: number;
  likeVelocityLimit: number;
}

interface PlatformConnection {
  platform: string;
  accountName: string;
  handle: string;
  status: 'active' | 'disconnected' | 'expired';
  isDefault: boolean;
}

interface RecentPost {
  id: string;
  platform: string;
  content: string;
  publishedAt: string;
  status: string;
}

interface AgentStatus {
  agentEnabled: boolean;
  pauseOnWeekends: boolean;
  autoApprovalEnabled: boolean;
  queueDepth: number;
  scheduledCount: number;
  pendingApprovalCount: number;
  nextPostTime: string | null;
  velocityUsage: VelocityUsage;
  platformStatus: PlatformConnection[];
  todayPublished: number;
  recentPublished: RecentPost[];
}

interface ActivityEvent {
  id: string;
  type: 'published' | 'scheduled' | 'queued' | 'approval_triggered' | 'failed' | 'cancelled';
  platform: string;
  content: string;
  reason?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}

interface SwarmControlState {
  globalPause: boolean;
  globalPauseAt?: string;
  globalPauseBy?: string;
  pausedManagers: string[];
  pausedAgents: string[];
  updatedAt: string;
  updatedBy: string;
}

// ─── Manager display names ───────────────────────────────────────────────────

const MANAGER_DISPLAY_NAMES: Record<string, string> = {
  INTELLIGENCE_MANAGER: 'Research',
  MARKETING_MANAGER: 'Social & Marketing',
  BUILDER_MANAGER: 'Website',
  COMMERCE_MANAGER: 'E-commerce',
  OUTREACH_MANAGER: 'Email & Outreach',
  CONTENT_MANAGER: 'Content',
  ARCHITECT_MANAGER: 'Strategy',
  REVENUE_DIRECTOR: 'Sales',
  REPUTATION_MANAGER: 'Reviews & Reputation',
};

const _ALL_MANAGER_IDS = Object.keys(MANAGER_DISPLAY_NAMES);

/** Resolve a platform id (possibly untyped from API) to a human-readable label. */
function platformLabel(id: string): string {
  const meta = PLATFORM_META[id as keyof typeof PLATFORM_META];
  return meta ? meta.label : id;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p, PLATFORM_META[p].color])
);

const EVENT_TYPE_CONFIG: Record<string, { color: string; label: string; icon: string }> = {
  published: { color: '#4CAF50', label: 'Published', icon: '✓' },
  scheduled: { color: '#2196F3', label: 'Scheduled', icon: '◷' },
  queued: { color: '#9C27B0', label: 'Queued', icon: '≡' },
  approval_triggered: { color: '#FF9800', label: 'Flagged', icon: '⚑' },
  failed: { color: '#F44336', label: 'Failed', icon: '✗' },
  cancelled: { color: '#9E9E9E', label: 'Cancelled', icon: '—' },
};

const CONNECTION_STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  active: { bg: 'rgba(76,175,80,0.15)', text: '#4CAF50' },
  disconnected: { bg: 'rgba(244,67,54,0.15)', text: '#F44336' },
  expired: { bg: 'rgba(255,152,0,0.15)', text: '#FF9800' },
};

// ─── Platform Pie Chart Component ───────────────────────────────────────────

interface PieChartData {
  platform: string;
  value: number;
  color: string;
}

function PlatformPieChart({ data, emptyMessage }: { data: PieChartData[]; emptyMessage: string }) {
  const filtered = data.filter((d) => d.value > 0);
  if (filtered.length === 0) {
    return <div className="text-xs text-muted-foreground text-center py-6">{emptyMessage}</div>;
  }

  const total = filtered.reduce((sum, d) => sum + d.value, 0);
  const size = 140;
  const center = size / 2;
  const radius = 55;
  let cumulative = 0;

  const slices = filtered.map((d) => {
    const startAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    cumulative += d.value;
    const endAngle = (cumulative / total) * 2 * Math.PI - Math.PI / 2;
    const largeArc = endAngle - startAngle > Math.PI ? 1 : 0;

    const x1 = center + radius * Math.cos(startAngle);
    const y1 = center + radius * Math.sin(startAngle);
    const x2 = center + radius * Math.cos(endAngle);
    const y2 = center + radius * Math.sin(endAngle);

    const pathData = filtered.length === 1
      ? `M ${center} ${center - radius} A ${radius} ${radius} 0 1 1 ${center - 0.01} ${center - radius} Z`
      : `M ${center} ${center} L ${x1} ${y1} A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2} Z`;

    return { ...d, pathData, percentage: Math.round((d.value / total) * 100) };
  });

  return (
    <div className="flex flex-col items-center gap-3">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path key={i} d={s.pathData} fill={s.color} stroke="var(--color-bg-paper)" strokeWidth="1.5" />
        ))}
        <circle cx={center} cy={center} r={radius * 0.55} fill="var(--color-bg-paper)" />
        <text x={center} y={center - 4} textAnchor="middle" fill="var(--color-text-primary)" fontSize="16" fontWeight="700">
          {total.toLocaleString()}
        </text>
        <text x={center} y={center + 12} textAnchor="middle" fill="var(--color-text-disabled)" fontSize="9">
          total
        </text>
      </svg>
      <div className="flex flex-wrap justify-center gap-x-3 gap-y-1">
        {slices.map((s, i) => {
          const meta = PLATFORM_META[s.platform as keyof typeof PLATFORM_META];
          return (
            <div key={i} className="flex items-center gap-1">
              <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: s.color }} />
              <span className="text-[10px] text-muted-foreground">{meta?.label ?? s.platform} {s.percentage}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ─── Velocity Gauge Component ────────────────────────────────────────────────

interface VelocityGaugeProps {
  label: string;
  current: number;
  max: number;
  /** Optional suffix shown after the current value (e.g. "%") */
  suffix?: string;
  /** If true, the denominator line ("/ max") is hidden */
  hideMax?: boolean;
}

function VelocityGauge({ label, current, max, suffix, hideMax }: VelocityGaugeProps) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let color = '#4CAF50';
  if (percentage >= 80) { color = '#F44336'; }
  else if (percentage >= 50) { color = '#FF9800'; }

  return (
    <div className="text-center">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle
          cx="44" cy="44" r={radius}
          fill="none"
          stroke="var(--color-border-light)"
          strokeWidth="6"
        />
        <circle
          cx="44" cy="44" r={radius}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          transform="rotate(-90 44 44)"
          style={{ transition: 'stroke-dashoffset 0.6s ease' }}
        />
        <text x="44" y={hideMax ? '48' : '40'} textAnchor="middle" fill="var(--color-text-primary)" fontSize="16" fontWeight="700">
          {current}{suffix ?? ''}
        </text>
        {!hideMax && (
          <text x="44" y="56" textAnchor="middle" fill="var(--color-text-disabled)" fontSize="10">
            / {max}
          </text>
        )}
      </svg>
      <div className="text-xs text-muted-foreground mt-1">{label}</div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const authFetch = useAuthFetch();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [_swarmControl, setSwarmControl] = useState<SwarmControlState | null>(null);
  const [loading, setLoading] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, activityRes, swarmRes] = await Promise.all([
        authFetch('/api/social/agent-status'),
        authFetch('/api/social/activity?limit=20'),
        authFetch('/api/orchestrator/swarm-control'),
      ]);

      const statusData = await statusRes.json() as { success: boolean; status?: AgentStatus };
      const activityData = await activityRes.json() as { success: boolean; events?: ActivityEvent[] };
      const swarmData = await swarmRes.json() as { success: boolean; state?: SwarmControlState };

      if (statusData.success && statusData.status) {
        setStatus(statusData.status);
      }
      if (activityData.success && activityData.events) {
        setActivity(activityData.events);
      }
      if (swarmData.success && swarmData.state) {
        setSwarmControl(swarmData.state);
      }
      setLastRefresh(new Date());
    } catch (error) {
      logger.error('Failed to fetch social dashboard data', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchData();
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => { void fetchData(); }, 30_000);
    return () => clearInterval(interval);
  }, [fetchData]);

  // Toggle handlers moved to /social/agent-rules (AI Settings tab)
  // They're still available via the AI Settings link on this page.

  const formatTime = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = now.getTime() - d.getTime();
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 1) { return 'just now'; }
    if (diffMin < 60) { return `${diffMin}m ago`; }
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) { return `${diffHr}h ago`; }
    return d.toLocaleDateString();
  };

  const _formatNextPost = (iso: string) => {
    const d = new Date(iso);
    const now = new Date();
    const diffMs = d.getTime() - now.getTime();
    if (diffMs <= 0) { return 'overdue'; }
    const diffMin = Math.floor(diffMs / 60_000);
    if (diffMin < 60) { return `in ${diffMin} min`; }
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) { return `in ${diffHr}h ${diffMin % 60}m`; }
    return d.toLocaleDateString();
  };

  if (loading) {
    return (
      <div className="p-8 space-y-6">
        <div className="text-center py-16 text-muted-foreground">
          Loading Social Dashboard...
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="p-8 space-y-6">
        <div className="text-center py-16 text-muted-foreground">
          Failed to load agent status. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <PageTitle>Social Dashboard</PageTitle>
          <SectionDescription className="mt-1">Social media performance and controls</SectionDescription>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/settings/integrations?category=social"
            className="px-3 py-1.5 rounded-md border border-border-light bg-card text-muted-foreground text-xs no-underline hover:bg-surface-elevated transition-colors"
          >
            Manage Accounts
          </Link>
          <span className="text-xs text-muted-foreground">
            Updated {formatTime(lastRefresh.toISOString())}
          </span>
          <button
            type="button"
            onClick={() => { void fetchData(); }}
            className="px-3 py-1.5 rounded-md border border-border-light bg-card text-muted-foreground cursor-pointer text-xs hover:bg-surface-elevated transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Compact AI Status (single line, not a full section) ────────── */}
      <div className="flex items-center justify-between px-4 py-3 rounded-lg bg-card border border-border-light">
        <div className="flex items-center gap-3">
          <div
            className="w-2.5 h-2.5 rounded-full shrink-0"
            style={{ backgroundColor: status.agentEnabled ? '#4CAF50' : '#F44336' }}
          />
          <span className="text-sm text-foreground">
            {status.agentEnabled
              ? `AI is active — ${status.queueDepth} queued, ${status.scheduledCount} scheduled`
              : 'AI posting is paused'}
          </span>
        </div>
        <Link href="/social/agent-rules" className="text-xs text-primary font-medium hover:underline no-underline">
          AI Settings →
        </Link>
      </div>

      {/* ── Engagement by Platform (pie chart placeholders) ────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Likes by Platform */}
        <div className="p-5 bg-card rounded-xl border border-border-light">
          <h2 className="text-sm font-semibold text-foreground mb-4">Likes by Platform</h2>
          <div className="flex justify-center">
            <PlatformPieChart
              data={status.platformStatus.map((p) => ({
                platform: p.platform,
                value: Math.floor(Math.random() * 500),
                color: PLATFORM_COLORS[p.platform] ?? '#666',
              }))}
              emptyMessage="Connect platforms to see likes"
            />
          </div>
        </div>

        {/* Followers by Platform */}
        <div className="p-5 bg-card rounded-xl border border-border-light">
          <h2 className="text-sm font-semibold text-foreground mb-4">Followers by Platform</h2>
          <div className="flex justify-center">
            <PlatformPieChart
              data={status.platformStatus.map((p) => ({
                platform: p.platform,
                value: Math.floor(Math.random() * 2000),
                color: PLATFORM_COLORS[p.platform] ?? '#666',
              }))}
              emptyMessage="Connect platforms to see followers"
            />
          </div>
        </div>

        {/* Engagement Rate by Platform */}
        <div className="p-5 bg-card rounded-xl border border-border-light">
          <h2 className="text-sm font-semibold text-foreground mb-4">Engagement by Platform</h2>
          <div className="flex justify-center">
            <PlatformPieChart
              data={status.platformStatus.map((p) => ({
                platform: p.platform,
                value: Math.floor(Math.random() * 100),
                color: PLATFORM_COLORS[p.platform] ?? '#666',
              }))}
              emptyMessage="Connect platforms to see engagement"
            />
          </div>
        </div>
      </div>

      {/* ── Stats Row ──────────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {[
          { label: 'Published Today', value: status.todayPublished, color: '#4CAF50' },
          { label: 'In Queue', value: status.queueDepth, color: '#9C27B0' },
          { label: 'Scheduled', value: status.scheduledCount, color: '#2196F3' },
          { label: 'Pending Approval', value: status.pendingApprovalCount, color: '#FF9800' },
          { label: 'Daily Limit', value: `${status.todayPublished}/${status.velocityUsage.maxDailyPosts}`, color: '#607D8B' },
        ].map((stat) => (
          <div
            key={stat.label}
            className="p-4 bg-card rounded-lg border border-border-light"
          >
            <div className="text-xs text-muted-foreground mb-1">{stat.label}</div>
            <div className="text-2xl font-bold" style={{ color: stat.color }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ── Two-Column Layout: Velocity Gauges + Platform Status ───────── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Social Performance Gauges */}
        <div className="p-5 bg-card rounded-xl border border-border-light">
          <h2 className="text-sm font-semibold text-foreground mb-4">Performance Overview</h2>
          <div className="flex justify-around">
            <VelocityGauge
              label="Posts This Week"
              current={status.todayPublished}
              max={status.velocityUsage.maxDailyPosts * 7}
            />
            <VelocityGauge
              label="Engagement Rate"
              current={0}
              max={100}
              suffix="%"
              hideMax
            />
            <VelocityGauge
              label="Follower Growth"
              current={0}
              max={100}
              hideMax
            />
            <VelocityGauge
              label="Scheduled Posts"
              current={status.scheduledCount}
              max={Math.max(status.scheduledCount, 20)}
              hideMax
            />
          </div>
        </div>

        {/* Platform Connections */}
        <div className="p-5 bg-card rounded-xl border border-border-light">
          <h2 className="text-sm font-semibold text-foreground mb-4">Connected Platforms</h2>
          {status.platformStatus.length === 0 ? (
            <div className="py-6 text-center text-muted-foreground text-sm">
              No accounts connected.{' '}
              <Link
                href="/settings/integrations?category=social"
                className="text-primary underline"
              >
                Add accounts in Settings
              </Link>
            </div>
          ) : (
            <div className="flex flex-col gap-2">
              {status.platformStatus.map((p, i) => {
                const statusColors = CONNECTION_STATUS_COLORS[p.status] ?? CONNECTION_STATUS_COLORS.disconnected;
                return (
                  <div
                    key={`${p.platform}-${p.handle}-${i}`}
                    className="flex items-center justify-between p-3 rounded-lg border border-border-light"
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white uppercase"
                        style={{ backgroundColor: PLATFORM_COLORS[p.platform] ?? '#666' }}
                      >
                        {platformLabel(p.platform)}
                      </span>
                      <div>
                        <div className="text-sm font-medium text-foreground">{p.accountName}</div>
                        <div className="text-xs text-muted-foreground">@{p.handle}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.isDefault && (
                        <span className="text-[10px] text-muted-foreground font-medium">DEFAULT</span>
                      )}
                      <span
                        className="px-2 py-0.5 rounded-full text-[10px] font-semibold"
                        style={{ backgroundColor: statusColors.bg, color: statusColors.text }}
                      >
                        {p.status}
                      </span>
                      <Link
                        href={`/social/platforms/${p.platform}`}
                        className="text-xs text-primary font-medium hover:underline"
                      >
                        Open
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* All Platforms Grid */}
        <div className="p-5 bg-card rounded-xl border border-border-light">
          <h3 className="text-sm font-semibold text-foreground mb-3">All Platforms</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {SOCIAL_PLATFORMS.map((p) => {
              const pmeta = PLATFORM_META[p];
              return (
                <Link
                  key={p}
                  href={`/social/platforms/${p}`}
                  className="flex items-center gap-2 p-2 rounded-lg border border-border-light hover:bg-surface-elevated transition-colors"
                >
                  <span
                    className="w-6 h-6 rounded flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                    style={{ backgroundColor: pmeta.color }}
                  >
                    {pmeta.icon}
                  </span>
                  <span className="text-xs font-medium text-foreground truncate">{pmeta.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Activity Feed ──────────────────────────────────────────────── */}
      <div className="p-5 bg-card rounded-xl border border-border-light">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Recent Activity</h2>
          <span className="text-xs text-muted-foreground">{activity.length} events</span>
        </div>

        {activity.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            No activity yet. The agent will log actions here as it operates.
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            {activity.map((event) => {
              const config = EVENT_TYPE_CONFIG[event.type] ?? EVENT_TYPE_CONFIG.cancelled;
              return (
                <div
                  key={event.id}
                  className="flex items-start gap-3 px-3 py-2.5 rounded-md border border-border-light text-sm"
                >
                  {/* Event type icon */}
                  <span
                    className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                    style={{ backgroundColor: `${config.color}20`, color: config.color }}
                  >
                    {config.icon}
                  </span>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span
                        className="px-1.5 py-0.5 rounded text-[9px] font-semibold text-white uppercase"
                        style={{ backgroundColor: PLATFORM_COLORS[event.platform] ?? '#666' }}
                      >
                        {platformLabel(event.platform)}
                      </span>
                      <span className="text-xs font-medium" style={{ color: config.color }}>
                        {config.label}
                      </span>
                    </div>
                    <div className="text-foreground truncate">{event.content}</div>
                    {event.reason && (
                      <div className="text-xs text-muted-foreground mt-0.5">Reason: {event.reason}</div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span className="text-xs text-muted-foreground shrink-0 whitespace-nowrap">
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick Settings Summary ─────────────────────────────────────── */}
      <div className="flex gap-4 p-4 bg-card rounded-xl border border-border-light text-xs text-muted-foreground">
        <span>
          Auto-Approval:{' '}
          <strong style={{ color: status.autoApprovalEnabled ? '#4CAF50' : '#FF9800' }}>
            {status.autoApprovalEnabled ? 'ON' : 'OFF'}
          </strong>
        </span>
        <span className="text-border-light">|</span>
        <span>
          Weekend Pause:{' '}
          <strong style={{ color: status.pauseOnWeekends ? '#4CAF50' : undefined }} className={!status.pauseOnWeekends ? 'text-muted-foreground' : ''}>
            {status.pauseOnWeekends ? 'ON' : 'OFF'}
          </strong>
        </span>
        <span className="text-border-light">|</span>
        <span>
          Daily Limit: <strong>{status.velocityUsage.maxDailyPosts} posts/day</strong>
        </span>
      </div>
    </div>
  );
}
