'use client';

/**
 * Analytics Dashboard
 * Unified social media metrics with filters, charts, and performance tables.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useAuthFetch } from '@/hooks/useAuthFetch';
import { logger } from '@/lib/logger/logger';

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

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#000000',
  linkedin: '#0A66C2',
};

// ─── Main Component ──────────────────────────────────────────────────────────

export default function AnalyticsPage() {
  const authFetch = useAuthFetch();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [engagementData, setEngagementData] = useState<PostWithEngagement[]>([]);
  const [aggregateEngagement, setAggregateEngagement] = useState<AggregateEngagement | null>(null);
  const [loading, setLoading] = useState(true);
  const [platformFilter, setPlatformFilter] = useState<'all' | 'twitter' | 'linkedin'>('all');
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
  const platformBreakdown: PlatformStats[] = ['twitter', 'linkedin'].map((platform) => {
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
      <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
          Loading Analytics...
        </div>
      </div>
    );
  }

  // ─── Render ──────────────────────────────────────────────────────────────

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
          Analytics Dashboard
        </h1>
        <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
          Unified social media metrics and performance tracking
        </p>
      </div>

      {/* Summary Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Total Published
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)' }}>
            {totalPublished}
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Published Today
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#4CAF50' }}>
            {status?.todayPublished ?? 0}
          </div>
        </div>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Engagement Rate
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#FF9800' }}>
            {aggregateEngagement && aggregateEngagement.postsWithMetrics > 0
              ? `${aggregateEngagement.engagementRate}%`
              : '--'}
          </div>
          {aggregateEngagement && aggregateEngagement.postsWithMetrics > 0 && (
            <div style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)', marginTop: '0.125rem' }}>
              {aggregateEngagement.postsWithMetrics} posts tracked
            </div>
          )}
        </div>

        <div
          style={{
            padding: '1rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.5rem',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
            Queue Depth
          </div>
          <div style={{ fontSize: '1.5rem', fontWeight: 700, color: '#9C27B0' }}>
            {status?.queueDepth ?? 0}
          </div>
        </div>
      </div>

      {/* Platform Filter Tabs */}
      <div style={{ display: 'flex', gap: '0.5rem', marginBottom: '1.5rem' }}>
        {(['all', 'twitter', 'linkedin'] as const).map((platform) => (
          <button
            key={platform}
            type="button"
            onClick={() => setPlatformFilter(platform)}
            style={{
              padding: '0.5rem 1rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: platformFilter === platform ? 'var(--color-primary)' : 'var(--color-bg-paper)',
              color: platformFilter === platform ? '#fff' : 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.8125rem',
              fontWeight: 500,
              textTransform: 'capitalize',
            }}
          >
            {platform}
          </button>
        ))}
      </div>

      {/* Publishing Activity Chart */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          marginBottom: '1.5rem',
        }}
      >
        <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
          Publishing Activity (Last 7 Days)
        </h2>

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
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Post Performance
          </h2>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)' }}>Sort by:</span>
            <button
              type="button"
              onClick={() => setSortBy('date')}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--color-border-light)',
                backgroundColor: sortBy === 'date' ? 'var(--color-primary)' : 'transparent',
                color: sortBy === 'date' ? '#fff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Date
            </button>
            <button
              type="button"
              onClick={() => setSortBy('platform')}
              style={{
                padding: '0.25rem 0.5rem',
                borderRadius: '0.25rem',
                border: '1px solid var(--color-border-light)',
                backgroundColor: sortBy === 'platform' ? 'var(--color-primary)' : 'transparent',
                color: sortBy === 'platform' ? '#fff' : 'var(--color-text-secondary)',
                cursor: 'pointer',
                fontSize: '0.75rem',
              }}
            >
              Platform
            </button>
          </div>
        </div>

        {sortedPublished.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.8125rem' }}>
            No published posts yet
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}>
                    Platform
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}>
                    Content
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}>
                    Published At
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}>
                    Likes
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}>
                    Comments
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'right',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}>
                    Shares
                  </th>
                  <th style={{
                    padding: '0.75rem',
                    textAlign: 'left',
                    fontSize: '0.75rem',
                    fontWeight: 600,
                    color: 'var(--color-text-secondary)',
                  }}>
                    Status
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedPublished.map((post) => {
                  const eng = engagementData.find((e) => e.id === post.id);
                  return (
                    <tr key={post.id} style={{ borderBottom: '1px solid var(--color-border-light)' }}>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.2rem 0.5rem',
                            borderRadius: '0.25rem',
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            color: '#fff',
                            backgroundColor: PLATFORM_COLORS[post.platform] ?? '#666',
                            textTransform: 'uppercase',
                          }}
                        >
                          {post.platform}
                        </span>
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        fontSize: '0.8125rem',
                        color: 'var(--color-text-primary)',
                        maxWidth: '300px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}>
                        {post.content}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        fontSize: '0.75rem',
                        color: 'var(--color-text-secondary)',
                      }}>
                        {formatDateTime(post.timestamp)}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#E91E63',
                        textAlign: 'right',
                      }}>
                        {eng?.metrics.likes ?? '--'}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#2196F3',
                        textAlign: 'right',
                      }}>
                        {eng?.metrics.comments ?? '--'}
                      </td>
                      <td style={{
                        padding: '0.75rem',
                        fontSize: '0.8125rem',
                        fontWeight: 600,
                        color: '#4CAF50',
                        textAlign: 'right',
                      }}>
                        {eng?.metrics.shares ?? '--'}
                      </td>
                      <td style={{ padding: '0.75rem' }}>
                        <span
                          style={{
                            padding: '0.25rem 0.5rem',
                            borderRadius: '1rem',
                            fontSize: '0.625rem',
                            fontWeight: 600,
                            backgroundColor: 'rgba(76,175,80,0.15)',
                            color: '#4CAF50',
                          }}
                        >
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
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
        {platformBreakdown.map((stats) => (
          <div
            key={stats.platform}
            style={{
              padding: '1.25rem',
              backgroundColor: 'var(--color-bg-paper)',
              borderRadius: '0.75rem',
              border: '1px solid var(--color-border-light)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
              <span
                style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '0.25rem',
                  fontSize: '0.6875rem',
                  fontWeight: 600,
                  color: '#fff',
                  backgroundColor: PLATFORM_COLORS[stats.platform] ?? '#666',
                  textTransform: 'uppercase',
                }}
              >
                {stats.platform}
              </span>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
                Stats
              </h2>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Published</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#4CAF50' }}>
                  {stats.published}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Scheduled</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#2196F3' }}>
                  {stats.scheduled}
                </span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '0.8125rem', color: 'var(--color-text-secondary)' }}>Failed</span>
                <span style={{ fontSize: '1rem', fontWeight: 700, color: '#F44336' }}>
                  {stats.failed}
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
