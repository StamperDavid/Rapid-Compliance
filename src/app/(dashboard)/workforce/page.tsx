'use client';


import React, { useState, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  useSystemStatus,
  type SystemAgentStatus,
  type AgentTier,
} from '@/hooks/useSystemStatus';
import SubpageNav from '@/components/ui/SubpageNav';
import { DASHBOARD_TABS } from '@/lib/constants/subpage-nav';
import { Tooltip } from '@/components/ui/tooltip';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'grid' | 'hierarchy';
type FilterTier = 'all' | AgentTier | 'STANDALONE';

// ============================================================================
// AGENT CARD COMPONENT (Memoized for performance)
// ============================================================================

interface AgentCardProps {
  agent: SystemAgentStatus;
  onExecute: (agentId: string) => void;
  onConfigure: (agentId: string) => void;
  onViewLogs: (agentId: string) => void;
  compact?: boolean;
}

const AgentCard = memo(function AgentCard({
  agent,
  onExecute,
  onConfigure,
  onViewLogs,
  compact = false,
}: AgentCardProps) {
  const getStatusColor = (status: SystemAgentStatus['status']) => {
    switch (status) {
      case 'FUNCTIONAL': return 'var(--color-success)';
      case 'EXECUTING': return 'var(--color-primary)';
      case 'SHELL': return 'var(--color-warning)';
      case 'GHOST': return 'var(--color-text-disabled)';
    }
  };

  const getStatusLabel = (status: SystemAgentStatus['status']) => {
    switch (status) {
      case 'FUNCTIONAL': return 'READY';
      case 'EXECUTING': return 'ACTIVE';
      case 'SHELL': return 'SHELL';
      case 'GHOST': return 'GHOST';
    }
  };

  const getHealthColor = (health: SystemAgentStatus['health']) => {
    switch (health) {
      case 'HEALTHY': return 'var(--color-success)';
      case 'DEGRADED': return 'var(--color-warning)';
      case 'OFFLINE': return 'var(--color-error)';
    }
  };

  const getTierBadge = (tier: AgentTier) => {
    switch (tier) {
      case 'L1': return { label: 'CEO', color: 'var(--color-secondary)', bg: 'rgba(var(--color-secondary-rgb), 0.1)' };
      case 'L2': return { label: 'MGR', color: 'var(--color-info)', bg: 'rgba(var(--color-info-rgb), 0.1)' };
      case 'L3': return { label: 'SPL', color: 'var(--color-success)', bg: 'rgba(var(--color-success-rgb), 0.1)' };
      case 'STANDALONE': return { label: 'SOLO', color: 'var(--color-warning)', bg: 'rgba(var(--color-warning-rgb), 0.1)' };
    }
  };

  const tierBadge = getTierBadge(agent.tier);

  const tierTooltips: Record<AgentTier, string> = {
    L1: 'Level 1 — Master Orchestrator. Routes goals to domain managers.',
    L2: 'Level 2 — Domain Manager. Commands specialists in a specific area.',
    L3: 'Level 3 — Specialist. Executes specific tasks within a domain.',
    STANDALONE: 'Standalone — Operates independently outside the swarm hierarchy.',
  };

  const statusTooltips: Record<SystemAgentStatus['status'], string> = {
    FUNCTIONAL: 'Agent is functional and ready to accept tasks.',
    EXECUTING: 'Agent is currently executing a task.',
    SHELL: 'Agent structure exists but implementation is incomplete.',
    GHOST: 'Agent is defined but not yet built.',
  };

  const healthTooltips: Record<SystemAgentStatus['health'], string> = {
    HEALTHY: 'Agent is operating normally.',
    DEGRADED: 'Agent is operational but experiencing issues.',
    OFFLINE: 'Agent is not responding.',
  };

  return (
    <div
      style={{
        backgroundColor: 'rgba(var(--color-bg-elevated-rgb), 0.8)',
        border: `1px solid ${agent.status === 'EXECUTING' ? 'var(--color-primary)' : 'var(--color-border-strong)'}`,
        borderRadius: '1rem',
        padding: compact ? '1rem' : '1.5rem',
        opacity: agent.status === 'GHOST' ? 0.6 : 1,
        transition: 'border-color 0.2s, transform 0.2s',
      }}
    >
      {/* Agent Header */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: compact ? '0.75rem' : '1rem',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flex: 1 }}>
          {/* Tier Badge */}
          <Tooltip content={tierTooltips[agent.tier]} position="top">
            <span style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: tierBadge.bg,
              border: `1px solid ${tierBadge.color}`,
              borderRadius: '0.25rem',
              color: tierBadge.color,
              fontSize: '0.625rem',
              fontWeight: '700',
              letterSpacing: '0.05em',
            }}>
              {tierBadge.label}
            </span>
          </Tooltip>
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              color: 'var(--color-text-primary)',
              fontSize: compact ? '0.875rem' : '1rem',
              fontWeight: '600',
              margin: 0,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}>
              {agent.name}
            </h3>
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem',
              marginTop: '0.25rem',
            }}>
              <span style={{
                width: '6px',
                height: '6px',
                backgroundColor: getStatusColor(agent.status),
                borderRadius: '50%',
                animation: agent.status === 'EXECUTING' ? 'pulse 2s infinite' : 'none',
              }} />
              <Tooltip content={statusTooltips[agent.status]} position="top">
                <span style={{
                  color: getStatusColor(agent.status),
                  fontSize: '0.625rem',
                  fontWeight: '600',
                  letterSpacing: '0.05em',
                }}>
                  {getStatusLabel(agent.status)}
                </span>
              </Tooltip>
              <span style={{
                width: '1px',
                height: '10px',
                backgroundColor: 'var(--color-border-main)',
              }} />
              <span style={{
                width: '6px',
                height: '6px',
                backgroundColor: getHealthColor(agent.health),
                borderRadius: '50%',
              }} />
              <Tooltip content={healthTooltips[agent.health]} position="top">
                <span style={{
                  color: 'var(--color-text-disabled)',
                  fontSize: '0.625rem',
                }}>
                  {agent.health}
                </span>
              </Tooltip>
            </div>
          </div>
        </div>

        {/* Active Workloads Badge */}
        {agent.activeWorkloads > 0 && (
          <span style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)',
            border: '1px solid var(--color-primary)',
            borderRadius: '0.25rem',
            color: 'var(--color-primary)',
            fontSize: '0.625rem',
            fontWeight: '600',
          }}>
            {agent.activeWorkloads} active
          </span>
        )}
      </div>

      {/* Role Description */}
      <p style={{
        color: 'var(--color-text-secondary)',
        fontSize: '0.75rem',
        lineHeight: '1.5',
        marginBottom: compact ? '0.75rem' : '1rem',
        display: compact ? 'none' : 'block',
      }}>
        {agent.role}
      </p>

      {/* Capabilities */}
      {!compact && agent.capabilities.length > 0 && (
        <div style={{
          display: 'flex',
          flexWrap: 'wrap',
          gap: '0.375rem',
          marginBottom: '1rem',
        }}>
          {agent.capabilities.slice(0, 3).map((cap, i) => (
            <span
              key={i}
              style={{
                padding: '0.25rem 0.5rem',
                backgroundColor: 'var(--color-bg-main)',
                borderRadius: '0.25rem',
                color: 'var(--color-text-disabled)',
                fontSize: '0.625rem',
              }}
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span style={{
              padding: '0.25rem 0.5rem',
              color: 'var(--color-text-disabled)',
              fontSize: '0.625rem',
            }}>
              +{agent.capabilities.length - 3} more
            </span>
          )}
        </div>
      )}

      {/* Quick Actions */}
      <div style={{
        display: 'flex',
        gap: '0.5rem',
      }}>
        <Tooltip content="Trigger this agent to run a task." position="bottom">
          <button
            onClick={() => onExecute(agent.id)}
            disabled={agent.status === 'GHOST' || agent.status === 'SHELL'}
            style={{
              flex: 1,
              padding: '0.5rem',
              backgroundColor: agent.status === 'FUNCTIONAL' || agent.status === 'EXECUTING'
                ? 'rgba(var(--color-success-rgb), 0.1)'
                : 'var(--color-bg-paper)',
              border: agent.status === 'FUNCTIONAL' || agent.status === 'EXECUTING'
                ? '1px solid var(--color-success)'
                : '1px solid var(--color-border-strong)',
              borderRadius: '0.375rem',
              color: agent.status === 'FUNCTIONAL' || agent.status === 'EXECUTING'
                ? 'var(--color-success)'
                : 'var(--color-text-disabled)',
              fontSize: '0.75rem',
              cursor: agent.status === 'GHOST' || agent.status === 'SHELL' ? 'not-allowed' : 'pointer',
              fontWeight: '500',
            }}
          >
            Execute
          </button>
        </Tooltip>
        <Tooltip content="Edit this agent's settings and parameters." position="bottom">
          <button
            onClick={() => onConfigure(agent.id)}
            style={{
              flex: 1,
              padding: '0.5rem',
              backgroundColor: 'var(--color-bg-paper)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-secondary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Configure
          </button>
        </Tooltip>
        <Tooltip content="View this agent's execution history." position="bottom">
          <button
            onClick={() => onViewLogs(agent.id)}
            style={{
              flex: 1,
              padding: '0.5rem',
              backgroundColor: 'var(--color-bg-paper)',
              border: '1px solid var(--color-border-strong)',
              borderRadius: '0.375rem',
              color: 'var(--color-text-secondary)',
              fontSize: '0.75rem',
              cursor: 'pointer',
            }}
          >
            Logs
          </button>
        </Tooltip>
      </div>
    </div>
  );
});

