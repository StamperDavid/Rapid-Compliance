'use client';

import { Search, Download, X } from 'lucide-react';
import type { BulkAction } from './types';

interface DataTableToolbarProps<T extends { id: string }> {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  searchPlaceholder: string;
  selectedCount: number;
  bulkActions: BulkAction<T>[];
  selectedIds: Set<string>;
  getSelectedRows: () => T[];
  onClearSelection: () => void;
  enableCsvExport: boolean;
  onCsvExport: () => void;
  accentColor: string;
}

export function DataTableToolbar<T extends { id: string }>({
  searchQuery,
  onSearchChange,
  searchPlaceholder,
  selectedCount,
  bulkActions,
  selectedIds,
  getSelectedRows,
  onClearSelection,
  enableCsvExport,
  onCsvExport,
}: DataTableToolbarProps<T>) {
  return (
    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--color-text-disabled)]" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className="w-full pl-12 pr-4 py-3 bg-surface-elevated border border-border-light rounded-xl text-[var(--color-text-primary)] placeholder-[var(--color-text-disabled)] focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary transition-all"
        />
      </div>

      {/* Right side: selection actions + CSV */}
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <>
            <span className="text-sm text-[var(--color-text-secondary)] mr-1">
              {selectedCount} selected
            </span>
            {bulkActions.map(action => (
              <button
                key={action.key}
                onClick={() => {
                  void action.onAction(
                    Array.from(selectedIds),
                    getSelectedRows()
                  );
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                  action.variant === 'destructive'
                    ? 'bg-error/10 hover:bg-error/20 border border-error/30 text-error hover:text-error-light'
                    : 'bg-surface-elevated hover:bg-surface-elevated/80 border border-border-light text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
            <button
              onClick={onClearSelection}
              className="p-2 text-[var(--color-text-disabled)] hover:text-[var(--color-text-primary)] transition-colors"
              title="Clear selection"
              aria-label="Clear selection"
            >
              <X className="w-4 h-4" />
            </button>
          </>
        )}

        {enableCsvExport && selectedCount === 0 && (
          <button
            onClick={onCsvExport}
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-surface-elevated hover:bg-surface-elevated/80 border border-border-light text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] rounded-lg transition-all text-sm"
            title="Export to CSV"
            aria-label="Export to CSV"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        )}
      </div>
    </div>
  );
}
