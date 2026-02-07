'use client';

import { useState, useMemo, useCallback } from 'react';
import type { ColumnDef, SortState, SortDirection } from './types';

interface UseDataTableOptions<T extends { id: string }> {
  data: T[];
  columns: ColumnDef<T>[];
  searchFilter?: (row: T, query: string) => boolean;
}

interface UseDataTableReturn<T extends { id: string }> {
  /** Current search query */
  searchQuery: string;
  /** Set the search query */
  setSearchQuery: (query: string) => void;
  /** Current sort state */
  sortState: SortState;
  /** Toggle sort on a column */
  toggleSort: (columnKey: string) => void;
  /** Set of selected row IDs */
  selectedIds: Set<string>;
  /** Toggle selection of a single row */
  toggleRowSelection: (id: string) => void;
  /** Toggle select-all for currently visible rows */
  toggleSelectAll: () => void;
  /** Whether all visible rows are selected */
  allSelected: boolean;
  /** Whether some (but not all) visible rows are selected */
  someSelected: boolean;
  /** Clear selection */
  clearSelection: () => void;
  /** Filtered and sorted data */
  processedData: T[];
  /** Get selected rows */
  getSelectedRows: () => T[];
}

export function useDataTable<T extends { id: string }>({
  data,
  columns,
  searchFilter,
}: UseDataTableOptions<T>): UseDataTableReturn<T> {
  const [searchQuery, setSearchQuery] = useState('');
  const [sortState, setSortState] = useState<SortState>({
    columnKey: '',
    direction: null,
  });
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Filter data by search query
  const filteredData = useMemo(() => {
    if (!searchQuery || !searchFilter) {
      return data;
    }
    const query = searchQuery.toLowerCase();
    return data.filter(row => searchFilter(row, query));
  }, [data, searchQuery, searchFilter]);

  // Sort filtered data
  const processedData = useMemo(() => {
    if (!sortState.columnKey || !sortState.direction) {
      return filteredData;
    }

    const column = columns.find(c => c.key === sortState.columnKey);
    if (!column?.accessor) {
      return filteredData;
    }

    const direction = sortState.direction;
    const accessor = column.accessor;

    return [...filteredData].sort((a, b) => {
      const aVal = accessor(a);
      const bVal = accessor(b);

      // Handle nulls
      if (aVal == null && bVal == null) { return 0; }
      if (aVal == null) { return direction === 'asc' ? -1 : 1; }
      if (bVal == null) { return direction === 'asc' ? 1 : -1; }

      // Compare
      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return direction === 'asc' ? aVal - bVal : bVal - aVal;
      }

      const aStr = String(aVal).toLowerCase();
      const bStr = String(bVal).toLowerCase();
      const cmp = aStr.localeCompare(bStr);
      return direction === 'asc' ? cmp : -cmp;
    });
  }, [filteredData, sortState, columns]);

  const toggleSort = useCallback((columnKey: string) => {
    setSortState(prev => {
      if (prev.columnKey !== columnKey) {
        return { columnKey, direction: 'asc' as SortDirection };
      }
      if (prev.direction === 'asc') {
        return { columnKey, direction: 'desc' as SortDirection };
      }
      return { columnKey: '', direction: null };
    });
  }, []);

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const allSelected = processedData.length > 0 && processedData.every(row => selectedIds.has(row.id));
  const someSelected = processedData.some(row => selectedIds.has(row.id)) && !allSelected;

  const toggleSelectAll = useCallback(() => {
    if (allSelected) {
      // Deselect all visible rows
      setSelectedIds(prev => {
        const next = new Set(prev);
        processedData.forEach(row => next.delete(row.id));
        return next;
      });
    } else {
      // Select all visible rows
      setSelectedIds(prev => {
        const next = new Set(prev);
        processedData.forEach(row => next.add(row.id));
        return next;
      });
    }
  }, [allSelected, processedData]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const getSelectedRows = useCallback(() => {
    return processedData.filter(row => selectedIds.has(row.id));
  }, [processedData, selectedIds]);

  return {
    searchQuery,
    setSearchQuery,
    sortState,
    toggleSort,
    selectedIds,
    toggleRowSelection,
    toggleSelectAll,
    allSelected,
    someSelected,
    clearSelection,
    processedData,
    getSelectedRows,
  };
}