// ============================================================================
// HIERARCHY SECTION COMPONENT
// ============================================================================

interface HierarchySectionProps {
  title: string;
  agents: SystemAgentStatus[];
  color: string;
  isExpanded: boolean;
  onToggle: () => void;
  onExecute: (agentId: string) => void;
  onConfigure: (agentId: string) => void;
  onViewLogs: (agentId: string) => void;
}

const HierarchySection = memo(function HierarchySection({
  title,
  agents,
  color,
  isExpanded,
  onToggle,
  onExecute,
  onConfigure,
  onViewLogs,
}: HierarchySectionProps) {
  const functionalCount = agents.filter(
    a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING'
  ).length;

  return (
    <div style={{
      backgroundColor: 'rgba(var(--color-bg-elevated-rgb), 0.5)',
      border: '1px solid var(--color-border-strong)',
      borderRadius: '1rem',
      marginBottom: '1rem',
      overflow: 'hidden',
    }}>
      {/* Section Header */}
      <button
        onClick={onToggle}
        style={{
          width: '100%',
          padding: '1rem 1.5rem',
          backgroundColor: 'transparent',
          border: 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          cursor: 'pointer',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{
            width: '4px',
            height: '24px',
            backgroundColor: color,
            borderRadius: '2px',
          }} />
          <span style={{ color: 'var(--color-text-primary)', fontSize: '1rem', fontWeight: '600' }}>
            {title}
          </span>
          <span style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: 'rgba(var(--color-text-primary-rgb), 0.05)',
            borderRadius: '0.25rem',
            color: 'var(--color-text-disabled)',
            fontSize: '0.75rem',
          }}>
            {functionalCount}/{agents.length} active
          </span>
        </div>
        <span style={{
          color: 'var(--color-text-disabled)',
          fontSize: '1.25rem',
          transform: isExpanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 0.2s',
        }}>
          ▼
        </span>
      </button>

      {/* Section Content */}
      {isExpanded && (
        <div style={{
          padding: '0 1rem 1rem',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))',
          gap: '0.75rem',
        }}>
          {agents.map(agent => (
            <AgentCard
              key={agent.id}
              agent={agent}
              onExecute={onExecute}
              onConfigure={onConfigure}
              onViewLogs={onViewLogs}
              compact
            />
          ))}
        </div>
      )}
    </div>
  );
});

