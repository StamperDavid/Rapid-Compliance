/**
 * useSystemStatus Hook
 *
 * Polls the /api/system/status endpoint to provide live telemetry
 * from the MASTER_ORCHESTRATOR to Dashboard components.
 *
 * Features:
 * - Configurable polling interval (default 30s)
 * - Automatic error recovery
 * - Loading and error states
 * - Manual refresh capability
 *
 * @module hooks/useSystemStatus
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type {
  SystemStatusResponse,
  SystemAgentStatus,
} from '@/app/api/system/status/route';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSystemStatusOptions {
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
  /** Tenant ID to fetch status for */
  tenantId?: string;
}

export interface UseSystemStatusReturn {
  /** Array of agent statuses */
  agents: SystemAgentStatus[];
  /** Overall system health */
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | null;
  /** System metrics */
  metrics: SystemStatusResponse['metrics'] | null;
  /** Recent insights from agents */
  insights: SystemStatusResponse['insights'];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Timestamp of last successful fetch */
  lastUpdated: Date | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Whether currently refreshing */
  isRefreshing: boolean;
}

// ============================================================================
// DEFAULT VALUES
// ============================================================================

const DEFAULT_POLLING_INTERVAL = 30000; // 30 seconds

const EMPTY_METRICS: SystemStatusResponse['metrics'] = {
  totalAgents: 0,
  functionalAgents: 0,
  executingAgents: 0,
  activeSagas: 0,
  completedSagas: 0,
  failedSagas: 0,
  totalCommands: 0,
  successRate: 0,
  averageResponseTimeMs: 0,
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to fetch and poll system status from the Master Orchestrator
 */
export function useSystemStatus(
  options: UseSystemStatusOptions = {}
): UseSystemStatusReturn {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
    tenantId,
  } = options;

  // State
  const [agents, setAgents] = useState<SystemAgentStatus[]>([]);
  const [overallHealth, setOverallHealth] = useState<
    'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | null
  >(null);
  const [metrics, setMetrics] = useState<SystemStatusResponse['metrics'] | null>(null);
  const [insights, setInsights] = useState<SystemStatusResponse['insights']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Refs for cleanup
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);

  /**
   * Fetch system status from API
   */
  const fetchStatus = useCallback(async (isManualRefresh = false) => {
    if (!mountedRef.current) {
      return;
    }

    if (isManualRefresh) {
      setIsRefreshing(true);
    }

    try {
      const url = tenantId
        ? `/api/system/status?tenantId=${encodeURIComponent(tenantId)}`
        : '/api/system/status';

      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
      });

      if (!mountedRef.current) {
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({})) as { error?: string };
        throw new Error(
          errorData.error ?? `HTTP ${response.status}: ${response.statusText}`
        );
      }

      const data = await response.json() as SystemStatusResponse;

      if (!mountedRef.current) {
        return;
      }

      if (data.success) {
        setAgents(data.agents);
        setOverallHealth(data.overallHealth);
        setMetrics(data.metrics);
        setInsights(data.insights);
        setLastUpdated(new Date());
        setError(null);
      } else {
        throw new Error('API returned unsuccessful response');
      }
    } catch (err: unknown) {
      if (!mountedRef.current) {
        return;
      }

      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch system status';
      setError(errorMessage);

      // On error, keep stale data but update error state
      // Don't clear agents/metrics to prevent UI flicker
    } finally {
      if (mountedRef.current) {
        setLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [tenantId]);

  /**
   * Manual refresh function exposed to consumers
   */
  const refresh = useCallback(async () => {
    await fetchStatus(true);
  }, [fetchStatus]);

  // Initial fetch and polling setup
  useEffect(() => {
    mountedRef.current = true;

    if (!enabled) {
      setLoading(false);
      return;
    }

    // Initial fetch
    void fetchStatus();

    // Set up polling
    if (pollingInterval > 0) {
      pollingRef.current = setInterval(() => {
        void fetchStatus();
      }, pollingInterval);
    }

    // Cleanup
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [enabled, pollingInterval, fetchStatus]);

  return {
    agents,
    overallHealth,
    metrics: metrics ?? EMPTY_METRICS,
    insights,
    loading,
    error,
    lastUpdated,
    refresh,
    isRefreshing,
  };
}

// ============================================================================
// SELECTOR HOOKS (for optimized re-renders)
// ============================================================================

/**
 * Hook to get just the agent list with status
 */
export function useSystemAgents(options?: UseSystemStatusOptions) {
  const { agents, loading, error, refresh } = useSystemStatus(options);
  return { agents, loading, error, refresh };
}

/**
 * Hook to get just the system health status
 */
export function useSystemHealth(options?: UseSystemStatusOptions) {
  const { overallHealth, metrics, loading, error } = useSystemStatus(options);
  return { overallHealth, metrics, loading, error };
}

/**
 * Hook to get just the recent insights
 */
export function useSystemInsights(options?: UseSystemStatusOptions) {
  const { insights, loading, error, refresh } = useSystemStatus(options);
  return { insights, loading, error, refresh };
}

// Re-export types for consumer convenience
export type { SystemAgentStatus, SystemStatusResponse };
