'use client';


import React, { useState, useCallback, useMemo, memo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import {
  useSystemStatus,
  type SystemAgentStatus,
  type AgentTier,
} from '@/hooks/useSystemStatus';

// ============================================================================
// TYPES
// ============================================================================

type ViewMode = 'grid' | 'hierarchy';
type FilterTier = 'all' | AgentTier;

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
      case 'FUNCTIONAL': return '#22c55e';
      case 'EXECUTING': return '#6366f1';
      case 'SHELL': return '#f59e0b';
      case 'GHOST': return '#666';
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
      case 'HEALTHY': return '#22c55e';
      case 'DEGRADED': return '#f59e0b';
      case 'OFFLINE': return '#ef4444';
    }
  };

  const getTierBadge = (tier: AgentTier) => {
    switch (tier) {
      case 'L1': return { label: 'CEO', color: '#a855f7', bg: 'rgba(168, 85, 247, 0.1)' };
      case 'L2': return { label: 'MGR', color: '#3b82f6', bg: 'rgba(59, 130, 246, 0.1)' };
      case 'L3': return { label: 'SPL', color: '#10b981', bg: 'rgba(16, 185, 129, 0.1)' };
    }
  };

  const tierBadge = getTierBadge(agent.tier);

  return (
    <div
      style={{
        backgroundColor: 'rgba(26, 26, 26, 0.8)',
        border: `1px solid ${agent.status === 'EXECUTING' ? '#6366f1' : '#333'}`,
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
          <div style={{ minWidth: 0 }}>
            <h3 style={{
              color: '#fff',
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
              <span style={{
                color: getStatusColor(agent.status),
                fontSize: '0.625rem',
                fontWeight: '600',
                letterSpacing: '0.05em',
              }}>
                {getStatusLabel(agent.status)}
              </span>
              <span style={{
                width: '1px',
                height: '10px',
                backgroundColor: '#444',
              }} />
              <span style={{
                width: '6px',
                height: '6px',
                backgroundColor: getHealthColor(agent.health),
                borderRadius: '50%',
              }} />
              <span style={{
                color: '#666',
                fontSize: '0.625rem',
              }}>
                {agent.health}
              </span>
            </div>
          </div>
        </div>

        {/* Active Workloads Badge */}
        {agent.activeWorkloads > 0 && (
          <span style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: 'rgba(99, 102, 241, 0.1)',
            border: '1px solid #6366f1',
            borderRadius: '0.25rem',
            color: '#6366f1',
            fontSize: '0.625rem',
            fontWeight: '600',
          }}>
            {agent.activeWorkloads} active
          </span>
        )}
      </div>

      {/* Role Description */}
      <p style={{
        color: '#999',
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
                backgroundColor: '#0a0a0a',
                borderRadius: '0.25rem',
                color: '#666',
                fontSize: '0.625rem',
              }}
            >
              {cap}
            </span>
          ))}
          {agent.capabilities.length > 3 && (
            <span style={{
              padding: '0.25rem 0.5rem',
              color: '#666',
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
        <button
          onClick={() => onExecute(agent.id)}
          disabled={agent.status === 'GHOST' || agent.status === 'SHELL'}
          style={{
            flex: 1,
            padding: '0.5rem',
            backgroundColor: agent.status === 'FUNCTIONAL' || agent.status === 'EXECUTING'
              ? 'rgba(34, 197, 94, 0.1)'
              : '#1a1a1a',
            border: agent.status === 'FUNCTIONAL' || agent.status === 'EXECUTING'
              ? '1px solid #22c55e'
              : '1px solid #333',
            borderRadius: '0.375rem',
            color: agent.status === 'FUNCTIONAL' || agent.status === 'EXECUTING'
              ? '#22c55e'
              : '#666',
            fontSize: '0.75rem',
            cursor: agent.status === 'GHOST' || agent.status === 'SHELL' ? 'not-allowed' : 'pointer',
            fontWeight: '500',
          }}
        >
          Execute
        </button>
        <button
          onClick={() => onConfigure(agent.id)}
          style={{
            flex: 1,
            padding: '0.5rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            color: '#999',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Configure
        </button>
        <button
          onClick={() => onViewLogs(agent.id)}
          style={{
            flex: 1,
            padding: '0.5rem',
            backgroundColor: '#1a1a1a',
            border: '1px solid #333',
            borderRadius: '0.375rem',
            color: '#999',
            fontSize: '0.75rem',
            cursor: 'pointer',
          }}
        >
          Logs
        </button>
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
      backgroundColor: 'rgba(26, 26, 26, 0.5)',
      border: '1px solid #333',
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
          <span style={{ color: '#fff', fontSize: '1rem', fontWeight: '600' }}>
            {title}
          </span>
          <span style={{
            padding: '0.25rem 0.5rem',
            backgroundColor: 'rgba(255, 255, 255, 0.05)',
            borderRadius: '0.25rem',
            color: '#666',
            fontSize: '0.75rem',
          }}>
            {functionalCount}/{agents.length} active
          </span>
        </div>
        <span style={{
          color: '#666',
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
 * Workforce Command Center - Full 47-Agent Swarm Dashboard
 *
 * Displays live telemetry from the MASTER_ORCHESTRATOR including:
 * - 1 Orchestrator (L1 Swarm CEO)
 * - 9 Managers (L2 Domain Commanders)
 * - 37 Specialists (L3 Workers)
 */
export default function WorkforceCommandCenterPage() {
  const router = useRouter();
  const { user: _user } = useAuth();

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('hierarchy');
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['L1', 'L2', 'L3'])
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
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{
            width: '48px',
            height: '48px',
            border: '3px solid #333',
            borderTopColor: '#6366f1',
            borderRadius: '50%',
            animation: 'spin 1s linear infinite',
            margin: '0 auto 1rem',
          }} />
          <p style={{ color: '#666' }}>Loading swarm telemetry...</p>
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
        background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}>
        <div style={{
          textAlign: 'center',
          padding: '2rem',
          backgroundColor: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid #ef4444',
          borderRadius: '1rem',
          maxWidth: '400px',
        }}>
          <p style={{ color: '#ef4444', marginBottom: '1rem' }}>
            Failed to connect to swarm
          </p>
          <p style={{ color: '#666', fontSize: '0.875rem', marginBottom: '1rem' }}>
            {error}
          </p>
          <button
            onClick={() => void refresh()}
            disabled={isRefreshing}
            style={{
              padding: '0.75rem 1.5rem',
              backgroundColor: '#ef4444',
              border: 'none',
              borderRadius: '0.5rem',
              color: '#fff',
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
      background: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0f0f0f 100%)',
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

      <div style={{ maxWidth: '1600px', margin: '0 auto' }}>
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
              color: '#fff',
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
                    ? 'rgba(34, 197, 94, 0.1)'
                    : overallHealth === 'DEGRADED'
                    ? 'rgba(245, 158, 11, 0.1)'
                    : 'rgba(239, 68, 68, 0.1)',
                  border: `1px solid ${
                    overallHealth === 'HEALTHY' ? '#22c55e'
                    : overallHealth === 'DEGRADED' ? '#f59e0b'
                    : '#ef4444'
                  }`,
                  borderRadius: '0.5rem',
                  color: overallHealth === 'HEALTHY' ? '#22c55e'
                    : overallHealth === 'DEGRADED' ? '#f59e0b'
                    : '#ef4444',
                  fontSize: '0.75rem',
                  fontWeight: '600',
                }}>
                  {overallHealth}
                </span>
              )}
            </h1>
            <p style={{ color: '#666', fontSize: '0.875rem' }}>
              Live telemetry from the 47-agent AI swarm • Last updated: {lastUpdated?.toLocaleTimeString() ?? 'Never'}
            </p>
          </div>

          {/* Controls */}
          <div style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
            {/* View Toggle */}
            <div style={{
              display: 'flex',
              backgroundColor: '#1a1a1a',
              borderRadius: '0.5rem',
              border: '1px solid #333',
              overflow: 'hidden',
            }}>
              <button
                onClick={() => setViewMode('hierarchy')}
                style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: viewMode === 'hierarchy' ? '#333' : 'transparent',
                  border: 'none',
                  color: viewMode === 'hierarchy' ? '#fff' : '#666',
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
                  backgroundColor: viewMode === 'grid' ? '#333' : 'transparent',
                  border: 'none',
                  color: viewMode === 'grid' ? '#fff' : '#666',
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
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '0.5rem',
                color: '#fff',
                fontSize: '0.875rem',
                cursor: 'pointer',
              }}
            >
              <option value="all">All Tiers ({agents.length})</option>
              <option value="L1">L1 - Orchestrator ({metrics?.byTier?.L1?.total ?? 1})</option>
              <option value="L2">L2 - Managers ({metrics?.byTier?.L2?.total ?? 9})</option>
              <option value="L3">L3 - Specialists ({metrics?.byTier?.L3?.total ?? 37})</option>
            </select>

            {/* Refresh Button */}
            <button
              onClick={() => void refresh()}
              disabled={isRefreshing}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'rgba(99, 102, 241, 0.1)',
                border: '1px solid #6366f1',
                borderRadius: '0.5rem',
                color: '#6366f1',
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
                    border: '2px solid #6366f1',
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
            { label: 'Total Agents', value: agents.length.toString(), color: '#6366f1', icon: '🤖' },
            { label: 'Functional', value: `${activeCount}/${agents.length}`, color: '#22c55e', icon: '✅' },
            { label: 'Executing', value: executingCount.toString(), color: '#a855f7', icon: '⚡' },
            { label: 'Commands', value: totalTasks.toLocaleString(), color: '#f59e0b', icon: '📊' },
            { label: 'Success Rate', value: `${successRate.toFixed(0)}%`, color: '#10b981', icon: '🎯' },
          ].map((stat, i) => (
            <div
              key={i}
              style={{
                backgroundColor: 'rgba(26, 26, 26, 0.8)',
                border: '1px solid #333',
                borderRadius: '1rem',
                padding: '1.25rem',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <span style={{ fontSize: '1.25rem' }}>{stat.icon}</span>
                <span style={{ color: '#666', fontSize: '0.75rem' }}>{stat.label}</span>
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
                color="#a855f7"
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
                color="#3b82f6"
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
                      color="#10b981"
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
            backgroundColor: 'rgba(245, 158, 11, 0.1)',
            border: '1px solid #f59e0b',
            borderRadius: '0.5rem',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <span style={{ color: '#f59e0b', fontSize: '0.875rem' }}>
              ⚠️ Showing stale data - connection issue: {error}
            </span>
            <button
              onClick={() => void refresh()}
              style={{
                padding: '0.375rem 0.75rem',
                backgroundColor: '#f59e0b',
                border: 'none',
                borderRadius: '0.25rem',
                color: '#000',
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
