'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useSystemStatus, type SystemAgentStatus } from '@/hooks/useSystemStatus';
import { useAuthFetch } from '@/hooks/useAuthFetch';

// ============================================================================
// TYPES
// ============================================================================

interface SwarmMonitorWidgetProps {
  /** Compact mode for smaller displays */
  compact?: boolean;
  /** Polling interval in ms (default: 30000) */
  pollingInterval?: number;
}

// ============================================================================
// CONSTANTS
// ============================================================================

/** Total number of agents in the swarm (47 = 1 orchestrator + 9 managers + 37 specialists) */
const TOTAL_AGENTS = 47;

/** Number of L2 managers */
const TOTAL_MANAGERS = 9;

// ============================================================================
// COMPONENT
// ============================================================================

/**
 * SwarmMonitorWidget - Live Agent Status Display
 *
 * Displays real-time telemetry from the MASTER_ORCHESTRATOR including:
 * - Agent health and status
 * - Active/executing agent counts
 * - Manager overview
 *
 * Polls /api/system/status for live data.
 */
export function SwarmMonitorWidget({
  compact = false,
  pollingInterval = 30000,
}: SwarmMonitorWidgetProps) {
  const {
    agents,
    metrics,
    loading,
    error,
    overallHealth,
    lastUpdated,
    refresh,
    isRefreshing,
  } = useSystemStatus({
    pollingInterval,
    enabled: true,
  });

  const authFetch = useAuthFetch();

  // Brief data state
  const [commerceMrr, setCommerceMrr] = useState<string>('--');
  const [trustScore, setTrustScore] = useState<string>('--');

  useEffect(() => {
    let cancelled = false;

    async function fetchBriefs() {
      // Commerce brief
      try {
        const res = await authFetch('/api/commerce/brief');
        if (res.ok) {
          const json = await res.json() as { success?: boolean; data?: { revenue?: { mrr?: number } } };
          if (!cancelled && json.success && json.data?.revenue?.mrr !== undefined) {
            setCommerceMrr(`$${json.data.revenue.mrr.toLocaleString()}`);
          }
        }
      } catch {
        if (!cancelled) { setCommerceMrr('N/A'); }
      }

      // Reputation brief
      try {
        const res = await authFetch('/api/reputation/brief');
        if (res.ok) {
          const json = await res.json() as { success?: boolean; data?: { trustScore?: { overall?: number } } };
          if (!cancelled && json.success && json.data?.trustScore?.overall !== undefined) {
            setTrustScore(`${json.data.trustScore.overall}/100`);
          }
        }
      } catch {
        if (!cancelled) { setTrustScore('N/A'); }
      }
    }

    void fetchBriefs();
    return () => { cancelled = true; };
  }, [authFetch]);

  // Calculate counts from live data
  const functionalCount = metrics?.functionalAgents ?? 0;
  const executingCount = metrics?.executingAgents ?? 0;
  const managerCount = agents.length;

  // Status color mapping
  const getStatusColor = (status: SystemAgentStatus['status']) => {
    switch (status) {
      case 'FUNCTIONAL':
        return 'bg-[var(--color-success)]';
      case 'EXECUTING':
        return 'bg-[var(--color-primary)] animate-pulse';
      case 'SHELL':
        return 'bg-[var(--color-warning)]';
      case 'GHOST':
        return 'bg-[var(--color-text-disabled)]';
      default:
        return 'bg-[var(--color-text-secondary)]';
    }
  };

  // Health indicator color
  const getHealthColor = (health: typeof overallHealth) => {
    switch (health) {
      case 'HEALTHY':
        return 'text-[var(--color-success)]';
      case 'DEGRADED':
        return 'text-[var(--color-warning)]';
      case 'CRITICAL':
      case 'OFFLINE':
        return 'text-[var(--color-error)]';
      default:
        return 'text-[var(--color-text-secondary)]';
    }
  };

  // Loading state
  if (loading) {
    return (
      <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Agent Swarm</h3>
          <div className="w-4 h-4 border-2 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin" />
        </div>
        <div className="animate-pulse space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 h-16" />
            <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 h-16" />
            <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 h-16" />
          </div>
          {!compact && (
            <div className="space-y-2">
              {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bg-[var(--color-bg-primary)] rounded-lg h-10" />
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Error state with retry
  if (error && agents.length === 0) {
    return (
      <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Agent Swarm</h3>
          <span className="text-xs text-[var(--color-error)]">Offline</span>
        </div>
        <div className="text-center py-4">
          <p className="text-sm text-[var(--color-text-secondary)] mb-3">
            Unable to connect to swarm
          </p>
          <button
            onClick={() => void refresh()}
            disabled={isRefreshing}
            className="px-4 py-2 text-sm bg-[var(--color-primary)] text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {isRefreshing ? 'Retrying...' : 'Retry'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Agent Swarm</h3>
          {overallHealth && (
            <span className={`text-xs font-medium ${getHealthColor(overallHealth)}`}>
              {overallHealth}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <span className="text-xs text-[var(--color-text-disabled)]">
              {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <Link
            href="/workforce"
            className="text-sm text-[var(--color-primary)] hover:underline"
          >
            Control Center
          </Link>
        </div>
      </div>

      {/* Swarm Summary - Live Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[var(--color-success)]">
            {functionalCount}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">Functional</div>
        </div>
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary)]">
            {executingCount}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">Active</div>
        </div>
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">
            {managerCount || TOTAL_MANAGERS}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">Managers</div>
        </div>
      </div>

      {/* Business Metrics - Commerce & Trust */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[var(--color-success)]">
            {commerceMrr}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">Commerce MRR</div>
        </div>
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-center">
          <div className="text-lg font-bold text-[var(--color-primary)]">
            {trustScore}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)]">Trust Score</div>
        </div>
      </div>

      {/* Expanded View */}
      {!compact && (
        <>
          {/* Agent List - Live Data (Full Swarm) */}
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {agents.length > 0 ? (
              agents.map((agent) => (
                <div
                  key={agent.id}
                  className="flex items-center justify-between p-2 bg-[var(--color-bg-primary)] rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                    <span className="text-sm text-[var(--color-text-primary)]">{agent.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {agent.activeWorkloads > 0 && (
                      <span className="text-xs text-[var(--color-primary)]">
                        {agent.activeWorkloads} tasks
                      </span>
                    )}
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {agent.status}
                    </span>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center py-4 text-sm text-[var(--color-text-secondary)]">
                No agents available
              </div>
            )}
          </div>

          {/* Saga Metrics */}
          {metrics && metrics.activeSagas > 0 && (
            <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
              <div className="flex items-center justify-between text-xs text-[var(--color-text-secondary)]">
                <span>Active Workflows: {metrics.activeSagas}</span>
                <span>Success Rate: {(metrics.successRate * 100).toFixed(0)}%</span>
              </div>
            </div>
          )}

          {/* Quick Execute */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <button
              onClick={() => void refresh()}
              disabled={isRefreshing}
              className="w-full py-2.5 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium hover:bg-[var(--color-bg-elevated)] transition-colors disabled:opacity-50"
            >
              {isRefreshing ? 'Refreshing...' : 'Refresh Status'}
            </button>
          </div>
        </>
      )}

      {/* Compact View */}
      {compact && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <div className={`w-2 h-2 rounded-full ${getHealthColor(overallHealth)}`} />
          <span>
            {functionalCount} of {TOTAL_AGENTS} agents ready
          </span>
          {error && (
            <span className="text-xs text-[var(--color-warning)]">(stale)</span>
          )}
        </div>
      )}
    </div>
  );
}
