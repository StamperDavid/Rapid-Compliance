'use client';

import { Check, ArrowRight, Download, CheckSquare, Square } from 'lucide-react';

interface ResultsBulkActionBarProps {
  selectedCount: number;
  totalCount: number;
  onSelectAll: () => void;
  onClearSelection: () => void;
  onBulkApprove: () => void;
  onConvertSelected: () => void;
  onExportCsv: () => void;
}

export default function ResultsBulkActionBar({
  selectedCount,
  totalCount,
  onSelectAll,
  onClearSelection,
  onBulkApprove,
  onConvertSelected,
  onExportCsv,
}: ResultsBulkActionBarProps) {
  const allSelected = selectedCount === totalCount && totalCount > 0;

  return (
    <div className="flex items-center justify-between px-4 py-2 bg-[var(--color-bg-elevated)] border-t border-[var(--color-border-light)]">
      <div className="flex items-center gap-3">
        <button
          onClick={allSelected ? onClearSelection : onSelectAll}
          className="flex items-center gap-1.5 text-xs text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          {allSelected ? (
            <CheckSquare className="w-3.5 h-3.5" />
          ) : (
            <Square className="w-3.5 h-3.5" />
          )}
          {selectedCount > 0 ? `${selectedCount} selected` : 'Select all'}
        </button>
      </div>

      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <>
            <button
              onClick={onBulkApprove}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-green-500/10 text-green-400 border border-green-500/30 hover:bg-green-500/20 transition-colors"
            >
              <Check className="w-3 h-3" /> Approve ({selectedCount})
            </button>
            <button
              onClick={onConvertSelected}
              className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-blue-500/10 text-blue-400 border border-blue-500/30 hover:bg-blue-500/20 transition-colors"
            >
              <ArrowRight className="w-3 h-3" /> Convert ({selectedCount})
            </button>
          </>
        )}
        <button
          onClick={onExportCsv}
          disabled={totalCount === 0}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-[var(--color-bg-main)] text-[var(--color-text-secondary)] border border-[var(--color-border-light)] hover:text-[var(--color-text-primary)] disabled:opacity-50 transition-colors"
        >
          <Download className="w-3 h-3" /> CSV
        </button>
      </div>
    </div>
  );
}
