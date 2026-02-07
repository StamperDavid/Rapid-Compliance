'use client';

import { motion } from 'framer-motion';
import { Checkbox } from '@/components/ui/checkbox';
import { exportTableToCSV } from '@/lib/utils/csv-export';
import type { DataTableProps } from './types';
import { useDataTable } from './useDataTable';
import { DataTableHeader } from './DataTableHeader';
import { DataTableToolbar } from './DataTableToolbar';
import { DataTablePagination } from './DataTablePagination';

export function DataTable<T extends { id: string }>({
  columns,
  data,
  loading = false,
  searchPlaceholder = 'Search...',
  searchFilter,
  bulkActions = [],
  enableCsvExport = false,
  csvFilename = 'export',
  hasMore = false,
  onLoadMore,
  itemCountLabel,
  emptyMessage = 'No data found',
  emptyIcon,
  accentColor = 'indigo',
  tableLabel,
}: DataTableProps<T>) {
  const {
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
  } = useDataTable({ data, columns, searchFilter });

  const showSelection = bulkActions.length > 0;
  const columnCount = columns.length + (showSelection ? 1 : 0);

  const handleCsvExport = () => {
    const exportColumns = columns.filter(c => c.exportable !== false && c.accessor != null);
    const headers = exportColumns.map(c => c.header);
    const rows = processedData.map(row =>
      exportColumns.map(col => {
        const val = col.accessor?.(row);
        return val != null ? String(val) : '';
      })
    );
    exportTableToCSV(headers, rows, csvFilename);
  };

  return (
    <div className="space-y-4">
      {/* Toolbar: Search + Bulk Actions + CSV */}
      <DataTableToolbar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        searchPlaceholder={searchPlaceholder}
        selectedCount={selectedIds.size}
        bulkActions={bulkActions}
        selectedIds={selectedIds}
        getSelectedRows={getSelectedRows}
        onClearSelection={clearSelection}
        enableCsvExport={enableCsvExport}
        onCsvExport={handleCsvExport}
        accentColor={accentColor}
      />

      {/* Table */}
      <div className="rounded-2xl bg-black/40 backdrop-blur-xl border border-white/10 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full" aria-label={tableLabel}>
            <DataTableHeader
              columns={columns}
              sortState={sortState}
              onToggleSort={toggleSort}
              allSelected={allSelected}
              someSelected={someSelected}
              onToggleSelectAll={toggleSelectAll}
              showSelection={showSelection}
            />
            <tbody>
              {processedData.length === 0 && !loading ? (
                <tr>
                  <td colSpan={columnCount} className="p-12 text-center">
                    <div className="flex flex-col items-center gap-4">
                      {emptyIcon && (
                        <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center">
                          {emptyIcon}
                        </div>
                      )}
                      <p className="text-gray-400">{emptyMessage}</p>
                    </div>
                  </td>
                </tr>
              ) : (
                processedData.map((row, idx) => (
                  <motion.tr
                    key={row.id}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.02 }}
                    className={`border-t border-white/5 hover:bg-white/5 transition-colors group ${
                      selectedIds.has(row.id) ? 'bg-white/[0.03]' : ''
                    }`}
                  >
                    {showSelection && (
                      <td className="w-12 p-4">
                        <Checkbox
                          checked={selectedIds.has(row.id)}
                          onChange={() => toggleRowSelection(row.id)}
                          aria-label={`Select row ${row.id}`}
                        />
                      </td>
                    )}
                    {columns.map(column => (
                      <td key={column.key} className={`p-4 ${column.className ?? ''}`}>
                        {column.render
                          ? column.render(row)
                          : (() => {
                              const val = column.accessor?.(row);
                              return <span className="text-gray-400">{val != null ? String(val) : '-'}</span>;
                            })()}
                      </td>
                    ))}
                  </motion.tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {onLoadMore && (
          <DataTablePagination
            hasMore={hasMore}
            loading={loading ?? false}
            onLoadMore={onLoadMore}
            itemCountLabel={itemCountLabel}
          />
        )}
      </div>
    </div>
  );
}
