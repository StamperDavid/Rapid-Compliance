'use client';

/**
 * Analytics Dashboard
 * Unified social media metrics with filters, charts, and performance tables.
 */

import React, { useState, useEffect, useCallback } from 'react';
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

interface EngagementMetrics {
  impressions?: number;
  engagements?: number;
  likes?: number;
  comments?: number;
  shares?: number;
  clicks?: number;
  reach?: number;
}

interface PostWithEngagement {
  id: string;
  platform: string;
  content: string;
  publishedAt: string | null;
  metrics: EngagementMetrics;
}

interface AggregateEngagement {
  totalPublished: number;
  postsWithMetrics: number;
  totalImpressions: number;
  totalEngagements: number;
  totalLikes: number;
  totalComments: number;
  totalShares: number;
  engagementRate: number;
}

interface DayCount {
  date: string;
  count: number;
}

interface PlatformStats {
  platform: string;
  published: number;
  scheduled: number;
  failed: number;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = Object.fromEntries(
  SOCIAL_PLATFORMS.map((p) => [p, PLATFORM_META[p].color])
);

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const authFetch = useAuthFetch();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [engagementData, setEngagementData] = useState<PostWithEngagement[]>([]);
  const [aggregateEngagement, setAggregateEngagement] = useState<AggregateEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<string>('all');
  const [sortBy, setSortBy] = useState<'date' | 'platform'>('date');

