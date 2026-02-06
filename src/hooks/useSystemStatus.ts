/**
 * useSystemStatus Hook
 *
 * Polls the /api/system/status endpoint to provide live telemetry
 * from the MASTER_ORCHESTRATOR to Dashboard components.
 *
 * Features:
 * - Full 47-agent swarm hierarchy (1 orchestrator + 9 managers + 37 specialists)
 * - Configurable polling interval (default 30s)
 * - Automatic error recovery
 * - Loading and error states
 * - Manual refresh capability
 * - Hierarchical data access (by tier)
 *
 * @module hooks/useSystemStatus
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import type {
  SystemStatusResponse,
  SystemAgentStatus,
  AgentTier,
} from '@/app/api/system/status/route';

// ============================================================================
// TYPES
// ============================================================================

export interface UseSystemStatusOptions {
  /** Polling interval in milliseconds (default: 30000) */
  pollingInterval?: number;
  /** Whether to enable polling (default: true) */
  enabled?: boolean;
}

export interface UseSystemStatusReturn {
  /** Array of all 47 agent statuses */
  agents: SystemAgentStatus[];
  /** Hierarchical breakdown of agents by tier */
  hierarchy: {
    orchestrator: SystemAgentStatus | null;
    managers: SystemAgentStatus[];
    specialists: SystemAgentStatus[];
  };
  /** Overall system health */
  overallHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | null;
  /** System metrics including by-tier breakdown */
  metrics: SystemStatusResponse['metrics'] | null;
  /** Recent insights from agents */
  insights: SystemStatusResponse['insights'];
  /** Loading state for initial fetch */
  loading: boolean;
  /** Error message if fetch failed */
  error: string | null;
  /** Connection error for 401/403 responses */
  connectionError: 'unauthorized' | 'forbidden' | null;
  /** Whether the user is authenticated */
  isAuthenticated: boolean;
  /** Timestamp of last successful fetch */
  lastUpdated: Date | null;
  /** Manual refresh function */
  refresh: () => Promise<void>;
  /** Whether currently refreshing */
  isRefreshing: boolean;
  /** Get agents filtered by tier */
  getAgentsByTier: (tier: AgentTier) => SystemAgentStatus[];
  /** Get agents filtered by parent manager */
  getAgentsByManager: (managerId: string) => SystemAgentStatus[];
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
  byTier: {
    L1: { total: 0, functional: 0 },
    L2: { total: 0, functional: 0 },
    L3: { total: 0, functional: 0 },
  },
};

// ============================================================================
// HOOK IMPLEMENTATION
// ============================================================================

/**
 * Hook to fetch and poll system status from the Master Orchestrator
 */
/** Empty hierarchy for initial state */
const EMPTY_HIERARCHY = {
  orchestrator: null,
  managers: [],
  specialists: [],
};

