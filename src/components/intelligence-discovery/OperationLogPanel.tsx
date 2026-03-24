/**
 * Operation Log Panel — Right panel showing real-time action audit trail
 *
 * Each action is clickable to open a detail drawer (Phase 5).
 * Shows every scrape, search, extract, and enrich step.
 */

'use client';

import React from 'react';
import {
  Globe,
  Search,
  Cpu,
  RefreshCw,
  CheckCircle,
  XCircle,
  Loader2,
  AlertTriangle,
  Activity,
} from 'lucide-react';
import type { DiscoveryAction, ActionType, DiscoveryOperation } from '@/types/intelligence-discovery';

interface OperationLogPanelProps {
  actions: DiscoveryAction[];
  loading: boolean;
  activeOperation: DiscoveryOperation | null;
}

const ACTION_ICONS: Record<ActionType, React.ElementType> = {
  scrape: Globe,
  search: Search,
  extract: Cpu,
  enrich: RefreshCw,
  validate: CheckCircle,
  error: AlertTriangle,
};

const ACTION_COLORS: Record<ActionType, string> = {
  scrape: 'var(--color-info)',
  search: 'var(--color-primary)',
  extract: 'var(--color-secondary)',
  enrich: 'var(--color-cyan)',
  validate: 'var(--color-success)',
  error: 'var(--color-error)',
};

function StatusIcon({ status }: { status: DiscoveryAction['status'] }) {
  switch (status) {
    case 'running':
      return <Loader2 className="w-3 h-3 text-[var(--color-warning)] animate-spin" />;
    case 'completed':
      return <CheckCircle className="w-3 h-3 text-[var(--color-success)]" />;
    case 'failed':
      return <XCircle className="w-3 h-3 text-[var(--color-error)]" />;
    default:
      return null;
  }
}

function formatDuration(ms: number | null): string {
  if (ms === null) { return '...'; }
  if (ms < 1000) { return `${ms}ms`; }
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  } catch {
    return '';
  }
}

export default function OperationLogPanel({
  actions,
  loading,
  activeOperation,
}: OperationLogPanelProps) {
  return (
    <div className="flex flex-col h-full border-l border-[var(--color-border-light)] bg-[var(--color-bg-paper)]">
      {/* Header */}
      <div className="p-4 border-b border-[var(--color-border-light)]">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-[var(--color-secondary)]/20 flex items-center justify-center">
            <Activity className="w-4 h-4 text-[var(--color-secondary)]" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
              Operation Log
            </h2>
            <p className="text-xs text-[var(--color-text-secondary)]">
              {activeOperation
                ? `${activeOperation.sourceName} — ${activeOperation.status}`
                : 'Select an operation'}
            </p>
          </div>
        </div>
      </div>

      {/* Action feed */}
      <div className="flex-1 overflow-y-auto">
        {!activeOperation && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <Activity className="w-8 h-8 text-[var(--color-text-disabled)] mb-2" />
            <p className="text-xs text-[var(--color-text-disabled)]">
              Start an operation to see the action log here
            </p>
          </div>
        )}

        {activeOperation && actions.length === 0 && !loading && (
          <div className="flex flex-col items-center justify-center h-full text-center px-4">
            <p className="text-xs text-[var(--color-text-disabled)]">
              No actions recorded yet
            </p>
          </div>
        )}

        {loading && actions.length === 0 && (
          <div className="flex items-center justify-center p-8">
            <Loader2 className="w-5 h-5 text-[var(--color-text-disabled)] animate-spin" />
          </div>
        )}

        <div className="divide-y divide-[var(--color-border-light)]">
          {actions.map((action) => {
            const Icon = ACTION_ICONS[action.actionType];
            const color = ACTION_COLORS[action.actionType];

            return (
              <button
                key={action.id}
                className="w-full text-left px-4 py-3 hover:bg-[var(--color-bg-elevated)] transition-colors group"
                title="Click for details (Phase 5)"
              >
                <div className="flex items-start gap-2">
                  <div
                    className="w-6 h-6 rounded flex-shrink-0 flex items-center justify-center mt-0.5"
                    style={{ backgroundColor: `color-mix(in srgb, ${color} 20%, transparent)` }}
                  >
                    <Icon className="w-3 h-3" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="text-xs font-medium text-[var(--color-text-primary)] capitalize">
                        {action.actionType}
                      </span>
                      <StatusIcon status={action.status} />
                      <span className="text-xs text-[var(--color-text-disabled)] ml-auto">
                        {formatDuration(action.durationMs)}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] truncate mt-0.5">
                      {action.data.summary ?? action.sourceUrl}
                    </p>
                    <span className="text-[10px] text-[var(--color-text-disabled)]">
                      {formatTime(action.startedAt)}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Stats footer */}
      {activeOperation && (
        <div className="p-3 border-t border-[var(--color-border-light)] bg-[var(--color-bg-main)]">
          <div className="grid grid-cols-3 gap-2 text-center">
            <div>
              <div className="text-xs font-semibold text-[var(--color-success)]">
                {activeOperation.stats.totalEnriched}
              </div>
              <div className="text-[10px] text-[var(--color-text-disabled)]">Enriched</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--color-info)]">
                {activeOperation.stats.totalFound}
              </div>
              <div className="text-[10px] text-[var(--color-text-disabled)]">Found</div>
            </div>
            <div>
              <div className="text-xs font-semibold text-[var(--color-error)]">
                {activeOperation.stats.totalFailed}
              </div>
              <div className="text-[10px] text-[var(--color-text-disabled)]">Failed</div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
