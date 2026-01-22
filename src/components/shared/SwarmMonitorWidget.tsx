'use client';

import Link from 'next/link';

interface AgentStatus {
  id: string;
  name: string;
  status: 'FUNCTIONAL' | 'SHELL' | 'GHOST' | 'EXECUTING';
  lastActivity?: string;
}

interface SwarmMonitorWidgetProps {
  compact?: boolean;
  agents?: AgentStatus[];
}

const SAMPLE_AGENTS: AgentStatus[] = [
  { id: 'MARKETING_MANAGER', name: 'Marketing Manager', status: 'FUNCTIONAL' },
  { id: 'TIKTOK_EXPERT', name: 'TikTok Expert', status: 'FUNCTIONAL' },
  { id: 'TWITTER_EXPERT', name: 'Twitter/X Expert', status: 'FUNCTIONAL' },
  { id: 'COMPETITOR_ANALYST', name: 'Competitor Researcher', status: 'FUNCTIONAL' },
  { id: 'INVENTORY_MANAGER', name: 'Inventory Manager', status: 'FUNCTIONAL' },
];

export function SwarmMonitorWidget({ compact = false, agents = SAMPLE_AGENTS }: SwarmMonitorWidgetProps) {
  const functionalCount = agents.filter(a => a.status === 'FUNCTIONAL' || a.status === 'EXECUTING').length;
  const executingCount = agents.filter(a => a.status === 'EXECUTING').length;

  const getStatusColor = (status: AgentStatus['status']) => {
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

  return (
    <div className="bg-[var(--color-bg-paper)] border border-[var(--color-border)] rounded-xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-[var(--color-text-primary)]">Agent Swarm</h3>
        <Link href="/admin/swarm" className="text-sm text-[var(--color-primary)] hover:underline">
          Control Center
        </Link>
      </div>

      {/* Swarm Summary */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[var(--color-success)]">35</div>
          <div className="text-xs text-[var(--color-text-secondary)]">Functional</div>
        </div>
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[var(--color-primary)]">{executingCount}</div>
          <div className="text-xs text-[var(--color-text-secondary)]">Active</div>
        </div>
        <div className="bg-[var(--color-bg-primary)] rounded-lg p-3 text-center">
          <div className="text-2xl font-bold text-[var(--color-text-primary)]">9</div>
          <div className="text-xs text-[var(--color-text-secondary)]">Managers</div>
        </div>
      </div>

      {!compact && (
        <>
          {/* Agent List */}
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {agents.slice(0, 5).map((agent) => (
              <div
                key={agent.id}
                className="flex items-center justify-between p-2 bg-[var(--color-bg-primary)] rounded-lg"
              >
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${getStatusColor(agent.status)}`} />
                  <span className="text-sm text-[var(--color-text-primary)]">{agent.name}</span>
                </div>
                <span className="text-xs text-[var(--color-text-secondary)]">
                  {agent.status}
                </span>
              </div>
            ))}
          </div>

          {/* Quick Execute */}
          <div className="mt-4 pt-4 border-t border-[var(--color-border)]">
            <button className="w-full py-2.5 border border-[var(--color-border)] text-[var(--color-text-primary)] rounded-lg text-sm font-medium hover:bg-[var(--color-bg-elevated)] transition-colors">
              Execute Agent Task
            </button>
          </div>
        </>
      )}

      {compact && (
        <div className="flex items-center gap-2 text-sm text-[var(--color-text-secondary)]">
          <div className="w-2 h-2 rounded-full bg-[var(--color-success)]" />
          <span>{functionalCount} of 35 specialists ready</span>
        </div>
      )}
    </div>
  );
}
