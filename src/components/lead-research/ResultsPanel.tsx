'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Search, ChevronDown } from 'lucide-react';
import ResultCard from './ResultCard';
import ResultsBulkActionBar from './ResultsBulkActionBar';
import type { DiscoveryBatch, DiscoveryResult, DiscoveryResultStatus } from '@/types/discovery-batch';

interface ResultsPanelProps {
  batches: DiscoveryBatch[];
  activeBatch: DiscoveryBatch | null;
  results: DiscoveryResult[];
  batchesLoading: boolean;
  resultsLoading: boolean;
  selectedIds: Set<string>;
  statusFilter: DiscoveryResultStatus | 'all';
  onSetStatusFilter: (f: DiscoveryResultStatus | 'all') => void;
  onToggleSelect: (id: string) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onSetActiveBatch: (batch: DiscoveryBatch | null) => void;
  onLoadBatchResults: (batchId: string, status?: string) => void;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
  onBulkApprove: () => void;
  onConvert: (ids: string[]) => void;
  onExportCsv: (batchId: string) => void;
}

const STATUS_FILTERS: { value: DiscoveryResultStatus | 'all'; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'approved', label: 'Approved' },
  { value: 'rejected', label: 'Rejected' },
  { value: 'converted', label: 'Converted' },
];

function batchStatusColor(status: string): string {
  switch (status) {
    case 'completed': return 'text-green-400';
    case 'running': return 'text-yellow-400';
    case 'failed': return 'text-red-400';
    default: return 'text-gray-400';
  }
}

export default function ResultsPanel({
  batches,
  activeBatch,
  results,
  batchesLoading,
  resultsLoading,
  selectedIds,
  statusFilter,
  onSetStatusFilter,
  onToggleSelect,
  onSelectAll,
  onClearSelection,
  onSetActiveBatch,
  onLoadBatchResults,
  onApprove,
  onReject,
  onBulkApprove,
  onConvert,
  onExportCsv,
}: ResultsPanelProps) {
  const [showBatchPicker, setShowBatchPicker] = useState(false);

  const handleBatchSelect = (batch: DiscoveryBatch) => {
    onSetActiveBatch(batch);
    onLoadBatchResults(batch.id);
    setShowBatchPicker(false);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header with batch picker */}
      <div className="p-4 border-b border-[var(--color-border-light)]">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-[var(--color-text-primary)]">
            Research Results
          </h2>
          <div className="relative">
            <button
              onClick={() => setShowBatchPicker(!showBatchPicker)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-[var(--color-bg-main)] border border-[var(--color-border-light)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
            >
              {activeBatch ? (
                <>
                  <span className={batchStatusColor(activeBatch.status)}>&#9679;</span>
                  Batch: {activeBatch.id.slice(-8)}
                </>
              ) : (
                'Select Batch'
              )}
              <ChevronDown className="w-3 h-3" />
            </button>

            {showBatchPicker && (
              <div className="absolute right-0 top-full mt-1 w-64 bg-[var(--color-bg-elevated)] border border-[var(--color-border-light)] rounded-lg shadow-xl z-10 max-h-48 overflow-y-auto">
                {batchesLoading ? (
                  <div className="p-3 text-center text-xs text-[var(--color-text-disabled)]">
                    <Loader2 className="w-4 h-4 animate-spin mx-auto" />
                  </div>
                ) : batches.length === 0 ? (
                  <div className="p-3 text-center text-xs text-[var(--color-text-disabled)]">
                    No batches yet. Start a research scan.
                  </div>
                ) : (
                  batches.map(batch => (
                    <button
                      key={batch.id}
                      onClick={() => handleBatchSelect(batch)}
                      className={`w-full text-left px-3 py-2 text-xs hover:bg-[var(--color-bg-main)] transition-colors border-b border-[var(--color-border-light)] last:border-b-0 ${
                        activeBatch?.id === batch.id ? 'bg-blue-500/10' : ''
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[var(--color-text-primary)]">
                          {batch.icpProfileName || 'Unnamed'}
                        </span>
                        <span className={batchStatusColor(batch.status)}>
                          {batch.status}
                        </span>
                      </div>
                      <div className="text-[var(--color-text-disabled)] mt-0.5">
                        {batch.totalFound} found · {batch.totalApproved} approved
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-1">
          {STATUS_FILTERS.map(f => (
            <button
              key={f.value}
              onClick={() => {
                onSetStatusFilter(f.value);
                if (activeBatch) {onLoadBatchResults(activeBatch.id, f.value === 'all' ? undefined : f.value);}
              }}
              className={`px-2.5 py-1 text-xs rounded-md transition-colors ${
                statusFilter === f.value
                  ? 'bg-blue-600 text-white'
                  : 'text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-main)]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {/* Results list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {resultsLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-[var(--color-text-disabled)]" />
          </div>
        ) : !activeBatch ? (
          <div className="text-center py-12">
            <Search className="w-8 h-8 mx-auto text-[var(--color-text-disabled)] mb-3" />
            <p className="text-sm text-[var(--color-text-secondary)]">
              Chat with the AI researcher to start finding leads, or select an existing batch above.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[var(--color-text-disabled)]">
              No results {statusFilter !== 'all' ? `with status "${statusFilter}"` : 'in this batch'}.
            </p>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {results.map(result => (
              <motion.div
                key={result.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.15 }}
              >
                <ResultCard
                  result={result}
                  isSelected={selectedIds.has(result.id)}
                  onToggleSelect={() => onToggleSelect(result.id)}
                  onApprove={() => onApprove(result.id)}
                  onReject={() => onReject(result.id)}
                  onConvert={() => onConvert([result.id])}
                />
              </motion.div>
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Bulk action bar */}
      {activeBatch && results.length > 0 && (
        <ResultsBulkActionBar
          selectedCount={selectedIds.size}
          totalCount={results.length}
          onSelectAll={onSelectAll}
          onClearSelection={onClearSelection}
          onBulkApprove={onBulkApprove}
          onConvertSelected={() => onConvert(Array.from(selectedIds))}
          onExportCsv={() => onExportCsv(activeBatch.id)}
        />
      )}
    </div>
  );
}
