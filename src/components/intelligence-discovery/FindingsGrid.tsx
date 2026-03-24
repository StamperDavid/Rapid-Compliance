/**
 * FindingsGrid — Center panel showing discovered entities
 *
 * Includes operation picker, filter tabs, scrollable findings list, and bulk action bar.
 */

'use client';

import React, { useState } from 'react';
import {
  ChevronDown,
  Play,
  Loader2,
  Database,
  Filter,
  CheckSquare,
  Square,
} from 'lucide-react';
import type {
  DiscoveryOperation,
  DiscoveryFinding,
  DiscoverySource,
  EnrichmentStatus,
  ApprovalStatus,
} from '@/types/intelligence-discovery';
import FindingRow from './FindingRow';
import FindingsBulkActionBar from './FindingsBulkActionBar';

interface FindingsGridProps {
  // Sources
  sources: DiscoverySource[];
  sourcesLoading: boolean;

  // Operations
  operations: DiscoveryOperation[];
  activeOperation: DiscoveryOperation | null;
  operationsLoading: boolean;
  onSelectOperation: (op: DiscoveryOperation | null) => void;
  onStartOperation: (sourceId: string) => Promise<void>;

  // Findings
  findings: DiscoveryFinding[];
  findingsLoading: boolean;
  findingsHasMore: boolean;
  onLoadMore: () => Promise<void>;

  // Filters
  enrichmentFilter: EnrichmentStatus | 'all';
  approvalFilter: ApprovalStatus | 'all';
  onEnrichmentFilterChange: (f: EnrichmentStatus | 'all') => void;
  onApprovalFilterChange: (f: ApprovalStatus | 'all') => void;

  // Selection
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;

  // Actions
  onApprove: (id: string) => Promise<void>;
  onReject: (id: string) => Promise<void>;
  onEnrich: (id: string) => Promise<void>;
  onBulkApprove: () => Promise<void>;
  onBulkReject: () => Promise<void>;
}

const ENRICHMENT_FILTERS: Array<{ value: EnrichmentStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'in_progress', label: 'Enriching' },
  { value: 'enriched', label: 'Enriched' },
  { value: 'partial', label: 'Partial' },
  { value: 'failed', label: 'Failed' },
];

const APPROVAL_FILTERS: Array<{ value: ApprovalStatus | 'all'; label: string }> = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
];

