import type { ReactNode } from 'react';

/** Sort direction for a column */
export type SortDirection = 'asc' | 'desc' | null;

/** Sort state for a table */
export interface SortState {
  columnKey: string;
  direction: SortDirection;
}

/** Column definition for the DataTable */
export interface ColumnDef<T> {
  /** Unique key matching a field on T, or a custom key for render-only columns */
  key: string;
  /** Column header label */
  header: string;
  /** Whether the column is sortable (default: true for data columns) */
  sortable?: boolean;
  /** Custom render function for the cell */
  render?: (row: T) => ReactNode;
  /** Accessor function to get the raw value for sorting and CSV export */
  accessor?: (row: T) => string | number | boolean | null | undefined;
  /** Whether to include this column in CSV export (default: true) */
  exportable?: boolean;
  /** Custom class for the <th> and <td> */
  className?: string;
}

/** Bulk action definition */
export interface BulkAction<T> {
  /** Unique identifier */
  key: string;
  /** Button label */
  label: string;
  /** Lucide icon component or ReactNode */
  icon?: ReactNode;
  /** Visual variant */
  variant: 'default' | 'destructive';
  /** Handler called with selected row IDs */
  onAction: (selectedIds: string[], selectedRows: T[]) => void | Promise<void>;
}

/** Props for the DataTable component */
export interface DataTableProps<T extends { id: string }> {
  /** Column definitions */
  columns: ColumnDef<T>[];
  /** Row data */
  data: T[];
  /** Whether data is currently loading */
  loading?: boolean;
  /** Search placeholder text */
  searchPlaceholder?: string;
  /** Filter function applied to rows based on search query */
  searchFilter?: (row: T, query: string) => boolean;
  /** Bulk actions shown when rows are selected */
  bulkActions?: BulkAction<T>[];
  /** Whether to show the CSV export button */
  enableCsvExport?: boolean;
  /** Filename prefix for CSV export */
  csvFilename?: string;
  /** Whether "Load More" pagination is available */
  hasMore?: boolean;
  /** Callback to load more data */
  onLoadMore?: () => void;
  /** Total item count text (e.g., "50 shown") */
  itemCountLabel?: string;
  /** Empty state message */
  emptyMessage?: string;
  /** Empty state icon */
  emptyIcon?: ReactNode;
  /** Accent color for gradients and focus rings (tailwind class prefix, e.g., "indigo") */
  accentColor?: string;
  /** Accessible label for the table (announced by screen readers) */
  tableLabel?: string;
}