export function useSystemStatus(
  options: UseSystemStatusOptions = {}
): UseSystemStatusReturn {
  const {
    pollingInterval = DEFAULT_POLLING_INTERVAL,
    enabled = true,
  } = options;

  // State
  const [agents, setAgents] = useState<SystemAgentStatus[]>([]);
  const [hierarchy, setHierarchy] = useState<UseSystemStatusReturn['hierarchy']>(EMPTY_HIERARCHY);
  const [overallHealth, setOverallHealth] = useState<
    'HEALTHY' | 'DEGRADED' | 'CRITICAL' | 'OFFLINE' | null
  >(null);
  const [metrics, setMetrics] = useState<SystemStatusResponse['metrics'] | null>(null);
  const [insights, setInsights] = useState<SystemStatusResponse['insights']>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<'unauthorized' | 'forbidden' | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [authInitialized, setAuthInitialized] = useState(false);

  // Refs for cleanup
  const pollingRef = useRef<NodeJS.Timeout | null>(null);
  const mountedRef = useRef(true);
  const authUnsubscribeRef = useRef<(() => void) | null>(null);

  // Derived auth state
  const isAuthenticated = authInitialized && currentUser !== null;

  /**
   * Fetch system status from API with fresh Firebase ID token
   */
  const fetchStatus = useCallback(async (isManualRefresh = false) => {
    if (!mountedRef.current) {
      return;
    }

    // Check if user is authenticated before making request
    if (!auth?.currentUser) {
      if (mountedRef.current) {
        setError('Awaiting Authentication');
        setLoading(false);
        setConnectionError(null);
      }
      return;
    }

    if (isManualRefresh) {
      setIsRefreshing(true);
    }

    try {
      // Get fresh Firebase ID token for each request (prevents token staleness)
      const token = await auth.currentUser.getIdToken();

      if (!token) {
        throw new Error('Failed to retrieve authentication token');
      }

      const response = await fetch('/api/system/status', {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
      });

      if (!mountedRef.current) {
        return;
      }

      // Handle auth-specific errors gracefully
      if (response.status === 401) {
        setConnectionError('unauthorized');
        setError('Authentication required - please sign in');
        return;
      }

      if (response.status === 403) {
        setConnectionError('forbidden');
        setError('Access denied - insufficient permissions');
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
        setHierarchy(data.hierarchy ?? EMPTY_HIERARCHY);
        setOverallHealth(data.overallHealth);
        setMetrics(data.metrics);
        setInsights(data.insights);
        setLastUpdated(new Date());
        setError(null);
        setConnectionError(null);
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
  }, []);

  /**
   * Manual refresh function exposed to consumers
   */
  const refresh = useCallback(async () => {
    await fetchStatus(true);
  }, [fetchStatus]);

  // Auth state listener - reactive to login/logout
  useEffect(() => {
    if (!auth) {
      setAuthInitialized(true);
      return;
    }

    authUnsubscribeRef.current = onAuthStateChanged(auth, (user) => {
      if (mountedRef.current) {
        setCurrentUser(user);
        setAuthInitialized(true);
        // Clear connection errors when auth state changes
        if (user) {
          setConnectionError(null);
        }
      }
    });

    return () => {
      mountedRef.current = false;
      if (authUnsubscribeRef.current) {
        authUnsubscribeRef.current();
        authUnsubscribeRef.current = null;
      }
    };
  }, []);

  // Polling setup - only runs when authenticated and enabled
  useEffect(() => {
    mountedRef.current = true;

    // Stop polling if disabled
    if (!enabled) {
      setLoading(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Wait for auth to initialize
    if (!authInitialized) {
      return;
    }

    // If not authenticated, set awaiting state and don't poll
    if (!currentUser) {
      setError('Awaiting Authentication');
      setLoading(false);
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
      return;
    }

    // Clear error when authenticated and fetch immediately
    setError(null);
    void fetchStatus();

    // Set up polling interval
    if (pollingInterval > 0) {
      pollingRef.current = setInterval(() => {
        void fetchStatus();
      }, pollingInterval);
    }

    // Cleanup: clear interval on unmount or dependency change
    return () => {
      mountedRef.current = false;
      if (pollingRef.current) {
        clearInterval(pollingRef.current);
        pollingRef.current = null;
      }
    };
  }, [enabled, pollingInterval, fetchStatus, authInitialized, currentUser]);

  // Helper function to filter agents by tier
  const getAgentsByTier = useCallback(
    (tier: AgentTier): SystemAgentStatus[] => {
      return agents.filter(agent => agent.tier === tier);
    },
    [agents]
  );

  // Helper function to filter agents by parent manager
  const getAgentsByManager = useCallback(
    (managerId: string): SystemAgentStatus[] => {
      return agents.filter(agent => agent.parentId === managerId);
    },
    [agents]
  );

  return {
    agents,
    hierarchy,
    overallHealth,
    metrics: metrics ?? EMPTY_METRICS,
    insights,
    loading,
    error,
    connectionError,
    isAuthenticated,
    lastUpdated,
    refresh,
    isRefreshing,
    getAgentsByTier,
    getAgentsByManager,
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
export type { SystemAgentStatus, SystemStatusResponse, AgentTier };