// ============================================================================
// MAIN COMPONENT
// ============================================================================

/**
 * Workforce Command Center - Full 52-Agent Dashboard
 *
 * Displays live telemetry from the MASTER_ORCHESTRATOR including:
 * - 1 Orchestrator (L1 Swarm CEO)
 * - 9 Managers (L2 Domain Commanders)
 * - 38 Specialists (L3 Workers)
 * - 4 Standalone Agents (Jasper, Voice, Autonomous Posting, Chat Session)
 */
export default function WorkforceCommandCenterPage() {
  const router = useRouter();
  const { user: _user } = useAuth();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchy');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['L1', 'L2', 'L3', 'STANDALONE'])
  );

  // Live data from Master Orchestrator
  const {
    agents,
    hierarchy,
    metrics,
    overallHealth,
    loading,
    error,
    lastUpdated,
    refresh,
    isRefreshing,
    getAgentsByManager,
  } = useSystemStatus({
    pollingInterval: 30000,
    enabled: true,
  });

  // Filter agents by tier
  const filteredAgents = useMemo(() => {
    if (filterTier === 'all') {return agents;}
    return agents.filter(a => a.tier === filterTier);
  }, [agents, filterTier]);

  // Group specialists by manager for hierarchy view
  const specialistsByManager = useMemo(() => {
    const grouped = new Map<string, SystemAgentStatus[]>();
    if (hierarchy.managers) {
      for (const manager of hierarchy.managers) {
        grouped.set(manager.id, getAgentsByManager(manager.id));
      }
    }
    return grouped;
  }, [hierarchy.managers, getAgentsByManager]);

  // Toggle section expansion
  const toggleSection = useCallback((section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Action handlers
  const handleExecute = useCallback((agentId: string) => {
    // Navigate to execute modal or trigger execution
    router.push(`/workforce/execute?agentId=${agentId}`);
  }, [router]);

  const handleConfigure = useCallback((agentId: string) => {
    // Navigate to agent configuration
    router.push(`/settings/ai-agents/configuration?agentId=${agentId}`);
  }, [router]);

  const handleViewLogs = useCallback((agentId: string) => {
    // Navigate to agent logs
    router.push(`/admin/system/logs?agentId=${agentId}`);
  }, [router]);

  // Calculate summary stats
  const activeCount = metrics?.functionalAgents ?? 0;
  const executingCount = metrics?.executingAgents ?? 0;
  const totalTasks = metrics?.totalCommands ?? 0;
  const successRate = metrics?.successRate ?? 100;

  // Loading state
  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        padding: '2rem',
        background: 'linear-gradient(135deg, var(--color-bg-main) 0%, var(--color-bg-paper) 50%, var(--color-bg-main) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid var(--color-border-strong)',
            borderTopColor: 'var(--color-primary)',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: 'var(--color-text-disabled)' }}>Loading swarm telemetry...</p>
        </div>
        <style>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
          @keyframes pulse {
            0%, 100% { opacity: 1; }
            50% { opacity: 0.5; }
          }
        `}</style>
      </div>
    );
  }

  // Error state
  if (error && agents.length === 0) {
    return (
      <div style={{
        minHeight: '100vh',
        padding: '2rem',
        background: 'linear-gradient(135deg, var(--color-bg-main) 0%, var(--color-bg-paper) 50%, var(--color-bg-main) 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'rgba(var(--color-error-rgb), 0.1)',
          border: '1px solid var(--color-error)',
          borderRadius: '1rem',
          maxWidth: '400px',
        }}>
          <p style={{ color: 'var(--color-error)', marginBottom: '1rem' }}>
            Failed to connect to swarm
          </p>
          <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </p>
          <button
            onClick={() => void refresh()}
            disabled={isRefreshing}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: 'var(--color-error)',
              border: 'none',
              borderRadius: '0.5rem',
              color: 'var(--color-text-primary)',
              fontWeight: '600',
              cursor: 'pointer',
            }}
          >
            {isRefreshing ? 'Retrying...' : 'Retry Connection'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: '100vh',
      padding: '2rem',
      background: 'linear-gradient(135deg, var(--color-bg-main) 0%, var(--color-bg-paper) 50%, var(--color-bg-main) 100%)',
    }}>
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>

      <div>
        <SubpageNav items={DASHBOARD_TABS} />
        {/* Header */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          marginBottom: '2rem',
          flexWrap: 'wrap',
          gap: '1rem',
        }}>
          <div>
            <h1 style={{
              fontSize: '2rem',
              fontWeight: '700',
              color: 'var(--color-text-primary)',
              marginBottom: '0.5rem',
              display: 'flex',
              alignItems: 'center',
              gap: '0.75rem',
            }}>
              <span>🎛️</span> Workforce Command Center
              {overallHealth && (
                <span style={{
                  padding: '0.25rem 0.75rem',
                  backgroundColor: overallHealth === 'HEALTHY'
                    ? 'rgba(var(--color-success-rgb), 0.1)'
                    : overallHealth === 'DEGRADED'
                    ? 'rgba(var(--color-warning-rgb), 0.1)'
                    : 'rgba(var(--color-error-rgb), 0.1)',
                  border: `1px solid ${
                    overallHealth === 'HEALTHY' ? 'var(--color-success)'
                    : overallHealth === 'DEGRADED' ? 'var(--color-warning)'
                    : 'var(--color-error)'
                  }`,
                  borderRadius: '0.5rem',
                  color: overallHealth === 'HEALTHY' ? 'var(--color-success)'
                    : overallHealth === 'DEGRADED' ? 'var(--color-warning)'
                    : 'var(--color-error)',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}>
                  {overallHealth}
                </span>
              )}
            </h1>
            <p style={{ color: 'var(--color-text-disabled)', fontSize: '0.875rem' }}>
              Live telemetry from the 52-agent AI workforce • Last updated: {lastUpdated?.toLocaleTimeString() ?? 'Never'}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* View Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: 'var(--color-bg-paper)',
              borderRadius: '0.5rem',
              border: '1px solid var(--color-border-strong)',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setViewMode('hierarchy')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: viewMode === 'hierarchy' ? 'var(--color-border-strong)' : 'transparent',
                  border: 'none',
                  color: viewMode === 'hierarchy' ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Hierarchy
              </button>
              <button
                onClick={() => setViewMode('grid')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: viewMode === 'grid' ? 'var(--color-border-strong)' : 'transparent',
                  border: 'none',
                  color: viewMode === 'grid' ? 'var(--color-text-primary)' : 'var(--color-text-disabled)',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                }}
              >
                Grid
              </button>
            </div>

            {/* Tier Filter */}
            <select
              value={filterTier}
              onChange={(e) => setFilterTier(e.target.value as FilterTier)}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'var(--color-bg-paper)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '0.5rem',
                color: 'var(--color-text-primary)',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Tiers ({agents.length})</option>
              <option value="L1">L1 - Orchestrator ({metrics?.byTier?.L1?.total ?? 1})</option>
              <option value="L2">L2 - Managers ({metrics?.byTier?.L2?.total ?? 9})</option>
              <option value="L3">L3 - Specialists ({metrics?.byTier?.L3?.total ?? 38})</option>
              <option value="STANDALONE">Standalone ({metrics?.byTier?.STANDALONE?.total ?? 4})</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={() => void refresh()}
              disabled={isRefreshing}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(var(--color-primary-rgb), 0.1)',
                border: '1px solid var(--color-primary)',
                borderRadius: '0.5rem',
                color: 'var(--color-primary)',
                fontSize: '0.875rem',
                fontWeight: '600',
                cursor: isRefreshing ? 'not-allowed' : 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem',
              }}
            >
              {isRefreshing ? (
                <>
                  <span style={{
                    width: '14px',
                    height: '14px',
                    border: '2px solid var(--color-primary)',
                    borderTopColor: 'transparent',
                    borderRadius: '50%',
                    animation: 'spin 1s linear infinite',
                  }} />
                  Refreshing
                </>
              ) : (
                <>🔄 Refresh</>
              )}
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(5, 1fr)',
          gap: '1rem',
          marginBottom: '2rem',
        }}>
          {[
            { label: 'Total Agents', value: agents.length.toString(), color: 'var(--color-primary)', icon: '🤖' },
            { label: 'Functional', value: `${activeCount}/${agents.length}`, color: 'var(--color-success)', icon: '✅' },
            { label: 'Executing', value: executingCount.toString(), color: 'var(--color-secondary)', icon: '⚡' },
            { label: 'Commands', value: totalTasks.toLocaleString(), color: 'var(--color-warning)', icon: '📊' },
            { label: 'Success Rate', value: `${successRate.toFixed(0)}%`, color: 'var(--color-success)', icon: '🎯' },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'rgba(var(--color-bg-elevated-rgb), 0.8)',
                border: '1px solid var(--color-border-strong)',
                borderRadius: '1rem',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{stat.icon}</span>
                <span style={{ color: 'var(--color-text-disabled)', fontSize: '0.75rem' }}>{stat.label}</span>
              </div>
              <div style={{ color: stat.color, fontSize: '1.5rem', fontWeight: '700' }}>
                {stat.value}
              </div>
            </div>
          ))}
        </div>

        {/* Main Content */}
        {viewMode === 'hierarchy' ? (
          // Hierarchy View
          <div>
            {/* L1 - Orchestrator */}
            {(filterTier === 'all' || filterTier === 'L1') && hierarchy.orchestrator && (
              <HierarchySection
                title="🎯 L1 - Master Orchestrator (Swarm CEO)"
                agents={[hierarchy.orchestrator]}
                color="var(--color-secondary)"
                isExpanded={expandedSections.has('L1')}
                onToggle={() => toggleSection('L1')}
                onExecute={handleExecute}
                onConfigure={handleConfigure}
                onViewLogs={handleViewLogs}
              />
            )}

            {/* L2 - Managers */}
            {(filterTier === 'all' || filterTier === 'L2') && hierarchy.managers.length > 0 && (
              <HierarchySection
                title="📋 L2 - Domain Managers (Commanders)"
                agents={hierarchy.managers}
                color="var(--color-info)"
                isExpanded={expandedSections.has('L2')}
                onToggle={() => toggleSection('L2')}
                onExecute={handleExecute}
                onConfigure={handleConfigure}
                onViewLogs={handleViewLogs}
              />
            )}

            {/* L3 - Specialists (grouped by manager) */}
            {(filterTier === 'all' || filterTier === 'L3') && (
              <>
                {hierarchy.managers.map(manager => {
                  const specialists = specialistsByManager.get(manager.id) ?? [];
                  if (specialists.length === 0) {return null;}

                  return (
                    <HierarchySection
                      key={manager.id}
                      title={`🔧 L3 - ${manager.name} Specialists`}
                      agents={specialists}
                      color="var(--color-success)"
                      isExpanded={expandedSections.has(manager.id)}
                      onToggle={() => toggleSection(manager.id)}
                      onExecute={handleExecute}
                      onConfigure={handleConfigure}
                      onViewLogs={handleViewLogs}
                    />
                  );
                })}
              </>
            )}

            {/* Standalone Agents */}
            {(filterTier === 'all' || filterTier === 'STANDALONE') && hierarchy.standalone && hierarchy.standalone.length > 0 && (
              <HierarchySection
                title="⚡ Standalone Agents"
                agents={hierarchy.standalone}
                color="var(--color-warning)"
                isExpanded={expandedSections.has('STANDALONE')}
                onToggle={() => toggleSection('STANDALONE')}
                onExecute={handleExecute}
                onConfigure={handleConfigure}
                onViewLogs={handleViewLogs}
              />
            )}
          </div>
        ) : (
          // Grid View
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
            gap: '1rem',
          }}>
            {filteredAgents.map((agent) => (
              <AgentCard
                key={agent.id}
                agent={agent}
                onExecute={handleExecute}
                onConfigure={handleConfigure}
                onViewLogs={handleViewLogs}
              />
            ))}
          </div>
        )}

        {/* Error Banner (stale data) */}
        {error && agents.length > 0 && (
          <div style={{
            marginTop: '1rem',
            padding: '0.75rem 1rem',
            backgroundColor: 'rgba(var(--color-warning-rgb), 0.1)',
            border: '1px solid var(--color-warning)',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: 'var(--color-warning)', fontSize: '0.875rem' }}>
              ⚠️ Showing stale data - connection issue: {error}
            </span>
            <button
              onClick={() => void refresh()}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: 'var(--color-warning)',
                border: 'none',
                borderRadius: '0.25rem',
                color: 'var(--color-bg-main)',
                fontSize: '0.75rem',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              Retry
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
