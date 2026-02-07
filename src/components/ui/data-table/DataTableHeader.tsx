'use client';

import { ArrowDown, ArrowUp, ArrowUpDown } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import type { ColumnDef, SortState } from './types';

interface DataTableHeaderProps<T> {
  columns: ColumnDef<T>[];
  sortState: SortState;
  onToggleSort: (columnKey: string) => void;
  allSelected: boolean;
  someSelected: boolean;
  onToggleSelectAll: () => void;
  showSelection: boolean;
}

export function DataTableHeader<T>({
  columns,
  sortState,
  onToggleSort,
  allSelected,
  someSelected,
  onToggleSelectAll,
  showSelection,
}: DataTableHeaderProps<T>) {
  const getSortIcon = (columnKey: string) => {
    if (sortState.columnKey !== columnKey || !sortState.direction) {
      return <ArrowUpDown className="w-3.5 h-3.5 text-gray-600" />;
    }
    if (sortState.direction === 'asc') {
      return <ArrowUp className="w-3.5 h-3.5 text-indigo-400" />;
    }
    return <ArrowDown className="w-3.5 h-3.5 text-indigo-400" />;
  };

  return (
    <thead>
      <tr className="border-b border-white/10">
        {showSelection && (
          <th scope="col" className="w-12 p-4">
            <Checkbox
              checked={allSelected}
              indeterminate={someSelected}
              onChange={onToggleSelectAll}
              aria-label="Select all rows"
            />
          </th>
        )}
        {columns.map(column => {
          const sortable = column.sortable !== false && column.accessor != null;
          return (
            <th
              key={column.key}
              scope="col"
              aria-sort={
                sortState.columnKey === column.key && sortState.direction
                  ? sortState.direction === 'asc' ? 'ascending' : 'descending'
                  : undefined
              }
              className={`text-left p-4 text-sm font-semibold text-gray-400 ${column.className ?? ''}`}
            >
              {sortable ? (
                <button
                  onClick={() => onToggleSort(column.key)}
                  className="inline-flex items-center gap-1.5 hover:text-white transition-colors group"
                >
                  {column.header}
                  {sortState.columnKey === column.key && sortState.direction ? (
                    getSortIcon(column.key)
                  ) : (
                    <span className="opacity-0 group-hover:opacity-100 transition-opacity">
                      {getSortIcon(column.key)}
                    </span>
                  )}
                </button>
              ) : (
                column.header
              )}
            </th>
          );
        })}
      </tr>
    </thead>
  );
}