  const fetchData = useCallback(async () => {
    try {
      const [statusRes, activityRes, engagementRes] = await Promise.all([
        authFetch('/api/social/agent-status'),
        authFetch('/api/social/activity?limit=100'),
        authFetch('/api/social/engagement'),
      ]);

      const statusData = await statusRes.json() as { success: boolean; status?: AgentStatus };
      const activityData = await activityRes.json() as { success: boolean; events?: ActivityEvent[] };
      const engData = await engagementRes.json() as {
        success: boolean;
        aggregate?: AggregateEngagement;
        posts?: PostWithEngagement[];
      };

      if (statusData.success && statusData.status) {
        setStatus(statusData.status);
      }
      if (activityData.success && activityData.events) {
        setActivity(activityData.events);
      }
      if (engData.success) {
        setAggregateEngagement(engData.aggregate ?? null);
        setEngagementData(engData.posts ?? []);
      }
    } catch (error) {
      logger.error('Failed to fetch analytics data', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setLoading(false);
    }
  }, [authFetch]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  // ─── Derived Data ────────────────────────────────────────────────────────

  const filteredActivity = platformFilter === 'all'
    ? activity
    : activity.filter((e) => e.platform === platformFilter);

  const publishedEvents = filteredActivity.filter((e) => e.type === 'published');
  const totalPublished = publishedEvents.length;

  // Posts per day for last 7 days
  const last7Days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (6 - i));
    return d.toISOString().split('T')[0];
  });

  const postsPerDay: DayCount[] = last7Days.map((date) => {
    const count = publishedEvents.filter((e) => e.timestamp.startsWith(date)).length;
    return { date, count };
  });

  const maxCount = Math.max(...postsPerDay.map((d) => d.count), 1);

  // Platform breakdown
  const platformBreakdown: PlatformStats[] = SOCIAL_PLATFORMS.map((platform) => {
    const platformActivity = activity.filter((e) => e.platform === platform);
    return {
      platform,
      published: platformActivity.filter((e) => e.type === 'published').length,
      scheduled: platformActivity.filter((e) => e.type === 'scheduled').length,
      failed: platformActivity.filter((e) => e.type === 'failed').length,
    };
  });

  // Sorted posts for table
  const sortedPublished = [...publishedEvents].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    } else {
      return a.platform.localeCompare(b.platform);
    }
  });

  // ─── Helpers ─────────────────────────────────────────────────────────────

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    });
  };

  // ─── Loading State ───────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="p-8 max-w-6xl mx-auto">
        <div className="text-center py-16 text-muted-foreground">
          Loading Analytics...
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div className="p-8 space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div>
        <PageTitle>Analytics Dashboard</PageTitle>
        <SectionDescription className="mt-1">Unified social media metrics and performance tracking</SectionDescription>
      </div>

      {/* Summary Stats Row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 bg-card rounded-lg border border-border-light">
          <div className="text-xs text-muted-foreground mb-1">Total Published</div>
          <div className="text-2xl font-bold text-foreground">{totalPublished}</div>
        </div>

        <div className="p-4 bg-card rounded-lg border border-border-light">
          <div className="text-xs text-muted-foreground mb-1">Published Today</div>
          <div className="text-2xl font-bold" style={{ color: '#4CAF50' }}>{status?.todayPublished ?? 0}</div>
        </div>

        <div className="p-4 bg-card rounded-lg border border-border-light">
          <div className="text-xs text-muted-foreground mb-1">Engagement Rate</div>
          <div className="text-2xl font-bold" style={{ color: '#FF9800' }}>
            {aggregateEngagement && aggregateEngagement.postsWithMetrics > 0
              ? `${aggregateEngagement.engagementRate}%`
              : '--'}
          </div>
          {aggregateEngagement && aggregateEngagement.postsWithMetrics > 0 && (
            <div className="text-[10px] text-muted-foreground mt-0.5">
              {aggregateEngagement.postsWithMetrics} posts tracked
            </div>
          )}
        </div>

        <div className="p-4 bg-card rounded-lg border border-border-light">
          <div className="text-xs text-muted-foreground mb-1">Queue Depth</div>
          <div className="text-2xl font-bold" style={{ color: '#9C27B0' }}>{status?.queueDepth ?? 0}</div>
        </div>
      </div>

      {/* Platform Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['all', ...SOCIAL_PLATFORMS] as const).map((platform) => (
          <button
            key={platform}
            type="button"
            onClick={() => setPlatformFilter(platform)}
            className={`px-4 py-2 rounded-md border border-border-light text-sm font-medium capitalize transition-colors cursor-pointer ${
              platformFilter === platform
                ? 'bg-primary text-white'
                : 'bg-card text-muted-foreground hover:bg-surface-elevated'
            }`}
          >
            {platform}
          </button>
        ))}
      </div>

      {/* Publishing Activity Chart */}
      <div className="p-5 bg-card rounded-xl border border-border-light">
        <h2 className="text-sm font-semibold text-foreground mb-4">Publishing Activity (Last 7 Days)</h2>

        <svg width="100%" height="200" style={{ overflow: 'visible' }}>
          {/* Y-axis guide lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((fraction) => {
            const y = 180 - fraction * 160;
            return (
              <line
                key={fraction}
                x1="0"
                y1={y}
                x2="100%"
                y2={y}
                stroke="var(--color-border-light)"
                strokeWidth="1"
              />
            );
          })}

          {/* Bars */}
          {postsPerDay.map((day, i) => {
            const barWidth = 60;
            const x = i * 100 + 50;
            const barHeight = (day.count / maxCount) * 160;
            const y = 180 - barHeight;

            return (
              <g key={day.date}>
                <rect
                  x={x - barWidth / 2}
                  y={y}
                  width={barWidth}
                  height={barHeight}
                  fill="var(--color-primary)"
                  rx="4"
                />
                <text
                  x={x}
                  y={y - 5}
                  textAnchor="middle"
                  fill="var(--color-text-primary)"
                  fontSize="12"
                  fontWeight="600"
                >
                  {day.count}
                </text>
                <text
                  x={x}
                  y="195"
                  textAnchor="middle"
                  fill="var(--color-text-secondary)"
                  fontSize="10"
                >
                  {formatDate(day.date)}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Post Performance Table */}
      <div className="p-5 bg-card rounded-xl border border-border-light">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-semibold text-foreground">Post Performance</h2>
          <div className="flex gap-2 items-center">
            <span className="text-xs text-muted-foreground">Sort by:</span>
            <button
              type="button"
              onClick={() => setSortBy('date')}
              className={`px-2 py-1 rounded text-xs border border-border-light cursor-pointer transition-colors ${
                sortBy === 'date' ? 'bg-primary text-white' : 'bg-transparent text-muted-foreground hover:bg-surface-elevated'
              }`}
            >
              Date
            </button>
            <button
              type="button"
              onClick={() => setSortBy('platform')}
              className={`px-2 py-1 rounded text-xs border border-border-light cursor-pointer transition-colors ${
                sortBy === 'platform' ? 'bg-primary text-white' : 'bg-transparent text-muted-foreground hover:bg-surface-elevated'
              }`}
            >
              Platform
            </button>
          </div>
        </div>

        {sortedPublished.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground text-sm">No published posts yet</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b border-border-light">
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Platform</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Content</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Published At</th>
                  <th className="p-3 text-right text-xs font-semibold text-muted-foreground">Likes</th>
                  <th className="p-3 text-right text-xs font-semibold text-muted-foreground">Comments</th>
                  <th className="p-3 text-right text-xs font-semibold text-muted-foreground">Shares</th>
                  <th className="p-3 text-left text-xs font-semibold text-muted-foreground">Status</th>
                </tr>
              </thead>
              <tbody>
                {sortedPublished.map((post) => {
                  const eng = engagementData.find((e) => e.id === post.id);
                  return (
                    <tr key={post.id} className="border-b border-border-light">
                      <td className="p-3">
                        <span
                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold text-white uppercase"
                          style={{ backgroundColor: PLATFORM_COLORS[post.platform] ?? '#666' }}
                        >
                          {post.platform}
                        </span>
                      </td>
                      <td className="p-3 text-sm text-foreground max-w-[300px] truncate">{post.content}</td>
                      <td className="p-3 text-xs text-muted-foreground">{formatDateTime(post.timestamp)}</td>
                      <td className="p-3 text-sm font-semibold text-right" style={{ color: '#E91E63' }}>
                        {eng?.metrics.likes ?? '--'}
                      </td>
                      <td className="p-3 text-sm font-semibold text-right" style={{ color: '#2196F3' }}>
                        {eng?.metrics.comments ?? '--'}
                      </td>
                      <td className="p-3 text-sm font-semibold text-right" style={{ color: '#4CAF50' }}>
                        {eng?.metrics.shares ?? '--'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[rgba(76,175,80,0.15)] text-[#4CAF50]">
                          Published
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Platform Breakdown */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {platformBreakdown.map((stats) => (
          <div key={stats.platform} className="p-5 bg-card rounded-xl border border-border-light">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="px-2 py-0.5 rounded text-xs font-semibold text-white uppercase"
                style={{ backgroundColor: PLATFORM_COLORS[stats.platform] ?? '#666' }}
              >
                {stats.platform}
              </span>
              <h2 className="text-sm font-semibold text-foreground">Stats</h2>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Published</span>
                <span className="text-base font-bold" style={{ color: '#4CAF50' }}>{stats.published}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Scheduled</span>
                <span className="text-base font-bold" style={{ color: '#2196F3' }}>{stats.scheduled}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Failed</span>
                <span className="text-base font-bold" style={{ color: '#F44336' }}>{stats.failed}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