export default function FindingsGrid({
  sources,
  sourcesLoading,
  operations,
  activeOperation,
  operationsLoading,
  onSelectOperation,
  onStartOperation,
  findings,
  findingsLoading,
  findingsHasMore,
  onLoadMore,
  enrichmentFilter,
  approvalFilter,
  onEnrichmentFilterChange,
  onApprovalFilterChange,
  selectedIds,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onApprove,
  onReject,
  onEnrich,
  onBulkApprove,
  onBulkReject,
}: FindingsGridProps) {
  const [showOpPicker, setShowOpPicker] = useState(false);
  const [showSourcePicker, setShowSourcePicker] = useState(false);

  const allSelected = findings.length > 0 && selectedIds.size === findings.length;

  return (
    <div className="flex flex-col h-full bg-[var(--color-bg-main)]">
      {/* ── Header ──────────────────────────────────────────────────────── */}
      <div className="p-4 border-b border-[var(--color-border-light)] space-y-3">
        {/* Top row: Operation picker + New operation button */}
        <div className="flex items-center gap-2">
          {/* Operation picker */}
          <div className="relative flex-1">
            <button
              onClick={() => setShowOpPicker(!showOpPicker)}
              className="w-full flex items-center justify-between px-3 py-2 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg text-sm text-[var(--color-text-primary)] hover:border-[var(--color-cyan)] transition-colors"
            >
              <span className="truncate">
                {activeOperation
                  ? `${activeOperation.sourceName} — ${activeOperation.status}`
                  : 'Select Operation'}
              </span>
              <ChevronDown className="w-4 h-4 text-[var(--color-text-disabled)] ml-2 flex-shrink-0" />
            </button>

            {showOpPicker && (
              <div className="absolute left-0 right-0 top-full mt-1 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                {operationsLoading && (
                  <div className="px-3 py-2 text-xs text-[var(--color-text-disabled)]">Loading...</div>
                )}
                {operations.length === 0 && !operationsLoading && (
                  <div className="px-3 py-2 text-xs text-[var(--color-text-disabled)]">No operations yet</div>
                )}
                {operations.map((op) => (
                  <button
                    key={op.id}
                    onClick={() => { onSelectOperation(op); setShowOpPicker(false); }}
                    className={`w-full text-left px-3 py-2 text-sm hover:bg-[var(--color-bg-main)] transition-colors ${
                      activeOperation?.id === op.id ? 'text-[var(--color-cyan)]' : 'text-[var(--color-text-primary)]'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="truncate">{op.sourceName}</span>
                      <span className={`text-xs ml-2 ${
                        op.status === 'completed' ? 'text-[var(--color-success)]'
                          : op.status === 'running' ? 'text-[var(--color-warning)]'
                            : op.status === 'failed' ? 'text-[var(--color-error)]'
                              : 'text-[var(--color-text-disabled)]'
                      }`}>
                        {op.status}
                      </span>
                    </div>
                    <div className="text-[10px] text-[var(--color-text-disabled)]">
                      {op.stats.totalFound} found &middot; {op.stats.totalEnriched} enriched
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* New operation from source */}
          <div className="relative">
            <button
              onClick={() => setShowSourcePicker(!showSourcePicker)}
              disabled={sourcesLoading || sources.length === 0}
              className="flex items-center gap-1.5 px-3 py-2 bg-[var(--color-cyan)] text-white text-sm font-medium rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              <Play className="w-3.5 h-3.5" />
              New Run
            </button>

            {showSourcePicker && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg shadow-xl z-20 max-h-48 overflow-y-auto">
                {sources.map((src) => (
                  <button
                    key={src.id}
                    onClick={() => {
                      setShowSourcePicker(false);
                      void onStartOperation(src.id);
                    }}
                    className="w-full text-left px-3 py-2 text-sm text-[var(--color-text-primary)] hover:bg-[var(--color-bg-main)] transition-colors"
                  >
                    <div className="font-medium">{src.name}</div>
                    <div className="text-[10px] text-[var(--color-text-disabled)] truncate">
                      {src.description}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Filter row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="w-3.5 h-3.5 text-[var(--color-text-disabled)]" />

          {/* Enrichment filters */}
          <div className="flex gap-1">
            {ENRICHMENT_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onEnrichmentFilterChange(f.value)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                  enrichmentFilter === f.value
                    ? 'bg-[var(--color-cyan)]/20 text-[var(--color-cyan)]'
                    : 'text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <span className="text-[var(--color-border-light)]">|</span>

          {/* Approval filters */}
          <div className="flex gap-1">
            {APPROVAL_FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => onApprovalFilterChange(f.value)}
                className={`px-2 py-0.5 text-[10px] rounded-full transition-colors ${
                  approvalFilter === f.value
                    ? 'bg-[var(--color-primary)]/20 text-[var(--color-primary)]'
                    : 'text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Select all toggle */}
          {findings.length > 0 && (
            <button
              onClick={allSelected ? onClearSelection : onSelectAll}
              className="ml-auto flex items-center gap-1 text-[10px] text-[var(--color-text-disabled)] hover:text-[var(--color-text-secondary)]"
            >
              {allSelected
                ? <CheckSquare className="w-3 h-3" />
                : <Square className="w-3 h-3" />
              }
              {allSelected ? 'Deselect all' : 'Select all'}
            </button>
          )}
        </div>
      </div>

      {/* ── Findings list ───────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {!activeOperation && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <Database className="w-10 h-10 text-[var(--color-text-disabled)] mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)] mb-1">
              No operation selected
            </p>
            <p className="text-xs text-[var(--color-text-disabled)]">
              Select an existing operation or start a new run from a configured source.
            </p>
          </div>
        )}

        {activeOperation && findingsLoading && findings.length === 0 && (
          <div className="flex items-center justify-center p-12">
            <Loader2 className="w-6 h-6 text-[var(--color-cyan)] animate-spin" />
          </div>
        )}

        {activeOperation && !findingsLoading && findings.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center px-8">
            <p className="text-sm text-[var(--color-text-secondary)]">
              No findings yet
            </p>
            <p className="text-xs text-[var(--color-text-disabled)] mt-1">
              This operation hasn&apos;t discovered any entities yet.
            </p>
          </div>
        )}

        {findings.map((finding) => (
          <FindingRow
            key={finding.id}
            finding={finding}
            isSelected={selectedIds.has(finding.id)}
            onToggleSelect={() => onToggleSelect(finding.id)}
            onApprove={() => { void onApprove(finding.id); }}
            onReject={() => { void onReject(finding.id); }}
            onEnrich={() => { void onEnrich(finding.id); }}
          />
        ))}

        {findingsHasMore && (
          <div className="p-4 text-center">
            <button
              onClick={() => { void onLoadMore(); }}
              disabled={findingsLoading}
              className="px-4 py-2 text-xs font-medium text-[var(--color-cyan)] bg-[var(--color-cyan)]/10 rounded-lg hover:bg-[var(--color-cyan)]/20 disabled:opacity-50 transition-colors"
            >
              {findingsLoading ? 'Loading...' : 'Load More'}
            </button>
          </div>
        )}
      </div>

      {/* ── Bulk action bar ─────────────────────────────────────────────── */}
      <FindingsBulkActionBar
        selectedCount={selectedIds.size}
        onBulkApprove={() => { void onBulkApprove(); }}
        onBulkReject={() => { void onBulkReject(); }}
        onClearSelection={onClearSelection}
      />
    </div>
  );
}
