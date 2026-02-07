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
  accentColor,
}: DataTableToolbarProps<T>) {
  const ringClass = `focus:ring-${accentColor}-500/50 focus:border-${accentColor}-500/50`;

  return (
    <div className="flex flex-col md:flex-row gap-3 items-start md:items-center justify-between">
      {/* Search */}
      <div className="relative flex-1 max-w-md">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder={searchPlaceholder}
          aria-label={searchPlaceholder}
          className={`w-full pl-12 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 ${ringClass} transition-all`}
        />
      </div>

      {/* Right side: selection actions + CSV */}
      <div className="flex items-center gap-2">
        {selectedCount > 0 && (
          <>
            <span className="text-sm text-gray-400 mr-1">
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
                    ? 'bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-400 hover:text-red-300'
                    : 'bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white'
                }`}
              >
                {action.icon}
                {action.label}
              </button>
            ))}
            <button
              onClick={onClearSelection}
              className="p-2 text-gray-500 hover:text-white transition-colors"
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
            className="inline-flex items-center gap-1.5 px-3 py-2 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-300 hover:text-white rounded-lg transition-all text-sm"
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
