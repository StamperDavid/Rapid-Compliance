'use client';

/**
 * Social Media Command Center
 * Live agent status, activity feed, health gauges, and kill switch.
 *
 * Follows the "Tesla Autopilot" model — AI drives by default,
 * user can grab the wheel at any moment.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
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
  MARKETING_MANAGER: 'Marketing',
  REVENUE_DIRECTOR: 'Revenue',
  ARCHITECT_MANAGER: 'Architect',
  BUILDER_MANAGER: 'Builder',
  CONTENT_MANAGER: 'Content',
  OUTREACH_MANAGER: 'Outreach',
  COMMERCE_MANAGER: 'Commerce',
  REPUTATION_MANAGER: 'Reputation',
  INTELLIGENCE_MANAGER: 'Intelligence',
};

const ALL_MANAGER_IDS = Object.keys(MANAGER_DISPLAY_NAMES);

// ─── Constants ───────────────────────────────────────────────────────────────

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#000000',
  linkedin: '#0A66C2',
};

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

// ─── Velocity Gauge Component ────────────────────────────────────────────────

function VelocityGauge({ label, current, max }: { label: string; current: number; max: number }) {
  const percentage = max > 0 ? Math.min((current / max) * 100, 100) : 0;
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  let color = '#4CAF50';
  if (percentage >= 80) { color = '#F44336'; }
  else if (percentage >= 50) { color = '#FF9800'; }

  return (
    <div style={{ textAlign: 'center' }}>
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
        <text x="44" y="40" textAnchor="middle" fill="var(--color-text-primary)" fontSize="16" fontWeight="700">
          {current}
        </text>
        <text x="44" y="56" textAnchor="middle" fill="var(--color-text-disabled)" fontSize="10">
          / {max}
        </text>
      </svg>
      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', marginTop: '0.25rem' }}>
        {label}
      </div>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function CommandCenterPage() {
  const authFetch = useAuthFetch();
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [activity, setActivity] = useState<ActivityEvent[]>([]);
  const [swarmControl, setSwarmControl] = useState<SwarmControlState | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [swarmToggling, setSwarmToggling] = useState(false);
  const [managerToggling, setManagerToggling] = useState<string | null>(null);
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
      logger.error('Failed to fetch command center data', error instanceof Error ? error : new Error(String(error)));
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

  const handleToggleAgent = async () => {
    if (!status) { return; }
    setToggling(true);
    try {
      const response = await authFetch('/api/social/agent-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentEnabled: !status.agentEnabled }),
      });
      const data = await response.json() as { success: boolean; agentEnabled?: boolean };
      if (data.success) {
        setStatus((prev) => prev ? { ...prev, agentEnabled: data.agentEnabled ?? !prev.agentEnabled } : prev);
      }
    } catch (error) {
      logger.error('Failed to toggle agent', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setToggling(false);
    }
  };

  const handleToggleSwarm = async () => {
    if (!swarmControl) { return; }
    setSwarmToggling(true);
    try {
      const action = swarmControl.globalPause ? 'resume_swarm' : 'pause_swarm';
      const response = await authFetch('/api/orchestrator/swarm-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await response.json() as { success: boolean; state?: SwarmControlState };
      if (data.success && data.state) {
        setSwarmControl(data.state);
      }
    } catch (error) {
      logger.error('Failed to toggle swarm', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setSwarmToggling(false);
    }
  };

  const handleToggleManager = async (managerId: string) => {
    if (!swarmControl) { return; }
    setManagerToggling(managerId);
    try {
      const isPaused = swarmControl.pausedManagers.includes(managerId);
      const action = isPaused ? 'resume_manager' : 'pause_manager';
      const response = await authFetch('/api/orchestrator/swarm-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, managerId }),
      });
      const data = await response.json() as { success: boolean; state?: SwarmControlState };
      if (data.success && data.state) {
        setSwarmControl(data.state);
      }
    } catch (error) {
      logger.error('Failed to toggle manager', error instanceof Error ? error : new Error(String(error)));
    } finally {
      setManagerToggling(null);
    }
  };

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

  const formatNextPost = (iso: string) => {
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
      <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
          Loading Command Center...
        </div>
      </div>
    );
  }

  if (!status) {
    return (
      <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
        <div style={{ textAlign: 'center', padding: '4rem', color: 'var(--color-text-secondary)' }}>
          Failed to load agent status. Please try again.
        </div>
      </div>
    );
  }

  return (
    <div style={{ padding: '2rem', maxWidth: 1200, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1.5rem' }}>
        <div>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
            Command Center
          </h1>
          <p style={{ color: 'var(--color-text-secondary)', fontSize: '0.8125rem' }}>
            Social media agent status and controls
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <Link
            href="/settings/integrations?category=social"
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-paper)',
              color: 'var(--color-text-secondary)',
              fontSize: '0.75rem',
              textDecoration: 'none',
            }}
          >
            Manage Accounts
          </Link>
          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
            Updated {formatTime(lastRefresh.toISOString())}
          </span>
          <button
            type="button"
            onClick={() => { void fetchData(); }}
            style={{
              padding: '0.375rem 0.75rem',
              borderRadius: '0.375rem',
              border: '1px solid var(--color-border-light)',
              backgroundColor: 'var(--color-bg-paper)',
              color: 'var(--color-text-secondary)',
              cursor: 'pointer',
              fontSize: '0.75rem',
            }}
          >
            Refresh
          </button>
        </div>
      </div>

      {/* ── Kill Switch + Agent Status Banner ──────────────────────────── */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '1.25rem 1.5rem',
          backgroundColor: status.agentEnabled ? 'rgba(76,175,80,0.08)' : 'rgba(244,67,54,0.08)',
          border: `1px solid ${status.agentEnabled ? 'rgba(76,175,80,0.3)' : 'rgba(244,67,54,0.3)'}`,
          borderRadius: '0.75rem',
          marginBottom: '1.5rem',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <div
            style={{
              width: 12,
              height: 12,
              borderRadius: '50%',
              backgroundColor: status.agentEnabled ? '#4CAF50' : '#F44336',
              boxShadow: status.agentEnabled ? '0 0 8px rgba(76,175,80,0.5)' : '0 0 8px rgba(244,67,54,0.5)',
            }}
          />
          <div>
            <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', fontSize: '0.9375rem' }}>
              {status.agentEnabled ? 'AI Agent is Active' : 'AI Agent is Paused'}
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--color-text-secondary)', marginTop: '0.125rem' }}>
              {status.agentEnabled
                ? `${status.queueDepth} posts queued, ${status.scheduledCount} scheduled${status.nextPostTime ? `, next post ${formatNextPost(status.nextPostTime)}` : ''}`
                : 'All automated posting is paused. Manual posting still works.'}
            </div>
          </div>
        </div>
        <button
          type="button"
          onClick={() => { void handleToggleAgent(); }}
          disabled={toggling}
          style={{
            padding: '0.625rem 1.5rem',
            borderRadius: '0.5rem',
            border: 'none',
            cursor: toggling ? 'wait' : 'pointer',
            fontSize: '0.8125rem',
            fontWeight: 600,
            backgroundColor: status.agentEnabled ? '#F44336' : '#4CAF50',
            color: '#fff',
            opacity: toggling ? 0.6 : 1,
            transition: 'opacity 0.2s',
          }}
        >
          {toggling
            ? (status.agentEnabled ? 'Pausing...' : 'Activating...')
            : (status.agentEnabled ? 'Pause Agent' : 'Activate Agent')}
        </button>
      </div>

      {/* ── Swarm Control — Global Kill Switch + Manager Toggles ──────── */}
      {swarmControl && (
        <div
          style={{
            padding: '1.25rem 1.5rem',
            backgroundColor: swarmControl.globalPause ? 'rgba(244,67,54,0.05)' : 'var(--color-bg-paper)',
            border: `1px solid ${swarmControl.globalPause ? 'rgba(244,67,54,0.3)' : 'var(--color-border-light)'}`,
            borderRadius: '0.75rem',
            marginBottom: '1.5rem',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
            <div>
              <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '0.25rem' }}>
                Swarm Control
              </h2>
              <p style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)' }}>
                {swarmControl.globalPause
                  ? 'ALL agent activity is frozen. Events and signals are queued.'
                  : 'All systems operational. Toggle individual managers below.'}
              </p>
            </div>
            <button
              type="button"
              onClick={() => { void handleToggleSwarm(); }}
              disabled={swarmToggling}
              style={{
                padding: '0.5rem 1.25rem',
                borderRadius: '0.5rem',
                border: 'none',
                cursor: swarmToggling ? 'wait' : 'pointer',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                backgroundColor: swarmControl.globalPause ? '#4CAF50' : '#F44336',
                color: '#fff',
                opacity: swarmToggling ? 0.6 : 1,
                transition: 'opacity 0.2s',
              }}
            >
              {swarmToggling
                ? (swarmControl.globalPause ? 'Resuming...' : 'Pausing...')
                : (swarmControl.globalPause ? 'Resume All Agents' : 'Pause All Agents')}
            </button>
          </div>

          {/* Manager Toggles Grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '0.5rem' }}>
            {ALL_MANAGER_IDS.map((managerId) => {
              const isPaused = swarmControl.globalPause || swarmControl.pausedManagers.includes(managerId);
              const isThisToggling = managerToggling === managerId;
              const displayName = MANAGER_DISPLAY_NAMES[managerId] ?? managerId;

              return (
                <button
                  key={managerId}
                  type="button"
                  onClick={() => { void handleToggleManager(managerId); }}
                  disabled={swarmControl.globalPause || isThisToggling}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '0.5rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: `1px solid ${isPaused ? 'rgba(244,67,54,0.3)' : 'rgba(76,175,80,0.3)'}`,
                    backgroundColor: isPaused ? 'rgba(244,67,54,0.06)' : 'rgba(76,175,80,0.06)',
                    cursor: swarmControl.globalPause || isThisToggling ? 'not-allowed' : 'pointer',
                    opacity: swarmControl.globalPause ? 0.5 : (isThisToggling ? 0.6 : 1),
                    transition: 'opacity 0.2s, background-color 0.2s',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    color: 'var(--color-text-primary)',
                  }}
                >
                  <span>{displayName}</span>
                  <span
                    style={{
                      width: 8,
                      height: 8,
                      borderRadius: '50%',
                      backgroundColor: isPaused ? '#F44336' : '#4CAF50',
                      flexShrink: 0,
                    }}
                  />
                </button>
              );
            })}
          </div>

          {swarmControl.pausedManagers.length > 0 && !swarmControl.globalPause && (
            <div style={{ marginTop: '0.75rem', fontSize: '0.6875rem', color: '#FF9800' }}>
              {swarmControl.pausedManagers.length} manager{swarmControl.pausedManagers.length > 1 ? 's' : ''} individually paused
            </div>
          )}
        </div>
      )}

      {/* ── Stats Row ──────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '1rem', marginBottom: '1.5rem' }}>
        {[
          { label: 'Published Today', value: status.todayPublished, color: '#4CAF50' },
          { label: 'In Queue', value: status.queueDepth, color: '#9C27B0' },
          { label: 'Scheduled', value: status.scheduledCount, color: '#2196F3' },
          { label: 'Pending Approval', value: status.pendingApprovalCount, color: '#FF9800' },
          { label: 'Daily Limit', value: `${status.todayPublished}/${status.velocityUsage.maxDailyPosts}`, color: '#607D8B' },
        ].map((stat) => (
          <div
            key={stat.label}
            style={{
              padding: '1rem',
              backgroundColor: 'var(--color-bg-paper)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border-light)',
            }}
          >
            <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-secondary)', marginBottom: '0.25rem' }}>
              {stat.label}
            </div>
            <div style={{ fontSize: '1.5rem', fontWeight: 700, color: stat.color }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Two-Column Layout: Velocity Gauges + Platform Status ───────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.5rem', marginBottom: '1.5rem' }}>
        {/* Velocity Gauges */}
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.75rem',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            Velocity Limits (per hour)
          </h2>
          <div style={{ display: 'flex', justifyContent: 'space-around' }}>
            <VelocityGauge
              label="Posts / Day"
              current={status.velocityUsage.postsToday}
              max={status.velocityUsage.maxDailyPosts}
            />
            <VelocityGauge
              label="Posts / Hour"
              current={0}
              max={status.velocityUsage.postVelocityLimit}
            />
            <VelocityGauge
              label="Replies / Hour"
              current={0}
              max={status.velocityUsage.replyVelocityLimit}
            />
            <VelocityGauge
              label="Likes / Hour"
              current={0}
              max={status.velocityUsage.likeVelocityLimit}
            />
          </div>
        </div>

        {/* Platform Connections */}
        <div
          style={{
            padding: '1.25rem',
            backgroundColor: 'var(--color-bg-paper)',
            borderRadius: '0.75rem',
            border: '1px solid var(--color-border-light)',
          }}
        >
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)', marginBottom: '1rem' }}>
            Connected Platforms
          </h2>
          {status.platformStatus.length === 0 ? (
            <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.8125rem' }}>
              No accounts connected.{' '}
              <Link
                href="/settings/integrations?category=social"
                style={{ color: 'var(--color-primary)', textDecoration: 'underline' }}
              >
                Add accounts in Settings
              </Link>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {status.platformStatus.map((p, i) => {
                const statusColors = CONNECTION_STATUS_COLORS[p.status] ?? CONNECTION_STATUS_COLORS.disconnected;
                return (
                  <div
                    key={`${p.platform}-${p.handle}-${i}`}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '0.75rem',
                      borderRadius: '0.5rem',
                      border: '1px solid var(--color-border-light)',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor: PLATFORM_COLORS[p.platform] ?? '#666',
                          textTransform: 'uppercase',
                        }}
                      >
                        {p.platform}
                      </span>
                      <div>
                        <div style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--color-text-primary)' }}>
                          {p.accountName}
                        </div>
                        <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
                          @{p.handle}
                        </div>
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      {p.isDefault && (
                        <span style={{ fontSize: '0.625rem', color: 'var(--color-text-disabled)', fontWeight: 500 }}>
                          DEFAULT
                        </span>
                      )}
                      <span
                        style={{
                          padding: '0.2rem 0.5rem',
                          borderRadius: '1rem',
                          fontSize: '0.625rem',
                          fontWeight: 600,
                          backgroundColor: statusColors.bg,
                          color: statusColors.text,
                        }}
                      >
                        {p.status}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Activity Feed ──────────────────────────────────────────────── */}
      <div
        style={{
          padding: '1.25rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '1rem' }}>
          <h2 style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-text-primary)' }}>
            Recent Activity
          </h2>
          <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)' }}>
            {activity.length} events
          </span>
        </div>

        {activity.length === 0 ? (
          <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--color-text-disabled)', fontSize: '0.8125rem' }}>
            No activity yet. The agent will log actions here as it operates.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.375rem' }}>
            {activity.map((event) => {
              const config = EVENT_TYPE_CONFIG[event.type] ?? EVENT_TYPE_CONFIG.cancelled;
              return (
                <div
                  key={event.id}
                  style={{
                    display: 'flex',
                    alignItems: 'flex-start',
                    gap: '0.75rem',
                    padding: '0.625rem 0.75rem',
                    borderRadius: '0.375rem',
                    border: '1px solid var(--color-border-light)',
                    fontSize: '0.8125rem',
                  }}
                >
                  {/* Event type icon */}
                  <span
                    style={{
                      width: 24,
                      height: 24,
                      borderRadius: '50%',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      fontSize: '0.75rem',
                      fontWeight: 700,
                      backgroundColor: `${config.color}20`,
                      color: config.color,
                      flexShrink: 0,
                    }}
                  >
                    {config.icon}
                  </span>

                  {/* Content */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.125rem' }}>
                      <span
                        style={{
                          padding: '0.125rem 0.375rem',
                          borderRadius: '0.25rem',
                          fontSize: '0.5625rem',
                          fontWeight: 600,
                          color: '#fff',
                          backgroundColor: PLATFORM_COLORS[event.platform] ?? '#666',
                          textTransform: 'uppercase',
                        }}
                      >
                        {event.platform}
                      </span>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 500, color: config.color }}>
                        {config.label}
                      </span>
                    </div>
                    <div style={{
                      color: 'var(--color-text-primary)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}>
                      {event.content}
                    </div>
                    {event.reason && (
                      <div style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', marginTop: '0.125rem' }}>
                        Reason: {event.reason}
                      </div>
                    )}
                  </div>

                  {/* Timestamp */}
                  <span style={{ fontSize: '0.6875rem', color: 'var(--color-text-disabled)', flexShrink: 0, whiteSpace: 'nowrap' }}>
                    {formatTime(event.timestamp)}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Quick Settings Summary ─────────────────────────────────────── */}
      <div
        style={{
          display: 'flex',
          gap: '1rem',
          marginTop: '1.5rem',
          padding: '1rem',
          backgroundColor: 'var(--color-bg-paper)',
          borderRadius: '0.75rem',
          border: '1px solid var(--color-border-light)',
          fontSize: '0.75rem',
          color: 'var(--color-text-secondary)',
        }}
      >
        <span>
          Auto-Approval: <strong style={{ color: status.autoApprovalEnabled ? '#4CAF50' : '#FF9800' }}>
            {status.autoApprovalEnabled ? 'ON' : 'OFF'}
          </strong>
        </span>
        <span style={{ color: 'var(--color-border-light)' }}>|</span>
        <span>
          Weekend Pause: <strong style={{ color: status.pauseOnWeekends ? '#4CAF50' : 'var(--color-text-disabled)' }}>
            {status.pauseOnWeekends ? 'ON' : 'OFF'}
          </strong>
        </span>
        <span style={{ color: 'var(--color-border-light)' }}>|</span>
        <span>
          Daily Limit: <strong>{status.velocityUsage.maxDailyPosts} posts/day</strong>
        </span>
      </div>
    </div>
  );
}
