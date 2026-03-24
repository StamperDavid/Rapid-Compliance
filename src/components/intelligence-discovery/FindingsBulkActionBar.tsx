/**
 * FindingsBulkActionBar — Sticky bottom bar for bulk operations
 */

'use client';

import React from 'react';
import { ThumbsUp, ThumbsDown, X } from 'lucide-react';

interface FindingsBulkActionBarProps {
  selectedCount: number;
  onBulkApprove: () => void;
  onBulkReject: () => void;
  onClearSelection: () => void;
}

export default function FindingsBulkActionBar({
  selectedCount,
  onBulkApprove,
  onBulkReject,
  onClearSelection,
}: FindingsBulkActionBarProps) {
  if (selectedCount === 0) { return null; }

  return (
    <div className="px-4 py-3 border-t border-[var(--color-border-light)] bg-[var(--color-bg-main)] flex items-center gap-3">
      <span className="text-xs text-[var(--color-text-secondary)]">
        <span className="font-semibold text-[var(--color-cyan)]">{selectedCount}</span> selected
      </span>

      <div className="flex gap-2 ml-auto">
        <button
          onClick={onBulkApprove}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-success)]/10 text-[var(--color-success)] hover:bg-[var(--color-success)]/20 transition-colors"
        >
          <ThumbsUp className="w-3 h-3" />
          Approve
        </button>
        <button
          onClick={onBulkReject}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-error)]/10 text-[var(--color-error)] hover:bg-[var(--color-error)]/20 transition-colors"
        >
          <ThumbsDown className="w-3 h-3" />
          Reject
        </button>
        <button
          onClick={onClearSelection}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] transition-colors"
        >
          <X className="w-3 h-3" />
          Clear
        </button>
      </div>
    </div>
  );
}
